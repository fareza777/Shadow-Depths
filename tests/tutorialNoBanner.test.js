import { describe, it, expect, vi } from 'vitest';
import { AdService } from '../src/monetization/AdService.js';
import { EventBus } from '../src/core/EventBus.js';
import { TutorialOverlay } from '../src/ui/TutorialOverlay.js';
import balance from '../data/balance.json' with { type: 'json' };

function makeService(bus, eligibleScenes) {
  const service = new AdService({
    billing: { adsRemoved: () => false },
    eventBus: bus,
    balance: { monetization: { ads: { enabled: true, eligibleScenes } } }
  });
  // Pretend we are on a device; the gate under test is placement, not platform.
  Object.defineProperty(service, 'isNative', { get: () => true });
  return service;
}

describe('dungeon and tutorial stay banner-free', () => {
  it('ships with the dungeon scene out of the eligible list', () => {
    expect(balance.monetization.ads.eligibleScenes).not.toContain('game');
  });

  it('suppresses the banner while the tutorial is open, whatever config allows', () => {
    // The tutorial is an overlay inside the "game" scene, so scene-based
    // filtering only protects it by accident. Re-enabling "game" — which one
    // build shipped with — put a banner straight over its top bar.
    const bus = new EventBus();
    const service = makeService(bus, ['title', 'game']);

    expect(service._bannerAllowedFor('title')).toBe(true);

    bus.emit('tutorial:opened', {});
    expect(service._bannerAllowedFor('title')).toBe(false);
    expect(service._bannerAllowedFor('game')).toBe(false);

    bus.emit('tutorial:closed', {});
    expect(service._bannerAllowedFor('title')).toBe(true);
  });

  it('the overlay announces itself on the bus', () => {
    const bus = new EventBus();
    const opened = vi.fn(), closed = vi.fn();
    bus.on('tutorial:opened', opened);
    bus.on('tutorial:closed', closed);

    const tutorial = new TutorialOverlay({ bus, metaProgress: null });
    tutorial.show(true);
    expect(tutorial.open).toBe(true);
    expect(opened).toHaveBeenCalled();

    tutorial.hide();
    expect(closed).toHaveBeenCalled();
  });

  it('does not double-fire when show() is called twice', () => {
    const bus = new EventBus();
    const opened = vi.fn();
    bus.on('tutorial:opened', opened);
    const tutorial = new TutorialOverlay({ bus, metaProgress: null });
    tutorial.show(true);
    tutorial.show(true);
    expect(opened).toHaveBeenCalledTimes(1);
  });
});
