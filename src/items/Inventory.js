/**
 * Inventory — fixed-slot bag with stacking + hotkey access.
 *
 * Sized by balance.player.inventorySlots (default 9, matching hotkeys 1-9).
 * Empty slots store `null` rather than being absent, so the UI can render
 * the grid declaratively.
 */
export class Inventory {
  /**
   * @param {number} size
   */
  constructor(size = 9) {
    this.size = size;
    /** @type {(import('./Item.js').Item|null)[]} */
    this.slots = new Array(size).fill(null);
  }

  /**
   * Try to add an item to the bag, merging into existing stacks first then
   * filling the first empty slot.
   *
   * @param {import('./Item.js').Item} item
   * @returns {{ added:boolean, overflow:number }}
   */
  add(item) {
    if (!item) return { added: false, overflow: 0 };
    let remaining = item.count;

    // Stack into existing partial stacks.
    if (item.stackable) {
      for (const slot of this.slots) {
        if (remaining <= 0) break;
        if (slot && slot.canStackWith(item) && slot.count < slot.maxStack) {
          const overflow = slot.addToStack(remaining);
          remaining = overflow;
        }
      }
    }

    // Fill empty slots with the leftover.
    while (remaining > 0) {
      const idx = this.slots.indexOf(null);
      if (idx === -1) break;
      const chunkSize = Math.min(remaining, item.maxStack);
      const chunk = item.clone(chunkSize);
      this.slots[idx] = chunk;
      remaining -= chunkSize;
    }

    return { added: remaining < item.count, overflow: remaining };
  }

  /** Slot accessors. Index is 0-based; hotkey 1 = slot 0. */
  getSlot(index) {
    if (index < 0 || index >= this.size) return null;
    return this.slots[index];
  }

  /**
   * Take a single unit (or the whole non-stackable item) from a slot.
   * Returns the removed Item or null. Empties the slot if stack runs out.
   */
  takeOne(index) {
    const slot = this.slots[index];
    if (!slot) return null;
    if (slot.stackable && slot.count > 1) {
      const out = slot.clone(1);
      slot.count -= 1;
      return out;
    }
    this.slots[index] = null;
    return slot;
  }

  /** Remove the whole stack/item from a slot. */
  takeAll(index) {
    const slot = this.slots[index];
    if (!slot) return null;
    this.slots[index] = null;
    return slot;
  }

  /** Put an item into a specific slot (used when swapping equipment back in). */
  putAt(index, item) {
    if (index < 0 || index >= this.size) return false;
    if (this.slots[index] !== null) return false;
    this.slots[index] = item;
    return true;
  }

  isFull() {
    return this.slots.every((s) => s !== null);
  }

  countOf(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  /** First slot containing an item with the given id (or -1). */
  findSlotOf(id) {
    return this.slots.findIndex((s) => s && s.id === id);
  }

  /** Serialize to a save-friendly snapshot. */
  toSnapshot() {
    return this.slots.map((s) => (s ? { id: s.id, count: s.count } : null));
  }

  /** Inverse of toSnapshot(). Mutates this inventory in place. */
  loadSnapshot(snap, factory) {
    if (!Array.isArray(snap)) return;
    const out = new Array(this.size).fill(null);
    for (let i = 0; i < Math.min(snap.length, this.size); i++) {
      const s = snap[i];
      if (!s) continue;
      const item = factory.fromSnapshot(s);
      if (item) out[i] = item;
    }
    this.slots = out;
  }
}
