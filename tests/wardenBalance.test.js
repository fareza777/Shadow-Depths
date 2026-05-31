import { describe, it, expect } from 'vitest';
import { passiveFlatDamageReduction, passivePoisonTickDamage } from '../src/gameplay/heroPassives.js';
import { StatusEffects } from '../src/combat/StatusEffects.js';

describe('Warden balance passives', () => {
  it('Phalanx reduces damage with one adjacent foe', () => {
    const player = { kind: 'player', heroKind: 'warden', x: 5, y: 5 };
    const floor = {
      entityAt: (x, y) => (x === 6 && y === 5 ? { kind: 'enemy', isDead: false } : null)
    };
    expect(passiveFlatDamageReduction(player, floor, { kind: 'enemy' })).toBe(1);
  });

  it('Phalanx caps at −2 with many adjacent foes', () => {
    const player = { kind: 'player', heroKind: 'warden', x: 5, y: 5 };
    const floor = {
      entityAt: (x, y) => {
        if (x === 5 && y === 6) return { kind: 'enemy', isDead: false };
        if (x === 6 && y === 5) return { kind: 'enemy', isDead: false };
        if (x === 4 && y === 5) return { kind: 'enemy', isDead: false };
        return null;
      }
    };
    expect(passiveFlatDamageReduction(player, floor, { kind: 'enemy' })).toBe(2);
  });

  it('softens poison ticks by 1 (min 1)', () => {
    const player = { kind: 'player', heroKind: 'warden' };
    expect(passivePoisonTickDamage(player, 4)).toBe(3);
    expect(passivePoisonTickDamage(player, 1)).toBe(1);
  });

  it('poison tick respects warden reduction in StatusEffects', () => {
    const player = {
      kind: 'player',
      heroKind: 'warden',
      stats: { hp: 20, hpMax: 40 },
      statusEffects: [],
      takeDamage(n) {
        this.stats.hp -= n;
        return n;
      }
    };
    StatusEffects.apply(player, { status: 'poison', value: 3, duration: 2 });
    const delta = StatusEffects.tickAll(player);
    expect(delta).toBe(-2);
    expect(player.stats.hp).toBe(18);
  });
});

describe('Pilgrim early-floor passive', () => {
  it('reduces damage on floor index 0–1', () => {
    const player = { kind: 'player', heroKind: 'pilgrim', stats: { hp: 30, hpMax: 36 } };
    const floor = { definition: { index: 0 }, entityAt: () => null };
    expect(passiveFlatDamageReduction(player, floor, { kind: 'enemy' })).toBe(1);
  });

  it('reduces damage when below half HP on deeper floors', () => {
    const player = { kind: 'player', heroKind: 'pilgrim', stats: { hp: 10, hpMax: 36 } };
    const floor = { definition: { index: 5 }, entityAt: () => null };
    expect(passiveFlatDamageReduction(player, floor, { kind: 'enemy' })).toBe(1);
  });
});
