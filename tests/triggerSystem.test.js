import { describe, it, expect } from 'vitest';
import { collectTriggers, fireTriggers, tickTriggerCooldowns } from '../src/combat/TriggerSystem.js';

function fakeRng(seq = []) {
  let i = 0;
  return {
    chance() { const v = seq[i++ % seq.length]; return v < 1; },
    next() { return seq[i++ % seq.length]; },
    pick(arr) { return arr[0]; }
  };
}

function fakePlayer(triggers, equippedExtra = []) {
  return {
    kind: 'player',
    stats: { hp: 10, hpMax: 10 },
    statusEffects: [],
    equippedPieces: () => [{ id: 'fake_weapon', triggers }, ...equippedExtra],
    heal(n) { this.stats.hp = Math.min(this.stats.hpMax, this.stats.hp + n); return n; }
  };
}

describe('TriggerSystem.collectTriggers', () => {
  it('finds triggers from equipped pieces', () => {
    const player = fakePlayer([
      { when: 'onCrit', do: { type: 'damage', value: 3 } },
      { when: 'onKill', do: { type: 'heal',   value: 2 } }
    ]);
    expect(collectTriggers(player, 'onCrit').length).toBe(1);
    expect(collectTriggers(player, 'onKill').length).toBe(1);
    expect(collectTriggers(player, 'onHit').length).toBe(0);
  });

  it('finds direct entity triggers (enemy proc list)', () => {
    const enemy = {
      triggers: [{ when: 'onHit', do: { type: 'heal', value: 1 } }]
    };
    expect(collectTriggers(enemy, 'onHit').length).toBe(1);
  });

  it('picks up player.setTriggers', () => {
    const player = fakePlayer([]);
    player.setTriggers = [{ when: 'onHit', do: { type: 'heal', value: 1 } }];
    expect(collectTriggers(player, 'onHit').length).toBe(1);
  });
});

describe('TriggerSystem.fireTriggers gating', () => {
  it('onHpBelow only fires when fraction crosses threshold', () => {
    let fired = 0;
    const player = fakePlayer([{
      when: 'onHpBelow', pct: 0.5,
      do: { type: 'heal', value: 2, target: 'self' }
    }]);
    // Cross from 0.6 → 0.4 = should fire
    let n = fireTriggers('onHpBelow', {
      actor: player, target: player,
      hpPctBefore: 0.6, hpPctAfter: 0.4,
      bus: { emit() {} }
    });
    fired += n;
    expect(fired).toBe(1);
    // From 0.4 → 0.3 (already below) = should NOT fire
    fired += fireTriggers('onHpBelow', {
      actor: player, target: player,
      hpPctBefore: 0.4, hpPctAfter: 0.3,
      bus: { emit() {} }
    });
    expect(fired).toBe(1);
  });

  it('chance gate respects rng roll', () => {
    const player = fakePlayer([{
      when: 'onHit', chance: 0.5,
      do: { type: 'heal', value: 1, target: 'self' }
    }]);
    // chance() reads next() < p — give 0.7 first (fail) then 0.1 (pass)
    let i = 0;
    const rng = { chance: (p) => [0.7, 0.1][i++] < p };
    const bus = { emit() {} };
    const a = fireTriggers('onHit', { actor: player, target: player, rng, bus });
    const b = fireTriggers('onHit', { actor: player, target: player, rng, bus });
    expect(a + b).toBe(1);
  });

  it('respects trigger cooldowns across turns', () => {
    const player = fakePlayer([{
      id: 'pulse',
      when: 'onHit',
      cooldown: 2,
      do: { type: 'heal', value: 1, target: 'self' }
    }]);
    const bus = { emit() {} };
    expect(fireTriggers('onHit', { actor: player, target: player, bus })).toBe(1);
    expect(fireTriggers('onHit', { actor: player, target: player, bus })).toBe(0);
    tickTriggerCooldowns(player);
    expect(fireTriggers('onHit', { actor: player, target: player, bus })).toBe(0);
    tickTriggerCooldowns(player);
    expect(fireTriggers('onHit', { actor: player, target: player, bus })).toBe(1);
  });
});
