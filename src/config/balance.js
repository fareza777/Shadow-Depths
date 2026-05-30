/**
 * Balance constants — code-side defaults. These are the values the engine
 * uses if `data/balance.json` is missing/malformed. The runtime *prefers*
 * the JSON copy (which is hot-tunable), this file is the safety net + types.
 *
 * Decision (2026-05-24): keep both — Fajar can tweak `balance.json` without
 * rebuild, but the game still boots if the JSON is broken. See
 * `core/Game.js` for the merge logic.
 */

export const DEFAULT_BALANCE = Object.freeze({
  player: {
    startHP: 30,
    startATK: 3,
    startDEF: 1,
    startDEX: 2,
    startGold: 0,
    inventorySlots: 9
  },

  // Level-up: xpNeeded = xpBase * (level ^ xpExponent)
  progression: {
    maxLevel: 99,
    xpBase: 50,
    xpExponent: 1.5,
    hpPerLevel: 5,
    atkPerLevel: 1,
    defPerLevel: 1,
    healPctPerLevel: 0.30,
    dexEveryNLevels: 3,
    dexPerTier: 1
  },

  combat: {
    minDamage: 1,
    varianceMin: -1,
    varianceMax: 1,
    // Damage variance scales with the attacker's ATK (±variancePct), so big
    // hits swing more than chip damage. Falls back to varianceMin/Max as the
    // floor for low-ATK actors. Average damage is unchanged (symmetric roll).
    variancePct: 0.12,
    baseCritChance: 0.05,
    critPerDex: 0.01,
    critMultiplier: 2,
    // Accuracy / evasion. hitChance = baseHit + acc(attacker) − eva(defender).
    // Player evasion is DEX-driven (capped). A missed swing may still "graze"
    // (grazeChance) for grazeDamage of normal, so DEX matters without making
    // combat a coin-flip.
    baseHit: 0.95,
    accPerDex: 0.004,
    dodgePerDex: 0.008,
    dodgeCap: 0.12,
    grazeChance: 0.5,
    grazeDamage: 0.5,
    // Positional melee bonuses (#4): striking a foe in the back / side.
    backstabMult: 1.5,
    flankMult: 1.15
  },

  vision: {
    torchRadius: 5,
    // Per-floor override (index = floorIndex). Falls back to torchRadius.
    perFloor: [5, 5, 4]
  },

  dungeon: {
    roomMinSize: 4,
    roomMaxSize: 9,
    minRoomsPerFloor: 6,
    maxRoomsPerFloor: 10,
    minStairsDistance: 12,
    enemySpawnsPerFloor: [3, 5, 8],
    itemSpawnsPerFloor: [5, 5, 6],
    // Fraction of rooms carved as a large hall/cavern (spatial variety).
    largeRoomChance: 0.2,
    // Chance a floor designates an arena set-piece (guards + reward).
    arenaChance: 0.35,
    // Hidden traps scattered per floor (see gameplay/hazards.js).
    trapsPerFloor: { min: 1, max: 4 },
    hazardBaseDamage: 4
  },

  scoring: {
    perFloor: 200,
    perEnemy: 10,
    perGold: 1,
    perXP: 0.5,
    efficiencyNumerator: 10000,
    perfectFloorBonus: 100
  },

  unlocks: [
    { id: 'worn_dagger',   threshold: 500,  effect: 'startWeapon' },
    { id: 'veterans_vigor', threshold: 1500, effect: 'plus10HP' },
    { id: 'lucky_charm',   threshold: 3000, effect: 'startRevive' },
    { id: 'map_sense',     threshold: 5000, effect: 'revealFloor1' },
    { id: 'crimson_cloak', threshold: 0,    effect: 'cosmetic',
      requireFloorCleared: 3 }
  ],

  // Title-screen difficulty tiers (merged from data/balance.json overrides).
  difficulty: {
    easy:    { enemyHp: 0.8,  enemyAtk: 0.85, lootTier: 0, scoreMul: 0.7, label: 'Penitent' },
    normal:  { enemyHp: 1,    enemyAtk: 1,    lootTier: 0, scoreMul: 1.0, label: 'Vigil' },
    hard:    { enemyHp: 1.52, enemyAtk: 1.38, lootTier: 1, scoreMul: 1.4, label: 'Hollow' },
    ascend1: { enemyHp: 1.5,  enemyAtk: 1.3,  lootTier: 2, scoreMul: 1.8, label: 'Ascent I' },
    ascend2: { enemyHp: 1.8,  enemyAtk: 1.5,  lootTier: 3, scoreMul: 2.4, label: 'Ascent II' }
  }
});

/**
 * Combat/score multipliers for a difficulty key from merged balance.
 * @param {object} balance merged balance (mergeBalance output)
 * @param {string} [key] meta.settings.difficulty
 */
export function resolveDifficulty(balance, key = 'normal') {
  const table = balance?.difficulty || {};
  const cfg = table[key] || table.normal || { enemyHp: 1, enemyAtk: 1 };
  return {
    hp: cfg.enemyHp ?? 1,
    atk: cfg.enemyAtk ?? 1,
    scoreMul: cfg.scoreMul ?? 1,
    lootTier: cfg.lootTier ?? 0
  };
}

/**
 * Merge a partial JSON override on top of the defaults. Shallow-merge per
 * top-level section is enough for v0.1 — no section is nested >2 deep.
 *
 * @param {object} overrides parsed `data/balance.json`
 * @returns {object} frozen merged balance
 */
export function mergeBalance(overrides) {
  if (!overrides || typeof overrides !== 'object') return DEFAULT_BALANCE;
  const out = {};
  for (const key of Object.keys(DEFAULT_BALANCE)) {
    const def = DEFAULT_BALANCE[key];
    const ov = overrides[key];
    if (Array.isArray(def)) {
      out[key] = Array.isArray(ov) ? ov : def;
    } else if (def && typeof def === 'object') {
      out[key] = Object.freeze({ ...def, ...(ov || {}) });
    } else {
      out[key] = ov ?? def;
    }
  }
  return Object.freeze(out);
}
