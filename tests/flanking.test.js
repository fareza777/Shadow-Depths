import { describe, it, expect } from 'vitest';
import { dirTo, flankMultiplier } from '../src/gameplay/flanking.js';

const cfg = { backstabMult: 1.5, flankMult: 1.15 };

describe('dirTo', () => {
  it('returns a unit-ish direction', () => {
    expect(dirTo({ x: 0, y: 0 }, { x: 3, y: -2 })).toEqual({ x: 1, y: -1 });
    expect(dirTo({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual({ x: 0, y: 0 });
  });
});

describe('flankMultiplier', () => {
  const defender = { x: 5, y: 5, facing: { x: 0, y: 1 } }; // facing south

  it('is 1 when the defender has no facing', () => {
    expect(flankMultiplier({ x: 5, y: 4 }, { x: 5, y: 5 }, cfg)).toBe(1);
  });

  it('backstabs from behind the facing', () => {
    expect(flankMultiplier({ x: 5, y: 4 }, defender, cfg)).toBe(1.5); // north = behind
  });

  it('flanks from the side', () => {
    expect(flankMultiplier({ x: 6, y: 5 }, defender, cfg)).toBe(1.15); // east = side
  });

  it('no bonus from the front', () => {
    expect(flankMultiplier({ x: 5, y: 6 }, defender, cfg)).toBe(1); // south = front
  });

  it('treats a co-located attacker as neutral', () => {
    expect(flankMultiplier({ x: 5, y: 5 }, defender, cfg)).toBe(1);
  });
});
