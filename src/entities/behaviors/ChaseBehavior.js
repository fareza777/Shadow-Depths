/**
 * ChaseBehavior — A* toward the player; attack if adjacent.
 *
 * Used by: Goblin Scout.
 *
 * Notes:
 *   - Returns ACTION descriptors only; never mutates the floor.
 *   - If pathfinding fails (e.g. player teleported behind a wall and the only
 *     route is blocked by another enemy), falls back to greedy 4-step toward
 *     the player. If that's also blocked, waits.
 */
export class ChaseBehavior {
  /** @param {object} [_params] reserved for tuning per-enemy. */
  constructor(_params) {
    this.params = _params || {};
  }

  /**
   * @param {import('../Enemy.js').Enemy} enemy
   * @param {{ floor:object, player:object, pathfinding:object }} ctx
   */
  decideAction(enemy, ctx) {
    const { floor, player, pathfinding } = ctx;

    // Adjacent? Attack.
    if (manhattan(enemy, player) === 1) {
      return { type: 'attack', target: { x: player.x, y: player.y } };
    }

    // Try A*.
    const path = pathfinding.findPath(
      floor,
      { x: enemy.x, y: enemy.y },
      { x: player.x, y: player.y },
      { canPassEntity: (x, y) => (x === player.x && y === player.y) }
    );
    if (path && path.length >= 2) {
      const step = path[1];
      if (floor.isPassable(step.x, step.y)) {
        return { type: 'move', to: step };
      }
    }

    // Greedy fallback.
    return greedyStep(enemy, player, floor) || { type: 'wait' };
  }
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function greedyStep(enemy, target, floor) {
  const dx = Math.sign(target.x - enemy.x);
  const dy = Math.sign(target.y - enemy.y);
  const tries = [];
  if (Math.abs(target.x - enemy.x) > Math.abs(target.y - enemy.y)) {
    if (dx) tries.push({ x: enemy.x + dx, y: enemy.y });
    if (dy) tries.push({ x: enemy.x, y: enemy.y + dy });
  } else {
    if (dy) tries.push({ x: enemy.x, y: enemy.y + dy });
    if (dx) tries.push({ x: enemy.x + dx, y: enemy.y });
  }
  for (const step of tries) {
    if (floor.isPassable(step.x, step.y)) return { type: 'move', to: step };
  }
  return null;
}
