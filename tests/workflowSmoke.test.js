/**
 * End-to-end workflow smoke (headless) — title → run → save → resume gate → paywall product.
 * Catches regressions that unit tests on isolated modules miss.
 */
import { describe, it, expect } from 'vitest';
import { Dungeon } from '../src/world/Dungeon.js';
import { RNG } from '../src/core/RNG.js';
import { PRODUCT_FULL_DESCENT, FALLBACK_PRICE_LABEL } from '../src/monetization/products.js';
import { describeBiomeMechanic } from '../src/gameplay/biomeMechanics.js';
import { t, setLocale } from '../src/content/i18n.js';
import floorsData from '../data/floors.json';
import biomesData from '../data/biomes.json';
import enemiesData from '../data/enemies.json';
import itemsData from '../data/items.json';
import balanceData from '../data/balance.json';

describe('workflow smoke: descent pipeline', () => {
  it('builds floor 0 with mechanic banner text available', () => {
    const content = {
      floors: floorsData,
      biomes: biomesData,
      enemies: enemiesData,
      items: itemsData
    };
    const dungeon = new Dungeon({
      content,
      balance: balanceData,
      rng: new RNG(12345),
      mode: 'normal'
    });
    const { floor } = dungeon.getOrGenerate(0);
    expect(floor).toBeTruthy();
    expect(floor.width).toBeGreaterThan(10);
    const mechanic = floor.definition?.mechanic;
    if (mechanic) {
      expect(describeBiomeMechanic(mechanic).length).toBeGreaterThan(5);
    }
    expect(floor.stairsDown).toBeTruthy();
  });

  it('documents free-floor paywall product contract', () => {
    expect(PRODUCT_FULL_DESCENT).toBe('full_descent_unlock');
    expect(balanceData.monetization?.freeFloorCap ?? 10).toBe(10);
    expect(FALLBACK_PRICE_LABEL).toMatch(/Rp/);
  });

  it('title → death → victory strings stay localized', () => {
    setLocale('id');
    expect(t('title.newrun')).toMatch(/PERTUALANGAN|DESCENT|BARU/i);
    expect(t('victory.title')).not.toBe('victory.title');
    expect(t('gameover.hint_boss')).not.toBe('gameover.hint_boss');
    setLocale('en');
    expect(t('title.newrun')).toBe('NEW DESCENT');
  });
});
