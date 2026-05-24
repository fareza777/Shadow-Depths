/**
 * SaveManager — versioned localStorage I/O with migration pipeline.
 *
 * Why a schema version + migrations:
 *   v0.5 will add NPCs/dialogue and change the shape of `runState`. v0.7
 *   will add classes. Without versioning, players returning to the game
 *   after an update would see corrupt data or, worse, half-applied state
 *   that crashes mid-run. Migrations are append-only — once shipped, never
 *   modified, only added to.
 *
 * Storage keys (prefixed `shadowdepths_`):
 *   - meta        — meta-progression (highscore, unlocks, settings)
 *   - run         — in-progress run snapshot (resume after refresh)
 *   - save_version— integer schema version applied to current data
 */
import { STORAGE_PREFIX, SAVE_SCHEMA_VERSION, LOG } from '../config/constants.js';

const KEY_META    = `${STORAGE_PREFIX}meta`;
const KEY_RUN     = `${STORAGE_PREFIX}run`;
const KEY_VERSION = `${STORAGE_PREFIX}save_version`;

/**
 * Migration registry. Each function transforms data FROM the listed version
 * TO version+1. Add new migrations as new keys; never edit existing ones.
 *
 * Signature: (data) => migratedData
 */
const MIGRATIONS = {
  // 1: (data) => { data.unlocks ||= []; return data; }
  // 2: (data) => { ... }
};

export class SaveManager {
  constructor() {
    this.available = SaveManager._detect();
    if (!this.available) {
      console.warn(LOG.SAVE, 'localStorage unavailable — saves disabled this session');
    }
  }

  // --- meta -----------------------------------------------------------
  loadMeta() {
    return this._readJson(KEY_META);
  }

  saveMeta(meta) {
    this._writeJson(KEY_META, meta);
    this._writeJson(KEY_VERSION, SAVE_SCHEMA_VERSION);
  }

  // --- run snapshot (resume) ------------------------------------------
  loadRun() {
    return this._readJson(KEY_RUN);
  }

  saveRun(snapshot) {
    this._writeJson(KEY_RUN, snapshot);
    this._writeJson(KEY_VERSION, SAVE_SCHEMA_VERSION);
  }

  clearRun() {
    if (!this.available) return;
    try { localStorage.removeItem(KEY_RUN); }
    catch (err) { console.warn(LOG.SAVE, 'clearRun failed:', err); }
  }

  // --- migration ------------------------------------------------------
  /**
   * Run any pending migrations on the *given* payload. Caller passes the
   * payload it just read; this method does NOT touch storage itself, so
   * different namespaces (meta vs run) can share the version pipeline.
   *
   * @param {*} data
   * @returns {{ data:any, migrated:boolean, from:number, to:number }}
   */
  migrate(data) {
    const storedVersion = this._readJson(KEY_VERSION) ?? SAVE_SCHEMA_VERSION;
    let version = storedVersion;
    let migrated = false;
    let current = data;
    while (version < SAVE_SCHEMA_VERSION) {
      const fn = MIGRATIONS[version];
      if (typeof fn !== 'function') {
        console.warn(LOG.SAVE, `no migration registered for v${version} -> v${version + 1}; skipping`);
      } else {
        try {
          current = fn(current);
          migrated = true;
        } catch (err) {
          console.error(LOG.SAVE, `migration ${version}->${version + 1} threw:`, err);
          return { data: null, migrated: false, from: storedVersion, to: version };
        }
      }
      version += 1;
    }
    return { data: current, migrated, from: storedVersion, to: version };
  }

  // --- generic read/write (alias used by Game.js) ---------------------
  load(key) { return this._readJson(`${STORAGE_PREFIX}${key}`); }
  save(key, value) { this._writeJson(`${STORAGE_PREFIX}${key}`, value); }

  // --- internals ------------------------------------------------------
  static _detect() {
    try {
      const probe = '__shadowdepths_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  _readJson(key) {
    if (!this.available) return null;
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn(LOG.SAVE, `read failed for "${key}":`, err);
      return null;
    }
  }

  _writeJson(key, value) {
    if (!this.available) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(LOG.SAVE, `write failed for "${key}":`, err);
    }
  }
}
