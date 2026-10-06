import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_BALANCE } from '../src/config/balance.js';
import { EventBus } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { Player } from '../src/entities/Player.js';
import { ALTAR_OPTIONS } from '../src/gameplay/floorEvents.js';
import { applyMysteryChest, buildEventPanelConfig } from '../src/gameplay/floorEventRuntime.js';
import { craft } from '../src/items/Crafting.js';
import { Inventory } from '../src/items/Inventory.js';
import { Item } from '../src/items/Item.js';
import { ItemFactory } from '../src/items/ItemFactory.js';
import { Floor } from '../src/world/Floor.js';

const ITEM_DEFS = {
  minor_healing_draught: {
    id: 'minor_healing_draught', name: 'Minor Healing Draught', type: 'consumable',
    stackable: true, maxStack: 9
  },
  iron_sword: {
    id: 'iron_sword', name: 'Iron Sword', type: 'weapon', slot: 'weapon',
    stats: { atk: 2 }
  },
  scrap_iron: {
    id: 'scrap_iron', name: 'Scrap Iron', type: 'material', stackable: true, maxStack: 99
  },
  crypt_dust: {
    id: 'crypt_dust', name: 'Crypt Dust', type: 'material', stackable: true, maxStack: 99
  }
};

const FORGE_RECIPE = {
  id: 'transaction_forge', inputs: [{ materialId: 'scrap_iron', count: 2 }],
  baseSlot: 'weapon', guaranteedPrefix: 'sharp'
};
const REROLL_RECIPE = {
  id: 'transaction_reroll', inputs: [{ materialId: 'scrap_iron', count: 2 }],
  operation: 'reroll'
};

function eventContext() {
  const inventory = new Inventory(2);
  const player = new Player(DEFAULT_BALANCE, { x: 4, y: 5 }, inventory);
  player.gold = 100;
  player.rangedFocus = 0;
  const bus = new EventBus();
  const pickups = [];
  const fullNotices = [];
  const messages = [];
  bus.on('item:pickedUp', (payload) => pickups.push(payload));
  bus.on('inventory:full', () => fullNotices.push(true));
  bus.on('floor:event', (payload) => messages.push(payload));
  return {
    player, bus, pickups, fullNotices, messages,
    floor: new Floor(0, { index: 0 }, 42),
    rng: new RNG(1234),
    itemDefs: { minor_healing_draught: ITEM_DEFS.minor_healing_draught },
    itemFactory: new ItemFactory(ITEM_DEFS)
  };
}

function fillBag(ctx, potionCount = 0) {
  ctx.player.inventory.add(new Item(
    potionCount ? ITEM_DEFS.minor_healing_draught : ITEM_DEFS.iron_sword,
    potionCount || 1
  ));
  ctx.player.inventory.add(new Item(ITEM_DEFS.iron_sword));
}

function buy(ctx) {
  buildEventPanelConfig('merchant', {}, ctx).onPick('minor_healing_draught');
}

function forgeContext(ctx, itemDefs = ITEM_DEFS) {
  return { itemDefs, rng: ctx.rng, floorLevel: 10 };
}

describe('merchant reward transactions', () => {
  it.each([0, 9])('preserves gold when a full bag cannot accept stock (existing stack: %i)', (count) => {
    const ctx = eventContext();
    fillBag(ctx, count);

    buy(ctx);

    expect(ctx.player.gold).toBe(100);
    expect(ctx.player.inventory.countOf('minor_healing_draught')).toBe(count);
    expect(ctx.pickups).toHaveLength(0);
    expect(ctx.fullNotices).toHaveLength(1);
  });

  it('buys into a partial stack even when every bag slot is occupied', () => {
    const ctx = eventContext();
    fillBag(ctx, 8);

    buy(ctx);

    expect(ctx.player.gold).toBe(88);
    expect(ctx.player.inventory.countOf('minor_healing_draught')).toBe(9);
    expect(ctx.pickups).toHaveLength(1);
    expect(ctx.pickups[0].item.count).toBe(1);
    expect(ctx.fullNotices).toHaveLength(0);
  });

  it('charges once and delivers stock when there is an empty slot', () => {
    const ctx = eventContext();

    buy(ctx);

    expect(ctx.player.gold).toBe(88);
    expect(ctx.player.inventory.countOf('minor_healing_draught')).toBe(1);
    expect(ctx.pickups).toHaveLength(1);
    expect(ctx.fullNotices).toHaveLength(0);
  });

  it('rolls back partial insertion when the entire purchase cannot fit', () => {
    const ctx = eventContext();
    fillBag(ctx, 7);
    const stack = ctx.player.inventory.getSlot(0);
    // Supply a multi-unit reward at the factory boundary; stacking stays real.
    vi.spyOn(ctx.itemFactory, 'create').mockReturnValueOnce(new Item(ITEM_DEFS.minor_healing_draught, 3));

    buy(ctx);

    expect(ctx.player.gold).toBe(100);
    expect(ctx.player.inventory.countOf('minor_healing_draught')).toBe(7);
    expect(ctx.player.inventory.getSlot(0)).toBe(stack);
    expect(ctx.pickups).toHaveLength(0);
    expect(ctx.fullNotices).toHaveLength(1);
    expect(ctx.floor.itemsAt(4, 5)).toHaveLength(0);
  });
});

