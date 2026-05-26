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
    this.bus.on('spell:cast', ({ entity, fx }) => {
      if (!entity) return;
      this.spawnSpellBurst(entity, fx || {});
    });
  }

  spawnSpellBurst(caster, fx) {
    const color = fx.color || '#d4be7a';
    const cx = fx.center?.x ?? caster.renderX;
    const cy = fx.center?.y ?? caster.renderY;
    const radius = Math.max(1, fx.radius || 1);
    this.spawnRingBurst(caster.renderX, caster.renderY, color, 0.42, 1.1);
    this.spawnSparks(caster.renderX, caster.renderY, color, 16, { spread: 1.1, life: 0.55, glow: true });

    if (fx.kind === 'hollow' && fx.target) {
      this._pushBeam(caster.renderX, caster.renderY, fx.target.x, fx.target.y, color, 0.34, 5);
      this.spawnRingBurst(fx.target.x, fx.target.y, '#c080ff', 0.46, 1.0);
      this.spawnSparks(fx.target.x, fx.target.y, '#9a60ff', 18, { spread: 1.15, life: 0.62, glow: true });
    } else if (fx.kind === 'inquisitor') {
      this._pushRune(cx, cy, color, radius, 0.62, 'flare');
      this.spawnRingBurst(cx, cy, color, 0.56, 1.7 + radius * 0.35);
      this.spawnSparks(cx, cy, '#ff8844', 26, { spread: 1.8, life: 0.7, glow: true });
    } else if (fx.kind === 'reaver') {
      this._pushRune(cx, cy, color, radius, 0.55, 'storm');
      for (let i = 0; i < 3; i++) this.spawnRingBurst(cx, cy, i % 2 ? '#8a8098' : color, 0.46 + i * 0.08, 1.2 + i * 0.55);
      this.spawnSparks(cx, cy, '#e8e0d0', 24, { spread: 2.0, life: 0.58, glow: true });
    } else if (fx.kind === 'pilgrim') {
      this._pushRune(cx, cy, color, radius, 0.72, 'sanctuary');
      this.spawnRingBurst(cx, cy, color, 0.72, 1.8 + radius * 0.35);
      this.spawnSparks(cx, cy, '#fff2c0', 20, { spread: 1.6, life: 0.75, glow: true });
    } else {
      this._pushRune(cx, cy, color, radius, 0.58, 'ward');
      this.spawnRingBurst(cx, cy, '#80b0ff', 0.58, 1.45);
    }
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

  _pushBeam(x0, y0, x1, y1, color, life, width = 4) {
    if (this._particles.length >= MAX_PARTICLES) this._particles.shift();
    this._particles.push({
      kind: 'beam',
      x: (x0 + 0.5) * TILE_SIZE,
      y: (y0 + 0.5) * TILE_SIZE,
      x2: (x1 + 0.5) * TILE_SIZE,
      y2: (y1 + 0.5) * TILE_SIZE,
      vx: 0, vy: 0,
      life, maxLife: life,
      color,
      size: width
    });
  }

  _pushRune(tileX, tileY, color, radiusTiles, life, variant) {
    if (this._particles.length >= MAX_PARTICLES) this._particles.shift();
    this._particles.push({
      kind: 'rune',
      x: (tileX + 0.5) * TILE_SIZE,
      y: (tileY + 0.5) * TILE_SIZE,
      vx: 0, vy: 0,
      life, maxLife: life,
      color,
      size: TILE_SIZE * Math.max(0.7, radiusTiles * 0.55),
      variant
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
      } else if (p.kind === 'beam') {
        const pulse = 1 - t;
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size + pulse * 5;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        const mx = (p.x + p.x2) / 2;
        const my = (p.y + p.y2) / 2 - TILE_SIZE * 0.18;
        ctx.quadraticCurveTo(mx, my, p.x2, p.y2);
        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#fff2c0';
        ctx.lineWidth = Math.max(1, p.size * 0.35);
        ctx.stroke();
      } else if (p.kind === 'rune') {
        const grow = 0.75 + (1 - t) * 0.55;
        const rad = p.size * grow;
        ctx.translate(p.x, p.y);
        ctx.rotate((1 - t) * Math.PI * (p.variant === 'storm' ? 1.6 : 0.35));
        ctx.globalAlpha = alpha * 0.55;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.variant === 'sanctuary' ? 3 : 2;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.42;
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 * i) / 6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * rad * 0.28, Math.sin(a) * rad * 0.28);
          ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
          ctx.stroke();
        }
        if (p.variant === 'flare') {
          ctx.globalAlpha = alpha * 0.22;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.72, 0, Math.PI * 2);
          ctx.fill();
        }
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
