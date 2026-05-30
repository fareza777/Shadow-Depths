import { describe, it, expect } from 'vitest';
import {
  HAZARDS, trapCountForDepth, pickHazardType, hazardDamage
} from '../src/gameplay/hazards.js';
import { Tile } from '../src/world/Tile.js';

function seqRng(ints = [0]) {
  let i = 0;
  return {
    // Clamp to [a,b] like the real RNG so out-of-range scripts can't return
    // an index the production code would never produce.
    randInt: (a, b) => Math.min(b, Math.max(a, ints[i++ % ints.length])),
    chance: () => false
  };
}

describe('Tile', () => {
  it('defaults hazard to null', () => {
    expect(new Tile(1, 2).hazard).toBeNull();
  });
});

describe('trapCountForDepth', () => {
  it('stays within the configured band and ramps with depth', () => {
    const cfg = { min: 1, max: 4 };
    expect(trapCountForDepth(0, { randInt: (a) => a }, cfg)).toBe(1);
    // deeper raises the lower bound
    expect(trapCountForDepth(40, { randInt: (a) => a }, cfg)).toBe(4);
    const n = trapCountForDepth(0, { randInt: (a, b) => b }, cfg);
    expect(n).toBeLessThanOrEqual(4);
  });
});

describe('pickHazardType', () => {
  it('only spikes in the shallow floors', () => {
    expect(pickHazardType(seqRng([0]), 0)).toBe('spike');
    expect(pickHazardType(seqRng([3]), 2)).toBe('spike');
  });
  it('unlocks elemental vents with depth', () => {
    const t = pickHazardType(seqRng([1]), 10);
    expect(Object.keys(HAZARDS)).toContain(t);
  });
});

describe('hazardDamage', () => {
  it('scales with depth and respects the type multiplier', () => {
    expect(hazardDamage('spike', 0, 4)).toBe(4);
    expect(hazardDamage('spike', 20, 4)).toBeGreaterThan(hazardDamage('spike', 0, 4));
    // venom hits softer than spike at the same depth (it has a DoT rider)
    expect(hazardDamage('venom', 20, 4)).toBeLessThan(hazardDamage('spike', 20, 4));
    expect(hazardDamage('spike', 0, 0)).toBeGreaterThanOrEqual(2); // min floor
  });
});
