import { describe, it, expect } from 'vitest';
import {
  eliteChanceForDepth, rollEliteAffixes, forcedEliteAffixes, makeElite, ELITE_AFFIXES
} from '../src/gameplay/eliteAffixes.js';

// Minimal controllable rng: fixed chance() result + scripted randInt().
function fakeRng(chanceVal, intVals = [0]) {
  let i = 0;
  return {
    chance: () => chanceVal,
    randInt: (a, b) => {
      const v = intVals[i++ % intVals.length];
      return Math.min(b, Math.max(a, v));
    }
  };
}

function fodder() {
  return {
    stats: { hp: 10, hpMax: 10, atk: 4, def: 1 },
    name: 'Goblin Scout', xpReward: 10, goldDrop: [2, 4]
  };
}

describe('eliteChanceForDepth', () => {
  it('ramps with depth and caps at 0.22', () => {
    expect(eliteChanceForDepth(0)).toBeCloseTo(0.04, 5);
    expect(eliteChanceForDepth(10)).toBeGreaterThan(eliteChanceForDepth(0));
    expect(eliteChanceForDepth(10000)).toBe(0.22);
  });
});

describe('rollEliteAffixes', () => {
  it('returns no affixes when the elite roll fails', () => {
    expect(rollEliteAffixes(fakeRng(false), 50)).toEqual([]);
  });

  it('returns a valid affix id when the roll succeeds', () => {
    const ids = rollEliteAffixes(fakeRng(true, [0]), 5);
    expect(ids.length).toBe(1);
    expect(ELITE_AFFIXES[ids[0]]).toBeTruthy();
  });

  it('never picks duplicate affixes', () => {
    const ids = rollEliteAffixes(fakeRng(true, [0, 0]), 40); // deep → up to 2
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('forcedEliteAffixes ignores the spawn gate (always returns ≥1)', () => {
    const ids = forcedEliteAffixes(fakeRng(false, [0]), 5); // chance=false would skip a normal roll
    expect(ids.length).toBeGreaterThanOrEqual(1);
    expect(ELITE_AFFIXES[ids[0]]).toBeTruthy();
  });
});

describe('makeElite', () => {
  it('is a no-op for empty affix lists', () => {
    const e = fodder();
    makeElite(e, []);
    expect(e.elite).toBeUndefined();
    expect(e.stats.atk).toBe(4);
  });

  it('boosts stats, tags, renames, and enriches rewards', () => {
    const e = fodder();
    makeElite(e, ['brutal']);
    expect(e.elite.affixes).toEqual(['brutal']);
    expect(e.stats.atk).toBe(Math.round(4 * 1.4));      // brutal atkMul
    expect(e.stats.hpMax).toBe(Math.round(10 * 1.8));    // base elite hp bump
    expect(e.stats.hp).toBe(e.stats.hpMax);
    expect(e.name.startsWith('Brutal ')).toBe(true);
    expect(e.xpReward).toBe(Math.round(10 * 2.2));
    expect(e.goldDrop).toEqual([Math.round(2 * 2.5), Math.round(4 * 2.5)]);
  });

  it('attaches on-hit riders (vampiric → lifesteal)', () => {
    const e = fodder();
    makeElite(e, ['vampiric']);
    expect(e.onHitPlayer.some((x) => x.type === 'lifesteal')).toBe(true);
  });

  it('caps evasion from swift', () => {
    const e = fodder();
    makeElite(e, ['swift']);
    expect(e.evaBonus).toBeLessThanOrEqual(0.4);
    expect(e.evaBonus).toBeGreaterThan(0);
  });
});
