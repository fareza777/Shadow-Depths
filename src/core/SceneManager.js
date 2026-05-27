/**
 * SceneManager — owns the current Scene and routes update/render/input to it.
 *
 * Scene contract (duck-typed, not a base class — composition > inheritance):
 *   { enter(ctx)?, exit()?, update(dt)?, render(renderer)?, handleInput(ev)? }
 *
 * Why no base class: scenes have wildly different lifecycles. TitleScreen
 * does no per-frame update. GameScene runs the turn loop. A base class with
 * empty default methods would invite stale overrides.
 */
import { LOG } from '../config/constants.js';

export class SceneManager {
  /**
   * @param {import('./EventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this._bus = eventBus;
    this._current = null;
    this._currentName = null;
  }

  /**
   * @param {string} name
   * @param {object} scene  must implement at least one of update/render/handleInput
   * @param {object} [enterCtx] passed to scene.enter()
   */
  switch(name, scene, enterCtx) {
    if (!scene || typeof scene !== 'object') {
      throw new Error(`SceneManager.switch: scene "${name}" is not an object`);
    }
    if (this._current && typeof this._current.exit === 'function') {
      try { this._current.exit(); }
      catch (err) { console.error(LOG.CORE, 'scene.exit threw:', err); }
    }
    const prev = this._currentName;
    this._current = scene;
    this._currentName = name;
    if (typeof scene.enter === 'function') {
      try { scene.enter(enterCtx); }
      catch (err) {
        console.error(LOG.CORE, 'scene.enter threw:', err);
        // Escape this catch so the global window.onerror handler can show
        // the failure visibly instead of a blank canvas with nothing in
        // the console for mobile players who can't open devtools.
        setTimeout(() => { throw err; }, 0);
      }
    }
    this._bus.emit('scene:switched', { from: prev, to: name });
  }

  /** @param {number} dt seconds since last frame */
  update(dt) {
    if (this._current && typeof this._current.update === 'function') {
      this._current.update(dt);
    }
  }

  render(renderer) {
    const scene = this._current;
    if (!scene) return;
    if (typeof scene.renderWorld === 'function' && typeof scene.renderUI === 'function') {
      scene.renderWorld(renderer);
      return;
    }
    if (typeof scene.render === 'function') {
      scene.render(renderer);
    }
  }

  /** Screen-space HUD + controls (no camera shake). */
  renderUI(renderer) {
    const scene = this._current;
    if (scene && typeof scene.renderUI === 'function') {
      scene.renderUI(renderer);
    }
  }

  handleInput(ev) {
    if (this._current && typeof this._current.handleInput === 'function') {
      this._current.handleInput(ev);
    }
  }

  get current() { return this._current; }
  get currentName() { return this._currentName; }
}
