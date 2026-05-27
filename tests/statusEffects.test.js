import { describe, it, expect } from 'vitest';
import { StatusEffects, getStatusMeta, listStatuses } from '../src/combat/StatusEffects.js';

function fakeEntity(hp = 10) {
  return {
    stats: { hp, hpMax: 10 },
    statusEffects: [],
    isDead: false,
    heal(n) {
      const before = this.stats.hp;
      this.stats.hp = Math.min(this.stats.hpMax, this.stats.hp + n);
      return this.stats.hp - before;
    },
    takeDamage(n) {
      const before = this.stats.hp;
      this.stats.hp = Math.max(0, this.stats.hp - n);
      this.isDead = this.stats.hp <= 0;
      return before - this.stats.hp;
    },
    applyStatus(e) { this.statusEffects.push(e); }
  };
}

describe('StatusRegistry built-ins', () => {
  it('registers the expected built-in statuses', () => {
    const all = listStatuses();
    expect(all).toEqual(expect.arrayContaining([
      'poison', 'burn', 'bleed', 'regen', 'freeze', 'stun', 'slow',
      'atk_buff', 'def_buff'
    ]));
  });

  it('exposes meta for each status', () => {
    expect(getStatusMeta('poison').name).toBe('Poison');
    expect(getStatusMeta('regen').color).toBe('#a0ff80');
    expect(getStatusMeta('zzz')).toBeNull();
  });
});

describe('StatusEffects.apply', () => {
  it('rejects unknown status with warning', () => {
    const e = fakeEntity();
    expect(StatusEffects.apply(e, { status: 'ghost', value: 1, duration: 1 })).toBe(false);
    expect(e.statusEffects.length).toBe(0);
  });

  it('poison stacks value with stackPolicy=stack', () => {
    const e = fakeEntity();
    StatusEffects.apply(e, { status: 'poison', value: 2, duration: 3 });
    StatusEffects.apply(e, { status: 'poison', value: 1, duration: 2 });
    expect(e.statusEffects.length).toBe(1);
    expect(e.statusEffects[0].value).toBe(3);            // stacks
    expect(e.statusEffects[0].duration).toBe(3);         // max of two
  });

  it('bleed extends duration with stackPolicy=extend', () => {
    const e = fakeEntity();
    StatusEffects.apply(e, { status: 'bleed', value: 1, duration: 2 });
    StatusEffects.apply(e, { status: 'bleed', value: 2, duration: 3 });
    expect(e.statusEffects[0].duration).toBe(5);         // extended
    expect(e.statusEffects[0].value).toBe(2);            // max
  });

  it('atk_buff refreshes (does not stack)', () => {
    const e = fakeEntity();
    StatusEffects.apply(e, { status: 'atk_buff', value: 2, duration: 4 });
    StatusEffects.apply(e, { status: 'atk_buff', value: 1, duration: 3 });
    expect(e.statusEffects[0].value).toBe(2);            // max, not summed
    expect(e.statusEffects[0].duration).toBe(4);
  });
});

describe('StatusEffects.tickAll', () => {
  it('poison damages then decrements duration', () => {
    const e = fakeEntity(8);
    StatusEffects.apply(e, { status: 'poison', value: 2, duration: 2 });
    const delta = StatusEffects.tickAll(e);
    expect(delta).toBe(-2);
    expect(e.stats.hp).toBe(6);
    expect(e.statusEffects[0].duration).toBe(1);
  });

  it('regen heals then decrements', () => {
    const e = fakeEntity(2);
    StatusEffects.apply(e, { status: 'regen', value: 1, duration: 3 });
    const delta = StatusEffects.tickAll(e);
    expect(delta).toBe(1);
    expect(e.stats.hp).toBe(3);
  });

  it('burn decays its value each tick', () => {
    const e = fakeEntity(10);
    StatusEffects.apply(e, { status: 'burn', value: 3, duration: 5 });
    StatusEffects.tickAll(e);
    expect(e.statusEffects[0].value).toBe(2);            // decayed
    StatusEffects.tickAll(e);
    expect(e.statusEffects[0].value).toBe(1);
  });

  it('removes expired effects', () => {
    const e = fakeEntity();
    StatusEffects.apply(e, { status: 'poison', value: 1, duration: 1 });
    StatusEffects.tickAll(e);
    expect(e.statusEffects.length).toBe(0);
  });
});

describe('StatusEffects.modifier + shouldSkipTurn', () => {
  it('atk_buff contributes to atk modifier', () => {
    const e = fakeEntity();
    StatusEffects.apply(e, { status: 'atk_buff', value: 3, duration: 2 });
    expect(StatusEffects.modifier(e, 'atk')).toBe(3);
  });

  it('def_buff contributes to def modifier', () => {
    const e = fakeEntity();
    StatusEffects.apply(e, { status: 'def_buff', value: 2, duration: 2 });
    expect(StatusEffects.modifier(e, 'def')).toBe(2);
  });

  it('slow contributes negative dex', () => {
    const e = fakeEntity();
    StatusEffects.apply(e, { status: 'slow', value: 2, duration: 2 });
    expect(StatusEffects.modifier(e, 'dex')).toBe(-2);
  });

  it('freeze and stun trigger shouldSkipTurn', () => {
    const e = fakeEntity();
    expect(StatusEffects.shouldSkipTurn(e)).toBe(false);
    StatusEffects.apply(e, { status: 'freeze', value: 1, duration: 1 });
    expect(StatusEffects.shouldSkipTurn(e)).toBe(true);
  });
});
