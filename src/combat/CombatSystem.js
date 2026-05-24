/**
 * CombatSystem — executes turn actions and resolves damage.
 *
 * Two responsibilities:
 *   1. Run the action a behavior (or player input) chose: move / attack /
 *      ranged / wait / use item.
 *   2. Calculate damage with the formula from balance.combat and trigger
 *      every downstream effect (lifesteal, drainXP, status apply, death).
 *
 * Everything that needs to react to combat (HUD, audio, camera shake,
 * achievements) subscribes to the bus. CombatSystem only emits — it does
 * not know UI exists.
 *
 * Events emitted:
 *   entity:moved        { entity, from, to }
 *   entity:attacked     { attacker, target, damage, isCrit, isMiss, kind }
 *   entity:damaged      { entity, amount, source, isCrit }
 *   entity:healed       { entity, amount, source }
 *   entity:died         { entity, killer }
 *   entity:xpGained     { entity, amount, source }
 *   entity:leveledUp    { entity, levels }
 *   item:used           { item, by }
 *   floor:descended     { fromIndex, toIndex }
 */
import { LOG } from '../config/constants.js';
import { StatusEffects } from './StatusEffects.js';
import { hasLineOfSight } from '../entities/behaviors/RangedBehavior.js';

export class CombatSystem {
  /**
   * @param {{ bus:object, balance:object, rng:object, pathfinding:object }} deps
   */
  constructor({ bus, balance, rng, pathfinding }) {
    this.bus = bus;
    this.balance = balance;
    this.rng = rng.fork('combat');
    this.pathfinding = pathfinding;
  }

  // --- damage formula -------------------------------------------------
  /**
   * Deterministic damage roll: (atk - def) + variance, min 1. Crit doubles.
   * @returns {{ damage:number, isCrit:boolean }}
   */
  calculateDamage(attacker, defender) {
    const c = this.balance.combat;
    const baseATK = this._attackStat(attacker);
    const baseDEF = this._defenseStat(defender);
    const variance = this.rng.randInt(c.varianceMin, c.varianceMax);
    let damage = Math.max(c.minDamage, baseATK - baseDEF + variance);
    const critChance = this._critChance(attacker);
    const isCrit = this.rng.chance(critChance);
    if (isCrit) damage *= c.critMultiplier;
    return { damage, isCrit };
  }

  _attackStat(e) {
    if (e.kind === 'player' && typeof e.totalAtk === 'function') return e.totalAtk();
    return e.stats.atk + e.modifierAtk();
  }
  _defenseStat(e) {
    if (e.kind === 'player' && typeof e.totalDef === 'function') return e.totalDef();
    return e.stats.def + e.modifierDef();
  }
  _critChance(e) {
    if (e.kind === 'player' && typeof e.critChance === 'function') return e.critChance();
    const c = this.balance.combat;
    return Math.min(0.95, c.baseCritChance + e.stats.dex * c.critPerDex);
  }

  // --- action dispatch -----------------------------------------------
  /**
   * @param {object} action  { type, ... }
   * @param {object} actor
   * @param {object} ctx { floor, player }
   * @returns {boolean} true if a turn was consumed (action succeeded)
   */
  execute(action, actor, ctx) {
    if (!action) return false;
    switch (action.type) {
      case 'move':   return this._doMove(actor, action.to, ctx);
      case 'attack': return this._doMelee(actor, action.target, ctx, action.meta);
      case 'ranged': return this._doRanged(actor, action.target, ctx, action.meta);
      case 'wait':   return true;
      default:
        console.warn(LOG.COMBAT, `unknown action type "${action.type}"`);
        return false;
    }
  }

  _doMove(actor, to, ctx) {
    const { floor } = ctx;
    if (!floor.isPassable(to.x, to.y)) return false;
    const from = { x: actor.x, y: actor.y };
    floor.moveEntity(actor, to.x, to.y);
    this.bus.emit('entity:moved', { entity: actor, from, to });
    return true;
  }

