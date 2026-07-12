import { describe, it, expect, vi } from 'vitest';
import { BillingService } from '../src/monetization/BillingService.js';
import { PRODUCT_FULL_DESCENT } from '../src/monetization/products.js';

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
    },
    freeFloorCap: () => 10
  };
}

describe('BillingService freemium gate', () => {
  it('allows free floors 1–10 and blocks deeper without premium', () => {
    const billing = new BillingService({
      metaProgress: makeMeta(false),
      eventBus: { emit: vi.fn() },
      balance: { monetization: { freeFloorCap: 10, productId: PRODUCT_FULL_DESCENT } }
    });
    expect(billing.canAccessFloorIndex(0)).toBe(true);
    expect(billing.canAccessFloorIndex(9)).toBe(true);
    expect(billing.canAccessFloorIndex(10)).toBe(false);
    expect(billing.needsUnlockToDescend(9)).toBe(true);
    expect(billing.needsUnlockToDescend(8)).toBe(false);
  });

  it('unlocks all floors when premium', () => {
    const billing = new BillingService({
      metaProgress: makeMeta(true),
      eventBus: { emit: vi.fn() },
      balance: { monetization: { freeFloorCap: 10 } }
    });
    expect(billing.canAccessFloorIndex(50)).toBe(true);
    expect(billing.needsUnlockToDescend(99)).toBe(false);
  });

  it('never gates tutorial mode', () => {
    const billing = new BillingService({
      metaProgress: makeMeta(false),
      eventBus: { emit: vi.fn() },
      balance: { monetization: { freeFloorCap: 10 } }
    });
    expect(billing.canAccessFloorIndex(50, 'tutorial')).toBe(true);
    expect(billing.needsUnlockToDescend(9, 'tutorial')).toBe(false);
  });

  it('grants premium via web mock purchase', async () => {
    const bus = { emit: vi.fn() };
    const meta = makeMeta(false);
    const billing = new BillingService({
      metaProgress: meta,
      eventBus: bus,
      balance: { monetization: { freeFloorCap: 10 } }
    });
    // Force non-native path
    Object.defineProperty(billing, 'isNative', { get: () => false });
    const result = await billing.purchase();
    expect(result.ok).toBe(true);
    expect(meta.isPremium()).toBe(true);
    expect(bus.emit).toHaveBeenCalledWith('billing:unlocked', expect.any(Object));
  });
});
