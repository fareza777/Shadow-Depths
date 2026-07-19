/**
 * BossPatternBehavior — scripted boss phases with telegraphed slam.
 *
 * Phase 1 (HP > 60%): wind-up every N turns, then chase/melee.
 * Phase 2 (HP ≤ 60%): shorter wind-up; slam telegraph on adjacent tiles.
 * Phase 3 (HP ≤ 30%): faster slam + chase.
 *
 * Used by Crypt Regent and Cairn Knight. Keeps previewIntent pure.
 */
import { ChaseBehavior } from './ChaseBehavior.js';

const DIRS = [
  { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
  { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
];

export class BossPatternBehavior {
  /**
   * @param {{ actEveryNTurns?:number, slamDamageBonus?:number }} [params]
   */
  constructor(params = {}) {
    this.baseEvery = Math.max(1, params.actEveryNTurns ?? 2);
    this.slamBonus = params.slamDamageBonus ?? 2;
    this._counter = 0;
    this._pendingSlam = false;
    this._inner = new ChaseBehavior();
  }

  _phase(enemy) {
    const hp = enemy?.stats?.hp ?? 1;
    const max = Math.max(1, enemy?.stats?.hpMax ?? hp);
    const ratio = hp / max;
    if (ratio <= 0.3) return 3;
    if (ratio <= 0.6) return 2;
    return 1;
  }

  _every(phase) {
    if (phase >= 3) return 1;
    if (phase === 2) return Math.max(1, this.baseEvery - 1);
    return this.baseEvery;
  }

  decideAction(enemy, ctx) {
    const phase = this._phase(enemy);
    const every = this._every(phase);

    if (this._pendingSlam) {
      this._pendingSlam = false;
      this._counter = 0;
      return this._slamOrChase(enemy, ctx, phase);
    }

    this._counter += 1;
    if (this._counter < every) {
      // Telegraph slam in phase 2+ when adjacent; otherwise wind-up wait.
      if (phase >= 2 && this._isAdjacent(enemy, ctx.player)) {
        this._pendingSlam = true;
        return {
          type: 'wait',
          meta: {
            winding: true,
            slam: true,
            tiles: this._adjacentTiles(enemy, ctx.floor)
          }
        };
      }
      return { type: 'wait', meta: { winding: true, phase } };
    }

    this._counter = 0;
    if (phase >= 2 && this._isAdjacent(enemy, ctx.player)) {
      return this._slamOrChase(enemy, ctx, phase);
    }
    return this._inner.decideAction(enemy, ctx);
  }

  previewIntent(enemy, ctx) {
    const phase = this._phase(enemy);
    const every = this._every(phase);
    if (this._pendingSlam) {
      return {
        type: 'wait',
        meta: {
          winding: true,
          slam: true,
          tiles: this._adjacentTiles(enemy, ctx.floor)
        }
      };
    }
    const next = this._counter + 1;
    if (next < every) {
      if (phase >= 2 && this._isAdjacent(enemy, ctx.player)) {
        return {
          type: 'wait',
          meta: {
            winding: true,
            slam: true,
            tiles: this._adjacentTiles(enemy, ctx.floor)
          }
        };
      }
      return { type: 'wait', meta: { winding: true, phase } };
    }
    if (phase >= 2 && this._isAdjacent(enemy, ctx.player)) {
      return {
        type: 'attack',
        target: { x: ctx.player.x, y: ctx.player.y },
        meta: { slam: true, phase }
      };
    }
    return this._inner.previewIntent?.(enemy, ctx)
      || this._inner.decideAction(enemy, ctx);
  }

  _slamOrChase(enemy, ctx, phase) {
    if (this._isAdjacent(enemy, ctx.player)) {
      return {
        type: 'attack',
        target: { x: ctx.player.x, y: ctx.player.y },
        meta: {
          slam: true,
          phase,
          atkBonus: this.slamBonus + (phase >= 3 ? 1 : 0)
        }
      };
    }
    return this._inner.decideAction(enemy, ctx);
  }

  _isAdjacent(enemy, player) {
    if (!enemy || !player) return false;
    return Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y) === 1;
  }

  _adjacentTiles(enemy, floor) {
    const out = [];
    if (!enemy) return out;
    for (const d of DIRS) {
      const x = enemy.x + d.dx;
      const y = enemy.y + d.dy;
      const t = floor?.tileAt?.(x, y);
      if (t && t.walkable) out.push({ x, y });
    }
    return out;
  }
}
