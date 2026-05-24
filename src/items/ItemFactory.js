/**
 * ItemFactory — turn item ids into Item instances.
 *
 * Single source of truth: every item that exists at runtime came through
 * here. That way save/load can serialize as `{ id, count }` and rehydrate
 * trivially, and adding a new item is exclusively a JSON change.
 */
import { LOG } from '../config/constants.js';
import { Item } from './Item.js';

export class ItemFactory {
  /**
   * @param {Record<string, object>} defs content.items
   */
  constructor(defs) {
    this.defs = defs || {};
  }

  has(id) {
    return Object.prototype.hasOwnProperty.call(this.defs, id);
  }

  /**
   * @param {string} id
   * @param {number} [count]
   * @returns {Item|null}
   */
  create(id, count = 1) {
    const def = this.defs[id];
    if (!def) {
      console.warn(LOG.ITEM, `unknown item id "${id}"`);
      return null;
    }
    return new Item(def, count);
  }

  /** Rehydrate from a save snapshot ({ id, count }). */
  fromSnapshot(snap) {
    if (!snap || !snap.id) return null;
    return this.create(snap.id, snap.count ?? 1);
  }

  /** All defs as an array — convenience for spawn-weighting. */
  list() {
    return Object.values(this.defs);
  }
}
