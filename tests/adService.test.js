import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdService } from '../src/monetization/AdService.js';
import { EventBus } from '../src/core/EventBus.js';

const storage = vi.hoisted(() => new Map());
vi.hoisted(() => {
  vi.stubGlobal('localStorage', {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); }
  });
});

function makeService({ premium = false, native = true, getSceneContext } = {}) {
  const bus = new EventBus();
  const billing = { adsRemoved: () => premium };
  const service = new AdService({ billing, eventBus: bus, getSceneContext, balance: {
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

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); }
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(Date, 'now').mockReturnValue(20_000_000);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const CLOSED = {
  appOpen: 'appOpenAdClosed',
  interstitial: 'interstitialAdDismissed',
  rewarded: 'onRewardedVideoAdDismissed'
};
const FAILED = {
  appOpen: 'appOpenAdFailedToShow',
  interstitial: 'interstitialAdFailedToShow',
  rewarded: 'onRewardedVideoAdFailedToShow'
};

// Only the native SDK is replaced. Every gate, counter and event subscription
// belongs to the real AdService and the real EventBus.
function fullscreenService(options = {}) {
  const { service, bus } = makeService(options);
  const listeners = new Map();
  const calls = [];
  const preparations = [];
  const show = (kind) => {
    const task = { kind, ...deferred() };
    calls.push(task);
    return task.promise;
  };
  const prepare = async (kind, args) => { preparations.push({ kind, args }); };
  service._ready = true;
  service._appOpenLoaded = true;
  service._interstitialLoaded = true;
  service._rewardedLoaded = true;
  service._admob = {
    async addListener(event, handler) {
      const handlers = listeners.get(event) || new Set();
      handlers.add(handler);
      listeners.set(event, handlers);
      return { async remove() { handlers.delete(handler); } };
    },
    loadAppOpen: (args) => prepare('appOpen', args),
    prepareInterstitial: (args) => prepare('interstitial', args),
    prepareRewardVideoAd: (args) => prepare('rewarded', args),
    showAppOpen: () => show('appOpen'),
    showInterstitial: () => show('interstitial'),
    showRewardVideoAd: () => show('rewarded')
  };
  storage.set('shadowdepths_last_app_open', '1');
  bus.emit('scene:switched', { to: options.scene || 'title' });
  const emit = (event) => {
    for (const handler of [...(listeners.get(event) || [])]) handler();
  };
  const close = (call, reward = { type: 'reward', amount: 1 }) => {
    call.resolve(call.kind === 'rewarded' ? reward : undefined);
    emit(CLOSED[call.kind]);
  };
  const start = (kind) => {
    if (kind === 'appOpen') return service.onAppForeground();
    if (kind === 'interstitial') return service.onDescend(3);
    return service.showRewardedRevive();
  };
  return { service, bus, calls, preparations, emit, close, start, listeners };
}

describe('one native fullscreen ad at a time', () => {
  const pairs = [
    ['appOpen', 'appOpen'], ['appOpen', 'interstitial'], ['appOpen', 'rewarded'],
    ['interstitial', 'appOpen'], ['interstitial', 'interstitial'], ['interstitial', 'rewarded'],
    ['rewarded', 'appOpen'], ['rewarded', 'interstitial'], ['rewarded', 'rewarded']
  ];
  it.each(pairs)('blocks %s overlap with %s', async (firstKind, secondKind) => {
    const h = fullscreenService();
    const first = h.start(firstKind);
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    const second = h.start(secondKind);
    await Promise.resolve();
    expect(h.calls.map(({ kind }) => kind)).toEqual([firstKind]);
    expect(await second).toBe(false);
    h.close(h.calls[0]);
    expect(await first).toBe(true);
  });

  it('shares the guard between rewarded revive and reroll', async () => {
    const h = fullscreenService();
    const revive = h.service.showRewardedRevive();
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    const reroll = h.service.showRewardedReroll();
    await Promise.resolve();
    expect(h.calls).toHaveLength(1);
    expect(await reroll).toBe(false);
    h.close(h.calls[0]);
    expect(await revive).toBe(true);
    expect(h.service.revivesUsedThisRun).toBe(1);
    expect(h.service.rerollsUsedThisRun).toBe(0);
  });

  it.each(['interstitial', 'rewarded'])('holds the guard after %s resolves but before dismissal', async (kind) => {
    const h = fullscreenService();
    let completed = false;
    const first = h.start(kind).then((result) => { completed = true; return result; });
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    h.calls[0].resolve(kind === 'rewarded' ? { type: 'revive', amount: 1 } : undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const other = h.start(kind === 'rewarded' ? 'interstitial' : 'rewarded');
    expect(h.calls).toHaveLength(1);
    expect(completed).toBe(false);
    expect(await other).toBe(false);
    h.emit(CLOSED[kind]);
    expect(await first).toBe(true);
  });

  it('reserves the shared guard before SDK initialization', async () => {
    const h = fullscreenService();
    const ready = deferred();
    h.service._ready = false;
    const init = vi.spyOn(h.service, 'init').mockImplementation(async () => {
      await ready.promise;
      h.service._ready = true;
    });
    const first = h.start('appOpen');
    const other = h.start('rewarded');
    expect(init).toHaveBeenCalledTimes(1);
    expect(await other).toBe(false);
    ready.resolve();
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    h.close(h.calls[0]);
    expect(await first).toBe(true);
  });

  it.each(['appOpen', 'interstitial', 'rewarded'])('releases the guard when %s rejects', async (kind) => {
    const h = fullscreenService();
    const first = h.start(kind);
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    h.calls[0].reject(new Error('offline'));
    expect(await first).toBe(false);
    expect(h.service.lastError).toBe('offline');
    const retry = h.start(kind === 'rewarded' ? 'interstitial' : 'rewarded');
    await vi.waitFor(() => expect(h.calls).toHaveLength(2));
    h.close(h.calls[1]);
    expect(await retry).toBe(true);
  });

  it.each(['appOpen', 'interstitial', 'rewarded'])('releases the guard on %s failure callback without a settled show promise', async (kind) => {
    const h = fullscreenService();
    let result;
    const first = h.start(kind).then((value) => { result = value; return value; });
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    h.emit(FAILED[kind]);
    await vi.waitFor(() => expect(result).toBe(false), { timeout: 300 });
    expect(await first).toBe(false);
    const retry = h.start(kind === 'rewarded' ? 'interstitial' : 'rewarded');
    await vi.waitFor(() => expect(h.calls).toHaveLength(2));
    h.close(h.calls[1]);
    expect(await retry).toBe(true);
  });

  it('ends a canceled reward on dismissal without granting a revive', async () => {
    const h = fullscreenService();
    let result;
    const first = h.start('rewarded').then((value) => { result = value; return value; });
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    h.emit(CLOSED.rewarded);
    await vi.waitFor(() => expect(result).toBe(false), { timeout: 300 });
    expect(await first).toBe(false);
    expect(h.service.revivesUsedThisRun).toBe(0);
    expect(await h.start('appOpen')).toBe(false);
  });

  it('releases the guard after a preload failure', async () => {
    const h = fullscreenService();
    h.service._appOpenLoaded = false;
    h.service._admob.loadAppOpen = async () => { throw new Error('offline'); };
    expect(await h.start('appOpen')).toBe(false);
    const retry = h.start('rewarded');
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    h.close(h.calls[0]);
    expect(await retry).toBe(true);
  });
});

describe('App Open safe contexts and foreground deduplication', () => {
  it.each(['game', 'opening', 'gameover', 'victory', 'unknown'])('does not interrupt %s', async (scene) => {
    const h = fullscreenService({ scene });
    let result;
    const foreground = h.start('appOpen').then((value) => { result = value; return value; });
    await Promise.resolve();
    expect(h.calls).toHaveLength(0);
    expect(await foreground).toBe(false);
    expect(result).toBe(false);
  });

  it.each(['title', 'loading', 'pause'])('allows App Open in %s', async (scene) => {
    const h = fullscreenService({ scene });
    const first = h.start('appOpen');
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    h.close(h.calls[0]);
    expect(await first).toBe(true);
    expect(await h.start('appOpen')).toBe(false);
    expect(h.calls).toHaveLength(1);
  });

  it('reads the actual game pause state through the supplied scene context', async () => {
    const context = { name: 'game', paused: false };
    const h = fullscreenService({ getSceneContext: () => context });
    const active = h.start('appOpen');
    await Promise.resolve();
    expect(h.calls).toHaveLength(0);
    expect(await active).toBe(false);
    context.paused = true;
    const paused = h.start('appOpen');
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    h.close(h.calls[0]);
    expect(await paused).toBe(true);
  });

  it('rechecks the scene after asynchronous loading', async () => {
    const h = fullscreenService();
    const loaded = deferred();
    h.service._appOpenLoaded = false;
    h.service._admob.loadAppOpen = () => loaded.promise;
    const first = h.start('appOpen');
    h.bus.emit('scene:switched', { from: 'title', to: 'game' });
    loaded.resolve();
    let result;
    first.then((value) => { result = value; });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.calls).toHaveLength(0);
    expect(await first).toBe(false);
    expect(result).toBe(false);
  });

  it('deduplicates foreground bus events while an App Open is pending', async () => {
    const h = fullscreenService();
    h.bus.emit('app:foreground', {});
    h.bus.emit('app:foreground', {});
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    h.close(h.calls[0]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    h.bus.emit('app:foreground', {});
    expect(h.calls).toHaveLength(1);
  });

  it('keeps first-ever launch free of App Open ads', async () => {
    const h = fullscreenService();
    storage.clear();
    expect(await h.start('appOpen')).toBe(false);
    expect(h.calls).toHaveLength(0);
    expect(storage.get('shadowdepths_last_app_open')).toBe('20000000');
  });
});

describe('fullscreen entitlement and consent gates', () => {
  it.each(['appOpen', 'interstitial', 'rewarded'])('blocks ready %s ads when consent refused requests', async (kind) => {
    const h = fullscreenService();
    h.service._consentInfo = { canRequestAds: false, status: 'REQUIRED', isConsentFormAvailable: true };
    h.service._canRequestAds = false;
    const result = h.start(kind);
    await Promise.resolve();
    expect(h.calls).toHaveLength(0);
    expect(await result).toBe(false);
  });

  it.each(['appOpen', 'interstitial', 'rewarded'])('blocks ready %s ads for an ad-free owner', async (kind) => {
    const h = fullscreenService({ premium: true });
    expect(await h.start(kind)).toBe(false);
    expect(h.calls).toHaveLength(0);
  });

  it('rechecks entitlement after loading and allows a later eligible request', async () => {
    const h = fullscreenService();
    let removed = false;
    h.service.billing.adsRemoved = () => removed;
    const loaded = deferred();
    h.service._appOpenLoaded = false;
    h.service._admob.loadAppOpen = () => loaded.promise;
    const first = h.start('appOpen');
    removed = true;
    loaded.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.calls).toHaveLength(0);
    expect(await first).toBe(false);
    removed = false;
    const next = h.start('rewarded');
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    h.close(h.calls[0]);
    expect(await next).toBe(true);
  });

  it('keeps non-personalized flags on every fullscreen preload', async () => {
    const h = fullscreenService();
    h.service._npaRequired = true;
    h.service._appOpenLoaded = false;
    h.service._interstitialLoaded = false;
    h.service._rewardedLoaded = false;
    await h.service._preloadAppOpen();
    await h.service._preloadInterstitial();
    await h.service._preloadRewarded();
    expect(h.preparations.map(({ kind, args }) => ({ kind, npa: args.npa, testing: args.isTesting }))).toEqual([
      { kind: 'appOpen', npa: true, testing: true },
      { kind: 'interstitial', npa: true, testing: true },
      { kind: 'rewarded', npa: true, testing: true }
    ]);
  });
});
