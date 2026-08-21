import { describe, it, expect, vi } from 'vitest';
import { BillingService } from '../src/monetization/BillingService.js';
import {
  FALLBACK_PRICE_LABEL,
  PRODUCT_REMOVE_ADS,
  PRODUCT_FULL_DESCENT
} from '../src/monetization/products.js';

function makeMeta(premium = false) {
  const state = {
    premiumUnlocked: premium,
    premiumUnlockedAt: premium ? 1 : null,
    premiumSource: premium ? 'test' : null
  };
  return {
    state,
    isPremium: () => !!state.premiumUnlocked,
    unlockPremium: ({ source } = {}) => {
      state.premiumUnlocked = true;
      state.premiumUnlockedAt = Date.now();
      state.premiumSource = source || 'purchase';
      return true;
    }
  };
}

function makeBilling(premium = false, monetization = {}) {
  return new BillingService({
    metaProgress: makeMeta(premium),
    eventBus: { emit: vi.fn() },
    balance: { monetization }
  });
}

describe('free-to-play access', () => {
  it('opens every floor to players who bought nothing', () => {
    const billing = makeBilling(false);
    for (const index of [0, 9, 10, 50, 99]) {
      expect(billing.canAccessFloorIndex(index)).toBe(true);
    }
    expect(billing.needsUnlockToDescend(9)).toBe(false);
    expect(billing.needsUnlockToDescend(99)).toBe(false);
  });

  it('never gates tutorial mode either', () => {
    const billing = makeBilling(false);
    expect(billing.canAccessFloorIndex(50, 'tutorial')).toBe(true);
    expect(billing.needsUnlockToDescend(9, 'tutorial')).toBe(false);
  });
});

describe('ad-free entitlement', () => {
  it('uses the US$4.99 fallback price when Play Billing is unavailable', () => {
    expect(FALLBACK_PRICE_LABEL).toBe('US$4.99');
  });

  it('shows ads until the removal is bought', () => {
    expect(makeBilling(false).adsRemoved()).toBe(false);
    expect(makeBilling(true).adsRemoved()).toBe(true);
  });

  it('sells remove_ads by default', () => {
    expect(makeBilling(false).productId).toBe(PRODUCT_REMOVE_ADS);
  });

  it('honours the retired full_descent_unlock product as ad-free', () => {
    const billing = makeBilling(false);
    expect(billing.entitlementIds).toContain(PRODUCT_FULL_DESCENT);
    expect(billing.entitlementIds).toContain(PRODUCT_REMOVE_ADS);
  });

  it('always includes the product on sale in the entitlement list', () => {
    const billing = makeBilling(false, {
      productId: 'some_new_sku',
      entitlementIds: [PRODUCT_FULL_DESCENT]
    });
    expect(billing.entitlementIds).toContain('some_new_sku');
    expect(billing.entitlementIds).toContain(PRODUCT_FULL_DESCENT);
  });

  it('grants ad-free via web mock purchase', async () => {
    const bus = { emit: vi.fn() };
    const meta = makeMeta(false);
    const billing = new BillingService({
      metaProgress: meta, eventBus: bus, balance: { monetization: {} }
    });
    Object.defineProperty(billing, 'isNative', { get: () => false });
    const result = await billing.purchase();
    expect(result.ok).toBe(true);
    expect(billing.adsRemoved()).toBe(true);
    expect(bus.emit).toHaveBeenCalledWith('billing:unlocked', expect.any(Object));
  });
});

describe('legacy owner restore', () => {
  it('restores ad-free when Play reports only the retired product', async () => {
    const meta = makeMeta(false);
    const billing = new BillingService({
      metaProgress: meta, eventBus: { emit: vi.fn() }, balance: { monetization: {} }
    });
    Object.defineProperty(billing, 'isNative', { get: () => true });
    billing._native = {
      restorePurchases: async () => ({
        purchases: [{ productIdentifier: PRODUCT_FULL_DESCENT }]
      })
    };

    const result = await billing.restore();
    expect(result.ok).toBe(true);
    expect(billing.adsRemoved()).toBe(true);
  });

  it('does not grant ad-free for an unrelated product', async () => {
    const billing = new BillingService({
      metaProgress: makeMeta(false), eventBus: { emit: vi.fn() }, balance: { monetization: {} }
    });
    Object.defineProperty(billing, 'isNative', { get: () => true });
    billing._native = {
      restorePurchases: async () => ({ purchases: [{ productIdentifier: 'someone_elses_sku' }] })
    };

    const result = await billing.restore();
    expect(result.ok).toBe(false);
    expect(billing.adsRemoved()).toBe(false);
  });
});
