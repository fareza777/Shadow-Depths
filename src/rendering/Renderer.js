/**
 * Renderer — owns canvas + draws frames.
 *
 * Public surface:
 *   render(sceneManager, stateStore)  — called once per rAF by GameLoop.
 *   drawFloor(floor)                  — paint tiles with vision state.
 *   drawEntities(floor, player, time) — paint sprites with renderX/Y interp.
 *   drawText(...), drawRect(...), drawBar(...) — primitives for HUD.
 *
 * The Renderer does NOT know about scenes' internals — it exposes primitives
 * and the scene's `render(renderer)` is responsible for orchestration.
 *
 * Tween: an entity's logical (x, y) snaps on action; renderX/Y interpolates
 * toward it at TIMING.moveTween. Renderer drives that interpolation here so
 * Entity stays pure data.
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, TILE, COLOR, TIMING
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

  // --- main entry -----------------------------------------------------
  render(sceneManager, stateStore) {
    const now = performance.now();
    const dt = this._lastTime ? (now - this._lastTime) / 1000 : 0;
    this._lastTime = now;

    this.cameraShake.update(dt);
    this.particles.update(dt);
    const offset = this.cameraShake.offset();

    // Clear.
    const ctx = this.ctx;
    fillRect(ctx, 0, 0, this.canvas.width, this.canvas.height, COLOR.bg);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    sceneManager.render(this);
    ctx.restore();

    // Particles render in screen space with their own shake-aware translate.
    this.particles.render(ctx, offset);
  }

  // --- world primitives ----------------------------------------------
  /**
   * Paint the dungeon floor with vision state.
   * @param {import('../world/Floor.js').Floor} floor
   */
  drawFloor(floor) {
    const ctx = this.ctx;
    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        const t = floor.tiles[y][x];
        if (t.type === TILE.VOID) continue;
        if (!t.explored) continue; // unseen → stay black
        const dim = !t.visible;
        switch (t.type) {
          case TILE.WALL:        this.sprites.draw('tile_wall',        ctx, x * TILE_SIZE, y * TILE_SIZE, { dim }); break;
          case TILE.FLOOR:       this.sprites.draw('tile_floor',       ctx, x * TILE_SIZE, y * TILE_SIZE, { dim }); break;
          case TILE.STAIRS_DOWN: this.sprites.draw('tile_stairs_down', ctx, x * TILE_SIZE, y * TILE_SIZE, { dim }); break;
          case TILE.STAIRS_UP:   this.sprites.draw('tile_stairs_up',   ctx, x * TILE_SIZE, y * TILE_SIZE, { dim }); break;
          case TILE.DOOR:        this.sprites.draw('tile_door',        ctx, x * TILE_SIZE, y * TILE_SIZE, { dim }); break;
          default: /* no-op */ break;
        }
        if (dim) {
          // Darken explored-but-not-visible with a translucent black wash.
          ctx.globalAlpha = 0.55;
          fillRect(ctx, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, '#000');
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  /**
   * Paint items on the ground (only visible tiles).
   */
  drawGroundItems(floor) {
    const ctx = this.ctx;
    for (const [key, stack] of floor.items) {
      const [xs, ys] = key.split(',');
      const x = parseInt(xs, 10), y = parseInt(ys, 10);
      const t = floor.tileAt(x, y);
      if (!t || !t.visible) continue;
      const top = stack[stack.length - 1];
      this.sprites.draw(top.spriteKey, ctx, x * TILE_SIZE, y * TILE_SIZE);
      if (stack.length > 1) {
        this._tinyBadge(ctx, x * TILE_SIZE + TILE_SIZE - 8, y * TILE_SIZE + TILE_SIZE - 8, `${stack.length}`);
      }
    }
  }

  /**
   * Paint entities. Updates renderX/Y toward grid position by lerp.
   * @param {import('../world/Floor.js').Floor} floor
   * @param {number} dt seconds
   */
  drawEntities(floor, dt) {
    const ctx = this.ctx;
    // Step renderX/Y toward (x,y).
    const speed = 1000 / TIMING.moveTween; // tiles per second
    for (const e of floor.entities.values()) {
      const dx = e.x - e.renderX;
      const dy = e.y - e.renderY;
      const maxStep = speed * dt;
      e.renderX += clampMove(dx, maxStep);
      e.renderY += clampMove(dy, maxStep);
    }

    // Draw, sorted so dead-flickering happens before live entities.
    const list = Array.from(floor.entities.values()).sort((a, b) => a.renderY - b.renderY);
    for (const e of list) {
      if (e.isDead) continue;
      const t = floor.tileAt(e.x, e.y);
      // Render enemies only on visible tiles; player always renders.
      if (e.kind === 'enemy' && (!t || !t.visible)) continue;
      const px = e.renderX * TILE_SIZE;
      const py = e.renderY * TILE_SIZE;
      const key = e.spriteKey || (e.kind === 'player' ? 'player_idle' : 'enemy_goblin');
      this.sprites.draw(key, ctx, px, py);

      // Tiny HP bar over enemies if damaged.
      if (e.kind === 'enemy' && e.stats.hp < e.stats.hpMax) {
        const pct = e.stats.hp / e.stats.hpMax;
        const w = TILE_SIZE - 6;
        fillRect(ctx, px + 3, py - 4, w, 3, COLOR.hpBarBg);
        fillRect(ctx, px + 3, py - 4, w * pct, 3, COLOR.hpBar);
      }

      // Intent telegraph above enemy head.
      if (e.kind === 'enemy' && e.intent) {
        this._drawIntentIcon(ctx, e.intent, px, py);
      }
    }
  }

  _drawIntentIcon(ctx, intent, px, py) {
    let glyph = '';
    let color = '#d6d6da';
    if (intent.type === 'attack') { glyph = '!'; color = '#ff6060'; }
    else if (intent.type === 'ranged') { glyph = '➜'; color = '#80b0e0'; }
    else if (intent.type === 'move')   { glyph = '·'; color = '#a0a0aa'; }
    else if (intent.type === 'wait')   { glyph = intent.meta?.winding ? '⌛' : '…'; color = '#c0a060'; }
    if (!glyph) return;
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = color;
    ctx.fillText(glyph, px + TILE_SIZE / 2, py - 6);
  }

  _tinyBadge(ctx, x, y, text) {
    fillRect(ctx, x - 1, y - 7, 10, 9, '#000');
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLOR.textPrimary;
    ctx.fillText(text, x, y - 7);
  }

  // --- HUD primitives -------------------------------------------------
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
