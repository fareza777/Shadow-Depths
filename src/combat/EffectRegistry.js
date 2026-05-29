/**
 * EffectRegistry — central registry for "do something" effects.
 *
 * Replaces the switch/case in CombatSystem._applyItemEffect / _applyOnHit.
 * Every effect type registers an `apply(ctx, eff)` function:
 *
 *     ctx = {
 *       source: 'item' | 'weapon' | 'enemy' | 'spell' | 'status' | 'skill',
 *       sourceRef?: object,        // the item / weapon / spell def
 *       actor?: object,            // who is causing the effect (attacker)
 *       target: object,            // who/what receives it (player or enemy)
 *       floor?: object,
 *       throwTarget?: {x,y},
 *       damageDealt?: number,      // for onHit triggers
 *       bus: EventBus,
 *     }
 *
 * apply() returns true if "something happened" (counts as item-consumed
 * when called from useItemSlot).
 *
 * The registry is OPEN — gameplay modules (spells, skills, future
 * crafted item affixes) can `register(type, handler)` without modifying
 * CombatSystem. This is the foundation Phase B/C build on.
 */

const handlers = new Map();

/**
 * Register an effect handler. Throws if duplicate (catches typos at boot).
 * @param {string} type
 * @param {{ apply: (ctx:object, eff:object) => boolean, description?: string }} handler
 */
export function registerEffect(type, handler) {
  if (handlers.has(type)) {
    console.warn(`[EffectRegistry] duplicate registration for "${type}" — keeping first`);
    return;
  }
  if (typeof handler?.apply !== 'function') {
    throw new Error(`[EffectRegistry] handler for "${type}" missing apply()`);
  }
  handlers.set(type, handler);
}

/**
 * Apply an effect by type. Returns whether the effect "fired" (true) so
 * callers can decide e.g. if a consumable should be spent.
 * @param {object} eff  the effect spec, must have `.type`
 * @param {object} ctx  shared context
 * @returns {boolean}
 */
export function applyEffect(eff, ctx) {
  if (!eff || !eff.type) return false;
  const h = handlers.get(eff.type);
  if (!h) {
    console.warn(`[EffectRegistry] no handler for effect type "${eff.type}"`);
    return false;
  }
  try {
    return !!h.apply(ctx, eff);
  } catch (err) {
    console.warn(`[EffectRegistry] handler for "${eff.type}" threw:`, err);
    return false;
  }
}

/** Available effect types — for tooling / debug UI / content validator. */
export function listEffects() {
  return Array.from(handlers.keys()).sort();
}

/** True if a type is registered. */
export function hasEffect(type) {
  return handlers.has(type);
}

// ── Built-in effects ──────────────────────────────────────────────────
// Registered once at module load. CombatSystem and SpellSystem reuse
// these by passing the right `ctx.target`.

import { StatusEffects } from './StatusEffects.js';

registerEffect('heal', {
  description: 'Restore HP to target.',
  apply(ctx, eff) {
    const tgt = ctx.target;
    if (!tgt || typeof tgt.heal !== 'function') return false;
    const healed = tgt.heal(eff.value || 0);
    if (healed > 0 && ctx.bus) {
      ctx.bus.emit('entity:healed', { entity: tgt, amount: healed, source: ctx.sourceRef || ctx.source });
    }
    return healed > 0;
  }
});

registerEffect('damage', {
  description: 'Deal flat damage to target.',
  apply(ctx, eff) {
    const tgt = ctx.target;
    if (!tgt || typeof tgt.takeDamage !== 'function') return false;
    const dealt = tgt.takeDamage(eff.value || 0);
    if (dealt > 0 && ctx.bus) {
      ctx.bus.emit('entity:damaged', { entity: tgt, amount: dealt, source: ctx.sourceRef || ctx.source, isCrit: false });
    }
    return dealt > 0;
  }
});

registerEffect('maxHP', {
  description: 'Permanently raise target HP cap and heal that amount.',
  apply(ctx, eff) {
    const tgt = ctx.target;
    if (!tgt?.stats) return false;
    const inc = eff.value || 0;
    tgt.stats.hpMax += inc;
    tgt.heal(inc);
    if (ctx.bus) ctx.bus.emit('entity:healed', { entity: tgt, amount: inc, source: ctx.sourceRef });
    return inc > 0;
  }
});

