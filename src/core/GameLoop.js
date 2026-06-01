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

    // Adaptive frame pacing. Prefer 60fps for touch feel; fall back to a
    // steady 30fps only while measured frame work is genuinely too high.
    this._lastWorkTs = 0;
    this._frameEma = 16;          // ms, exponential moving average of work
    this._targetMs = 1000 / 60;
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

    // Frame pacing: skip this rAF if we're ahead of the current target
    // interval. (~1.5ms slack so we don't constantly miss the vsync edge.)
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

    // Adapt the target frame rate from measured work (with hysteresis so it
    // doesn't flap around the threshold). _preferSteady30 only sets the
    // conservative *starting* target; once the device proves it can keep up
    // (sustained work < 13ms) we lift to 60, and drop back to 30 if it runs
    // hot (> 18ms). The band in between holds the current rate steady.
    const work = performance.now() - workStart;
    perfMeter.endFrame(work);
    this._frameEma += (work - this._frameEma) * 0.1;
    if (this._frameEma > 18) this._targetMs = 1000 / 30;
    else if (this._frameEma < 13) this._targetMs = 1000 / 60;

    this._rafId = requestAnimationFrame(this._loop);
  }
}
