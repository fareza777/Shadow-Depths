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
   *     opening?: (deps: any) => object,
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
    this.billing = deps.billingService || null;
    this.paywall = deps.paywallOverlay || null;
    this._sceneFactories = deps.sceneFactories;

    /** @type {object} provided by composition root (main.js) */
    this.content = deps.content || null;
    /** @type {object} */
    this.balance = deps.balance || DEFAULT_BALANCE;
    this._pendingRunOver = null;

    // Game-level event wiring — scene transitions etc.
    this.bus.on('request:newRun', (opts) => {
      this._finalizePendingRunOver();
      this.newRun(opts || {});
    });
    this.bus.on('request:startRunNow', (opts) => {
      this._finalizePendingRunOver();
      this.newRun({ ...(opts || {}), skipIntro: true });
    });
    this.bus.on('request:continueRun', () => this.continueRun());
    this.bus.on('request:quitToTitle', () => {
      this._finalizePendingRunOver();
      this.quitToTitle();
    });
    this.bus.on('request:reviveRun', (payload) => this._revivePendingRun(payload || {}));
    this.bus.on('run:over', (summary) => this._onRunOver(summary));
    this.bus.on('run:victory', (summary) => this._onRunVictory(summary));
    this.bus.on('billing:unlocked', () => {
      if (this.meta?.state) Object.assign(this.state.state.meta, this.meta.state);
    });
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
    const resumeSnapshot = this._loadRunSnapshot();
    if (resumeSnapshot) {
      this.state.setRun(Game._runCard(resumeSnapshot));
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
    const mode = opts.mode || 'normal';
    const seenIntro = !!this.meta?.state?.settings?.seenIntro;
    // First run only: play the short cinematic. Returning players and
    // explicit skipIntro (post-cinematic / tutorial) jump straight in.
    if (!opts.skipIntro && !seenIntro && mode !== 'tutorial' && this._sceneFactories.opening) {
      const scene = this._sceneFactories.opening({
        bus: this.bus,
        state: this.state,
        content: this.content,
        balance: this.balance,
        runOptions: opts
      });
      this.state.setScene('opening');
      this.scenes.switch('opening', scene, { runOptions: opts });
      return;
    }
    // Mark intro complete once the player leaves the cinematic path.
    if (opts.skipIntro && !seenIntro && this.meta?.setSetting) {
      this.meta.setSetting('seenIntro', true);
    }
    this.save.clearRun?.();
    const scene = this._sceneFactories.game({
      bus: this.bus,
      state: this.state,
      saveManager: this.save,
      content: this.content,
      balance: this.balance,
      seed: opts.seed,
      mode,
      heroKind: opts.heroKind || this.meta?.state?.settings?.lastHero || 'vigil'
    });
    this.state.setScene('game');
    this.scenes.switch('game', scene, opts);
    this.bus.emit('run:started', { revived: false, mode, heroKind: opts.heroKind });
  }

  /** Resume the last in-progress run if storage has a valid snapshot. */
  continueRun() {
    if (!this._sceneFactories.game) return;
    const snapshot = this._loadRunSnapshot();
    if (!snapshot) return;

    const scene = this._sceneFactories.game({
      bus: this.bus,
      state: this.state,
      saveManager: this.save,
      content: this.content,
      balance: this.balance,
      seed: snapshot.seed,
      mode: snapshot.mode || 'normal',
      resumeSnapshot: snapshot
    });
    this.state.setScene('game');
    this.scenes.switch('game', scene, { resumeSnapshot: snapshot });
    this.bus.emit('run:started', { revived: false, mode: snapshot.mode || 'normal' });
  }

  /** Drop the player back to the title screen. */
  quitToTitle() {
    const resumeSnapshot = this._loadRunSnapshot();
    if (resumeSnapshot) this.state.setRun(Game._runCard(resumeSnapshot));
    else this.state.setRun(null);
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
    if (this._pendingRunOver) return;
    const canRevive = !!summary?.died
      && !!summary?.canOfferRevive
      && !!summary?.reviveSnapshot;
    if (canRevive) {
      const pending = { ...summary };
      if (typeof this.meta?.computeScore === 'function') {
        pending.score = this.meta.computeScore({ ...pending, died: true });
      }
      pending.coinsEarned = pending.coinsEarned || 0;
      pending.isNewHighScore = false;
      pending.unlocked = pending.unlocked || [];
      this._pendingRunOver = pending;
      this.save.clearRun?.();
      this.state.setRun(null);
      this._showGameOver(pending);
      return;
    }
    this._recordRunOver(summary);
  }

  _finalizePendingRunOver() {
    if (!this._pendingRunOver) return false;
    const summary = this._pendingRunOver;
    this._pendingRunOver = null;
    this._recordRunOver(summary);
    return true;
  }

  _revivePendingRun({ snapshot } = {}) {
    const pending = this._pendingRunOver;
    if (!pending || !snapshot || snapshot !== pending.reviveSnapshot) return false;
    this._pendingRunOver = null;
    const scene = this._sceneFactories.game({
      bus: this.bus,
      state: this.state,
      saveManager: this.save,
      content: this.content,
      balance: this.balance,
      seed: snapshot.seed,
      mode: snapshot.mode || 'normal',
      heroKind: snapshot.heroKind,
      resumeSnapshot: snapshot,
      reviveAfterReward: true
    });
    this.state.setScene('game');
    this.scenes.switch('game', scene, {
      resumeSnapshot: snapshot,
      reviveAfterReward: true
    });
    this.bus.emit('run:started', { revived: true, mode: snapshot.mode || 'normal' });
    return true;
  }

  _showGameOver(summary) {
    const scene = this._sceneFactories.gameover({
      bus: this.bus,
      state: this.state,
      content: this.content,
      summary
    });
    this.state.setScene('gameover');
    this.scenes.switch('gameover', scene, summary);
  }

  _recordRunOver(summary) {
    this.save.clearRun?.();
    this.state.setRun(null);
    // recordRun mutates the COPY it receives (sets score, coinsEarned,
    // dailyNewBest if applicable). We need to forward those values into
    // the scene's summary or the GameOver screen renders zeros.
    const summaryForRecord = { ...summary, died: true };
    const result = this.meta.recordRun(summaryForRecord);
    const enriched = {
      ...summary,
      died: true,
      score: result.score,
      coinsEarned: result.coinsEarned,
      isNewHighScore: result.isNewHighScore,
      unlocked: result.unlocked,
      dailyNewBest: !!summaryForRecord.dailyNewBest
    };
    this._showGameOver(enriched);
  }

  _onRunVictory(summary) {
    this.save.clearRun?.();
    this.state.setRun(null);
    const summaryForRecord = { ...summary, died: false };
    const result = this.meta.recordRun(summaryForRecord);
    const enriched = {
      ...summary,
      died: false,
      score: result.score,
      coinsEarned: result.coinsEarned,
      isNewHighScore: result.isNewHighScore,
      unlocked: result.unlocked,
      dailyNewBest: !!summaryForRecord.dailyNewBest
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

  _loadRunSnapshot() {
    const raw = this.save.loadRun?.();
    if (!raw || raw.dead || raw.victory) return null;
    // Refuse tampered signed saves — can otherwise resume past the free-floor gate.
    if (raw._tampered) {
      console.warn(LOG.CORE, 'refusing tampered run snapshot');
      this.save.clearRun?.();
      return null;
    }
    const migrated = this.save.migrate ? this.save.migrate(raw).data : raw;
    if (!migrated || typeof migrated.seed !== 'number') return null;
    if (migrated._tampered) {
      console.warn(LOG.CORE, 'refusing tampered migrated run snapshot');
      this.save.clearRun?.();
      return null;
    }
    return migrated;
  }

  static _runCard(snapshot) {
    return {
      canContinue: true,
      seed: snapshot.seed,
      mode: snapshot.mode || 'normal',
      floorIndex: snapshot.floorIndex || 0,
      level: snapshot.player?.level || 1,
      hp: snapshot.player?.stats?.hp,
      savedAt: snapshot.savedAt || Date.now()
    };
  }
}
