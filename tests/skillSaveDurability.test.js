import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameScene } from '../src/core/GameScene.js';
import { EventBus } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { DEFAULT_BALANCE } from '../src/config/balance.js';
import { TILE } from '../src/config/constants.js';
import { Player } from '../src/entities/Player.js';
import { Inventory } from '../src/items/Inventory.js';
import { Floor } from '../src/world/Floor.js';
import { OPEN_GRACE_MS, SkillPickerUI } from '../src/ui/SkillPickerUI.js';
import items from '../data/items.json';
import skills from '../data/skills.json';

const CONTENT = {
  items, enemies: {}, floors: { floors: [] },
  skills: { skills: ['quickened', 'sharpened', 'tempered', 'hardened', 'studious']
    .map((id) => skills.skills.find((skill) => skill.id === id)) }
};
const scenes = [];

function session({ snapshot, rerollBonus = 0, ads = null } = {}) {
  const bus = new EventBus();
  const writes = [];
  const picker = new SkillPickerUI({
    bus, content: CONTENT, rng: new RNG(431, 'skills'),
    metaProgress: { upgradeLevel: () => rerollBonus }, adService: ads
  });
  // Only storage, display, and floor generation are boundary doubles. Entry,
  // input routing, the picker, player, floor, and persistence all stay real.
  const scene = new GameScene({
    bus, balance: DEFAULT_BALANCE, content: CONTENT, seed: 42, skillPicker: picker,
    state: { state: { time: 0, meta: {} }, setRun() {}, patch() {} },
    lighting: { compute() {} }, hud: {}, minimap: {},
    inventoryUI: { open: false, hide() {} }, mobileControls: {}, quickUseBar: {},
    saveManager: { saveRun(value) { writes.push(JSON.parse(JSON.stringify(value))); } },
    resumeSnapshot: snapshot
  });
  const floor = new Floor(0, { index: 0 }, 42);
  floor.setTile(5, 5, TILE.FLOOR);
  const entry = { floor, spawns: { player: { x: 5, y: 5 }, enemies: [], items: [] } };
  scene.dungeon = {
    currentIndex: 0, totalFloors: 100,
    getOrGenerate: () => entry, current: () => entry
  };
  scenes.push(scene);
  scene._enterImpl();
  return { scene, bus, picker, writes };
}

function offer(run, levels = 1) {
  run.scene.player.level += levels;
  run.bus.emit('entity:leveledUp', { entity: run.scene.player, levels });
  run.picker.choices = CONTENT.skills.skills.slice(0, 3);
}

function observe(run) {
  const notifications = [];
  run.bus.on('skill:selectionChanged', (payload) => {
    notifications.push({
      payload, skills: [...run.scene.player.skills],
      picker: run.picker.toSnapshot(), open: run.picker.open
    });
  });
  return notifications;
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
afterEach(() => {
  for (const scene of scenes.splice(0)) scene._cancelPendingRunSave();
  vi.useRealTimers();
});
const pastGrace = () => vi.advanceTimersByTime(OPEN_GRACE_MS + 1);

describe('skill selection persistence event contract', () => {
  it('notifies with the player after the last pending pick and its offer are fully consumed', () => {
    const run = session();
    offer(run);
    const notifications = observe(run);
    pastGrace();
    run.scene.handleInput({ type: 'confirm' });

    expect(notifications).toEqual([{
      payload: { entity: run.scene.player }, skills: ['quickened'], open: false,
      picker: { pending: 0, choices: [], rerollsLeft: 0, selected: 0 }
    }]);
  });

  it('notifies only after a queued pick has its next offer and fresh reroll budget', () => {
    const run = session({ rerollBonus: 2 });
    offer(run, 2);
    const notifications = observe(run);
    pastGrace();
    run.scene.handleInput({ type: 'confirm' });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].payload).toEqual({ entity: run.scene.player });
    expect(notifications[0].skills).toEqual(['quickened']);
    expect(notifications[0].open).toBe(true);
    expect(notifications[0].picker.pending).toBe(1);
    expect(notifications[0].picker.rerollsLeft).toBe(3);
    expect(notifications[0].picker.choices).toHaveLength(3);
    expect(notifications[0].picker.choices).not.toContain('quickened');
    expect(notifications[0].picker).toEqual(run.picker.toSnapshot());
  });

  it('notifies after spending a free reroll without consuming the pending pick', () => {
    const run = session();
    offer(run);
    const notifications = observe(run);
    pastGrace();
    run.scene.handleInput({ type: 'wait' });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].payload).toEqual({ entity: run.scene.player });
    expect(notifications[0].skills).toEqual([]);
    expect(notifications[0].picker.pending).toBe(1);
    expect(notifications[0].picker.rerollsLeft).toBe(0);
    expect(notifications[0].picker).toEqual(run.picker.toSnapshot());
    run.scene.handleInput({ type: 'wait' });
    expect(notifications).toHaveLength(1);
  });

  it.each([true, false])('notifies for a rewarded redraw only when the reward was earned (%s)', async (earned) => {
    const run = session({ ads: {
      canOfferReroll: () => true, showRewardedReroll: async () => earned
    } });
    offer(run);
    run.picker.rerollsLeft = 0;
    const before = run.picker.toSnapshot();
    const notifications = observe(run);
    await run.picker._rerollByAd();

    expect(notifications).toHaveLength(earned ? 1 : 0);
    if (earned) {
      expect(notifications[0].payload).toEqual({ entity: run.scene.player });
      expect(notifications[0].picker.pending).toBe(1);
      expect(notifications[0].picker.rerollsLeft).toBe(0);
      expect(notifications[0].picker).toEqual(run.picker.toSnapshot());
    } else {
      expect(run.picker.toSnapshot()).toEqual(before);
    }
  });

  it('notifies after presenting a new entitlement and after changing the highlighted card', () => {
    const run = session();
    const notifications = observe(run);
    run.bus.emit('entity:leveledUp', { entity: run.scene.player, levels: 2 });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].picker.pending).toBe(2);
    expect(notifications[0].picker.choices).toHaveLength(3);
    expect(notifications[0].picker.rerollsLeft).toBe(1);
    run.scene.handleInput({ type: 'move', dx: 1 });
    expect(notifications).toHaveLength(2);
    expect(notifications[1].picker.selected).toBe(1);
  });

  it('does not notify on restore, modal reset, scene exit cleanup, or grace-window no-ops', () => {
    const run = session();
    offer(run);
    const saved = run.picker.toSnapshot();
    const notifications = observe(run);
    run.picker.restoreSnapshot(saved, run.scene.player);
    run.scene.handleInput({ type: 'confirm' });
    run.scene.handleInput({ type: 'wait' });
    run.picker.restoreSnapshot({ ...saved, choices: ['removed_skill'] }, run.scene.player);
    run.scene._resetBlockingUI();
    run.bus.emit('scene:switched', { to: 'title' });
    run.bus.emit('request:newRun');
    expect(notifications).toEqual([]);
  });
});

