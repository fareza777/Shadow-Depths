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
  render(renderer, renderCtx) {
    if (!this.visible) return;
    const { floor, player } = renderCtx;
    if (!floor) return;

    const slot = MobileControls.geometry.centerRect;
    const pad = 4;
    const innerX = slot.x + pad;
    const innerY = slot.y + pad;
    const innerW = slot.w - pad * 2;
    const innerH = slot.h - pad * 2;

    const ctx = renderer.ctx;
    ctx.save();
    const panel = ctx.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
    panel.addColorStop(0, '#201927');
    panel.addColorStop(0.48, '#100c15');
    panel.addColorStop(1, '#07050a');
    ctx.fillStyle = panel;
    ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
    this._drawMapTable(renderer, slot);
    renderer.drawStrokedRect(slot.x, slot.y, slot.w, slot.h, COLOR.goldDim, 2);
    renderer.drawStrokedRect(slot.x + 4, slot.y + 4, slot.w - 8, slot.h - 8, '#4a4258', 1);
    renderer.drawRect(slot.x + 2, slot.y + 2, slot.w - 4, 2, COLOR.goldDim);
    renderer.drawText('DEPTH MAP', slot.x + slot.w / 2, slot.y + uiSize(8), {
      size: uiSize(10), bold: true, align: 'center',
      family: FONT_DISPLAY, color: COLOR.gold
    });

    const mapTop = innerY + uiSize(17);
    const mapH = innerH - uiSize(18);
    const bounds = this._exploredBounds(floor, player);
    const bw = bounds.x1 - bounds.x0 + 1;
    const bh = bounds.y1 - bounds.y0 + 1;
    const sx = Math.floor(innerW / bw);
    const sy = Math.floor(mapH / bh);
    const px = Math.max(3, Math.min(9, sx, sy));
    const w = bw * px;
    const h = bh * px;
    const x = innerX + (innerW - w) / 2;
    const y = mapTop + (mapH - h) / 2;

    renderer.drawRect(x - 4, y - 4, w + 8, h + 8, '#030206');
    renderer.drawStrokedRect(x - 4, y - 4, w + 8, h + 8, COLOR.goldDim, 1);
    renderer.drawStrokedRect(x - 1, y - 1, w + 2, h + 2, '#4a4258', 1);
    renderer.drawRect(x, y, w, h, '#09070d');

    const wallLit = floor.definition?.wallPalette?.[0] || '#5a5060';
    const wallDim = floor.definition?.wallPalette?.[1] || '#2a2530';
    const floorLit = floor.definition?.floorPalette?.[0] || '#4a4350';
    const floorDim = floor.definition?.floorPalette?.[1] || '#22202a';

    for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
      for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
        const t = floor.tiles[ty][tx];
        if (!t.explored) continue;
        let color;
        if (t.type === TILE.WALL) color = t.visible ? wallLit : wallDim;
        else if (t.type === TILE.FLOOR) color = t.visible ? floorLit : floorDim;
        else if (t.type === TILE.STAIRS_DOWN) color = COLOR.stairs;
        else if (t.type === TILE.STAIRS_UP) color = '#a09060';
        else if (t.type === TILE.DOOR) color = COLOR.door;
        else continue;
        renderer.drawRect(x + (tx - bounds.x0) * px, y + (ty - bounds.y0) * px, px, px, color);
      }
    }

    for (const e of floor.enemies()) {
      const t = floor.tileAt(e.x, e.y);
      if (!t || !t.visible) continue;
      if (!this._insideBounds(e.x, e.y, bounds)) continue;
      renderer.drawRect(x + (e.x - bounds.x0) * px, y + (e.y - bounds.y0) * px, px, px, COLOR.enemy);
    }

    if (player) {
      const pxPlayer = x + (player.x - bounds.x0) * px;
      const pyPlayer = y + (player.y - bounds.y0) * px;
      const pulse = 0.45 + Math.sin(performance.now() * 0.006) * 0.18;
      const ctx2 = renderer.ctx;
      ctx2.save();
      ctx2.globalAlpha = pulse;
      renderer.drawStrokedRect(pxPlayer - 4, pyPlayer - 4, px + 8, px + 8, COLOR.goldDim, 1);
      renderer.drawStrokedRect(pxPlayer - 7, pyPlayer - 7, px + 14, px + 14, '#ffffff44', 1);
      ctx2.restore();
      renderer.drawRect(
        pxPlayer - 1,
        pyPlayer - 1,
        px + 2, px + 2, COLOR.player
      );
      renderer.drawStrokedRect(pxPlayer - 1, pyPlayer - 1, px + 2, px + 2, COLOR.gold, 1);
    }
  }

  _exploredBounds(floor, player) {
    let x0 = floor.width, y0 = floor.height, x1 = 0, y1 = 0;
    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        if (!floor.tiles[y][x].explored) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (player) {
      x0 = Math.min(x0, player.x);
      x1 = Math.max(x1, player.x);
      y0 = Math.min(y0, player.y);
      y1 = Math.max(y1, player.y);
    }
    if (x0 > x1 || y0 > y1) {
      x0 = player?.x || 0; x1 = x0;
      y0 = player?.y || 0; y1 = y0;
    }
    const pad = 3;
    return {
      x0: Math.max(0, x0 - pad),
      y0: Math.max(0, y0 - pad),
      x1: Math.min(floor.width - 1, x1 + pad),
      y1: Math.min(floor.height - 1, y1 + pad)
    };
  }

  _insideBounds(x, y, b) {
    return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
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
    r.drawText('N', slot.x + slot.w / 2, slot.y + slot.h - 24, {
      size: uiSize(11), bold: true, align: 'center',
      family: FONT_DISPLAY, color: COLOR.goldDim
    });
    ctx.beginPath();
    ctx.moveTo(slot.x + slot.w / 2, slot.y + slot.h - 45);
    ctx.lineTo(slot.x + slot.w / 2 + 7, slot.y + slot.h - 31);
    ctx.lineTo(slot.x + slot.w / 2, slot.y + slot.h - 35);
    ctx.lineTo(slot.x + slot.w / 2 - 7, slot.y + slot.h - 31);
    ctx.closePath();
    ctx.strokeStyle = COLOR.goldDim;
    ctx.stroke();
    ctx.restore();
  }
}
