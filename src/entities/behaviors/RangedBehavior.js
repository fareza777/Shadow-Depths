/**
 * RangedBehavior — Skeleton Archer.
 *
 * Rules:
 *   1. If player is too close (< minDistance), step away (kite).
 *   2. Else if LOS is clear and player within range, ranged attack.
 *   3. Else move closer to reach preferredDistance.
 *
 * Line-of-sight: simple Bresenham, blocked by Tile.blocksSight().
 */
import { greedyStep } from './ChaseBehavior.js';

export class RangedBehavior {
  constructor(params = {}) {
    this.preferredDistance = params.preferredDistance ?? 4;
    this.minDistance       = params.minDistance ?? 3;
    this.range             = params.range ?? 6;
  }

  decideAction(enemy, ctx) {
    const { floor, player } = ctx;
    const dist = manhattan(enemy, player);

    // Kite.
    if (dist < this.minDistance) {
      const away = stepAwayFrom(enemy, player, floor);
      if (away) return away;
    }

    // Shoot.
    if (dist <= this.range && hasLineOfSight(floor, enemy, player)) {
      return { type: 'ranged', target: { x: player.x, y: player.y } };
    }

    // Close in.
    return greedyStep(enemy, player, floor) || { type: 'wait' };
  }
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function stepAwayFrom(enemy, target, floor) {
  const dx = Math.sign(enemy.x - target.x);
  const dy = Math.sign(enemy.y - target.y);
  const tries = [
    dx ? { x: enemy.x + dx, y: enemy.y } : null,
    dy ? { x: enemy.x, y: enemy.y + dy } : null
  ].filter(Boolean);
  for (const t of tries) {
    if (floor.isPassable(t.x, t.y)) return { type: 'move', to: t };
  }
  return null;
}

/** Bresenham line walk; returns false on first sight-blocking tile (excluding endpoints). */
export function hasLineOfSight(floor, a, b) {
  let x0 = a.x, y0 = a.y;
  const x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 <  dx) { err += dx; y0 += sy; }
    if (x0 === x1 && y0 === y1) return true;
    const t = floor.tileAt(x0, y0);
    if (!t || t.blocksSight()) return false;
  }
}
