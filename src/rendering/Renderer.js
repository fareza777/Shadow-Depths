/**
 * Renderer — owns canvas + draws frames.
 *
 * Public surface:
 *   render(sceneManager, stateStore)  — called once per rAF by GameLoop.
 *   drawFloor(floor)                  — paint tiles with vision state.
 *   drawEntities(floor, player, time) — paint sprites with renderX/Y interp.
 *   drawText(...), drawRect(...), drawBar(...) — primitives for HUD.
 *
 * Camera model (v0.2):
 *   - Canvas is fixed portrait (CANVAS_WIDTH × CANVAS_HEIGHT) for predictable
 *     HUD layout. CSS scales it to viewport.
 *   - World (40 × 28 tiles) is BIGGER than the canvas → renderer applies a
 *     translate so the player is centered on screen and the world scrolls.
 *   - World-space draws (floor, items, entities, particles) use the camera
 *     translate. Screen-space draws (HUD primitives) do NOT.
 *
 * Tween: entity (x, y) snaps on action; renderX/Y interpolates toward it
 * at TIMING.moveTween. Renderer drives that interpolation here so Entity
 * stays pure data.
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, GRID_WIDTH, GRID_HEIGHT,
  VIEWPORT_X, VIEWPORT_Y, VIEWPORT_W, VIEWPORT_H,
  TILE_SIZE, TILE, COLOR, TIMING
} from '../config/constants.js';
import { fillRect, strokeRect } from './SpriteRegistry.js';

export class Renderer {
  /**
   * @param {{
   *   canvas: HTMLCanvasElement,
   *   sprites: import('./SpriteRegistry.js').SpriteRegistry,
   *   cameraShake: import('./CameraShake.js').CameraShake,
   *   lighting: import('./LightingSystem.js').LightingSystem,
   *   particles: import('./ParticleSystem.js').ParticleSystem,
   *   eventBus: import('../core/EventBus.js').EventBus
   * }} deps
   */
  constructor({ canvas, sprites, cameraShake, lighting, particles, eventBus }) {
    this.canvas = canvas;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.sprites = sprites;
    this.cameraShake = cameraShake;
    this.lighting = lighting;
    this.particles = particles;
    this.bus = eventBus;

    /** Camera offset in canvas pixels, applied to world-space draws. */
    this._camera = { x: 0, y: 0 };
    this._lastTime = 0;

    this._resizeBound = this._fitToViewport.bind(this);
    window.addEventListener('resize', this._resizeBound);
    this._fitToViewport();

    // Game-feel: trigger camera shake on damage automatically.
    this.bus.on('entity:damaged', ({ amount, isCrit, entity }) => {
      const base = entity.kind === 'player' ? 5 : 2;
      const px = Math.min(12, base + amount * 0.3);
      this.cameraShake.trigger(px, isCrit ? TIMING.cameraShakeLong : TIMING.cameraShakeShort);
    });
  }

  destroy() {
    window.removeEventListener('resize', this._resizeBound);
  }

  // --- camera ---------------------------------------------------------
  /**
   * Compute camera so the player is centered WITHIN the world viewport
   * rect (not the whole canvas). HUD + control band areas are reserved
   * — the world never paints over them.
   */
  setCameraFor(playerRenderX, playerRenderY) {
    const worldW = GRID_WIDTH * TILE_SIZE;
    const worldH = GRID_HEIGHT * TILE_SIZE;
    let cx = VIEWPORT_X + VIEWPORT_W / 2 - (playerRenderX + 0.5) * TILE_SIZE;
    let cy = VIEWPORT_Y + VIEWPORT_H / 2 - (playerRenderY + 0.5) * TILE_SIZE;
    cx = worldW <= VIEWPORT_W
      ? VIEWPORT_X + (VIEWPORT_W - worldW) / 2
      : Math.max(VIEWPORT_X + VIEWPORT_W - worldW, Math.min(VIEWPORT_X, cx));
    cy = worldH <= VIEWPORT_H
      ? VIEWPORT_Y + (VIEWPORT_H - worldH) / 2
      : Math.max(VIEWPORT_Y + VIEWPORT_H - worldH, Math.min(VIEWPORT_Y, cy));
    this._camera = { x: Math.round(cx), y: Math.round(cy) };
  }

  get camera() { return this._camera; }

  /**
   * Convert canvas pixel coord → world tile coord. Returns null if the
   * pixel is outside the world viewport (i.e. user tapped HUD or the
   * control band — those taps don't count as movement intents).
   */
  canvasToTile(canvasX, canvasY) {
    if (canvasX < VIEWPORT_X || canvasX >= VIEWPORT_X + VIEWPORT_W) return null;
    if (canvasY < VIEWPORT_Y || canvasY >= VIEWPORT_Y + VIEWPORT_H) return null;
    return {
      x: Math.floor((canvasX - this._camera.x) / TILE_SIZE),
      y: Math.floor((canvasY - this._camera.y) / TILE_SIZE)
    };
  }

  /** True if a canvas pixel sits inside the world viewport rect. */
  isInViewport(canvasX, canvasY) {
    return canvasX >= VIEWPORT_X && canvasX < VIEWPORT_X + VIEWPORT_W
        && canvasY >= VIEWPORT_Y && canvasY < VIEWPORT_Y + VIEWPORT_H;
  }

  // --- main entry -----------------------------------------------------
  render(sceneManager, _stateStore) {
    const now = performance.now();
    const dt = this._lastTime ? (now - this._lastTime) / 1000 : 0;
    this._lastTime = now;
    this._timeSec = now / 1000;

    this.cameraShake.update(dt);
    this.particles.update(dt);
    const shake = this.cameraShake.offset();

    // Clear.
    const ctx = this.ctx;
    fillRect(ctx, 0, 0, this.canvas.width, this.canvas.height, COLOR.bg);

    // Apply shake to EVERYTHING. The world camera is applied separately by
    // each world-space draw method.
    ctx.save();
    ctx.translate(shake.x, shake.y);
    sceneManager.render(this);
    // Particles spawn at world coords; clip them to the viewport so a
    // floating damage number can't drift into HUD or control band.
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEWPORT_X, VIEWPORT_Y, VIEWPORT_W, VIEWPORT_H);
    ctx.clip();
    this.particles.render(ctx, this._camera);
    ctx.restore();
    ctx.restore();
  }

  // --- world primitives ----------------------------------------------
  /**
   * Paint the dungeon floor with vision state. Applies camera offset.
   * Only iterates tiles inside the visible viewport for perf.
   * @param {import('../world/Floor.js').Floor} floor
   * @param {{ renderX?:number, renderY?:number }} [player] — for torch glow
   */
  drawFloor(floor, player) {
    const ctx = this.ctx;
    const cam = this._camera;
    ctx.save();
    // Clip to viewport rect so world pixels can never spill into HUD or
    // control band areas. Then translate by camera offset.
    ctx.beginPath();
    ctx.rect(VIEWPORT_X, VIEWPORT_Y, VIEWPORT_W, VIEWPORT_H);
    ctx.clip();
    this._drawViewportAbyss(ctx, floor.definition || {});
    ctx.translate(cam.x, cam.y);

    // Visible tile range — derived from viewport rect, not full canvas.
    const x0 = Math.max(0, Math.floor((VIEWPORT_X - cam.x) / TILE_SIZE));
    const y0 = Math.max(0, Math.floor((VIEWPORT_Y - cam.y) / TILE_SIZE));
    const x1 = Math.min(floor.width - 1,
      Math.ceil((VIEWPORT_X + VIEWPORT_W - cam.x) / TILE_SIZE));
    const y1 = Math.min(floor.height - 1,
      Math.ceil((VIEWPORT_Y + VIEWPORT_H - cam.y) / TILE_SIZE));

    // Base abyss wash inside visible tile range.
    fillRect(ctx, x0 * TILE_SIZE, y0 * TILE_SIZE,
      (x1 - x0 + 1) * TILE_SIZE, (y1 - y0 + 1) * TILE_SIZE, '#05040a');

    const def = floor.definition || {};
    const tileOpts = {
      wallLit: def.wallPalette?.[0] || COLOR.wallLit,
      wallDim: def.wallPalette?.[1] || COLOR.wallDim,
      floorLit: def.floorPalette?.[0] || COLOR.floorLit,
      floorDim: def.floorPalette?.[1] || COLOR.floorDim,
      biomeId: def.biomeId || ''
    };

    const isWalkSurface = (type) =>
      type === TILE.FLOOR || type === TILE.DOOR
      || type === TILE.STAIRS_DOWN || type === TILE.STAIRS_UP;

    const adjFloorAt = (ax, ay) => {
      const nt = floor.tileAt(ax, ay);
      return !!(nt && isWalkSurface(nt.type));
    };

    const toPx = (g) => g * TILE_SIZE;

    // Pass 1 — void abyss (in & outside rooms), then floors.
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = floor.tiles[y][x];
        if (t.type !== TILE.VOID) continue;
        const tx = toPx(x);
        const ty = toPx(y);
        this.sprites.draw('tile_void', ctx, tx, ty, {
          tileX: x, tileY: y, ...tileOpts,
          explored: t.explored,
          dim: !t.visible
        });
      }
    }

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = floor.tiles[y][x];
        if (!t.explored) continue;
        const dim = !t.visible;
        const opts = { dim, tileX: x, tileY: y, ...tileOpts };
        const tx = toPx(x);
        const ty = toPx(y);
        if (t.type === TILE.VOID || t.type === TILE.WALL) continue;
        switch (t.type) {
          case TILE.FLOOR:       this.sprites.draw('tile_floor', ctx, tx, ty, opts); break;
          case TILE.STAIRS_DOWN: this.sprites.draw('tile_stairs_down', ctx, tx, ty, opts); break;
          case TILE.STAIRS_UP:   this.sprites.draw('tile_stairs_up', ctx, tx, ty, opts); break;
          case TILE.DOOR:        this.sprites.draw('tile_door', ctx, tx, ty, opts); break;
          default: break;
        }
        if (dim) Renderer._applyFog(ctx, tx, ty);
      }
    }

    // Pass 2 — walls on top with edge lighting toward open floor.
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = floor.tiles[y][x];
        if (t.type !== TILE.WALL || !t.explored) continue;
        const dim = !t.visible;
        const opts = {
          dim, tileX: x, tileY: y, ...tileOpts,
          adjFloor: {
            n: adjFloorAt(x, y - 1),
            s: adjFloorAt(x, y + 1),
            e: adjFloorAt(x + 1, y),
            w: adjFloorAt(x - 1, y)
          }
        };
        const tx = toPx(x);
        const ty = toPx(y);
        this.sprites.draw('tile_wall', ctx, tx, ty, opts);
        if (dim) Renderer._applyFog(ctx, tx, ty);
      }
    }

    if (player) {
      this._drawTorchGlow(ctx, floor, player, x0, y0, x1, y1);
    }
    ctx.restore();
  }

  _drawTorchGlow(ctx, floor, player, x0, y0, x1, y1) {
    const def = floor.definition || {};
    const radius = (def.torchRadius || 5) * TILE_SIZE;
    const px = player.renderX * TILE_SIZE + TILE_SIZE / 2;
    const py = player.renderY * TILE_SIZE + TILE_SIZE / 2;
    const left = x0 * TILE_SIZE;
    const top = y0 * TILE_SIZE;
    const w = (x1 - x0 + 1) * TILE_SIZE;
    const h = (y1 - y0 + 1) * TILE_SIZE;
    const flicker = 0.88 + Math.sin((this._timeSec || 0) * 5.2) * 0.08
      + Math.sin((this._timeSec || 0) * 11.7) * 0.04;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, w, h);
    ctx.clip();
    const g = ctx.createRadialGradient(px, py, TILE_SIZE * 0.3, px, py, radius);
    g.addColorStop(0, `rgba(212, 190, 122, ${0.26 * flicker})`);
    g.addColorStop(0.42, `rgba(160, 120, 70, ${0.1 * flicker})`);
    g.addColorStop(0.82, 'rgba(48, 36, 64, 0.03)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(left, top, w, h);
    ctx.globalAlpha = 0.12 * flicker;
    ctx.fillStyle = '#ffe8b0';
    ctx.beginPath();
    ctx.arc(px, py - TILE_SIZE * 0.08, TILE_SIZE * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Paint items on visible tiles. Applies camera offset + viewport clip. */
  drawGroundItems(floor) {
    const ctx = this.ctx;
    const cam = this._camera;
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEWPORT_X, VIEWPORT_Y, VIEWPORT_W, VIEWPORT_H);
    ctx.clip();
    ctx.translate(cam.x, cam.y);
    for (const [key, stack] of floor.items) {
      const [xs, ys] = key.split(',');
      const x = parseInt(xs, 10), y = parseInt(ys, 10);
      const t = floor.tileAt(x, y);
      if (!t || !t.visible) continue;
      const top = stack[stack.length - 1];
      const ix = x * TILE_SIZE;
      const iy = y * TILE_SIZE;
      this._drawItemGlow(ctx, ix, iy, top.spriteKey);
      this.sprites.draw(top.spriteKey, ctx, ix, iy);
      if (stack.length > 1) {
        this._tinyBadge(ctx, x * TILE_SIZE + TILE_SIZE - 10, y * TILE_SIZE + TILE_SIZE - 10, `${stack.length}`);
      }
    }
    ctx.restore();
  }

  drawTelegraphs(floor, player) {
    if (!floor || !player) return;
    const ctx = this.ctx;
    const cam = this._camera;
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEWPORT_X, VIEWPORT_Y, VIEWPORT_W, VIEWPORT_H);
    ctx.clip();
    ctx.translate(cam.x, cam.y);

    for (const e of floor.enemies()) {
      if (e.isDead) continue;
      const tile = floor.tileAt(e.x, e.y);
      if (!tile || !tile.visible) continue;
      const intent = e.intent || Renderer._inferThreatIntent(e, player);
      if (!intent) continue;
      if (intent.type === 'attack') {
        this._drawThreatTile(ctx, player.x, player.y, '#e85a4a', 0.26);
      } else if (intent.type === 'ranged') {
        this._drawThreatLine(ctx, e.x, e.y, intent.target?.x ?? player.x, intent.target?.y ?? player.y);
      } else if (intent.type === 'wait' && intent.meta?.winding) {
        this._drawThreatTile(ctx, e.x, e.y, COLOR.gold, 0.18);
      }
    }
    ctx.restore();
  }

  static _inferThreatIntent(enemy, player) {
    const d = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
    if (d === 1) return { type: 'attack' };
    return null;
  }

  _drawThreatTile(ctx, tx, ty, color, alpha) {
    const x = tx * TILE_SIZE;
    const y = ty * TILE_SIZE;
    ctx.save();
    ctx.globalAlpha = alpha;
    fillRect(ctx, x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6, color);
    ctx.globalAlpha = Math.min(0.9, alpha + 0.32);
    strokeRect(ctx, x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8, color, 2);
    ctx.restore();
  }

  _drawThreatLine(ctx, x0, y0, x1, y1) {
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.strokeStyle = '#80b0e0';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo((x0 + 0.5) * TILE_SIZE, (y0 + 0.5) * TILE_SIZE);
    ctx.lineTo((x1 + 0.5) * TILE_SIZE, (y1 + 0.5) * TILE_SIZE);
    ctx.stroke();
    ctx.setLineDash([]);
    this._drawThreatTile(ctx, x1, y1, '#80b0e0', 0.18);
    ctx.restore();
  }

  /**
   * Paint entities. Updates renderX/Y toward grid position by lerp. Applies
   * camera offset. Skips dead entities (defensive — they should be removed
   * from the floor on death, but it's cheap insurance).
   * @param {import('../world/Floor.js').Floor} floor
   * @param {number} dt seconds since last frame
   */
  drawEntities(floor, dt) {
    const ctx = this.ctx;
    const speed = 1000 / TIMING.moveTween;
    for (const e of floor.entities.values()) {
      const dx = e.x - e.renderX;
      const dy = e.y - e.renderY;
      const maxStep = speed * dt;
      e.renderX += clampMove(dx, maxStep);
      e.renderY += clampMove(dy, maxStep);
    }

    const cam = this._camera;
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEWPORT_X, VIEWPORT_Y, VIEWPORT_W, VIEWPORT_H);
    ctx.clip();
    ctx.translate(cam.x, cam.y);

    const list = Array.from(floor.entities.values()).sort((a, b) => a.renderY - b.renderY);
    for (const e of list) {
      if (e.isDead) continue;
      const t = floor.tileAt(e.x, e.y);
      if (e.kind === 'enemy' && (!t || !t.visible)) continue;
      const px = e.renderX * TILE_SIZE;
      const py = e.renderY * TILE_SIZE;
      const key = e.spriteKey
        || (e.kind === 'player' && typeof e.displaySpriteKey === 'function'
          ? e.displaySpriteKey()
          : e.kind === 'player' ? 'player_sword' : 'enemy_goblin');
      if (e.kind === 'enemy' && t?.visible) {
        this._drawThreatAura(ctx, e, px, py);
      }
      this._drawEntityGrounding(ctx, e, px, py);
      this.sprites.draw(key, ctx, px, py);
      if (e.kind === 'enemy' && t?.visible) {
        this._drawEntitySilhouette(ctx, px, py);
      }

      if (e.kind === 'enemy' && e.stats.hp < e.stats.hpMax) {
        const pct = e.stats.hp / e.stats.hpMax;
        const w = TILE_SIZE - 6;
        const barH = entity.defId?.startsWith('boss_') ? 5 : 4;
        const barY = py - (barH + 2);
        const barColor = entity.defId?.startsWith('boss_') ? '#d4be7a'
          : entity.defId?.startsWith('subboss_') ? '#c080ff' : COLOR.hpBar;
        fillRect(ctx, px + 3, barY, w, barH, COLOR.hpBarBg);
        fillRect(ctx, px + 3, barY, w * pct, barH, barColor);
        if (entity.defId?.startsWith('boss_')) {
          fillRect(ctx, px + 3, barY, w, 1, '#ffffff33');
        }
      }
      if (e.kind === 'enemy' && e.intent) {
        this._drawIntentIcon(ctx, e.intent, px, py);
      }
    }
    ctx.restore();
  }

  _drawIntentIcon(ctx, intent, px, py) {
    let glyph = '';
    let color = '#d6d6da';
    if (intent.type === 'attack') { glyph = '!'; color = '#ff6060'; }
    else if (intent.type === 'ranged') { glyph = '➜'; color = '#80b0e0'; }
    else if (intent.type === 'move')   { glyph = '·'; color = '#a0a0aa'; }
    else if (intent.type === 'wait')   { glyph = intent.meta?.winding ? '⌛' : '…'; color = '#c0a060'; }
    if (!glyph) return;
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = color;
    ctx.fillText(glyph, px + TILE_SIZE / 2, py - 8);
  }

  _drawEntityGrounding(ctx, entity, px, py) {
    ctx.save();
    ctx.globalAlpha = entity.kind === 'player' ? 0.34 : 0.28;
    const w = TILE_SIZE * (entity.kind === 'player' ? 0.58 : 0.52);
    const h = Math.max(4, TILE_SIZE * 0.14);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE * 0.82, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawEntitySilhouette(ctx, px, py) {
    ctx.save();
    ctx.globalAlpha = 0.42;
    strokeRect(ctx, px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6, '#000000', 1);
    ctx.restore();
  }

  _drawThreatAura(ctx, entity, px, py) {
    const isBoss = entity.defId?.startsWith('boss_');
    const isSub = entity.defId?.startsWith('subboss_');
    const elite = isBoss || isSub || (entity.stats?.hpMax ?? 0) >= 28;
    if (!elite) return;
    const pulse = 0.55 + Math.sin((this._timeSec || 0) * 3.5) * 0.25;
    const color = isBoss ? '#d4be7a' : isSub ? '#c080ff' : '#8060a0';
    ctx.save();
    ctx.globalAlpha = (isBoss ? 0.38 : 0.24) * pulse;
    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE * 0.55;
    const r = TILE_SIZE * (isBoss ? 0.52 : 0.44);
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (isBoss) {
      ctx.globalAlpha = 0.35 * pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawItemGlow(ctx, ix, iy, spriteKey) {
    const warm = spriteKey?.startsWith('potion_') || spriteKey?.startsWith('vial_')
      || spriteKey?.startsWith('weapon_') || spriteKey?.startsWith('ring_')
      || spriteKey?.startsWith('necklace_') || spriteKey?.startsWith('amulet_');
    const cx = ix + TILE_SIZE / 2;
    const cy = iy + TILE_SIZE * 0.86;
    ctx.save();
    ctx.globalAlpha = warm ? 0.34 : 0.22;
    ctx.fillStyle = warm ? '#d4be7a' : '#8090b0';
    ctx.beginPath();
    ctx.ellipse(cx, cy, TILE_SIZE * 0.3, TILE_SIZE * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _tinyBadge(ctx, x, y, text) {
    fillRect(ctx, x - 1, y - 9, 12, 11, '#000');
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLOR.textPrimary;
    ctx.fillText(text, x, y - 9);
  }

  // --- HUD primitives (screen space — no camera offset) --------------
  /**
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {{
   *   size?: number, bold?: boolean, italic?: boolean,
   *   align?: 'left'|'center'|'right', baseline?: 'top'|'middle'|'bottom',
   *   color?: string,
   *   family?: string  defaults to FONT_MONO; pass FONT_DISPLAY for headers
   *                    or FONT_BODY for atmospheric flavor text
   * }} [opts]
   */
  drawText(text, x, y, opts = {}) {
    const ctx = this.ctx;
    const weight = opts.bold ? 'bold ' : '';
    const style  = opts.italic ? 'italic ' : '';
    const family = opts.family || '"Inconsolata", "Courier New", monospace';
    ctx.font = `${style}${weight}${opts.size || 14}px ${family}`;
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'top';
    ctx.fillStyle = opts.color || COLOR.textPrimary;
    ctx.fillText(text, x, y);
  }

  /**
   * Measure text width using the same font config drawText would use.
   * Useful for centering composed lines (icon + text).
   */
  measureText(text, opts = {}) {
    const ctx = this.ctx;
    const weight = opts.bold ? 'bold ' : '';
    const style  = opts.italic ? 'italic ' : '';
    const family = opts.family || '"Inconsolata", "Courier New", monospace';
    ctx.font = `${style}${weight}${opts.size || 14}px ${family}`;
    return ctx.measureText(text).width;
  }

  drawBar(x, y, w, h, value, max, fillColor, bgColor) {
    fillRect(this.ctx, x, y, w, h, bgColor);
    const pct = Math.max(0, Math.min(1, value / max));
    fillRect(this.ctx, x, y, w * pct, h, fillColor);
    strokeRect(this.ctx, x, y, w, h, '#000', 1);
  }

  drawRect(x, y, w, h, color) {
    fillRect(this.ctx, x, y, w, h, color);
  }

  /** Warm fog-of-war tint on explored-but-not-visible tiles. */
  static _applyFog(ctx, tx, ty) {
    ctx.save();
    const g = ctx.createLinearGradient(tx, ty, tx, ty + TILE_SIZE);
    g.addColorStop(0, 'rgba(36, 28, 52, 0.52)');
    g.addColorStop(0.55, 'rgba(20, 16, 32, 0.58)');
    g.addColorStop(1, 'rgba(6, 4, 12, 0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
    ctx.globalAlpha = 0.14;
    fillRect(ctx, tx, ty, TILE_SIZE, 1, '#d4be7a28');
    ctx.globalAlpha = 0.1;
    fillRect(ctx, tx, ty, 1, TILE_SIZE, '#00000088');
    ctx.restore();
  }

  drawStrokedRect(x, y, w, h, color, line = 1) {
    strokeRect(this.ctx, x, y, w, h, color, line);
  }

  _drawViewportAbyss(ctx, def = {}) {
    const biome = def.biomeId || '';
    let top = '#08060e';
    let mid = '#030208';
    let haze = '#1a1220';
    if (biome.includes('drowning') || biome.includes('sunken')) {
      top = '#050a12'; mid = '#02050a'; haze = '#123040';
    } else if (biome.includes('frost') || biome.includes('salt')) {
      top = '#080a14'; mid = '#03040a'; haze = '#203048';
    } else if (biome.includes('ashen') || biome.includes('cinder')) {
      top = '#0c0806'; mid = '#030201'; haze = '#3a2418';
    } else if (biome.includes('empty') || biome.includes('below')) {
      top = '#02020a'; mid = '#000004'; haze = '#181048';
    }

    const g = ctx.createLinearGradient(0, VIEWPORT_Y, 0, VIEWPORT_Y + VIEWPORT_H);
    g.addColorStop(0, top);
    g.addColorStop(0.52, mid);
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(VIEWPORT_X, VIEWPORT_Y, VIEWPORT_W, VIEWPORT_H);

    ctx.save();
    ctx.globalAlpha = 0.16;
    const rg = ctx.createRadialGradient(
      VIEWPORT_X + VIEWPORT_W / 2, VIEWPORT_Y + VIEWPORT_H * 0.34, 10,
      VIEWPORT_X + VIEWPORT_W / 2, VIEWPORT_Y + VIEWPORT_H * 0.34, VIEWPORT_W * 0.62
    );
    rg.addColorStop(0, haze);
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.fillRect(VIEWPORT_X, VIEWPORT_Y, VIEWPORT_W, VIEWPORT_H);

    ctx.globalAlpha = 0.18;
    for (let y = VIEWPORT_Y + 48; y < VIEWPORT_Y + VIEWPORT_H; y += 86) {
      fillRect(ctx, VIEWPORT_X + 12, y, VIEWPORT_W - 24, 1, '#ffffff08');
      fillRect(ctx, VIEWPORT_X + 36, y + 16, VIEWPORT_W - 72, 1, '#d4be7a07');
    }

    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 12; i++) {
      const x = VIEWPORT_X + 16 + ((i * 43) % Math.max(1, VIEWPORT_W - 32));
      const y = VIEWPORT_Y + 42 + ((i * 71) % Math.max(1, VIEWPORT_H - 84));
      fillRect(ctx, x, y, 1, 1, i % 3 === 0 ? '#d4be7a22' : '#ffffff14');
    }

    ctx.globalAlpha = 0.2;
    fillRect(ctx, VIEWPORT_X, VIEWPORT_Y, 2, VIEWPORT_H, '#d4be7a22');
    fillRect(ctx, VIEWPORT_X + VIEWPORT_W - 2, VIEWPORT_Y, 2, VIEWPORT_H, '#d4be7a18');
    ctx.restore();
  }

  // --- viewport scaling ----------------------------------------------
  _fitToViewport() {
    const vw = window.visualViewport?.width || window.innerWidth;
    const vh = window.visualViewport?.height || window.innerHeight;
    const scale = Math.min(vw / CANVAS_WIDTH, vh / CANVAS_HEIGHT);
    this.canvas.style.width  = `${Math.floor(CANVAS_WIDTH * scale)}px`;
    this.canvas.style.height = `${Math.floor(CANVAS_HEIGHT * scale)}px`;
  }
}

function clampMove(delta, max) {
  if (delta > max) return max;
  if (delta < -max) return -max;
  return delta;
}
