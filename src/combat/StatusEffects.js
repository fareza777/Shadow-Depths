/**
 * Status effect registry.
 *
 * Every status (poison, burn, freeze, bleed, regen, stun, slow, atk_buff,
 * def_buff) is a registered entry with optional hooks:
 *
 *   tick(entity, eff, ctx) → number   HP delta this tick (neg = damage,
 *                                     pos = heal). Called once per turn end.
 *   onApply(entity, eff)              one-off application side effect.
 *   onExpire(entity, eff)             cleanup.
 *   modifierAtk(entity, eff)          → number, queried in combat math
 *   modifierDef(entity, eff)
 *   skipTurn(entity, eff)             → boolean, freezes / stuns the actor
 *   stackPolicy: 'refresh' | 'stack' | 'extend'
 *
 * Adding a new status = registerStatus({...}) — no edit to Entity or
 * CombatSystem required.
 */

const REGISTRY = new Map();

/**
 * @param {{
 *   id:string, name:string, color:string, iconKey?:string,
 *   description?:string, stackPolicy?: 'refresh'|'stack'|'extend',
 *   tick?: (entity:object, eff:object, ctx?:object) => number,
 *   onApply?: (entity:object, eff:object) => void,
 *   onExpire?: (entity:object, eff:object) => void,
 *   modifierAtk?: (entity:object, eff:object) => number,
 *   modifierDef?: (entity:object, eff:object) => number,
 *   skipTurn?: (entity:object, eff:object) => boolean,
 *   dexDelta?: (entity:object, eff:object) => number,
 * }} entry
 */
export function registerStatus(entry) {
  if (!entry?.id) throw new Error('[StatusRegistry] entry needs an id');
  if (REGISTRY.has(entry.id)) {
    console.warn(`[StatusRegistry] duplicate "${entry.id}" — keeping first`);
    return;
  }
  REGISTRY.set(entry.id, { stackPolicy: 'refresh', ...entry });
}

/** @returns {object|null} */
export function getStatusMeta(id) {
  return REGISTRY.get(id) || null;
}

export function listStatuses() {
  return Array.from(REGISTRY.keys()).sort();
}

/** Public registry — backwards-compat with existing UI code that imports it. */
export const STATUS_REGISTRY = new Proxy({}, {
  get(_t, key) { return REGISTRY.get(key); },
  has(_t, key) { return REGISTRY.has(key); },
  ownKeys() { return Array.from(REGISTRY.keys()); },
  getOwnPropertyDescriptor(_t, key) {
    return REGISTRY.has(key)
      ? { enumerable: true, configurable: true, value: REGISTRY.get(key) }
      : undefined;
  }
});

// ── Built-in statuses ─────────────────────────────────────────────────

registerStatus({
  id: 'poison', name: 'Poison',
  description: 'Loses N HP at the start of each turn.',
  color: '#5ac06a', iconKey: 'fx_poison', stackPolicy: 'stack',
  tick(entity, eff) {
    const dealt = entity.takeDamage(eff.value || 1);
    return -dealt;
  }
});

registerStatus({
  id: 'burn', name: 'Burning',
  description: 'Loses HP per turn; intensity drops by 1 each tick.',
  color: '#ff8844', iconKey: 'fx_burn', stackPolicy: 'refresh',
  tick(entity, eff) {
    const dealt = entity.takeDamage(eff.value || 1);
    // Burns cool down — intensity decays each tick.
    eff.value = Math.max(0, (eff.value || 1) - 1);
    return -dealt;
  }
});

registerStatus({
  id: 'bleed', name: 'Bleeding',
  description: 'Loses HP per turn; stacks duration but not damage.',
  color: '#c4503a', iconKey: 'fx_bleed', stackPolicy: 'extend',
  tick(entity, eff) {
    const dealt = entity.takeDamage(eff.value || 1);
    return -dealt;
  }
});

registerStatus({
  id: 'regen', name: 'Regen',
  description: 'Recovers HP at the start of each turn.',
  color: '#a0ff80', iconKey: 'fx_regen', stackPolicy: 'refresh',
  tick(entity, eff) {
    const healed = entity.heal(eff.value || 1);
    return healed;
  }
});

