import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunPersistence } from '../src/core/RunPersistence.js';
import { GameScene } from '../src/core/GameScene.js';
import { EventBus } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { CombatSystem } from '../src/combat/CombatSystem.js';
import { DEFAULT_BALANCE } from '../src/config/balance.js';
import { TILE } from '../src/config/constants.js';
import { Player } from '../src/entities/Player.js';
import { Inventory } from '../src/items/Inventory.js';
import { ItemFactory } from '../src/items/ItemFactory.js';
import { Floor } from '../src/world/Floor.js';
import { makeElite } from '../src/gameplay/eliteAffixes.js';
import { OPEN_GRACE_MS, SkillPickerUI } from '../src/ui/SkillPickerUI.js';
import { heroDef } from '../src/rendering/heroSprites.js';
import { effectiveTorchRadius } from '../src/gameplay/heroPassives.js';
import itemDefs from '../data/items.json';
import skillDefs from '../data/skills.json';

const CONTENT = {
  skills: { skills: [
    { id: 'quickened', name: 'Quickened', rarity: 'common', tags: ['hunt'] },
    { id: 'sharpened', name: 'Sharpened', rarity: 'common', tags: ['fury'] },
    { id: 'tempered', name: 'Tempered', rarity: 'common', tags: ['ward'] },
    { id: 'hardened', name: 'Hardened', rarity: 'common', tags: ['ward'] },
    { id: 'studious', name: 'Studious', rarity: 'common', tags: ['arcane'] }
  ] },
  items: itemDefs,
  enemies: {
    guardian: {
      id: 'guardian', name: 'Guardian', behavior: 'heavy',
      behaviorParams: { actEveryNTurns: 3 },
      stats: { hp: 10, atk: 4, def: 1, dex: 0 },
      xp: 10, goldDrop: [2, 4],
      onHitPlayer: [{ type: 'applyStatus', status: 'burn', value: 1, duration: 3 }]
    }
  }
};

const BALANCE = {
  ...DEFAULT_BALANCE,
  enemyScaling: { hp: 1, atk: 1 },
  combat: {
    ...DEFAULT_BALANCE.combat,
    varianceMin: 0, varianceMax: 0, variancePct: 0,
    baseCritChance: 0, critPerDex: 0, baseHit: 1,
    dodgePerDex: 0, backstabMult: 1, flankMult: 1
  }
};

function session({ rerollBonus = 0, heroKind = 'vigil', content = CONTENT } = {}) {
  // Exercise persistence with real world/entity/UI/combat components and the
  // scene's death cleanup; rendering and persistent storage stay at the boundary.
  const scene = Object.create(GameScene.prototype);
  Object.assign(scene, {
    bus: new EventBus(), content, balance: BALANCE,
    seed: 42, mode: 'normal', heroKind, rng: new RNG(42, 'run'),
    dungeon: { currentIndex: 5 }, _forgeOffers: {}, _forgeUsed: {},
    _busHandlers: [], _runEnded: false,
    floor: new Floor(5, { index: 5, depthScale: 1 }, 42)
  });
  scene.itemFactory = new ItemFactory(content.items);
  scene.player = new Player(BALANCE, { x: 2, y: 2 }, new Inventory(9), {
    heroKind, heroOverrides: { torchRadius: heroDef(heroKind).stats.torchRadius }
  });
  scene.floor.setTile(2, 2, TILE.FLOOR);
  scene.floor.setTile(3, 2, TILE.FLOOR);
  scene.floor.addEntity(scene.player);
  scene.skillPicker = new SkillPickerUI({
    bus: scene.bus, content, rng: new RNG(431, 'skills'),
    metaProgress: { upgradeLevel: () => rerollBonus }
  });
  scene.combat = new CombatSystem({ bus: scene.bus, balance: BALANCE, rng: scene.rng });
  scene.runPersistence = new RunPersistence(scene);
  scene.save = {
    saveRun(snapshot) { scene.savedSnapshot = JSON.parse(JSON.stringify(snapshot)); }
  };
  scene._wireDeathCleanup();
  return scene;
}

