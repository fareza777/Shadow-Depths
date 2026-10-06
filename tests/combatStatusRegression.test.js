import { describe, it, expect } from 'vitest';
import { CombatSystem } from '../src/combat/CombatSystem.js';
import { SpellSystem } from '../src/combat/SpellSystem.js';
import { StatusEffects } from '../src/combat/StatusEffects.js';
import { DEFAULT_BALANCE } from '../src/config/balance.js';
import { TILE } from '../src/config/constants.js';
import { EventBus } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { runEnemyTurns } from '../src/core/EnemyTurnRunner.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Player } from '../src/entities/Player.js';
import { ChaseBehavior } from '../src/entities/behaviors/ChaseBehavior.js';
import { HeavyBehavior } from '../src/entities/behaviors/HeavyBehavior.js';
import { onHeroSpellHit } from '../src/gameplay/heroPassives.js';
import { ItemFactory } from '../src/items/ItemFactory.js';
import { Floor } from '../src/world/Floor.js';
import { Pathfinding } from '../src/world/Pathfinding.js';
import enemyDefs from '../data/enemies.json';
import itemDefs from '../data/items.json';

function makeCombat({ heroKind = 'vigil', enemyDef = enemyDefs.goblin_scout,
  behavior = new ChaseBehavior() } = {}) {
  const bus = new EventBus();
  const events = [];
  for (const event of ['entity:moved', 'entity:attacked', 'entity:damaged',
    'entity:status', 'entity:died', 'spell:cast']) {
    bus.on(event, (payload) => events.push({ event, payload }));
  }
  const floor = new Floor(0, { index: 0 }, 3);
  for (let y = 1; y <= 12; y++) {
    for (let x = 1; x <= 12; x++) {
      floor.setTile(x, y, TILE.FLOOR);
      floor.tileAt(x, y).visible = true;
    }
  }
  const player = new Player(DEFAULT_BALANCE, { x: 3, y: 3 }, null, { heroKind });
  const enemy = new Enemy(enemyDef, behavior, { x: 4, y: 3 });
  floor.addEntity(player);
  floor.addEntity(enemy);
  const pathfinding = new Pathfinding();
  // Seed 3 lands the real mace's 25% stun proc without forcing RNG results.
  const combat = new CombatSystem({ bus, balance: DEFAULT_BALANCE,
    rng: new RNG(3), pathfinding });
  const spells = new SpellSystem({ bus, combat, getPlayer: () => player,
    getFloor: () => floor, getFloorIndex: () => 0 });
  const enemyTurn = () => runEnemyTurns({ floor, player, combat, pathfinding });
  return { bus, events, floor, player, enemy, combat, spells, enemyTurn };
}

describe('enemy skipped turns', () => {
  it('a real spiked mace stun prevents the enemy reply, then expires', () => {
    const { floor, player, enemy, combat, enemyTurn } = makeCombat();
    player.equip(new ItemFactory(itemDefs).create('spiked_mace'));

    expect(combat.execute({ type: 'attack', target: { x: 4, y: 3 } },
      player, { floor, player })).toBe(true);
    expect(enemy.isDead).toBe(false);
    expect(enemy.stats.hp).toBeLessThan(24);
    expect(enemy.statusEffects).toContainEqual({ id: 'stun', value: 1, duration: 1 });

    enemyTurn();

    expect(player.stats.hp).toBe(30);
    expect(enemy.intent).toEqual({ type: 'wait' });
    expect(enemy.isStunned()).toBe(false);

    enemyTurn();
    expect(player.stats.hp).toBeLessThan(30);
  });

  it.each(['freeze', 'stun'])('%s skips exactly two enemy actions while poison ticks once per turn', (status) => {
    const { player, enemy, enemyTurn } = makeCombat();
    StatusEffects.apply(enemy, { status, value: 1, duration: 2 });
    StatusEffects.apply(enemy, { status: 'poison', value: 2, duration: 3 });

    enemyTurn();
    expect(player.stats.hp).toBe(30);
    expect(enemy.stats.hp).toBe(22);
    expect(enemy.statusEffects).toContainEqual({ id: status, value: 1, duration: 1 });
    expect(enemy.statusEffects).toContainEqual({ id: 'poison', value: 2, duration: 2 });

    enemyTurn();
    expect(player.stats.hp).toBe(30);
    expect(enemy.stats.hp).toBe(20);
    expect(enemy.isStunned()).toBe(false);

    enemyTurn();
    expect(player.stats.hp).toBeLessThan(30);
    expect(enemy.stats.hp).toBe(18);
    expect(enemy.statusEffects).toEqual([]);
  });

  it('freeze holds a chasing enemy in place until its skipped turn expires', () => {
    const { floor, enemy, enemyTurn } = makeCombat();
    floor.moveEntity(enemy, 6, 3);
    StatusEffects.apply(enemy, { status: 'freeze', duration: 1 });

    enemyTurn();
    expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 6, y: 3 });
    expect(enemy.isStunned()).toBe(false);

    enemyTurn();
    expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 5, y: 3 });
  });

  it('a frozen Heavy enemy does not advance its attack wind-up', () => {
    const { player, enemy, enemyTurn } = makeCombat({
      enemyDef: enemyDefs.stone_golem, behavior: new HeavyBehavior({ actEveryNTurns: 2 })
    });
    StatusEffects.apply(enemy, { status: 'freeze', duration: 1 });

    enemyTurn();
    expect(enemy.intent).toEqual({ type: 'wait' });
    expect(enemy.isStunned()).toBe(false);

    enemyTurn();
    expect(player.stats.hp).toBe(30);
    expect(enemy.intent).toEqual({ type: 'wait', meta: { winding: true } });

    enemyTurn();
    expect(player.stats.hp).toBeLessThan(30);
  });
});

