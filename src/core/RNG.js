/**
 * Seeded RNG (mulberry32). Reproducibility is critical for:
 *   - debugging ("re-run seed 12345 to see the bug again")
 *   - the daily seed feature (v0.4)
 *   - save/load determinism if we ever replay a turn log
 *
 * Each system (dungeon gen, combat, loot) gets its *own* RNG instance forked
 * off the run seed. Otherwise calling `Math.random()` in render code (e.g.
 * particle jitter) would desync gameplay rolls.
 */

/**
 * @param {number} seed 32-bit unsigned integer
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mixes string into a 32-bit integer (xfnv1a). Used so users can type
 * "spooky" as a seed and get a deterministic number.
 * @param {string} str
 */
function hashStringToSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class RNG {
  /**
   * @param {number|string} seed
   * @param {string} [label] for debug logging
   */
  constructor(seed, label = 'rng') {
    this.label = label;
    this.seed = typeof seed === 'string' ? hashStringToSeed(seed) : (seed >>> 0);
    this._next = mulberry32(this.seed);
    this._calls = 0;
  }

  /** Float in [0, 1). */
  random() {
    this._calls++;
    return this._next();
  }

  /** Integer in [min, max] inclusive. */
  randInt(min, max) {
    if (max < min) [min, max] = [max, min];
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /** Float in [min, max). */
  randFloat(min, max) {
    return this.random() * (max - min) + min;
  }

  /** Pick a random element from a non-empty array. */
  pick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(this.random() * arr.length)];
  }

  /**
   * Weighted pick. Items shape: [{ value, weight }]. Returns the chosen value.
   */
  weightedPick(weighted) {
    if (!weighted || weighted.length === 0) return undefined;
    let total = 0;
    for (const w of weighted) total += w.weight;
    if (total <= 0) return undefined;
    let roll = this.random() * total;
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) return w.value;
    }
    return weighted[weighted.length - 1].value;
  }

  /** Boolean true with probability p (0..1). */
  chance(p) {
    return this.random() < p;
  }

  /**
   * Fisher-Yates shuffle (returns a new array; does not mutate input).
   */
  shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /**
   * Fork a child RNG with a derived seed. Use to isolate subsystem rolls.
   */
  fork(label) {
    const childSeed = (Math.imul(this.seed ^ 0x9E3779B1, this._calls + 1) >>> 0) || 1;
    return new RNG(childSeed, `${this.label}/${label}`);
  }

  /** Generate a fresh user-facing run seed from `Date.now()`. */
  static newSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
  }
}
