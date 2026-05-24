/**
 * LoreDatabase — read-only access to lore.json.
 *
 * Items already carry an inline `lore` string from items.json (used as the
 * tooltip default). This class is the global lookup — useful for UI that
 * needs world / floor / enemy flavor that doesn't live on an entity.
 *
 * v0.5 (narrative pass) will expand this to multi-paragraph entries and the
 * DialogueSystem will gain real teeth. Today it's just lookups.
 */
export class LoreDatabase {
  /**
   * @param {object} loreJson content.lore
   */
  constructor(loreJson) {
    this._data = loreJson || { world: {}, floors: {}, enemies: {}, items: {} };
  }

  world(field = 'premise') {
    return this._data.world?.[field] || '';
  }

  floor(slugOrName) {
    if (!slugOrName) return '';
    const key = LoreDatabase._slug(slugOrName);
    return this._data.floors?.[key] || '';
  }

  enemy(id) {
    return this._data.enemies?.[id] || '';
  }

  item(id) {
    return this._data.items?.[id] || '';
  }

  static _slug(s) {
    return String(s).toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }
}
