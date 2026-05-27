/**
 * Set bonus engine.
 *
 * data/sets.json declares sets like:
 *   { id, name, pieces: ['iron_helm', 'iron_armor', 'iron_legs'],
 *     bonuses: [{ count: 2, statMods, triggers }, { count: 3, ... }] }
 *
 * On every equip / unequip the player calls recomputeSetBonuses(player, defs)
 * which:
 *   1. Tallies how many equipped items match each set's pieces (by base id).
 *   2. Picks the highest-count bonus the player qualifies for per set.
 *   3. Writes the aggregated statMods to player.setStatMods and the merged
 *      trigger list to player.setTriggers — the TriggerSystem already
 *      reads anything on equippedPieces(), and we expose setTriggers via
 *      a synthetic piece so it gets picked up automatically.
 */

let SET_DEFS = [];

/** Load sets.json once at boot. */
export function loadSetDefs(setsJson) {
  SET_DEFS = Array.isArray(setsJson?.sets) ? setsJson.sets : [];
}

export function listSets() {
  return SET_DEFS;
}

/**
 * Compute active set bonuses for a player.
 * @param {object} player
 * @returns {{ statMods: object, triggers: object[], active: Array<{set, count, bonus}> }}
 */
export function computeSetBonuses(player) {
  const equipped = typeof player.equippedPieces === 'function'
    ? player.equippedPieces()
    : [];
  // Base id (without affixes) — affixed gear still counts toward set.
  const baseIds = new Set(equipped.map((p) => p.id));
  const statMods = {};
  const triggers = [];
  const active = [];

  for (const set of SET_DEFS) {
    const count = set.pieces.reduce((n, pid) => n + (baseIds.has(pid) ? 1 : 0), 0);
    if (count < 2) continue;
    // Pick the highest-threshold bonus we qualify for. Multiple-tier bonuses
    // STACK: 2-piece + 3-piece both apply when you have 3 pieces.
    let qualified = (set.bonuses || []).filter((b) => count >= (b.count || 2));
    if (qualified.length === 0) continue;
    for (const bonus of qualified) {
      if (bonus.statMods) {
        for (const [k, v] of Object.entries(bonus.statMods)) {
          statMods[k] = (statMods[k] || 0) + v;
        }
      }
      if (Array.isArray(bonus.triggers)) triggers.push(...bonus.triggers);
    }
    active.push({ set, count });
  }

  return { statMods, triggers, active };
}

/**
 * Apply the set bonus to a player. Idempotent — undoes the previous
 * application stored on `player._appliedSetMods` first.
 */
export function applySetBonuses(player) {
  const prev = player._appliedSetMods || {};
  // Roll back previous deltas.
  for (const [k, v] of Object.entries(prev)) {
    if (k === 'hpMax') {
      player.stats.hpMax = Math.max(1, player.stats.hpMax - v);
      player.stats.hp = Math.min(player.stats.hp, player.stats.hpMax);
    } else if (k in player.stats) {
      player.stats[k] -= v;
    }
  }

  const { statMods, triggers, active } = computeSetBonuses(player);

  for (const [k, v] of Object.entries(statMods)) {
    if (k === 'hpMax') {
      player.stats.hpMax += v;
    } else if (k in player.stats) {
      player.stats[k] += v;
    }
  }
  player._appliedSetMods = statMods;
  player.setTriggers = triggers;
  player.activeSets = active;
}
