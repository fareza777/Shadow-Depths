/**
 * StatusEffects — registry + apply helper.
 *
 * Tick logic for built-in v0.1 effects (poison, atk_buff, def_buff) lives
 * on Entity (`tickStatusEffects`, `modifierAtk`, `modifierDef`) because they
 * mutate the entity itself. This module provides:
 *
 *   1. A registry of metadata (display name, color, icon) so the UI doesn't
 *      hard-code strings.
 *   2. `apply(entity, effectSpec)` — the single entrypoint for "make this
 *      entity poisoned/buffed". Normalizes the spec and dispatches events.
 *
 * Adding a new effect in v0.4 = register here + (if it needs custom tick
 * behavior) add a case in Entity.tickStatusEffects. The brief explicitly
 * calls out Burn, Freeze, Bleed as the next batch — they all fit the
 * "DoT or stat modifier" mold and won't require structural changes.
 */
export const STATUS_REGISTRY = Object.freeze({
  poison: {
    id: 'poison',
    name: 'Poison',
    description: 'Loses N HP at the start of each turn.',
    color: '#5ac06a',
    iconKey: 'fx_poison',
    stackable: true
  },
  atk_buff: {
    id: 'atk_buff',
    name: 'Strength',
    description: 'Attack increased.',
    color: '#d05a5a',
    iconKey: 'fx_atk_buff',
    stackable: false
  },
  def_buff: {
    id: 'def_buff',
    name: 'Iron Skin',
    description: 'Defense increased.',
    color: '#5a8ed8',
    iconKey: 'fx_def_buff',
    stackable: false
  }
});

export const StatusEffects = {
  /**
   * @param {import('../entities/Entity.js').Entity} entity
   * @param {{ status:string, value:number, duration:number, stackable?:boolean }} spec
   * @param {import('../core/EventBus.js').EventBus} [bus]
   */
  apply(entity, spec, bus) {
    if (!entity || !spec || !spec.status) return false;
    const meta = STATUS_REGISTRY[spec.status];
    if (!meta) return false;
    entity.applyStatus({
      id: spec.status,
      value: spec.value ?? 1,
      duration: spec.duration ?? 1,
      stackable: spec.stackable ?? meta.stackable
    });
    if (bus) bus.emit('entity:status', { entity, status: spec.status });
    return true;
  },

  /** UI helper: friendly name. */
  nameOf(id) {
    return STATUS_REGISTRY[id]?.name || id;
  }
};
