import { describe, it, expect, vi } from 'vitest';
import { ItemFactory } from '../src/items/ItemFactory.js';

const DEFS = {
  iron_sword: {
    id: 'iron_sword', name: 'Iron Sword', slot: 'weapon', type: 'weapon',
    rarity: 'common', stats: { atk: 2 }
  }
};

describe('ItemFactory', () => {
  it('create returns null + warn for unknown id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = new ItemFactory(DEFS);
    expect(f.create('does_not_exist')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('createWithAffix synthesizes name + stats', () => {
    const f = new ItemFactory(DEFS);
    const item = f.createWithAffix('iron_sword', { prefix: 'sharp', suffix: null });
    expect(item.name).toContain('Sharp');
    expect(item.stats.atk).toBe(3);
    expect(item.def.affixes).toEqual({ prefix: 'sharp', suffix: null });
  });

  it('createWithAffix returns plain item when no affixes', () => {
    const f = new ItemFactory(DEFS);
    const item = f.createWithAffix('iron_sword', null);
    expect(item.def.affixes).toBeUndefined();
  });

  it('fromSnapshot rehydrates legacy { id, count } shape', () => {
    const f = new ItemFactory(DEFS);
    const item = f.fromSnapshot({ id: 'iron_sword', count: 1 });
    expect(item.id).toBe('iron_sword');
  });

  it('fromSnapshot rehydrates affixed snapshot', () => {
    const f = new ItemFactory(DEFS);
    const item = f.fromSnapshot({
      id: 'iron_sword', count: 1,
      affixes: { prefix: 'sharp', suffix: 'of_thirst' }
    });
    expect(item.stats.atk).toBeGreaterThan(2);
    expect(item.name).toContain('Sharp');
    expect(item.name).toContain('Thirst');
  });

  it('create does not mutate shared item def stats (worn_dagger meta unlock)', () => {
    const defs = {
      worn_dagger: {
        id: 'worn_dagger', name: 'Worn Dagger', slot: 'weapon', type: 'weapon',
        rarity: 'common', stats: { atk: 1 }
      }
    };
    const f = new ItemFactory(defs);
    const a = f.create('worn_dagger', 1);
    a.stats.atk += 1;
    const b = f.create('worn_dagger', 1);
    expect(defs.worn_dagger.stats.atk).toBe(1);
    expect(b.stats.atk).toBe(1);
    expect(a.stats.atk).toBe(2);
  });

  it('fromSnapshot returns Lost Relic placeholder for missing ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = new ItemFactory(DEFS);
    const item = f.fromSnapshot({ id: 'ghost_item', count: 3 });
    expect(item.name).toBe('Lost Relic');
    expect(item.count).toBe(3);
    expect(item.def.lostId).toBe('ghost_item');
    warn.mockRestore();
  });
});
