import { describe, expect, it, vi } from 'vitest';
import { Game } from '../src/core/Game.js';
import { GameOverScreen } from '../src/ui/GameOverScreen.js';

function makeGradient() {
  return { addColorStop() {} };
}

const renderer = {
  ctx: {
    save() {}, restore() {}, fillRect() {}, strokeRect() {},
    createLinearGradient: makeGradient, createRadialGradient: makeGradient,
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {},
    fillText() {},
    measureText: () => ({ width: 40 })
  },
  measureText: () => 40,
  drawRect() {}, drawText() {}, drawStrokedRect() {}
};

function makeBus() {
  const handlers = new Map();
  return {
    on(event, fn) { handlers.set(event, fn); },
    emit(event, payload) { handlers.get(event)?.(payload); }
  };
}

describe('rewarded game-over action', () => {
  it('offers revive only when the summary says it is eligible', () => {
    const bus = { emit: vi.fn() };
    const screen = new GameOverScreen({
      bus,
      adService: { canOfferRevive: () => true },
      summary: { died: true, canOfferRevive: true, reviveSnapshot: { seed: 7 } }
    });
    screen.render(renderer);
    expect(screen.hitTest(240, screen._layout(renderer).revive.y + 2)).toBe(2);
  });

  it('resumes only after the rewarded SDK resolves a reward', async () => {
    const bus = { emit: vi.fn() };
    const ads = { canOfferRevive: () => true, showRewardedRevive: vi.fn().mockResolvedValue(true) };
    const screen = new GameOverScreen({
      bus,
      adService: ads,
      summary: { died: true, canOfferRevive: true, reviveSnapshot: { seed: 7 } }
    });
    await screen._activate(2);
    expect(ads.showRewardedRevive).toHaveBeenCalledTimes(1);
    expect(bus.emit).toHaveBeenCalledWith('request:reviveRun', {
      snapshot: { seed: 7 }
    });
  });

  it('does not record a pending death until restart/title is chosen, and ignores duplicate revive requests', () => {
    const bus = makeBus();
    const summary = { died: true, canOfferRevive: true, reviveSnapshot: { seed: 7 }, floorsCleared: 3 };
    const recordRun = vi.fn().mockReturnValue({
      score: 100, coinsEarned: 1, isNewHighScore: false, unlocked: []
    });
    const switchScene = vi.fn();
    const game = new Game({
      eventBus: bus,
      stateStore: { state: { meta: {} }, setRun: vi.fn(), setScene: vi.fn() },
      sceneManager: { switch: switchScene },
      gameLoop: { start: vi.fn() },
      saveManager: { loadRun: vi.fn(() => null), clearRun: vi.fn() },
      metaProgress: { recordRun, computeScore: vi.fn(() => 100) },
      sceneFactories: {
        game: vi.fn(() => ({})),
        gameover: vi.fn(() => ({})),
        title: vi.fn(() => ({}))
      },
      content: {},
      balance: {}
    });

    game._onRunOver(summary);
    expect(recordRun).not.toHaveBeenCalled();
    expect(switchScene).toHaveBeenCalledTimes(1);
    bus.emit('request:reviveRun', { snapshot: summary.reviveSnapshot });
    expect(recordRun).not.toHaveBeenCalled();
    expect(switchScene).toHaveBeenCalledTimes(2);
    bus.emit('request:reviveRun', { snapshot: summary.reviveSnapshot });
    expect(switchScene).toHaveBeenCalledTimes(2);

    game._onRunOver(summary);
    bus.emit('request:quitToTitle');
    expect(recordRun).toHaveBeenCalledTimes(1);
  });
});
