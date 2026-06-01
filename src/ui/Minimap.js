/**
 * Minimap — floor overview in the control band center slot.
 */
import { COLOR, TILE, FONT_DISPLAY, uiSize } from '../config/constants.js';
import { INTERACT_EVENT_KINDS } from '../gameplay/floorEvents.js';
import { MobileControls } from './MobileControls.js';
import { IRON, drawIronPlate, drawIronRivet } from './ironHud.js';

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
    const timeBucket = Math.floor((typeof performance !== 'undefined' ? performance.now() : Date.now()) / 250);
    const key = [
      'minimap',
      slot.x, slot.y, slot.w, slot.h,
      floor.seed, floor.index, floor.renderRevision || 0, floor.entityRevision || 0,
      player?.x ?? '', player?.y ?? '', timeBucket
    ].join('|');
    if (typeof renderer.drawCachedScreenLayer === 'function') {
      renderer.drawCachedScreenLayer(key, () => this._renderUncached(renderer, renderCtx, slot));
      return;
    }
    this._renderUncached(renderer, renderCtx, slot);
  }

  _renderUncached(renderer, renderCtx, slot) {
    const { floor, player } = renderCtx;
    const pad = 8;
    const innerX = slot.x + pad;
    const innerY = slot.y + pad;
    const innerW = slot.w - pad * 2;
    const innerH = slot.h - pad * 2;

    this._drawMapFrame(renderer, slot);

    const headerH = uiSize(26);
    const mapTop = innerY + headerH + 3;
    const mapH = Math.max(24, innerY + innerH - mapTop - 5);
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

    const mapFrameX = innerX + 6;
    const mapFrameY = mapTop - 3;
    const mapFrameW = innerW - 12;
    const mapFrameH = innerY + innerH - mapFrameY - 6;
    renderer.drawRect(mapFrameX, mapFrameY, mapFrameW, mapFrameH, '#030206');
    renderer.drawStrokedRect(mapFrameX, mapFrameY, mapFrameW, mapFrameH, IRON.brassDark, 1);
    renderer.drawStrokedRect(mapFrameX + 3, mapFrameY + 3, mapFrameW - 6, mapFrameH - 6, '#4a4258', 1);
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

    const eventList = floor.microEvents?.length
      ? floor.microEvents
      : (floor.microEvent ? [floor.microEvent] : []);
    for (const ev of eventList) {
      if (!ev?.interactPos || !INTERACT_EVENT_KINDS.has(ev.kind)) continue;
      const ip = ev.interactPos;
      if (!this._insideBounds(ip.x, ip.y, bounds)) continue;
      const mx = x + (ip.x - bounds.x0) * px;
      const my = y + (ip.y - bounds.y0) * px;
      const t = floor.tileAt(ip.x, ip.y);
      const bright = t?.explored;
      renderer.drawRect(mx, my, Math.max(px, 3), Math.max(px, 3),
        ev.kind === 'merchant' ? (bright ? '#ffd76a' : '#a88430') : (bright ? '#c8a0ff' : '#6a5080'));
    }

    for (const e of floor.enemies()) {
      const t = floor.tileAt(e.x, e.y);
      if (!t || !t.visible) continue;
      if (!this._insideBounds(e.x, e.y, bounds)) continue;
      const ex = x + (e.x - bounds.x0) * px;
      const ey = y + (e.y - bounds.y0) * px;
      const boss = e.defId?.startsWith('boss_');
      const subboss = e.defId?.startsWith('subboss_');
      renderer.drawRect(ex, ey, px, px, boss ? COLOR.goldHi : subboss ? '#c080ff' : COLOR.enemy);
      if (boss || subboss) {
        renderer.drawStrokedRect(ex - 2, ey - 2, px + 4, px + 4, boss ? COLOR.gold : '#c080ff', 1);
      }
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
    for (const ev of floor.microEvents?.length ? floor.microEvents : (floor.microEvent ? [floor.microEvent] : [])) {
      const ip = ev?.interactPos;
      if (!ip) continue;
      x0 = Math.min(x0, ip.x);
      x1 = Math.max(x1, ip.x);
      y0 = Math.min(y0, ip.y);
      y1 = Math.max(y1, ip.y);
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

  _drawMapFrame(r, slot) {
    const ctx = r.ctx;
    ctx.save();
    drawIronPlate(ctx, slot.x, slot.y, slot.w, slot.h, { rivets: false, dark: true });

    ctx.strokeStyle = IRON.brassDark;
    ctx.lineWidth = 1;
    ctx.strokeRect(slot.x + 4.5, slot.y + 4.5, slot.w - 9, slot.h - 9);
    ctx.strokeStyle = 'rgba(106,94,106,0.7)';
    ctx.strokeRect(slot.x + 8.5, slot.y + 8.5, slot.w - 17, slot.h - 17);

    const headerY = slot.y + 11;
    const headerH = uiSize(22);
    ctx.fillStyle = '#15101c';
    ctx.fillRect(slot.x + 11, headerY, slot.w - 22, headerH);
    ctx.strokeStyle = 'rgba(122,94,52,0.75)';
    ctx.strokeRect(slot.x + 11.5, headerY + 0.5, slot.w - 23, headerH - 1);
    r.drawText('DEPTH MAP', slot.x + slot.w / 2, headerY + headerH / 2 + 1, {
      size: uiSize(10), bold: true, align: 'center', baseline: 'middle',
      family: FONT_DISPLAY, color: COLOR.gold
    });

    drawIronRivet(ctx, slot.x + 7, slot.y + 7, 2.4);
    drawIronRivet(ctx, slot.x + slot.w - 7, slot.y + 7, 2.4);
    drawIronRivet(ctx, slot.x + 7, slot.y + slot.h - 7, 2.4);
    drawIronRivet(ctx, slot.x + slot.w - 7, slot.y + slot.h - 7, 2.4);
    ctx.restore();
  }
}
