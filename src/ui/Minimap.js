/**
 * Minimap — compact top-right overview. Sized for 480-wide portrait canvas.
 *
 * 3 px per world tile keeps the full 40 × 28 map within ~120 × 84 px so it
 * never obscures the play area.
 */
import { COLOR, TILE, CANVAS_WIDTH } from '../config/constants.js';

const MM_TILE = 3;
const MM_PADDING = 8;
const MM_TOP_OFFSET = 92; // sits just below the HUD top strip

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
    const w = floor.width * MM_TILE;
    const h = floor.height * MM_TILE;
    const x = CANVAS_WIDTH - w - MM_PADDING;
    const y = MM_TOP_OFFSET;
    renderer.drawRect(x - 2, y - 2, w + 4, h + 4, 'rgba(6,6,10,0.85)');
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
        renderer.drawRect(x + tx * MM_TILE, y + ty * MM_TILE, MM_TILE, MM_TILE, color);
      }
    }

    for (const e of floor.enemies()) {
      const t = floor.tileAt(e.x, e.y);
      if (!t || !t.visible) continue;
      renderer.drawRect(x + e.x * MM_TILE, y + e.y * MM_TILE, MM_TILE, MM_TILE, COLOR.enemy);
    }

    renderer.drawRect(
      x + player.x * MM_TILE - 1,
      y + player.y * MM_TILE - 1,
      MM_TILE + 2, MM_TILE + 2, COLOR.player
    );
  }
}
