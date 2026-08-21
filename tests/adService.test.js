import { describe, expect, it, vi } from 'vitest';
import { AdService } from '../src/monetization/AdService.js';

function makeBus() {
  const handlers = new Map();
  return {
    on(event, fn) { handlers.set(event, fn); },
    emit(event, payload) { handlers.get(event)?.(payload); }
  };
}

function makeService({ premium = false, native = true } = {}) {
  const bus = makeBus();
  const billing = { adsRemoved: () => premium };
  const service = new AdService({ billing, eventBus: bus, balance: {
    monetization: {
      ads: {
        enabled: true,
        unitIds: {},
        interstitialEveryNFloors: 1,
        interstitialMinFloorIndex: 0,
        interstitialCooldownMs: 90000
      }
    }
  }});
  Object.defineProperty(service, 'isNative', { get: () => native });
  return { service, bus };
}

describe('AdService safety gate', () => {
  it('never initializes or shows ads for an ad-free owner', async () => {
    const { service } = makeService({ premium: true });
    service._admob = { initialize: vi.fn() };
    await service.init();
    expect(service._admob.initialize).not.toHaveBeenCalled();
    expect(service.adsDisabled).toBe(true);
  });

  it('does not initialize when consent says ads cannot be requested', async () => {
    const { service } = makeService();
    service._admob = {
      requestConsentInfo: vi.fn().mockResolvedValue({
        canRequestAds: false, isConsentFormAvailable: false, status: 'NOT_REQUIRED'
      }),
      initialize: vi.fn()
    };
    await service._requestConsent({ AdmobConsentStatus: { REQUIRED: 'REQUIRED' } });
    expect(service.canRequestAds).toBe(false);
    await service.init();
    expect(service._admob.initialize).not.toHaveBeenCalled();
  });

  it('shows banners only on non-combat scenes', async () => {
    const { service } = makeService();
    service._admob = {
      showBanner: vi.fn().mockResolvedValue(undefined),
      hideBanner: vi.fn().mockResolvedValue(undefined)
    };
    service._ready = true;
    await service.onSceneChanged('game');
    expect(service._admob.showBanner).not.toHaveBeenCalled();
    await service.onSceneChanged('title');
    expect(service._admob.showBanner).toHaveBeenCalledTimes(1);
    await service.onSceneChanged('gameover');
    expect(service._admob.showBanner).toHaveBeenCalledTimes(1);
  });

  it('does not repeat an interstitial during the cooldown window', async () => {
    const { service } = makeService();
    service._admob = {
      showInterstitial: vi.fn().mockResolvedValue(undefined),
      prepareInterstitial: vi.fn().mockResolvedValue(undefined)
    };
    service._ready = true;
    service._interstitialLoaded = true;
    expect(await service.onDescend(0)).toBe(true);
    service._interstitialLoaded = true;
    expect(await service.onDescend(1)).toBe(false);
    expect(service._admob.showInterstitial).toHaveBeenCalledTimes(1);
  });

  it('counts a rewarded revive only after a reward item is returned', async () => {
    const { service } = makeService();
    service._admob = {
      showRewardVideoAd: vi.fn().mockResolvedValue({ type: 'revive', amount: 1 })
    };
    service._ready = true;
    service._rewardedLoaded = true;
    expect(await service.showRewardedRevive()).toBe(true);
    expect(service.revivesUsedThisRun).toBe(1);
    expect(await service.showRewardedRevive()).toBe(false);
  });
});
