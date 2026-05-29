/**
 * Per-hero spell tuning — single place to balance magic without hunting SpellSystem.
 * Damage/heal formulas receive (player, power) where noted.
 */

export const SPELL_TUNING = Object.freeze({
  hollow: {
    damage: (level, power) => 3 + Math.floor(level / 4) + Math.floor(power / 2),
    healRatio: 0.28,
    healCap: 5
  },
  inquisitor: {
    burst: (level, power) => 3 + Math.floor(level / 3) + Math.floor(power / 2)
  },
  reaver: {
    aoe: (totalAtk) => 2 + Math.floor(totalAtk / 3)
  },
  bladedancer: {
    strikes: 2,
    hitRatio: 0.48
  },
  echobinder: {
    burst: (level, power) => 8 + Math.floor(level / 2) + Math.floor(power * 0.75),
    wardDef: 2,
    wardTurns: 3,
    freezeTurns: 2
  }
});

/** Cap sustain from Hollow Siphon heal. */
export function hollowSiphonHeal(dealt, player, tuning = SPELL_TUNING.hollow) {
  if (dealt <= 0) return 0;
  const ratio = tuning.healRatio + (player.spellLifesteal || 0);
  return Math.min(tuning.healCap, Math.ceil(dealt * ratio));
}
