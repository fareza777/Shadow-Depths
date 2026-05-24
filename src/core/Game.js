/**
 * Game — top-level orchestrator. Wires every subsystem together exactly once
 * and exposes a tiny public surface (`boot()`, `newRun()`, `quitToTitle()`).
 *
 * Subsystems that don't exist yet (Renderer, Dungeon, Player, etc.) will be
 * filled in Part 2–5 of the build. Constructor accepts them by injection so
 * tests can pass fakes and so this file stays under the 300-line budget.
 *
 * Loading order is non-trivial:
 *   1. Load JSON content (items, enemies, floors, lore, balance).
 *   2. Merge balance JSON onto code defaults.
 *   3. Instantiate persistent meta-progress from localStorage.
 *   4. Hand the renderer + scene manager to the game loop.
 *   5. Switch to the title scene.
 */
import { LOG } from '../config/constants.js';
import { DEFAULT_BALANCE } from '../config/balance.js';

export class Game {
  /**
   * @param {{
   *   eventBus: import('./EventBus.js').EventBus,
   *   stateStore: import('./StateStore.js').StateStore,
   *   sceneManager: import('./SceneManager.js').SceneManager,
   *   gameLoop: import('./GameLoop.js').GameLoop,
   *   saveManager: { load: Function, save: Function },
   *   metaProgress: { load: Function, recordRun: Function },
   *   sceneFactories: {
   *     title: (deps: any) => object,
   *     game:  (deps: any) => object,
   *     gameover: (deps: any) => object,
   *     victory: (deps: any) => object
   *   }
   * }} deps
   */
  constructor(deps) {
    this.bus = deps.eventBus;
    this.state = deps.stateStore;
    this.scenes = deps.sceneManager;
    this.loop = deps.gameLoop;
    this.save = deps.saveManager;
    this.meta = deps.metaProgress;
    this._sceneFactories = deps.sceneFactories;

    /** @type {object} provided by composition root (main.js) */
    this.content = deps.content || null;
    /** @type {object} */
    this.balance = deps.balance || DEFAULT_BALANCE;

    // Game-level event wiring — scene transitions etc.
    this.bus.on('request:newRun', () => this.newRun());
    this.bus.on('request:quitToTitle', () => this.quitToTitle());
    this.bus.on('run:over', (summary) => this._onRunOver(summary));
    this.bus.on('run:victory', (summary) => this._onRunVictory(summary));
  }

  /** Boot sequence. Must be called exactly once. Content + balance are
   *  provided by the composition root (main.js) so this method stays
   *  side-effect-free with respect to network I/O. */
  async boot() {
    console.log(LOG.CORE, 'boot start');

    if (!this.content) {
      throw new Error('Game.boot: deps.content was not provided to constructor');
    }

    // Hydrate meta-progress (highscore, unlocks).
    const metaSnapshot = this.meta.load();
    if (metaSnapshot) {
      Object.assign(this.state.state.meta, metaSnapshot);
    }

    // Switch to title.
    this.quitToTitle();
    this.loop.start();

    console.log(LOG.CORE, 'boot complete');
  }

  /** Start a fresh run. */
  newRun(opts = {}) {
    if (!this._sceneFactories.game) {
      console.warn(LOG.CORE, 'newRun called before GameScene factory is registered');
      return;
    }
    const scene = this._sceneFactories.game({
      bus: this.bus,
      state: this.state,
      content: this.content,
      balance: this.balance,
      seed: opts.seed
    });
    this.state.setScene('game');
    this.scenes.switch('game', scene, opts);
  }

  /** Drop the player back to the title screen. */
  quitToTitle() {
    const scene = this._sceneFactories.title({
      bus: this.bus,
      state: this.state,
      content: this.content,
      balance: this.balance
    });
    this.state.setScene('title');
    this.scenes.switch('title', scene);
  }

  _onRunOver(summary) {
    // recordRun computes score, mutates the copy it receives, and returns
    // the score + unlock metadata. The original `summary` object that
    // GameScene emitted does NOT carry the score — we have to enrich it
    // ourselves before handing it to the GameOver scene factory or the
    // scene renders "SCORE 0" forever.
    const result = this.meta.recordRun({ ...summary, died: true });
    const enriched = {
      ...summary,
      died: true,
      score: result.score,
      isNewHighScore: result.isNewHighScore,
      unlocked: result.unlocked
    };
    const scene = this._sceneFactories.gameover({
      bus: this.bus,
      state: this.state,
      content: this.content,
      summary: enriched
    });
    this.state.setScene('gameover');
    this.scenes.switch('gameover', scene, enriched);
  }

  _onRunVictory(summary) {
    const result = this.meta.recordRun({ ...summary, died: false });
    const enriched = {
      ...summary,
      died: false,
      score: result.score,
      isNewHighScore: result.isNewHighScore,
      unlocked: result.unlocked
    };
    const scene = this._sceneFactories.victory({
      bus: this.bus,
      state: this.state,
      content: this.content,
      summary: enriched
    });
    this.state.setScene('victory');
    this.scenes.switch('victory', scene, enriched);
  }
}
