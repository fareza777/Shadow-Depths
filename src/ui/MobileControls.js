/**
 * MobileControls — DOM overlay with D-pad + action buttons.
 *
 * Auto-shows when `'ontouchstart' in window` OR when the viewport is too
 * narrow for comfortable mouse play. Buttons emit semantic input actions via
 * the bus so they share the input pipeline with the keyboard handler.
 *
 * Buttons are min 48×48 dp (Android accessibility) per Section 9.3 brief.
 */
export class MobileControls {
  /**
   * @param {{ bus:object, mount?:HTMLElement }} deps
   */
  constructor({ bus, mount }) {
    this.bus = bus;
    this.mount = mount || document.getElementById('ui-layer') || document.body;
    this.enabled = false;
    this._root = null;
    this._currentScene = 'title';

    // Auto-detect.
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

  // --- DOM construction ----------------------------------------------
  _build() {
    const root = document.createElement('div');
    root.id = 'mobile-controls';
    root.style.cssText = `
      position: absolute; inset: 0; pointer-events: none;
      font-family: 'Courier New', monospace;
    `;

    // D-pad bottom-left.
    const dpad = this._mkDpad();
    root.appendChild(dpad);

    // Action stack bottom-right.
    const actions = this._mkActions();
    root.appendChild(actions);

    this.mount.appendChild(root);
    this._root = root;
  }

  _mkDpad() {
    const pad = document.createElement('div');
    pad.style.cssText = `
      position: absolute; left: 12px; bottom: 12px;
      display: grid;
      grid-template-columns: 56px 56px 56px;
      grid-template-rows: 56px 56px 56px;
      gap: 4px;
      pointer-events: auto;
      opacity: 0.55;
    `;
    const empty = () => { const d = document.createElement('div'); return d; };
    pad.appendChild(empty());
    pad.appendChild(this._mkBtn('▲', () => this._emit({ type: 'move', dx: 0, dy: -1 })));
    pad.appendChild(empty());
    pad.appendChild(this._mkBtn('◀', () => this._emit({ type: 'move', dx: -1, dy: 0 })));
    pad.appendChild(this._mkBtn('·', () => this._emit({ type: 'wait' })));
    pad.appendChild(this._mkBtn('▶', () => this._emit({ type: 'move', dx: 1, dy: 0 })));
    pad.appendChild(empty());
    pad.appendChild(this._mkBtn('▼', () => this._emit({ type: 'move', dx: 0, dy: 1 })));
    pad.appendChild(empty());
    return pad;
  }

  _mkActions() {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position: absolute; right: 12px; bottom: 12px;
      display: flex; flex-direction: column; gap: 6px;
      pointer-events: auto; opacity: 0.85;
    `;
    wrap.appendChild(this._mkBtn('PICK', () => this._emit({ type: 'pickup' }), 64));
    wrap.appendChild(this._mkBtn('DOWN', () => this._emit({ type: 'descend' }), 64));
    wrap.appendChild(this._mkBtn('BAG', () => this._emit({ type: 'inventory' }), 64));
    return wrap;
  }

  _mkBtn(label, onTap, w = 56) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `
      width: ${w}px; height: 48px; min-width: 48px;
      background: #1a1820; color: #d6d6da;
      border: 1px solid #3a3340; border-radius: 6px;
      font: bold 14px "Courier New", monospace;
      touch-action: manipulation; user-select: none;
      transform-origin: center; transition: transform 60ms;
    `;
    // Touch & mouse — fire on press-down, not click, for responsiveness.
    const fire = (ev) => {
      ev.preventDefault();
      b.style.transform = 'scale(0.92)';
      setTimeout(() => { b.style.transform = ''; }, 80);
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
    // On title/gameover/victory, dim the action stack — only D-pad nav matters.
    const inGame = this._currentScene === 'game';
    const actionsEl = this._root.children[1];
    if (actionsEl) actionsEl.style.opacity = inGame ? '0.85' : '0.25';
  }
}
