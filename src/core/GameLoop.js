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
    this._loop = this._loop.bind(this);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTs = performance.now();
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
    const rawDt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    const dt = Math.min(rawDt, this._maxDt);
    this._accumDt += dt;

    this._state.state.time += dt;

    // 1. Per-frame tick (tweens, particles, audio envelope).
    try {
      this._bus.emit('tick', { dt, time: this._state.state.time });
    } catch (err) {
      console.error(LOG.CORE, 'tick threw (loop kept alive):', err);
    }

    // 2. Scene update (handles e.g. floor transition animation).
    try {
      this._scenes.update(dt);
    } catch (err) {
      console.error(LOG.CORE, 'scene update threw (loop kept alive):', err);
    }

    try {
      this._renderer.render(this._scenes, this._state);
    } catch (err) {
      console.error(LOG.CORE, 'render threw (loop kept alive):', err);
    }

    this._rafId = requestAnimationFrame(this._loop);
  }
}
