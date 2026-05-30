/**
 * eliteAffixes — "champion" enemy variants (recommendation #16).
 *
 * A small fraction of spawned fodder is promoted to an ELITE: tougher stats,
 * one or two themed modifiers (drawn from ELITE_AFFIXES), an on-hit rider, a
 * coloured marker, and richer XP/gold. Bosses and sub-bosses are never rolled.
 *
 * Pure + data-driven so it is unit-testable: `rollEliteAffixes(rng, depth)`
 * decides which (if any) affixes apply, `makeElite(enemy, ids)` mutates the
 * already-constructed Enemy. On-hit riders reuse the existing EffectRegistry
 * shapes (`lifesteal`, `applyStatus`) so no combat code special-cases elites.
 */

export const ELITE_AFFIXES = {
  brutal:   { name: 'Brutal',    color: '#ff5530', statMods: { atkMul: 1.4 } },
  tough:    { name: 'Tough',     color: '#9aa2ac', statMods: { hpMul: 1.6, defAdd: 2 } },
  swift:    { name: 'Swift',     color: '#9ad0ff', evaBonus: 0.18 },
  keen:     { name: 'Keen',      color: '#ffe39a', accBonus: 0.15, statMods: { atkMul: 1.15 } },
  vampiric: { name: 'Vampiric',  color: '#c4302a', onHitPlayer: { type: 'lifesteal', value: 0.6 } },
  chilling: { name: 'Chilling',  color: '#bcd6ff', onHitPlayer: { type: 'applyStatus', status: 'slow', value: 1, duration: 2 } },
  venomous: { name: 'Venomous',  color: '#5ac06a', onHitPlayer: { type: 'applyStatus', status: 'poison', value: 1, duration: 2 } },
  shielded: { name: 'Shielded',  color: '#84bcec', statMods: { defAdd: 4, hpMul: 1.2 } },
};

const AFFIX_IDS = Object.keys(ELITE_AFFIXES);

/** Spawn-time elite chance, ramping gently with depth (capped). Softer on F1–3. */
export function eliteChanceForDepth(depth) {
  const d = Math.max(0, depth);
  if (d < 3) return Math.min(0.12, 0.025 + d * 0.01);
  return Math.min(0.22, 0.04 + d * 0.004);
}

/** Affix pool — venomous elites only after the player has left the entry floors. */
export function affixPoolForDepth(depth) {
  if (depth < 3) return AFFIX_IDS.filter((id) => id !== 'venomous');
  return AFFIX_IDS;
}

/**
 * Decide elite status + which affixes. Returns [] for a normal enemy.
 * @param {{ chance:Function, randInt:Function }} rng
 * @param {number} depth floor index (0-based)
 */
export function rollEliteAffixes(rng, depth) {
  if (!rng.chance(eliteChanceForDepth(depth))) return [];
  return forcedEliteAffixes(rng, depth);
}

/** Pick affixes WITHOUT the spawn gate — for guaranteed elites (arena guards). */
export function forcedEliteAffixes(rng, depth) {
  const count = depth >= 30 && rng.chance(0.35) ? 2 : 1;
  const pool = affixPoolForDepth(depth).slice();
  const picked = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = rng.randInt(0, pool.length - 1);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

/**
 * Promote an Enemy to elite in place. Applies stat multipliers, evasion /
 * accuracy bonuses, on-hit riders, marker metadata, and richer rewards.
 * @param {number} [depth] floor index (0-based); shallow floors get a smaller HP bump.
 * @returns {object} the same enemy (for chaining / tests)
 */
export function makeElite(enemy, affixIds, depth = 99) {
  if (!enemy || !Array.isArray(affixIds) || affixIds.length === 0) return enemy;

  let hpMul = 1, atkMul = 1, defAdd = 0;
  let evaBonus = enemy.evaBonus || 0;
  let accBonus = enemy.accBonus || 0;
  const onHit = [];
  const names = [];
  let color = '#d4ac6c';

  for (const id of affixIds) {
    const a = ELITE_AFFIXES[id];
    if (!a) continue;
    names.push(a.name);
    color = a.color || color;
    if (a.statMods) {
      if (a.statMods.hpMul) hpMul *= a.statMods.hpMul;
      if (a.statMods.atkMul) atkMul *= a.statMods.atkMul;
      if (a.statMods.defAdd) defAdd += a.statMods.defAdd;
    }
    if (a.evaBonus) evaBonus += a.evaBonus;
    if (a.accBonus) accBonus += a.accBonus;
    if (a.onHitPlayer) onHit.push(a.onHitPlayer);
  }

  // Base elite bump — lighter on entry floors so a lucky F1 elite isn't a run-ender.
  hpMul *= depth < 3 ? 1.55 : 1.8;

  const s = enemy.stats;
  s.hpMax = Math.max(1, Math.round(s.hpMax * hpMul));
  s.hp = s.hpMax;
  s.atk = Math.max(1, Math.round(s.atk * atkMul));
  s.def = Math.max(0, (s.def || 0) + defAdd);

  enemy.evaBonus = Math.min(0.4, evaBonus);
  enemy.accBonus = accBonus;
  enemy.onHitPlayer = [...(enemy.onHitPlayer || []), ...onHit];
  enemy.elite = { affixes: [...affixIds], names, color };
  enemy.name = `${names.join(' ')} ${enemy.name}`;

  // Richer rewards so the extra fight is worth it.
  enemy.xpReward = Math.round((enemy.xpReward || 0) * 2.2);
  if (Array.isArray(enemy.goldDrop)) {
    enemy.goldDrop = [Math.round(enemy.goldDrop[0] * 2.5), Math.round(enemy.goldDrop[1] * 2.5)];
  }
  return enemy;
}
