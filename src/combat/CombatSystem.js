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
// StatusEffects is reachable through the EffectRegistry's 'applyStatus' handler.
import { applyEffect } from './EffectRegistry.js';
import { fireTriggers } from './TriggerSystem.js';
import { hasLineOfSight } from '../entities/behaviors/RangedBehavior.js';
import { onHeroKill, passiveFlatDamageReduction } from '../gameplay/heroPassives.js';

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

    this._resolveHit(actor, target, 'melee', ctx);
    return true;
  }

  _doRanged(actor, targetPos, ctx, _meta) {
    const { floor } = ctx;
    const target = floor.entityAt(targetPos.x, targetPos.y);
    if (!target || target.isDead) return true;
    if (!hasLineOfSight(floor, actor, target)) return true; // missed — no LOS
    const dist = Math.abs(target.x - actor.x) + Math.abs(target.y - actor.y);
    if (actor.kind === 'player') {
      if (dist <= 1) {
        this.bus.emit('entity:attacked', { attacker: actor, target, damage: 0, isCrit: false, isMiss: true, kind: 'ranged' });
        return true;
      }
      if (typeof actor.spendRangedFocus === 'function' && !actor.spendRangedFocus(1)) {
        this.bus.emit('entity:attacked', { attacker: actor, target, damage: 0, isCrit: false, isMiss: true, kind: 'ranged' });
        return false;
      }
      const missChance = Math.max(0, (dist - 3) * 0.08);
      if (missChance > 0 && this.rng.chance(missChance)) {
        this.bus.emit('entity:attacked', { attacker: actor, target, damage: 0, isCrit: false, isMiss: true, kind: 'ranged' });
        return true;
      }
    }
    this._resolveHit(actor, target, 'ranged', ctx);
    return true;
  }

  _resolveHit(attacker, target, kind, ctx = {}) {
    const raw = this.calculateDamage(attacker, target);
    let finalDamage = raw.damage;
    if (attacker.kind === 'enemy' && kind === 'ranged') {
      const depth = ctx.floor?.definition?.index ?? 0;
      if (depth >= 30) finalDamage += 1;
      if (depth >= 60) finalDamage += 1;
    }
    if (target.kind === 'player') {
      const flat = passiveFlatDamageReduction(target, ctx.floor, attacker);
      if (flat > 0) finalDamage = Math.max(1, finalDamage - flat);
      if (target.damageReduction > 0) {
        finalDamage = Math.max(1, Math.round(finalDamage * (1 - target.damageReduction)));
      }
    }
    if (attacker.kind === 'player') attacker._lastAttackKind = kind;
    const isCrit = raw.isCrit;
    const hpPctBefore = target.stats.hp / Math.max(1, target.stats.hpMax);
    const dealt = target.takeDamage(finalDamage);
    const hpPctAfter = target.stats.hp / Math.max(1, target.stats.hpMax);

    this.bus.emit('entity:attacked', { attacker, target, damage: dealt, isCrit, isMiss: false, kind });
    this.bus.emit('entity:damaged', { entity: target, amount: dealt, source: attacker, isCrit });

    // Attacker on-hit effects via EffectRegistry (weapon onHit list + skill lifesteal).
    this._applyAttackerOnHit(attacker, target, dealt);
    if (attacker.kind === 'player' && kind === 'melee' && dealt > 0) {
      attacker.restoreRangedFocus?.(1);
    }
    // Enemy-on-player legacy onHitPlayer list — apply each through the registry.
    if (attacker.kind === 'enemy' && target.kind === 'player' && attacker.onHitPlayer) {
      for (const eff of attacker.onHitPlayer) {
        applyEffect(eff, {
          source: 'enemy', sourceRef: attacker,
          actor: attacker, target,
          floor: ctx.floor, bus: this.bus,
          damageDealt: dealt
        });
      }
    }

    // ── Trigger proc system ────────────────────────────────────────
    // Fire attacker triggers (onHit, onCrit, onKill).
    const trigCtx = {
      actor: attacker, target, floor: ctx.floor,
      bus: this.bus, rng: this.rng, damageDealt: dealt
    };
    fireTriggers('onHit', trigCtx);
    if (isCrit) fireTriggers('onCrit', trigCtx);
    if (target.isDead) fireTriggers('onKill', trigCtx);
    // Fire defender triggers (onDamaged, onHpBelow).
    const defCtx = {
      actor: target, target: attacker, floor: ctx.floor,
      bus: this.bus, rng: this.rng, damageDealt: dealt,
      hpPctBefore, hpPctAfter
    };
    if (dealt > 0) fireTriggers('onDamaged', defCtx);
    fireTriggers('onHpBelow', defCtx);

    if (target.isDead) this._handleDeath(target, attacker, ctx);
  }

  _applyAttackerOnHit(attacker, target, dealt) {
    // Player weapon onHit (lifesteal, status proc, etc.) — every entry goes
    // through the EffectRegistry. Old shape was a list of bare effect specs.
    if (attacker.kind === 'player' && attacker.weapon?.onHit) {
      for (const eff of attacker.weapon.onHit) {
        applyEffect(eff, {
          source: 'weapon', sourceRef: attacker.weapon,
          actor: attacker, target,
          bus: this.bus, damageDealt: dealt
        });
      }
    }
    // Bloodthirst skill — flat lifesteal on every hit. Routed through the
    // same registry so the heal event has consistent shape.
    if (attacker.kind === 'player' && attacker.skillLifesteal > 0) {
      applyEffect({ type: 'lifesteal', value: attacker.skillLifesteal }, {
        source: 'skill', sourceRef: 'bloodthirst',
        actor: attacker, target,
        bus: this.bus, damageDealt: dealt
      });
    }
  }

  _handleDeath(entity, killer, ctx = {}) {
    // Revive Charm for the player — weaker restore on deep floors.
    if (entity.kind === 'player' && entity.reviveCharges > 0) {
      entity.reviveCharges -= 1;
      entity.isDead = false;
      const floorIdx = ctx.floor?.definition?.index ?? ctx.floorIndex ?? 0;
      const healPct = floorIdx >= 40 ? 0.35 : floorIdx >= 20 ? 0.42 : 0.5;
      const restored = Math.floor(entity.stats.hpMax * healPct);
      entity.stats.hp = restored;
      this.bus.emit('entity:healed', { entity, amount: restored, source: 'revive_charm' });
      this.bus.emit('player:revived', { entity });
      return;
    }
    this.bus.emit('entity:died', { entity, killer });

    if (entity.kind === 'enemy' && killer && killer.kind === 'player') {
      onHeroKill(killer, { kind: killer._lastAttackKind || 'melee' });
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
      killer.restoreRangedFocus?.(1);
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
    // All consumable / scroll / throwable effects flow through the
    // EffectRegistry. Adding a new effect type = registerEffect() in any
    // module — no edit to CombatSystem.
    return applyEffect(eff, {
      source: 'item',
      sourceRef: item,
      actor: player,
      target: player,
      floor,
      throwTarget,
      bus: this.bus,
      onKill: (ent, killer) =>
        this._handleDeath(ent, killer, { floor, floorIndex: floor.definition?.index })
    });
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
