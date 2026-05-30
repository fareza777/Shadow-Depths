import { describe, it, expect } from 'vitest';
import { mergeBalance, resolveDifficulty, DEFAULT_BALANCE } from '../src/config/balance.js';
import balanceJson from '../data/balance.json';

describe('mergeBalance', () => {
  it('includes difficulty from balance.json', () => {
    const balance = mergeBalance(balanceJson);
    expect(balance.difficulty).toBeDefined();
    expect(balance.difficulty.normal.enemyHp).toBe(1.35);
    expect(balance.difficulty.normal.enemyAtk).toBe(1.28);
    expect(balance.difficulty.hard.enemyHp).toBe(1.52);
    expect(balance.difficulty.ascend2.lootTier).toBe(3);
  });

  it('falls back to default difficulty when JSON omits it', () => {
    const { difficulty: _d, ...rest } = balanceJson;
    const balance = mergeBalance(rest);
    expect(balance.difficulty.normal.enemyHp).toBe(1);
    expect(balance.difficulty.easy.enemyAtk).toBe(0.85);
  });

  it('returns defaults when overrides are null', () => {
    const balance = mergeBalance(null);
    expect(balance).toBe(DEFAULT_BALANCE);
    expect(balance.difficulty.normal.label).toBe('Vigil');
  });
});

describe('resolveDifficulty', () => {
  const balance = mergeBalance(balanceJson);

  it('maps easy/normal/hard combat multipliers', () => {
    expect(resolveDifficulty(balance, 'easy')).toMatchObject({ hp: 0.8, atk: 0.85 });
    expect(resolveDifficulty(balance, 'normal')).toMatchObject({ hp: 1.35, atk: 1.28 });
    expect(resolveDifficulty(balance, 'hard')).toMatchObject({ hp: 1.52, atk: 1.38, lootTier: 1 });
  });

  it('falls back to normal for unknown keys', () => {
    expect(resolveDifficulty(balance, 'not_a_mode').hp).toBe(1.35);
  });
});
