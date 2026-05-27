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
 *   - Nothing leaves the device. Add a flush(endpoint) call later when
 *     a server is available.
 */

const MAX_EVENTS = 500;

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
}
