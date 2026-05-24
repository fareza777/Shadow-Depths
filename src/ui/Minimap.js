/**
 * Minimap — small floor overview painted INSIDE the control band's center
 * area, between the D-pad and the action buttons. Never overlaps the world
 * viewport.
 *
 * Tile pixel size auto-fits whatever space MobileControls leaves; we read
 * its geometry rather than hard-coding so layout shifts in one place stay
 * in sync.
 */
import { COLOR, TILE } from '../config/constants.js';
import { MobileControls } from './MobileControls.js';

export class Minimap {
  constructor() { this.visible = true; }
  toggle() { this.visible = !this.visible; }

  /**
   * @param {import('../rendering/Renderer.js').Renderer} renderer
   * @param {{ floor: object, player: object }} ctx
   */
  render(renderer, ctx) {
    if (!this.visible) return;
    const { floor, player } = ctx;
    if (!floor) return;

    const slot = MobileControls.geometry.centerRect;
    // Fit minimap into the center cutout of the control band. Pick the
    // largest integer tile size that keeps the whole map inside the slot.
    const sx = Math.floor(slot.w / floor.width);
    const sy = Math.floor(slot.h / floor.height);
    const px = Math.max(1, Math.min(sx, sy));
    const w = floor.width * px;
    const h = floor.height * px;
    const x = slot.x + (slot.w - w) / 2;
    const y = slot.y + (slot.h - h) / 2;

    renderer.drawRect(x - 2, y - 2, w + 4, h + 4, '#06060a');
    renderer.drawStrokedRect(x - 2, y - 2, w + 4, h + 4, '#3a3340', 1);

    for (let ty = 0; ty < floor.height; ty++) {
      for (let tx = 0; tx < floor.width; tx++) {
        const t = floor.tiles[ty][tx];
        if (!t.explored) continue;
        let color;
        if (t.type === TILE.WALL) color = t.visible ? '#5a5060' : '#2a2530';
        else if (t.type === TILE.FLOOR) color = t.visible ? '#4a4350' : '#22202a';
        else if (t.type === TILE.STAIRS_DOWN) color = COLOR.stairs;
        else if (t.type === TILE.STAIRS_UP) color = '#a09060';
        else if (t.type === TILE.DOOR) color = COLOR.door;
        else continue;
        renderer.drawRect(x + tx * px, y + ty * px, px, px, color);
      }
    }

    for (const e of floor.enemies()) {
      const t = floor.tileAt(e.x, e.y);
      if (!t || !t.visible) continue;
      renderer.drawRect(x + e.x * px, y + e.y * px, px, px, COLOR.enemy);
    }

    renderer.drawRect(
      x + player.x * px - 1,
      y + player.y * px - 1,
      px + 2, px + 2, COLOR.player
    );
  }
}
