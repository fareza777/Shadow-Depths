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

const SIG_FIELD = '__sig';
const SIG_SALT  = 'shadow-depths-v1';

/**
 * FNV-1a 32-bit hash — fast, dependency-free, sufficient for tamper
 * detection on a single device. Not cryptographic; treat the result as
 * "integrity hint", not "anti-cheat".
 */
function fnv1a(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

/** Compute the signature of a payload (excluding any existing __sig field). */
function signPayload(payload) {
  if (payload == null) return null;
  const clean = { ...payload };
  delete clean[SIG_FIELD];
  return fnv1a(SIG_SALT + JSON.stringify(clean));
}

/**
 * Migration registry. Each function transforms data FROM the listed version
 * TO version+1. Add new migrations as new keys; never edit existing ones.
 *
 * Signature: (data) => migratedData
 */
const MIGRATIONS = {
  // v1 → v2: add Play Store premium entitlement fields.
  1: (data) => {
    if (!data || typeof data !== 'object') return data;
    if (data.premiumUnlocked === undefined) data.premiumUnlocked = false;
    if (data.premiumUnlockedAt === undefined) data.premiumUnlockedAt = null;
    if (data.premiumSource === undefined) data.premiumSource = null;
    return data;
  }
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
    return this._readSigned(KEY_META);
  }

  saveMeta(meta) {
    this._writeSigned(KEY_META, meta);
    this._writeJson(KEY_VERSION, SAVE_SCHEMA_VERSION);
  }

  // --- run snapshot (resume) ------------------------------------------
  loadRun() {
    return this._readSigned(KEY_RUN);
  }

  saveRun(snapshot) {
    this._writeSigned(KEY_RUN, snapshot);
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

  /**
   * Write a payload with an integrity signature. The __sig field is set
   * from the JSON of everything else; tampering with stats / coins in
   * devtools invalidates it.
   */
  _writeSigned(key, value) {
    if (!this.available || value == null) return;
    const signed = { ...value, [SIG_FIELD]: signPayload(value) };
    this._writeJson(key, signed);
  }

  /**
   * Read + verify a signed payload. Returns the data even if the signature
   * doesn't match — but marks `_tampered: true` so the caller can choose
   * to refuse to load it. We never throw / crash on bad data: the player's
   * progress beats strict integrity.
   */
  _readSigned(key) {
    const raw = this._readJson(key);
    if (raw == null) return null;
    if (!(SIG_FIELD in raw)) {
      // Legacy save written before signing existed — accept silently.
      return raw;
    }
    const expected = raw[SIG_FIELD];
    const actual = signPayload(raw);
    if (expected !== actual) {
      console.warn(LOG.SAVE, `tampered save detected at "${key}"`);
      raw._tampered = true;
    }
    return raw;
  }
}
