/**
 * SynthSFX — pure Web Audio sound generators.
 *
 * Every function takes (audioContext, masterGain, opts?) and SCHEDULES the
 * sound to play immediately. No buffering, no preloading, zero assets.
 *
 * Each sound is shaped per Section 8.4 of the brief:
 *   footstep      — 50 ms low blip, small pitch variance
 *   playerAttack  — 80 ms sawtooth sweep (swoosh)
 *   hit           — 60 ms sine + noise thud
 *   crit          — 100 ms ascending sine + slight distortion
 *   pickup        — 120 ms two-note triangle chime
 *   levelUp       — 600 ms arpeggio celebration
 *   death         — 800 ms descending low sweep
 *   floorEntry    — 1000 ms single dramatic chord
 *   drink         — 180 ms bubbly downward glissando
 *
 * v0.3 replacement plan: each function becomes a one-line buffer playback
 * (`source.buffer = preloadedBuffer[name]`) — the AudioManager call site
 * stays identical.
 */

/** @typedef {{ ctx: AudioContext, master: GainNode }} SynthDeps */

export const SynthSFX = {
  footstep(ctx, master) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(70 + Math.random() * 20, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  },

  playerAttack(ctx, master) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  },

  hit(ctx, master) {
    const t = ctx.currentTime;
    // sine body
    const osc = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.06);
    g1.gain.setValueAtTime(0.35, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g1).connect(master);
    osc.start(t);
    osc.stop(t + 0.07);

    // noise click
    playNoiseBurst(ctx, master, 0.06, 0.15);
  },

  crit(ctx, master) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(40);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(660, t + 0.1);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(shaper).connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.13);
    // a hit underneath for body
    playNoiseBurst(ctx, master, 0.08, 0.2);
  },

  pickup(ctx, master) {
    const t = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.06);
      gain.gain.setValueAtTime(0, t + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.18, t + i * 0.06 + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.06);
      osc.connect(gain).connect(master);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.07);
    });
  },

  levelUp(ctx, master) {
    const t = ctx.currentTime;
    const arp = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    arp.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.13);
      gain.gain.setValueAtTime(0, t + i * 0.13);
      gain.gain.linearRampToValueAtTime(0.22, t + i * 0.13 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.13 + 0.18);
      osc.connect(gain).connect(master);
      osc.start(t + i * 0.13);
      osc.stop(t + i * 0.13 + 0.2);
    });
  },

  death(ctx, master) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.7);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.82);
  },

  floorEntry(ctx, master) {
    const t = ctx.currentTime;
    const chord = [110, 138.59, 164.81]; // A2, C#3, E3 (A minor)
    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 1.05);
    });
  },

  drink(ctx, master) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.18);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.21);
  }
};

// --- helpers ------------------------------------------------------------
function playNoiseBurst(ctx, master, duration, gainLevel) {
  const t = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = buf;
  gain.gain.setValueAtTime(gainLevel, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(gain).connect(master);
  src.start(t);
}

function makeDistortionCurve(amount) {
  const n = 256;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}
