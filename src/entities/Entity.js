/**
 * Entity — base for Player and Enemy.
 *
 * Composition over inheritance is preferred elsewhere (AI behaviors), but
 * Entity is genuinely shared state (position, hp, stats, status effects).
 *
 * Render position is stored separately from grid position so we can tween:
 *   x, y         — authoritative grid cell (combat/pathing use these)
 *   renderX,Y    — current visual position in tiles, interpolated by the
 *                  renderer toward (x, y) over TIMING.moveTween.
 */
import { StatusEffects as _statusEffects } from '../combat/StatusEffects.js';

let _nextId = 0;

export class Entity {
  /**
   * @param {{ id?:string, kind:string, x:number, y:number,
   *           stats:{ hp:number, atk:number, def:number, dex?:number, hpMax?:number } }} opts
   */
  constructor({ id, kind, x, y, stats }) {
    this.id = id ?? `${kind}_${++_nextId}`;
    this.kind = kind; // 'player' | 'enemy'
    this.x = x;
    this.y = y;
    this.renderX = x;
    this.renderY = y;
    this.facing = 1; // 1 = right, -1 = left (visual only)

    const hpMax = stats.hpMax ?? stats.hp;
    /** @type {{ hp:number, hpMax:number, atk:number, def:number, dex:number }} */
    this.stats = {
      hp: stats.hp,
      hpMax,
      atk: stats.atk,
      def: stats.def,
      dex: stats.dex ?? 0
    };

    /** @type {Array<{ id:string, value:number, duration:number }>} */
    this.statusEffects = [];

    this.isDead = false;
  }

  // --- combat ---------------------------------------------------------
  /**
   * Apply damage; clamps HP, sets isDead. Returns actual damage dealt.
   * Callers (CombatSystem) handle event emission + death cleanup.
   */
  takeDamage(amount) {
    const dealt = Math.max(0, Math.floor(amount));
    this.stats.hp = Math.max(0, this.stats.hp - dealt);
    if (this.stats.hp === 0) this.isDead = true;
    return dealt;
  }

  heal(amount) {
    if (this.isDead) return 0;
    const before = this.stats.hp;
    this.stats.hp = Math.min(this.stats.hpMax, this.stats.hp + Math.floor(amount));
    return this.stats.hp - before;
  }

  // --- status effects -------------------------------------------------
  /**
   * Add or stack a status effect. Stackable effects sum values; non-stackable
   * refresh duration to max.
   * @param {{ id:string, value:number, duration:number, stackable?:boolean }} effect
   */
  applyStatus(effect) {
    const existing = this.statusEffects.find((e) => e.id === effect.id);
    if (!existing) {
      this.statusEffects.push({ ...effect });
      return;
    }
    if (effect.stackable) {
      existing.value += effect.value;
      existing.duration = Math.max(existing.duration, effect.duration);
    } else {
      existing.value = Math.max(existing.value, effect.value);
      existing.duration = Math.max(existing.duration, effect.duration);
    }
  }

  /**
   * Tick all active effects. Returns total HP delta (negative = damage taken
   * from DoTs like poison) so the caller can route through the bus.
   */
  tickStatusEffects() {
    return _statusEffects.tickAll(this);
  }

  modifierAtk() { return _statusEffects.modifier(this, 'atk'); }
  modifierDef() { return _statusEffects.modifier(this, 'def'); }
  modifierDex() { return _statusEffects.modifier(this, 'dex'); }
  isStunned()   { return _statusEffects.shouldSkipTurn(this); }

  /** Snap renderX/Y to grid (used after teleport / floor change). */
  snapRender() {
    this.renderX = this.x;
    this.renderY = this.y;
  }
}
