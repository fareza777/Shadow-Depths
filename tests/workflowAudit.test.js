import { describe, it, expect, vi } from 'vitest';
import { describeBiomeMechanic, getBiomeMechanic } from '../src/gameplay/biomeMechanics.js';
import { t, setLocale } from '../src/content/i18n.js';
import { RUN_SNAPSHOT_KEYS } from './runSnapshot.test.js';
import biomesData from '../data/biomes.json';
import { RunPersistence } from '../src/core/RunPersistence.js';

describe('workflow: biome mechanics', () => {
  it('maps every biome mechanic to a non-empty description', () => {
    const biomes = biomesData.biomes || [];
    expect(biomes.length).toBeGreaterThan(0);
    for (const b of biomes) {
      const m = getBiomeMechanic(b.id, biomesData);
      expect(m, `biome ${b.id} should declare mechanic`).toBeTruthy();
      expect(describeBiomeMechanic(m).length).toBeGreaterThan(8);
    }
  });
});

describe('workflow: i18n EN/ID critical surfaces', () => {
  const keys = [
    'title.newrun', 'title.daily', 'paywall.unlock',
    'gameover.title', 'victory.title', 'victory.foreshadow',
    'tutorial.step_move_t', 'tutorial.keeper_welcome_b',
    'settings.reduce_motion_on', 'settings.text_large', 'char.choose'
  ];
  it('resolves keys in English', () => {
    setLocale('en');
    for (const k of keys) {
      const v = t(k);
      expect(v, k).not.toBe(k);
      expect(v.length).toBeGreaterThan(0);
    }
  });
  it('resolves keys in Indonesian', () => {
    setLocale('id');
    for (const k of keys) {
      const v = t(k);
      expect(v, k).not.toBe(k);
      expect(v.length).toBeGreaterThan(0);
    }
    setLocale('en');
  });
});

describe('workflow: tampered save rejection', () => {
  it('Game._loadRunSnapshot clears and rejects _tampered snapshots', async () => {
    const { Game } = await import('../src/core/Game.js');
    const clearRun = vi.fn();
    const save = {
      loadRun: () => ({
        version: 1,
        seed: 99,
        mode: 'normal',
        floorIndex: 15,
        player: { level: 5 },
        _tampered: true
      }),
      clearRun,
      migrate: (raw) => ({ data: raw })
    };
    const game = new Game({
      eventBus: { on() {}, emit() {} },
      stateStore: { state: { meta: {} }, setScene() {}, setRun() {} },
      sceneManager: { switch() {} },
      gameLoop: {},
      saveManager: save,
      metaProgress: { load: () => ({}), state: { settings: {} } },
      sceneFactories: {}
    });
    const snap = game._loadRunSnapshot();
    expect(snap).toBeNull();
    expect(clearRun).toHaveBeenCalled();
  });
});

describe('workflow: run snapshot contract still holds', () => {
  it('accepts a complete snapshot', () => {
    const snap = {
      version: 1,
      savedAt: Date.now(),
      seed: 42,
      mode: 'normal',
      heroKind: 'vigil',
      floorIndex: 0,
      player: { pos: { x: 1, y: 1 }, stats: { hp: 10 } },
      floor: { enemies: [] }
    };
    for (const key of RUN_SNAPSHOT_KEYS) {
      expect(snap).toHaveProperty(key);
    }
  });
});

describe('workflow: RunPersistence module', () => {
  it('constructs and exposes flushRunSave', () => {
    const scene = {
      save: null,
      player: null,
      floor: null,
      _runEnded: false
    };
    const rp = new RunPersistence(scene);
    expect(typeof rp.flushRunSave).toBe('function');
    expect(typeof rp.saveRun).toBe('function');
    expect(() => rp.flushRunSave()).not.toThrow();
  });
});
