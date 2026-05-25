/**
 * MobileControls — canvas-painted D-pad, action buttons, and MENU.
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, CONTROL_HEIGHT,
  SIDE_CONTROL_WIDTH, IS_LANDSCAPE, COLOR, uiSize
} from '../config/constants.js';

const ACTION_LABELS = [
  { key: 'menu',      label: 'MENU' },
  { key: 'pickup',    label: 'PICK' },
  { key: 'descend',   label: 'DOWN' },
  { key: 'inventory', label: 'BAG'  },
  { key: 'vigil',     label: 'HERO' }
];

const LAYOUT = (() => {
  if (IS_LANDSCAPE) {
    const stripW = SIDE_CONTROL_WIDTH;
    const dpadBtn = 42;
    const dpadGap = 5;
    const dpadSize = dpadBtn * 3 + dpadGap * 2;
    const dpadX = (stripW - dpadSize) / 2;
    const dpadY = HUD_HEIGHT + 10;

    const actW = 100;
    const actH = 36;
    const actGap = 5;
    const actCount = ACTION_LABELS.length;
    const actStackH = actH * actCount + actGap * (actCount - 1);
    const actX = CANVAS_WIDTH - stripW + (stripW - actW) / 2;
    const actY = HUD_HEIGHT + 10;

    return {
      isLandscape: true,
      band: null,
      dpadBtn, dpadGap, dpadSize, dpadX, dpadY,
      actW, actH, actGap, actStackH, actX, actY,
      centerRect: {
        x: 6,
        y: dpadY + dpadSize + 10,
        w: stripW - 12,
        h: CANVAS_HEIGHT - (dpadY + dpadSize + 10) - 10
      },
      msgRect: {
        x: CANVAS_WIDTH - stripW + 6,
        y: actY + actStackH + 10,
        w: stripW - 12,
        h: CANVAS_HEIGHT - (actY + actStackH + 10) - 10
      },
      strips: [
        { x: 0, y: HUD_HEIGHT, w: stripW, h: CANVAS_HEIGHT - HUD_HEIGHT },
        { x: CANVAS_WIDTH - stripW, y: HUD_HEIGHT, w: stripW, h: CANVAS_HEIGHT - HUD_HEIGHT }
      ]
    };
  }

  const bandY = CANVAS_HEIGHT - CONTROL_HEIGHT;
  const dpadBtn = 56;
  const dpadGap = 5;
  const dpadSize = dpadBtn * 3 + dpadGap * 2;
  const dpadX = 10;
  const dpadY = bandY + (CONTROL_HEIGHT - dpadSize) / 2;

  const actW = 78;
  const actH = 38;
  const actGap = 4;
  const actCount = ACTION_LABELS.length;
  const actStackH = actH * actCount + actGap * (actCount - 1);
  const actX = CANVAS_WIDTH - actW - 10;
  const actY = bandY + (CONTROL_HEIGHT - actStackH) / 2;

  return {
    isLandscape: false,
    band: { x: 0, y: bandY, w: CANVAS_WIDTH, h: CONTROL_HEIGHT },
    dpadBtn, dpadGap, dpadSize, dpadX, dpadY,
    actW, actH, actGap, actStackH, actX, actY,
    centerRect: {
      x: dpadX + dpadSize + 14,
      y: bandY + 10,
      w: actX - (dpadX + dpadSize) - 28,
      h: CONTROL_HEIGHT - 20
    },
    msgRect: null,
    strips: []
  };
})();

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

  _renderBackground(r) {
    if (LAYOUT.band) {
      r.drawRect(LAYOUT.band.x, LAYOUT.band.y, LAYOUT.band.w, LAYOUT.band.h, '#0c0a10');
      r.drawRect(0, LAYOUT.band.y, CANVAS_WIDTH, 2, COLOR.goldDim);
      r.drawRect(0, LAYOUT.band.y + 2, CANVAS_WIDTH, 1, '#2a2530');
    }
    for (const s of LAYOUT.strips) {
      r.drawRect(s.x, s.y, s.w, s.h, '#0c0a10');
      if (s.x === 0) r.drawRect(s.x + s.w - 1, s.y, 1, s.h, COLOR.goldDim);
      else           r.drawRect(s.x, s.y, 1, s.h, COLOR.goldDim);
    }
  }

  _renderDpad(r) {
    const padX = LAYOUT.dpadX - 6;
    const padY = LAYOUT.dpadY - 6;
    const padS = LAYOUT.dpadSize + 12;
    r.drawRect(padX, padY, padS, padS, '#121018');
    r.drawStrokedRect(padX, padY, padS, padS, COLOR.borderSoft, 1);

    for (const b of DPAD_BUTTONS) {
      const bx = LAYOUT.dpadX + b.col * (LAYOUT.dpadBtn + LAYOUT.dpadGap);
      const by = LAYOUT.dpadY + b.row * (LAYOUT.dpadBtn + LAYOUT.dpadGap);
      const pressed = this._pressedKey === `dpad:${b.col},${b.row}`;
      r.drawRect(bx, by, LAYOUT.dpadBtn, LAYOUT.dpadBtn,
        pressed ? COLOR.bgCardHi : '#1e1a26');
      r.drawStrokedRect(bx, by, LAYOUT.dpadBtn, LAYOUT.dpadBtn,
        pressed ? COLOR.gold : '#4a4258', pressed ? 2 : 1);
      if (!pressed) {
        r.drawRect(bx + 2, by + 2, LAYOUT.dpadBtn - 4, 2, '#2a2634');
      }
      r.drawText(b.label, bx + LAYOUT.dpadBtn / 2, by + LAYOUT.dpadBtn / 2, {
        size: uiSize(LAYOUT.isLandscape ? 16 : 20), bold: true,
        align: 'center', baseline: 'middle', color: pressed ? COLOR.goldHi : COLOR.textPrimary
      });
    }
  }

  _renderActions(r) {
    for (let i = 0; i < ACTION_LABELS.length; i++) {
      const ax = LAYOUT.actX;
      const ay = LAYOUT.actY + i * (LAYOUT.actH + LAYOUT.actGap);
      const pressed = this._pressedKey === `act:${i}`;
      const isMenu = ACTION_LABELS[i].key === 'menu';
      r.drawRect(ax, ay, LAYOUT.actW, LAYOUT.actH,
        pressed ? COLOR.bgCardHi : (isMenu ? '#2a2228' : '#1e1a26'));
      r.drawStrokedRect(ax, ay, LAYOUT.actW, LAYOUT.actH,
        pressed ? COLOR.gold : (isMenu ? '#6a5a40' : '#4a4258'), pressed ? 2 : 1);
      r.drawText(ACTION_LABELS[i].label, ax + LAYOUT.actW / 2, ay + LAYOUT.actH / 2, {
        size: uiSize(13), bold: true, align: 'center', baseline: 'middle',
        color: isMenu ? COLOR.gold : COLOR.textPrimary
      });
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
