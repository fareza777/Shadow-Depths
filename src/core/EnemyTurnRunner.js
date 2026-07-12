/**
 * EnemyTurnRunner — closest-first enemy turn loop extracted from GameScene.
 *
 * Keeps GameScene thinner while preserving the same act/cap/distance rules.
 */
import { tickTriggerCooldowns } from '../combat/TriggerSystem.js';
import { LOG } from '../config/constants.js';

/**
 * @param {{
 *   floor: object,
 *   player: object,
 *   combat: object,
 *   pathfinding: object,
 *   rng?: object,
 *   bus?: object,
 *   activeDistance?: number,
 *   maxActing?: number
 * }} opts
 */
export function runEnemyTurns({
  floor,
  player,
  combat,
  pathfinding,
  rng,
  bus: _bus,
  activeDistance = 8,
  maxActing = 8
}) {
  if (!floor || !player || !combat) return;

  const enemies = floor.enemies()
    .map((e) => ({ e, d: Math.abs(e.x - player.x) + Math.abs(e.y - player.y) }))
    .sort((a, b) => a.d - b.d)
    .map((wrap) => wrap.e);

  const ctx = {
    floor,
    player,
    rng: rng || combat.rng,
    pathfinding,
    turn: player.runStats?.turnsUsed || 0
  };

  let acted = 0;
  for (const enemy of enemies) {
    if (enemy.isDead) continue;
    const dist = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
    if (dist > activeDistance && !floor.tileAt(enemy.x, enemy.y)?.visible) {
      enemy.intent = { type: 'wait' };
      continue;
    }
    if (acted >= maxActing) {
      enemy.intent = { type: 'wait' };
      continue;
    }
    acted += 1;
    try {
      tickTriggerCooldowns(enemy);
      const action = enemy.decide(ctx);
      combat.execute(action, enemy, ctx);
      combat.tickEntity(enemy);
    } catch (err) {
      console.error(LOG.CORE, `enemy turn failed (${enemy.defId}):`, err);
    }
    if (player.isDead) break;
  }
}
