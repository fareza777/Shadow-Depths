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
    // Adjacent tap with a bow/crossbow uses melee at this fraction of rolled damage.
    rangedWeaponMeleeMult: 0.55,
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
    largeRoomChance: 0.45,
    // Chance a floor designates an arena set-piece (guards + reward).
    arenaChance: 0.25,
    // Chance a floor hides a secret loot cache behind a breakable wall.
    secretCacheChance: 0.4,
    // One micro-event per normal floor (shrine, trap room, merchant, …).
    floorEventChance: 0.92,
    vaultEventChance: 0.5,
    eventsPerFloor: 2,
    eventsPerFloorVault: 2,
    eventsPerFloorDeep: 3,
    eventsPerFloorDeepFrom: 15,
    merchantGuaranteeEvery: 10,
    merchantGuaranteeOffset: 4,
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

  // Global enemy HP/ATK multipliers (tunable via data/balance.json).
  enemyScaling: { hp: 1.05, atk: 1.05 },

  // Depth curve: floor 1 is deliberately forgiving, then the run becomes
  // harsher in stages. Cap enemy count for Play Store frame budgets.
  difficultyCurve: {
    openingScale: 0.95,
    openingStep: 0.13,
    baseAfterOpening: 1.22,
    perFloor: 0.04,
    midFrom: 20,
    midBonus: 0.012,
    deepFrom: 50,
    deepBonus: 0.010,
    enemyCountStart: 3,
    enemyCountGrowth: 0.2,
    enemyCountMilestoneEvery: 10,
    enemyCountMilestoneBonus: 1,
    enemyCountMax: 12
  }
});

/**
 * Global enemy combat scale from merged balance.
 * @param {object} balance mergeBalance output
 * @returns {{ hp:number, atk:number }}
 */
export function enemyCombatScale(balance) {
  const s = balance?.enemyScaling || {};
  return {
    hp: s.hp ?? s.enemyHp ?? 1,
    atk: s.atk ?? s.enemyAtk ?? 1
  };
}

export function difficultyScaleForFloor(floorIndex, curve = DEFAULT_BALANCE.difficultyCurve) {
  const c = { ...DEFAULT_BALANCE.difficultyCurve, ...(curve || {}) };
  const floorNumber = Math.max(1, (floorIndex || 0) + 1);
  if (floorNumber <= 3) {
    return round2(c.openingScale + (floorNumber - 1) * c.openingStep);
  }
  const afterOpening = floorNumber - 3;
  const mid = Math.max(0, floorNumber - c.midFrom);
  const deep = Math.max(0, floorNumber - c.deepFrom);
  return round2(
    c.baseAfterOpening
    + afterOpening * c.perFloor
    + mid * c.midBonus
    + deep * c.deepBonus
  );
}

export function enemyCountForFloor(floorIndex, curve = DEFAULT_BALANCE.difficultyCurve) {
  const c = { ...DEFAULT_BALANCE.difficultyCurve, ...(curve || {}) };
  const floorNumber = Math.max(1, (floorIndex || 0) + 1);
  const milestones = c.enemyCountMilestoneEvery > 0
    ? Math.floor((floorNumber - 1) / c.enemyCountMilestoneEvery) * c.enemyCountMilestoneBonus
    : 0;
  const count = c.enemyCountStart + Math.floor((floorNumber - 1) * c.enemyCountGrowth) + milestones;
  return Math.max(1, Math.min(c.enemyCountMax, count));
}

function round2(n) {
  return Math.round(n * 100) / 100;
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
