/**
 * StateStore — global game state container.
 *
 * Not a Redux. We don't need time-travel or strict immutability for a
 * single-player turn-based game. What we *do* need:
 *   1. A single place to read "what is true right now".
 *   2. An event ('state:changed') so UI can refresh reactively.
 *   3. A `patch()` API that scopes mutations to a path so changes are
 *      auditable in the console during debugging.
 *
 * Path syntax is dot-separated: `patch('run.player.hp', 12)`.
 */
import { LOG } from '../config/constants.js';

export class StateStore {
  /**
   * @param {import('./EventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this._bus = eventBus;
    this._state = StateStore.createInitialState();
  }

  static createInitialState() {
    return {
      scene: 'title', // 'title' | 'game' | 'gameover' | 'victory'
      run: null,      // populated when scene === 'game'
      meta: {
        highscore: 0,
        runsCompleted: 0,
        runsDied: 0,
        unlocks: [],
        settings: {
          volume: 0.6,
          vibration: true,
          showTutorial: true
        }
      },
      ui: {
        inventoryOpen: false,
        minimapOpen: true,
        messages: []
      },
      time: 0  // monotonic frame counter, used by tween code
    };
  }

  /** @returns {object} live state (do not mutate externally) */
  get state() {
    return this._state;
  }

  /**
   * Read by dotted path; returns undefined for missing nodes.
   * @param {string} path
   */
  get(path) {
    return StateStore._walk(this._state, path);
  }

  /**
   * Set by dotted path. Emits 'state:changed' with the path that changed.
   * Creates intermediate objects as needed.
   * @param {string} path
   * @param {*} value
   */
  patch(path, value) {
    if (!path) throw new Error('StateStore.patch: path required');
    const segments = path.split('.');
    const last = segments.pop();
    let cursor = this._state;
    for (const seg of segments) {
      if (cursor[seg] === undefined || cursor[seg] === null) {
        cursor[seg] = {};
      }
      cursor = cursor[seg];
    }
    cursor[last] = value;
    this._bus.emit('state:changed', { path, value });
  }

  /**
   * Replace the entire `run` slot. Used at New Run / load / Game Over.
   * @param {object|null} runState
   */
  setRun(runState) {
    this._state.run = runState;
    this._bus.emit('state:changed', { path: 'run', value: runState });
  }

  /**
   * @param {'title'|'game'|'gameover'|'victory'} scene
   */
  setScene(scene) {
    this._state.scene = scene;
    this._bus.emit('scene:changed', scene);
    this._bus.emit('state:changed', { path: 'scene', value: scene });
  }

  /**
   * Reset to a freshly-created initial state. Preserves meta progression.
   */
  resetKeepingMeta() {
    const preserved = this._state.meta;
    this._state = StateStore.createInitialState();
    this._state.meta = preserved;
    this._bus.emit('state:changed', { path: '*', value: null });
  }

  /** Debug helper. Toggle with `?debugState` in v0.2+. */
  debugDump() {
    console.log(LOG.CORE, 'state =', JSON.parse(JSON.stringify(this._state)));
  }

  // --- internal -------------------------------------------------------
  static _walk(obj, path) {
    if (!path) return obj;
    const segments = path.split('.');
    let cursor = obj;
    for (const seg of segments) {
      if (cursor == null) return undefined;
      cursor = cursor[seg];
    }
    return cursor;
  }
}
