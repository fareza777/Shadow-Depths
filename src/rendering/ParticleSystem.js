/**
 * ParticleSystem — sparks, rings, hit flashes, floating combat text.
 */
import { COLOR, TIMING, TILE_SIZE } from '../config/constants.js';

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
    });
    this.bus.on('entity:healed', ({ entity, amount }) => {
      if (amount <= 0) return;
      this.spawnHealText(entity, amount);
      this.spawnSparks(entity.renderX, entity.renderY, '#60d080', 6, { spread: 0.55, life: 0.4, glow: true });
    });
    this.bus.on('entity:died', ({ entity }) => {
      const isBoss = entity.defId?.startsWith('boss_');
      const color = isBoss ? '#d4be7a' : entity.kind === 'enemy' ? '#6a5080' : '#1a1a1e';
      this.spawnSparks(entity.renderX, entity.renderY, color, isBoss ? 18 : 12, {
        spread: isBoss ? 1.6 : 1.2,
        life: isBoss ? 0.75 : 0.55,
        glow: true
      });
      if (isBoss) this.spawnRingBurst(entity.renderX, entity.renderY, '#d4be7a', 0.55, 1.4);
    });
    this.bus.on('entity:xpGained', ({ entity, amount }) => {
      if (amount <= 0 || entity.kind !== 'player') return;
      this.spawnXPText(entity, amount);
      this.spawnSparks(entity.renderX, entity.renderY, '#80b0ff', 4, { spread: 0.5, life: 0.35 });
    });
    this.bus.on('entity:attacked', ({ target, damage, isCrit, isMiss }) => {
      if (!target || isMiss) {
        if (target) this.spawnMissText(target);
        return;
      }
      if (damage > 0) {
        const color = isCrit ? '#ff6060' : '#c84848';
        this.spawnHitFlash(target.renderX, target.renderY, isCrit);
        this.spawnSparks(target.renderX, target.renderY, color, isCrit ? 10 : 6, {
          spread: isCrit ? 1.2 : 0.8,
          life: isCrit ? 0.45 : 0.32,
          glow: true
        });
        if (isCrit) {
          this.spawnRingBurst(target.renderX, target.renderY, '#ff4040', 0.35);
          this.spawnRingBurst(target.renderX, target.renderY, '#ffffff', 0.22, 0.85);
        }
      }
    });
    this.bus.on('item:used', ({ by }) => {
      this.spawnSparks(by.renderX, by.renderY, '#d0c050', 8, { spread: 0.65, life: 0.4, glow: true });
      this.spawnRingBurst(by.renderX, by.renderY, '#d4be7a', 0.28, 0.7);
    });
    this.bus.on('item:pickedUp', ({ by, item }) => {
      if (!by) return;
      const color = ParticleSystem._rarityColor(item?.rarity);
      this.spawnSparks(by.renderX, by.renderY, color, item?.rarity === 'epic' ? 18 : 10, {
        spread: item?.rarity === 'epic' ? 1.25 : 0.9,
        life: item?.rarity === 'epic' ? 0.62 : 0.45,
        glow: true
      });
      this.spawnRingBurst(by.renderX, by.renderY, color, item?.rarity === 'epic' ? 0.48 : 0.32, 0.75);
      if (item?.rarity === 'rare' || item?.rarity === 'epic') {
        this.spawnRingBurst(by.renderX, by.renderY, '#ffffff', 0.24, 1.05);
      }
    });
  }

  spawnHitFlash(tileX, tileY, strong = false) {
    const life = strong ? 0.18 : 0.12;
    const cx = (tileX + 0.5) * TILE_SIZE;
    const cy = (tileY + 0.5) * TILE_SIZE;
    if (this._particles.length >= MAX_PARTICLES) this._particles.shift();
    this._particles.push({
      kind: 'flash',
      x: cx, y: cy,
      vx: 0, vy: 0,
      life, maxLife: life,
      size: TILE_SIZE * (strong ? 1.05 : 0.85),
      color: strong ? '#ffffff' : '#ffd0a8'
    });
  }

  spawnRingBurst(tileX, tileY, color, life = 0.35, scale = 1) {
    const cx = (tileX + 0.5) * TILE_SIZE;
    const cy = (tileY + 0.5) * TILE_SIZE;
    if (this._particles.length >= MAX_PARTICLES) this._particles.shift();
    this._particles.push({
      kind: 'ring',
      x: cx, y: cy,
      vx: 0, vy: 0,
      life, maxLife: life,
      color,
      size: TILE_SIZE * 0.2 * scale,
      maxSize: TILE_SIZE * 0.55 * scale
    });
  }

  spawnSparks(tileX, tileY, color, count = 6, opts = {}) {
    const spread = opts.spread ?? 0.8;
    const life = opts.life ?? 0.35;
    const glow = opts.glow ?? false;
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
        vy: Math.sin(a) * sp - TILE_SIZE * 0.45,
        life, maxLife: life,
        color,
        size: 2 + Math.random() * (glow ? 3 : 2),
        glow
      });
    }
  }

  spawnDamageText(entity, amount, isCrit) {
    this._pushText({
      x: (entity.renderX + 0.5) * TILE_SIZE,
      y: entity.renderY * TILE_SIZE - 4,
      text: String(amount),
      color: isCrit ? COLOR.textCrit : '#f0e8e8',
      stroke: '#1a0810',
      scale: isCrit ? 1.55 : 1.05,
      life: TIMING.damageNumberLife / 1000,
      pop: isCrit
    });
  }

  spawnHealText(entity, amount) {
    this._pushText({
      x: (entity.renderX + 0.5) * TILE_SIZE,
      y: entity.renderY * TILE_SIZE,
      text: `+${amount}`,
      color: COLOR.textHeal,
      stroke: '#0a2010',
      scale: 1.05,
      life: TIMING.damageNumberLife / 1000
    });
  }

  spawnXPText(entity, amount) {
    this._pushText({
      x: (entity.renderX + 0.5) * TILE_SIZE,
      y: entity.renderY * TILE_SIZE - 6,
      text: `+${amount} XP`,
      color: COLOR.textXP,
      stroke: '#101828',
      scale: 0.95,
      life: (TIMING.damageNumberLife + 200) / 1000
    });
  }

  spawnMissText(entity) {
    this._pushText({
      x: (entity.renderX + 0.5) * TILE_SIZE,
      y: entity.renderY * TILE_SIZE,
      text: 'MISS',
      color: '#9090a8',
      stroke: '#181820',
      scale: 0.85,
      life: 0.55
    });
  }

  _pushText({ x, y, text, color, stroke, scale, life, pop = false }) {
    if (this._particles.length >= MAX_PARTICLES) this._particles.shift();
    this._particles.push({
      kind: 'text', x, y, text, color, stroke, scale, pop,
      vx: (Math.random() - 0.5) * 12,
      vy: -38,
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
        p.vy += 140 * dt;
        p.vx *= 1 - dt * 2.5;
      } else if (p.kind === 'text') {
        p.vy *= 1 - dt * 1.2;
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
      const t = Math.max(0, p.life / p.maxLife);
      const alpha = p.kind === 'text' ? Math.min(1, t * 1.4) : t;
      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.kind === 'spark') {
        const r = p.size / 2;
        if (p.glow) {
          ctx.globalAlpha = alpha * 0.35;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
        }
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ring') {
        const grow = 1 - t;
        const rad = p.size + (p.maxSize - p.size) * grow;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 + grow * 2;
        ctx.globalAlpha = alpha * 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'flash') {
        const s = p.size * (1 + (1 - t) * 0.15);
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else {
        const pop = p.pop ? 1 + (1 - t) * 0.35 : 1;
        const px = 14 * (p.scale ?? 1) * pop;
        ctx.font = `bold ${px}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (p.stroke) {
          ctx.strokeStyle = p.stroke;
          ctx.lineWidth = 3;
          ctx.strokeText(p.text, p.x, p.y);
        }
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  clear() {
    this._particles.length = 0;
  }

  static _rarityColor(rarity) {
    switch (rarity) {
      case 'uncommon': return COLOR.itemUncommon;
      case 'rare': return COLOR.itemRare;
      case 'epic': return COLOR.itemEpic;
      default: return COLOR.goldHi;
    }
  }
}