describe('GameScene immediately saves skill mutations', () => {
  it('persists a reroll after the earlier turn save has settled, without an explicit flush', () => {
    const run = session();
    offer(run);
    run.scene._saveRun();
    vi.advanceTimersByTime(600);
    const writesBefore = run.writes.length;
    run.scene.handleInput({ type: 'wait' });

    expect(run.writes).toHaveLength(writesBefore + 1);
    const saved = run.writes.at(-1);
    expect(saved.player.skillPicker.rerollsLeft).toBe(0);
    expect(saved.player.skillPicker.pending).toBe(1);
    expect(saved.player.skillPicker.choices).toEqual(run.picker.choices.map((skill) => skill.id));
    const resumed = session({ snapshot: saved });
    expect(resumed.picker.toSnapshot()).toEqual(saved.player.skillPicker);
    expect(resumed.picker.open).toBe(true);
  });

  it('persists the next queued offer and then the final consumption before confirm returns', () => {
    const run = session({ rerollBonus: 2 });
    offer(run, 2);
    run.scene._saveRun();
    vi.advanceTimersByTime(600);
    const writesBefore = run.writes.length;
    run.scene.handleInput({ type: 'confirm' });

    expect(run.writes).toHaveLength(writesBefore + 1);
    expect(run.writes.at(-1).player.skills).toEqual(['quickened']);
    expect(run.writes.at(-1).player.skillPicker.pending).toBe(1);
    expect(run.writes.at(-1).player.skillPicker.rerollsLeft).toBe(3);
    expect(run.writes.at(-1).player.skillPicker.choices).not.toContain('quickened');
    const secondId = run.picker.choices[0].id;
    pastGrace();
    run.scene.handleInput({ type: 'confirm' });
    expect(run.writes).toHaveLength(writesBefore + 2);
    const saved = run.writes.at(-1);
    expect(saved.player.skills).toEqual(['quickened', secondId]);
    expect(saved.player.skillPicker).toEqual({ pending: 0, choices: [], rerollsLeft: 0, selected: 0 });
    const resumed = session({ snapshot: saved });
    expect(resumed.scene.player.skills).toEqual(['quickened', secondId]);
    expect(resumed.scene.player.stats).toEqual(saved.player.stats);
    expect(resumed.picker.open).toBe(false);
    expect(resumed.picker.handleInput({ type: 'confirm' })).toBe(false);
  });

  it('does not overwrite the active run from another player\'s selection event', () => {
    const run = session();
    vi.advanceTimersByTime(600);
    const writesBefore = run.writes.length;
    const inactive = new Player(DEFAULT_BALANCE, { x: 5, y: 5 }, new Inventory(9));
    run.bus.emit('skill:selectionChanged', { entity: inactive });
    expect(run.writes).toHaveLength(writesBefore);
  });
});
