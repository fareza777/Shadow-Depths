/**
 * DescendFlow — floor transition after stairs.
 * Extracted from GameScene so descend logic stays testable and thin.
 */

/**
 * Descend is no longer gated: the game is free and every floor is open. The
 * hook stays so GameScene and saved runs keep one call shape, and so a future
 * gate (event floors, seasonal locks) has an obvious home.
 *
 * @param {object} deps
 * @param {object} deps.billing
 * @returns {{ blocked:boolean, reason?:string }}
 */
export function gateDescend({ billing } = {}, currentIndex, mode) {
  if (billing?.needsUnlockToDescend?.(currentIndex, mode)) {
    return { blocked: true, reason: 'gated' };
  }
  return { blocked: false };
}

/**
 * Move the player onto the next generated floor.
 * @returns {'victory'|'ok'|null} null if no next floor object somehow
 */
export function applyDescendTransition(scene, next) {
  if (!next) {
    scene._endRun(true);
    return 'victory';
  }
  const { floor, spawns } = next;
  scene.floor.removeEntity(scene.player);
  scene.player.x = spawns.player.x;
  scene.player.y = spawns.player.y;
  scene.player.snapRender();
  floor.addEntity(scene.player);
  scene._spawnFloorEntities(floor, spawns);
  scene.floor = floor;
  scene.pathfinding.invalidate();
  return 'ok';
}
