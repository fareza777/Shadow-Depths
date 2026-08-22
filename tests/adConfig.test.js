import { describe, expect, it } from 'vitest';
import { FALLBACK_PRICE_LABEL, PRODUCT_FULL_DESCENT, PRODUCT_REMOVE_ADS } from '../src/monetization/products.js';
import {
  resolveAdConfig,
  validateAdIds,
  TEST_AD_UNITS,
  TEST_APP_ID
} from '../src/monetization/adConfig.js';

describe('release monetization contract', () => {
  it('offers Remove Ads at the US$4.99 base price and keeps the legacy id', async () => {
    expect(PRODUCT_REMOVE_ADS).toBe('remove_ads');
    expect(PRODUCT_FULL_DESCENT).toBe('full_descent_unlock');
    expect(FALLBACK_PRICE_LABEL).toBe('US$4.99');
  });

  it('uses test units only when live environment IDs are absent', () => {
    const cfg = resolveAdConfig({ ads: {} }, {});
    expect(cfg.usingTestUnits).toBe(true);
    expect(cfg.testMode).toBe(true);
    expect(cfg.releaseReady).toBe(false);
  });

  it('accepts complete non-sample release IDs', () => {
    const result = validateAdIds({
      appId: 'ca-app-pub-1234567890123456~1234567890',
      banner: 'ca-app-pub-1234567890123456/1234567890',
      interstitial: 'ca-app-pub-1234567890123456/1234567891',
      rewarded: 'ca-app-pub-1234567890123456/1234567892',
      appOpen: 'ca-app-pub-1234567890123456/1234567893',
      publisherId: 'pub-1234567890123456',
      release: true
    });
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('blocks a release that still has the sample app open unit', () => {
    // usingTestUnits keys off appOpen too, so a miss here would force
    // isTesting on every format and quietly ship zero-revenue ads.
    const result = validateAdIds({
      appId: 'ca-app-pub-1234567890123456~1234567890',
      banner: 'ca-app-pub-1234567890123456/1234567890',
      interstitial: 'ca-app-pub-1234567890123456/1234567891',
      rewarded: 'ca-app-pub-1234567890123456/1234567892',
      appOpen: TEST_AD_UNITS.appOpen,
      publisherId: 'pub-1234567890123456',
      release: true
    });
    expect(result.ok).toBe(false);
  });

  it('rejects sample IDs for a release build', () => {
    const result = validateAdIds({
      appId: TEST_APP_ID,
      ...TEST_AD_UNITS,
      publisherId: 'pub-0000000000000000',
      release: true
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
