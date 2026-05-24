/**
 * Minimap — top-right floor overview.
 *
 * Renders only explored tiles. Player as a bright dot, enemies (visible
 * tiles only) as small red dots, stairs as gold.
 */
import { COLOR, TILE, CANVAS_WIDTH } from '../config/constants.js';

const MM_TILE = 4;
const MM_PADDING = 8;

export class Minimap {
  constructor() {
    this.visible = true;
  }

  toggle() { this.visible = !this.visible; }

  /**
   * @param {import('../rendering/Renderer.js').Renderer} renderer
   * @param {{ floor:object, player:object }} ctx
   */
  render(renderer, ctx) {
    if (!this.visible) return;
    const { floor, player } = ctx;
    if (!floor) return;
    const w = floor.width * MM_TILE;
    const h = floor.height * MM_TILE;
    const x = CANVAS_WIDTH - w - MM_PADDING;
    const y = MM_PADDING;
    renderer.drawRect(x - 2, y - 2, w + 4, h + 4, '#0a0a0c');
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

    // Enemies (visible only).
    for (const e of floor.enemies()) {
      const t = floor.tileAt(e.x, e.y);
      if (!t || !t.visible) continue;
      renderer.drawRect(x + e.x * MM_TILE, y + e.y * MM_TILE, MM_TILE, MM_TILE, COLOR.enemy);
    }

    // Player.
    renderer.drawRect(x + player.x * MM_TILE - 1, y + player.y * MM_TILE - 1, MM_TILE + 2, MM_TILE + 2, COLOR.player);
  }
}