  _doMelee(actor, targetPos, ctx, meta) {
    const { floor } = ctx;
    const target = floor.entityAt(targetPos.x, targetPos.y);
    if (!target || target.isDead) return true; // turn still spent

    if (meta?.missChance && this.rng.chance(meta.missChance)) {
      this.bus.emit('entity:attacked', { attacker: actor, target, damage: 0, isCrit: false, isMiss: true, kind: 'melee' });
      return true;
    }

    this._resolveHit(actor, target, 'melee');
    return true;
  }

  _doRanged(actor, targetPos, ctx, _meta) {
    const { floor } = ctx;
    const target = floor.entityAt(targetPos.x, targetPos.y);
    if (!target || target.isDead) return true;
    if (!hasLineOfSight(floor, actor, target)) return true; // missed — no LOS
    this._resolveHit(actor, target, 'ranged');
    return true;
  }

  _resolveHit(attacker, target, kind) {
    const raw = this.calculateDamage(attacker, target);
    let finalDamage = raw.damage;
    // Player passive skill: Stout reduces incoming damage.
    if (target.kind === 'player' && target.damageReduction > 0) {
      finalDamage = Math.max(1, Math.round(finalDamage * (1 - target.damageReduction)));
    }
    const isCrit = raw.isCrit;
    const dealt = target.takeDamage(finalDamage);

    this.bus.emit('entity:attacked', { attacker, target, damage: dealt, isCrit, isMiss: false, kind });
    this.bus.emit('entity:damaged', { entity: target, amount: dealt, source: attacker, isCrit });

    // Attacker on-hit effects (weapon for player, def list for enemy).
    this._applyAttackerOnHit(attacker, target, dealt);
    // Enemy-on-player passives.
    if (attacker.kind === 'enemy' && target.kind === 'player' && attacker.onHitPlayer) {
      for (const eff of attacker.onHitPlayer) this._applyOnHit(eff, target);
    }

    if (target.isDead) this._handleDeath(target, attacker);
  }

  _applyAttackerOnHit(attacker, target, dealt) {
    // Player weapon onHit (e.g. lifesteal).
    let totalLifestealPct = 0;
    if (attacker.kind === 'player' && attacker.weapon?.onHit) {
      for (const eff of attacker.weapon.onHit) {
        if (eff.type === 'lifesteal') totalLifestealPct += (eff.value || 0);
      }
    }
    // Bloodthirst skill — adds flat lifesteal on every hit.
    if (attacker.kind === 'player' && attacker.skillLifesteal > 0) {
      totalLifestealPct += attacker.skillLifesteal;
    }
    if (totalLifestealPct > 0) {
      const healed = attacker.heal(Math.ceil(dealt * totalLifestealPct));
      if (healed > 0) this.bus.emit('entity:healed', { entity: attacker, amount: healed, source: attacker.weapon || 'skill' });
    }
  }

  _applyOnHit(eff, victim) {
    if (eff.type === 'drainXP' && victim.kind === 'player') {
      victim.drainXP(eff.value || 0);
      this.bus.emit('entity:xpGained', { entity: victim, amount: -(eff.value || 0), source: 'drain' });
    } else if (eff.type === 'applyStatus') {
      StatusEffects.apply(victim, eff, this.bus);
    }
  }

  _handleDeath(entity, killer) {
    // Revive Charm for the player.
    if (entity.kind === 'player' && entity.reviveCharges > 0) {
      entity.reviveCharges -= 1;
      entity.isDead = false;
      const restored = Math.floor(entity.stats.hpMax * 0.5);
      entity.stats.hp = restored;
      this.bus.emit('entity:healed', { entity, amount: restored, source: 'revive_charm' });
      this.bus.emit('player:revived', { entity });
      return;
    }
    this.bus.emit('entity:died', { entity, killer });

    if (entity.kind === 'enemy' && killer && killer.kind === 'player') {
      // Pre-roll gold for deterministic credit.
      const [gMin, gMax] = entity.goldDrop || [0, 0];
      entity._rolledGold = this.rng.randInt(gMin, gMax);
      const levelsGained = killer.recordKill(entity);
      this.bus.emit('entity:xpGained', { entity: killer, amount: entity.xpReward || 0, source: entity });
      // CRITICAL: without this, the skill picker never opened on the most
      // common XP path (killing enemies). The picker subscribes to
      // entity:leveledUp; that event was only fired from grantXP items.
      if (levelsGained > 0) {
        this.bus.emit('entity:leveledUp', { entity: killer, levels: levelsGained });
      }
    }
    if (entity.kind === 'player') {
      entity.runStats.killedBy = killer?.name || killer?.id || 'the dark';
    }
  }

