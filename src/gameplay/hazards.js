/**
 * hazards — floor traps (recommendation #8).
 *
 * Hidden one-shot traps placed on floor tiles. They reveal when the player is
 * adjacent (so they become a *decision* — step over or route around — not a
 * pure gotcha) and trigger when any entity steps onto an armed one: a burst of
 * damage plus, for some types, a status rider. Damage scales with depth so a
 * trap stays relevant deep down.
 *
 * Pure helpers live here so they're unit-testable; GameScene owns the wiring
 * (reveal-on-adjacent, trigger-on-move) and Renderer draws revealed traps.
 */

export const HAZARDS = {
  spike:  { id: 'spike',  label: 'Spike Trap',  color: '#cdd5dd', dmgMul: 1.0 },
  venom:  { id: 'venom',  label: 'Venom Vent',  color: '#5ac06a', dmgMul: 0.6, status: { status: 'poison', value: 2, duration: 3 } },
  frost:  { id: 'frost',  label: 'Frost Glyph', color: '#bcd6ff', dmgMul: 0.6, status: { status: 'slow', value: 1, duration: 2 } },
  flame:  { id: 'flame',  label: 'Flame Jet',   color: '#ff8844', dmgMul: 0.8, status: { status: 'burn', value: 3, duration: 3 } },
};

const HAZARD_IDS = Object.keys(HAZARDS);

/** How many traps to scatter on a floor of this depth. */
export function trapCountForDepth(depth, rng, cfg = {}) {
  const min = cfg.min ?? 1;
  const max = cfg.max ?? 4;
  const lo = Math.min(max, min + Math.floor(Math.max(0, depth) / 8));
  return rng.randInt(lo, max);
}

/** Pick a hazard type. Spikes early; elemental vents unlock with depth. */
export function pickHazardType(rng, depth) {
  const pool = depth >= 6 ? HAZARD_IDS : ['spike'];
  return pool[rng.randInt(0, pool.length - 1)];
}

/** Burst damage for a trap at this depth (before target defenses). */
export function hazardDamage(type, depth, base = 4) {
  const h = HAZARDS[type] || HAZARDS.spike;
  return Math.max(2, Math.round((base + depth * 0.6) * h.dmgMul));
}