describe('CombatSystem action guard', () => {
  it.each([
    ['player', 'freeze', 'move'], ['player', 'stun', 'move'],
    ['player', 'freeze', 'attack'], ['player', 'stun', 'attack'],
    ['player', 'freeze', 'ranged'], ['player', 'stun', 'ranged'],
    ['enemy', 'freeze', 'move'], ['enemy', 'stun', 'move'],
    ['enemy', 'freeze', 'attack'], ['enemy', 'stun', 'attack'],
    ['enemy', 'freeze', 'ranged'], ['enemy', 'stun', 'ranged']
  ])('%s with %s consumes a %s turn without acting or ticking statuses', (kind, status, type) => {
    const { floor, player, enemy, combat, events } = makeCombat();
    if (type === 'ranged') {
      floor.moveEntity(enemy, 6, 3);
      if (kind === 'player') player.equip(new ItemFactory(itemDefs).create('hunters_bow'));
    }
    const actor = kind === 'player' ? player : enemy;
    const target = kind === 'player' ? enemy : player;
    const start = { x: actor.x, y: actor.y };
    const targetHp = target.stats.hp;
    StatusEffects.apply(actor, { status, value: 1, duration: 2 });
    events.length = 0;
    const action = type === 'move'
      ? { type, to: { x: actor.x, y: actor.y + 1 } }
      : { type, target: { x: target.x, y: target.y } };

    expect(combat.execute(action, actor, { floor, player })).toBe(true);

    expect({ x: actor.x, y: actor.y }).toEqual(start);
    expect(floor.entityAt(start.x, start.y)).toBe(actor);
    expect(target.stats.hp).toBe(targetHp);
    expect(player.rangedFocus).toBe(3);
    expect(actor.statusEffects).toEqual([{ id: status, value: 1, duration: 2 }]);
    expect(events).toEqual([]);
  });

  it('a frozen player moves only after two caller-owned turn-end ticks', () => {
    const { floor, player, combat } = makeCombat();
    StatusEffects.apply(player, { status: 'freeze', value: 1, duration: 2 });
    StatusEffects.apply(player, { status: 'poison', value: 2, duration: 2 });
    const action = { type: 'move', to: { x: 3, y: 4 } };
    const ctx = { floor, player };

    expect(combat.execute(action, player, ctx)).toBe(true);
    expect(player.y).toBe(3);
    expect(player.stats.hp).toBe(30);
    combat.tickEntity(player);
    expect(player.stats.hp).toBe(28);
    expect(player.statusEffects).toContainEqual({ id: 'freeze', value: 1, duration: 1 });

    expect(combat.execute(action, player, ctx)).toBe(true);
    expect(player.y).toBe(3);
    combat.tickEntity(player);
    expect(player.stats.hp).toBe(26);
    expect(player.statusEffects).toEqual([]);

    expect(combat.execute(action, player, ctx)).toBe(true);
    expect(player.y).toBe(4);
  });
});

