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
   * Compute camera so the player is centered. Clamp at world edges so we
   * never reveal void past the world boundary on screen.
   */
  setCameraFor(playerRenderX, playerRenderY) {
    const worldW = GRID_WIDTH * TILE_SIZE;
    const worldH = GRID_HEIGHT * TILE_SIZE;
    let cx = CANVAS_WIDTH / 2 - (playerRenderX + 0.5) * TILE_SIZE;
    let cy = CANVAS_HEIGHT / 2 - (playerRenderY + 0.5) * TILE_SIZE;
    cx = worldW <= CANVAS_WIDTH
      ? (CANVAS_WIDTH - worldW) / 2
      : Math.max(CANVAS_WIDTH - worldW, Math.min(0, cx));
    cy = worldH <= CANVAS_HEIGHT
      ? (CANVAS_HEIGHT - worldH) / 2
      : Math.max(CANVAS_HEIGHT - worldH, Math.min(0, cy));
    this._camera = { x: Math.round(cx), y: Math.round(cy) };
  }

  get camera() { return this._camera; }

  /** Convert canvas pixel coord → world tile coord. Useful for tap-to-walk. */
  canvasToTile(canvasX, canvasY) {
    return {
      x: Math.floor((canvasX - this._camera.x) / TILE_SIZE),
      y: Math.floor((canvasY - this._camera.y) / TILE_SIZE)
    };
  }

  // --- main entry -----------------------------------------------------
  render(sceneManager, _stateStore) {
    const now = performance.now();
    const dt = this._lastTime ? (now - this._lastTime) / 1000 : 0;
    this._lastTime = now;

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
    // Particles spawn at world coords; apply world camera offset.
    this.particles.render(ctx, this._camera);
    ctx.restore();
  }

  // --- world primitives ----------------------------------------------
  /**
   * Paint the dungeon floor with vision state. Applies camera offset.
   * Only iterates tiles inside the visible viewport for perf.
   * @param {import('../world/Floor.js').Floor} floor
   */
  drawFloor(floor) {
    const ctx = this.ctx;
    const cam = this._camera;
    ctx.save();
    ctx.translate(cam.x, cam.y);

    // Visible tile range.
    const x0 = Math.max(0, Math.floor(-cam.x / TILE_SIZE));
    const y0 = Math.max(0, Math.floor(-cam.y / TILE_SIZE));
    const x1 = Math.min(floor.width - 1, Math.ceil((CANVAS_WIDTH - cam.x) / TILE_SIZE));
    const y1 = Math.min(floor.height - 1, Math.ceil((CANVAS_HEIGHT - cam.y) / TILE_SIZE));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = floor.tiles[y][x];
        if (t.type === TILE.VOID) continue;
        if (!t.explored) continue;
        const dim = !t.visible;
        switch (t.type) {
          case TILE.WALL:        this.sprites.draw('tile_wall',        ctx, x * TILE_SIZE, y * TILE_SIZE, { dim }); break;
          case TILE.FLOOR:       this.sprites.draw('tile_floor',       ctx, x * TILE_SIZE, y * TILE_SIZE, { dim }); break;
          case TILE.STAIRS_DOWN: this.sprites.draw('tile_stairs_down', ctx, x * TILE_SIZE, y * TILE_SIZE, { dim }); break;
          case TILE.STAIRS_UP:   this.sprites.draw('tile_stairs_up',   ctx, x * TILE_SIZE, y * TILE_SIZE, { dim }); break;
          case TILE.DOOR:        this.sprites.draw('tile_door',        ctx, x * TILE_SIZE, y * TILE_SIZE, { dim }); break;
          default: break;
        }
        if (dim) {
          ctx.globalAlpha = 0.55;
          fillRect(ctx, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, '#000');
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();
  }

  /** Paint items on visible tiles. Applies camera offset. */
  drawGroundItems(floor) {
    const ctx = this.ctx;
    const cam = this._camera;
    ctx.save();
    ctx.translate(cam.x, cam.y);
    for (const [key, stack] of floor.items) {
      const [xs, ys] = key.split(',');
      const x = parseInt(xs, 10), y = parseInt(ys, 10);
      const t = floor.tileAt(x, y);
      if (!t || !t.visible) continue;
      const top = stack[stack.length - 1];
      this.sprites.draw(top.spriteKey, ctx, x * TILE_SIZE, y * TILE_SIZE);
      if (stack.length > 1) {
        this._tinyBadge(ctx, x * TILE_SIZE + TILE_SIZE - 10, y * TILE_SIZE + TILE_SIZE - 10, `${stack.length}`);
      }
    }
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
    ctx.translate(cam.x, cam.y);

    const list = Array.from(floor.entities.values()).sort((a, b) => a.renderY - b.renderY);
    for (const e of list) {
      if (e.isDead) continue;
      const t = floor.tileAt(e.x, e.y);
      if (e.kind === 'enemy' && (!t || !t.visible)) continue;
      const px = e.renderX * TILE_SIZE;
      const py = e.renderY * TILE_SIZE;
      const key = e.spriteKey || (e.kind === 'player' ? 'player_idle' : 'enemy_goblin');
      this.sprites.draw(key, ctx, px, py);

      if (e.kind === 'enemy' && e.stats.hp < e.stats.hpMax) {
        const pct = e.stats.hp / e.stats.hpMax;
        const w = TILE_SIZE - 6;
        fillRect(ctx, px + 3, py - 5, w, 4, COLOR.hpBarBg);
        fillRect(ctx, px + 3, py - 5, w * pct, 4, COLOR.hpBar);
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

  _tinyBadge(ctx, x, y, text) {
    fillRect(ctx, x - 1, y - 9, 12, 11, '#000');
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLOR.textPrimary;
    ctx.fillText(text, x, y - 9);
  }

  // --- HUD primitives (screen space — no camera offset) --------------
  drawText(text, x, y, opts = {}) {
    const ctx = this.ctx;
    ctx.font = `${opts.bold ? 'bold ' : ''}${opts.size || 14}px "Courier New", monospace`;
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'top';
    ctx.fillStyle = opts.color || COLOR.textPrimary;
    ctx.fillText(text, x, y);
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

  drawStrokedRect(x, y, w, h, color, line = 1) {
    strokeRect(this.ctx, x, y, w, h, color, line);
  }

  // --- viewport scaling ----------------------------------------------
  _fitToViewport() {
    const vw = window.innerWidth, vh = window.innerHeight;
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
