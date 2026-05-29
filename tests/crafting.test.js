import { describe, it, expect } from 'vitest';
import { loadRecipes, getRecipe, canCraft, craft, chooseForgeOffers } from '../src/items/Crafting.js';
import { Item } from '../src/items/Item.js';

loadRecipes({
  recipes: [
    {
      id: 'forge_test',
      name: 'Test Forge',
      inputs: [{ materialId: 'scrap_iron', count: 2 }],
      baseSlot: 'weapon',
      guaranteedPrefix: 'sharp'
    },
    {
      id: 'reroll_test',
      name: 'Re-roll',
      inputs: [{ materialId: 'scrap_iron', count: 1 }],
      operation: 'reroll'
    }
  ]
});

const ITEM_DEFS = {
  scrap_iron: { id: 'scrap_iron', name: 'Scrap', type: 'material', stackable: true, maxStack: 99 },
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', slot: 'weapon', type: 'weapon', rarity: 'common', stats: { atk: 2 } }
};

function fakeInventory(stacks = []) {
  const size = 20;
  const slots = new Array(size).fill(null);
  for (let i = 0; i < stacks.length; i++) slots[i] = stacks[i];
  return {
    size, slots,
    add(item) {
      // Try to stack first.
      if (item.stackable) {
        for (const s of this.slots) {
          if (s && s.id === item.id) {
            const room = (s.maxStack || 99) - s.count;
            if (room >= item.count) { s.count += item.count; return 0; }
          }
        }
      }
      const idx = this.slots.findIndex((s) => s === null);
      if (idx < 0) return item.count;
      this.slots[idx] = item;
      return 0;
    }
  };
}

function fakeRng() {
  return {
    next() { return 0.5; },
    chance(p) { return 0.5 < p; },
    pick(arr) { return arr[0]; },
    weightedPick(weighted) { return weighted[0].value; }
  };
}

describe('canCraft', () => {
  it('reports missing materials', () => {
    const player = { inventory: fakeInventory() };
    const r = canCraft(player, getRecipe('forge_test'));
    expect(r.ok).toBe(false);
    expect(r.missing[0].id).toBe('scrap_iron');
    expect(r.missing[0].need).toBe(2);
    expect(r.missing[0].have).toBe(0);
  });

  it('passes when materials are present', () => {
    const inv = fakeInventory([new Item(ITEM_DEFS.scrap_iron, 5)]);
    const player = { inventory: inv };
    const r = canCraft(player, getRecipe('forge_test'));
    expect(r.ok).toBe(true);
  });

  it('counts materials from the material pouch without occupying bag slots', () => {
    const player = {
      inventory: fakeInventory(),
      materials: { scrap_iron: 3 },
      materialCount(id) { return this.materials[id] || 0; },
      consumeMaterial(id, count) {
        if ((this.materials[id] || 0) < count) return false;
        this.materials[id] -= count;
        return true;
      }
    };
    const r = craft(player, getRecipe('forge_test'), {
      itemDefs: ITEM_DEFS, rng: fakeRng(), floorLevel: 10
    });
    expect(r.ok).toBe(true);
    expect(player.materials.scrap_iron).toBe(1);
    expect(player.inventory.slots[0]?.id).toBe('iron_sword');
  });
});

describe('chooseForgeOffers', () => {
  it('prefers recipes the player can craft', () => {
    const player = {
      materials: { scrap_iron: 5 },
      materialCount(id) { return this.materials[id] || 0; }
    };
    const offers = chooseForgeOffers(fakeRng(), 10, 3, { player, biomeId: 'forgotten_crypts' });
    expect(offers).toContain('forge_test');
    expect(offers.length).toBeGreaterThan(0);
  });
});

describe('craft', () => {
  it('consumes materials and emits an item with guaranteed prefix', () => {
    const inv = fakeInventory([new Item(ITEM_DEFS.scrap_iron, 5)]);
    const player = { inventory: inv };
    const r = craft(player, getRecipe('forge_test'), {
      itemDefs: ITEM_DEFS, rng: fakeRng(), floorLevel: 10
    });
    expect(r.ok).toBe(true);
    expect(r.item).toBeDefined();
    expect(r.item.def.affixes.prefix).toBe('sharp');
    // 2 materials consumed
    const remaining = inv.slots.find((s) => s?.id === 'scrap_iron');
    expect(remaining.count).toBe(3);
  });

  it('refuses to craft without materials', () => {
    const player = { inventory: fakeInventory() };
    const r = craft(player, getRecipe('forge_test'), {
      itemDefs: ITEM_DEFS, rng: fakeRng(), floorLevel: 10
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('missing materials');
  });

  it('reroll regenerates affixes on an existing item in place', () => {
    const target = new Item(ITEM_DEFS.iron_sword, 1);
    const inv = fakeInventory([new Item(ITEM_DEFS.scrap_iron, 3)]);
    const player = { inventory: inv };
    const r = craft(player, getRecipe('reroll_test'), {
      itemDefs: ITEM_DEFS, rng: fakeRng(), floorLevel: 30, targetItem: target
    });
    expect(r.ok).toBe(true);
    // target item is mutated, not replaced
    expect(r.item).toBe(target);
  });
});
