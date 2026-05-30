/**
 * flanking — positional damage (recommendation #4).
 *
 * Entities remember a `facing` (the direction of their last move / attack).
 * Striking a defender from the side or behind that facing rewards bonus
 * damage, turning movement into a tactical choice: circle around a foe that
 * just attacked to land a backstab — and beware enemies doing the same to you.
 *
 * Pure + tiny so it's unit-testable. CombatSystem maintains `facing` and
 * applies the multiplier; nothing else needs to know about it.
 */

const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** Unit-ish direction from a → b (each axis in {-1,0,1}). */
export function dirTo(a, b) {
  return { x: sign(b.x - a.x), y: sign(b.y - a.y) };
}

/**
 * Damage multiplier for `attacker` hitting `defender`, based on where the
 * attacker stands relative to the defender's facing.
 *   - behind  (opposite facing) → backstabMult
 *   - flank   (perpendicular)   → flankMult
 *   - front   (into the facing) → 1
 * Returns 1 when the defender has no facing yet.
 */
export function flankMultiplier(attacker, defender, cfg = {}) {
  const f = defender.facing;
  if (!f || (f.x === 0 && f.y === 0)) return 1;
  // Direction from the defender out to the attacker.
  const ax = sign(attacker.x - defender.x);
  const ay = sign(attacker.y - defender.y);
  if (ax === 0 && ay === 0) return 1;
  // Dot with the way the defender faces: >0 attacker is in front, <0 behind.
  const dot = ax * sign(f.x) + ay * sign(f.y);
  if (dot < 0) return cfg.backstabMult ?? 1.5;
  if (dot === 0) return cfg.flankMult ?? 1.15;
  return 1;
}
