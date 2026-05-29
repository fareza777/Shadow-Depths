import { HERO_SPELLS } from '../config/heroSpells.js';
import { hollowSiphonHeal, SPELL_TUNING } from '../config/spellBalance.js';
import { hasLineOfSight } from '../entities/behaviors/RangedBehavior.js';
import { onHeroSpellHit } from '../gameplay/heroPassives.js';

const TARGETED_SPELLS = new Set(['hollow', 'inquisitor', 'bladedancer', 'echobinder']);
/** Heals / self-buffs only fire when a living foe is nearby (no safe-room spam). */
const COMBAT_ONLY_SPELLS = new Set(['vigil', 'pilgrim', 'warden']);
const COMBAT_RANGE = 9;

export class SpellSystem {
  constructor({ bus, combat, getPlayer, getFloor, getFloorIndex }) {
    this.bus = bus;
    this.combat = combat;
    this.getPlayer = getPlayer;
    this.getFloor = getFloor;
    this.getFloorIndex = getFloorIndex;
  }

  getState(heroKind) {
    const player = this.getPlayer();
    const def = HERO_SPELLS[player?.heroKind || heroKind];
    if (!def || !player) return { ready: false, name: '', cooldown: 0 };
    const kind = player.heroKind || heroKind;
    const cooldown = Math.max(0, player.spellCooldown || 0);
    const needsTarget = TARGETED_SPELLS.has(kind);
    const needsCombat = COMBAT_ONLY_SPELLS.has(kind);
    const target = needsTarget ? this._targetFor(kind, def) : null;
    const inCombat = this._inCombat();
    return {
      ...def,
      baseCooldown: def.cooldown,
      cooldown,
      inCombat,
      ready: cooldown <= 0
        && (!needsTarget || !!target)
        && (!needsCombat || inCombat),
      target
    };
  }

  cast(heroKind) {
    const player = this.getPlayer();
    if (!player) return false;
    const state = this.getState(heroKind);
    if (!state.ready) {
      const kind = player.heroKind || heroKind;
      if (COMBAT_ONLY_SPELLS.has(kind) && !state.inCombat && (player.spellCooldown || 0) <= 0) {
        this.bus.emit('spell:blocked', { reason: 'no_combat', spell: state.name });
      }
      return false;
    }

    const kind = player.heroKind || heroKind;
    const power = player.magicPower || 0;
    let used = false;
    let fx = { kind, name: state.name, color: state.color };

    if (kind === 'vigil') {
      const missing = player.stats.hpMax - player.stats.hp;
      const healAmt = Math.min(
        missing,
        2 + Math.floor(player.level / 6) + Math.floor(power / 2)
      );
      const healed = healAmt > 0 ? player.heal(healAmt) : 0;
      if (healed > 0) this.bus.emit('entity:healed', { entity: player, amount: healed, source: 'spell' });
      player.applyStatus({ id: 'def_buff', value: 2 + Math.floor(power / 4), duration: 3 });
      fx = { ...fx, center: { x: player.x, y: player.y }, radius: 1.4 };
      used = true;
    } else if (kind === 'hollow') {
      const target = state.target;
      const tun = SPELL_TUNING.hollow;
      const dealt = this._dealSpellDamage(
        target, tun.damage(player.level, power), state.name
      );
      const healed = player.heal(hollowSiphonHeal(dealt, player, tun));
      if (healed > 0) this.bus.emit('entity:healed', { entity: player, amount: healed, source: 'spell' });
      fx = { ...fx, target: { x: target.x, y: target.y } };
      used = dealt > 0;
    } else if (kind === 'inquisitor') {
      const target = state.target;
      const burst = SPELL_TUNING.inquisitor.burst(player.level, power);
      used = this._damageEnemiesInRadius(
        target.x, target.y, state.radius || 1, burst, state.name
      ) > 0;
      fx = { ...fx, center: { x: target.x, y: target.y }, radius: state.radius || 1 };
    } else if (kind === 'reaver') {
      used = this._damageEnemiesInRadius(
        player.x, player.y, state.radius || 2,
        SPELL_TUNING.reaver.aoe(player.totalAtk()) + Math.floor(power / 2),
        state.name
      ) > 0;
      if (used) player.applyStatus({ id: 'atk_buff', value: 1, duration: 2 });
      fx = { ...fx, center: { x: player.x, y: player.y }, radius: state.radius || 2 };
    } else if (kind === 'pilgrim') {
      const radius = (state.radius || 3) + Math.floor(power / 3);
      const missing = player.stats.hpMax - player.stats.hp;
      const healAmt = Math.min(missing, 3 + Math.floor(player.level / 6) + Math.floor(power / 2));
      const healed = healAmt > 0 ? player.heal(healAmt) : 0;
      if (healed > 0) this.bus.emit('entity:healed', { entity: player, amount: healed, source: 'spell' });
      this._revealAround(player.x, player.y, radius);
      fx = { ...fx, center: { x: player.x, y: player.y }, radius };
      used = true;
    } else if (kind === 'warden') {
      player.applyStatus({ id: 'def_buff', value: 4 + Math.floor(power / 3), duration: 3 });
      const slowed = this._statusEnemiesInRadius(player.x, player.y, 2, {
        status: 'slow', value: 2, duration: 2
      });
      fx = { ...fx, center: { x: player.x, y: player.y }, radius: 2, slowed };
      used = true;
    } else if (kind === 'bladedancer') {
      const target = state.target;
      const { strikes, hitRatio } = SPELL_TUNING.bladedancer;
      let total = 0;
      for (let i = 0; i < strikes && target && !target.isDead; i++) {
        total += this._dealSpellDamage(
          target,
          Math.max(2, Math.ceil(player.totalAtk() * hitRatio) + Math.floor(power / 3)),
          state.name
        );
      }
      if (total > 0) player.applyStatus({ id: 'atk_buff', value: 1, duration: 2 });
      fx = { ...fx, target: { x: target.x, y: target.y }, strikes };
      used = total > 0;
    } else if (kind === 'echobinder') {
      const target = state.target;
      const radius = state.radius || 1;
      const total = this._damageEnemiesInRadius(
        target.x, target.y, radius,
        SPELL_TUNING.echobinder.burst(player.level, power),
        state.name
      );
      const frozen = this._statusEnemiesInRadius(target.x, target.y, radius, {
        status: 'freeze', value: 1, duration: 1
      });
      fx = { ...fx, center: { x: target.x, y: target.y }, radius, frozen };
      used = total > 0 || frozen > 0;
    }

    if (!used) return false;
    const cd = Math.max(3, state.baseCooldown - (player.spellCooldownReduction || 0));
    player.spellCooldown = cd + 1;
    this.bus.emit('spell:cast', { entity: player, spell: state.name, fx });
    return true;
  }

