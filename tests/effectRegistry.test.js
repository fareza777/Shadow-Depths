import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyEffect, listEffects, hasEffect, registerEffect } from '../src/combat/EffectRegistry.js';

function fakeTarget(hp = 10, hpMax = 10) {
  return {
    kind: 'player',
    stats: { hp, hpMax },
    statusEffects: [],
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
    gainXP() { return 0; },
    applyStatus(e) { this.statusEffects.push(e); }
  };
}
function fakeBus() {
  const calls = [];
  return { emit: (event, payload) => calls.push({ event, payload }), calls };
}

describe('EffectRegistry built-ins', () => {
  it('heal returns true and emits entity:healed', () => {
    const target = fakeTarget(2, 10);
    const bus = fakeBus();
    const ok = applyEffect({ type: 'heal', value: 5 }, { target, bus });
    expect(ok).toBe(true);
    expect(target.stats.hp).toBe(7);
    expect(bus.calls[0].event).toBe('entity:healed');
  });

  it('heal returns false when target is full', () => {
    const target = fakeTarget(10, 10);
    const ok = applyEffect({ type: 'heal', value: 5 }, { target, bus: fakeBus() });
    expect(ok).toBe(false);
  });

  it('lifesteal heals attacker based on damage dealt', () => {
    const attacker = fakeTarget(5, 20);
    const ok = applyEffect({ type: 'lifesteal', value: 0.5 }, {
      actor: attacker, target: attacker, damageDealt: 6, bus: fakeBus()
    });
    expect(ok).toBe(true);
    expect(attacker.stats.hp).toBe(5 + 3); // ceil(6 * 0.5)
  });

  it('unknown effect warns + returns false', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = applyEffect({ type: 'nope_does_not_exist' }, { target: fakeTarget() });
    expect(ok).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('lists registered effect types', () => {
    const all = listEffects();
    expect(all).toContain('heal');
    expect(all).toContain('lifesteal');
    expect(all).toContain('aoe_damage');
  });

  it('hasEffect predicate', () => {
    expect(hasEffect('heal')).toBe(true);
    expect(hasEffect('zzz')).toBe(false);
  });

  it('registerEffect installs a new type', () => {
    registerEffect('test_double_heal', {
      apply(ctx, eff) {
        const h = ctx.target.heal((eff.value || 0) * 2);
        return h > 0;
      }
    });
    const t = fakeTarget(1, 10);
    expect(applyEffect({ type: 'test_double_heal', value: 3 }, { target: t, bus: fakeBus() })).toBe(true);
    expect(t.stats.hp).toBe(7); // 1 + 3*2
  });
});