describe('real hero spell statuses', () => {
  it('Warden cleanses poison and applies a working slow to nearby living enemies', () => {
    const { bus, events, floor, player, enemy, combat, spells } = makeCombat({ heroKind: 'warden' });
    const farEnemy = new Enemy(enemyDefs.goblin_scout, new ChaseBehavior(), { x: 8, y: 3 });
    const deadEnemy = new Enemy(enemyDefs.goblin_scout, new ChaseBehavior(), { x: 3, y: 4 });
    deadEnemy.takeDamage(24);
    floor.addEntity(farEnemy);
    floor.addEntity(deadEnemy);
    StatusEffects.apply(player, { status: 'poison', value: 3, duration: 3 }, bus);

    expect(spells.cast('warden')).toBe(true);

    expect(player.statusEffects).toEqual([{ id: 'def_buff', value: 4, duration: 3 }]);
    expect(enemy.statusEffects).toEqual([{ id: 'slow', value: 2, duration: 2 }]);
    expect(enemy.modifierDex()).toBe(-2);
    expect(farEnemy.statusEffects).toEqual([]);
    expect(deadEnemy.statusEffects).toEqual([]);
    expect(events.find(({ event }) => event === 'spell:cast').payload.fx.slowed).toBe(1);
    expect(events.filter(({ event, payload }) => event === 'entity:status'
      && payload.entity === enemy && payload.status === 'slow')).toHaveLength(1);

    combat.tickEntity(enemy);
    expect(enemy.modifierDex()).toBe(-2);
    combat.tickEntity(enemy);
    expect(enemy.modifierDex()).toBe(0);
  });

  it('Echobinder damages and freezes surviving real enemies for two reply turns', () => {
    const { events, floor, player, enemy, spells, enemyTurn } = makeCombat({ heroKind: 'echobinder' });
    const secondEnemy = new Enemy(enemyDefs.goblin_scout, new ChaseBehavior(), { x: 5, y: 3 });
    floor.addEntity(secondEnemy);

    expect(spells.cast('echobinder')).toBe(true);

    for (const target of [enemy, secondEnemy]) {
      expect(target.isDead).toBe(false);
      expect(target.stats.hp).toBe(16);
      expect(target.statusEffects).toEqual([
        { id: 'slow', value: 2, duration: 2 }, { id: 'freeze', value: 1, duration: 2 }
      ]);
      expect(target.modifierDex()).toBe(-2);
      expect(target.isStunned()).toBe(true);
    }
    expect(player.statusEffects).toEqual([{ id: 'def_buff', value: 2, duration: 3 }]);
    expect(events.find(({ event }) => event === 'spell:cast').payload.fx.frozen).toBe(2);
    expect(events.filter(({ event, payload }) => event === 'entity:status'
      && payload.entity === enemy && payload.status === 'freeze')).toHaveLength(1);

    enemyTurn();
    expect(player.stats.hp).toBe(30);
    expect(enemy.isStunned()).toBe(true);
    expect({ x: secondEnemy.x, y: secondEnemy.y }).toEqual({ x: 5, y: 3 });
    enemyTurn();
    expect(player.stats.hp).toBe(30);
    expect(enemy.statusEffects).toEqual([]);
    enemyTurn();
    expect(player.stats.hp).toBeLessThan(30);
  });

  it('Echobinder spell-hit passive refreshes one canonical slow with an event per hit', () => {
    const { bus, events, player, enemy } = makeCombat({ heroKind: 'echobinder' });
    onHeroSpellHit(player, enemy, bus);
    onHeroSpellHit(player, enemy, bus);

    expect(enemy.statusEffects).toEqual([{ id: 'slow', value: 2, duration: 2 }]);
    expect(enemy.modifierDex()).toBe(-2);
    expect(events.filter(({ event, payload }) => event === 'entity:status'
      && payload.entity === enemy && payload.status === 'slow')).toHaveLength(2);
  });

  it.each([
    ['vigil', 'def_buff', 2, 3], ['reaver', 'atk_buff', 1, 2],
    ['bladedancer', 'atk_buff', 1, 2], ['warden', 'def_buff', 4, 3],
    ['echobinder', 'def_buff', 2, 3]
  ])('%s casts its self-buff through the canonical status event', (heroKind, id, value, duration) => {
    const { player, spells, events } = makeCombat({ heroKind });

    expect(spells.cast(heroKind)).toBe(true);

    expect(player.statusEffects).toEqual([{ id, value, duration }]);
    expect(events.filter(({ event, payload }) => event === 'entity:status'
      && payload.entity === player && payload.status === id)).toHaveLength(1);
  });
});