  _targetFor(kind, def) {
    const player = this.getPlayer();
    if (!player) return null;
    if (kind === 'reaver') return this._nearestVisibleEnemy(def.radius || 2, false);
    return this._nearestVisibleEnemy(def.range || 6, kind === 'hollow');
  }

  /** True if any living enemy is on this floor within manhattan range. */
  _inCombat(range = COMBAT_RANGE) {
    const floor = this.getFloor();
    const player = this.getPlayer();
    if (!floor || !player) return false;
    for (const e of floor.enemies()) {
      if (e.isDead) continue;
      const dist = Math.abs(e.x - player.x) + Math.abs(e.y - player.y);
      if (dist <= range) return true;
    }
    return false;
  }

  _nearestVisibleEnemy(range, requireLineOfSight = false) {
    const floor = this.getFloor();
    const player = this.getPlayer();
    if (!floor || !player) return null;
    let best = null;
    let bestDist = Infinity;
    for (const e of floor.enemies()) {
      if (e.isDead) continue;
      const tile = floor.tileAt(e.x, e.y);
      if (!tile || !tile.visible) continue;
      const dist = Math.abs(e.x - player.x) + Math.abs(e.y - player.y);
      if (dist > range || dist >= bestDist) continue;
      if (requireLineOfSight && !hasLineOfSight(floor, player, e)) continue;
      best = e;
      bestDist = dist;
    }
    return best;
  }

  _damageEnemiesInRadius(cx, cy, radius, amount, spellName) {
    const floor = this.getFloor();
    const player = this.getPlayer();
    if (!floor || !player) return 0;
    let total = 0;
    for (const e of [...floor.enemies()]) {
      if (e.isDead) continue;
      const dist = Math.abs(e.x - cx) + Math.abs(e.y - cy);
      if (dist > radius) continue;
      total += this._dealSpellDamage(e, amount, spellName);
    }
    if (total > 0 && player.spellLifesteal > 0) {
      const healed = player.heal(Math.ceil(total * player.spellLifesteal));
      if (healed > 0) this.bus.emit('entity:healed', { entity: player, amount: healed, source: 'spell' });
    }
    return total;
  }

  _statusEnemiesInRadius(cx, cy, radius, spec) {
    const floor = this.getFloor();
    if (!floor) return 0;
    let count = 0;
    for (const e of floor.enemies()) {
      if (e.isDead) continue;
      const dist = Math.abs(e.x - cx) + Math.abs(e.y - cy);
      if (dist > radius) continue;
      if (e.applyStatus(spec)) {
        this.bus.emit('entity:status', { entity: e, status: spec.status });
        count++;
      }
    }
    return count;
  }

  _dealSpellDamage(target, amount, spellName) {
    const player = this.getPlayer();
    const floor = this.getFloor();
    if (!player || !target) return 0;
    const dealt = target.takeDamage(amount);
    this.bus.emit('entity:attacked', {
      attacker: player, target, damage: dealt,
      isCrit: false, isMiss: false, kind: 'magic'
    });
    this.bus.emit('entity:damaged', { entity: target, amount: dealt, source: spellName, isCrit: false });
    if (dealt > 0) onHeroSpellHit(player, target, this.bus);
    if (target.isDead) {
      this.combat._handleDeath(target, player, {
        floor,
        floorIndex: this.getFloorIndex()
      });
    }
    return dealt;
  }

  _revealAround(cx, cy, radius) {
    const floor = this.getFloor();
    if (!floor) return;
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (Math.abs(x - cx) + Math.abs(y - cy) > radius) continue;
        const tile = floor.tileAt(x, y);
        if (tile) tile.explored = true;
      }
    }
  }
}
