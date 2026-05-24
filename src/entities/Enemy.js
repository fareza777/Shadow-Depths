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
   */
  constructor(def, behavior, pos) {
    super({
      id: `${def.id}_${pos.x}_${pos.y}_${Math.floor(Math.random() * 9999)}`,
      kind: 'enemy',
      x: pos.x,
      y: pos.y,
      stats: { ...def.stats, hpMax: def.stats.hp }
    });
    this.defId = def.id;
    this.name = def.name;
    this.spriteKey = def.spriteKey || 'enemy_default';
    this.behavior = behavior;
    this.onHitPlayer = def.onHitPlayer || [];
    this.xpReward = def.xp || 0;
    this.goldDrop = def.goldDrop || [0, 0];

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
