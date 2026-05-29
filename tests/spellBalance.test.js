import { describe, it, expect } from 'vitest';
import { hollowSiphonHeal, SPELL_TUNING } from '../src/config/spellBalance.js';
import { passiveFlatDamageReduction } from '../src/gameplay/heroPassives.js';

describe('spellBalance', () => {
  it('caps Hollow Siphon heal per cast', () => {
    const player = { spellLifesteal: 0 };
    expect(hollowSiphonHeal(20, player)).toBe(SPELL_TUNING.hollow.healCap);
    expect(hollowSiphonHeal(4, player)).toBe(2);
  });
});

describe('echobinder survival', () => {
  it('reduces damage when wounded', () => {
    const player = {
      kind: 'player',
      heroKind: 'echobinder',
      stats: { hp: 10, hpMax: 30 }
    };
    expect(passiveFlatDamageReduction(player, {}, { kind: 'enemy' })).toBe(2);
    player.stats.hp = 28;
    expect(passiveFlatDamageReduction(player, {}, { kind: 'enemy' })).toBe(0);
  });

  it('has stronger early spell burst than before', () => {
    expect(SPELL_TUNING.echobinder.burst(1, 0)).toBeGreaterThanOrEqual(8);
  });
});
