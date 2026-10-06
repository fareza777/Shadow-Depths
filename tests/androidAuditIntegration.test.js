import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameScene } from '../src/core/GameScene.js';
import { EventBus } from '../src/core/EventBus.js';
import { Player } from '../src/entities/Player.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ChaseBehavior } from '../src/entities/behaviors/ChaseBehavior.js';
import { Inventory } from '../src/items/Inventory.js';
import { ItemFactory } from '../src/items/ItemFactory.js';
import { Floor } from '../src/world/Floor.js';
import { StatusEffects } from '../src/combat/StatusEffects.js';
import { DEFAULT_BALANCE } from '../src/config/balance.js';
import { TILE } from '../src/config/constants.js';
import { loadRecipes } from '../src/items/Crafting.js';
import { Renderer } from '../src/rendering/Renderer.js';
import { setReduceMotion } from '../src/config/layoutMetrics.js';
import items from '../data/items.json';
import recipes from '../data/recipes.json';

function fixture(index = 0) {
  const bus = new EventBus();
  const scene = new GameScene({
    bus, balance: DEFAULT_BALANCE, seed: 42,
    content: { items, enemies: {}, skills: { skills: [] }, floors: { floors: [] } },
    state: { state: { time: 0, meta: {} }, setRun() {}, patch() {} },
    lighting: { compute() {} }, hud: { render() {} }, minimap: { render() {}, toggle() {} },
    inventoryUI: { open: false, render() {}, hide() {}, toggle() {} },
    mobileControls: { setContext() {}, renderBackground() {}, renderControls() {} },
    quickUseBar: { _pressed: -1, setContext() {} }
  });
  const floor = new Floor(index, { index }, 1);
  for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) {
    floor.setTile(x, y, TILE.FLOOR);
    floor.tileAt(x, y).visible = true;
  }
  const player = new Player(DEFAULT_BALANCE, { x: 5, y: 5 }, new Inventory(9));
  floor.addEntity(player);
  scene.player = player;
  scene.floor = floor;
  scene._floorBanner = null;
  return { scene, player, floor, bus };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setReduceMotion(false);
});

