/**
 * PhaseBehavior — Shadow Wraith.
 *
 * Pathfinds with walls ignored (clips through stone). Still respects entity
 * blocking so two wraiths don't end up on the same tile. On hit, the Enemy's
 * `onHitPlayer` effects are processed by CombatSystem (drainXP).
 */
import { greedyStep } from './ChaseBehavior.js';

export class PhaseBehavior {
  constructor(_params) {
    this.params = _params || {};
    this.pathfindDistance = this.params.pathfindDistance ?? 6;
  }

  decideAction(enemy, ctx) {
    const { floor, player, pathfinding } = ctx;
    const dist = manhattan(enemy, player);
    if (dist === 1) {
      return { type: 'attack', target: { x: player.x, y: player.y } };
    }
    // ignoreWalls A* explores a huge space — only use it up close.
    if (dist > this.pathfindDistance) {
      return greedyStep(enemy, player, floor) || { type: 'wait' };
    }
    const path = pathfinding.findPath(
      floor,
      { x: enemy.x, y: enemy.y },
      { x: player.x, y: player.y },
      { ignoreWalls: true, canPassEntity: (x, y) => (x === player.x && y === player.y) }
    );
    if (path && path.length >= 2) {
      const step = path[1];
      const ent = floor.entityAt(step.x, step.y);
      if (!ent || (ent.x === player.x && ent.y === player.y)) {
        return { type: 'move', to: step };
      }
    }
    return greedyStep(enemy, player, floor) || { type: 'wait' };
  }

  previewIntent(enemy, ctx) {
    return this.decideAction(enemy, ctx);
  }
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
