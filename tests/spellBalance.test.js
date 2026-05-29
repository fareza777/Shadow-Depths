import { describe, it, expect } from 'vitest';
import { hollowSiphonHeal, SPELL_TUNING } from '../src/config/spellBalance.js';

describe('spellBalance', () => {
  it('caps Hollow Siphon heal per cast', () => {
    const player = { spellLifesteal: 0 };
    expect(hollowSiphonHeal(20, player)).toBe(SPELL_TUNING.hollow.healCap);
    expect(hollowSiphonHeal(4, player)).toBe(2);
  });
});
