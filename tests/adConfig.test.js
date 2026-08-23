import { describe, expect, it } from 'vitest';
import balanceData from '../data/balance.json';
import { DEFAULT_BALANCE } from '../src/config/balance.js';
import { FALLBACK_PRICE_LABEL, PRODUCT_FULL_DESCENT, PRODUCT_REMOVE_ADS } from '../src/monetization/products.js';
import {
  resolveAdConfig,
  validateAdIds,
  TEST_AD_UNITS,
  TEST_APP_ID
} from '../src/monetization/adConfig.js';

describe('release monetization contract', () => {
  it('uses the live Indonesian fallback price and keeps the legacy id', () => {
    expect(PRODUCT_REMOVE_ADS).toBe('remove_ads');
    expect(PRODUCT_FULL_DESCENT).toBe('full_descent_unlock');
    expect(FALLBACK_PRICE_LABEL).toBe('Rp 88.000');
    expect(balanceData.monetization.fallbackPriceLabel).toBe('Rp 88.000');
    expect(DEFAULT_BALANCE.monetization.fallbackPriceLabel).toBe('Rp 88.000');
  });

  it('resolves all four live AdMob units without test mode', () => {
    const cfg = resolveAdConfig(balanceData.monetization, {});
    expect({
      appId: cfg.appId,
      publisherId: cfg.publisherId,
      unitIds: cfg.unitIds,
      testMode: cfg.testMode,
      releaseReady: cfg.releaseReady
    }).toEqual({
      appId: 'ca-app-pub-6279186647593327~2428101171',
      publisherId: 'pub-6279186647593327',
      unitIds: {
        banner: 'ca-app-pub-6279186647593327/3358039467',
        interstitial: 'ca-app-pub-6279186647593327/2966167545',
        rewarded: 'ca-app-pub-6279186647593327/1905306669',
        appOpen: 'ca-app-pub-6279186647593327/1218378122'
      },
      testMode: false,
      releaseReady: true
    });
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