describe('mystery chest reward transactions', () => {
  it('puts a rejected reward on the ground at the player feet', () => {
    const ctx = eventContext();
    fillBag(ctx);

    applyMysteryChest(ctx);

    expect(ctx.player.inventory.countOf('minor_healing_draught')).toBe(0);
    expect(ctx.pickups).toHaveLength(0);
    const ground = ctx.floor.itemsAt(4, 5);
    expect(ground).toHaveLength(1);
    expect(ground[0].id).toBe('minor_healing_draught');
    expect(ground[0].count).toBe(1);
  });

  it('drops only the overflow after part of a reward joins an existing stack', () => {
    const ctx = eventContext();
    fillBag(ctx, 7);
    vi.spyOn(ctx.itemFactory, 'create').mockReturnValueOnce(new Item(ITEM_DEFS.minor_healing_draught, 3));

    applyMysteryChest(ctx);

    expect(ctx.player.inventory.countOf('minor_healing_draught')).toBe(9);
    const ground = ctx.floor.itemsAt(4, 5);
    expect(ground).toHaveLength(1);
    expect(ground[0].id).toBe('minor_healing_draught');
    expect(ground[0].count).toBe(1);
    expect(ctx.pickups).toHaveLength(1);
    expect(ctx.pickups[0].item.count).toBe(2);
  });

  it('keeps a fully accepted reward in the bag without a duplicate on the ground', () => {
    const ctx = eventContext();
    fillBag(ctx, 8);

    applyMysteryChest(ctx);

    expect(ctx.player.inventory.countOf('minor_healing_draught')).toBe(9);
    expect(ctx.floor.itemsAt(4, 5)).toHaveLength(0);
    expect(ctx.pickups).toHaveLength(1);
    expect(ctx.pickups[0].item.count).toBe(1);
  });
});

describe('craft reward transactions', () => {
  it('returns the full crafted output as numeric overflow for the caller when the bag is full', () => {
    const ctx = eventContext();
    fillBag(ctx);
    ctx.player.addMaterial('scrap_iron', 2);

    const result = craft(ctx.player, FORGE_RECIPE, forgeContext(ctx));

    expect(result.ok).toBe(true);
    expect(result.overflow).toBe(1);
    expect(result.item.id).toBe('iron_sword');
    expect(result.item.count).toBe(1);
    expect(ctx.player.materialCount('scrap_iron')).toBe(0);
    expect(ctx.player.inventory.countOf('iron_sword')).toBe(2);
  });

  it('returns zero overflow after a successful craft into the bag', () => {
    const ctx = eventContext();
    ctx.player.addMaterial('scrap_iron', 3);

    const result = craft(ctx.player, FORGE_RECIPE, forgeContext(ctx));

    expect(result.ok).toBe(true);
    expect(result.overflow).toBe(0);
    expect(result.item.def.affixes.prefix).toBe('sharp');
    expect(ctx.player.inventory.countOf('iron_sword')).toBe(1);
    expect(ctx.player.materialCount('scrap_iron')).toBe(1);
  });

  it('preserves materials when no base definition can produce the recipe output', () => {
    const ctx = eventContext();
    ctx.player.addMaterial('scrap_iron', 2);

    const result = craft(ctx.player, FORGE_RECIPE, forgeContext(ctx, {}));

    expect(result).toEqual({ ok: false, reason: 'no base item matches slot' });
    expect(ctx.player.materialCount('scrap_iron')).toBe(2);
    expect(ctx.player.inventory.countOf('iron_sword')).toBe(0);
  });

  it('preserves reroll inputs when the target base definition is missing', () => {
    const ctx = eventContext();
    ctx.player.addMaterial('scrap_iron', 2);
    const target = new Item(ITEM_DEFS.iron_sword);

    const result = craft(ctx.player, REROLL_RECIPE, {
      ...forgeContext(ctx, {}), targetItem: target
    });

    expect(result).toEqual({ ok: false, reason: 'lost base' });
    expect(ctx.player.materialCount('scrap_iron')).toBe(2);
    expect(target.def).toBe(ITEM_DEFS.iron_sword);
  });

  it('rerolls in place without needing an empty slot or producing ground overflow', () => {
    const ctx = eventContext();
    fillBag(ctx);
    ctx.player.addMaterial('scrap_iron', 2);
    const target = ctx.player.inventory.getSlot(0);

    const result = craft(ctx.player, REROLL_RECIPE, {
      ...forgeContext(ctx), targetItem: target
    });

    expect(result.ok).toBe(true);
    expect(result.item).toBe(target);
    expect(result.overflow).toBe(0);
    expect(ctx.player.materialCount('scrap_iron')).toBe(0);
    expect(ctx.player.inventory.countOf('iron_sword')).toBe(2);
  });

  it('restores earlier inputs if a later material cannot be consumed from the pouch', () => {
    const ctx = eventContext();
    ctx.player.addMaterial('scrap_iron', 2);
    // Legacy bag materials are visible to canCraft, but consumeMaterial uses the pouch.
    ctx.player.inventory.add(new Item(ITEM_DEFS.crypt_dust));
    const recipe = {
      ...FORGE_RECIPE,
      inputs: [{ materialId: 'scrap_iron', count: 2 }, { materialId: 'crypt_dust', count: 1 }]
    };

    const result = craft(ctx.player, recipe, forgeContext(ctx));

    expect(result).toEqual({ ok: false, reason: 'consume failed' });
    expect(ctx.player.materialCount('scrap_iron')).toBe(2);
    expect(ctx.player.inventory.countOf('crypt_dust')).toBe(1);
    expect(ctx.player.inventory.countOf('iron_sword')).toBe(0);
  });

  it('uses a slot freed by legacy input consumption for the crafted output', () => {
    const ctx = eventContext();
    const inventory = new Inventory(1);
    inventory.add(new Item(ITEM_DEFS.scrap_iron, 2));

    const result = craft({ inventory }, FORGE_RECIPE, forgeContext(ctx));

    expect(result.ok).toBe(true);
    expect(result.overflow).toBe(0);
    expect(inventory.countOf('scrap_iron')).toBe(0);
    expect(inventory.countOf('iron_sword')).toBe(1);
  });
});