  // --- item use -------------------------------------------------------
  /**
   * Use an inventory slot. Returns true if a turn was consumed.
   * For throwables (target === 'tile') the caller passes the target tile.
   *
   * @param {object} ctx { player, floor, inventory, throwTarget? }
   * @param {number} slotIndex
   */
  useItemSlot(ctx, slotIndex) {
    const { player, floor, inventory, throwTarget } = ctx;
    const item = inventory.getSlot(slotIndex);
    if (!item) return false;

    // Equipment: equip flow, costs 0 turns per the brief (Section 7.1).
    if (item.slot) {
      // Handled by Equipment helper from UI; if it reaches here, no-op.
      return false;
    }

    if (!item.effects) return false;
    let didSomething = false;
    for (const eff of item.effects) {
      didSomething = this._applyItemEffect(eff, item, player, floor, throwTarget) || didSomething;
    }
    if (didSomething) {
      const empty = inventory.takeOne(slotIndex);
      this.bus.emit('item:used', { item: empty || item, by: player });
      player.runStats.itemsUsed += 1;
    }
    return didSomething;
  }

  _applyItemEffect(eff, item, player, floor, throwTarget) {
    switch (eff.type) {
      case 'heal': {
        const healed = player.heal(eff.value);
        if (healed > 0) this.bus.emit('entity:healed', { entity: player, amount: healed, source: item });
        return healed > 0;
      }
      case 'maxHP': {
        player.stats.hpMax += eff.value;
        player.heal(eff.value);
        this.bus.emit('entity:healed', { entity: player, amount: eff.value, source: item });
        return true;
      }
      case 'grantXP': {
        const levels = player.gainXP(eff.value);
        this.bus.emit('entity:xpGained', { entity: player, amount: eff.value, source: item });
        if (levels > 0) this.bus.emit('entity:leveledUp', { entity: player, levels });
        return true;
      }
      case 'applyStatus':
        return StatusEffects.apply(player, eff, this.bus);
      case 'revealFloor':
        floor.revealAll();
        this.bus.emit('floor:revealed', { floor });
        return true;
      case 'autoReviveOnce':
        player.reviveCharges += 1;
        return true;
      case 'aoe_damage':
        return this._applyAOE(eff, item, player, floor, throwTarget);
      default:
        console.warn(LOG.ITEM, `unknown effect type "${eff.type}"`);
        return false;
    }
  }

  _applyAOE(eff, item, player, floor, throwTarget) {
    if (!throwTarget) return false;
    const radius = eff.radius ?? 1;
    let any = false;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = throwTarget.x + dx, y = throwTarget.y + dy;
        const ent = floor.entityAt(x, y);
        if (!ent) continue;
        if (ent.kind === 'player' && !eff.friendlyFire) continue;
        const dealt = ent.takeDamage(eff.value);
        this.bus.emit('entity:damaged', { entity: ent, amount: dealt, source: item, isCrit: false });
        if (ent.isDead) this._handleDeath(ent, player);
        any = true;
      }
    }
    return any;
  }

  // --- end-of-turn ----------------------------------------------------
  /**
   * Tick all status effects on an entity, emit damage events for DoTs, and
   * check for death.
   */
  tickEntity(entity) {
    if (!entity || entity.isDead) return;
    const delta = entity.tickStatusEffects();
    if (delta < 0) {
      this.bus.emit('entity:damaged', { entity, amount: -delta, source: 'status', isCrit: false });
      if (entity.isDead) this._handleDeath(entity, { name: 'poison', kind: 'status' });
    }
  }
}
