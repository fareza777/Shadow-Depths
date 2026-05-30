import { describe, it, expect } from 'vitest';
import {
  eliteChanceForDepth, affixPoolForDepth, rollEliteAffixes, forcedEliteAffixes,
  makeElite, ELITE_AFFIXES
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
  it('is softer on early floors and caps at 0.22 deep', () => {
    expect(eliteChanceForDepth(0)).toBeCloseTo(0.025, 5);
    expect(eliteChanceForDepth(2)).toBeLessThan(eliteChanceForDepth(10));
    expect(eliteChanceForDepth(10000)).toBe(0.22);
  });
});

describe('affixPoolForDepth', () => {
  it('excludes venomous on floors 1–3 (depth 0–2)', () => {
    expect(affixPoolForDepth(0)).not.toContain('venomous');
    expect(affixPoolForDepth(2)).not.toContain('venomous');
    expect(affixPoolForDepth(3)).toContain('venomous');
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

  it('uses a lighter HP bump on shallow floors', () => {
    const e = fodder();
    makeElite(e, ['brutal'], 0);
    expect(e.stats.hpMax).toBe(Math.round(10 * 1.55));
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
