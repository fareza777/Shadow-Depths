/**
 * Canonical base stats for items whose JSON defs may have been mutated
 * in-memory by older builds (shared reference bug on worn_dagger).
 */
export const CANONICAL_ITEM_STATS = {
  worn_dagger: { atk: 1 }
};

/** True worn dagger ATK for display/combat (meta unlock = +1). */
export function wornDaggerAtk(meta) {
  const base = CANONICAL_ITEM_STATS.worn_dagger.atk;
  if (meta?.unlocks?.includes('worn_dagger')) return base + 1;
  return base;
}

export function applyCanonicalItemStats(item, meta) {
  if (!item?.id || !CANONICAL_ITEM_STATS[item.id]) return;
  if (item.def?.affixes?.prefix || item.def?.affixes?.suffix) return;
  if (item.id === 'worn_dagger') {
    item.stats = { atk: wornDaggerAtk(meta) };
    return;
  }
  item.stats = { ...CANONICAL_ITEM_STATS[item.id] };
}

export function repairItemDefStats(defs) {
  if (!defs) return;
  for (const [id, canon] of Object.entries(CANONICAL_ITEM_STATS)) {
    if (defs[id]?.stats) defs[id].stats = { ...canon };
  }
}