describe('Android audit: gameplay integration', () => {
  it('uses a revive charge instead of ending a run on a lethal spike trap', () => {
    const { scene, player, floor } = fixture();
    player.stats.hp = 2;
    player.reviveCharges = 1;
    floor.tileAt(6, 5).hazard = { type: 'spike', armed: true };
    scene._springHazard(player, 6, 5);
    expect(player.isDead).toBe(false);
    expect(player.stats.hp).toBe(15);
    expect(player.reviveCharges).toBe(0);
  });

  it('uses a revive charge after lethal ambient hazard damage', () => {
    const { scene, player, floor } = fixture();
    player.stats.hp = 2;
    player.reviveCharges = 1;
    player.runStats.turnsUsed = 2;
    floor.tileAt(5, 5).ambient = { type: 'spike' };
    const endRun = vi.spyOn(scene, '_endRun').mockImplementation(() => {});
    scene._endPlayerTurn(true);
    expect(player.isDead).toBe(false);
    expect(player.stats.hp).toBe(15);
    expect(player.reviveCharges).toBe(0);
    expect(endRun).not.toHaveBeenCalled();
  });

  it('ends the run once after lethal ambient damage without a revive', () => {
    const { scene, player, floor } = fixture();
    player.stats.hp = 2;
    player.runStats.turnsUsed = 2;
    floor.tileAt(5, 5).ambient = { type: 'spike' };
    const endRun = vi.spyOn(scene, '_endRun').mockImplementation(() => {});
    const deaths = vi.fn();
    scene.bus.on('entity:died', deaths);
    scene._endPlayerTurn(true);
    expect(player.isDead).toBe(true);
    expect(endRun).toHaveBeenCalledExactlyOnceWith(false);
    expect(deaths).toHaveBeenCalledTimes(1);
    expect(player.runStats.killedBy).toBe('Spike Trap');
  });

  it.each([
    ['shrine', 'blood_price', 2],
    ['altar_sacrifice', 'sacrifice_hp', 3]
  ])('revives after a lethal %s health payment', (kind, id, hp) => {
    const { scene, player, floor } = fixture();
    player.stats.hp = hp;
    player.reviveCharges = 1;
    const tile = floor.tileAt(6, 5);
    tile.interact = { kind, used: false };
    let panel;
    scene.floorEvents = { show(config) { panel = config; } };
    vi.spyOn(scene, '_endRun').mockImplementation(() => {});
    scene._useFloorInteract(6, 5, tile);
    panel.onPick(id);
    expect(player.isDead).toBe(false);
    expect(player.stats.hp).toBe(15);
    expect(player.reviveCharges).toBe(0);
    expect(player.runStats.turnsUsed).toBe(1);
    expect(tile.interact.used).toBe(true);
  });

  it('does not give HP or forge materials again when continuing the same floor', () => {
    const { scene, player, floor } = fixture(6);
    floor.definition = { index: 6, type: 'forge', biomeId: 'forgotten_crypts' };
    player.stats.hp = 10;
    player.materials = { scrap_iron: 2, crypt_dust: 2 };
    player.floorModifiers = { atkPct: 0.12, defPenalty: 0, torchBonus: 1, critBonus: 0 };
    const snapshot = {
      floorIndex: 6, heroKind: 'vigil',
      player: scene.runPersistence.playerSnapshot(),
      floor: scene.runPersistence.floorSnapshot(floor)
    };
    scene.dungeon = {
      totalFloors: 100, currentIndex: 6, getOrGenerate() {},
      current: () => ({ floor, spawns: { player: { x: 5, y: 5 } } })
    };
    scene._enterFromSnapshot(snapshot);
    expect(scene.player.stats.hp).toBe(10);
    expect(scene.player.materials).toEqual({ scrap_iron: 2, crypt_dust: 2 });
    expect(scene.player.floorModifiers.atkPct).toBe(0.12);
    expect(scene.player.floorModifiers.torchBonus).toBe(1);
  });

  it('immediately persists completed skill mutations without another world turn', () => {
    const { scene, player, bus } = fixture();
    const snapshots = [];
    scene.save = { saveRun(snapshot) { snapshots.push(snapshot); } };
    scene._saveRun({ immediate: true });
    player.applySkill('sharpened');
    bus.emit('skill:selectionChanged', { entity: player });
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1].player.skills).toContain('sharpened');
    expect(player.runStats.turnsUsed).toBe(0);
  });

  it('ignores a skill mutation belonging to a different player instance', () => {
    const { scene, bus } = fixture();
    const saveRun = vi.fn();
    scene.save = { saveRun };
    bus.emit('skill:selectionChanged', {
      entity: new Player(DEFAULT_BALANCE, { x: 5, y: 5 }, new Inventory(9))
    });
    expect(saveRun).not.toHaveBeenCalled();
  });

  it('advances a frozen turn without picking up the ground item', () => {
    const { scene, player, floor } = fixture();
    const potion = new ItemFactory(items).create('health_potion');
    floor.addItem(5, 5, potion);
    StatusEffects.apply(player, { status: 'freeze', duration: 2 });
    scene._playerPickup();
    expect(player.inventory.countOf('health_potion')).toBe(0);
    expect(floor.itemsAt(5, 5)).toHaveLength(1);
    expect(player.runStats.turnsUsed).toBe(1);
    expect(player.statusEffects[0].duration).toBe(1);
  });

  it('removes the exact item picked from a multi-item pile without duplicating another', () => {
    const { scene, player, floor } = fixture();
    const factory = new ItemFactory(items);
    floor.addItem(5, 5, factory.create('worn_dagger'));
    floor.addItem(5, 5, factory.create('health_potion'));
    scene._playerPickup();
    expect(player.inventory.countOf('health_potion')).toBe(1);
    expect(floor.itemsAt(5, 5).map(item => item.id)).toEqual(['worn_dagger']);
    scene._playerPickup();
    expect(player.inventory.countOf('health_potion')).toBe(1);
    expect(player.inventory.countOf('worn_dagger')).toBe(1);
    expect(floor.itemsAt(5, 5)).toHaveLength(0);
  });

  it('reports only the amount picked up when part of a ground stack remains', () => {
    const { scene, player, floor, bus } = fixture();
    const factory = new ItemFactory(items);
    player.inventory = new Inventory(1);
    const bagItem = factory.create('health_potion');
    bagItem.count = bagItem.maxStack - 1;
    player.inventory.add(bagItem);
    const groundItem = factory.create('health_potion', 3);
    const original = groundItem.count;
    floor.addItem(5, 5, groundItem);
    let pickedUp;
    bus.on('item:pickedUp', ({ item }) => { pickedUp = item; });
    scene._playerPickup();
    expect(player.inventory.countOf('health_potion')).toBe(bagItem.maxStack);
    expect(floor.itemsAt(5, 5)[0].count).toBe(original - 1);
    expect(pickedUp.count).toBe(1);
  });

  it('does not spend a merchant interaction or a turn on a rejected purchase', () => {
    const { scene, player, floor } = fixture();
    const factory = new ItemFactory(items);
    for (let n = 0; n < player.inventory.size; n++) player.inventory.add(factory.create('worn_dagger'));
    player.gold = 100;
    const tile = floor.tileAt(6, 5);
    tile.interact = { kind: 'merchant', used: false };
    let panel;
    scene.floorEvents = { show(config) { panel = config; } };
    scene._useFloorInteract(6, 5, tile);
    panel.onPick('health_potion');
    expect(player.gold).toBe(100);
    expect(tile.interact.used).toBe(false);
    expect(player.runStats.turnsUsed).toBe(0);
  });

  it('advances a frozen turn without consuming a potion', () => {
    const { scene, player } = fixture();
    player.stats.hp = 10;
    player.inventory.add(new ItemFactory(items).create('health_potion'));
    StatusEffects.apply(player, { status: 'freeze', duration: 2 });
    scene._playerUseSlot(0);
    expect(player.inventory.countOf('health_potion')).toBe(1);
    expect(player.stats.hp).toBe(10);
    expect(player.runStats.turnsUsed).toBe(1);
    expect(player.statusEffects[0].duration).toBe(1);
  });

  it('does not claim a rest interaction during a frozen turn', () => {
    const { scene, player, floor } = fixture();
    player.stats.hp = 10;
    const tile = floor.tileAt(6, 5);
    tile.interact = { kind: 'rest_alcove', used: false };
    StatusEffects.apply(player, { status: 'freeze', duration: 2 });
    scene._useFloorInteract(6, 5, tile);
    expect(player.stats.hp).toBe(10);
    expect(tile.interact.used).toBe(false);
    expect(player.runStats.turnsUsed).toBe(1);
    expect(player.statusEffects[0].duration).toBe(1);
  });

  it('previews a waiting turn for a frozen adjacent enemy', () => {
    const { scene, floor } = fixture();
    const enemy = new Enemy({
      id: 'audit_guard', name: 'Audit Guard', stats: { hp: 30, atk: 4, def: 0 }
    }, new ChaseBehavior(), { x: 6, y: 5 });
    floor.addEntity(enemy);
    StatusEffects.apply(enemy, { status: 'freeze', duration: 2 });
    scene._refreshEnemyIntents();
    expect(enemy.intent).toEqual({ type: 'wait' });
    expect(enemy.statusEffects[0].duration).toBe(2);
  });

  it('puts a crafted item on the ground when the bag is full', () => {
    const { scene, player, floor, bus } = fixture(6);
    const factory = new ItemFactory(items);
    for (let n = 0; n < player.inventory.size; n++) player.inventory.add(factory.create('worn_dagger'));
    player.materials = { crypt_dust: 3 };
    scene.crafting = { hide() {} };
    loadRecipes(recipes);
    bus.emit('craft:request', { recipeId: 'forge_crypt_ward' });
    expect(player.materialCount('crypt_dust')).toBe(0);
    expect(player.inventory.countOf('worn_dagger')).toBe(9);
    expect(floor.itemsAt(5, 5)).toHaveLength(1);
    expect(floor.itemsAt(5, 5)[0].slot).toBe('ring');
    expect(scene._forgeUsed[scene.dungeon.currentIndex]).toBe(true);
  });

  it.each(['danger', 'toast', 'banner'])('keeps the HUD cached while the %s overlay animates', overlay => {
    const { scene, player } = fixture();
    setReduceMotion(true);
    if (overlay === 'danger') player.stats.hp = 5;
    if (overlay === 'toast') scene._lootToast = { startedAt: 1 };
    if (overlay === 'banner') scene._floorBanner = { startedAt: 1 };
    const hudRender = vi.spyOn(scene.hud, 'render');
    const danger = vi.spyOn(scene, '_renderDangerVignette').mockImplementation(() => {});
    const toast = vi.spyOn(scene, '_renderLootToast').mockImplementation(() => {});
    const banner = vi.spyOn(scene, '_renderFloorBanner').mockImplementation(() => {});
    vi.spyOn(scene, '_renderControlBandContent').mockImplementation(() => {});
    const ctx = { setTransform() {}, clearRect() {}, drawImage() {} };
    vi.stubGlobal('OffscreenCanvas', class {
      constructor(width, height) { this.width = width; this.height = height; }
      getContext() { return ctx; }
    });
    const renderer = { ctx, _leanCombatFx: true, drawCachedScreenLayerOnce: Renderer.prototype.drawCachedScreenLayerOnce };
    scene.renderUI(renderer);
    scene.renderUI(renderer);
    expect(hudRender).toHaveBeenCalledTimes(1);
    expect(danger).toHaveBeenCalledTimes(2);
    expect(toast).toHaveBeenCalledTimes(2);
    expect(banner).toHaveBeenCalledTimes(2);
  });

  it('reuses the danger vignette gradient while its intensity changes', () => {
    const { scene, player } = fixture();
    player.stats.hp = 5;
    const gradient = { addColorStop() {} };
    const ctx = {
      save() {}, restore() {}, strokeRect() {}, fillRect() {},
      createRadialGradient: vi.fn(() => gradient)
    };
    scene._renderDangerVignette({ ctx });
    player.stats.hp = 6;
    scene._renderDangerVignette({ ctx });
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])('respects Reduce Motion=%s for loot-toast bobbing', reduced => {
    const { scene } = fixture();
    setReduceMotion(reduced);
    scene._lootToast = { item: new ItemFactory(items).create('worn_dagger'), startedAt: 0, duration: 2100 };
    const positions = [];
    const renderer = {
      ctx: { save() {}, restore() {} }, measureText: () => 10, drawText() {}, drawStrokedRect() {},
      drawRect(_x, y, _w, _h, color) { if (color === '#231c2aee') positions.push(y); }
    };
    for (const age of [200, 700]) {
      vi.spyOn(performance, 'now').mockReturnValue(age);
      scene._renderLootToast(renderer);
    }
    if (reduced) expect(positions[0]).toBe(positions[1]);
    else expect(positions[0]).not.toBe(positions[1]);
  });

  it.each([true, false])('respects Reduce Motion=%s for the boss-banner accent pulse', reduced => {
    const { scene } = fixture();
    setReduceMotion(reduced);
    scene._floorBanner = { startedAt: 0, duration: 3000, boss: true, accent: '#d4be7a', title: 'BOSS', name: 'Guardian', subtitle: 'Test' };
    const accents = [];
    const renderer = {
      ctx: {
        save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
        stroke() { accents.push(this.globalAlpha); }
      },
      measureText: () => 10, drawText() {}, drawRect() {}, drawStrokedRect() {}
    };
    for (const age of [400, 700]) {
      vi.spyOn(performance, 'now').mockReturnValue(age);
      scene._renderFloorBanner(renderer);
    }
    if (reduced) expect(accents[0]).toBe(accents[1]);
    else expect(accents[0]).not.toBe(accents[1]);
  });

  it.each(['minimap', 'stats', 'skills', 'equipment', 'forge', 'vision', 'floor'])
  ('invalidates the static HUD cache after a %s change', change => {
    const { scene, player, floor } = fixture();
    scene.minimap.visible = true;
    player.weapon = new ItemFactory(items).create('worn_dagger');
    const before = scene._uiCacheKey();
    if (change === 'minimap') scene.minimap.visible = false;
    if (change === 'stats') player.stats.atk += 1;
    if (change === 'skills') player.skills.push('long_reach');
    if (change === 'equipment') player.weapon.name = 'Rerolled Dagger';
    if (change === 'forge') scene._forgeUsed[scene.dungeon.currentIndex] = true;
    if (change === 'vision') floor.visibilityRevision += 1;
    if (change === 'floor') floor.seed += 1;
    expect(scene._uiCacheKey()).not.toBe(before);
  });
});