describe('altar material payment transactions', () => {
  it('consumes exactly two materials from one type before restoring focus', () => {
    const ctx = eventContext();
    ctx.player.addMaterial('scrap_iron', 3);

    buildEventPanelConfig('altar_sacrifice', {}, ctx).onPick('sacrifice_material');

    expect(ctx.player.materialCount('scrap_iron')).toBe(1);
    expect(ctx.player.rangedFocus).toBe(3);
  });

  it('consumes a split payment of one material from each of two types', () => {
    const ctx = eventContext();
    ctx.player.addMaterial('scrap_iron', 1);
    ctx.player.addMaterial('crypt_dust', 1);

    buildEventPanelConfig('altar_sacrifice', {}, ctx).onPick('sacrifice_material');

    expect(ctx.player.materialCount('scrap_iron')).toBe(0);
    expect(ctx.player.materialCount('crypt_dust')).toBe(0);
    expect(ctx.player.rangedFocus).toBe(3);
  });

  it('leaves other types intact when one type covers the entire payment', () => {
    const ctx = eventContext();
    ctx.player.addMaterial('scrap_iron', 1);
    ctx.player.addMaterial('crypt_dust', 3);

    buildEventPanelConfig('altar_sacrifice', {}, ctx).onPick('sacrifice_material');

    expect(ctx.player.materialCount('scrap_iron')).toBe(1);
    expect(ctx.player.materialCount('crypt_dust')).toBe(1);
    expect(ctx.player.rangedFocus).toBe(3);
  });

  it('rejects an insufficient payment without consuming its one material or restoring focus', () => {
    const ctx = eventContext();
    ctx.player.addMaterial('scrap_iron', 1);
    const option = ALTAR_OPTIONS.find((entry) => entry.id === 'sacrifice_material');

    option.apply(ctx.player);

    expect(ctx.player.materialCount('scrap_iron')).toBe(1);
    expect(ctx.player.rangedFocus).toBe(0);
  });

  it('restores the first type if the second consumption fails and reports no boon', () => {
    const ctx = eventContext();
    ctx.player.addMaterial('scrap_iron', 1);
    ctx.player.addMaterial('crypt_dust', 1);
    const consume = ctx.player.consumeMaterial.bind(ctx.player);
    vi.spyOn(ctx.player, 'consumeMaterial')
      .mockImplementationOnce(consume)
      .mockReturnValueOnce(false);

    buildEventPanelConfig('altar_sacrifice', {}, ctx).onPick('sacrifice_material');

    expect(ctx.player.materialCount('scrap_iron')).toBe(1);
    expect(ctx.player.materialCount('crypt_dust')).toBe(1);
    expect(ctx.player.rangedFocus).toBe(0);
    expect(ctx.messages).toHaveLength(0);
  });
});
