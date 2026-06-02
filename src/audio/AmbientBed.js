/**
 * AmbientBed — procedural atmosphere for the descent (no music, no files).
 *
 * A continuous, low-level bed synthesised entirely from Web Audio primitives:
 *   • a brown-noise cave drone shaped by a slow-breathing lowpass filter,
 *   • two detuned sub-sines for a hollow underground hum,
 *   • randomly-scheduled water drips (with a faint cave echo) or, in fiery
 *     biomes, ember crackle, plus occasional wind gusts and, in the eerie
 *     biomes, a high detuned shimmer.
 *
 * Everything re-themes per biome (cutoff, drone pitch, drip cadence, mode), so
 * the Frozen Halls breathe airy wind while the Magma Foundry roars and crackles
 * — all from the same handful of nodes. Routed through the AudioManager master
 * gain, so the existing volume / mute controls apply.
 */

// Per-biome character. gains are intentionally low — this is atmosphere, not
// a soundtrack. mode 'drip' = water plinks, 'ember' = crackle pops.
const BIOME_AMB = {
  forgotten_crypts:  { cutoff: 360, droneHz: 52, droneGain: 0.06, drip: [2600, 6000], dripHz: [520, 900], gust: [9000, 16000], gustGain: 0.05, mode: 'drip' },
  bone_garden:       { cutoff: 520, droneHz: 48, droneGain: 0.05, drip: [5000, 11000], dripHz: [300, 520], gust: [6000, 12000], gustGain: 0.07, mode: 'drip' },
  frozen_halls:      { cutoff: 900, droneHz: 60, droneGain: 0.04, drip: [7000, 15000], dripHz: [1100, 1700], gust: [4500, 9000], gustGain: 0.09, mode: 'drip', shimmer: true },
  sunken_forest:     { cutoff: 600, droneHz: 46, droneGain: 0.05, drip: [1600, 4200], dripHz: [600, 1100], gust: [8000, 15000], gustGain: 0.05, mode: 'drip' },
  iron_stronghold:   { cutoff: 300, droneHz: 41, droneGain: 0.08, drip: [6000, 13000], dripHz: [180, 320], gust: [10000, 18000], gustGain: 0.04, mode: 'drip' },
  sun_cursed_sands:  { cutoff: 1100, droneHz: 50, droneGain: 0.03, drip: [9000, 18000], dripHz: [800, 1300], gust: [3500, 7500], gustGain: 0.10, mode: 'drip' },
  mirror_vaults:     { cutoff: 800, droneHz: 58, droneGain: 0.04, drip: [4000, 9000], dripHz: [1000, 1900], gust: [9000, 16000], gustGain: 0.04, mode: 'drip', shimmer: true },
  magma_foundry:     { cutoff: 280, droneHz: 38, droneGain: 0.09, drip: [1400, 3400], dripHz: [90, 200], gust: [7000, 13000], gustGain: 0.06, mode: 'ember' },
  drowned_catacombs: { cutoff: 340, droneHz: 44, droneGain: 0.07, drip: [1200, 3000], dripHz: [420, 780], gust: [9000, 16000], gustGain: 0.05, mode: 'drip' },
  void_sanctum:      { cutoff: 700, droneHz: 36, droneGain: 0.05, drip: [6000, 13000], dripHz: [1400, 2200], gust: [8000, 15000], gustGain: 0.05, mode: 'drip', shimmer: true }
};

