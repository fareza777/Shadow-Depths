import { describe, it, expect } from 'vitest';
import {
  isIdentified, identify, displayName, isHiddenType, identifiedSet
} from '../src/items/Identification.js';

function item(type, id = 'x', name = 'Crimson Phial') {
  return { id, name, def: { id, name, type, rarity: 'common' } };
}

describe('Identification', () => {
  it('weapons are always identified (visible kind)', () => {
    const meta = { identifiedFamilies: [] };
    expect(isIdentified(item('weapon'), meta)).toBe(true);
  });

  it('consumables hide until identified', () => {
    const meta = { identifiedFamilies: [] };
    const it1 = item('consumable', 'health_potion', 'Health Potion');
    expect(isIdentified(it1, meta)).toBe(false);
    identify('health_potion', meta);
    expect(isIdentified(it1, meta)).toBe(true);
  });

  it('identify is idempotent', () => {
    const meta = { identifiedFamilies: [] };
    expect(identify('p', meta)).toBe(true);
    expect(identify('p', meta)).toBe(false);
  });

  it('displayName falls back to type-specific hidden label', () => {
    const meta = { identifiedFamilies: [] };
    const r = item('ring', 'ring_of_x', 'Ring of X');
    expect(displayName(r, meta)).toBe('Tarnished Ring');
    identify('ring_of_x', meta);
    expect(displayName(r, meta)).toBe('Ring of X');
  });

  it('identifiedSet returns a Set with current ids', () => {
    const meta = { identifiedFamilies: ['a', 'b'] };
    const s = identifiedSet(meta);
    expect(s.has('a')).toBe(true);
    expect(s.has('z')).toBe(false);
  });

  it('isHiddenType true for ring/scroll/etc', () => {
    expect(isHiddenType('ring')).toBe(true);
    expect(isHiddenType('weapon')).toBe(false);
  });
});
