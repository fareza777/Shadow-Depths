/**
 * DescendFlow — freemium gate + floor transition after stairs.
 * Extracted from GameScene so descend logic stays testable and thin.
 */

/**
 * @param {object} deps
 * @param {object} deps.billing
 * @param {object} deps.paywall
 * @param {object} deps.bus
 * @param {number} currentIndex
 * @param {string} mode
 * @returns {{ blocked:boolean, reason?:string }}
 */
export function gateDescend({ billing, paywall, bus }, currentIndex, mode) {
  if (!billing?.needsUnlockToDescend?.(currentIndex, mode)) {
    return { blocked: false };
  }
  paywall?.show?.('descend');
  const cap = billing.freeFloorCap || 10;
  bus?.emit?.('log:message', {
    text: `Floor ${cap + 1}+ requires Full Descent unlock.`,
    kind: 'warn'
  });
  return { blocked: true, reason: 'paywall' };
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
