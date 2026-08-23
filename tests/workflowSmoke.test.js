/**
 * End-to-end workflow smoke (headless) — title → run → save → resume gate → paywall product.
 * Catches regressions that unit tests on isolated modules miss.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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

  it('documents the free-with-ads product contract', () => {
    // The retired id must keep its exact value: existing buyers are matched
    // against it on restore, so renaming it would silently strip their
    // ad-free entitlement.
    expect(PRODUCT_FULL_DESCENT).toBe('full_descent_unlock');
    expect(balanceData.monetization?.model).toBe('free_with_ads');
    expect(balanceData.monetization?.entitlementIds).toContain('full_descent_unlock');
    expect(balanceData.monetization?.freeFloorCap).toBeUndefined();
    expect(FALLBACK_PRICE_LABEL).toBe('Rp 88.000');
  });

  it('routes scene changes through AdService instead of showing a boot-global banner', () => {
    const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    expect(source).toContain("bus.on('scene:switched'");
    expect(source).toContain('adService.onSceneChanged(to)');
    expect(source).toContain('gameover: (deps) => new GameOverScreen({ ...deps, adService })');
    expect(source).not.toContain('.then(() => adService.showBanner())');
  });

  it('keeps privacy and Play Store copy aligned with free-with-ads monetization', () => {
    const privacy = readFileSync(new URL('../public/privacy.html', import.meta.url), 'utf8');
    const playStore = readFileSync(new URL('../docs/PLAYSTORE.md', import.meta.url), 'utf8');
    expect(privacy).toMatch(/AdMob|Google Mobile Ads/i);
    expect(privacy).toMatch(/consent|personalized|non-personalized/i);
    expect(playStore).toMatch(/Contains ads.*Yes/i);
    expect(playStore).toMatch(/Rp 88\.000/);
    expect(playStore).toMatch(/100 floors.*free/i);
    expect(playStore).not.toMatch(/declare \*\*no ads\*\*/i);
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
