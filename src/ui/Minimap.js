/**
 * Minimap — floor overview in the control band center slot.
 *
 * Terrain is cached separately from the player/enemy overlay so walking
 * does not rebuild the whole explored map every step.
 */
import { COLOR, TILE, FONT_DISPLAY, uiSize } from '../config/constants.js';
import { INTERACT_EVENT_KINDS } from '../gameplay/floorEvents.js';
import { MobileControls } from './MobileControls.js';
import { IRON, drawIronPlate, drawBrassRivet } from './ironHud.js';

export class Minimap {
  constructor() {
    this.visible = true;
    this._boundsCache = null;
  }

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
    const terrainKey = [
      'minimap-terrain',
      slot.x, slot.y, slot.w, slot.h,
      floor.seed, floor.index, floor.renderRevision || 0, floor.visibilityRevision || 0
    ].join('|');

    // Region cache, not a full-canvas one: the minimap owns a small slot in
    // the control band, so a whole-screen blit per frame is wasted fill-rate.
    if (typeof renderer.drawCachedScreenRegion === 'function') {
      const rect = { x: slot.x - 3, y: slot.y - 3, w: slot.w + 6, h: slot.h + 6 };
      renderer.drawCachedScreenRegion(terrainKey, rect, () => {
        this._renderTerrain(renderer, renderCtx, slot);
      });
      this._renderActors(renderer, renderCtx, slot);
      return;
    }
    this._renderTerrain(renderer, renderCtx, slot);
    this._renderActors(renderer, renderCtx, slot);
  }

  _layout(floor, player, slot) {
    const pad = 8;
    const innerX = slot.x + pad;
    const innerY = slot.y + pad;
    const innerW = slot.w - pad * 2;
    const innerH = slot.h - pad * 2;
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
    return { pad, innerX, innerY, innerW, innerH, headerH, mapTop, mapH, bounds, px, w, h, x, y };
  }

  _renderTerrain(renderer, renderCtx, slot) {
    const { floor, player } = renderCtx;
    const L = this._layout(floor, player, slot);
    this._lastLayout = L;
    this._drawMapFrame(renderer, slot);

    const mapFrameX = L.innerX + 6;
    const mapFrameY = L.mapTop - 3;
    const mapFrameW = L.innerW - 12;
    const mapFrameH = L.innerY + L.innerH - mapFrameY - 6;
    renderer.drawRect(mapFrameX, mapFrameY, mapFrameW, mapFrameH, '#030206');
    renderer.drawStrokedRect(mapFrameX, mapFrameY, mapFrameW, mapFrameH, IRON.brassDark, 1);
    renderer.drawStrokedRect(mapFrameX + 3, mapFrameY + 3, mapFrameW - 6, mapFrameH - 6, '#4a4258', 1);
    renderer.drawRect(L.x, L.y, L.w, L.h, '#09070d');

    const wallLit = floor.definition?.wallPalette?.[0] || '#5a5060';
    const wallDim = floor.definition?.wallPalette?.[1] || '#2a2530';
    const floorLit = floor.definition?.floorPalette?.[0] || '#4a4350';
    const floorDim = floor.definition?.floorPalette?.[1] || '#22202a';

    for (let ty = L.bounds.y0; ty <= L.bounds.y1; ty++) {
      for (let tx = L.bounds.x0; tx <= L.bounds.x1; tx++) {
        const t = floor.tiles[ty][tx];
        if (!t.explored) continue;
        let color;
        if (t.type === TILE.WALL) color = t.visible ? wallLit : wallDim;
        else if (t.type === TILE.FLOOR) color = t.visible ? floorLit : floorDim;
        else if (t.type === TILE.STAIRS_DOWN) color = COLOR.stairs;
        else if (t.type === TILE.STAIRS_UP) color = '#a09060';
        else if (t.type === TILE.DOOR) color = COLOR.door;
        else continue;
        renderer.drawRect(
          L.x + (tx - L.bounds.x0) * L.px,
          L.y + (ty - L.bounds.y0) * L.px,
          L.px, L.px, color
        );
      }
    }

    const eventList = floor.microEvents?.length
      ? floor.microEvents
      : (floor.microEvent ? [floor.microEvent] : []);
    for (const ev of eventList) {
      if (!ev?.interactPos || !INTERACT_EVENT_KINDS.has(ev.kind)) continue;
      const ip = ev.interactPos;
      if (!this._insideBounds(ip.x, ip.y, L.bounds)) continue;
      const mx = L.x + (ip.x - L.bounds.x0) * L.px;
      const my = L.y + (ip.y - L.bounds.y0) * L.px;
      const t = floor.tileAt(ip.x, ip.y);
      const bright = t?.explored;
      renderer.drawRect(mx, my, Math.max(L.px, 3), Math.max(L.px, 3),
        ev.kind === 'merchant' ? (bright ? '#ffd76a' : '#a88430') : (bright ? '#c8a0ff' : '#6a5080'));
    }
  }

  _renderActors(renderer, renderCtx, slot) {
    const { floor, player } = renderCtx;
    const L = this._lastLayout || this._layout(floor, player, slot);

    for (const e of floor.enemies()) {
      const t = floor.tileAt(e.x, e.y);
      if (!t || !t.visible) continue;
      if (!this._insideBounds(e.x, e.y, L.bounds)) continue;
      const ex = L.x + (e.x - L.bounds.x0) * L.px;
      const ey = L.y + (e.y - L.bounds.y0) * L.px;
      const boss = e.defId?.startsWith('boss_');
      const subboss = e.defId?.startsWith('subboss_');
      renderer.drawRect(ex, ey, L.px, L.px, boss ? COLOR.goldHi : subboss ? '#c080ff' : COLOR.enemy);
      if (boss || subboss) {
        renderer.drawStrokedRect(ex - 2, ey - 2, L.px + 4, L.px + 4, boss ? COLOR.gold : '#c080ff', 1);
      }
    }

    if (player) {
      const pxPlayer = L.x + (player.x - L.bounds.x0) * L.px;
      const pyPlayer = L.y + (player.y - L.bounds.y0) * L.px;
      // Static marker — no per-frame pulse rings (those forced cache misses).
      renderer.drawRect(pxPlayer - 1, pyPlayer - 1, L.px + 2, L.px + 2, COLOR.player);
      renderer.drawStrokedRect(pxPlayer - 1, pyPlayer - 1, L.px + 2, L.px + 2, COLOR.gold, 1);
    }
  }

  _exploredBounds(floor, player) {
    const rev = floor.renderRevision || 0;
    const vis = floor.visibilityRevision || 0;
    const cacheKey = `${floor.seed}|${floor.index}|${rev}|${vis}`;
    if (this._boundsCache?.key === cacheKey) {
      const b = { ...this._boundsCache.bounds };
      if (player) {
        b.x0 = Math.max(0, Math.min(b.x0, player.x - 3));
        b.x1 = Math.min(floor.width - 1, Math.max(b.x1, player.x + 3));
        b.y0 = Math.max(0, Math.min(b.y0, player.y - 3));
        b.y1 = Math.min(floor.height - 1, Math.max(b.y1, player.y + 3));
      }
      return b;
    }

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
    const bounds = {
      x0: Math.max(0, x0 - pad),
      y0: Math.max(0, y0 - pad),
      x1: Math.min(floor.width - 1, x1 + pad),
      y1: Math.min(floor.height - 1, y1 + pad)
    };
    this._boundsCache = { key: cacheKey, bounds };
    return bounds;
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
    // Soft inner shadow on the map well (cached with terrain).
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(slot.x + 10, slot.y + 10, slot.w - 20, 3);
    ctx.fillRect(slot.x + 10, slot.y + 10, 3, slot.h - 20);

    const headerY = slot.y + 11;
    const headerH = uiSize(22);
    ctx.fillStyle = '#15101c';
    ctx.fillRect(slot.x + 11, headerY, slot.w - 22, headerH);
    ctx.strokeStyle = 'rgba(122,94,52,0.75)';
    ctx.strokeRect(slot.x + 11.5, headerY + 0.5, slot.w - 23, headerH - 1);
    r.drawText('DEPTH MAP', slot.x + slot.w / 2, headerY + headerH / 2 + 1, {
      size: uiSize(10), bold: true, align: 'center', baseline: 'middle',
      family: FONT_DISPLAY, color: COLOR.gold, engraved: true
    });

    drawBrassRivet(ctx, slot.x + 7, slot.y + 7, 2.6);
    drawBrassRivet(ctx, slot.x + slot.w - 7, slot.y + 7, 2.6);
    drawBrassRivet(ctx, slot.x + 7, slot.y + slot.h - 7, 2.6);
    drawBrassRivet(ctx, slot.x + slot.w - 7, slot.y + slot.h - 7, 2.6);
    ctx.restore();
  }
}
