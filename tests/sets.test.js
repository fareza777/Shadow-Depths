import { describe, it, expect } from 'vitest';
import { loadSetDefs, computeSetBonuses, applySetBonuses } from '../src/items/Sets.js';

loadSetDefs({
  sets: [
    {
      id: 'iron_set', name: 'Iron Set',
      pieces: ['iron_helm', 'iron_armor', 'iron_legs'],
      bonuses: [
        { count: 2, statMods: { def: 1 } },
        { count: 3, statMods: { def: 2, hpMax: 5 },
          triggers: [{ when: 'onHit', do: { type: 'heal', value: 1 } }] }
      ]
    }
  ]
});

function fakePlayer(pieces) {
  return {
    stats: { atk: 4, def: 2, dex: 1, hpMax: 20, hp: 20 },
    equippedPieces: () => pieces.map((id) => ({ id }))
  };
}

describe('computeSetBonuses', () => {
  it('returns empty when fewer than 2 pieces', () => {
    const p = fakePlayer(['iron_helm']);
    const r = computeSetBonuses(p);
    expect(r.statMods).toEqual({});
    expect(r.active.length).toBe(0);
  });

  it('applies 2-piece bonus at 2 pieces', () => {
    const p = fakePlayer(['iron_helm', 'iron_armor']);
    const r = computeSetBonuses(p);
    expect(r.statMods.def).toBe(1);
    expect(r.triggers.length).toBe(0);
  });

  it('stacks 2 + 3 piece bonuses at 3 pieces', () => {
    const p = fakePlayer(['iron_helm', 'iron_armor', 'iron_legs']);
    const r = computeSetBonuses(p);
    expect(r.statMods.def).toBe(3);       // 1 + 2
    expect(r.statMods.hpMax).toBe(5);
    expect(r.triggers.length).toBe(1);
  });
});

describe('applySetBonuses', () => {
  it('writes stat bumps to player.stats', () => {
    const p = fakePlayer(['iron_helm', 'iron_armor', 'iron_legs']);
    applySetBonuses(p);
    expect(p.stats.def).toBe(2 + 3);
    expect(p.stats.hpMax).toBe(20 + 5);
    expect(p.setTriggers.length).toBe(1);
  });

  it('rolls back the previous delta on re-apply (idempotent)', () => {
    const p = fakePlayer(['iron_helm', 'iron_armor', 'iron_legs']);
    applySetBonuses(p);
    applySetBonuses(p);  // second call
    expect(p.stats.def).toBe(2 + 3);     // not 2 + 6
    expect(p.stats.hpMax).toBe(20 + 5);  // not 20 + 10
  });

  it('removes the bonus when set falls below threshold', () => {
    const p = fakePlayer(['iron_helm', 'iron_armor', 'iron_legs']);
    applySetBonuses(p);
    p.equippedPieces = () => [{ id: 'iron_helm' }];   // drop to 1 piece
    applySetBonuses(p);
    expect(p.stats.def).toBe(2);          // back to base
    expect(p.stats.hpMax).toBe(20);
    expect(p.setTriggers.length).toBe(0);
  });
});
