import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatSystem } from '../src/combat/CombatSystem.js';
import { StatusEffects } from '../src/combat/StatusEffects.js';
import { DEFAULT_BALANCE } from '../src/config/balance.js';
import { TILE } from '../src/config/constants.js';
import { EventBus } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { runEnemyTurns } from '../src/core/EnemyTurnRunner.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Player } from '../src/entities/Player.js';
import { ChaseBehavior } from '../src/entities/behaviors/ChaseBehavior.js';
import { Floor } from '../src/world/Floor.js';
import { Pathfinding } from '../src/world/Pathfinding.js';
import enemyDefs from '../data/enemies.json';

function fixture({ floorIndex = 0, seed = 3, playerDex = 2, enemyDex = 0 } = {}) {
  const bus = new EventBus();
  const events = [];
  for (const event of ['entity:attacked', 'entity:damaged', 'entity:healed',
    'player:revived', 'entity:died']) {
    bus.on(event, (payload) => events.push({ event, payload }));
  }
  const floor = new Floor(floorIndex, { index: floorIndex }, seed);
  for (const x of [3, 4]) {
    floor.setTile(x, 3, TILE.FLOOR);
    floor.tileAt(x, 3).visible = true;
  }
  const player = new Player(DEFAULT_BALANCE, { x: 3, y: 3 }, null, {
    heroOverrides: { dex: playerDex }
  });
  const enemy = new Enemy({ ...enemyDefs.goblin_scout,
    stats: { ...enemyDefs.goblin_scout.stats, dex: enemyDex }
  }, new ChaseBehavior(), { x: 4, y: 3 });
  floor.addEntity(player);
  floor.addEntity(enemy);
  const pathfinding = new Pathfinding();
  const combat = new CombatSystem({ bus, balance: DEFAULT_BALANCE,
    rng: new RNG(seed), pathfinding });
  return { bus, events, floor, player, enemy, combat, pathfinding };
}

afterEach(() => vi.restoreAllMocks());

describe('status damage death context', () => {
  it.each([
    ['poison', 0, 15], ['poison', 19, 15],
    ['poison', 20, 12], ['poison', 39, 12], ['poison', 40, 10],
    ['burn', 20, 12], ['burn', 40, 10], ['bleed', 40, 10]
  ])('%s on floor index %i revives to %i HP using the current floor', (status, floorIndex, hp) => {
    const { events, floor, player, combat } = fixture({ floorIndex });
    player.stats.hp = 1;
    player.reviveCharges = 1;
    StatusEffects.apply(player, { status, value: 2, duration: 1 });

    combat.tickEntity(player, { floor, player });

    expect(player.isDead).toBe(false);
    expect(player.stats.hp).toBe(hp);
    expect(player.reviveCharges).toBe(0);
    expect(player.statusEffects).toEqual([]);
    expect(events.filter(({ event }) => event === 'entity:died')).toEqual([]);
    expect(events.find(({ event }) => event === 'entity:healed').payload.amount).toBe(hp);
    combat.tickEntity(player, { floor, player });
    expect(player.stats.hp).toBe(hp);
    expect(events.filter(({ event }) => event === 'player:revived')).toHaveLength(1);
  });

  it.each([
    [{ floorIndex: 40 }, 10],
    [{ floor: { definition: { index: 0 } }, floorIndex: 40 }, 15]
  ])('preserves the existing floorIndex fallback and floor precedence (%j)', (ctx, hp) => {
    const { player, combat } = fixture();
    player.stats.hp = 1;
    player.reviveCharges = 1;
    StatusEffects.apply(player, { status: 'poison', value: 2, duration: 1 });

    combat.tickEntity(player, ctx);

    expect(player.stats.hp).toBe(hp);
    expect(player.reviveCharges).toBe(0);
    expect(player.isDead).toBe(false);
  });

  it('keeps legacy calls without context at the shallow revival percentage', () => {
    const { player, combat } = fixture();
    player.stats.hp = 1;
    player.reviveCharges = 1;
    StatusEffects.apply(player, { status: 'poison', value: 2, duration: 1 });

    combat.tickEntity(player);

    expect(player.stats.hp).toBe(15);
    expect(player.reviveCharges).toBe(0);
  });

  it('forwards the enemy turn floor context through real status death resolution', () => {
    const { events, floor, player, enemy, combat, pathfinding } = fixture({ floorIndex: 40 });
    enemy.stats.hp = 1;
    StatusEffects.apply(enemy, { status: 'freeze', duration: 1 });
    StatusEffects.apply(enemy, { status: 'poison', value: 2, duration: 1 });
    // Call-through spy observes the context contract without replacing damage/death logic.
    const death = vi.spyOn(combat, '_handleDeath');

    runEnemyTurns({ floor, player, combat, pathfinding });

    expect(player.stats.hp).toBe(30);
    expect(enemy.isDead).toBe(true);
    expect(events.filter(({ event }) => event === 'entity:died')).toHaveLength(1);
    const deathCtx = death.mock.calls[0]?.[2];
    expect(deathCtx?.floor?.definition?.index).toBe(40);
    expect(deathCtx?.floor === floor).toBe(true);
    expect(deathCtx?.player === player).toBe(true);
  });
});

