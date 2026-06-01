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
  Layout, prefersLeanCombatFx, syncLayoutFromWindow, viewportX, viewportY, viewportW, viewportH
} from '../config/layoutMetrics.js';
import { fillRect, strokeRect } from './SpriteRegistry.js';
import { drawBiomeWallCached, drawBiomeFloorCached, hasBiome } from './biomeTiles.js';
import { getAbyssPalette, drawBiomeDecorations } from './biomeBackdrop.js';
import { HAZARDS } from '../gameplay/hazards.js';
import { drawVectorNPC } from './npcArtVector.jsx';
import { drawVectorDecor, drawVectorFixture } from './furnishingArtVector.jsx';
import { drawVectorTrap } from './dungeonTrapsVector.jsx';
import { drawVectorChest } from './dungeonChestsVector.jsx';
import { drawVectorStairsDown } from './dungeonStairsVector.jsx';
import { drawVectorDecorX } from './dungeonDecorExtVector.jsx';
import { perfMeter } from '../debug/PerfMeter.js';

const REMOVED_ROOM_DECOR = new Set(['weapon_rack', 'alcove_urn', 'hanging_cage']);

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
    this._leanCombatFx = prefersLeanCombatFx();
    this._tileBaseCache = null;
    this._entitySortCache = null;
    this._backdropCache = null;
    this._floorLayerCache = null;
    this._screenLayerCaches = new Map();

    this._resizeBound = this._fitToViewport.bind(this);
    window.addEventListener('resize', this._resizeBound);
    window.visualViewport?.addEventListener('resize', this._resizeBound);
    this._fitToViewport();

    // Game-feel: trigger camera shake on damage automatically.
    this.bus.on('entity:damaged', ({ amount, isCrit, entity }) => {
      if (!entity) return;
      const base = this._leanCombatFx
        ? (entity.kind === 'player' ? 3.5 : 1.5)
        : (entity.kind === 'player' ? 6 : 3);
      const px = Math.min(this._leanCombatFx ? 7 : 14, base + amount * (this._leanCombatFx ? 0.18 : 0.35));
      const duration = this._leanCombatFx && !isCrit
        ? Math.round(TIMING.cameraShakeShort * 0.55)
        : (isCrit ? TIMING.cameraShakeLong : TIMING.cameraShakeShort);
      this.cameraShake.trigger(px, duration);
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
      const cap = this._leanCombatFx ? 6 : 16;
      if (this._attackFlashes.length > cap) this._attackFlashes.shift();
    });
  }

  destroy() {
    window.removeEventListener('resize', this._resizeBound);
    window.visualViewport?.removeEventListener('resize', this._resizeBound);
  }

  invalidateFloorCache() {
    this._tileBaseCache = null;
    this._backdropCache = null;
    this._floorLayerCache = null;
    this._screenLayerCaches?.clear();
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

    perfMeter.measure('fxUpdate', () => {
      this.cameraShake.update(dt);
      this.particles.update(dt);
      this._attackFlashes = this._attackFlashes.filter((f) => now - f.startedAt < f.duration);
    });
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
    perfMeter.measure('world', () => sceneManager.render(this));
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewportX(), viewportY(), viewportW(), viewportH());
    ctx.clip();
    perfMeter.measure('particles', () => this.particles.render(ctx, this._camera));
    ctx.restore();
    ctx.restore();

    // UI pass — fixed screen space (HUD + D-pad never shaken or clipped).
    this.beginScreenSpace();
    perfMeter.measure('ui', () => sceneManager.renderUI(this));
    // Top-most overlay (achievement toasts) — sits above every scene UI.
    if (typeof this.overlayRender === 'function') {
      try { this.overlayRender(this); } catch (err) { console.warn('[overlayRender]', err); }
    }
    perfMeter.render(this.ctx, Layout);
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

  drawCachedScreenLayer(key, paint) {
    if (!this._leanCombatFx || typeof paint !== 'function') {
      paint();
      return;
    }
    const w = Layout.canvasW;
    const h = Layout.canvasH;
    let cache = this._screenLayerCaches.get(key);
    if (!cache || cache.canvas.width !== w || cache.canvas.height !== h) {
      const canvas = (typeof document !== 'undefined')
        ? document.createElement('canvas')
        : new OffscreenCanvas(w, h);
      canvas.width = w;
      canvas.height = h;
      const cctx = canvas.getContext('2d', { alpha: true });
      cctx.setTransform(1, 0, 0, 1, 0, 0);
      cctx.clearRect(0, 0, w, h);
      const mainCtx = this.ctx;
      this.ctx = cctx;
      try {
        paint();
      } finally {
        this.ctx = mainCtx;
      }
      cache = { canvas };
      this._screenLayerCaches.set(key, cache);
      if (this._screenLayerCaches.size > 8) {
        const firstKey = this._screenLayerCaches.keys().next().value;
        this._screenLayerCaches.delete(firstKey);
      }
    }
    this._screenLayerCaches.delete(key);
    this._screenLayerCaches.set(key, cache);
    this.ctx.drawImage(cache.canvas, 0, 0);
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
    const vx = viewportX();
    const vy = viewportY();
    const vw = viewportW();
    const vh = viewportH();
    const x0 = Math.max(0, Math.floor((vx - cam.x) / TILE_SIZE));
    const y0 = Math.max(0, Math.floor((vy - cam.y) / TILE_SIZE));
    const x1 = Math.min(floor.width - 1,
      Math.ceil((vx + vw - cam.x) / TILE_SIZE));
    const y1 = Math.min(floor.height - 1,
      Math.ceil((vy + vh - cam.y) / TILE_SIZE));

    if (this._leanCombatFx) {
      const def = floor.definition || {};
      const timeBucket = Math.floor((this._timeSec || 0) * 4);
      const key = [
        floor.seed, floor.index, floor.renderRevision || 0,
        vx, vy, vw, vh, cam.x, cam.y, x0, y0, x1, y1,
        player?.x ?? '', player?.y ?? '', player?.torchRadius ?? '',
        def.biomeId || '', def.type || '', timeBucket
      ].join('|');
      let cache = this._floorLayerCache;
      if (!cache || cache.floor !== floor || cache.key !== key
          || cache.canvas.width !== vw || cache.canvas.height !== vh) {
        const canvas = (typeof document !== 'undefined')
          ? document.createElement('canvas')
          : new OffscreenCanvas(vw, vh);
        canvas.width = vw;
        canvas.height = vh;
        const cctx = canvas.getContext('2d', { alpha: true });
        cctx.imageSmoothingEnabled = true;
        cctx.translate(-vx, -vy);
        perfMeter.measure('floorLayer', () => {
          this._paintFloorViewport(cctx, floor, player, x0, y0, x1, y1);
        });
        cache = { floor, key, canvas };
        this._floorLayerCache = cache;
      }
      ctx.drawImage(cache.canvas, vx, vy);
      return;
    }

    this._paintFloorViewport(ctx, floor, player, x0, y0, x1, y1);
  }

  _paintFloorViewport(ctx, floor, player, x0, y0, x1, y1) {
    const cam = this._camera;
    ctx.save();
    // Clip to viewport rect so world pixels can never spill into HUD or
    // control band areas. Then translate by camera offset.
    const vx = viewportX();
    const vy = viewportY();
    const vw = viewportW();
    const vh = viewportH();
    ctx.beginPath();
    ctx.rect(vx, vy, vw, vh);
    ctx.clip();
    this._drawCachedViewportBackdrop(ctx, floor.definition || {});
    ctx.translate(cam.x, cam.y);

    this._drawCachedTileBase(ctx, floor, x0, y0, x1, y1);

    // Revealed traps (drawn over floor, under entities/motif).
    this._drawDynamicStairs(ctx, floor, x0, y0, x1, y1);
    this._drawHazards(ctx, floor, x0, y0, x1, y1);
    this._drawRoomDecor(ctx, floor, x0, y0, x1, y1);
    this._drawFloorInteracts(ctx, floor, x0, y0, x1, y1);
    this._drawAmbientZones(ctx, floor, x0, y0, x1, y1);

    // Special floor centerpiece (REST campfire / VAULT chest motif).
    this._drawSpecialFloorMotif(ctx, floor);

    if (player) {
      this._drawTorchGlow(ctx, floor, player, x0, y0, x1, y1);
    }
    ctx.restore();
  }

  _drawCachedTileBase(ctx, floor, x0, y0, x1, y1) {
    const sx = x0 * TILE_SIZE;
    const sy = y0 * TILE_SIZE;
    const width = (x1 - x0 + 1) * TILE_SIZE;
    const height = (y1 - y0 + 1) * TILE_SIZE;
    const def = floor.definition || {};
    const key = [
      floor.seed, floor.index, floor.renderRevision || 0,
      x0, y0, x1, y1,
      def.biomeId || '', (def.wallPalette || []).join(','),
      (def.floorPalette || []).join(',')
    ].join('|');
    let cache = this._tileBaseCache;
    if (!cache || cache.floor !== floor || cache.key !== key
        || cache.canvas.width !== width || cache.canvas.height !== height) {
      const canvas = (typeof document !== 'undefined')
        ? document.createElement('canvas')
        : new OffscreenCanvas(width, height);
      canvas.width = width;
      canvas.height = height;
      const cctx = canvas.getContext('2d', { alpha: true });
      cctx.imageSmoothingEnabled = true;
      cctx.translate(-sx, -sy);
      perfMeter.measure('tileCache', () => this._paintTileBase(cctx, floor, x0, y0, x1, y1));
      cache = { floor, key, canvas };
      this._tileBaseCache = cache;
    }
    ctx.drawImage(cache.canvas, sx, sy);
  }

  _paintTileBase(ctx, floor, x0, y0, x1, y1) {
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
    const biomeId = tileOpts.biomeId;
    const useBiome = !!biomeId && hasBiome(biomeId);

    fillRect(ctx, x0 * TILE_SIZE, y0 * TILE_SIZE,
      (x1 - x0 + 1) * TILE_SIZE, (y1 - y0 + 1) * TILE_SIZE, '#05040a');

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
          case TILE.FLOOR:
            if (useBiome) drawBiomeFloorCached(ctx, tx, ty, TILE_SIZE, x, y, biomeId, Layout.dpr);
            else this.sprites.draw('tile_floor', ctx, tx, ty, opts);
            break;
          case TILE.STAIRS_DOWN:
            if (useBiome) drawBiomeFloorCached(ctx, tx, ty, TILE_SIZE, x, y, biomeId, Layout.dpr);
            break;
          case TILE.STAIRS_UP:
            if (useBiome) drawBiomeFloorCached(ctx, tx, ty, TILE_SIZE, x, y, biomeId, Layout.dpr);
            this.sprites.draw('tile_stairs_up', ctx, tx, ty, opts);
            break;
          case TILE.DOOR:
            if (useBiome) drawBiomeFloorCached(ctx, tx, ty, TILE_SIZE, x, y, biomeId, Layout.dpr);
            this.sprites.draw('tile_door', ctx, tx, ty, opts);
            break;
          default: break;
        }
        if (dim) Renderer._applyFog(ctx, tx, ty);
      }
    }

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
        if (useBiome) drawBiomeWallCached(ctx, tx, ty, TILE_SIZE, x, y, biomeId, Layout.dpr);
        else this.sprites.draw('tile_wall', ctx, tx, ty, opts);
        if (dim) Renderer._applyFog(ctx, tx, ty);
      }
    }
  }

  _drawDynamicStairs(ctx, floor, x0, y0, x1, y1) {
    const def = floor.definition || {};
    const down = floor.stairsDown;
    if (!down || down.x < x0 || down.x > x1 || down.y < y0 || down.y > y1) return;
    const t = floor.tileAt(down.x, down.y);
    if (!t?.explored) return;
    this._drawStairsDownFixture(ctx, down.x * TILE_SIZE + TILE_SIZE / 2,
      down.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE, this._timeSec || 0, def);
    if (!t.visible) Renderer._applyFog(ctx, down.x * TILE_SIZE, down.y * TILE_SIZE);
  }

  /**
   * Decorative centerpiece for special floor types. Drawn in world space
   * (inside the camera-translated viewport). Pure cosmetics — gameplay is
   * already differentiated by enemy/item spawn rules.
   */
  _drawSpecialFloorMotif(ctx, floor) {
    const def = floor.definition || {};
    if (def.type !== 'rest' && def.type !== 'vault' && def.type !== 'forge') return;
    const t = this._timeSec || 0;
    // Forge centerpiece sits on its solid anvil tile (revealed once explored);
    // rest/vault motifs stay on the entry tile.
    let anchor = floor.stairsUp;
    if (def.type === 'forge' && floor.forgeAnvil) {
      const at = floor.tileAt?.(floor.forgeAnvil.x, floor.forgeAnvil.y);
      if (!at || !at.explored) return;
      anchor = floor.forgeAnvil;
    }
    if (!anchor) return;
    const cx = anchor.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = anchor.y * TILE_SIZE + TILE_SIZE / 2;

    if (def.type === 'rest' || def.type === 'forge') {
      if (def.type === 'forge') {
        this._drawForgeFixture(ctx, cx, cy, TILE_SIZE, t, def);
        return;
      }
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
      if (drawVectorChest(ctx, cx - TILE_SIZE * 0.62, cy - TILE_SIZE * 0.62, TILE_SIZE * 1.24, 'runed', false)) return;
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

    const list = this._sortedEntities(floor);
    perfMeter.measure('attackFx', () => this._drawAttackFlashes(ctx, cam));
    perfMeter.measure('entities', () => {
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
      if (e.elite) this._drawEliteMarker(ctx, e, px, py);
      this.sprites.draw(key, ctx, px, py, { entity: e, time: this._timeSec || 0 });
      this._drawEntityHitFlash(ctx, e, px, py);

      if (e.kind === 'enemy' && e.stats.hp < e.stats.hpMax) {
        const pct = e.stats.hp / e.stats.hpMax;
        const w = TILE_SIZE - 6;
        const barH = e.defId?.startsWith('boss_') ? 5 : 4;
        const barY = py - (barH + 2);
        const barColor = e.defId?.startsWith('boss_') ? '#d4be7a'
          : e.defId?.startsWith('subboss_') ? '#c080ff'
          : e.elite ? (e.elite.color || '#ffaa44') : COLOR.hpBar;
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
    });
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
        if (this._leanCombatFx && !f.isCrit) {
          ctx.restore();
          continue;
        }
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
    const elite = isBoss || isSub || !!entity.elite;
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

  _drawCachedViewportBackdrop(ctx, def = {}) {
    if (!this._leanCombatFx) {
      this._drawViewportAbyss(ctx, def);
      this._drawBiomeBackdropDetails(ctx, def);
      return;
    }
    const vx = viewportX();
    const vy = viewportY();
    const vw = viewportW();
    const vh = viewportH();
    const timeBucket = Math.floor((this._timeSec || 0) * 4);
    const key = [
      def.biomeId || '', vx, vy, vw, vh,
      timeBucket,
      getAbyssPalette(def.biomeId || '').top
    ].join('|');
    let cache = this._backdropCache;
    if (!cache || cache.key !== key || cache.canvas.width !== vw || cache.canvas.height !== vh) {
      const canvas = (typeof document !== 'undefined')
        ? document.createElement('canvas')
        : new OffscreenCanvas(vw, vh);
      canvas.width = vw;
      canvas.height = vh;
      const cctx = canvas.getContext('2d', { alpha: true });
      cctx.translate(-vx, -vy);
      this._drawViewportAbyss(cctx, def);
      this._drawBiomeBackdropDetails(cctx, def);
      cache = { key, canvas };
      this._backdropCache = cache;
    }
    ctx.drawImage(cache.canvas, vx, vy);
  }

  _drawRoomDecor(ctx, floor, x0, y0, x1, y1) {
    let drawn = 0;
    const maxLeanDecor = 14;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const tile = floor.tiles[y][x];
        const decor = tile?.decor;
        if (!decor || !tile.explored || decor.kind === 'gargoyle') continue;
        if (REMOVED_ROOM_DECOR.has(decor.kind)) continue;
        if (this._leanCombatFx && !tile.visible) continue;
        if (this._leanCombatFx && drawn >= maxLeanDecor) return;
        ctx.save();
        ctx.globalAlpha = tile.visible ? 0.95 : 0.38;
        this._drawDecorSprite(ctx, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE, decor.kind, this._timeSec || 0, floor.definition || {});
        ctx.restore();
        drawn++;
      }
    }
  }

  _sortedEntities(floor) {
    const rev = floor.entityRevision || 0;
    const cache = this._entitySortCache;
    if (cache && cache.floor === floor && cache.rev === rev) return cache.list;
    const list = Array.from(floor.entities.values()).sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
    this._entitySortCache = { floor, rev, list };
    return list;
  }

  _drawDecorSprite(ctx, cx, cy, s, kind, t, def = {}) {
    if (drawVectorDecorX(ctx, cx - s / 2, cy - s / 2, s, kind, def)) return;
    if (drawVectorDecor(ctx, cx - s / 2, cy - s / 2, s, kind, def)) return;
    const u = s / 32;
    const px = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(cx + a * u, cy + b * u, w * u, h * u); };
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 5 * u;
    if (kind === 'wall_torch') {
      this._drawTinyFlame(ctx, cx, cy - 4 * u, u, t, '#ffd98a');
      px(-2, 0, 4, 7, '#2b2630'); px(-3, 7, 6, 2, '#5b5668');
    } else if (kind === 'brazier') {
      px(-7, 5, 14, 4, '#2b2630'); px(-5, 2, 10, 3, '#6a3a22');
      this._drawTinyFlame(ctx, cx, cy + 2 * u, u, t, '#ffb45c');
    } else if (kind === 'banner') {
      px(-1, -10, 2, 3, '#6a6474'); px(-7, -7, 14, 13, '#35465e');
      ctx.fillStyle = '#7fa6d9';
      ctx.beginPath(); ctx.moveTo(cx - 5 * u, cy - 4 * u); ctx.lineTo(cx, cy - 8 * u); ctx.lineTo(cx + 5 * u, cy - 4 * u); ctx.lineTo(cx, cy - 2 * u); ctx.closePath(); ctx.fill();
      px(-1, 2, 2, 2, '#89a8d0');
    } else if (kind === 'bone_pile') {
      ctx.strokeStyle = '#c9b37e'; ctx.lineWidth = 2 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 8 * u, cy + 5 * u); ctx.lineTo(cx + 8 * u, cy - 3 * u); ctx.moveTo(cx - 7 * u, cy - 4 * u); ctx.lineTo(cx + 7 * u, cy + 5 * u); ctx.stroke();
      ctx.fillStyle = '#d8c896'; ctx.beginPath(); ctx.arc(cx - 2 * u, cy - 7 * u, 4 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#09070d'; ctx.fillRect(cx - 4 * u, cy - 8 * u, 1.4 * u, 1.7 * u); ctx.fillRect(cx + 1.5 * u, cy - 8 * u, 1.4 * u, 1.7 * u);
    } else if (kind === 'broken_pillar') {
      px(-5, -6, 10, 17, '#45414e'); px(-7, 10, 14, 3, '#2a2730');
      ctx.fillStyle = '#6b6574'; ctx.beginPath(); ctx.moveTo(cx - 5 * u, cy - 7 * u); ctx.lineTo(cx + 2 * u, cy - 11 * u); ctx.lineTo(cx + 6 * u, cy - 6 * u); ctx.closePath(); ctx.fill();
    } else if (kind === 'wall_chains') {
      ctx.strokeStyle = '#6f6a78'; ctx.lineWidth = 2 * u;
      for (const ox of [-5, 5]) {
        ctx.beginPath();
        for (let i = 0; i < 4; i++) ctx.ellipse(cx + ox * u, cy + (-8 + i * 5) * u, 2 * u, 3 * u, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (kind === 'gargoyle') {
      px(-6, -5, 12, 12, '#3f3b48');
      ctx.fillStyle = '#2e2a36'; ctx.beginPath(); ctx.moveTo(cx - 6 * u, cy - 5 * u); ctx.lineTo(cx - 9 * u, cy - 10 * u); ctx.lineTo(cx - 2 * u, cy - 5 * u); ctx.moveTo(cx + 6 * u, cy - 5 * u); ctx.lineTo(cx + 9 * u, cy - 10 * u); ctx.lineTo(cx + 2 * u, cy - 5 * u); ctx.fill();
      px(-3, -1, 2, 2, '#69a2d8'); px(2, -1, 2, 2, '#69a2d8'); px(-2, 5, 4, 2, '#e2d19a');
    } else if (kind === 'rune_crack') {
      ctx.strokeStyle = '#58a7ff'; ctx.lineWidth = 1.5 * u; ctx.shadowColor = '#58a7ff'; ctx.shadowBlur = 6 * u;
      ctx.beginPath(); ctx.moveTo(cx - 4 * u, cy - 11 * u); ctx.lineTo(cx - 1 * u, cy - 3 * u); ctx.lineTo(cx - 5 * u, cy + 3 * u); ctx.lineTo(cx + 2 * u, cy + 11 * u); ctx.stroke();
      px(5, -4, 2, 2, '#6bc0ff'); px(4, 5, 2, 2, '#6bc0ff');
    } else {
      ctx.strokeStyle = '#8c8796'; ctx.lineWidth = 1 * u; ctx.globalAlpha *= 0.75;
      ctx.beginPath(); ctx.moveTo(cx - 10 * u, cy - 8 * u); ctx.quadraticCurveTo(cx + 1 * u, cy - 10 * u, cx + 9 * u, cy - 1 * u);
      ctx.moveTo(cx - 10 * u, cy - 8 * u); ctx.lineTo(cx + 6 * u, cy + 8 * u);
      ctx.moveTo(cx - 6 * u, cy - 9 * u); ctx.lineTo(cx - 2 * u, cy + 6 * u);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawTinyFlame(ctx, cx, cy, u, t, core = '#ffd070') {
    const f = 0.9 + Math.sin(t * 6.4 + cx * 0.01) * 0.12;
    ctx.fillStyle = '#ff7040';
    ctx.beginPath(); ctx.moveTo(cx, cy - 8 * u * f); ctx.quadraticCurveTo(cx + 5 * u, cy - 2 * u, cx + 2 * u, cy + 5 * u); ctx.lineTo(cx - 2 * u, cy + 5 * u); ctx.quadraticCurveTo(cx - 5 * u, cy - 2 * u, cx, cy - 8 * u * f); ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.moveTo(cx, cy - 4.5 * u * f); ctx.quadraticCurveTo(cx + 2 * u, cy, cx + 1 * u, cy + 4 * u); ctx.lineTo(cx - 1 * u, cy + 4 * u); ctx.quadraticCurveTo(cx - 2 * u, cy, cx, cy - 4.5 * u * f); ctx.fill();
  }

  _drawStairsDownFixture(ctx, cx, cy, s, t, def = {}) {
    if (drawVectorStairsDown(ctx, cx - s / 2, cy - s / 2, s, def)) return;
    if (drawVectorFixture(ctx, cx - s / 2, cy - s / 2, s, 'stair_down', def)) return;
    const u = s / 32;
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy - 4 * u, 2 * u, cx, cy, 23 * u);
    g.addColorStop(0, 'rgba(236,210,140,0.18)');
    g.addColorStop(1, 'rgba(236,210,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 24 * u, cy - 24 * u, 48 * u, 48 * u);
    ctx.fillStyle = '#24212b';
    ctx.beginPath(); ctx.moveTo(cx - 13 * u, cy - 16 * u); ctx.lineTo(cx + 13 * u, cy - 16 * u); ctx.lineTo(cx + 10 * u, cy + 13 * u); ctx.lineTo(cx - 10 * u, cy + 13 * u); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#08070c'; ctx.fillRect(cx - 8 * u, cy + 2 * u, 16 * u, 9 * u);
    ctx.fillStyle = '#292530'; ctx.fillRect(cx - 12 * u, cy - 10 * u, 24 * u, 4 * u); ctx.fillRect(cx - 9 * u, cy - 2 * u, 18 * u, 4 * u);
    ctx.strokeStyle = '#6ca9ed'; ctx.lineWidth = 2 * u; ctx.strokeRect(cx - 8 * u, cy + 2 * u, 16 * u, 9 * u);
    for (const ox of [-12, 12]) {
      ctx.fillStyle = '#3b2b21'; ctx.fillRect(cx + ox * u - 1.5 * u, cy - 9 * u, 3 * u, 18 * u);
      this._drawTinyFlame(ctx, cx + ox * u, cy - 10 * u, u * 0.72, t, '#fff1c6');
    }
    ctx.restore();
  }

  _drawForgeFixture(ctx, cx, cy, s, t, def = {}) {
    if (drawVectorFixture(ctx, cx - s / 2, cy - s / 2, s, 'forge', def)) return;
    const u = s / 32;
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, 2 * u, cx, cy, 28 * u);
    glow.addColorStop(0, 'rgba(255,146,65,0.34)');
    glow.addColorStop(1, 'rgba(255,146,65,0)');
    ctx.fillStyle = glow; ctx.fillRect(cx - 30 * u, cy - 26 * u, 60 * u, 54 * u);
    ctx.fillStyle = '#4b2b23'; ctx.fillRect(cx - 14 * u, cy - 4 * u, 28 * u, 13 * u);
    ctx.fillStyle = '#7a4630'; ctx.fillRect(cx - 12 * u, cy + 1 * u, 24 * u, 5 * u);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#f0b864' : '#e36f2d';
      ctx.beginPath(); ctx.arc(cx + (-9 + i * 4.5) * u, cy + 3.5 * u, 2 * u, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#4d4b54'; ctx.fillRect(cx - 9 * u, cy - 15 * u, 18 * u, 6 * u);
    ctx.fillStyle = '#b8b1a8'; ctx.fillRect(cx - 12 * u, cy - 17 * u, 24 * u, 3 * u);
    ctx.fillStyle = '#5f5962'; ctx.fillRect(cx - 4 * u, cy - 13 * u, 8 * u, 7 * u);
    ctx.save(); ctx.translate(cx + 13 * u, cy - 8 * u); ctx.rotate(0.18); ctx.fillStyle = '#5b3926'; ctx.fillRect(-1.5 * u, -8 * u, 3 * u, 19 * u); ctx.restore();
    ctx.fillStyle = '#ffd783';
    for (let i = 0; i < 4; i++) {
      const phase = (t * (1.2 + i * 0.2) + i) % 2;
      ctx.globalAlpha = 1 - phase / 2;
      ctx.fillRect(cx + (-8 + i * 5) * u, cy - (19 + phase * 10) * u, 1.4 * u, 1.4 * u);
    }
    ctx.restore();
  }

  /** Hand-drawn structures for shrine / merchant / altar / chest interactables. */
  _drawFloorInteracts(ctx, floor, x0, y0, x1, y1) {
    const glowCol = {
      shrine: '#c8a0ff', merchant: '#ffd98a', keeper: '#72d7ff', rest_alcove: '#80c0ff',
      mystery_chest: '#ffcc66', altar_sacrifice: '#ff6655', lore_omen: '#a0d0e0'
    };
    const t = this._timeSec || 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const tile = floor.tiles[y][x];
        const ix = tile?.interact;
        if (!ix || ix.used || !tile.explored) continue;
        // Forge anvil is drawn by the special-floor motif (flame + glow).
        if (ix.kind === 'forge') continue;
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;
        const s = TILE_SIZE;
        ctx.save();
        ctx.globalAlpha = tile.visible ? 1 : 0.5;

        // Soft floor glow marks every interactable as usable.
        const col = glowCol[ix.kind] || '#d4ac6c';
        const pulse = 0.5 + Math.sin(t * 2.6 + x * 0.7) * 0.16;
        const g = ctx.createRadialGradient(cx, cy + s * 0.28, 1, cx, cy + s * 0.28, s * 0.7);
        g.addColorStop(0, this._hexA(col, 0.34 * pulse + 0.12));
        g.addColorStop(1, this._hexA(col, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - s * 0.75, cy - s * 0.5, s * 1.5, s);

        switch (ix.kind) {
          case 'merchant':       this._drawMerchantSprite(ctx, cx, cy, s, t); break;
          case 'keeper':         this._drawKeeperSprite(ctx, cx, cy, s, t); break;
          case 'shrine':         this._drawShrineSprite(ctx, cx, cy, s, t, floor.definition || {}); break;
          case 'altar_sacrifice':this._drawAltarSprite(ctx, cx, cy, s, t); break;
          case 'mystery_chest':  this._drawChestSprite(ctx, cx, cy, s); break;
          case 'rest_alcove':    this._drawRestSprite(ctx, cx, cy, s, t); break;
          default:               this._drawLoreSprite(ctx, cx, cy, s, t); break;
        }
        ctx.restore();
      }
    }
  }

  /** "#rrggbb" + alpha → rgba() string. */
  _hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }

  /** Hooded wandering merchant: robe, hood, face, coin-pouch, gold glint. */
  _drawMerchantSprite(ctx, cx, cy, s, t) {
    if (drawVectorNPC(ctx, cx - s / 2, cy - s / 2, s, 'merchant')) return;
    const u = s / 32; // unit scale relative to a 32px tile
    const px = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(cx + a * u, cy + b * u, w * u, h * u); };
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 12 * u, 9 * u, 3 * u, 0, 0, Math.PI * 2); ctx.fill();
    // robe (trapezoid)
    ctx.fillStyle = '#5a3d24';
    ctx.beginPath();
    ctx.moveTo(cx - 4 * u, cy - 4 * u); ctx.lineTo(cx + 4 * u, cy - 4 * u);
    ctx.lineTo(cx + 8 * u, cy + 12 * u); ctx.lineTo(cx - 8 * u, cy + 12 * u);
    ctx.closePath(); ctx.fill();
    px(-7, 4, 2, 8, '#4a3019'); // robe shadow seam (left)
    px(5, 4, 2, 8, '#4a3019');
    // gold-trim hem
    px(-8, 11, 16, 1.5, '#d4ac6c');
    // satchel of coins
    px(-9, 2, 4, 5, '#3a2614'); px(-9, 2, 4, 1.5, '#d4ac6c');
    // hood + shoulders
    ctx.fillStyle = '#3c2817';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14 * u);
    ctx.quadraticCurveTo(cx + 7 * u, cy - 10 * u, cx + 5 * u, cy - 2 * u);
    ctx.lineTo(cx - 5 * u, cy - 2 * u);
    ctx.quadraticCurveTo(cx - 7 * u, cy - 10 * u, cx, cy - 14 * u);
    ctx.fill();
    // shadowed face
    px(-2.5, -9, 5, 4, '#1a120b');
    px(-1.5, -8, 1.2, 1.2, '#ffd070'); // glowing eyes
    px(0.5, -8, 1.2, 1.2, '#ffd070');
    // floating coin glint
    const bob = Math.sin(t * 3) * 1.5;
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.arc(cx + 9 * u, cy - 9 * u + bob * u, 2.2 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a8791f';
    ctx.font = `bold ${Math.max(6, Math.floor(s * 0.2))}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', cx + 9 * u, cy - 9 * u + bob * u + 0.5);
  }

  /** Kindly tutorial guide: lantern, ledger, soft blue title-bob silhouette. */
  _drawKeeperSprite(ctx, cx, cy, s, t) {
    if (drawVectorNPC(ctx, cx - s / 2, cy - s / 2, s, 'keeper')) return;
    const u = s / 32;
    const x = (v) => cx + (v - 16) * u;
    const y = (v) => cy + (v - 16) * u;
    const rect = (rx, ry, rw, rh, fill) => {
      ctx.fillStyle = fill;
      ctx.fillRect(x(rx), y(ry), rw * u, rh * u);
    };
    const strokePath = (fill = null, stroke = '#08070c', lw = 0.6) => {
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw * u;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    };
    const bob = Math.sin(t * 2.2) * 0.9 * u;
    const soul = '#7fe8ff';
    const robe = '#36506a';
    const robeLo = '#243a50';
    const robeHi = '#4e7090';
    const skin = '#caa884';
    const gilt = '#d4be7a';

    ctx.save();
    ctx.translate(0, bob);

    // Ground shadow from the handoff SVG.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x(16), y(30.2), 9 * u, 2 * u, 0, 0, Math.PI * 2); ctx.fill();

    // Staff + raised lantern behind the body.
    rect(6.8, 6, 1.5, 22, '#3a2818');
    ctx.strokeStyle = '#08070c'; ctx.lineWidth = 0.4 * u; ctx.strokeRect(x(6.8), y(6), 1.5 * u, 22 * u);
    rect(5.4, 4.6, 3.2, 1.4, '#2a2a32');
    ctx.strokeRect(x(5.4), y(4.6), 3.2 * u, 1.4 * u);
    const lanternGlow = ctx.createRadialGradient(x(7), y(9), 1 * u, x(7), y(9), 7.5 * u);
    lanternGlow.addColorStop(0, `rgba(127,232,255,${0.18 + Math.sin(t * 3.1) * 0.04})`);
    lanternGlow.addColorStop(1, 'rgba(127,232,255,0)');
    ctx.fillStyle = lanternGlow; ctx.fillRect(x(0), y(2), 16 * u, 16 * u);
    ctx.beginPath();
    ctx.roundRect(x(4.8), y(6), 4.4 * u, 6 * u, 0.6 * u);
    strokePath('#2a2a32', '#08070c', 0.5);
    rect(5.6, 6.8, 2.8, 4.4, soul);
    rect(6.4, 7.4, 1.2, 3.2, '#eafcff');
    rect(4.8, 11.6, 4.4, 1, '#3a3a44');

    // Robe body, mantle, sash.
    ctx.beginPath();
    ctx.moveTo(x(11.5), y(14)); ctx.lineTo(x(20.5), y(14));
    ctx.lineTo(x(23), y(30)); ctx.lineTo(x(9.5), y(30));
    ctx.closePath(); strokePath(robe);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x(11.5), y(14)); ctx.lineTo(x(16), y(14)); ctx.lineTo(x(16), y(30)); ctx.lineTo(x(9.5), y(30));
    ctx.closePath(); ctx.fillStyle = robeLo; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = robeHi; ctx.lineWidth = 0.5 * u; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.moveTo(x(18), y(15)); ctx.lineTo(x(20), y(29)); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(x(10.5), y(14));
    ctx.quadraticCurveTo(x(16), y(11.5), x(21.5), y(14));
    ctx.lineTo(x(20), y(18));
    ctx.quadraticCurveTo(x(16), y(16), x(12), y(18));
    ctx.closePath(); strokePath(robeHi);
    rect(10, 27.4, 13.5, 1.6, 'rgba(212,190,122,0.6)');
    ctx.strokeStyle = gilt; ctx.lineWidth = 1.2 * u; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(x(11), y(16)); ctx.lineTo(x(21), y(19)); ctx.stroke(); ctx.globalAlpha = 1;

    // Arms and ledger.
    ctx.beginPath();
    ctx.moveTo(x(11.5), y(15)); ctx.lineTo(x(7.8), y(9)); ctx.lineTo(x(9.6), y(8)); ctx.lineTo(x(13), y(14));
    ctx.closePath(); strokePath(robe);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(x(8.4), y(8.6), 1.4 * u, 1.3 * u, 0, 0, Math.PI * 2); strokePath(skin, '#08070c', 0.4);
    ctx.beginPath();
    ctx.moveTo(x(20.5), y(15)); ctx.lineTo(x(24), y(20)); ctx.lineTo(x(22), y(22)); ctx.lineTo(x(18.5), y(17));
    ctx.closePath(); strokePath(robe);
    ctx.beginPath();
    ctx.moveTo(x(20), y(20)); ctx.lineTo(x(27), y(19)); ctx.lineTo(x(27), y(24)); ctx.lineTo(x(20), y(25));
    ctx.closePath(); strokePath('#c8bda0', '#08070c', 0.4);
    ctx.strokeStyle = '#9a8e6c'; ctx.lineWidth = 0.5 * u;
    ctx.beginPath(); ctx.moveTo(x(23.5), y(19.4)); ctx.lineTo(x(23.5), y(24.4)); ctx.stroke();
    ctx.strokeStyle = '#7a6e54'; ctx.lineWidth = 0.3 * u;
    for (const yy of [21, 22.2, 23.4]) { ctx.beginPath(); ctx.moveTo(x(21), y(yy)); ctx.lineTo(x(26), y(yy - 0.7)); ctx.stroke(); }

    // Hood down, face, beard.
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(x(16), y(9.5), 4.4 * u, 4.8 * u, 0, 0, Math.PI * 2); strokePath(skin);
    ctx.beginPath();
    ctx.moveTo(x(11.5), y(9));
    ctx.quadraticCurveTo(x(11), y(4), x(16), y(4));
    ctx.quadraticCurveTo(x(21), y(4), x(20.5), y(9));
    ctx.quadraticCurveTo(x(18), y(6.5), x(16), y(6.8));
    ctx.quadraticCurveTo(x(14), y(6.5), x(11.5), y(9));
    strokePath('#8a8e98', '#08070c', 0.5);
    ctx.beginPath(); ctx.moveTo(x(11), y(11)); ctx.quadraticCurveTo(x(9.5), y(15), x(12), y(16)); ctx.lineTo(x(12), y(13)); ctx.closePath(); strokePath(robeLo, '#08070c', 0.5);
    ctx.beginPath(); ctx.moveTo(x(21), y(11)); ctx.quadraticCurveTo(x(22.5), y(15), x(20), y(16)); ctx.lineTo(x(20), y(13)); ctx.closePath(); strokePath(robeLo, '#08070c', 0.5);

    const eye = (ex, ey) => {
      ctx.fillStyle = '#3a2a4a';
      ctx.beginPath(); ctx.arc(x(ex), y(ey), 0.85 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(x(ex - 0.2), y(ey - 0.2), 0.34 * u, 0, Math.PI * 2); ctx.fill();
    };
    eye(14.3, 9.4); eye(17.7, 9.4);
    ctx.strokeStyle = '#6a6056'; ctx.lineWidth = 0.4 * u;
    ctx.beginPath(); ctx.moveTo(x(12.6), y(8)); ctx.quadraticCurveTo(x(14.3), y(7.2), x(15.6), y(8)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x(16.4), y(8)); ctx.quadraticCurveTo(x(17.7), y(7.2), x(19.4), y(8)); ctx.stroke();
    ctx.strokeStyle = '#8a5a4a'; ctx.lineWidth = 0.5 * u;
    ctx.beginPath(); ctx.moveTo(x(14), y(12)); ctx.quadraticCurveTo(x(16), y(13.4), x(18), y(12)); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x(12.6), y(11.5));
    ctx.quadraticCurveTo(x(16), y(16.5), x(19.4), y(11.5));
    ctx.quadraticCurveTo(x(18), y(14), x(16), y(14));
    ctx.quadraticCurveTo(x(14), y(14), x(12.6), y(11.5));
    strokePath('#9a9ea8', '#08070c', 0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.ellipse(x(13.8), y(7.2), 1.5 * u, 1 * u, 0, 0, Math.PI * 2); ctx.fill();

    // Guiding wisp, same "follow me" cue from the handoff.
    const wx = 24 + Math.sin(t * 1.55) * 1.5;
    const wy = 9.8 + Math.cos(t * 1.55) * 1.3;
    const wg = ctx.createRadialGradient(x(wx), y(wy), 0.2 * u, x(wx), y(wy), 4 * u);
    wg.addColorStop(0, 'rgba(127,232,255,0.95)');
    wg.addColorStop(1, 'rgba(127,232,255,0)');
    ctx.fillStyle = wg; ctx.fillRect(x(wx - 4), y(wy - 4), 8 * u, 8 * u);
    ctx.fillStyle = soul; ctx.beginPath(); ctx.arc(x(wx), y(wy), 1 * u, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** Stone shrine idol on a pedestal with a pulsing arcane gem. */
  _drawShrineSprite(ctx, cx, cy, s, t, def = {}) {
    if (drawVectorFixture(ctx, cx - s / 2, cy - s / 2, s, 'shrine', def)) return;
    const u = s / 32;
    const px = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(cx + a * u, cy + b * u, w * u, h * u); };
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 12 * u, 9 * u, 3 * u, 0, 0, Math.PI * 2); ctx.fill();
    // tiered pedestal
    px(-9, 9, 18, 4, '#4a4658'); px(-7, 6, 14, 3, '#565268'); px(-5, -3, 10, 9, '#605c74');
    // edge highlights
    px(-9, 9, 18, 1, '#6a6680'); px(-5, -3, 10, 1, '#7a7690');
    // obelisk top
    ctx.fillStyle = '#605c74';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14 * u); ctx.lineTo(cx + 5 * u, cy - 3 * u);
    ctx.lineTo(cx - 5 * u, cy - 3 * u); ctx.closePath(); ctx.fill();
    // glowing gem + halo
    const pulse = 0.6 + Math.sin(t * 3.2) * 0.4;
    const halo = ctx.createRadialGradient(cx, cy - 4 * u, 1, cx, cy - 4 * u, 9 * u);
    halo.addColorStop(0, `rgba(200,160,255,${0.55 * pulse})`);
    halo.addColorStop(1, 'rgba(200,160,255,0)');
    ctx.fillStyle = halo; ctx.fillRect(cx - 10 * u, cy - 14 * u, 20 * u, 20 * u);
    ctx.fillStyle = '#e0c4ff';
    ctx.beginPath(); ctx.arc(cx, cy - 4 * u, 2.4 * u, 0, Math.PI * 2); ctx.fill();
    // carved rune lines
    px(-3, 2, 6, 1, '#8a86a0'); px(-2, 4, 4, 1, '#8a86a0');
  }

  /** Blood altar: stone block, offering bowl, ember-red glow. */
  _drawAltarSprite(ctx, cx, cy, s, t) {
    const u = s / 32;
    const px = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(cx + a * u, cy + b * u, w * u, h * u); };
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 12 * u, 10 * u, 3 * u, 0, 0, Math.PI * 2); ctx.fill();
    // altar block
    px(-9, 0, 18, 12, '#3a3038'); px(-9, 0, 18, 2, '#4c424c'); px(-9, 10, 18, 2, '#241e24');
    // dark stains
    px(-6, 4, 3, 5, '#2a0e12'); px(2, 5, 3, 4, '#2a0e12');
    // bowl + ember
    px(-5, -3, 10, 3, '#2a2228'); px(-4, -4, 8, 1.5, '#4c424c');
    const pulse = 0.6 + Math.sin(t * 4) * 0.4;
    const glow = ctx.createRadialGradient(cx, cy - 4 * u, 1, cx, cy - 4 * u, 8 * u);
    glow.addColorStop(0, `rgba(255,70,50,${0.6 * pulse})`);
    glow.addColorStop(1, 'rgba(255,70,50,0)');
    ctx.fillStyle = glow; ctx.fillRect(cx - 9 * u, cy - 12 * u, 18 * u, 14 * u);
    px(-2.5, -5, 5, 1.5, '#ff5a3a');
  }

  /** Treasure chest (brass-banded). */
  _drawChestSprite(ctx, cx, cy, s) {
    if (drawVectorChest(ctx, cx - s / 2, cy - s / 2, s, 'gold', false)) return;
    const u = s / 32;
    const px = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(cx + a * u, cy + b * u, w * u, h * u); };
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 10 * u, 9 * u, 3 * u, 0, 0, Math.PI * 2); ctx.fill();
    px(-9, -2, 18, 11, '#5a3420'); px(-9, -8, 18, 7, '#6e4228'); // body + lid
    px(-9, -2, 18, 1.5, '#d4ac6c'); px(-9, 6, 18, 1.5, '#b8965a'); // bands
    px(-1.5, -1, 3, 4, '#d4ac6c'); px(-0.6, 0, 1.2, 2, '#3a2614'); // lock
  }

  /** Rest alcove: bedroll + small campfire. */
  _drawRestSprite(ctx, cx, cy, s, t) {
    const u = s / 32;
    ctx.fillStyle = '#3a2418'; ctx.fillRect(cx - 9 * u, cy + 4 * u, 9 * u, 5 * u); // bedroll
    ctx.fillStyle = '#6a4a30'; ctx.fillRect(cx - 9 * u, cy + 4 * u, 9 * u, 1.5 * u);
    // logs
    ctx.fillStyle = '#3a2414'; ctx.fillRect(cx + 1 * u, cy + 7 * u, 8 * u, 2 * u);
    // flame
    const fl = 0.85 + Math.sin(t * 7) * 0.15;
    ctx.fillStyle = '#ff7a40';
    ctx.beginPath();
    ctx.moveTo(cx + 5 * u, cy + 7 * u - 7 * u * fl);
    ctx.quadraticCurveTo(cx + 8 * u, cy + 4 * u, cx + 7 * u, cy + 7 * u);
    ctx.lineTo(cx + 3 * u, cy + 7 * u);
    ctx.quadraticCurveTo(cx + 2 * u, cy + 4 * u, cx + 5 * u, cy + 7 * u - 7 * u * fl);
    ctx.fill();
    ctx.fillStyle = '#ffd070';
    ctx.fillRect(cx + 4 * u, cy + 4 * u, 2 * u, 3 * u);
  }

  /** Lore omen: glowing rune tablet. */
  _drawLoreSprite(ctx, cx, cy, s, t) {
    const u = s / 32;
    const px = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(cx + a * u, cy + b * u, w * u, h * u); };
    px(-6, -8, 12, 16, '#4a5560'); px(-6, -8, 12, 1.5, '#6a7580'); px(-5, 6, 10, 1.5, '#323a42');
    const pulse = 0.5 + Math.sin(t * 3) * 0.4;
    ctx.fillStyle = `rgba(150,210,235,${pulse})`;
    px(-3, -5, 6, 1, ctx.fillStyle); px(-3, -2, 5, 1, ctx.fillStyle);
    px(-3, 1, 6, 1, ctx.fillStyle); px(-3, 4, 4, 1, ctx.fillStyle);
  }

  /** Tint tiles in hazard-zone rooms. */
  _drawAmbientZones(ctx, floor, x0, y0, x1, y1) {
    const tints = {
      frost: 'rgba(140,200,255,0.12)',
      venom: 'rgba(80,200,100,0.10)',
      flame: 'rgba(255,120,60,0.12)',
      spike: 'rgba(200,200,220,0.08)'
    };
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = floor.tiles[y][x];
        if (!t?.ambient || !t.explored) continue;
        const fill = tints[t.ambient.type];
        if (!fill) continue;
        ctx.save();
        ctx.globalAlpha = t.visible ? 1 : 0.35;
        ctx.fillStyle = fill;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.restore();
      }
    }
  }

  /** Draw revealed traps: armed = bright glyph, spent = faint scorch. */
  _drawHazards(ctx, floor, x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = floor.tiles[y][x];
        const hz = t.hazard;
        if (!hz || !hz.revealed || !t.explored) continue;
        const col = (HAZARDS[hz.type]?.color || '#cdd5dd');
        const tx = x * TILE_SIZE;
        const ty = y * TILE_SIZE;
        const cx = tx + TILE_SIZE / 2;
        const cy = ty + TILE_SIZE / 2;
        const r = TILE_SIZE * 0.26;
        ctx.save();
        ctx.globalAlpha = hz.armed ? (t.visible ? 0.9 : 0.4) : 0.3;
        if (drawVectorTrap(ctx, tx, ty, TILE_SIZE, hz.type, hz.armed ? 'armed' : 'sprung')) {
          ctx.restore();
          continue;
        }
        ctx.fillStyle = '#16121a';
        ctx.strokeStyle = '#5b5161';
        ctx.lineWidth = 1;
        ctx.fillRect(tx + 8, ty + 10, TILE_SIZE - 16, TILE_SIZE - 18);
        ctx.strokeRect(tx + 8.5, ty + 10.5, TILE_SIZE - 17, TILE_SIZE - 19);
        ctx.fillStyle = col;
        if (hz.type === 'spike') {
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(cx + i * 8, ty + 12);
            ctx.lineTo(cx + i * 8 + 4, ty + 23);
            ctx.lineTo(cx + i * 8 - 4, ty + 23);
            ctx.closePath();
            ctx.fill();
          }
        } else if (hz.type === 'venom') {
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(cx - 8, cy + 5, 16, 2);
        } else if (hz.type === 'flame') {
          ctx.beginPath();
          ctx.moveTo(cx, ty + 13);
          ctx.quadraticCurveTo(cx + 8, cy, cx, ty + 28);
          ctx.quadraticCurveTo(cx - 8, cy, cx, ty + 13);
          ctx.fill();
        } else {
          ctx.strokeStyle = col;
          ctx.beginPath();
          ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy);
          ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy + 9);
          ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx + 6, cy + 6);
          ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx - 6, cy + 6);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  /** Champion/elite marker — a pulsing coloured ring under the sprite. */
  _drawEliteMarker(ctx, e, px, py) {
    const col = e.elite?.color || '#ffaa44';
    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE * 0.82;
    const t = this._timeSec || 0;
    const pulse = 0.55 + Math.sin(t * 3.4) * 0.18;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, TILE_SIZE * 0.42, TILE_SIZE * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = pulse * 0.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, TILE_SIZE * 0.30, TILE_SIZE * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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
    this.invalidateFloorCache();
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