function save(scene) {
  scene.runPersistence.flushRunSave(1_000_000);
  return scene.savedSnapshot;
}

function resume(snapshot, scene = session()) {
  scene._resetBlockingUI();
  scene.runPersistence.restorePlayerSnapshot(scene.player, snapshot.player);
  scene.runPersistence.restoreFloorSnapshot(scene.floor, snapshot.floor);
  return scene;
}

function offer(scene, levels = 1) {
  scene.player.level += levels;
  scene.bus.emit('entity:leveledUp', { entity: scene.player, levels });
  // A hand-checked offer makes the selected card's stat effect unambiguous.
  scene.skillPicker.choices = CONTENT.skills.skills.slice(0, 3);
}

function pastGrace() {
  vi.advanceTimersByTime(OPEN_GRACE_MS + 1);
}

function guardian(scene, affixes = []) {
  const enemy = scene._createEnemy('guardian', { x: 3, y: 2 }, scene.floor);
  makeElite(enemy, affixes, 5);
  scene.floor.addEntity(enemy);
  return enemy;
}

describe('pending skill choices survive session recovery', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
  afterEach(() => { vi.useRealTimers(); });

  it('restores the saved offer after entry reset and applies the chosen skill exactly once', () => {
    const original = session();
    offer(original);
    pastGrace();
    original.skillPicker.handleInput({ type: 'move', dx: 1 });
    const restored = resume(save(original));

    expect(restored.skillPicker.open).toBe(true);
    expect(restored.skillPicker.choices.map((s) => s.id))
      .toEqual(['quickened', 'sharpened', 'tempered']);
    expect(restored.skillPicker.selected).toBe(1);
    expect(restored.skillPicker.pending).toBe(1);
    // A resume is another modal opening, so an in-flight tap cannot consume it.
    restored.skillPicker.handleInput({ type: 'confirm' });
    expect(restored.player.skills).toEqual([]);
    pastGrace();
    expect(restored.skillPicker.handleInput({ type: 'confirm' })).toBe(true);
    expect(restored.player.skills).toEqual(['sharpened']);
    expect(restored.player.stats.atk).toBe(4);
    expect(restored.skillPicker.pending).toBe(0);
    expect(restored.skillPicker.open).toBe(false);
    expect(restored.skillPicker.handleInput({ type: 'confirm' })).toBe(false);

    const again = resume(save(restored));
    pastGrace();
    expect(again.skillPicker.handleInput({ type: 'confirm' })).toBe(false);
    expect(again.player.skills).toEqual(['sharpened']);
    expect(again.player.stats.atk).toBe(4);
  });

  it('consumes every queued pick once and gives the next pick its normal reroll budget', () => {
    const original = session({ rerollBonus: 2 });
    offer(original, 2);
    pastGrace();
    original.skillPicker.handleInput({ type: 'wait' });
    original.skillPicker.choices = CONTENT.skills.skills.slice(0, 3);
    const restored = resume(save(original), session({ rerollBonus: 2 }));

    expect(restored.skillPicker.pending).toBe(2);
    expect(restored.skillPicker.rerollsLeft).toBe(2);
    pastGrace();
    restored.skillPicker.handleInput({ type: 'confirm' });
    expect(restored.player.skills).toEqual(['quickened']);
    expect(restored.player.stats.dex).toBe(4);
    expect(restored.skillPicker.pending).toBe(1);
    expect(restored.skillPicker.rerollsLeft).toBe(3);
    expect(restored.skillPicker.choices.some((s) => s.id === 'quickened')).toBe(false);
    restored.skillPicker.handleInput({ type: 'confirm' });
    expect(restored.player.skills).toHaveLength(1);
    pastGrace();
    restored.skillPicker.handleInput({ type: 'confirm' });
    expect(restored.player.skills).toHaveLength(2);
    expect(new Set(restored.player.skills).size).toBe(2);
    expect(restored.skillPicker.pending).toBe(0);
    expect(restored.skillPicker.open).toBe(false);
  });

  it('keeps spent free rerolls spent across repeated resumes and a changed meta bonus', () => {
    const original = session();
    offer(original);
    pastGrace();
    original.skillPicker.handleInput({ type: 'wait' });
    original.skillPicker.choices = CONTENT.skills.skills.slice(0, 3);
    let snapshot = save(original);
    for (let i = 0; i < 3; i++) {
      const restored = resume(snapshot, session({ rerollBonus: 2 }));
      expect(restored.skillPicker.rerollsLeft).toBe(0);
      expect(restored.skillPicker.pending).toBe(1);
      pastGrace();
      restored.skillPicker.handleInput({ type: 'wait' });
      expect(restored.skillPicker.choices.map((s) => s.id))
        .toEqual(['quickened', 'sharpened', 'tempered']);
      expect(restored.player.skills).toEqual([]);
      snapshot = save(restored);
    }
  });

  it('restores the remaining free reroll and spends it without consuming a pick', () => {
    const original = session();
    offer(original);
    const restored = resume(save(original), session({ rerollBonus: 2 }));
    expect(restored.skillPicker.rerollsLeft).toBe(1);
    pastGrace();
    restored.skillPicker.handleInput({ type: 'wait' });
    expect(restored.skillPicker.rerollsLeft).toBe(0);
    expect(restored.skillPicker.pending).toBe(1);
    expect(restored.player.skills).toEqual([]);
  });

  it('loads a legacy player snapshot without inheriting another run\'s pending picks', () => {
    const original = session();
    original.player.applySkill('sharpened');
    const legacy = save(original);
    delete legacy.player.skillPicker;
    const restored = session();
    offer(restored, 2);
    restored.runPersistence.restorePlayerSnapshot(restored.player, legacy.player);
    expect(restored.skillPicker.open).toBe(false);
    expect(restored.skillPicker.pending).toBe(0);
    expect(restored.player.skills).toEqual(['sharpened']);
    expect(restored.player.stats.atk).toBe(4);
  });
});