describe('canonical slow in effective combat calculations', () => {
  it('reduces player hit, dodge and crit once, then restores them on expiry', () => {
    const { floor, player, enemy, combat } = fixture();
    expect(player.totalDex()).toBe(2);
    expect(combat._hitChance(player, enemy)).toBeCloseTo(0.958, 8);
    expect(combat._hitChance(enemy, player)).toBeCloseTo(0.934, 8);
    expect(combat._critChance(player)).toBeCloseTo(0.07, 8);
    StatusEffects.apply(player, { status: 'slow', value: 1, duration: 2 });

    for (let tick = 0; tick < 2; tick++) {
      expect(player.totalDex()).toBe(1);
      expect(combat._hitChance(player, enemy)).toBeCloseTo(0.954, 8);
      expect(combat._hitChance(enemy, player)).toBeCloseTo(0.942, 8);
      expect(combat._critChance(player)).toBeCloseTo(0.06, 8);
      expect(player.stats.dex).toBe(2);
      combat.tickEntity(player, { floor });
    }

    expect(player.totalDex()).toBe(2);
    expect(combat._hitChance(player, enemy)).toBeCloseTo(0.958, 8);
    expect(combat._hitChance(enemy, player)).toBeCloseTo(0.934, 8);
    expect(combat._critChance(player)).toBeCloseTo(0.07, 8);
    expect(player.statusEffects).toEqual([]);
  });

  it('clamps a heavily slowed player at zero DEX without negative dodge or crit contributions', () => {
    const { player, enemy, combat } = fixture();
    StatusEffects.apply(player, { status: 'slow', value: 9, duration: 2 });

    expect(player.totalDex()).toBe(0);
    expect(player.critChance()).toBeCloseTo(0.05, 8);
    expect(combat._hitChance(player, enemy)).toBeCloseTo(0.95, 8);
    expect(combat._hitChance(enemy, player)).toBeCloseTo(0.95, 8);
    expect(player.stats.dex).toBe(2);
  });

  it('preserves existing DEX and crit bonuses while applying the status modifier once', () => {
    const { player, combat } = fixture({ playerDex: 6 });
    player.setSynergyMods({ dex: 2, critBonus: 0.03 });
    player.critSkillBonus = 0.1;
    expect(player.totalDex()).toBe(8);
    expect(player.critChance()).toBeCloseTo(0.24, 8);
    StatusEffects.apply(player, { status: 'slow', value: 2, duration: 1 });

    expect(player.totalDex()).toBe(6);
    expect(combat._critChance(player)).toBeCloseTo(0.22, 8);
    combat.tickEntity(player);
    expect(player.totalDex()).toBe(8);
    expect(player.critChance()).toBeCloseTo(0.24, 8);
  });

  it.each([
    [false, false, 22], [true, true, 24]
  ])('a seeded player accuracy roll misses only while slowed=%s', (slowed, isMiss, hp) => {
    // Seed 492 rolls 0.9573: between the real 0.958 / 0.954 hit chances.
    const { events, floor, player, enemy, combat } = fixture({ seed: 492 });
    if (slowed) StatusEffects.apply(player, { status: 'slow', value: 1, duration: 2 });

    combat.execute({ type: 'attack', target: { x: 4, y: 3 } }, player, { floor, player });

    expect(events.find(({ event }) => event === 'entity:attacked').payload.isMiss).toBe(isMiss);
    expect(enemy.stats.hp).toBe(hp);
  });

  it.each([
    [false, true, 30], [true, false, 27]
  ])('a seeded enemy hit bypasses player dodge only while slowed=%s', (slowed, isMiss, hp) => {
    // Seed 186 rolls 0.9353: between the real 0.934 / 0.942 hit chances.
    const { events, floor, player, enemy, combat } = fixture({ seed: 186 });
    if (slowed) StatusEffects.apply(player, { status: 'slow', value: 1, duration: 2 });

    combat.execute({ type: 'attack', target: { x: 3, y: 3 } }, enemy, { floor, player });

    expect(events.find(({ event }) => event === 'entity:attacked').payload.isMiss).toBe(isMiss);
    expect(player.stats.hp).toBe(hp);
  });

  it.each([
    [false, true], [true, false]
  ])('a seeded player crit becomes a normal hit only while slowed=%s', (slowed, isCrit) => {
    // Seed 23 rolls a crit check of 0.0638: between 7% / 6%.
    const { events, floor, player, combat } = fixture({ seed: 23 });
    if (slowed) StatusEffects.apply(player, { status: 'slow', value: 1, duration: 2 });

    combat.execute({ type: 'attack', target: { x: 4, y: 3 } }, player, { floor, player });

    expect(events.find(({ event }) => event === 'entity:attacked').payload.isCrit).toBe(isCrit);
  });

  it('reduces enemy crit once through its DEX fallback and restores it on expiry', () => {
    const { floor, enemy, combat } = fixture({ enemyDex: 4 });
    expect(combat._critChance(enemy)).toBeCloseTo(0.09, 8);
    StatusEffects.apply(enemy, { status: 'slow', value: 2, duration: 2 });

    expect(combat._critChance(enemy)).toBeCloseTo(0.07, 8);
    combat.tickEntity(enemy, { floor });
    expect(combat._critChance(enemy)).toBeCloseTo(0.07, 8);
    combat.tickEntity(enemy, { floor });
    expect(combat._critChance(enemy)).toBeCloseTo(0.09, 8);
    expect(enemy.stats.dex).toBe(4);
  });

  it.each([
    [false, true], [true, false]
  ])('a seeded enemy crit becomes a normal hit only while slowed=%s', (slowed, isCrit) => {
    // Seed 25 rolls a crit check of 0.0771: between 9% / 7%.
    const { events, floor, player, enemy, combat } = fixture({ seed: 25, enemyDex: 4 });
    if (slowed) StatusEffects.apply(enemy, { status: 'slow', value: 2, duration: 2 });

    combat.execute({ type: 'attack', target: { x: 3, y: 3 } }, enemy, { floor, player });

    expect(events.find(({ event }) => event === 'entity:attacked').payload.isCrit).toBe(isCrit);
  });

  it('keeps a heavily slowed enemy at the base crit chance instead of negative DEX', () => {
    const { enemy, combat } = fixture({ enemyDex: 4 });
    StatusEffects.apply(enemy, { status: 'slow', value: 9, duration: 1 });

    expect(combat._critChance(enemy)).toBeCloseTo(0.05, 8);
    expect(enemy.stats.dex).toBe(4);
  });
});