registerEffect('grantXP', {
  description: 'Grant XP to player. Emits levelUp if it crosses a threshold.',
  apply(ctx, eff) {
    const tgt = ctx.target;
    if (!tgt || typeof tgt.gainXP !== 'function') return false;
    const amount = eff.value || 0;
    const levels = tgt.gainXP(amount);
    if (ctx.bus) {
      ctx.bus.emit('entity:xpGained', { entity: tgt, amount, source: ctx.sourceRef });
      if (levels > 0) ctx.bus.emit('entity:leveledUp', { entity: tgt, levels });
    }
    return true;
  }
});

registerEffect('applyStatus', {
  description: 'Apply a status effect (poison, atk_buff, etc.) to target.',
  apply(ctx, eff) {
    return StatusEffects.apply(ctx.target, eff, ctx.bus);
  }
});

registerEffect('revealFloor', {
  description: 'Reveal the entire current floor.',
  apply(ctx) {
    if (!ctx.floor || typeof ctx.floor.revealAll !== 'function') return false;
    ctx.floor.revealAll();
    if (ctx.bus) ctx.bus.emit('floor:revealed', { floor: ctx.floor });
    return true;
  }
});

registerEffect('autoReviveOnce', {
  description: 'Grant the player one revive charge.',
  apply(ctx) {
    const tgt = ctx.target;
    if (!tgt) return false;
    tgt.reviveCharges = (tgt.reviveCharges || 0) + 1;
    return true;
  }
});

registerEffect('lifesteal', {
  description: 'Heal attacker for a fraction of damage dealt (onHit).',
  apply(ctx, eff) {
    const attacker = ctx.actor;
    const dealt = ctx.damageDealt || 0;
    if (!attacker || dealt <= 0) return false;
    const healed = attacker.heal(Math.ceil(dealt * (eff.value || 0)));
    if (healed > 0 && ctx.bus) {
      ctx.bus.emit('entity:healed', { entity: attacker, amount: healed, source: ctx.sourceRef || 'lifesteal' });
    }
    return healed > 0;
  }
});

registerEffect('drainXP', {
  description: 'Drain XP from the player (enemy onHit).',
  apply(ctx, eff) {
    const tgt = ctx.target;
    if (!tgt || tgt.kind !== 'player' || typeof tgt.drainXP !== 'function') return false;
    const amount = eff.value || 0;
    tgt.drainXP(amount);
    if (ctx.bus) ctx.bus.emit('entity:xpGained', { entity: tgt, amount: -amount, source: 'drain' });
    return true;
  }
});

registerEffect('torchBoost', {
  description: 'Extend torch radius for several turns.',
  apply(ctx, eff) {
    const tgt = ctx.target;
    if (!tgt || tgt.kind !== 'player') return false;
    tgt.torchBoostAmount = eff.value || 2;
    tgt.torchBoostTurns = eff.duration || 20;
    if (ctx.bus) ctx.bus.emit('player:torchBoost', { entity: tgt, amount: tgt.torchBoostAmount, turns: tgt.torchBoostTurns });
    return true;
  }
});

registerEffect('aoe_damage', {
  description: 'Deal damage to all entities within radius of throwTarget.',
  apply(ctx, eff) {
    const { floor, throwTarget, actor } = ctx;
    if (!floor || !throwTarget) return false;
    const radius = eff.radius ?? 1;
    let any = false;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = throwTarget.x + dx, y = throwTarget.y + dy;
        const ent = floor.entityAt(x, y);
        if (!ent) continue;
        if (ent.kind === 'player' && !eff.friendlyFire) continue;
        const dealt = ent.takeDamage(eff.value || 0);
        if (ctx.bus) ctx.bus.emit('entity:damaged', { entity: ent, amount: dealt, source: ctx.sourceRef, isCrit: false });
        if (ent.isDead && ctx.onKill) ctx.onKill(ent, actor);
        any = true;
      }
    }
    return any;
  }
});
