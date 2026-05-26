/**
 * Item generator — rolls prefix/suffix affixes onto base item defs.
 *
 * Two public entry points:
 *   rollItemAffixes(baseDef, floorLevel, rng) → { prefix, suffix } | null
 *   synthesizeDef(baseDef, affixIds)         → synthesized def object
 *
 * The roll is deterministic given a seeded RNG (mulberry32 fork). The
 * synthesized def carries the SAME `id` as the base, plus an `affixes`
 * field. That keeps codex / lookup tables working, and save snapshots
 * only need `{ id, count, affixes: { prefix, suffix } }`.
 *
 * Floor depth gates affix tiers:
 *   depth 1-24    → tier 1 only
 *   depth 25-49   → tier 1-2
 *   depth 50+     → tier 1-3
 */
import { PREFIXES, SUFFIXES } from '../content/affixes.js';

const PREFIX_BY_ID = new Map(PREFIXES.map((a) => [a.id, a]));
const SUFFIX_BY_ID = new Map(SUFFIXES.map((a) => [a.id, a]));

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_RANK = Object.fromEntries(RARITY_ORDER.map((r, i) => [r, i]));

/** Filter affixes by item slot/type + depth-gated tier cap. */
function eligible(pool, baseDef, tierCap) {
  return pool.filter((a) => {
    if (a.tier > tierCap) return false;
    if (!Array.isArray(a.when)) return true;
    return a.when.includes(baseDef.slot) || a.when.includes(baseDef.type);
  });
}

/**
 * Roll prefix/suffix for a base item.
 *
 * Distribution (per item drop):
 *   25% none, 30% prefix only, 30% suffix only, 15% both.
 *
 * Items without a slot (consumables) never get affixes.
 *
 * @param {object} baseDef
 * @param {number} floorLevel  1-indexed floor depth
 * @param {{ next, chance, pick }} rng
 * @returns {{ prefix: string|null, suffix: string|null } | null}
 */
export function rollItemAffixes(baseDef, floorLevel, rng) {
  if (!baseDef?.slot) return null;
  const tierCap = floorLevel >= 50 ? 3 : floorLevel >= 25 ? 2 : 1;
  const prefixPool = eligible(PREFIXES, baseDef, tierCap);
  const suffixPool = eligible(SUFFIXES, baseDef, tierCap);

  const r = rng.next();
  let prefix = null;
  let suffix = null;
  if (r < 0.25) {
    // no affix
  } else if (r < 0.55) {
    if (prefixPool.length) prefix = rng.pick(prefixPool).id;
  } else if (r < 0.85) {
    if (suffixPool.length) suffix = rng.pick(suffixPool).id;
  } else {
    if (prefixPool.length) prefix = rng.pick(prefixPool).id;
    if (suffixPool.length) suffix = rng.pick(suffixPool).id;
  }
  if (!prefix && !suffix) return null;
  return { prefix, suffix };
}

/**
 * Merge base def + affix specs into a synthesized def. The base is left
 * untouched (immutable JSON load). Stats stack additively, onHit and
 * triggers concatenate, rarity bumps one rank per affix.
 *
 * @param {object} baseDef
 * @param {{ prefix?: string|null, suffix?: string|null } | null} affixIds
 * @returns {object} synthesized def (or baseDef itself if no affixes)
 */
export function synthesizeDef(baseDef, affixIds) {
  if (!affixIds || (!affixIds.prefix && !affixIds.suffix)) return baseDef;
  const pre = affixIds.prefix ? PREFIX_BY_ID.get(affixIds.prefix) : null;
  const suf = affixIds.suffix ? SUFFIX_BY_ID.get(affixIds.suffix) : null;

  const stats = { ...(baseDef.stats || {}) };
  const onHit = Array.isArray(baseDef.onHit) ? [...baseDef.onHit] : [];
  const triggers = Array.isArray(baseDef.triggers) ? [...baseDef.triggers] : [];
  const parts = [];

  function merge(a) {
    if (!a) return;
    if (a.statMods) {
      for (const [k, v] of Object.entries(a.statMods)) {
        stats[k] = (stats[k] || 0) + v;
      }
    }
    if (Array.isArray(a.onHit)) onHit.push(...a.onHit);
    if (Array.isArray(a.triggers)) triggers.push(...a.triggers);
  }
  merge(pre);
  merge(suf);

  if (pre) parts.push(pre.name);
  parts.push(baseDef.name);
  if (suf) parts.push(suf.name);
  const name = parts.join(' ').replace(' of', ' of').replace('- ', '-');

  // Bump rarity: +1 rank per affix, capped at legendary.
  const baseRank = RARITY_RANK[baseDef.rarity || 'common'] || 0;
  const bumps = (pre ? 1 : 0) + (suf ? 1 : 0);
  const rarity = RARITY_ORDER[Math.min(4, baseRank + bumps)];

  return {
    ...baseDef,
    name,
    rarity,
    stats,
    onHit: onHit.length ? onHit : undefined,
    triggers: triggers.length ? triggers : undefined,
    affixes: { prefix: affixIds.prefix || null, suffix: affixIds.suffix || null }
  };
}
