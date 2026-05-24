/**
 * Enemy — Entity + behavior reference + bookkeeping (xp reward, intent icon).
 *
 * The behavior instance is injected at construction so different enemy AI
 * is just "different class, same interface". Behaviors return an action
 * descriptor; CombatSystem (Part 3) is responsible for executing it.
 *
 * Intent is recomputed each turn and exposed to the renderer so the icon
 * above the head shows what they'll do *next turn*.
 */
import { Entity } from './Entity.js';

export class Enemy extends Entity {
  /**
   * @param {object} def entry from data/enemies.json
   * @param {object} behavior instance with decideAction()
   * @param {{ x:number, y:number }} pos
   * @param {number} [scale] depth-based stat multiplier (floor depthScale).
   *        HP scales linearly, ATK at half rate (steeper feels unfair),
   *        XP and gold scale linearly so deep runs reward proportionally.
   */
  constructor(def, behavior, pos, scale = 1) {
    const safeScale = Math.max(0.5, scale);
    const atkFactor = 1 + (safeScale - 1) * 0.5;
    const baseHp = def.stats.hp;
    const baseAtk = def.stats.atk;
    const scaledHp = Math.max(1, Math.round(baseHp * safeScale));
    const scaledAtk = Math.max(1, Math.round(baseAtk * atkFactor));
    super({
      id: `${def.id}_${pos.x}_${pos.y}_${Math.floor(Math.random() * 9999)}`,
      kind: 'enemy',
      x: pos.x,
      y: pos.y,
      stats: { ...def.stats, hp: scaledHp, hpMax: scaledHp, atk: scaledAtk }
    });
    this.defId = def.id;
    this.name = def.name;
    this.spriteKey = def.spriteKey || 'enemy_default';
    this.behavior = behavior;
    this.onHitPlayer = def.onHitPlayer || [];
    this.xpReward = Math.max(1, Math.round((def.xp || 0) * safeScale));
    const baseGold = def.goldDrop || [0, 0];
    this.goldDrop = [
      Math.max(0, Math.round(baseGold[0] * safeScale)),
      Math.max(0, Math.round(baseGold[1] * safeScale))
    ];

    /** @type {{ type:string, target?:{x:number,y:number} } | null} */
    this.intent = null;

    /** Pre-rolled gold for deterministic credit on death. */
    this._rolledGold = 0;
  }

  /**
   * Ask the behavior what to do next. Stored as `intent` for the UI to
   * telegraph and for the CombatSystem to execute on enemy turn.
   *
   * @param {object} ctx { floor, player, rng, pathfinding, turn }
   */
  decide(ctx) {
    if (this.isDead) { this.intent = null; return null; }
    if (typeof this.behavior?.decideAction !== 'function') {
      this.intent = { type: 'wait' };
      return this.intent;
    }
    this.intent = this.behavior.decideAction(this, ctx) || { type: 'wait' };
    return this.intent;
  }
}
