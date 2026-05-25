/**
 * MobileControls — ornate D-pad + action buttons.
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, CONTROL_HEIGHT,
  SIDE_CONTROL_WIDTH, IS_LANDSCAPE, COLOR, uiSize
} from '../config/constants.js';
import { getDpadLayout } from './controlBandLayout.js';

const ACTION_LABELS = [
  { key: 'menu',      label: 'MENU' },
  { key: 'pickup',    label: 'PICK' },
  { key: 'descend',   label: 'DOWN' },
  { key: 'inventory', label: 'BAG'  },
  { key: 'vigil',     label: 'HERO' }
];

const DPAD = getDpadLayout();

const LAYOUT = (() => {
  if (IS_LANDSCAPE) {
    const stripW = DPAD.stripW;
    const { dpadBtn, dpadGap, dpadSize, dpadX, dpadY } = DPAD;
    const actW = 100;
    const actH = 36;
    const actGap = 5;
    const actCount = ACTION_LABELS.length;
    const actStackH = actH * actCount + actGap * (actCount - 1);
    const actX = CANVAS_WIDTH - stripW + (stripW - actW) / 2;
    const actY = HUD_HEIGHT + 10;
    return {
      isLandscape: true, band: null,
      dpadBtn, dpadGap, dpadSize, dpadX, dpadY,
      actW, actH, actGap, actStackH, actX, actY,
      centerRect: { x: 6, y: dpadY + dpadSize + 10, w: stripW - 12,
        h: CANVAS_HEIGHT - (dpadY + dpadSize + 10) - 10 },
      msgRect: { x: CANVAS_WIDTH - stripW + 6, y: actY + actStackH + 10,
        w: stripW - 12, h: CANVAS_HEIGHT - (actY + actStackH + 10) - 10 },
      strips: [
        { x: 0, y: HUD_HEIGHT, w: stripW, h: CANVAS_HEIGHT - HUD_HEIGHT },
        { x: CANVAS_WIDTH - stripW, y: HUD_HEIGHT, w: stripW, h: CANVAS_HEIGHT - HUD_HEIGHT }
      ]
    };
  }
  const bandY = DPAD.bandY;
  const { dpadBtn, dpadGap, dpadSize, dpadX, dpadY } = DPAD;
  const actW = 78;
  const actH = 38;
  const actGap = 4;
  const actStackH = actH * ACTION_LABELS.length + actGap * (ACTION_LABELS.length - 1);
  const actX = CANVAS_WIDTH - actW - 10;
  const actY = bandY + (CONTROL_HEIGHT - actStackH) / 2;
  return {
    isLandscape: false,
    band: { x: 0, y: bandY, w: CANVAS_WIDTH, h: CONTROL_HEIGHT },
    dpadBtn, dpadGap, dpadSize, dpadX, dpadY,
    actW, actH, actGap, actStackH, actX, actY,
    centerRect: {
      x: dpadX + dpadSize + 14, y: bandY + 10,
      w: actX - (dpadX + dpadSize) - 28, h: CONTROL_HEIGHT - 20
    },
    msgRect: null, strips: []
  };
})();

const DPAD_BUTTONS = [
  { col: 1, row: 0, dir: 'up',    emit: { type: 'move', dx: 0, dy: -1 } },
  { col: 0, row: 1, dir: 'left',  emit: { type: 'move', dx: -1, dy: 0 } },
  { col: 1, row: 1, dir: 'wait',  emit: { type: 'wait' } },
  { col: 2, row: 1, dir: 'right', emit: { type: 'move', dx: 1, dy: 0 } },
  { col: 1, row: 2, dir: 'down',  emit: { type: 'move', dx: 0, dy: 1 } }
];

export class MobileControls {
  constructor({ bus }) {
    this.bus = bus;
    this._currentScene = 'title';
    this._pressedKey = null;
    this._pressedClearedAt = 0;
    bus.on('scene:switched', ({ to }) => { this._currentScene = to; });
    bus.on('tick', ({ time }) => {
      if (this._pressedKey && time > this._pressedClearedAt) this._pressedKey = null;
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
      r.drawRect(LAYOUT.band.x, LAYOUT.band.y, LAYOUT.band.w, LAYOUT.band.h, '#0a0810');
      r.drawRect(0, LAYOUT.band.y, CANVAS_WIDTH, 2, COLOR.goldDim);
    }
    for (const s of LAYOUT.strips) {
      r.drawRect(s.x, s.y, s.w, s.h, '#0a0810');
      if (s.x === 0) r.drawRect(s.x + s.w - 1, s.y, 1, s.h, COLOR.goldDim);
      else r.drawRect(s.x, s.y, 1, s.h, COLOR.goldDim);
    }
  }

  _renderDpad(r) {
    const ctx = r.ctx;
    const padX = LAYOUT.dpadX - 10;
    const padY = LAYOUT.dpadY - 10;
    const padS = LAYOUT.dpadSize + 20;

    ctx.save();
    const rg = ctx.createRadialGradient(
      padX + padS / 2, padY + padS / 2, 8,
      padX + padS / 2, padY + padS / 2, padS / 2
    );
    rg.addColorStop(0, '#1e1a28');
    rg.addColorStop(1, '#0a0810');
    ctx.fillStyle = rg;
    ctx.fillRect(padX, padY, padS, padS);
    ctx.restore();

    r.drawStrokedRect(padX, padY, padS, padS, COLOR.goldDim, 2);
    r.drawStrokedRect(padX + 3, padY + 3, padS - 6, padS - 6, '#3a3340', 1);

    const cx = LAYOUT.dpadX + LAYOUT.dpadSize / 2;
    const cy = LAYOUT.dpadY + LAYOUT.dpadSize / 2;
    const armW = LAYOUT.dpadBtn + LAYOUT.dpadGap - 2;
    r.drawRect(cx - armW / 2, LAYOUT.dpadY, armW, LAYOUT.dpadSize, '#141018');
    r.drawRect(LAYOUT.dpadX, cy - armW / 2, LAYOUT.dpadSize, armW, '#141018');

    for (const b of DPAD_BUTTONS) {
      const bx = LAYOUT.dpadX + b.col * (LAYOUT.dpadBtn + LAYOUT.dpadGap);
      const by = LAYOUT.dpadY + b.row * (LAYOUT.dpadBtn + LAYOUT.dpadGap);
      const pressed = this._pressedKey === `dpad:${b.col},${b.row}`;
      const isCenter = b.dir === 'wait';

      if (isCenter) {
        const sz = LAYOUT.dpadBtn;
        r.drawRect(bx, by, sz, sz, pressed ? '#3a3048' : '#221c2a');
        r.drawStrokedRect(bx, by, sz, sz, pressed ? COLOR.gold : '#5a5060', pressed ? 2 : 1);
        const gem = pressed ? COLOR.goldHi : COLOR.gold;
        r.drawRect(bx + sz * 0.3, by + sz * 0.3, sz * 0.4, sz * 0.4, gem);
        r.drawRect(bx + sz * 0.38, by + sz * 0.38, sz * 0.24, sz * 0.24, '#fff8e0');
      } else {
        r.drawRect(bx, by, LAYOUT.dpadBtn, LAYOUT.dpadBtn,
          pressed ? COLOR.bgCardHi : '#1a1622');
        r.drawStrokedRect(bx, by, LAYOUT.dpadBtn, LAYOUT.dpadBtn,
          pressed ? COLOR.gold : '#4a4258', pressed ? 2 : 1);
        if (!pressed) {
          r.drawRect(bx + 2, by + 2, LAYOUT.dpadBtn - 4, 3, '#252030');
        }
        MobileControls._drawArrow(r, bx, by, LAYOUT.dpadBtn, b.dir, pressed);
      }
    }
  }

  static _drawArrow(r, bx, by, sz, dir, pressed) {
    const ctx = r.ctx;
    const col = pressed ? COLOR.goldHi : COLOR.textPrimary;
    const cx = bx + sz / 2;
    const cy = by + sz / 2;
    const a = sz * 0.22;
    ctx.fillStyle = col;
    ctx.beginPath();
    if (dir === 'up') {
      ctx.moveTo(cx, cy - a); ctx.lineTo(cx - a, cy + a * 0.6); ctx.lineTo(cx + a, cy + a * 0.6);
    } else if (dir === 'down') {
      ctx.moveTo(cx, cy + a); ctx.lineTo(cx - a, cy - a * 0.6); ctx.lineTo(cx + a, cy - a * 0.6);
    } else if (dir === 'left') {
      ctx.moveTo(cx - a, cy); ctx.lineTo(cx + a * 0.6, cy - a); ctx.lineTo(cx + a * 0.6, cy + a);
    } else {
      ctx.moveTo(cx + a, cy); ctx.lineTo(cx - a * 0.6, cy - a); ctx.lineTo(cx - a * 0.6, cy + a);
    }
    ctx.closePath();
    ctx.fill();
  }

  _renderActions(r) {
    for (let i = 0; i < ACTION_LABELS.length; i++) {
      const ax = LAYOUT.actX;
      const ay = LAYOUT.actY + i * (LAYOUT.actH + LAYOUT.actGap);
      const pressed = this._pressedKey === `act:${i}`;
      const isMenu = ACTION_LABELS[i].key === 'menu';

      r.drawRect(ax - 1, ay - 1, LAYOUT.actW + 2, LAYOUT.actH + 2, '#0a0810');
      r.drawRect(ax, ay, LAYOUT.actW, LAYOUT.actH,
        pressed ? COLOR.bgCardHi : (isMenu ? '#2a2228' : '#1a1622'));
      r.drawStrokedRect(ax, ay, LAYOUT.actW, LAYOUT.actH,
        pressed ? COLOR.gold : (isMenu ? COLOR.goldDim : '#4a4258'), pressed ? 2 : 1);
      if (!pressed) r.drawRect(ax + 2, ay + 2, LAYOUT.actW - 4, 2, '#252030');
      r.drawText(ACTION_LABELS[i].label, ax + LAYOUT.actW / 2, ay + LAYOUT.actH / 2, {
        size: uiSize(13), bold: true, align: 'center', baseline: 'middle',
        color: pressed ? COLOR.goldHi : (isMenu ? COLOR.gold : COLOR.textPrimary)
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