describe('permanent skill torch radius survives session recovery', () => {
  const content = { ...CONTENT, skills: skillDefs };
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
  afterEach(() => { vi.useRealTimers(); });

  it.each(['torchbearer', 'lanternheart'])('keeps the absolute radius after choosing %s and repeatedly resuming', (skillId) => {
    const original = session({ content });
    offer(original);
    original.skillPicker.choices = [skillDefs.skills.find((skill) => skill.id === skillId)];
    pastGrace();
    original.skillPicker.handleInput({ type: 'confirm' });
    expect(original.player.torchRadius).toBe(6);
    let snapshot = save(original);
    expect(snapshot.player.torchRadius).toBe(6);

    for (let i = 0; i < 3; i++) {
      const restored = resume(snapshot, session({ content }));
      expect(restored.player.skills).toEqual([skillId]);
      expect(restored.player.torchRadius).toBe(6);
      expect(effectiveTorchRadius(restored.player)).toBe(6);
      expect(restored.skillPicker.pending).toBe(0);
      snapshot = save(restored);
      expect(snapshot.player.torchRadius).toBe(6);
    }
  });

  it.each([
    { heroKind: 'vigil', torchSkills: ['torchbearer', 'lanternheart'], radius: 7, regenAmount: 1 },
    { heroKind: 'pilgrim', torchSkills: ['pilgrim_ember', 'lanternheart'], radius: 10, regenAmount: 2 }
  ])('recovers missing legacy torch radius for $heroKind without replaying skill effects', (fixture) => {
    const original = session({ content, heroKind: fixture.heroKind });
    for (const id of ['hardened', 'sharpened', 'field_mender', ...fixture.torchSkills]) {
      original.player.applySkill(id, skillDefs.skills.find((skill) => skill.id === id));
    }
    const legacy = save(original);
    delete legacy.player.torchRadius;
    const restored = session({ content, heroKind: fixture.heroKind });

    // Reusing the same player must not add the legacy bonus again on each restore.
    for (let i = 0; i < 3; i++) {
      restored.runPersistence.restorePlayerSnapshot(restored.player, legacy.player);
      expect(restored.player.torchRadius).toBe(fixture.radius);
      expect(restored.player.stats.hpMax).toBe(35);
      expect(restored.player.stats.atk).toBe(4);
      expect(restored.player.regenEveryNTurns).toBe(9);
      expect(restored.player.regenAmount).toBe(fixture.regenAmount);
      expect(restored.player.skills).toHaveLength(5);
    }
    const upgraded = save(restored);
    expect(upgraded.player.torchRadius).toBe(fixture.radius);
    expect(resume(upgraded, session({ content, heroKind: fixture.heroKind })).player.torchRadius)
      .toBe(fixture.radius);
  });

  it('honors a saved absolute radius rather than adding owned torch bonuses to it', () => {
    const original = session({ content });
    original.player.applySkill('torchbearer');
    original.player.applySkill('lanternheart', skillDefs.skills.find((skill) => skill.id === 'lanternheart'));
    original.player.torchRadius = 11;
    const snapshot = save(original);
    const restored = session({ content });
    for (let i = 0; i < 3; i++) {
      restored.runPersistence.restorePlayerSnapshot(restored.player, snapshot.player);
      expect(restored.player.torchRadius).toBe(11);
    }
  });
});

