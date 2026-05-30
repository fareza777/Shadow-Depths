import { describe, it, expect } from 'vitest';
import { computeSynergyMods, skillsById } from '../src/gameplay/skillSynergy.js';
import skillsData from '../data/skills.json' assert { type: 'json' };

const byId = skillsById(skillsData.skills);

describe('skillSynergy with live skills.json', () => {
  it('has at least 4 of every synergy family so tier 2 is reachable', () => {
    const counts = {};
    for (const s of skillsData.skills) {
      for (const t of s.tags || []) counts[t] = (counts[t] || 0) + 1;
    }
    for (const tag of ['fury', 'ward', 'hunt', 'arcane']) {
      expect(counts[tag]).toBeGreaterThanOrEqual(4);
    }
  });

  it('no bonus below the 2-skill threshold', () => {
    const { mods, active } = computeSynergyMods(['sharpened'], byId); // 1 fury
    expect(active).toHaveLength(0);
    expect(mods).toEqual({ atk: 0, def: 0, dex: 0, critBonus: 0 });
  });

  it('grants tier 1 at 2 of a tag', () => {
    const { mods, active } = computeSynergyMods(['sharpened', 'bloodthirst'], byId); // 2 fury
    expect(mods.atk).toBe(1);
    expect(active[0]).toMatchObject({ tag: 'fury', count: 2, tier: 1 });
  });

  it('stacks tier 1 + tier 2 at 4 of a tag', () => {
    const fury = ['sharpened', 'bloodthirst', 'brutal_training', 'hollow_hunger'];
    expect(computeSynergyMods(fury, byId).mods.atk).toBe(3); // 1 + 2
  });

  it('counts dual-tag skills toward both families', () => {
    // guarded_footwork is ward+hunt; pair each with one more of its family.
    const ids = ['guarded_footwork', 'tempered', 'quickened'];
    const { mods } = computeSynergyMods(ids, byId);
    expect(mods.def).toBe(1); // ward: guarded_footwork + tempered
    expect(mods.dex).toBe(1); // hunt: guarded_footwork + quickened
  });

  it('arcane adds crit bonus', () => {
    const arc = ['studious', 'arcane_focus'];
    expect(computeSynergyMods(arc, byId).mods.critBonus).toBeCloseTo(0.04, 5);
  });
});
