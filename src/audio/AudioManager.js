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

const EVENT_TO_SFX = {
  'audio:play': null, // generic — payload.name
};

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

    this._wireEvents();
  }

  _wireEvents() {
    this.bus.on('entity:attacked', ({ attacker, isCrit, isMiss }) => {
      if (isMiss) return;
      if (attacker?.kind === 'player') this.play(isCrit ? 'crit' : 'playerAttack');
      else this.play('hit');
    });
    this.bus.on('entity:damaged', ({ entity, source }) => {
      // Only synth for the player getting smacked; enemy hits already
      // played on attack. Avoids double-trigger.
      if (entity?.kind === 'player' && source && source !== 'status') {
        this.play('hit');
      }
    });
    this.bus.on('entity:died', () => this.play('death'));
    this.bus.on('entity:leveledUp', () => this.play('levelUp'));
    this.bus.on('item:used', () => this.play('drink'));
    this.bus.on('item:pickedUp', () => this.play('pickup'));
    this.bus.on('entity:moved', ({ entity }) => {
      if (entity?.kind === 'player') this.play('footstep');
    });
    this.bus.on('floor:entered', () => this.play('floorEntry'));
    this.bus.on('settings:changed', ({ key, value }) => {
      if (key === 'volume') this.setVolume(value);
    });
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
  setMuted(m) { this._muted = !!m; }
  toggleMuted() { this._muted = !this._muted; return this._muted; }

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
}
