/**
 * TouchHandler — canvas-tap routing.
 *
 * Mobile primary input is MobileControls (DOM buttons). This handler covers:
 *   - Title / Game-Over / Victory screens — tap a button rectangle.
 *   - Game scene — tap a tile to move toward / attack it. (Bonus QoL for
 *     desktop mouse users too.)
 *
 * Maps screen coords → canvas coords accounting for the CSS scale factor.
 */
import { Layout } from '../config/layoutMetrics.js';

export class TouchHandler {
  /**
   * @param {{ bus:object, canvas:HTMLCanvasElement, sceneManager:object }} deps
   */
  constructor({ bus, canvas, sceneManager }) {
    this.bus = bus;
    this.canvas = canvas;
    this.scenes = sceneManager;
    this._onPointer = this._onPointer.bind(this);
    canvas.addEventListener('pointerdown', this._onPointer);
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._onPointer);
  }

  _onPointer(ev) {
    const { x, y } = this._toCanvas(ev);
    const scene = this.scenes.current;

    if (typeof scene?.hitTest === 'function') {
      const idx = scene.hitTest(x, y);
      const isHit = typeof idx === 'number' ? idx >= 0 : typeof idx === 'string' && idx.length > 0;
      if (isHit) {
        this.bus.emit('input:action', { type: 'tap', buttonIndex: idx });
        return;
      }
    }

    // Always emit a raw pointer fallback so any scene that needs precise
    // coordinates (e.g. CharacterSelect carousel, GameScene tap-to-walk)
    // can handle it. Previously this was gated to 'game' only, which
    // silently dropped every tap on the title's CharacterSelect modal.
    this.bus.emit('input:action', { type: 'pointer', x, y });
  }

  _toCanvas(ev) {
    const rect = this.canvas.getBoundingClientRect();
    // Map to LOGICAL canvas coords (CSS px), not the HiDPI backing store —
    // all scene hit-testing works in logical space. Using canvas.width here
    // would scale taps by the device pixel ratio and misplace them.
    const sx = Layout.canvasW / rect.width;
    const sy = Layout.canvasH / rect.height;
    return {
      x: (ev.clientX - rect.left) * sx,
      y: (ev.clientY - rect.top)  * sy
    };
  }
}
