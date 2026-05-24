/**
 * MobileControls — canvas-painted control band at the bottom of the canvas.
 *
 * v0.2.1 design: previously DOM-overlayed (D-pad + action buttons floating
 * absolutely positioned via CSS). That caused two problems:
 *   1. DOM `bottom: 12px` sat at the SCREEN edge, not at the canvas edge,
 *      so on phones where canvas didn't fill the viewport the buttons
 *      floated in body background.
 *   2. When canvas did fill the viewport, buttons covered the play area.
 *
 * Painting into the canvas at fixed VIEWPORT coords solves both: the
 * buttons sit pixel-perfect on the control band area which the world
 * rendering is clipped out of.
 *
 * Layout (CANVAS_WIDTH × CONTROL_HEIGHT band at the bottom):
 *
 *   ┌──────────┬─────────────┬──────────┐
 *   │  D-PAD   │    MAP      │ ACTIONS  │
 *   │  (4 dir  │  + messages │  PICK    │
 *   │  + wait) │             │  DOWN    │
 *   │          │             │  BAG     │
 *   └──────────┴─────────────┴──────────┘
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, CONTROL_HEIGHT, COLOR
} from '../config/constants.js';

const BAND_Y = CANVAS_HEIGHT - CONTROL_HEIGHT;

// D-pad: 3×3 grid on the left.
const DPAD_PAD = 8;
const DPAD_BTN = 52;
const DPAD_GAP = 4;
const DPAD_SIZE = DPAD_BTN * 3 + DPAD_GAP * 2;       // 164
const DPAD_X = DPAD_PAD;
const DPAD_Y = BAND_Y + (CONTROL_HEIGHT - DPAD_SIZE) / 2;

// Action stack: 3 buttons stacked on the right.
const ACT_PAD = 8;
const ACT_W = 72;
const ACT_H = 48;
const ACT_GAP = 6;
const ACT_STACK_H = ACT_H * 3 + ACT_GAP * 2;         // 156
const ACT_X = CANVAS_WIDTH - ACT_W - ACT_PAD;
const ACT_Y = BAND_Y + (CONTROL_HEIGHT - ACT_STACK_H) / 2;

const ACTION_LABELS = [
  { key: 'pickup',    label: 'PICK' },
  { key: 'descend',   label: 'DOWN' },
  { key: 'inventory', label: 'BAG'  }
];

// D-pad button definitions: {dx, dy, label, action}. 5 buttons (4 dir + wait).
const DPAD_BUTTONS = [
  { col: 1, row: 0, label: '▲', emit: { type: 'move', dx: 0, dy: -1 } },
  { col: 0, row: 1, label: '◀', emit: { type: 'move', dx: -1, dy: 0 } },
  { col: 1, row: 1, label: '·', emit: { type: 'wait' } },
  { col: 2, row: 1, label: '▶', emit: { type: 'move', dx: 1, dy: 0 } },
  { col: 1, row: 2, label: '▼', emit: { type: 'move', dx: 0, dy: 1 } }
];

export class MobileControls {
  /** @param {{ bus: object }} deps */
  constructor({ bus }) {
    this.bus = bus;
    this.enabled = true;
    this._currentScene = 'title';
    this._pressedKey = null;       // for tap-flash feedback
    this._pressedClearedAt = 0;

    bus.on('scene:switched', ({ to }) => { this._currentScene = to; });
    // Clear flash after a short delay each tick.
    bus.on('tick', ({ time }) => {
      if (this._pressedKey && time > this._pressedClearedAt) {
        this._pressedKey = null;
      }
    });
  }

  /** Called by GameScene each frame. */
  render(renderer) {
    if (this._currentScene !== 'game') return;
    this._renderBand(renderer);
    this._renderDpad(renderer);
    this._renderActions(renderer);
  }

  /**
   * Touch / mouse tap. Returns true if a button was hit so the GameScene
   * doesn't also interpret the tap as a move-to-tile.
   */
  handleTap(canvasX, canvasY, currentTime) {
    if (this._currentScene !== 'game') return false;

    // D-pad hit-test.
    for (const b of DPAD_BUTTONS) {
      const bx = DPAD_X + b.col * (DPAD_BTN + DPAD_GAP);
      const by = DPAD_Y + b.row * (DPAD_BTN + DPAD_GAP);
      if (canvasX >= bx && canvasX <= bx + DPAD_BTN &&
          canvasY >= by && canvasY <= by + DPAD_BTN) {
        this._flash(`dpad:${b.col},${b.row}`, currentTime);
        this.bus.emit('input:action', b.emit);
        return true;
      }
    }

    // Action stack hit-test.
    for (let i = 0; i < ACTION_LABELS.length; i++) {
      const ax = ACT_X;
      const ay = ACT_Y + i * (ACT_H + ACT_GAP);
      if (canvasX >= ax && canvasX <= ax + ACT_W &&
          canvasY >= ay && canvasY <= ay + ACT_H) {
        this._flash(`act:${i}`, currentTime);
        this.bus.emit('input:action', { type: ACTION_LABELS[i].key });
        return true;
      }
    }

    return false;
  }

  _flash(key, time) {
    this._pressedKey = key;
    this._pressedClearedAt = (time ?? performance.now() / 1000) + 0.12;
  }

  // --- canvas drawing ----------------------------------------------
  _renderBand(r) {
    // Solid background separates control band from world visually.
    r.drawRect(0, BAND_Y, CANVAS_WIDTH, CONTROL_HEIGHT, '#08080c');
    r.drawRect(0, BAND_Y, CANVAS_WIDTH, 1, '#2a2530'); // hairline divider
  }

  _renderDpad(r) {
    for (const b of DPAD_BUTTONS) {
      const bx = DPAD_X + b.col * (DPAD_BTN + DPAD_GAP);
      const by = DPAD_Y + b.row * (DPAD_BTN + DPAD_GAP);
      const pressed = this._pressedKey === `dpad:${b.col},${b.row}`;
      const bg = pressed ? '#3a3548' : '#1a1820';
      const border = pressed ? '#d6c87a' : '#3a3340';
      r.drawRect(bx, by, DPAD_BTN, DPAD_BTN, bg);
      r.drawStrokedRect(bx, by, DPAD_BTN, DPAD_BTN, border, pressed ? 2 : 1);
      r.drawText(b.label, bx + DPAD_BTN / 2, by + DPAD_BTN / 2,
        { size: 22, bold: true, align: 'center', baseline: 'middle' });
    }
  }

  _renderActions(r) {
    for (let i = 0; i < ACTION_LABELS.length; i++) {
      const ax = ACT_X;
      const ay = ACT_Y + i * (ACT_H + ACT_GAP);
      const pressed = this._pressedKey === `act:${i}`;
      const bg = pressed ? '#3a3548' : '#1a1820';
      const border = pressed ? '#d6c87a' : '#3a3340';
      r.drawRect(ax, ay, ACT_W, ACT_H, bg);
      r.drawStrokedRect(ax, ay, ACT_W, ACT_H, border, pressed ? 2 : 1);
      r.drawText(ACTION_LABELS[i].label, ax + ACT_W / 2, ay + ACT_H / 2,
        { size: 14, bold: true, align: 'center', baseline: 'middle',
          color: COLOR.textPrimary });
    }
  }

  /** Geometry exposed so siblings (Minimap, MessageLog) can avoid overlap. */
  static get geometry() {
    return {
      bandY: BAND_Y,
      bandH: CONTROL_HEIGHT,
      dpadRect: { x: DPAD_X, y: DPAD_Y, w: DPAD_SIZE, h: DPAD_SIZE },
      actionRect: { x: ACT_X, y: ACT_Y, w: ACT_W, h: ACT_STACK_H },
      centerRect: {
        x: DPAD_X + DPAD_SIZE + 12,
        y: BAND_Y + 8,
        w: ACT_X - (DPAD_X + DPAD_SIZE) - 24,
        h: CONTROL_HEIGHT - 16
      }
    };
  }
}
