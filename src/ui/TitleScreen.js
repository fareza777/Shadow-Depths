/**
 * TitleScreen — first scene the player sees. Implements the Scene contract
 * (enter/render/handleInput).
 *
 * Buttons:
 *   New Run  — emit request:newRun
 *   Resume   — only shown if SaveManager has a run snapshot (v0.2+)
 *   Settings — toggle volume (v0.1 minimal)
 *   Controls — modal cheat-sheet
 */
import { COLOR, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config/constants.js';

const BUTTONS = [
  { id: 'newRun',   label: 'NEW RUN' },
  { id: 'controls', label: 'CONTROLS' },
  { id: 'settings', label: 'SETTINGS' }
];

export class TitleScreen {
  /**
   * @param {{ bus:object, state:object, content:object }} deps
   */
  constructor({ bus, state }) {
    this.bus = bus;
    this.state = state;
    this.selected = 0;
    this.modal = null; // 'controls' | 'settings' | null
    this._particles = TitleScreen._seedParticles();
    this._t = 0;
  }

  enter() {
    this.selected = 0;
    this.modal = null;
  }

  update(dt) {
    this._t += dt;
    for (const p of this._particles) {
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      if (p.y > CANVAS_HEIGHT) p.y = -4;
      if (p.x < 0) p.x = CANVAS_WIDTH;
      if (p.x > CANVAS_WIDTH) p.x = 0;
    }
  }

  render(renderer) {
    renderer.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, '#06060a');

    // drifting atmosphere particles
    for (const p of this._particles) {
      renderer.drawRect(p.x, p.y, p.size, p.size, p.color);
    }

    // Logo
    renderer.drawText('SHADOW DEPTHS', CANVAS_WIDTH / 2, 110,
      { size: 36, bold: true, align: 'center' });
    renderer.drawText('a melancholic descent', CANVAS_WIDTH / 2, 150,
      { size: 12, align: 'center', color: COLOR.textMuted });

    // High score
    const hs = this.state.state.meta.highscore || 0;
    if (hs > 0) {
      renderer.drawText(`High score: ${hs}`, CANVAS_WIDTH / 2, 175,
        { size: 11, align: 'center', color: COLOR.textXP });
    }

    // Buttons
    const baseY = 240;
    for (let i = 0; i < BUTTONS.length; i++) {
      const y = baseY + i * 48;
      const selected = i === this.selected;
      const w = 220, h = 36, x = (CANVAS_WIDTH - w) / 2;
      renderer.drawRect(x, y, w, h, selected ? '#2a2438' : '#16141c');
      renderer.drawStrokedRect(x, y, w, h, selected ? '#d6c87a' : '#3a3340', selected ? 2 : 1);
      renderer.drawText(BUTTONS[i].label, CANVAS_WIDTH / 2, y + 18,
        { size: 14, bold: true, align: 'center', baseline: 'middle' });
    }

    renderer.drawText('arrows + enter   ·   tap a button on mobile',
      CANVAS_WIDTH / 2, CANVAS_HEIGHT - 28,
      { size: 10, align: 'center', color: COLOR.textMuted });

    if (this.modal === 'controls') this._renderControls(renderer);
    else if (this.modal === 'settings') this._renderSettings(renderer);
  }

  handleInput(action) {
    if (this.modal) {
      if (action.type === 'escape' || action.type === 'confirm' || action.type === 'inventory') {
        this.modal = null;
      }
      return;
    }
    switch (action.type) {
      case 'move':
        if (action.dy === -1) this.selected = (this.selected + BUTTONS.length - 1) % BUTTONS.length;
        else if (action.dy === 1) this.selected = (this.selected + 1) % BUTTONS.length;
        break;
      case 'confirm':
        this._activate(BUTTONS[this.selected].id);
        break;
      case 'tap':
        if (typeof action.buttonIndex === 'number') {
          this.selected = action.buttonIndex;
          this._activate(BUTTONS[action.buttonIndex].id);
        }
        break;
    }
  }

  _activate(id) {
    if (id === 'newRun') this.bus.emit('request:newRun', {});
    else if (id === 'controls') this.modal = 'controls';
    else if (id === 'settings') this.modal = 'settings';
  }

  _renderControls(r) {
    const lines = [
      'CONTROLS',
      '',
      'Move:        Arrow keys / WASD / HJKL',
      'Wait:        . or Space',
      'Pickup:      G or Enter',
      'Descend:     >',
      'Inventory:   I or Tab',
      'Minimap:     M',
      'Hotkey:      1-9',
      '',
      'On touch screens, on-screen buttons appear automatically.'
    ];
    r.drawRect(80, 60, CANVAS_WIDTH - 160, CANVAS_HEIGHT - 120, 'rgba(0,0,0,0.92)');
    r.drawStrokedRect(80, 60, CANVAS_WIDTH - 160, CANVAS_HEIGHT - 120, '#3a3340', 1);
    for (let i = 0; i < lines.length; i++) {
      r.drawText(lines[i], CANVAS_WIDTH / 2, 92 + i * 22, {
        size: i === 0 ? 16 : 12, bold: i === 0, align: 'center',
        color: i === 0 ? '#d6c87a' : COLOR.textPrimary
      });
    }
    r.drawText('press any key to close', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 88,
      { size: 10, align: 'center', color: COLOR.textMuted });
  }

  _renderSettings(r) {
    const vol = Math.round((this.state.state.meta.settings.volume || 0) * 100);
    r.drawRect(120, 160, CANVAS_WIDTH - 240, 200, 'rgba(0,0,0,0.92)');
    r.drawStrokedRect(120, 160, CANVAS_WIDTH - 240, 200, '#3a3340', 1);
    r.drawText('SETTINGS', CANVAS_WIDTH / 2, 188, { size: 16, bold: true, align: 'center', color: '#d6c87a' });
    r.drawText(`Volume: ${vol}%`, CANVAS_WIDTH / 2, 230, { size: 13, align: 'center' });
    r.drawText('(volume tuning in v0.1 is global; settings expand in v0.4)',
      CANVAS_WIDTH / 2, 264, { size: 10, align: 'center', color: COLOR.textMuted });
    r.drawText('press any key to close', CANVAS_WIDTH / 2, 320,
      { size: 10, align: 'center', color: COLOR.textMuted });
  }

  /** Hit-test for touch taps. Returns 0-based button index or -1. */
  hitTest(x, y) {
    if (this.modal) return -1;
    const baseY = 240, w = 220, h = 36;
    const bx = (CANVAS_WIDTH - w) / 2;
    for (let i = 0; i < BUTTONS.length; i++) {
      const by = baseY + i * 48;
      if (x >= bx && x <= bx + w && y >= by && y <= by + h) return i;
    }
    return -1;
  }

  static _seedParticles() {
    const arr = [];
    for (let i = 0; i < 40; i++) {
      arr.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        vx: (Math.random() - 0.5) * 6,
        vy: 4 + Math.random() * 10,
        size: 1 + Math.floor(Math.random() * 2),
        color: ['#1a1830', '#26243a', '#1c1a28'][Math.floor(Math.random() * 3)]
      });
    }
    return arr;
  }
}
