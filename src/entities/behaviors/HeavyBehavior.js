/**
 * HeavyBehavior — Stone Golem.
 *
 * Acts every N turns (default 2). On a non-acting turn returns `wait` and
 * exposes intent so the UI can show a "winding up" icon.
 *
 * When acting: chase via A* (delegated to ChaseBehavior style logic) or
 * attack if adjacent.
 */
import { ChaseBehavior } from './ChaseBehavior.js';

export class HeavyBehavior {
  constructor(params = {}) {
    this.actEveryNTurns = Math.max(1, params.actEveryNTurns ?? 2);
    this._counter = 0;
    this._inner = new ChaseBehavior();
  }

  decideAction(enemy, ctx) {
    this._counter += 1;
    if (this._counter < this.actEveryNTurns) {
      return { type: 'wait', meta: { winding: true } };
    }
    this._counter = 0;
    return this._inner.decideAction(enemy, ctx);
  }

  /**
   * Peek next intent without advancing the wind-up counter.
   */
  previewIntent(enemy, ctx) {
    const next = this._counter + 1;
    if (next < this.actEveryNTurns) {
      return { type: 'wait', meta: { winding: true } };
    }
    return this._inner.previewIntent?.(enemy, ctx)
      || this._inner.decideAction(enemy, ctx);
  }
}
