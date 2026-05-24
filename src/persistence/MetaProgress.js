/**
 * MetaProgress — long-term player progression.
 *
 * Holds: highscore, runs_completed, runs_died, unlocks[], settings, and a
 * rolling run_history (last 10) for future analytics. All of it lives under
 * the single `meta` localStorage key, written through SaveManager.
 *
 * Scoring formula lives in `balance.json` so weekly tuning doesn't require
 * a rebuild (Section 10.3 of the brief).
 *
 * Unlock evaluation is intentionally idempotent — calling `recordRun()`
 * twice with the same summary won't double-add unlocks.
 */
import { LOG } from '../config/constants.js';

const HISTORY_LIMIT = 10;

const DEFAULT_META = Object.freeze({
  highscore: 0,
  runsCompleted: 0,
  runsDied: 0,
  unlocks: [],
  coins: 0,
  shopUpgrades: {},
  settings: {
    volume: 0.6,
    vibration: true,
    showTutorial: true,
    orientation: 'portrait'
  },
  runHistory: []
});

const COINS_PER_SCORE = 50;

export class MetaProgress {
  /**
   * @param {{ saveManager:object, balance:object, eventBus:object }} deps
   */
  constructor({ saveManager, balance, eventBus }) {
    this.save = saveManager;
    this.balance = balance;
    this.bus = eventBus;
    this._state = MetaProgress._clone(DEFAULT_META);
  }

  /** Load from storage. Returns the meta payload (also stored internally). */
  load() {
    const raw = this.save.loadMeta();
    if (!raw) return this._state;
    const migrated = this.save.migrate(raw).data || raw;
    this._state = MetaProgress._merge(DEFAULT_META, migrated);
    return this._state;
  }

  get state() { return this._state; }

  /**
   * Compute score from a run summary using balance.scoring.
   * @param {object} run summary { floorsCleared, enemiesDefeated, goldCollected, xpGained, turnsUsed, perfectFloors }
   */
  computeScore(run) {
    const s = this.balance.scoring;
    const efficiency = run.turnsUsed > 0 ? Math.floor(s.efficiencyNumerator / run.turnsUsed) : 0;
    return Math.max(0,
      (run.floorsCleared || 0) * s.perFloor
      + (run.enemiesDefeated || 0) * s.perEnemy
      + (run.goldCollected || 0)  * s.perGold
      + Math.floor((run.xpGained || 0) * s.perXP)
      + efficiency
      + (run.perfectFloors || 0)  * s.perfectFloorBonus
    );
  }

  /**
   * Persist a finished run (victory or death). Updates highscore, unlocks,
   * counts, history, and coin balance.
   * Emits 'meta:updated', 'meta:unlocked', 'meta:coins'.
   *
   * @param {object} runSummary
   * @returns {{ score:number, coinsEarned:number, isNewHighScore:boolean, unlocked:string[] }}
   */
  recordRun(runSummary) {
    const score = this.computeScore(runSummary);
    runSummary.score = score;
    runSummary.timestamp = Date.now();

    const wasHigh = score > this._state.highscore;
    if (wasHigh) this._state.highscore = score;

    if (runSummary.died) this._state.runsDied += 1;
    else this._state.runsCompleted += 1;

    // Coin reward — convert score to coins. Coin Magnet upgrade adds 20%.
    const magnetLevels = (this._state.shopUpgrades?.coin_magnet || 0);
    const coinMult = 1 + magnetLevels * 0.20;
    const coinsEarned = Math.floor((score / COINS_PER_SCORE) * coinMult);
    this._state.coins = (this._state.coins || 0) + coinsEarned;
    runSummary.coinsEarned = coinsEarned;

    // History (most recent first).
    this._state.runHistory.unshift({
      score,
      coinsEarned,
      died: !!runSummary.died,
      floorsCleared: runSummary.floorsCleared || 0,
      killedBy: runSummary.killedBy || null,
      timestamp: runSummary.timestamp
    });
    if (this._state.runHistory.length > HISTORY_LIMIT) {
      this._state.runHistory.length = HISTORY_LIMIT;
    }

    const newlyUnlocked = this._evaluateUnlocks(runSummary);

    this.save.saveMeta(this._state);
    this.bus?.emit('meta:updated', { meta: this._state, score, isNewHighScore: wasHigh });
    if (coinsEarned > 0) this.bus?.emit('meta:coins', { earned: coinsEarned, total: this._state.coins });
    for (const id of newlyUnlocked) this.bus?.emit('meta:unlocked', { id });

    return { score, coinsEarned, isNewHighScore: wasHigh, unlocked: newlyUnlocked };
  }

  /**
   * Purchase a shop upgrade. Returns true if the purchase succeeded.
   * @param {object} upgradeDef entry from data/shop.json
   */
  purchaseUpgrade(upgradeDef) {
    if (!upgradeDef || !upgradeDef.id) return false;
    const currentLevel = this._state.shopUpgrades[upgradeDef.id] || 0;
    if (currentLevel >= (upgradeDef.maxLevel || 1)) return false;
    const cost = MetaProgress.nextUpgradeCost(upgradeDef, currentLevel);
    if (this._state.coins < cost) return false;
    this._state.coins -= cost;
    this._state.shopUpgrades[upgradeDef.id] = currentLevel + 1;
    this.save.saveMeta(this._state);
    this.bus?.emit('meta:purchased', { id: upgradeDef.id, level: currentLevel + 1, cost });
    return true;
  }

  /** Cost to buy the NEXT level of a tiered upgrade. */
  static nextUpgradeCost(upgradeDef, currentLevel = 0) {
    const base = upgradeDef.cost ?? 0;
    const growth = upgradeDef.costGrowth ?? 0;
    return base + growth * currentLevel;
  }

  upgradeLevel(id) {
    return this._state.shopUpgrades[id] || 0;
  }

  /**
   * Update a single settings key and persist.
   */
  setSetting(key, value) {
    this._state.settings[key] = value;
    this.save.saveMeta(this._state);
    this.bus?.emit('settings:changed', { key, value });
  }

  // --- unlocks --------------------------------------------------------
  isUnlocked(id) {
    return this._state.unlocks.includes(id);
  }

  _evaluateUnlocks(runSummary) {
    const newlyUnlocked = [];
    const list = this.balance.unlocks || [];
    for (const u of list) {
      if (this._state.unlocks.includes(u.id)) continue;
      const meetsScore = (u.threshold ?? Infinity) <= this._state.highscore;
      const meetsFloor = u.requireFloorCleared === undefined
        ? true
        : (runSummary.floorsCleared || 0) >= u.requireFloorCleared;
      if (meetsScore && meetsFloor) {
        this._state.unlocks.push(u.id);
        newlyUnlocked.push(u.id);
        console.log(LOG.SAVE, `unlocked "${u.id}"`);
      }
    }
    return newlyUnlocked;
  }

  // --- utility --------------------------------------------------------
  static _clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /** Shallow-per-section merge with array replacement, similar to balance.js. */
  static _merge(defaults, override) {
    const out = MetaProgress._clone(defaults);
    if (!override || typeof override !== 'object') return out;
    for (const k of Object.keys(out)) {
      const o = override[k];
      if (o === undefined) continue;
      if (Array.isArray(out[k])) {
        out[k] = Array.isArray(o) ? o : out[k];
      } else if (out[k] && typeof out[k] === 'object') {
        out[k] = { ...out[k], ...o };
      } else {
        out[k] = o;
      }
    }
    return out;
  }
}
