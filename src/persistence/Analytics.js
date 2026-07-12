/**
 * Analytics — lightweight event capture stored in meta.events.
 *
 * The game already keeps a meta.runHistory[] for completed runs. This
 * module captures FINER events (level-up, boss kill, item identified,
 * craft completed, status applied) into a ring buffer so the Codex /
 * leaderboard / future server flush has somewhere to read from.
 *
 * Design:
 *   - Append-only ring buffer capped at MAX_EVENTS so localStorage
 *     never blows up.
 *   - Each event: { t (ms), kind, ...payload }
 *   - Buffer lives in state.meta.events; persisted via saveMeta on the
 *     normal save cadence.
 *   - flush({ endpoint, optIn }) POSTs recent events when the player
 *     has opted in (meta.settings.analyticsOptIn) and an endpoint is set.
 *     Opt-in is toggled from TitleScreen Settings (LANGUAGE / ANALYTICS).
 */

const MAX_EVENTS = 500;
const FLUSH_BATCH = 50;

export class Analytics {
  /**
   * @param {{ bus:object, state:object }} deps
   */
  constructor({ bus, state }) {
    this.bus = bus;
    this.state = state;
    this._wire();
  }

  _wire() {
    if (!this.bus) return;
    this.bus.on('entity:leveledUp', ({ entity, levels }) => {
      if (entity?.kind === 'player') this.log('level_up', { newLevel: entity.level, levels });
    });
    this.bus.on('entity:died', ({ entity, killer }) => {
      if (entity?.kind === 'player') this.log('death', { killedBy: killer?.name || 'unknown' });
      else if ((entity?.defId || '').startsWith('boss_')) {
        this.log('boss_kill', { bossId: entity.defId });
      }
    });
    this.bus.on('item:identified', ({ item }) => {
      if (item?.id) this.log('item_identified', { id: item.id });
    });
    this.bus.on('item:crafted', ({ item }) => {
      if (item?.id) this.log('craft', { id: item.id, rarity: item.rarity });
    });
    this.bus.on('floor:entered', (payload) => {
      this.log('floor_enter', {
        floor: payload?.floorNumber,
        biomeId: payload?.biomeId,
        type: payload?.type
      });
    });
    this.bus.on('run:victory', () => this.log('victory', {}));
    this.bus.on('run:over', (summary) => {
      this.log('run_over', {
        score: summary?.score,
        floorsCleared: summary?.floorsCleared,
        mode: summary?.mode
      });
      this._maybeFlush();
    });
    this.bus.on('paywall:shown', (payload) => {
      this.log('paywall_shown', { reason: payload?.reason || 'unknown' });
    });
    this.bus.on('billing:unlocked', (payload) => {
      this.log('billing_unlocked', {
        source: payload?.source || payload?.reason || 'unknown'
      });
    });
    this.bus.on('app:background', () => this._maybeFlush());
  }

  /** Fire-and-forget flush when opt-in + VITE_ANALYTICS_ENDPOINT are set. */
  _maybeFlush() {
    const endpoint = (typeof import.meta !== 'undefined'
      && import.meta.env?.VITE_ANALYTICS_ENDPOINT) || null;
    if (!endpoint) return;
    this.flush({ endpoint }).catch(() => {});
  }

  log(kind, payload = {}) {
    const meta = this.state?.state?.meta;
    if (!meta) return;
    if (!Array.isArray(meta.events)) meta.events = [];
    meta.events.push({ t: Date.now(), kind, ...payload });
    // Bound the buffer.
    if (meta.events.length > MAX_EVENTS) {
      meta.events.splice(0, meta.events.length - MAX_EVENTS);
    }
  }

  /** Read-only snapshot — UI calls this for live tickers. */
  recent(kind, limit = 10) {
    const evts = this.state?.state?.meta?.events || [];
    const filtered = kind ? evts.filter((e) => e.kind === kind) : evts;
    return filtered.slice(-limit);
  }

  /** Aggregate counts by kind — diagnostic helper. */
  summary() {
    const evts = this.state?.state?.meta?.events || [];
    const out = {};
    for (const e of evts) out[e.kind] = (out[e.kind] || 0) + 1;
    return out;
  }

  /**
   * POST recent events to an analytics endpoint when opted in.
   * No-op unless both `optIn` (or meta.settings.analyticsOptIn) and
   * `endpoint` are truthy. Safe to call from idle / run-end hooks.
   *
   * Settings toggle: TitleScreen → Settings → ANALYTICS row writes
   * meta.settings.analyticsOptIn via MetaProgress.setSetting.
   *
   * @param {{ endpoint?:string, optIn?:boolean, limit?:number }} [opts]
   * @returns {Promise<boolean>} true if a request was attempted
   */
  async flush({ endpoint, optIn, limit = FLUSH_BATCH } = {}) {
    const settings = this.state?.state?.meta?.settings || {};
    const allowed = optIn ?? !!settings.analyticsOptIn;
    if (!allowed || !endpoint) return false;
    const events = this.recent(null, limit);
    if (!events.length) return false;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          t: Date.now(),
          events
        }),
        keepalive: true
      });
      return !!res?.ok;
    } catch {
      return false;
    }
  }
}
