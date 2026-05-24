/**
 * MobileControls — canvas-painted controls.
 *
 * Two layouts share the same hit-test code; the only difference is where
 * each region (D-pad / actions / center cutout for minimap+messages)
 * lives. Orientation is fixed at module load (constants.js) so we can
 * compute the geometry once per session.
 *
 * Portrait — control band at the bottom.
 *   [ DPAD | MAP | ACTIONS ]
 *
 * Landscape — two side strips. D-pad upper-left, map lower-left,
 *   actions upper-right, run messages lower-right.
 *   [ DPAD          ]              [ ACTIONS         ]
 *   [ MAP   |   WORLD VIEWPORT |   MESSAGES          ]
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, CONTROL_HEIGHT,
  SIDE_CONTROL_WIDTH, IS_LANDSCAPE, COLOR
} from '../config/constants.js';

const ACTION_LABELS = [
  { key: 'pickup',    label: 'PICK' },
  { key: 'descend',   label: 'DOWN' },
  { key: 'inventory', label: 'BAG'  }
];

// Geometry layouts — chosen once per session based on orientation.
const LAYOUT = (() => {
  if (IS_LANDSCAPE) {
    // Left strip = D-pad up top, minimap area below.
    // Right strip = action buttons up top, message area below.
    const stripW = SIDE_CONTROL_WIDTH;
    const dpadBtn = 38;
    const dpadGap = 4;
    const dpadSize = dpadBtn * 3 + dpadGap * 2; // 122
    const dpadX = (stripW - dpadSize) / 2;
    const dpadY = HUD_HEIGHT + 8;

    const actW = 96;
    const actH = 44;
    const actGap = 6;
    const actStackH = actH * 3 + actGap * 2;
    const actX = CANVAS_WIDTH - stripW + (stripW - actW) / 2;
    const actY = HUD_HEIGHT + 8;

    return {
      isLandscape: true,
      band: null, // no bottom band
      dpadBtn, dpadGap, dpadSize, dpadX, dpadY,
      actW, actH, actGap, actStackH, actX, actY,
      centerRect: { // minimap slot
        x: 4,
        y: dpadY + dpadSize + 8,
        w: stripW - 8,
        h: CANVAS_HEIGHT - (dpadY + dpadSize + 8) - 8
      },
      msgRect: { // messages strip on right
        x: CANVAS_WIDTH - stripW + 4,
        y: actY + actStackH + 8,
        w: stripW - 8,
        h: CANVAS_HEIGHT - (actY + actStackH + 8) - 8
      },
      // Left + right strip backgrounds.
      strips: [
        { x: 0, y: HUD_HEIGHT, w: stripW, h: CANVAS_HEIGHT - HUD_HEIGHT },
        { x: CANVAS_WIDTH - stripW, y: HUD_HEIGHT, w: stripW, h: CANVAS_HEIGHT - HUD_HEIGHT }
      ]
    };
  }
  // Portrait.
  const bandY = CANVAS_HEIGHT - CONTROL_HEIGHT;
  const dpadBtn = 52;
  const dpadGap = 4;
  const dpadSize = dpadBtn * 3 + dpadGap * 2;
  const dpadX = 8;
  const dpadY = bandY + (CONTROL_HEIGHT - dpadSize) / 2;

  const actW = 72;
  const actH = 48;
  const actGap = 6;
  const actStackH = actH * 3 + actGap * 2;
  const actX = CANVAS_WIDTH - actW - 8;
  const actY = bandY + (CONTROL_HEIGHT - actStackH) / 2;

  return {
    isLandscape: false,
    band: { x: 0, y: bandY, w: CANVAS_WIDTH, h: CONTROL_HEIGHT },
    dpadBtn, dpadGap, dpadSize, dpadX, dpadY,
    actW, actH, actGap, actStackH, actX, actY,
    centerRect: {
      x: dpadX + dpadSize + 12,
      y: bandY + 8,
      w: actX - (dpadX + dpadSize) - 24,
      h: CONTROL_HEIGHT - 16
    },
    msgRect: null,
    strips: []
  };
})();

// D-pad button definitions (positions in 3×3 grid).
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
    this._pressedKey = null;
    this._pressedClearedAt = 0;

    bus.on('scene:switched', ({ to }) => { this._currentScene = to; });
    bus.on('tick', ({ time }) => {
      if (this._pressedKey && time > this._pressedClearedAt) {
        this._pressedKey = null;
      }
    });
  }

  render(renderer) {
    if (this._currentScene !== 'game') return;
    this._renderBackground(renderer);
    this._renderDpad(renderer);
    this._renderActions(renderer);
  }

  handleTap(canvasX, canvasY, currentTime) {
    if (this._currentScene !== 'game') return false;
    for (const b of DPAD_BUTTONS) {
      const bx = LAYOUT.dpadX + b.col * (LAYOUT.dpadBtn + LAYOUT.dpadGap);
      const by = LAYOUT.dpadY + b.row * (LAYOUT.dpadBtn + LAYOUT.dpadGap);
      if (canvasX >= bx && canvasX <= bx + LAYOUT.dpadBtn &&
          canvasY >= by && canvasY <= by + LAYOUT.dpadBtn) {
        this._flash(`dpad:${b.col},${b.row}`, currentTime);
        this.bus.emit('input:action', b.emit);
        return true;
      }
    }
    for (let i = 0; i < ACTION_LABELS.length; i++) {
      const ax = LAYOUT.actX;
      const ay = LAYOUT.actY + i * (LAYOUT.actH + LAYOUT.actGap);
      if (canvasX >= ax && canvasX <= ax + LAYOUT.actW &&
          canvasY >= ay && canvasY <= ay + LAYOUT.actH) {
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
  _renderBackground(r) {
    if (LAYOUT.band) {
      r.drawRect(LAYOUT.band.x, LAYOUT.band.y, LAYOUT.band.w, LAYOUT.band.h, '#08080c');
      r.drawRect(0, LAYOUT.band.y, CANVAS_WIDTH, 1, '#2a2530');
    }
    for (const s of LAYOUT.strips) {
      r.drawRect(s.x, s.y, s.w, s.h, '#08080c');
      // hairline borders on inner edges of strips
      if (s.x === 0) r.drawRect(s.x + s.w - 1, s.y, 1, s.h, '#2a2530');
      else           r.drawRect(s.x, s.y, 1, s.h, '#2a2530');
    }
  }

  _renderDpad(r) {
    for (const b of DPAD_BUTTONS) {
      const bx = LAYOUT.dpadX + b.col * (LAYOUT.dpadBtn + LAYOUT.dpadGap);
      const by = LAYOUT.dpadY + b.row * (LAYOUT.dpadBtn + LAYOUT.dpadGap);
      const pressed = this._pressedKey === `dpad:${b.col},${b.row}`;
      r.drawRect(bx, by, LAYOUT.dpadBtn, LAYOUT.dpadBtn, pressed ? '#3a3548' : '#1a1820');
      r.drawStrokedRect(bx, by, LAYOUT.dpadBtn, LAYOUT.dpadBtn,
        pressed ? '#d6c87a' : '#3a3340', pressed ? 2 : 1);
      r.drawText(b.label, bx + LAYOUT.dpadBtn / 2, by + LAYOUT.dpadBtn / 2,
        { size: LAYOUT.isLandscape ? 18 : 22, bold: true, align: 'center', baseline: 'middle' });
    }
  }

  _renderActions(r) {
    for (let i = 0; i < ACTION_LABELS.length; i++) {
      const ax = LAYOUT.actX;
      const ay = LAYOUT.actY + i * (LAYOUT.actH + LAYOUT.actGap);
      const pressed = this._pressedKey === `act:${i}`;
      r.drawRect(ax, ay, LAYOUT.actW, LAYOUT.actH, pressed ? '#3a3548' : '#1a1820');
      r.drawStrokedRect(ax, ay, LAYOUT.actW, LAYOUT.actH,
        pressed ? '#d6c87a' : '#3a3340', pressed ? 2 : 1);
      r.drawText(ACTION_LABELS[i].label, ax + LAYOUT.actW / 2, ay + LAYOUT.actH / 2,
        { size: 14, bold: true, align: 'center', baseline: 'middle', color: COLOR.textPrimary });
    }
  }

  static get geometry() {
    return {
      isLandscape: LAYOUT.isLandscape,
      band: LAYOUT.band,
      dpadRect: { x: LAYOUT.dpadX, y: LAYOUT.dpadY, w: LAYOUT.dpadSize, h: LAYOUT.dpadSize },
      actionRect: { x: LAYOUT.actX, y: LAYOUT.actY, w: LAYOUT.actW, h: LAYOUT.actStackH },
      centerRect: LAYOUT.centerRect,
      msgRect: LAYOUT.msgRect
    };
  }
}
