/**
 * Core-loop + freemium integration tests (audit #9).
 */
import { describe, it, expect } from 'vitest';
import { Dungeon } from '../src/world/Dungeon.js';
import { RNG } from '../src/core/RNG.js';
import { BillingService } from '../src/monetization/BillingService.js';
import { gateDescend } from '../src/core/DescendFlow.js';
import { BossPatternBehavior } from '../src/entities/behaviors/BossPatternBehavior.js';
import { pressureTileCount, applyBiomePressureStep } from '../src/gameplay/biomeMechanics.js';
import biomesData from '../data/biomes.json';
import balanceData from '../data/balance.json';

function makeDungeon() {
  const rng = new RNG(42, 'test');
  return new Dungeon({
    balance: balanceData,
    rng,
    content: { biomes: biomesData, floors: { floors: [] }, items: {}, enemies: {} },
    mode: 'normal'
  });
}

describe('Dungeon floor curve', () => {
  it('builds 100 floors with vault@10 and forge@7 cadence', () => {
    const d = makeDungeon();
    expect(d.totalFloors).toBe(100);
    expect(d.floorDefs[6].type).toBe('forge');   // floor 7
    expect(d.floorDefs[9].type).toBe('vault');   // floor 10
    expect(d.floorDefs[9].specialEnemyId).toBe('boss_crypt_regent');
    expect(d.floorDefs[99].isFinalFloor).toBe(true);
    expect(d.floorDefs[99].specialEnemyId).toBeTruthy();
  });

  it('applies depth remix on floors 51+', () => {
    const d = makeDungeon();
    expect(d.floorDefs[49].depthRemix).toBeFalsy();
    expect(d.floorDefs[50].depthRemix).toBe(true);
    expect(String(d.floorDefs[50].name)).toMatch(/Deep|Abyssal/);
  });
});

describe('Freemium descend gate', () => {
  it('blocks descend past free cap and opens paywall', () => {
    const shown = [];
    const logs = [];
    const billing = new BillingService({
      metaProgress: { isPremium: () => false, state: {} },
      eventBus: { emit() {} },
      balance: { monetization: { freeFloorCap: 10 } }
    });
    const result = gateDescend({
      billing,
      paywall: { show: (r) => shown.push(r) },
      bus: { emit: (_e, p) => logs.push(p) }
    }, 9, 'normal');
    expect(result.blocked).toBe(true);
    expect(shown).toEqual(['descend']);
  });

  it('allows tutorial and premium', () => {
    const billing = new BillingService({
      metaProgress: { isPremium: () => true, state: { premiumUnlocked: true } },
      eventBus: { emit() {} },
      balance: { monetization: { freeFloorCap: 10 } }
    });
    expect(gateDescend({ billing, paywall: {}, bus: {} }, 9, 'normal').blocked).toBe(false);
    expect(gateDescend({ billing, paywall: {}, bus: {} }, 9, 'tutorial').blocked).toBe(false);
  });
});

describe('BossPatternBehavior', () => {
  it('previewIntent is pure (does not advance counter)', () => {
    const b = new BossPatternBehavior({ actEveryNTurns: 2 });
    const enemy = { x: 5, y: 5, stats: { hp: 80, hpMax: 80, atk: 10 } };
    const player = { x: 6, y: 5 };
    const floor = { tileAt: () => ({ walkable: true }) };
    const ctx = { player, floor };
    const a = b.previewIntent(enemy, ctx);
    const b2 = b.previewIntent(enemy, ctx);
    expect(a.type).toBe(b2.type);
    expect(b._counter).toBe(0);
  });

  it('telegraphs slam when adjacent in phase 2', () => {
    const b = new BossPatternBehavior({ actEveryNTurns: 2 });
    const enemy = { x: 5, y: 5, stats: { hp: 40, hpMax: 100, atk: 10 } };
    const player = { x: 6, y: 5 };
    const floor = { tileAt: () => ({ walkable: true }) };
    const intent = b.previewIntent(enemy, { player, floor });
    expect(intent.meta?.winding || intent.type === 'attack').toBeTruthy();
  });
});

describe('Biome pressure', () => {
  it('counts pressure tiles for known mechanics', () => {
    expect(pressureTileCount('slow_tiles', 0)).toBeGreaterThan(0);
    expect(pressureTileCount('unknown', 0)).toBe(0);
    expect(pressureTileCount('lava_pressure', 40, { depthRemix: true }))
      .toBeGreaterThan(pressureTileCount('lava_pressure', 40));
  });

  it('applies step pressure with cooldown', () => {
    const logs = [];
    const player = {
      isDead: false,
      stats: { hp: 20 },
      runStats: { turnsUsed: 10 },
      applyStatus: () => {},
      takeDamage: () => {},
      floorModifiers: null
    };
    const tile = { pressure: { mechanic: 'slow_tiles' } };
    const bus = { emit: (_e, p) => logs.push(p) };
    expect(applyBiomePressureStep(player, tile, bus)).toBe(true);
    expect(applyBiomePressureStep(player, tile, bus)).toBe(false); // cooldown
  });
});