export class AmbientBed {
  /**
   * @param {AudioContext} ctx
   * @param {AudioNode} dest  master gain to route into
   */
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    this._running = false;
    this._timers = [];
    this._persist = [];
    this._biome = '';
    this._params = BIOME_AMB.forgotten_crypts;
    this._noiseBuf = this._makeNoise(2.4);
  }

  /** Brown-ish noise buffer (looped for the drone + reused for gusts). */
  _makeNoise(seconds) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    return buf;
  }

  start() {
    if (this._running) return;
    this._running = true;
    const ctx = this.ctx;

    // --- drone bed: brown noise → breathing lowpass ---
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = this._params.cutoff;
    lp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.value = 0.5;
    noise.connect(lp); lp.connect(ng); ng.connect(this.out);
    noise.start();
    this._lp = lp;

    // --- hollow sub hum: two detuned sines ---
    const oscG = ctx.createGain();
    oscG.gain.value = this._params.droneGain;
    oscG.connect(this.out);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = this._params.droneHz;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = this._params.droneHz * 1.008;
    o1.connect(oscG); o2.connect(oscG); o1.start(); o2.start();
    this._o1 = o1; this._o2 = o2; this._oscG = oscG;

    // --- slow breathing LFO on the filter cutoff ---
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.06;
    const lfoG = ctx.createGain(); lfoG.gain.value = 90;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();

    this._persist.push(noise, o1, o2, lfo);

    const now = ctx.currentTime;
    this.out.gain.setValueAtTime(0, now);
    this.out.gain.linearRampToValueAtTime(0.85, now + 4);

    this._scheduleDrip();
    this._scheduleGust();
    if (this._params.shimmer) this._scheduleShimmer();
  }

  setBiome(id) {
    const p = BIOME_AMB[id] || BIOME_AMB.forgotten_crypts;
    const changedShimmer = p.shimmer && this._params && !this._params.shimmer;
    this._biome = id;
    this._params = p;
    if (!this._running) return;
    const now = this.ctx.currentTime;
    this._lp?.frequency.setTargetAtTime(p.cutoff, now, 1.5);
    this._o1?.frequency.setTargetAtTime(p.droneHz, now, 1.5);
    this._o2?.frequency.setTargetAtTime(p.droneHz * 1.008, now, 1.5);
    this._oscG?.gain.setTargetAtTime(p.droneGain, now, 1.5);
    if (changedShimmer) this._scheduleShimmer();
  }

  setGain(v) {
    if (!this._running) return;
    this.out.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.4);
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(0, now, 0.5);
    for (const id of this._timers) clearTimeout(id);
    this._timers = [];
    for (const n of this._persist) { try { n.stop(now + 1.2); } catch { /* already stopped */ } }
    this._persist = [];
    this._lp = this._o1 = this._o2 = this._oscG = null;
  }

  // --- scheduled one-shots --------------------------------------------
  _later(fn, ms) {
    const id = setTimeout(() => {
      this._timers = this._timers.filter((t) => t !== id);
      if (this._running) fn();
    }, ms);
    this._timers.push(id);
  }

  _scheduleDrip() {
    if (!this._running) return;
    const [lo, hi] = this._params.drip;
    this._later(() => {
      if (this._params.mode === 'ember') this._ember(); else this._drip();
      this._scheduleDrip();
    }, lo + Math.random() * (hi - lo));
  }

  _drip() {
    const ctx = this.ctx; const now = ctx.currentTime;
    const [lo, hi] = this._params.dripHz;
    const f = lo + Math.random() * (hi - lo);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.7, now);
    o.frequency.exponentialRampToValueAtTime(f, now + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.13, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    // faint cave echo
    const dly = ctx.createDelay(); dly.delayTime.value = 0.19;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    o.connect(g); g.connect(this.out);
    g.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(this.out);
    o.start(now); o.stop(now + 0.6);
  }

  _ember() {
    // a small cluster of crackle pops
    const ctx = this.ctx;
    const pops = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pops; i++) {
      const t = ctx.currentTime + i * (0.03 + Math.random() * 0.06);
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuf;
      src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.6;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 1400 + Math.random() * 1800; bp.Q.value = 2.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.05, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.05);
      src.connect(bp); bp.connect(g); g.connect(this.out);
      src.start(t); src.stop(t + 0.16);
    }
  }

  _scheduleGust() {
    if (!this._running) return;
    const [lo, hi] = this._params.gust;
    this._later(() => { this._gust(); this._scheduleGust(); }, lo + Math.random() * (hi - lo));
  }

  _gust() {
    const ctx = this.ctx; const now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 500 + Math.random() * 700; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    src.connect(bp); bp.connect(g); g.connect(this.out);
    const peak = this._params.gustGain;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + 1.6);
    g.gain.linearRampToValueAtTime(0.0001, now + 3.6);
    src.start(now); src.stop(now + 3.8);
  }

  _scheduleShimmer() {
    if (!this._running || !this._params.shimmer) return;
    this._later(() => { this._shimmer(); this._scheduleShimmer(); }, 7000 + Math.random() * 11000);
  }

  _shimmer() {
    const ctx = this.ctx; const now = ctx.currentTime;
    const base = 760 + Math.random() * 700;
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(this.out);
    const a = ctx.createOscillator(); a.type = 'sine'; a.frequency.value = base;
    const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = base * 1.004;
    a.connect(g); b.connect(g);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.035, now + 1.8);
    g.gain.linearRampToValueAtTime(0.0001, now + 4.5);
    a.start(now); b.start(now); a.stop(now + 4.8); b.stop(now + 4.8);
  }
}
