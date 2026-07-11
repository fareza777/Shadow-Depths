/**
 * GameLoop — the rAF heartbeat.
 *
 * Architecture choice (Section 13.1 of the brief):
 *   - Logic is turn-based. Turns do NOT advance per frame.
 *   - rAF is used purely for render, tween interpolation, particle update,
 *     and input flush. The TurnEngine (in GameScene) calls `processTurn()`
 *     in response to player input — never from here.
 *
 * Public surface intentionally small: start() / stop() / pauseRendering().
 * Anything that needs per-frame work subscribes to 'tick' on the bus.
 */
import { LOG } from '../config/constants.js';
import { prefersLeanCombatFx } from '../config/layoutMetrics.js';
import { perfMeter } from '../debug/PerfMeter.js';

export class GameLoop {
  /**
   * @param {{
   *   eventBus: import('./EventBus.js').EventBus,
   *   sceneManager: import('./SceneManager.js').SceneManager,
   *   renderer: { render: Function },
   *   stateStore: import('./StateStore.js').StateStore
   * }} deps
   */
  constructor({ eventBus, sceneManager, renderer, stateStore }) {
    this._bus = eventBus;
    this._scenes = sceneManager;
    this._renderer = renderer;
    this._state = stateStore;

    this._running = false;
    this._rafId = 0;
    this._lastTs = 0;
    this._accumDt = 0;
    this._maxDt = 1 / 15; // clamp to avoid huge jumps after tab-switch

    // Adaptive frame pacing. Budget phones can't hold 60fps redrawing the
    // whole world; a ragged 40–55fps reads as stutter. Prefer a steady 30fps
    // on lean/mobile builds, then lift to 60 only when work stays cheap.
    this._lastWorkTs = 0;
    this._frameEma = 16;
    this._preferSteady30 = prefersLeanCombatFx();
    this._targetMs = this._preferSteady30 ? 1000 / 30 : 1000 / 60;
    this._loop = this._loop.bind(this);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTs = performance.now();
    this._lastWorkTs = 0;
    this._rafId = requestAnimationFrame(this._loop);
    console.log(LOG.CORE, 'GameLoop started');
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    cancelAnimationFrame(this._rafId);
    console.log(LOG.CORE, 'GameLoop stopped');
  }

  _loop(ts) {
    if (!this._running) return;

    // Skip this rAF if we're ahead of the target interval (~1.5ms slack).
    const since = this._lastWorkTs ? ts - this._lastWorkTs : this._targetMs;
    if (since < this._targetMs - 1.5) {
      this._rafId = requestAnimationFrame(this._loop);
      return;
    }
    this._lastWorkTs = ts;
    this._lastTs = ts;
    const dt = Math.min(since / 1000, this._maxDt);
    this._accumDt += dt;

    this._state.state.time += dt;

    const workStart = performance.now();
    perfMeter.beginFrame();

    // 1. Per-frame tick (tweens, particles, audio envelope).
    try {
      perfMeter.measure('tick', () => this._bus.emit('tick', { dt, time: this._state.state.time }));
    } catch (err) {
      console.error(LOG.CORE, 'tick threw (loop kept alive):', err);
    }

    // 2. Scene update (handles e.g. floor transition animation).
    try {
      perfMeter.measure('update', () => this._scenes.update(dt));
    } catch (err) {
      console.error(LOG.CORE, 'scene update threw (loop kept alive):', err);
    }

    try {
      perfMeter.measure('render', () => this._renderer.render(this._scenes, this._state));
    } catch (err) {
      console.error(LOG.CORE, 'render threw (loop kept alive):', err);
    }

    const work = performance.now() - workStart;
    perfMeter.endFrame(work);
    this._frameEma += (work - this._frameEma) * 0.1;
    // Hysteresis: drop to 30 when hot, lift to 60 only when clearly cheap.
    // Lean builds stay at 30 unless work is very light (<10ms).
    if (this._frameEma > 18) this._targetMs = 1000 / 30;
    else if (this._frameEma < (this._preferSteady30 ? 10 : 13)) this._targetMs = 1000 / 60;

    this._rafId = requestAnimationFrame(this._loop);
  }
}
