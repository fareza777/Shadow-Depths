/**
 * MobileControls — DOM overlay with action verb buttons only.
 *
 * v0.2 design notes: the D-pad was removed because it covered too much of
 * the play area on portrait phones. Movement is done by **tap-to-walk** on
 * the canvas (handled in GameScene._playerTapTile). Action verbs that have
 * no direction stay as DOM buttons because they're easier to tap than
 * remembering a gesture vocabulary:
 *
 *   PICK  — pick up item under foot
 *   DOWN  — descend stairs
 *   WAIT  — skip a turn (lets DoTs tick, lets buff/debuff expire)
 *   BAG   — open inventory modal
 *
 * Buttons are at min 48 × 48 dp per Android accessibility. Auto-shown when
 * a touch input is detected; desktop users get them too as redundant UI
 * (harmless and serves mouse-only laptop testing).
 */
export class MobileControls {
  /** @param {{ bus:object, mount?:HTMLElement }} deps */
  constructor({ bus, mount }) {
    this.bus = bus;
    this.mount = mount || document.getElementById('ui-layer') || document.body;
    this.enabled = false;
    this._root = null;
    this._currentScene = 'title';

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) this.show();

    bus.on('scene:switched', ({ to }) => {
      this._currentScene = to;
      this._applySceneStyling();
    });
  }

  show() {
    if (this._root) { this._root.style.display = 'block'; this.enabled = true; return; }
    this._build();
    this.enabled = true;
  }
  hide() {
    if (this._root) this._root.style.display = 'none';
    this.enabled = false;
  }

  // --- DOM construction ---------------------------------------------
  _build() {
    const root = document.createElement('div');
    root.id = 'mobile-controls';
    root.style.cssText = `
      position: absolute; inset: 0; pointer-events: none;
      font-family: 'Courier New', monospace;
    `;
    root.appendChild(this._mkActionRow());
    this.mount.appendChild(root);
    this._root = root;
  }

  _mkActionRow() {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position: absolute;
      left: 0; right: 0; bottom: 12px;
      display: flex; justify-content: center; gap: 8px;
      padding: 0 12px;
      pointer-events: auto;
    `;
    wrap.appendChild(this._mkBtn('WAIT', () => this._emit({ type: 'wait' })));
    wrap.appendChild(this._mkBtn('PICK', () => this._emit({ type: 'pickup' })));
    wrap.appendChild(this._mkBtn('DOWN', () => this._emit({ type: 'descend' })));
    wrap.appendChild(this._mkBtn('BAG',  () => this._emit({ type: 'inventory' })));
    return wrap;
  }

  _mkBtn(label, onTap) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `
      flex: 1 1 auto; max-width: 96px;
      height: 52px; min-width: 64px;
      background: rgba(26,24,32,0.88); color: #d6d6da;
      border: 1px solid #3a3340; border-radius: 8px;
      font: bold 13px "Courier New", monospace;
      letter-spacing: 0.5px;
      touch-action: manipulation; user-select: none;
      transform-origin: center; transition: transform 60ms, background 60ms;
      backdrop-filter: blur(2px);
    `;
    const fire = (ev) => {
      ev.preventDefault();
      b.style.transform = 'scale(0.92)';
      b.style.background = 'rgba(58,52,64,0.95)';
      setTimeout(() => {
        b.style.transform = '';
        b.style.background = 'rgba(26,24,32,0.88)';
      }, 100);
      try { onTap(); } catch (err) { console.warn('[MobileControls] btn handler:', err); }
    };
    b.addEventListener('touchstart', fire, { passive: false });
    b.addEventListener('mousedown', fire);
    return b;
  }

  _emit(action) {
    this.bus.emit('input:action', action);
  }

  _applySceneStyling() {
    if (!this._root) return;
    // Hide entirely on title / gameover / victory — those scenes have their
    // own buttons drawn inside the canvas.
    const inGame = this._currentScene === 'game';
    this._root.style.display = inGame ? 'block' : 'none';
  }
}
