import { describe, it, expect } from 'vitest';
import {
  mergeBalance, enemyCombatScale, DEFAULT_BALANCE,
  difficultyScaleForFloor, enemyCountForFloor
} from '../src/config/balance.js';
import balanceJson from '../data/balance.json';

describe('mergeBalance', () => {
  it('includes enemyScaling from balance.json', () => {
    const balance = mergeBalance(balanceJson);
    expect(balance.enemyScaling).toBeDefined();
    expect(balance.enemyScaling.hp).toBe(1.05);
    expect(balance.enemyScaling.atk).toBe(1.05);
  });

  it('falls back to default enemyScaling when JSON omits it', () => {
    const { enemyScaling: _s, ...rest } = balanceJson;
    const balance = mergeBalance(rest);
    expect(balance.enemyScaling.hp).toBe(1.05);
    expect(balance.enemyScaling.atk).toBe(1.05);
  });

  it('returns defaults when overrides are null', () => {
    const balance = mergeBalance(null);
    expect(balance).toBe(DEFAULT_BALANCE);
    expect(balance.enemyScaling.hp).toBe(1.05);
  });
});

describe('enemyCombatScale', () => {
  const balance = mergeBalance(balanceJson);

  it('reads global enemy multipliers', () => {
    expect(enemyCombatScale(balance)).toEqual({ hp: 1.05, atk: 1.05 });
  });

  it('falls back to 1 when scaling missing', () => {
    expect(enemyCombatScale({})).toEqual({ hp: 1, atk: 1 });
  });
});

describe('difficulty curve', () => {
  const curve = mergeBalance(balanceJson).difficultyCurve;

  it('keeps floor 1 welcoming and ramps early floors gently', () => {
    expect(difficultyScaleForFloor(0, curve)).toBeGreaterThanOrEqual(0.95);
    expect(difficultyScaleForFloor(0, curve)).toBeLessThan(1);
    expect(difficultyScaleForFloor(1, curve)).toBeGreaterThan(difficultyScaleForFloor(0, curve));
    expect(difficultyScaleForFloor(2, curve)).toBeGreaterThanOrEqual(1);
  });

  it('gets meaningfully harder through mid and late run', () => {
    expect(difficultyScaleForFloor(9, curve)).toBeGreaterThan(1.2);
    expect(difficultyScaleForFloor(29, curve)).toBeGreaterThan(2);
    expect(difficultyScaleForFloor(59, curve)).toBeGreaterThan(3.3);
    expect(difficultyScaleForFloor(99, curve)).toBeGreaterThan(5);
  });

  it('increases enemy count without flooding the opening floors', () => {
    expect(enemyCountForFloor(0, curve)).toBe(3);
    expect(enemyCountForFloor(1, curve)).toBeGreaterThanOrEqual(3);
    expect(enemyCountForFloor(9, curve)).toBeGreaterThan(enemyCountForFloor(1, curve));
    expect(enemyCountForFloor(99, curve)).toBeLessThanOrEqual(curve.enemyCountMax);
  });
});
