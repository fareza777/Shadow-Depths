/**
 * EnemyFactory — spawn helpers extracted from GameScene.
 */
import { Enemy } from '../entities/Enemy.js';
import { ChaseBehavior } from '../entities/behaviors/ChaseBehavior.js';
import { RangedBehavior } from '../entities/behaviors/RangedBehavior.js';
import { ErraticBehavior } from '../entities/behaviors/ErraticBehavior.js';
import { HeavyBehavior } from '../entities/behaviors/HeavyBehavior.js';
import { PhaseBehavior } from '../entities/behaviors/PhaseBehavior.js';
import { BossPatternBehavior } from '../entities/behaviors/BossPatternBehavior.js';
import { rollEliteAffixes, forcedEliteAffixes, makeElite } from '../gameplay/eliteAffixes.js';
import { LOG } from '../config/constants.js';

export const BEHAVIOR_MAP = {
  chase: ChaseBehavior,
  ranged: RangedBehavior,
  erratic: ErraticBehavior,
  heavy: HeavyBehavior,
  phase: PhaseBehavior,
  boss_pattern: BossPatternBehavior
};

/**
 * @param {object} deps
 * @param {object} deps.content
 * @param {object} deps.itemFactory
 * @param {object} deps.rng
 * @param {Function} deps.enemyScale
 */
export function spawnFloorEntities(floor, spawns, deps) {
  const { content, itemFactory, rng, enemyScale } = deps;
  const depthScale = floor.definition?.depthScale || 1;
  const diff = typeof enemyScale === 'function' ? enemyScale() : (enemyScale || 1);
  const depthIdx = floor.definition?.index ?? 0;
  const eliteChanceMul = floor.definition?.eliteChanceMul || 1;
  const eliteRng = rng.fork(`elite:${depthIdx}`);
  const behaviors = deps.behaviors || BEHAVIOR_MAP;

  for (const s of spawns.enemies) {
    try {
      const def = content.enemies[s.defId];
      if (!def) { console.warn(LOG.ENTITY, `no enemy def "${s.defId}"`); continue; }
      const BehaviorCls = behaviors[def.behavior] || ChaseBehavior;
      const behavior = new BehaviorCls(def.behaviorParams);
      const enemy = new Enemy(def, behavior, { x: s.x, y: s.y }, depthScale, diff);
      if (!s.defId.startsWith('boss_') && !s.defId.startsWith('subboss_')) {
        let affixes = rollEliteAffixes(eliteRng, depthIdx, { chanceMul: eliteChanceMul });
        if (!affixes.length && s.forceElite) affixes = forcedEliteAffixes(eliteRng, depthIdx);
        if (affixes.length) makeElite(enemy, affixes, depthIdx);
      }
      enemy.snapRender();
      floor.addEntity(enemy);
    } catch (err) {
      console.warn(LOG.ENTITY, `spawn failed for "${s.defId}":`, err);
    }
  }
  for (const s of spawns.items) {
    try {
      const stack = s.count ?? 1;
      const item = s.affixes
        ? itemFactory.createWithAffix(s.defId, s.affixes, stack)
        : itemFactory.create(s.defId, stack);
      if (item) floor.addItem(s.x, s.y, item);
    } catch (err) {
      console.warn(LOG.ITEM, `item spawn failed for "${s.defId}":`, err);
    }
  }
}

export function createEnemy(defId, pos, floor, deps) {
  const { content, enemyScale, behaviors } = deps;
  const def = content.enemies[defId];
  if (!def) return null;
  const map = behaviors || BEHAVIOR_MAP;
  const BehaviorCls = map[def.behavior] || ChaseBehavior;
  const behavior = new BehaviorCls(def.behaviorParams);
  const scale = typeof enemyScale === 'function' ? enemyScale() : (enemyScale || 1);
  const enemy = new Enemy(def, behavior, pos, floor.definition?.depthScale || 1, scale);
  enemy.snapRender();
  return enemy;
}