registerStatus({
  id: 'freeze', name: 'Frozen',
  description: 'Skips turns. Cannot act.',
  color: '#bcd6ff', iconKey: 'fx_freeze', stackPolicy: 'refresh',
  skipTurn() { return true; }
});

registerStatus({
  id: 'stun', name: 'Stunned',
  description: 'Skips the next turn.',
  color: '#f0e0a0', iconKey: 'fx_stun', stackPolicy: 'refresh',
  skipTurn() { return true; }
});

registerStatus({
  id: 'slow', name: 'Slowed',
  description: 'Reduced dexterity (lower crit, less likely to dodge).',
  color: '#7faafa', iconKey: 'fx_slow', stackPolicy: 'refresh',
  dexDelta(_e, eff) { return -(eff.value || 1); }
});

registerStatus({
  id: 'atk_buff', name: 'Strength',
  description: 'Attack increased.',
  color: '#d05a5a', iconKey: 'fx_atk_buff', stackPolicy: 'refresh',
  modifierAtk(_e, eff) { return eff.value || 0; }
});

registerStatus({
  id: 'def_buff', name: 'Iron Skin',
  description: 'Defense increased.',
  color: '#5a8ed8', iconKey: 'fx_def_buff', stackPolicy: 'refresh',
  modifierDef(_e, eff) { return eff.value || 0; }
});

// ── Public surface used by CombatSystem + Entity + UI ────────────────

export const StatusEffects = {
  /**
   * Apply an effect. Validates against registry, dispatches stackPolicy,
   * runs onApply hook, emits entity:status.
   */
  apply(entity, spec, bus) {
    if (!entity || !spec || !spec.status) return false;
    const meta = REGISTRY.get(spec.status);
    if (!meta) {
      console.warn(`[StatusEffects] unknown status "${spec.status}"`);
      return false;
    }
    const effect = {
      id: spec.status,
      value: spec.value ?? 1,
      duration: spec.duration ?? 1
    };
    const existing = entity.statusEffects.find((e) => e.id === effect.id);
    if (!existing) {
      entity.statusEffects.push(effect);
      meta.onApply?.(entity, effect);
    } else {
      switch (meta.stackPolicy) {
        case 'stack':
          existing.value += effect.value;
          existing.duration = Math.max(existing.duration, effect.duration);
          break;
        case 'extend':
          existing.duration += effect.duration;
          existing.value = Math.max(existing.value, effect.value);
          break;
        case 'refresh':
        default:
          existing.value = Math.max(existing.value, effect.value);
          existing.duration = Math.max(existing.duration, effect.duration);
          break;
      }
    }
    if (bus) bus.emit('entity:status', { entity, status: spec.status });
    return true;
  },

  nameOf(id) {
    return REGISTRY.get(id)?.name || id;
  },

  /** Drive Entity.tickStatusEffects. Returns total HP delta. */
  tickAll(entity, ctx) {
    let hpDelta = 0;
    for (const eff of entity.statusEffects) {
      const meta = REGISTRY.get(eff.id);
      if (meta?.tick) hpDelta += meta.tick(entity, eff, ctx) || 0;
      eff.duration -= 1;
    }
    const expired = entity.statusEffects.filter((e) => e.duration <= 0);
    for (const e of expired) {
      const meta = REGISTRY.get(e.id);
      meta?.onExpire?.(entity, e);
    }
    entity.statusEffects = entity.statusEffects.filter((e) => e.duration > 0);
    return hpDelta;
  },

  /** Aggregate stat modifiers (atk / def / dex deltas) from active effects. */
  modifier(entity, kind) {
    let bonus = 0;
    for (const eff of entity.statusEffects) {
      const meta = REGISTRY.get(eff.id);
      if (!meta) continue;
      if (kind === 'atk' && meta.modifierAtk) bonus += meta.modifierAtk(entity, eff);
      if (kind === 'def' && meta.modifierDef) bonus += meta.modifierDef(entity, eff);
      if (kind === 'dex' && meta.dexDelta) bonus += meta.dexDelta(entity, eff);
    }
    return bonus;
  },

  /** True if any active status freezes/stuns the entity. */
  shouldSkipTurn(entity) {
    for (const eff of entity.statusEffects) {
      const meta = REGISTRY.get(eff.id);
      if (meta?.skipTurn?.(entity, eff)) return true;
    }
    return false;
  }
};
