/**
 * Item — a live, in-world instance of an item definition.
 *
 * The JSON entry (`def`) is the immutable blueprint; an Item wraps it with
 * mutable per-instance state (stack count, durability later, etc.). Two
 * Health Potions in the same stack share one def but are one Item.
 */
export class Item {
  /**
   * @param {object} def entry from data/items.json
   * @param {number} [count] starting stack size
   */
  constructor(def, count = 1) {
    if (!def || !def.id) throw new Error('Item: def with id required');
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.type = def.type;
    this.rarity = def.rarity || 'common';
    this.slot = def.slot || null;
    this.spriteKey = def.spriteKey || 'item_default';
    this.stackable = !!def.stackable;
    this.maxStack = def.maxStack || (this.stackable ? 9 : 1);
    this.count = Math.min(count, this.maxStack);
    // Clone stat bag so meta unlocks / equip never mutate shared JSON defs.
    this.stats = def.stats ? { ...def.stats } : null;
    this.effects = def.effects || null;
    this.onHit = def.onHit || null;
    this.proc = def.proc || null;
    this.triggers = def.triggers || null;
    this.target = def.target || null;
    this.range = def.range || 0;
    this.lore = def.lore || '';
  }

  canStackWith(other) {
    return this.stackable && other && other.id === this.id && other.stackable;
  }

  /** Add to stack up to maxStack. Returns the overflow (0 if all absorbed). */
  addToStack(amount) {
    const room = this.maxStack - this.count;
    const taken = Math.min(room, amount);
    this.count += taken;
    return amount - taken;
  }

  /** Remove one from the stack. Returns true if stack is now empty. */
  consumeOne() {
    this.count = Math.max(0, this.count - 1);
    return this.count === 0;
  }

  clone(count = this.count) {
    return new Item(this.def, count);
  }
}
