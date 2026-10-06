import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';
import { GameScene } from '../src/core/GameScene.js';
import { SkillPickerUI, OPEN_GRACE_MS } from '../src/ui/SkillPickerUI.js';

const native = vi.hoisted(() => {
  const storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  });
  return { enabled: true, listeners: new Map(), minimized: 0, storage };
});
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.enabled }
}));
vi.mock('@capacitor/app', () => ({ App: {
  async addListener(name, handler) { native.listeners.set(name, handler); },
  async minimizeApp() { native.minimized += 1; }
} }));
// Canvas art is unrelated to native callback routing and requires a browser.
vi.mock('../src/rendering/Renderer.js', () => ({ Renderer: class {} }));
vi.mock('../src/rendering/SpriteRegistry.js', () => ({ SpriteRegistry: class {} }));

async function boot({ isNative = true } = {}) {
  native.enabled = isNative;
  const classes = new Set();
  const badge = { connected: true, remove() { this.connected = false; } };
  const canvas = new EventTarget();
  const document = {
    documentElement: {
      classList: { add(name) { classes.add(name); } },
      style: { setProperty() {} }
    },
    getElementById(id) {
      if (id === 'game-canvas') return canvas;
      if (id === 'pixelpicked-badge' && badge.connected) return badge;
      return null;
    }
  };
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', Object.assign(new EventTarget(), {
    location: { search: '', hostname: 'localhost' }, innerWidth: 480, innerHeight: 900
  }));
  const [{ Game }, { GameLoop }, { BillingService }, { AdService }] = await Promise.all([
    import('../src/core/Game.js'), import('../src/core/GameLoop.js'),
    import('../src/monetization/BillingService.js'), import('../src/monetization/AdService.js')
  ]);
  // Keep the real composition, scene manager and bus; avoid rendering,
  // purchases and ad requests at the external side-effect boundaries.
  let game;
  vi.spyOn(Game.prototype, 'boot').mockImplementation(async function () { game = this; });
  vi.spyOn(BillingService.prototype, 'init').mockResolvedValue(undefined);
  vi.spyOn(AdService.prototype, 'init').mockResolvedValue(undefined);
  const pause = vi.spyOn(GameLoop.prototype, 'pauseRendering').mockImplementation(() => {});
  const resume = vi.spyOn(GameLoop.prototype, 'resumeRendering').mockImplementation(() => {});
  await import('../src/main.js');
  await vi.waitFor(() => expect(game).toBeDefined());
  return { game, badge, classes, pause, resume };
}

