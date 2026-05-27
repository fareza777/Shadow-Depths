/**
 * Item identification system.
 *
 * Some item families (potions, scrolls, rings, tomes) drop unidentified.
 * Their real name + effects are hidden until the player identifies them
 * by:
 *   - using / equipping the item (auto-identifies on first interaction)
 *   - reading a scroll_of_identify (consumes the scroll)
 *   - clearing a floor (free identify for one random unknown item)
 *
 * Once a base item id is identified, EVERY instance the player ever
 * sees again is identified — tracked per save in meta.identifiedFamilies.
 *
 * Affixed items (Sharp Iron Sword of Thirst) only require base-id
 * identification; the affixes themselves are always visible (they
 * affect sprite via composer, so hiding them would be weird).
 *
 * Identifiable types: 'consumable', 'scroll', 'tome', 'phial', 'ring',
 * 'necklace'. Weapons/armor are always identified (you can see what
 * shape a blade is).
 */

const HIDDEN_TYPES = new Set(['consumable', 'scroll', 'tome', 'phial', 'ring', 'necklace']);

/** Per-type cosmetic name when unidentified. */
const HIDDEN_LABEL = {
  consumable: 'Curious Phial',
  scroll:     'Sealed Scroll',
  tome:       'Bound Tome',
  phial:      'Murky Phial',
  ring:       'Tarnished Ring',
  necklace:   'Dim Amulet'
};

/** Tracks identified item ids in meta state. Returns a Set view. */
export function identifiedSet(meta) {
  if (!meta) return new Set();
  if (!Array.isArray(meta.identifiedFamilies)) meta.identifiedFamilies = [];
  return new Set(meta.identifiedFamilies);
}

export function isIdentified(item, meta) {
  if (!item || !item.def) return true;
  if (!HIDDEN_TYPES.has(item.def.type)) return true;
  return identifiedSet(meta).has(item.id);
}

/**
 * Mark an item id as identified. Idempotent. Returns true if this was
 * the first identification.
 */
export function identify(itemId, meta) {
  if (!itemId || !meta) return false;
  if (!Array.isArray(meta.identifiedFamilies)) meta.identifiedFamilies = [];
  if (meta.identifiedFamilies.includes(itemId)) return false;
  meta.identifiedFamilies.push(itemId);
  return true;
}

/** Display name — real or hidden depending on identification state. */
export function displayName(item, meta) {
  if (!item) return '';
  if (isIdentified(item, meta)) return item.name;
  return HIDDEN_LABEL[item.def?.type] || 'Unknown';
}

/** True if this type ever needs identification (used by UI to draw '?'). */
export function isHiddenType(type) {
  return HIDDEN_TYPES.has(type);
}
