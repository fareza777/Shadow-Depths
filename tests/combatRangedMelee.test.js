import { describe, it, expect, vi } from 'vitest';
import { CombatSystem } from '../src/combat/CombatSystem.js';
import { DEFAULT_BALANCE } from '../src/config/balance.js';

function mockPlayer({ atk = 10, range = 4 } = {}) {
  return {
    kind: 'player',
    x: 0, y: 0,
    facing: { x: 0, y: 1 },
    stats: { atk, def: 0, dex: 0, hp: 20, hpMax: 20 },
    weapon: { stats: { atk: 0, attackRange: range } },
    totalAtk: () => atk,
    totalDef: () => 0,
    totalDex: () => 0,
    critChance: () => 0,
    effectiveRange: () => range,
    modifierAtk: () => 0,
    modifierDef: () => 0,
    equippedPieces: () => [],
    takeDamage(n) { this.stats.hp -= n; return n; }
  };
}

function mockEnemy(def = 0) {
  return {
    kind: 'enemy',
    x: 1, y: 0,
    facing: { x: -1, y: 0 },
    stats: { atk: 3, def, hp: 30, hpMax: 30 },
    modifierAtk: () => 0,
    modifierDef: () => 0,
    takeDamage(n) { this.stats.hp -= n; return n; }
  };
}

describe('ranged weapon adjacent melee', () => {
  it('applies rangedWeaponMeleeMult for bow users', () => {
    const bus = { emit: vi.fn() };
    const rng = {
      chance: () => true,
      randInt: () => 0,
      fork: () => rng
    };
    const combat = new CombatSystem({ bus, balance: DEFAULT_BALANCE, rng, pathfinding: null });
    const player = mockPlayer({ atk: 10, range: 4 });
    const enemy = mockEnemy(0);
    const floor = {
      entityAt: () => enemy,
      definition: { index: 0 }
    };
    combat.execute({ type: 'attack', target: { x: 1, y: 0 } }, player, { floor, player });
    const hit = bus.emit.mock.calls.find((c) => c[0] === 'entity:attacked' && !c[1].isMiss);
    expect(hit).toBeTruthy();
    expect(hit[1].isRangedWeaponMelee).toBe(true);
    expect(hit[1].damage).toBeLessThan(10);
    expect(hit[1].damage).toBeGreaterThanOrEqual(1);
  });

  it('does not flag sword melee', () => {
    const bus = { emit: vi.fn() };
    const rng = {
      chance: () => true,
      randInt: () => 0,
      fork: () => rng
    };
    const combat = new CombatSystem({ bus, balance: DEFAULT_BALANCE, rng, pathfinding: null });
    const player = mockPlayer({ atk: 10, range: 1 });
    const enemy = mockEnemy(0);
    const floor = { entityAt: () => enemy, definition: { index: 0 } };
    combat.execute({ type: 'attack', target: { x: 1, y: 0 } }, player, { floor, player });
    const hit = bus.emit.mock.calls.find((c) => c[0] === 'entity:attacked' && !c[1].isMiss);
    expect(hit[1].isRangedWeaponMelee).toBeFalsy();
    expect(hit[1].damage).toBeGreaterThanOrEqual(10);
  });
});
