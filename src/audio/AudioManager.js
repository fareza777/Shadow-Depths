/**
 * AudioManager — façade over SynthSFX.
 *
 * Web Audio requires a user-gesture to start; we defer AudioContext creation
 * until the first `play()` call (which is always behind a click/key/touch
 * because we don't autoplay anything). After init, all calls just schedule.
 *
 * Subscribes to game events on construction so combat code never imports
 * audio — keeping the "event bus = source of truth for cross-system glue"
 * pattern intact.
 *
 * v0.3 will add real files: AudioManager will gain a `.preload(map)` method,
 * and `_playByName` will check for a buffer before falling back to SynthSFX.
 */
import { LOG } from '../config/constants.js';
import { SynthSFX } from './SynthSFX.js';
import { AmbientBed } from './AmbientBed.js';
import { biomeIdForFloor } from '../rendering/biomeTiles.js';

export class AudioManager {
  /**
   * @param {{ bus:object, metaProgress:object }} deps
   */
  constructor({ bus, metaProgress }) {
    this.bus = bus;
    this.meta = metaProgress;
    this._ctx = null;
    this._master = null;
    this._muted = false;
    this._volume = metaProgress?.state?.settings?.volume ?? 0.6;
    this._ambient = null;
    this._ambientEnabled = metaProgress?.state?.settings?.ambient !== false;
    this._ambientBiome = 'forgotten_crypts';

    this._wireEvents();
  }

  _wireEvents() {
    this.bus.on('entity:attacked', ({ attacker, isCrit, isMiss }) => {
      if (isMiss) return;
      if (attacker?.kind === 'player') this.play(isCrit ? 'crit' : 'playerAttack');
      else this.play('hit');
      this._vibrate(isCrit ? [18, 24, 28] : 12);
    });
    this.bus.on('entity:damaged', ({ entity, source }) => {
      // Only synth for the player getting smacked; enemy hits already
      // played on attack. Avoids double-trigger.
      if (entity?.kind === 'player' && source && source !== 'status') {
        this.play('hit');
      }
    });
    this.bus.on('entity:died', () => this.play('death'));
    this.bus.on('entity:died', ({ entity }) => {
      if (entity?.defId?.startsWith?.('boss_')) this._vibrate([28, 34, 48]);
    });
    this.bus.on('entity:leveledUp', () => {
      this.play('levelUp');
      this._vibrate([18, 24, 18]);
    });
    this.bus.on('item:used', () => {
      this.play('drink');
      this._vibrate(10);
    });
    this.bus.on('item:pickedUp', ({ item }) => {
      this.play('pickup');
      this._vibrate(item?.rarity === 'epic' ? [16, 22, 28] : 8);
    });
    this.bus.on('entity:moved', ({ entity }) => {
      if (entity?.kind === 'player') this.play('footstep');
    });
    this.bus.on('floor:entered', ({ biomeId, index }) => {
      this.play('floorEntry');
      this._ambientBiome = biomeId || biomeIdForFloor(index || 0);
      this._startAmbient();
    });
    this.bus.on('settings:changed', ({ key, value }) => {
      if (key === 'volume') this.setVolume(value);
      else if (key === 'ambient') this.setAmbientEnabled(value);
    });
    // Atmosphere is for the dungeon only — silence it on menus / end screens.
    this.bus.on('scene:switched', ({ to }) => {
      if (to !== 'game') this._ambient?.stop();
    });
  }

  /** Lazily build + start the procedural ambient bed for the current biome. */
  _startAmbient() {
    if (this._muted || !this._ambientEnabled) return;
    if (!this._ensureCtx()) return;
    if (!this._ambient) this._ambient = new AmbientBed(this._ctx, this._master);
    this._ambient.start();
    this._ambient.setBiome(this._ambientBiome);
  }

  setAmbientEnabled(on) {
    this._ambientEnabled = on !== false;
    if (this._ambientEnabled) this._startAmbient();
    else this._ambient?.stop();
  }

  /**
   * Play a named sfx. Lazily inits the AudioContext on first call.
   * @param {keyof typeof SynthSFX} name
   */
  play(name) {
    if (this._muted) return;
    if (!this._ensureCtx()) return;
    const fn = SynthSFX[name];
    if (!fn) {
      console.warn(LOG.AUDIO, `unknown sfx "${name}"`);
      return;
    }
    try {
      fn(this._ctx, this._master);
    } catch (err) {
      console.warn(LOG.AUDIO, `sfx "${name}" failed:`, err);
    }
  }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._master) this._master.gain.value = this._volume;
  }
  setMuted(m) {
    this._muted = !!m;
    if (this._muted) this._ambient?.stop();
    else this._startAmbient();
  }
  toggleMuted() { this.setMuted(!this._muted); return this._muted; }

  _vibrate(pattern) {
    if (this.meta?.state?.settings?.vibration === false) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try { navigator.vibrate(pattern); } catch { /* unsupported gesture/device */ }
  }

  _ensureCtx() {
    if (this._ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      console.warn(LOG.AUDIO, 'Web Audio not supported');
      return false;
    }
    try {
      this._ctx = new AC();
      this._master = this._ctx.createGain();
      this._master.gain.value = this._volume;
      this._master.connect(this._ctx.destination);
      // Some browsers leave the context suspended until a gesture.
      if (this._ctx.state === 'suspended') {
        this._ctx.resume().catch(() => {/* ignored — next gesture will retry */});
      }
      return true;
    } catch (err) {
      console.warn(LOG.AUDIO, 'AudioContext init failed:', err);
      return false;
    }
  }

  /** Pause Web Audio when the app backgrounds (battery / Play Store hygiene). */
  suspend() {
    if (!this._ctx) return;
    try {
      if (this._ctx.state === 'running') this._ctx.suspend();
    } catch { /* ignore */ }
  }

  /** Resume Web Audio after foreground. */
  resume() {
    if (!this._ctx) return;
    try {
      if (this._ctx.state === 'suspended') this._ctx.resume();
    } catch { /* ignore */ }
  }
}
