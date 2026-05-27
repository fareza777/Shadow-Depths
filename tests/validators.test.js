import { describe, it, expect } from 'vitest';
import { validateContent } from '../src/content/validators.js';

describe('validateContent', () => {
  it('flags missing required field', () => {
    const r = validateContent({
      items: { broken: { name: 'No id' } }   // id missing
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((m) => m.includes('id'))).toBe(true);
  });

  it('flags id mismatch with dict key', () => {
    const r = validateContent({
      items: { foo: { id: 'bar', name: 'Bar' } }
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((m) => m.includes("doesn't match"))).toBe(true);
  });

  it('flags rarity outside whitelist', () => {
    const r = validateContent({
      items: { x: { id: 'x', name: 'X', rarity: 'mythic' } }
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((m) => m.includes('rarity'))).toBe(true);
  });

  it('cross-checks biome enemyPool ids exist', () => {
    const r = validateContent({
      enemies: { goblin: { id: 'goblin', name: 'G', stats: {} } },
      biomes: { biomes: [{ id: 'b', name: 'B', enemyPool: ['ghost'] }] }
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((m) => m.includes('unknown enemy id "ghost"'))).toBe(true);
  });

  it('flags unknown recipe materials and affixes', () => {
    const r = validateContent({
      items: { scrap_iron: { id: 'scrap_iron', name: 'Scrap', type: 'material' } },
      recipes: { recipes: [{
        id: 'bad_recipe',
        name: 'Bad',
        inputs: [{ materialId: 'missing_dust', count: 1 }],
        baseSlot: 'weapon',
        guaranteedPrefix: 'not_real'
      }] }
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((m) => m.includes('unknown material id "missing_dust"'))).toBe(true);
    expect(r.issues.some((m) => m.includes('unknown affix "not_real"'))).toBe(true);
  });

  it('flags unknown effect and status specs', () => {
    const r = validateContent({
      items: {
        charm: {
          id: 'charm',
          name: 'Charm',
          effects: [{ type: 'does_not_exist', value: 1 }],
          triggers: [{ when: 'onHit', do: { type: 'applyStatus', status: 'ghosted', duration: 1 } }]
        }
      }
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((m) => m.includes('unknown effect type "does_not_exist"'))).toBe(true);
    expect(r.issues.some((m) => m.includes('unknown status "ghosted"'))).toBe(true);
  });

  it('returns ok for well-formed content', () => {
    const r = validateContent({
      items: { potion: { id: 'potion', name: 'Potion', rarity: 'common', type: 'consumable' } },
      enemies: { goblin: { id: 'goblin', name: 'G', stats: { hp: 10 }, xpReward: 1 } }
    });
    expect(r.ok).toBe(true);
  });
});
