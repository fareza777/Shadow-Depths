import { describe, it, expect } from 'vitest';
import skillsData from '../data/skills.json' assert { type: 'json' };

const skills = skillsData.skills;

// The original hand-cased skills (effects live in Player.applySkill's switch).
const LEGACY = new Set([
  'hardened', 'sharpened', 'tempered', 'quickened', 'eager', 'studious',
  'bloodthirst', 'stout', 'long_reach', 'second_wind', 'iron_vitality',
  'brutal_training', 'guarded_footwork', 'torchbearer', 'keen_eye',
  'arcane_focus', 'runic_haste', 'soul_channel', 'deadly_precision',
  'field_mender', 'satchel_master', 'vigil_oath', 'hollow_hunger',
  'inquisitor_flame', 'reaver_bone_rite', 'pilgrim_ember'
]);

const HEROES = ['vigil', 'hollow', 'inquisitor', 'reaver', 'pilgrim', 'warden', 'bladedancer', 'echobinder'];
const VALID_TAGS = new Set(['fury', 'ward', 'hunt', 'arcane']);

// Per-skill caps — keeps any single boon from being OP even when stacked.
const CAPS = {
  atk: 2, def: 2, dex: 2, hpMax: 12, crit: 0.06, lifesteal: 0.06, dr: 0.06,
  magic: 2, range: 1, torch: 1, spellCDR: 1, spellLifesteal: 0.15, xp: 0.20,
  invSlots: 2, regenAmount: 2, regenEveryN: 12
};

describe('skill pool expansion', () => {
  it('gives every hero exactly 75 selectable skills', () => {
    for (const h of HEROES) {
      const avail = skills.filter((s) => !s.hero || s.hero === h);
      expect(avail.length, h).toBe(75);
    }
  });

  it('has unique ids', () => {
    const ids = skills.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every skill is applicable (legacy case or data-driven effect)', () => {
    for (const s of skills) {
      const ok = LEGACY.has(s.id) || (s.effect && typeof s.effect === 'object');
      expect(ok, s.id).toBe(true);
    }
  });

  it('no data-driven effect exceeds its balance cap (nothing OP)', () => {
    for (const s of skills) {
      if (!s.effect) continue;
      for (const [k, v] of Object.entries(s.effect)) {
        expect(CAPS[k], `${s.id}.${k} is an unknown effect field`).toBeDefined();
        expect(Math.abs(v), `${s.id}.${k}`).toBeLessThanOrEqual(CAPS[k]);
      }
    }
  });

  it('only uses known synergy tags', () => {
    for (const s of skills) {
      for (const t of s.tags || []) expect(VALID_TAGS.has(t), `${s.id}:${t}`).toBe(true);
    }
  });
});
