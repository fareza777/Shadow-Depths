/**
 * Quick-use helpers — consumables / throwables without opening the satchel.
 */

const QUICK_USE_MAX = 3;

/**
 * @param {import('./Item.js').Item|null} item
 * @returns {boolean}
 */
export function isQuickUsable(item) {
  if (!item || item.slot) return false;
  if (item.effects?.length) return true;
  if (item.target === 'tile') return true;
  return false;
}

/**
 * First N inventory indices that can be used in combat (left-to-right).
 * @param {import('./Inventory.js').Inventory} inventory
 * @param {number} [max]
 * @returns {number[]}
 */
export function findQuickUseSlots(inventory, max = QUICK_USE_MAX) {
  const out = [];
  if (!inventory?.slots) return out;
  for (let i = 0; i < inventory.slots.length && out.length < max; i++) {
    if (isQuickUsable(inventory.slots[i])) out.push(i);
  }
  return out;
}

export const QUICK_USE_SLOT_COUNT = QUICK_USE_MAX;