beforeEach(() => {
  vi.resetModules();
  native.listeners.clear();
  native.minimized = 0;
  native.storage.clear();
  vi.stubGlobal('localStorage', {
    getItem(key) { return native.storage.get(key) ?? null; },
    setItem(key, value) { native.storage.set(key, String(value)); },
    removeItem(key) { native.storage.delete(key); }
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete globalThis.__shadowDepthsMeta;
  delete globalThis.__shadowPerf;
});

// Cold imports compile the real bootstrap and its scene/UI dependencies.
// Allow that setup under parallel-worker CPU contention without changing
// the project's timeout or weakening any native behavior assertions.
describe('native Back routing through the booted composition', { timeout: 30_000 }, () => {
  it.each(['crafting', 'floorEvents', 'vigil', 'skillsModal', 'paywall', 'inventoryUI', 'pause', 'skillPicker'])(
    'routes Back from %s to scene escape instead of quitting', async (overlay) => {
      const { game } = await boot();
      const inputs = [];
      game.scenes.switch('game', {
        player: { isDead: false }, [overlay]: { open: true },
        handleInput(action) { inputs.push(action); }
      });
      await native.listeners.get('backButton')({ canGoBack: false });
      expect(inputs).toEqual([{ type: 'escape' }]);
      expect(game.scenes.currentName).toBe('game');
    }
  );

  it('preserves pending skill choices and does not spend an action on Back', async () => {
    const { game } = await boot();
    const bus = new EventBus();
    const picker = new SkillPickerUI({ bus, content: { skills: { skills: [
      { id: 'a', rarity: 'common', tags: [] },
      { id: 'b', rarity: 'common', tags: [] },
      { id: 'c', rarity: 'common', tags: [] }
    ] } } });
    const player = {
      kind: 'player', isDead: false, skills: [],
      applySkill(id) { this.skills.push(id); }, setSynergyMods() {}
    };
    bus.emit('entity:leveledUp', { entity: player, levels: 2 });
    picker._openedAt = Date.now() - OPEN_GRACE_MS - 1;
    const choices = picker.choices.map(({ id }) => id);
    let turns = 0;
    const scene = Object.assign(Object.create(GameScene.prototype), {
      enter: undefined, exit: undefined,
      player, skillPicker: picker, inventoryUI: { open: false },
      _endPlayerTurn() { turns += 1; }
    });
    game.scenes.switch('game', scene);
    await native.listeners.get('backButton')({ canGoBack: false });
    expect(picker.pending).toBe(2);
    expect(picker.choices.map(({ id }) => id)).toEqual(choices);
    expect(picker.rerollsLeft).toBe(1);
    expect(picker.open).toBe(true);
    expect(player.skills).toEqual([]);
    expect(turns).toBe(0);
    expect(game.scenes.currentName).toBe('game');
  });

  it('closes a topmost crafting panel before consuming a pending picker', async () => {
    const { game } = await boot();
    const crafting = { open: true, hide() { this.open = false; } };
    const picker = { open: true, pending: 2, handleInput() { this.pending -= 1; } };
    const scene = Object.assign(Object.create(GameScene.prototype), {
      enter: undefined, exit: undefined,
      player: { isDead: false }, crafting, skillPicker: picker, inventoryUI: { open: false }
    });
    game.scenes.switch('game', scene);
    await native.listeners.get('backButton')({ canGoBack: false });
    expect(crafting.open).toBe(false);
    expect(picker.pending).toBe(2);
    expect(game.scenes.currentName).toBe('game');
  });

  it('routes a paywall above pause through escape', async () => {
    const { game } = await boot();
    game.paywall.show('menu');
    const pause = { open: true };
    const scene = Object.assign(Object.create(GameScene.prototype), {
      enter: undefined, exit: undefined,
      player: { isDead: false }, paywall: game.paywall, pause, inventoryUI: { open: false }
    });
    const input = vi.spyOn(scene, 'handleInput');
    game.scenes.switch('game', scene);
    await native.listeners.get('backButton')({ canGoBack: false });
    expect(input).toHaveBeenCalledWith({ type: 'escape' });
    expect(game.paywall.open).toBe(false);
    expect(pause.open).toBe(true);
    expect(game.scenes.currentName).toBe('game');
  });

  it('quits an unobstructed run to title and minimizes from title', async () => {
    const { game } = await boot();
    game.scenes.switch('game', { player: { isDead: false } });
    await native.listeners.get('backButton')({ canGoBack: false });
    expect(game.scenes.currentName).toBe('title');
    await native.listeners.get('backButton')({ canGoBack: false });
    expect(native.minimized).toBe(1);
  });
});

describe('native app state and startup', { timeout: 30_000 }, () => {
  it('flushes a run on background and emits one foreground per transition', async () => {
    const { game, pause, resume } = await boot();
    let saves = 0;
    let foregrounds = 0;
    let backgrounds = 0;
    game.scenes.switch('game', { flushRunSave() { saves += 1; } });
    game.bus.on('app:foreground', () => { foregrounds += 1; });
    game.bus.on('app:background', () => { backgrounds += 1; });
    const change = native.listeners.get('appStateChange');
    change({ isActive: false });
    change({ isActive: false });
    change({ isActive: true });
    change({ isActive: true });
    expect(saves).toBe(1);
    expect(backgrounds).toBe(1);
    expect(foregrounds).toBe(1);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('removes the actual website badge on native startup', async () => {
    const { badge, classes } = await boot();
    expect(badge.connected).toBe(false);
    expect(classes.has('capacitor-native')).toBe(true);
  });

  it('keeps the website badge and skips native callbacks on web', async () => {
    const { badge, classes } = await boot({ isNative: false });
    expect(badge.connected).toBe(true);
    expect(classes.has('capacitor-native')).toBe(false);
    expect(native.listeners.size).toBe(0);
  });
});
