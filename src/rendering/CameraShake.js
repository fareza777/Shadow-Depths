/**
 * CameraShake — additive impulses, decays toward zero.
 *
 * Multiple shakes overlap (e.g. crit-hit while a bomb is going off). The
 * renderer queries `offset()` once per frame and translates the world by it.
 *
 * Intensity unit: pixels of max displacement.
 */
import { TIMING } from '../config/constants.js';

export class CameraShake {
  constructor() {
    this._intensity = 0;
    this._remaining = 0;
    this._duration = 1;
  }

  /**
   * @param {number} intensity max px
   * @param {number} [durationMs] defaults to TIMING.cameraShakeShort
   */
  trigger(intensity, durationMs = TIMING.cameraShakeShort) {
    // Additive so successive shakes feel meatier without clipping.
    if (intensity > this._intensity) this._intensity = intensity;
    else this._intensity += intensity * 0.4;
    this._remaining = durationMs / 1000;
    this._duration  = this._remaining;
  }

  /** @param {number} dt seconds */
  update(dt) {
    if (this._remaining <= 0) {
      this._intensity = 0;
      return;
    }
    this._remaining = Math.max(0, this._remaining - dt);
  }

  /** Current decay-weighted intensity. */
  _currentIntensity() {
    if (this._remaining <= 0) return 0;
    const t = this._remaining / this._duration; // 1 -> 0
    return this._intensity * t;
  }

  /** Random offset for this frame. */
  offset() {
    const i = this._currentIntensity();
    if (i <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() * 2 - 1) * i,
      y: (Math.random() * 2 - 1) * i
    };
  }

  reset() {
    this._intensity = 0;
    this._remaining = 0;
  }
}
