import { describe, it, expect } from 'vitest';
import { rollItemAffixes, synthesizeDef } from '../src/items/itemGenerator.js';
import { PREFIXES, SUFFIXES } from '../src/content/affixes.js';

function makeRng(seq) {
  let i = 0;
  return {
    next() { return seq[i++ % seq.length]; },
    chance(p) { return this.next() < p; },
    pick(arr) {
      const r = this.next();
      return arr[Math.floor(r * arr.length)];
    }
  };
}

describe('rollItemAffixes', () => {
  it('returns null for items without a slot', () => {
    const r = rollItemAffixes({ id: 'potion', name: 'P', type: 'consumable' }, 10, makeRng([0.5]));
    expect(r).toBeNull();
  });

  it('respects tier cap at low floors', () => {
    const base = { id: 'iron_sword', slot: 'weapon', type: 'weapon', name: 'Iron Sword', rarity: 'common' };
    // Force a prefix roll (r < 0.55, > 0.25) by feeding 0.3
    const r = rollItemAffixes(base, 5, makeRng([0.3, 0.0]));
    if (r?.prefix) {
      const p = PREFIXES.find((a) => a.id === r.prefix);
      expect(p.tier).toBeLessThanOrEqual(1);
    }
  });

  it('high floor unlocks tier 3 affixes', () => {
    const base = { id: 'iron_sword', slot: 'weapon', type: 'weapon', name: 'X', rarity: 'common' };
    // Force prefix roll on every iteration; check we see at least one tier-3.
    let sawT3 = false;
    for (let i = 0; i < 50; i++) {
      const rng = makeRng([0.3, i / 50]);
      const r = rollItemAffixes(base, 80, rng);
      if (r?.prefix) {
        const p = PREFIXES.find((a) => a.id === r.prefix);
        if (p?.tier === 3) sawT3 = true;
      }
    }
    expect(sawT3).toBe(true);
  });

  it('25% no-affix branch returns null', () => {
    const base = { id: 'x', slot: 'weapon', type: 'weapon', name: 'X', rarity: 'common' };
    expect(rollItemAffixes(base, 30, makeRng([0.1]))).toBeNull();
  });
});

describe('synthesizeDef', () => {
  it('returns base def unchanged when affixes are null', () => {
    const base = { id: 'x', name: 'X', stats: { atk: 1 } };
    expect(synthesizeDef(base, null)).toBe(base);
  });

  it('merges prefix statMods additively', () => {
    const base = { id: 'x', name: 'Iron Sword', stats: { atk: 2 }, rarity: 'common' };
    const out = synthesizeDef(base, { prefix: 'sharp', suffix: null });
    expect(out.stats.atk).toBe(3);            // sharp adds +1
    expect(out.name.startsWith('Sharp')).toBe(true);
  });

  it('appends prefix + suffix triggers', () => {
    const base = { id: 'x', name: 'Iron Sword', stats: {}, rarity: 'common' };
    const out = synthesizeDef(base, { prefix: 'burning', suffix: 'of_fury' });
    expect(Array.isArray(out.triggers)).toBe(true);
    expect(out.triggers.length).toBeGreaterThanOrEqual(2);
  });

  it('bumps rarity one rank per affix', () => {
    const base = { id: 'x', name: 'X', stats: {}, rarity: 'common' };
    expect(synthesizeDef(base, { prefix: 'sharp' }).rarity).toBe('uncommon');
    expect(synthesizeDef(base, { prefix: 'sharp', suffix: 'of_warding' }).rarity).toBe('rare');
  });

  it('rarity bump caps at legendary', () => {
    const base = { id: 'x', name: 'X', stats: {}, rarity: 'epic' };
    expect(synthesizeDef(base, { prefix: 'sharp', suffix: 'of_warding' }).rarity).toBe('legendary');
  });

  it('records affix ids on synthesized def for save round-trip', () => {
    const base = { id: 'x', name: 'X', stats: {}, rarity: 'common' };
    const out = synthesizeDef(base, { prefix: 'sharp', suffix: 'of_thirst' });
    expect(out.affixes).toEqual({ prefix: 'sharp', suffix: 'of_thirst' });
  });
});
