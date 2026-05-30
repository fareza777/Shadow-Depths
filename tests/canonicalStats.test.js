import { describe, it, expect } from 'vitest';
import {
  wornDaggerAtk,
  applyCanonicalItemStats,
  repairItemDefStats
} from '../src/items/canonicalStats.js';

describe('canonicalStats', () => {
  it('worn dagger base is +1 ATK, +2 with meta unlock', () => {
    expect(wornDaggerAtk(null)).toBe(1);
    expect(wornDaggerAtk({ unlocks: [] })).toBe(1);
    expect(wornDaggerAtk({ unlocks: ['worn_dagger'] })).toBe(2);
  });

  it('applyCanonicalItemStats overwrites inflated worn dagger stats', () => {
    const item = { id: 'worn_dagger', stats: { atk: 5 }, def: {} };
    applyCanonicalItemStats(item, null);
    expect(item.stats.atk).toBe(1);

    applyCanonicalItemStats(item, { unlocks: ['worn_dagger'] });
    expect(item.stats.atk).toBe(2);
  });

  it('repairItemDefStats resets polluted JSON defs', () => {
    const defs = { worn_dagger: { stats: { atk: 8 } } };
    repairItemDefStats(defs);
    expect(defs.worn_dagger.stats.atk).toBe(1);
  });
});
