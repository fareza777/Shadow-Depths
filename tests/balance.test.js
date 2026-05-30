import { describe, it, expect } from 'vitest';
import { mergeBalance, enemyCombatScale, DEFAULT_BALANCE } from '../src/config/balance.js';
import balanceJson from '../data/balance.json';

describe('mergeBalance', () => {
  it('includes enemyScaling from balance.json', () => {
    const balance = mergeBalance(balanceJson);
    expect(balance.enemyScaling).toBeDefined();
    expect(balance.enemyScaling.hp).toBe(1.35);
    expect(balance.enemyScaling.atk).toBe(1.28);
  });

  it('falls back to default enemyScaling when JSON omits it', () => {
    const { enemyScaling: _s, ...rest } = balanceJson;
    const balance = mergeBalance(rest);
    expect(balance.enemyScaling.hp).toBe(1);
    expect(balance.enemyScaling.atk).toBe(1);
  });

  it('returns defaults when overrides are null', () => {
    const balance = mergeBalance(null);
    expect(balance).toBe(DEFAULT_BALANCE);
    expect(balance.enemyScaling.hp).toBe(1);
  });
});

describe('enemyCombatScale', () => {
  const balance = mergeBalance(balanceJson);

  it('reads global enemy multipliers', () => {
    expect(enemyCombatScale(balance)).toEqual({ hp: 1.35, atk: 1.28 });
  });

  it('falls back to 1 when scaling missing', () => {
    expect(enemyCombatScale({})).toEqual({ hp: 1, atk: 1 });
  });
});
