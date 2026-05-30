/**
 * skillSynergy — emergent build identity from skill tags (recommendation #15).
 *
 * Each skill in skills.json may carry `tags` (e.g. 'fury', 'ward', 'hunt',
 * 'arcane'). Collecting several skills of the same family grants a scaling
 * bonus, so picks compound into an archetype instead of being isolated stat
 * bumps. Pure + data-driven so it's unit-testable; Player folds the result
 * into its total getters.
 *
 * Thresholds: 2 of a tag → tier 1, 4 of a tag → tier 1 + tier 2.
 */

const TAG_MODS = {
  fury:   { stat: 'atk',       label: 'Fury',   t1: 1,    t2: 2 },
  ward:   { stat: 'def',       label: 'Ward',   t1: 1,    t2: 2 },
  hunt:   { stat: 'dex',       label: 'Hunt',   t1: 1,    t2: 2 },
  arcane: { stat: 'critBonus', label: 'Arcane', t1: 0.04, t2: 0.06 },
};

export const SYNERGY_TAGS = Object.keys(TAG_MODS);

/** Build a quick id → def lookup from a skills list. */
export function skillsById(skillList = []) {
  const map = {};
  for (const s of skillList) if (s?.id) map[s.id] = s;
  return map;
}

/**
 * @param {string[]} skillIds owned skill ids
 * @param {Object<string,{tags?:string[]}>} defsById id → skill def
 * @returns {{ mods:{atk:number,def:number,dex:number,critBonus:number}, active:Array }}
 */
export function computeSynergyMods(skillIds = [], defsById = {}) {
  const counts = {};
  for (const id of skillIds) {
    const tags = defsById[id]?.tags;
    if (!Array.isArray(tags)) continue;
    for (const tag of tags) counts[tag] = (counts[tag] || 0) + 1;
  }

  const mods = { atk: 0, def: 0, dex: 0, critBonus: 0 };
  const active = [];
  for (const tag of Object.keys(counts)) {
    const m = TAG_MODS[tag];
    if (!m) continue;
    const cnt = counts[tag];
    let add = 0, tier = 0;
    if (cnt >= 2) { add += m.t1; tier = 1; }
    if (cnt >= 4) { add += m.t2; tier = 2; }
    if (tier > 0) {
      mods[m.stat] = +(mods[m.stat] + add).toFixed(4);
      active.push({ tag, label: m.label, count: cnt, tier, stat: m.stat, amount: add });
    }
  }
  return { mods, active };
}
