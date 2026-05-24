/**
 * ErraticBehavior — Cave Bat.
 *
 * 60% of turns: chase greedily. 40% of turns: random move.
 * On attack: declared with `meta.missChance` so CombatSystem applies the miss.
 *
 * Hard-to-corner feel comes from the randomness — you can be adjacent and the
 * bat still moves the wrong way.
 */
import { greedyStep } from './ChaseBehavior.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export class ErraticBehavior {
  constructor(params = {}) {
    this.missChance       = params.missChance ?? 0.25;
    this.randomMoveChance = params.randomMoveChance ?? 0.40;
  }

  decideAction(enemy, ctx) {
    const { floor, player, rng } = ctx;
    if (manhattan(enemy, player) === 1 && !rng.chance(this.randomMoveChance)) {
      return {
        type: 'attack',
        target: { x: player.x, y: player.y },
        meta: { missChance: this.missChance }
      };
    }
    if (rng.chance(this.randomMoveChance)) {
      const order = rng.shuffle(DIRS);
      for (const [dx, dy] of order) {
        const nx = enemy.x + dx, ny = enemy.y + dy;
        if (floor.isPassable(nx, ny)) return { type: 'move', to: { x: nx, y: ny } };
      }
      return { type: 'wait' };
    }
    return greedyStep(enemy, player, floor) || { type: 'wait' };
  }
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
