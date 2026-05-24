/**
 * LightingSystem — fog of war + torch radius computation.
 *
 * Output: writes `visible` / `explored` on tiles. Renderer uses those to
 * pick dim/lit/black paint.
 *
 * Algorithm: simple Bresenham line-cast from the player to every tile
 * within Chebyshev radius. A tile is `visible` if the line reaches it
 * without crossing a sight-blocking tile. This is O(R²) with R ≤ 5, so a
 * handful of µs per turn — recursive shadowcasting would be ~4× faster
 * but adds ~80 lines for negligible gain at this scale.
 *
 * Recomputed once per turn (after every action that succeeded), NOT every
 * frame. The Renderer just reads the flags.
 */
export class LightingSystem {
  /**
   * @param {object} balance merged balance
   */
  constructor(balance) {
    this.balance = balance;
  }

  /**
   * Radius for the current floor (per-floor override, fallback to default).
   */
  radiusForFloor(floorIndex) {
    const per = this.balance.vision.perFloor;
    if (per && Number.isFinite(per[floorIndex])) return per[floorIndex];
    return this.balance.vision.torchRadius;
  }

  /**
   * @param {import('../world/Floor.js').Floor} floor
   * @param {{ x:number, y:number }} from usually the player
   * @param {number} [radius] override
   */
  compute(floor, from, radius) {
    const r = radius ?? this.radiusForFloor(floor.index);
    floor.clearVisibility();

    // Origin tile is always visible.
    const origin = floor.tileAt(from.x, from.y);
    if (origin) { origin.visible = true; origin.explored = true; }

    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (dx * dx + dy * dy > r2) continue;
        const tx = from.x + dx;
        const ty = from.y + dy;
        if (!floor.inBounds(tx, ty)) continue;
        if (this._lineClear(floor, from.x, from.y, tx, ty)) {
          const t = floor.tiles[ty][tx];
          t.visible = true;
          t.explored = true;
        }
      }
    }
  }

  /**
   * Bresenham walk. Returns true if every intermediate tile (excluding the
   * endpoint) does NOT block sight. The endpoint itself can be a wall (we
   * want to *see* the wall edge).
   */
  _lineClear(floor, x0, y0, x1, y1) {
    let cx = x0, cy = y0;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      if (cx === x1 && cy === y1) return true;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 <  dx) { err += dx; cy += sy; }
      if (cx === x1 && cy === y1) return true;
      const t = floor.tileAt(cx, cy);
      if (!t || t.blocksSight()) return false;
    }
  }
}