describe('enemy identity and rewards survive session recovery', () => {
  it('drops a saved keybearer\'s vault key once when it dies after restore', () => {
    const original = session();
    guardian(original).carriesKey = true;
    const restored = resume(save(original));
    const enemy = restored.floor.enemies()[0];
    enemy.takeDamage(enemy.stats.hp);
    restored.combat._handleDeath(enemy, restored.player, { floor: restored.floor });

    expect(restored.floor.itemsAt(3, 2).map((item) => item.id)).toEqual(['vault_key']);
    expect(restored.floor.entityAt(3, 2)).toBeNull();
    restored.bus.emit('entity:died', { entity: enemy, killer: restored.player });
    expect(restored.floor.itemsAt(3, 2).map((item) => item.id)).toEqual(['vault_key']);
    expect(resume(save(restored)).floor.itemsAt(3, 2).map((item) => item.id))
      .toEqual(['vault_key']);
  });

  it.each([
    { affixes: ['brutal', 'tough'], name: 'Brutal Tough Guardian', color: '#9aa2ac',
      hpMax: 29, atk: 6, def: 3, eva: 0, acc: 0, effects: [] },
    { affixes: ['swift', 'keen'], name: 'Swift Keen Guardian', color: '#ffe39a',
      hpMax: 18, atk: 5, def: 1, eva: 0.18, acc: 0.15, effects: [] },
    { affixes: ['vampiric', 'chilling'], name: 'Vampiric Chilling Guardian', color: '#bcd6ff',
      hpMax: 18, atk: 4, def: 1, eva: 0, acc: 0, effects: [
        { type: 'lifesteal', value: 0.6 },
        { type: 'applyStatus', status: 'slow', value: 1, duration: 2 }
      ] },
    { affixes: ['venomous', 'shielded'], name: 'Venomous Shielded Guardian', color: '#84bcec',
      hpMax: 22, atk: 4, def: 5, eva: 0, acc: 0, effects: [
        { type: 'applyStatus', status: 'poison', value: 1, duration: 2 }
      ] }
  ])('preserves $name without multiplying saved stats or rewards on each resume', (fixture) => {
    const original = session();
    const enemy = guardian(original, fixture.affixes);
    enemy.stats.hp = 7;
    enemy.statusEffects = [{ id: 'poison', value: 2, duration: 3 }];
    enemy._rolledGold = 8;
    // Two genuine wind-up turns; the next restored action must be an attack.
    const ctx = { player: original.player, floor: original.floor };
    enemy.decide(ctx);
    enemy.decide(ctx);
    let snapshot = save(original);
    let restored;
    for (let i = 0; i < 3; i++) {
      restored = resume(snapshot);
      const resumed = restored.floor.enemies()[0];
      expect(resumed.stats).toEqual({
        hp: 7, hpMax: fixture.hpMax, atk: fixture.atk, def: fixture.def, dex: 0
      });
      expect(resumed.elite).toEqual({
        affixes: fixture.affixes,
        names: fixture.name.split(' ').slice(0, -1), color: fixture.color
      });
      expect(resumed.name).toBe(fixture.name);
      expect(resumed.evaBonus).toBe(fixture.eva);
      expect(resumed.accBonus).toBe(fixture.acc);
      expect(resumed.onHitPlayer).toEqual([
        { type: 'applyStatus', status: 'burn', value: 1, duration: 3 }, ...fixture.effects
      ]);
      expect(resumed.xpReward).toBe(22);
      expect(resumed.goldDrop).toEqual([5, 10]);
      expect(resumed._rolledGold).toBe(8);
      expect(resumed.statusEffects).toEqual([{ id: 'poison', value: 2, duration: 3 }]);
      expect(resumed.behavior._counter).toBe(2);
      snapshot = save(restored);
    }
    expect(restored.floor.enemies()[0].decide({ player: restored.player, floor: restored.floor }).type)
      .toBe('attack');
  });

  it('keeps elite lifesteal and slowing on-hit effects active in combat after repeated resumes', () => {
    let scene = session();
    guardian(scene, ['vampiric', 'chilling']).stats.hp = 7;
    for (let i = 0; i < 3; i++) scene = resume(save(scene));
    const enemy = scene.floor.enemies()[0];
    scene.combat.execute({ type: 'attack', target: { x: 2, y: 2 } }, enemy,
      { player: scene.player, floor: scene.floor });
    expect(scene.player.stats.hp).toBeLessThan(30);
    expect(enemy.stats.hp).toBeGreaterThan(7);
    expect(scene.player.statusEffects.map((s) => s.id)).toEqual(['burn', 'slow']);
  });

  it('credits the elite XP and gold range on an actual kill after repeated resumes', () => {
    let scene = session();
    guardian(scene, ['brutal']).stats.hp = 1;
    for (let i = 0; i < 3; i++) scene = resume(save(scene));
    scene.combat.execute({ type: 'attack', target: { x: 3, y: 2 } }, scene.player,
      { player: scene.player, floor: scene.floor });
    expect(scene.floor.enemies()).toHaveLength(0);
    expect(scene.player.runStats.enemiesDefeated).toBe(1);
    expect(scene.player.xp).toBe(22);
    expect(scene.player.gold).toBeGreaterThanOrEqual(5);
    expect(scene.player.gold).toBeLessThanOrEqual(10);
  });

  it('keeps factory defaults when a legacy enemy snapshot lacks the new metadata', () => {
    const restored = session();
    restored.runPersistence.restoreFloorSnapshot(restored.floor, { enemies: [{
      defId: 'guardian', x: 3, y: 2,
      stats: { hp: 6, hpMax: 10, atk: 4, def: 1, dex: 0 },
      statusEffects: [], rolledGold: 3, behaviorState: { counter: 1 }
    }] });
    const enemy = restored.floor.enemies()[0];
    expect(enemy.stats.hp).toBe(6);
    expect(enemy.elite).toBeFalsy();
    expect(enemy.carriesKey).toBeFalsy();
    expect(enemy.name).toBe('Guardian');
    expect(enemy.xpReward).toBe(10);
    expect(enemy.goldDrop).toEqual([2, 4]);
    expect(enemy.onHitPlayer).toEqual([{ type: 'applyStatus', status: 'burn', value: 1, duration: 3 }]);
    expect(enemy.behavior._counter).toBe(1);
  });
});
