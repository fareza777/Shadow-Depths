/**
 * ItemFactory — turn item ids into Item instances.
 *
 * Single source of truth: every item that exists at runtime came through
 * here. That way save/load can serialize as `{ id, count }` and rehydrate
 * trivially, and adding a new item is exclusively a JSON change.
 */
import { LOG } from '../config/constants.js';
import { Item } from './Item.js';
import { synthesizeDef } from './itemGenerator.js';

/** Used when a save references an item id no longer present in items.json. */
const LOST_RELIC_DEF = Object.freeze({
  id: '__lost_relic__',
  name: 'Lost Relic',
  type: 'misc',
  rarity: 'common',
  spriteKey: 'item_default',
  stackable: true,
  maxStack: 99,
  lore: 'The depths swallowed its history.'
});

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

  /**
   * Create an item with affixes rolled by the item generator.
   * @param {string} id base item id
   * @param {{ prefix?:string|null, suffix?:string|null } | null} affixes
   * @param {number} [count]
   */
  createWithAffix(id, affixes, count = 1) {
    const base = this.defs[id];
    if (!base) {
      console.warn(LOG.ITEM, `unknown item id "${id}"`);
      return null;
    }
    if (!affixes || (!affixes.prefix && !affixes.suffix)) {
      return new Item(base, count);
    }
    return new Item(synthesizeDef(base, affixes), count);
  }

  /**
   * Rehydrate from a save snapshot. Accepts the legacy shape `{ id, count }`
   * and the new affixed shape `{ id, count, affixes: { prefix, suffix } }`.
   *
   * If the base id has vanished from items.json (content was removed in a
   * patch), we substitute a "Lost Relic" placeholder so loading the save
   * never crashes the game.
   */
  fromSnapshot(snap) {
    if (!snap || !snap.id) return null;
    if (!this.defs[snap.id]) {
      console.warn(LOG.ITEM, `save references missing item "${snap.id}" — substituting Lost Relic`);
      const def = { ...LOST_RELIC_DEF, lostId: snap.id };
      return new Item(def, snap.count ?? 1);
    }
    return this.createWithAffix(snap.id, snap.affixes || null, snap.count ?? 1);
  }

  /** All defs as an array — convenience for spawn-weighting. */
  list() {
    return Object.values(this.defs);
  }
}
