import { describe, it, expect } from 'vitest';
import { SpellSystem } from '../src/combat/SpellSystem.js';

function fakeBus() {
  const emits = [];
  return {
    emits,
    emit(event, payload) { emits.push({ event, payload }); }
  };
}

function fakeEnemy(x = 1, y = 0) {
  return {
    kind: 'enemy',
    x, y,
    renderX: x,
    renderY: y,
    isDead: false,
    stats: { hp: 20, hpMax: 20 },
    statusEffects: [],
    takeDamage(n) {
      const dealt = Math.min(this.stats.hp, n);
      this.stats.hp -= dealt;
      this.isDead = this.stats.hp <= 0;
      return dealt;
    },
    applyStatus(spec) {
      this.statusEffects.push({ id: spec.status, value: spec.value, duration: spec.duration });
      return true;
    }
  };
}

function makeHarness(heroKind) {
  const bus = fakeBus();
  const enemy = fakeEnemy();
  const player = {
    kind: 'player',
    heroKind,
    x: 0,
    y: 0,
    renderX: 0,
    renderY: 0,
    level: 10,
    magicPower: 2,
    spellCooldown: 0,
    spellCooldownReduction: 0,
    spellLifesteal: 0,
    stats: { hp: 20, hpMax: 30, atk: 8, def: 2, dex: 2 },
    statusEffects: [],
    heal(n) {
      const before = this.stats.hp;
      this.stats.hp = Math.min(this.stats.hpMax, this.stats.hp + n);
      return this.stats.hp - before;
    },
    totalAtk() { return this.stats.atk; },
    applyStatus(spec) {
      this.statusEffects.push({ id: spec.id || spec.status, value: spec.value, duration: spec.duration });
      return true;
    }
  };
  const floor = {
    enemies: () => [enemy],
    tileAt() { return { visible: true, explored: false }; }
  };
  const combat = { _handleDeath() {} };
  const spells = new SpellSystem({
    bus,
    combat,
    getPlayer: () => player,
    getFloor: () => floor,
    getFloorIndex: () => 0
  });
  return { bus, enemy, player, spells };
}

describe('SpellSystem', () => {
  it('casts the new Warden spell as a defensive slow aura', () => {
    const { bus, enemy, player, spells } = makeHarness('warden');
    expect(spells.getState('warden').ready).toBe(true);
    expect(spells.cast('warden')).toBe(true);
    expect(player.statusEffects.some((s) => s.id === 'def_buff')).toBe(true);
    expect(enemy.statusEffects.some((s) => s.id === 'slow')).toBe(true);
    expect(bus.emits.some((e) => e.event === 'spell:cast')).toBe(true);
  });

  it('casts Bladedancer as a three-hit close spell', () => {
    const { enemy, spells } = makeHarness('bladedancer');
    expect(spells.getState('bladedancer').ready).toBe(true);
    expect(spells.cast('bladedancer')).toBe(true);
    expect(enemy.stats.hp).toBeLessThan(20);
  });

  it('casts Echobinder with damage and freeze', () => {
    const { enemy, spells } = makeHarness('echobinder');
    expect(spells.getState('echobinder').ready).toBe(true);
    expect(spells.cast('echobinder')).toBe(true);
    expect(enemy.statusEffects.some((s) => s.id === 'freeze')).toBe(true);
  });

  it('blocks Vigil heal when no enemies are nearby', () => {
    const bus = fakeBus();
    const player = {
      kind: 'player',
      heroKind: 'vigil',
      x: 0, y: 0, level: 10, magicPower: 0,
      spellCooldown: 0,
      stats: { hp: 10, hpMax: 30, atk: 4, def: 2, dex: 2 },
      statusEffects: [],
      heal(n) {
        const before = this.stats.hp;
        this.stats.hp = Math.min(this.stats.hpMax, this.stats.hp + n);
        return this.stats.hp - before;
      },
      applyStatus() { return true; }
    };
    const floor = { enemies: () => [], tileAt: () => ({ visible: true }) };
    const spells = new SpellSystem({
      bus, combat: { _handleDeath() {} },
      getPlayer: () => player,
      getFloor: () => floor,
      getFloorIndex: () => 0
    });
    expect(spells.getState('vigil').ready).toBe(false);
    expect(spells.cast('vigil')).toBe(false);
    expect(bus.emits.some((e) => e.event === 'spell:blocked')).toBe(true);
  });
}
);
