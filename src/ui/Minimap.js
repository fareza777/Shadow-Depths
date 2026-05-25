/**
 * Minimap — floor overview in the control band center slot.
 */
import { COLOR, TILE, FONT_DISPLAY, uiSize } from '../config/constants.js';
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
    const pad = 4;
    const innerX = slot.x + pad;
    const innerY = slot.y + pad;
    const innerW = slot.w - pad * 2;
    const innerH = slot.h - pad * 2;

    renderer.drawRect(slot.x, slot.y, slot.w, slot.h, '#0a0810');
    this._drawMapTable(renderer, slot);
    renderer.drawStrokedRect(slot.x, slot.y, slot.w, slot.h, COLOR.goldDim, 1);
    renderer.drawRect(slot.x + 2, slot.y + 2, slot.w - 4, 2, COLOR.goldDim);
    renderer.drawText('MAP', slot.x + slot.w / 2, slot.y + uiSize(9), {
      size: uiSize(10), bold: true, align: 'center',
      family: FONT_DISPLAY, color: COLOR.gold
    });

    const mapTop = innerY + uiSize(12);
    const mapH = innerH - uiSize(12);
    const sx = Math.floor(innerW / floor.width);
    const sy = Math.floor(mapH / floor.height);
    const px = Math.max(2, Math.min(sx, sy));
    const w = floor.width * px;
    const h = floor.height * px;
    const x = innerX + (innerW - w) / 2;
    const y = mapTop + (mapH - h) / 2;

    renderer.drawRect(x - 2, y - 2, w + 4, h + 4, '#06060a');
    renderer.drawStrokedRect(x - 2, y - 2, w + 4, h + 4, '#4a4258', 1);

    const wallLit = floor.definition?.wallPalette?.[0] || '#5a5060';
    const wallDim = floor.definition?.wallPalette?.[1] || '#2a2530';
    const floorLit = floor.definition?.floorPalette?.[0] || '#4a4350';
    const floorDim = floor.definition?.floorPalette?.[1] || '#22202a';

    for (let ty = 0; ty < floor.height; ty++) {
      for (let tx = 0; tx < floor.width; tx++) {
        const t = floor.tiles[ty][tx];
        if (!t.explored) continue;
        let color;
        if (t.type === TILE.WALL) color = t.visible ? wallLit : wallDim;
        else if (t.type === TILE.FLOOR) color = t.visible ? floorLit : floorDim;
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

    if (player) {
      renderer.drawRect(
        x + player.x * px - 1,
        y + player.y * px - 1,
        px + 2, px + 2, COLOR.player
      );
    }
    renderer.drawStrokedRect(
      x + player.x * px - 1,
      y + player.y * px - 1,
      px + 2, px + 2, COLOR.gold, 1
    );
  }

  _drawMapTable(r, slot) {
    const ctx = r.ctx;
    ctx.save();
    const g = ctx.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
    g.addColorStop(0, '#15101c');
    g.addColorStop(0.48, '#0d0a12');
    g.addColorStop(1, '#07060a');
    ctx.fillStyle = g;
    ctx.fillRect(slot.x, slot.y, slot.w, slot.h);

    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 5; i++) {
      const y = slot.y + 34 + i * 28;
      r.drawRect(slot.x + 10, y, slot.w - 20, 1, '#6a5430');
    }
    ctx.globalAlpha = 0.28;
    r.drawRect(slot.x + 9, slot.y + 30, 1, slot.h - 42, COLOR.goldDim);
    r.drawRect(slot.x + slot.w - 10, slot.y + 30, 1, slot.h - 42, COLOR.goldDim);

    ctx.globalAlpha = 0.32;
    r.drawText('N', slot.x + slot.w / 2, slot.y + slot.h - 31, {
      size: uiSize(11), bold: true, align: 'center',
      family: FONT_DISPLAY, color: COLOR.goldDim
    });
    ctx.beginPath();
    ctx.moveTo(slot.x + slot.w / 2, slot.y + slot.h - 52);
    ctx.lineTo(slot.x + slot.w / 2 + 7, slot.y + slot.h - 38);
    ctx.lineTo(slot.x + slot.w / 2, slot.y + slot.h - 42);
    ctx.lineTo(slot.x + slot.w / 2 - 7, slot.y + slot.h - 38);
    ctx.closePath();
    ctx.strokeStyle = COLOR.goldDim;
    ctx.stroke();
    ctx.restore();
  }
}
