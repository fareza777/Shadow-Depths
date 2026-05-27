/**
 * Achievement engine.
 *
 * Triggers tracked in meta.achievementCounters; unlocked ids stored in
 * meta.achievementsUnlocked. Each definition declares { trigger,
 * threshold, reward }. When a counter crosses the threshold, the
 * achievement unlocks, the reward is applied to the meta state, and a
 * toast emits.
 *
 * Counter taxonomy (matches data/achievements.json):
 *   enemy_kills            cumulative across runs
 *   bosses_slain           cumulative
 *   items_crafted          cumulative
 *   items_identified       cumulative (distinct ids; tracked separately)
 *   victories              cumulative
 *   daily_runs             cumulative
 *   deepest_floor          running max
 *   level_reached          running max in a single run
 *   perfect_floors         cumulative
 *   set_active_2pc         max active piece count seen
 *   set_active_3pc         max active piece count seen
 *   hard_floor_30          flag (1 if achieved)
 *   heroes_played          distinct hero kind count
 *   vaults_run             max vaults entered in any one run
 */

let DEFS = [];
const DEF_BY_ID = new Map();

export function loadAchievementDefs(json) {
  DEFS = Array.isArray(json?.achievements) ? json.achievements : [];
  DEF_BY_ID.clear();
  for (const d of DEFS) DEF_BY_ID.set(d.id, d);
}

export function listAchievements() { return DEFS; }
export function getAchievement(id) { return DEF_BY_ID.get(id) || null; }

function ensureMeta(meta) {
  if (!meta.achievementCounters) meta.achievementCounters = {};
  if (!Array.isArray(meta.achievementsUnlocked)) meta.achievementsUnlocked = [];
  if (!Array.isArray(meta.heroesPlayed)) meta.heroesPlayed = [];
  return meta;
}

export class AchievementEngine {
  /** @param {{ bus:object, state:object }} deps */
  constructor({ bus, state }) {
    this.bus = bus;
    this.state = state;
    this._wire();
  }

  _wire() {
    if (!this.bus || !this.state?.state?.meta) return;
    const meta = ensureMeta(this.state.state.meta);

    this.bus.on('entity:died', ({ entity }) => {
      if (entity?.kind !== 'enemy') return;
      this.bump(meta, 'enemy_kills', 1);
      if ((entity.defId || '').startsWith('boss_')) this.bump(meta, 'bosses_slain', 1);
    });
    this.bus.on('item:crafted', () => this.bump(meta, 'items_crafted', 1));
    this.bus.on('item:identified', () => this.bump(meta, 'items_identified', 1));
    this.bus.on('run:victory', () => this.bump(meta, 'victories', 1));
    this.bus.on('floor:entered', ({ floorNumber, type }) => {
      this.setMax(meta, 'deepest_floor', floorNumber || 1);
      if (type === 'vault') {
        meta._vaultsThisRun = (meta._vaultsThisRun || 0) + 1;
        this.setMax(meta, 'vaults_run', meta._vaultsThisRun);
      }
      // Hard-difficulty floor 30 flag
      const diff = meta.settings?.difficulty;
      if (floorNumber >= 30 && (diff === 'hard' || diff === 'ascend1' || diff === 'ascend2')) {
        this.bump(meta, 'hard_floor_30', 1);
      }
    });
    this.bus.on('entity:leveledUp', ({ entity }) => {
      if (entity?.kind === 'player') this.setMax(meta, 'level_reached', entity.level);
    });
    this.bus.on('run:started', ({ heroKind, mode }) => {
      meta._vaultsThisRun = 0;
      this.setMax(meta, 'level_reached', 1);
      if (heroKind && !meta.heroesPlayed.includes(heroKind)) {
        meta.heroesPlayed.push(heroKind);
        this.setMax(meta, 'heroes_played', meta.heroesPlayed.length);
      }
      if (mode === 'daily') this.bump(meta, 'daily_runs', 1);
    });
    this.bus.on('floor:cleared_perfect', () => this.bump(meta, 'perfect_floors', 1));
    this.bus.on('sets:active', ({ count }) => {
      if (count >= 2) this.bump(meta, 'set_active_2pc', 1);
      if (count >= 3) this.bump(meta, 'set_active_3pc', 1);
    });
  }

  bump(meta, key, by = 1) {
    const next = (meta.achievementCounters[key] || 0) + by;
    meta.achievementCounters[key] = next;
    this._evaluate(meta);
  }

  setMax(meta, key, val) {
    const cur = meta.achievementCounters[key] || 0;
    if (val > cur) {
      meta.achievementCounters[key] = val;
      this._evaluate(meta);
    }
  }

  _evaluate(meta) {
    const unlocked = new Set(meta.achievementsUnlocked);
    for (const def of DEFS) {
      if (unlocked.has(def.id)) continue;
      const counter = meta.achievementCounters[def.trigger] || 0;
      if (counter >= def.threshold) {
        meta.achievementsUnlocked.push(def.id);
        if (def.reward?.coins) meta.coins = (meta.coins || 0) + def.reward.coins;
        this.bus?.emit('achievement:unlocked', { id: def.id, def });
      }
    }
  }
}
