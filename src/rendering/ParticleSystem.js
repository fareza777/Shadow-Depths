/**
 * ParticleSystem — small set of pooled particles + floating damage numbers.
 *
 * Two kinds of effects share the same update/render loop because they have
 * identical lifecycle math (life, velocity, fade):
 *   - 'spark' — tiny squares (hit, death poof, pickup glint).
 *   - 'text'  — floating damage / heal numbers.
 *
 * Subscribes to the bus on construction so combat code can stay UI-agnostic.
 */
import { COLOR, TIMING, TILE_SIZE } from '../config/constants.js';
import { fillRect } from './SpriteRegistry.js';

const MAX_PARTICLES = 256;

export class ParticleSystem {
  /**
   * @param {{ bus:object }} deps
   */
  constructor({ bus }) {
    this.bus = bus;
    /** @type {Array<object>} */
    this._particles = [];
    this._wireEvents();
  }

  _wireEvents() {
    this.bus.on('entity:damaged', ({ entity, amount, isCrit }) => {
      if (amount <= 0) return;
      this.spawnDamageText(entity, amount, isCrit);
      this.spawnSparks(entity.renderX, entity.renderY, isCrit ? '#ff8080' : '#c04040', 4);
    });
    this.bus.on('entity:healed', ({ entity, amount }) => {
      if (amount <= 0) return;
      this.spawnHealText(entity, amount);
    });
    this.bus.on('entity:died', ({ entity }) => {
      this.spawnSparks(entity.renderX, entity.renderY, '#1a1a1e', 10, { spread: 1.4, life: 0.6 });
    });
    this.bus.on('entity:xpGained', ({ entity, amount }) => {
      if (amount <= 0 || entity.kind !== 'player') return;
      this.spawnXPText(entity, amount);
    });
    this.bus.on('item:used', ({ by }) => {
      this.spawnSparks(by.renderX, by.renderY, '#d0c050', 6, { spread: 0.6 });
    });
  }

  spawnSparks(tileX, tileY, color, count = 6, opts = {}) {
    const spread = opts.spread ?? 0.8;
    const life = opts.life ?? 0.35;
    const cx = (tileX + 0.5) * TILE_SIZE;
    const cy = (tileY + 0.5) * TILE_SIZE;
    for (let i = 0; i < count; i++) {
      if (this._particles.length >= MAX_PARTICLES) break;
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * spread * TILE_SIZE;
      this._particles.push({
        kind: 'spark',
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - TILE_SIZE * 0.4, // slight upward bias
        life, maxLife: life,
        color,
        size: 2 + Math.random() * 2
      });
    }
  }

  spawnDamageText(entity, amount, isCrit) {
    this._pushText({
      x: (entity.renderX + 0.5) * TILE_SIZE,
      y: entity.renderY * TILE_SIZE,
      text: String(amount),
      color: isCrit ? COLOR.textCrit : COLOR.textPrimary,
      scale: isCrit ? 1.5 : 1,
      life: TIMING.damageNumberLife / 1000
    });
  }
  spawnHealText(entity, amount) {
    this._pushText({
      x: (entity.renderX + 0.5) * TILE_SIZE,
      y: entity.renderY * TILE_SIZE,
      text: `+${amount}`,
      color: COLOR.textHeal,
      scale: 1,
      life: TIMING.damageNumberLife / 1000
    });
  }
  spawnXPText(entity, amount) {
    this._pushText({
      x: (entity.renderX + 0.5) * TILE_SIZE,
      y: entity.renderY * TILE_SIZE,
      text: `+${amount} XP`,
      color: COLOR.textXP,
      scale: 0.9,
      life: (TIMING.damageNumberLife + 200) / 1000
    });
  }

  _pushText({ x, y, text, color, scale, life }) {
    if (this._particles.length >= MAX_PARTICLES) this._particles.shift();
    this._particles.push({
      kind: 'text', x, y, text, color, scale,
      vx: 0, vy: -30, // px/sec upward
      life, maxLife: life
    });
  }

  /** @param {number} dt seconds */
  update(dt) {
    const next = [];
    for (const p of this._particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'spark') {
        p.vy += 120 * dt; // gravity for sparks
      }
      next.push(p);
    }
    this._particles = next;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x:number, y:number }} cameraOffset
   */
  render(ctx, cameraOffset = { x: 0, y: 0 }) {
    ctx.save();
    ctx.translate(cameraOffset.x, cameraOffset.y);
    for (const p of this._particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      if (p.kind === 'spark') {
        fillRect(ctx, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.color);
      } else {
        ctx.fillStyle = p.color;
        const px = 14 * (p.scale ?? 1);
        ctx.font = `bold ${px}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, p.y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  clear() {
    this._particles.length = 0;
  }
}
