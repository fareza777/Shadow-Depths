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
  GRID_WIDTH, GRID_HEIGHT, TILE_SIZE, TILE, COLOR, TIMING
} from '../config/constants.js';
import {
  Layout, syncLayoutFromWindow, viewportX, viewportY, viewportW, viewportH
} from '../config/layoutMetrics.js';
import { fillRect, strokeRect } from './SpriteRegistry.js';
import { drawBiomeWall, drawBiomeFloor, hasBiome } from './biomeTiles.js';
import { getAbyssPalette, drawBiomeDecorations } from './biomeBackdrop.js';

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
    syncLayoutFromWindow(canvas);
    this.ctx = canvas.getContext('2d', { alpha: false });
    // Smoothing ON: the entity/item/hero sprites are SVG rasters down-scaled
    // via drawImage and need bilinear filtering to stay clean. The legacy
    // pixel tiles are axis-aligned rects, so smoothing doesn't soften them.
    this.ctx.imageSmoothingEnabled = true;
    this.sprites = sprites;
    this.cameraShake = cameraShake;
    this.lighting = lighting;
    this.particles = particles;
    this.bus = eventBus;

    /** Camera offset in canvas pixels, applied to world-space draws. */
    this._camera = { x: 0, y: 0 };
    this._lastTime = 0;
    /** @type {WeakMap<object, number>} entity → flash end timestamp (ms) */
    this._hitFlashes = new WeakMap();
    this._attackFlashes = [];

    this._resizeBound = this._fitToViewport.bind(this);
    window.addEventListener('resize', this._resizeBound);
    window.visualViewport?.addEventListener('resize', this._resizeBound);
    this._fitToViewport();

    // Game-feel: trigger camera shake on damage automatically.
    this.bus.on('entity:damaged', ({ amount, isCrit, entity }) => {
      if (!entity) return;
      const base = entity.kind === 'player' ? 6 : 3;
      const px = Math.min(14, base + amount * 0.35);
      this.cameraShake.trigger(px, isCrit ? TIMING.cameraShakeLong : TIMING.cameraShakeShort);
      const until = performance.now() + (isCrit ? TIMING.hitFlash * 2 : TIMING.hitFlash);
      this._hitFlashes.set(entity, until);
    });
    this.bus.on('entity:attacked', ({ attacker, target, isCrit, isMiss, kind }) => {
      if (!attacker || !target || isMiss) return;
      this._attackFlashes.push({
        attacker,
        target,
        kind,
        isCrit,
        startedAt: performance.now(),
        duration: isCrit ? 190 : 140
      });
      if (this._attackFlashes.length > 16) this._attackFlashes.shift();
    });
  }

  destroy() {
    window.removeEventListener('resize', this._resizeBound);
    window.visualViewport?.removeEventListener('resize', this._resizeBound);
  }

  // --- camera ---------------------------------------------------------
  /**
   * Compute camera so the player is centered WITHIN the world viewport
   * rect (not the whole canvas). HUD + control band areas are reserved
   * — the world never paints over them.
   */
  setCameraFor(playerRenderX, playerRenderY) {
    const vx = viewportX();
    const vy = viewportY();
    const vw = viewportW();
    const vh = viewportH();
    const worldW = GRID_WIDTH * TILE_SIZE;
    const worldH = GRID_HEIGHT * TILE_SIZE;
    let cx = vx + vw / 2 - (playerRenderX + 0.5) * TILE_SIZE;
    let cy = vy + vh / 2 - (playerRenderY + 0.5) * TILE_SIZE;
    cx = worldW <= vw
      ? vx + (vw - worldW) / 2
      : Math.max(vx + vw - worldW, Math.min(vx, cx));
    cy = worldH <= vh
      ? vy + (vh - worldH) / 2
      : Math.max(vy + vh - worldH, Math.min(vy, cy));
    this._camera = { x: Math.round(cx), y: Math.round(cy) };
  }

  get camera() { return this._camera; }

  /**
   * Convert canvas pixel coord → world tile coord. Returns null if the
   * pixel is outside the world viewport (i.e. user tapped HUD or the
   * control band — those taps don't count as movement intents).
   */
  canvasToTile(canvasX, canvasY) {
    const vx = viewportX();
    const vy = viewportY();
    const vw = viewportW();
    const vh = viewportH();
    if (canvasX < vx || canvasX >= vx + vw) return null;
    if (canvasY < vy || canvasY >= vy + vh) return null;
    return {
      x: Math.floor((canvasX - this._camera.x) / TILE_SIZE),
      y: Math.floor((canvasY - this._camera.y) / TILE_SIZE)
    };
  }

  /** True if a canvas pixel sits inside the world viewport rect. */
  isInViewport(canvasX, canvasY) {
    const vx = viewportX();
    const vy = viewportY();
    const vw = viewportW();
    const vh = viewportH();
    return canvasX >= vx && canvasX < vx + vw
        && canvasY >= vy && canvasY < vy + vh;
  }

  // --- main entry -----------------------------------------------------
  render(sceneManager, _stateStore) {
    const now = performance.now();
    const dt = this._lastTime ? (now - this._lastTime) / 1000 : 0;
    this._lastTime = now;
    this._timeSec = now / 1000;

    this.cameraShake.update(dt);
    this.particles.update(dt);
    this._attackFlashes = this._attackFlashes.filter((f) => now - f.startedAt < f.duration);
    const shake = this.cameraShake.offset();

    // Establish the HiDPI base transform for this frame: everything below
    // draws in logical (CSS px) coordinates and the dpr scale maps them onto
    // the larger backing store. setTransform also flushes any leaked state.
    const ctx = this.ctx;
    const dpr = Layout.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;

    // Clear (logical dims — the dpr scale covers the full backing store).
    fillRect(ctx, 0, 0, Layout.canvasW, Layout.canvasH, COLOR.bg);

    // World pass — camera shake applies only to dungeon tiles / entities.
    ctx.save();
    ctx.translate(shake.x, shake.y);
    sceneManager.render(this);
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewportX(), viewportY(), viewportW(), viewportH());
    ctx.clip();
    this.particles.render(ctx, this._camera);
    ctx.restore();
    ctx.restore();

    // UI pass — fixed screen space (HUD + D-pad never shaken or clipped).
    this.beginScreenSpace();
    sceneManager.renderUI(this);
    // Top-most overlay (achievement toasts) — sits above every scene UI.
    if (typeof this.overlayRender === 'function') {
      try { this.overlayRender(this); } catch (err) { console.warn('[overlayRender]', err); }
    }
    this.endScreenSpace();
  }

  /** Reset transform for HUD / control-band draws (logical px, HiDPI-scaled). */
  beginScreenSpace() {
    this.ctx.save();
    const dpr = Layout.dpr || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  endScreenSpace() {
    this.ctx.restore();
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
    const vx = viewportX();
    const vy = viewportY();
    const vw = viewportW();
    const vh = viewportH();
    ctx.rect(vx, vy, vw, vh);
    ctx.clip();
    this._drawViewportAbyss(ctx, floor.definition || {});
    this._drawBiomeBackdropDetails(ctx, floor.definition || {});
    ctx.translate(cam.x, cam.y);

    const x0 = Math.max(0, Math.floor((vx - cam.x) / TILE_SIZE));
    const y0 = Math.max(0, Math.floor((vy - cam.y) / TILE_SIZE));
    const x1 = Math.min(floor.width - 1,
      Math.ceil((vx + vw - cam.x) / TILE_SIZE));
    const y1 = Math.min(floor.height - 1,
      Math.ceil((vy + vh - cam.y) / TILE_SIZE));

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

    // Use biome tile atlas if this floor's biomeId matches one of our 10
    // hand-designed biomes. Otherwise fall back to the legacy sprite
    // registry tiles.
    const biomeId = tileOpts.biomeId;
    const useBiome = !!biomeId && hasBiome(biomeId);

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
          case TILE.FLOOR:
            if (useBiome) drawBiomeFloor(ctx, tx, ty, TILE_SIZE, x, y, biomeId);
            else this.sprites.draw('tile_floor', ctx, tx, ty, opts);
            break;
          case TILE.STAIRS_DOWN:
            if (useBiome) drawBiomeFloor(ctx, tx, ty, TILE_SIZE, x, y, biomeId);
            this.sprites.draw('tile_stairs_down', ctx, tx, ty, opts);
            break;
          case TILE.STAIRS_UP:
            if (useBiome) drawBiomeFloor(ctx, tx, ty, TILE_SIZE, x, y, biomeId);
            this.sprites.draw('tile_stairs_up', ctx, tx, ty, opts);
            break;
          case TILE.DOOR:
            if (useBiome) drawBiomeFloor(ctx, tx, ty, TILE_SIZE, x, y, biomeId);
            this.sprites.draw('tile_door', ctx, tx, ty, opts);
            break;
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
        if (useBiome) {
          drawBiomeWall(ctx, tx, ty, TILE_SIZE, x, y, biomeId);
        } else {
          this.sprites.draw('tile_wall', ctx, tx, ty, opts);
        }
        if (dim) Renderer._applyFog(ctx, tx, ty);
      }
    }

    // Special floor centerpiece (REST campfire / VAULT chest motif).
    this._drawSpecialFloorMotif(ctx, floor);

    if (player) {
      this._drawTorchGlow(ctx, floor, player, x0, y0, x1, y1);
    }
    ctx.restore();
  }

  /**
   * Decorative centerpiece for special floor types. Drawn in world space
   * (inside the camera-translated viewport). Pure cosmetics — gameplay is
   * already differentiated by enemy/item spawn rules.
   */
  _drawSpecialFloorMotif(ctx, floor) {
    const def = floor.definition || {};
    if (def.type !== 'rest' && def.type !== 'vault' && def.type !== 'forge') return;
    if (!floor.stairsUp) return;
    const t = this._timeSec || 0;
    const cx = floor.stairsUp.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = floor.stairsUp.y * TILE_SIZE + TILE_SIZE / 2;

    if (def.type === 'rest' || def.type === 'forge') {
      // Forge sanctuary — an anvil/ember shrine where the Veiled Smith appears.
      ctx.save();
      // Glow halo
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, TILE_SIZE * 1.6);
      glow.addColorStop(0, 'rgba(255, 160, 80, 0.42)');
      glow.addColorStop(1, 'rgba(255, 160, 80, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - TILE_SIZE * 2, cy - TILE_SIZE * 2, TILE_SIZE * 4, TILE_SIZE * 4);
      if (def.type === 'forge') {
        ctx.fillStyle = '#4a4a54';
        ctx.fillRect(cx - 13, cy + 3, 26, 5);
        ctx.fillRect(cx - 8, cy + 8, 16, 5);
        ctx.fillStyle = '#c0b8a0';
        ctx.fillRect(cx - 10, cy + 2, 20, 1);
      } else {
        ctx.fillStyle = '#3a1f12';
        ctx.fillRect(cx - 10, cy + 6, 20, 4);
        ctx.fillStyle = '#5a3420';
        ctx.fillRect(cx - 8, cy + 4, 16, 2);
      }
      // Flame body
      const flicker = 0.85 + Math.sin(t * 6.7) * 0.12 + Math.sin(t * 13.1) * 0.05;
      const fh = 14 * flicker;
      ctx.fillStyle = '#ff7040';
      ctx.beginPath();
      ctx.moveTo(cx, cy - fh);
      ctx.quadraticCurveTo(cx + 6, cy - fh * 0.3, cx + 4, cy + 2);
      ctx.lineTo(cx - 4, cy + 2);
      ctx.quadraticCurveTo(cx - 6, cy - fh * 0.3, cx, cy - fh);
      ctx.fill();
      ctx.fillStyle = '#ffd070';
      ctx.beginPath();
      ctx.moveTo(cx, cy - fh * 0.7);
      ctx.quadraticCurveTo(cx + 3, cy - fh * 0.2, cx + 2, cy + 1);
      ctx.lineTo(cx - 2, cy + 1);
      ctx.quadraticCurveTo(cx - 3, cy - fh * 0.2, cx, cy - fh * 0.7);
      ctx.fill();
      // Rising sparks
      ctx.fillStyle = '#ffe890';
      for (let i = 0; i < 5; i++) {
        const phase = (t * (1.4 + i * 0.3) + i * 1.1) % 2;
        const sx = cx + Math.sin(t * 2 + i) * 6;
        const sy = cy - 4 - phase * 18;
        const a = Math.max(0, 1 - phase / 2);
        ctx.globalAlpha = a * 0.8;
        ctx.fillRect(sx, sy, 1, 1);
      }
      ctx.restore();
    } else if (def.type === 'vault') {
      // Treasure chest — brass-trimmed wooden chest with subtle glow.
      ctx.save();
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, TILE_SIZE * 1.2);
      glow.addColorStop(0, 'rgba(212, 172, 108, 0.32)');
      glow.addColorStop(1, 'rgba(212, 172, 108, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - TILE_SIZE * 1.5, cy - TILE_SIZE * 1.5, TILE_SIZE * 3, TILE_SIZE * 3);
      // Chest body
      ctx.fillStyle = '#3a2014';
      ctx.fillRect(cx - 14, cy - 6, 28, 14);
      ctx.fillStyle = '#5a3420';
      ctx.fillRect(cx - 14, cy - 10, 28, 6);
      // Brass bands
      ctx.fillStyle = '#d4ac6c';
      ctx.fillRect(cx - 14, cy - 4, 28, 1);
      ctx.fillRect(cx - 14, cy + 6, 28, 1);
      ctx.fillRect(cx - 14, cy - 10, 1, 18);
      ctx.fillRect(cx + 13, cy - 10, 1, 18);
      // Lock
      ctx.fillStyle = '#f1d49a';
      ctx.fillRect(cx - 2, cy - 1, 4, 4);
      ctx.fillStyle = '#2a1808';
      ctx.fillRect(cx - 1, cy + 1, 2, 1);
      // Soft pulse highlight
      const pulse = 0.6 + 0.4 * Math.sin(t * 2.3);
      ctx.globalAlpha = pulse * 0.5;
      ctx.fillStyle = '#fff5d0';
      ctx.fillRect(cx - 2, cy - 1, 4, 1);
      ctx.restore();
    }
  }

  _drawTorchGlow(ctx, floor, player, x0, y0, x1, y1) {
    const def = floor.definition || {};
    const radius = (player.torchRadius || def.torchRadius || 5) * TILE_SIZE;
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
    g.addColorStop(0, `rgba(245, 214, 150, ${0.28 * flicker})`);
    g.addColorStop(0.34, `rgba(190, 136, 74, ${0.14 * flicker})`);
    g.addColorStop(0.72, 'rgba(92, 62, 92, 0.05)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(left, top, w, h);
    const halo = ctx.createRadialGradient(px, py, radius * 0.48, px, py, radius * 1.24);
    halo.addColorStop(0, 'rgba(0, 0, 0, 0)');
    halo.addColorStop(0.82, 'rgba(6, 4, 12, 0.08)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = halo;
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
    ctx.rect(viewportX(), viewportY(), viewportW(), viewportH());
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
      this.sprites.draw(top.spriteKey, ctx, ix, iy, { affixes: top.def?.affixes || null });
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
    ctx.rect(viewportX(), viewportY(), viewportW(), viewportH());
    ctx.clip();
    ctx.translate(cam.x, cam.y);

    for (const e of floor.enemies()) {
      if (e.isDead) continue;
      const tile = floor.tileAt(e.x, e.y);
      if (!tile || !tile.visible) continue;
      const intent = e.intent || Renderer._inferThreatIntent(e, player);
      if (!intent) continue;
      if (intent.type === 'ranged') {
        this._drawThreatLine(ctx, e.x, e.y, intent.target?.x ?? player.x, intent.target?.y ?? player.y);
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
    fillRect(ctx, x + 8, y + 8, TILE_SIZE - 16, TILE_SIZE - 16, color);
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
  drawEntities(floor, dt, player = null) {
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
    ctx.rect(viewportX(), viewportY(), viewportW(), viewportH());
    ctx.clip();
    ctx.translate(cam.x, cam.y);

    const list = Array.from(floor.entities.values()).sort((a, b) => a.renderY - b.renderY);
    this._drawAttackFlashes(ctx, cam);
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
      this._drawEntityGrounding(ctx, e, px, py);
      this._drawThreatAura(ctx, e, px, py);
      this.sprites.draw(key, ctx, px, py, { entity: e, time: this._timeSec || 0 });
      this._drawEntityHitFlash(ctx, e, px, py);

      if (e.kind === 'enemy' && e.stats.hp < e.stats.hpMax) {
        const pct = e.stats.hp / e.stats.hpMax;
        const w = TILE_SIZE - 6;
        const barH = e.defId?.startsWith('boss_') ? 5 : 4;
        const barY = py - (barH + 2);
        const barColor = e.defId?.startsWith('boss_') ? '#d4be7a'
          : e.defId?.startsWith('subboss_') ? '#c080ff' : COLOR.hpBar;
        fillRect(ctx, px + 3, barY, w, barH, COLOR.hpBarBg);
        fillRect(ctx, px + 3, barY, w * pct, barH, barColor);
        if (e.defId?.startsWith('boss_')) {
          fillRect(ctx, px + 3, barY, w, 1, '#ffffff33');
        }
      }
      if (e.kind === 'enemy' && t?.visible && player) {
        const intent = e.intent || Renderer._inferThreatIntent(e, player);
        if (intent) this._drawIntentIcon(ctx, intent, px, py);
      }
    }
    ctx.restore();
  }

  _drawAttackFlashes(ctx) {
    const now = performance.now();
    for (const f of this._attackFlashes) {
      const t = Math.max(0, Math.min(1, (now - f.startedAt) / f.duration));
      const tx = (f.target.renderX + 0.5) * TILE_SIZE;
      const ty = (f.target.renderY + 0.48) * TILE_SIZE;
      ctx.save();
      ctx.globalAlpha = (1 - t) * (f.isCrit ? 0.95 : 0.7);
      ctx.strokeStyle = f.isCrit ? '#fff0b0' : '#e8e0d0';
      ctx.lineWidth = f.isCrit ? 4 : 3;
      ctx.beginPath();
      if (f.kind === 'ranged') {
        const ax = (f.attacker.renderX + 0.5) * TILE_SIZE;
        const ay = (f.attacker.renderY + 0.5) * TILE_SIZE;
        ctx.moveTo(ax, ay);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillStyle = f.isCrit ? '#fff0b0' : '#80b0e0';
        ctx.fillRect(tx - 3, ty - 3, 6, 6);
      } else {
        const r = TILE_SIZE * (0.22 + t * 0.42);
        ctx.arc(tx, ty, r, -Math.PI * 0.75, Math.PI * 0.25);
        ctx.stroke();
        ctx.strokeStyle = f.isCrit ? '#e85a4a' : '#d4be7a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(tx, ty, r + 5, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawIntentIcon(ctx, intent, px, py) {
    let glyph = '';
    let color = '#d6d6da';
    if (intent.type === 'attack') { glyph = '!'; color = '#ff6060'; }
    else if (intent.type === 'ranged') { glyph = '>'; color = '#80b0e0'; }
    else if (intent.type === 'move')   { glyph = '.'; color = '#a0a0aa'; }
    else if (intent.type === 'wait')   { glyph = intent.meta?.winding ? '!!' : '...'; color = '#c0a060'; }
    if (!glyph) return;
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = color;
    ctx.fillText(glyph, px + TILE_SIZE / 2, py - 8);
  }

  _drawEntityHitFlash(ctx, entity, px, py) {
    const until = this._hitFlashes.get(entity);
    if (!until || performance.now() > until) return;
    const t = (until - performance.now()) / TIMING.hitFlash;
    ctx.save();
    ctx.globalAlpha = Math.min(0.55, 0.15 + t * 0.4);
    ctx.fillStyle = entity.kind === 'player' ? '#ff8080' : '#ffffff';
    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.restore();
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
    // Tile-local origin so the haze gradient can be built once and reused
    // for every dim tile (it was previously rebuilt per tile per frame —
    // 100+ gradient allocations a frame).
    ctx.translate(tx, ty);
    ctx.fillStyle = 'rgba(8, 6, 14, 0.42)';
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    ctx.globalCompositeOperation = 'screen';
    if (!Renderer._fogHaze) {
      const haze = ctx.createRadialGradient(
        TILE_SIZE * 0.5, TILE_SIZE * 0.38, 1,
        TILE_SIZE * 0.5, TILE_SIZE * 0.38, TILE_SIZE * 0.78
      );
      haze.addColorStop(0, 'rgba(120, 86, 120, 0.10)');
      haze.addColorStop(0.7, 'rgba(80, 60, 92, 0.04)');
      haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
      Renderer._fogHaze = haze;
    }
    ctx.fillStyle = Renderer._fogHaze;
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.16;
    fillRect(ctx, 2, TILE_SIZE - 3, TILE_SIZE - 4, 1, '#000000');
    ctx.restore();
  }

  drawStrokedRect(x, y, w, h, color, line = 1) {
    strokeRect(this.ctx, x, y, w, h, color, line);
  }

  _drawViewportAbyss(ctx, def = {}) {
    const time = this._timeSec || 0;
    const biome = def.biomeId || '';
    const pal = getAbyssPalette(biome);
    const top = pal.top;
    const mid = pal.mid;
    const haze = pal.haze;

    const vx = viewportX();
    const vy = viewportY();
    const vw = viewportW();
    const vh = viewportH();
    const g = ctx.createLinearGradient(0, vy, 0, vy + vh);
    g.addColorStop(0, top);
    g.addColorStop(0.52, mid);
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(vx, vy, vw, vh);

    ctx.save();
    ctx.globalAlpha = 0.16;
    const rg = ctx.createRadialGradient(
      vx + vw / 2, vy + vh * 0.34, 10,
      vx + vw / 2, vy + vh * 0.34, vw * 0.62
    );
    rg.addColorStop(0, haze);
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.fillRect(vx, vy, vw, vh);

    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 12; i++) {
      const drift = Math.sin(time * 0.28 + i * 1.7) * 6;
      const x = vx + 16 + ((i * 43 + time * 7) % Math.max(1, vw - 32));
      const y = vy + 42 + ((i * 71 + drift) % Math.max(1, vh - 84));
      fillRect(ctx, x, y, 1, 1, i % 3 === 0 ? pal.mote : '#ffffff14');
    }

    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 5; i++) {
      const y = vy + 52 + i * Math.max(42, vh / 5)
        + Math.sin(time * 0.22 + i) * 5;
      const x = vx + ((time * (4 + i) + i * 89) % Math.max(1, vw + 80)) - 40;
      fillRect(ctx, x, y, 36 + i * 9, 1, '#d4be7a40');
      fillRect(ctx, x + 18, y + 7, 52, 1, haze);
    }

    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 4; i++) {
      const x = vx + 26 + ((i * 117 + time * 3) % Math.max(1, vw - 52));
      const y = vy + vh - 60 - i * 36 + Math.sin(time * 0.18 + i) * 4;
      fillRect(ctx, x, y, 4, 4, '#d4be7a55');
      fillRect(ctx, x - 6, y + 6, 16, 2, '#ffffff18');
      fillRect(ctx, x + 2, y + 8, 1, 8, '#ffffff18');
    }

    ctx.globalAlpha = 0.2;
    fillRect(ctx, vx, vy, 2, vh, '#d4be7a22');
    fillRect(ctx, vx + vw - 2, vy, 2, vh, '#d4be7a18');
    ctx.restore();
  }

  _drawBiomeBackdropDetails(ctx, def = {}) {
    const biome = def.biomeId || '';
    const time = this._timeSec || 0;
    const v = { x: viewportX(), y: viewportY(), w: viewportW(), h: viewportH() };
    drawBiomeDecorations(ctx, v, biome, time);
  }

  // --- viewport scaling ----------------------------------------------
  _fitToViewport() {
    syncLayoutFromWindow(this.canvas);
    const vw = window.visualViewport?.width || window.innerWidth;
    const vh = window.visualViewport?.height || window.innerHeight;
    const scale = Math.min(vw / Layout.canvasW, vh / Layout.canvasH);
    this.canvas.style.width  = `${Math.floor(Layout.canvasW * scale)}px`;
    this.canvas.style.height = `${Math.floor(Layout.canvasH * scale)}px`;
  }
}

function clampMove(delta, max) {
  if (delta > max) return max;
  if (delta < -max) return -max;
  return delta;
}
