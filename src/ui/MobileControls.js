/**
 * MobileControls — ornate D-pad + action buttons.
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, CONTROL_HEIGHT,
  IS_LANDSCAPE, COLOR, FONT_DISPLAY, uiSize
} from '../config/constants.js';
import { getDpadLayout } from './controlBandLayout.js';

const ACTION_LABELS = [
  { key: 'menu',      label: 'MENU', icon: 'III' },
  { key: 'pickup',    label: 'PICK', icon: 'GEM' },
  { key: 'descend',   label: 'DOWN', icon: 'STAIR' },
  { key: 'inventory', label: 'BAG',  icon: 'BAG' },
  { key: 'vigil',     label: 'HERO', icon: 'HELM' }
];

function buildLayout() {
  const DPAD = getDpadLayout();
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
}

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
    this.renderBackground(renderer);
    this.renderControls(renderer);
  }

  renderBackground(renderer) {
    this._renderBackground(renderer, buildLayout());
  }

  renderControls(renderer) {
    const LAYOUT = buildLayout();
    this._renderDpad(renderer, LAYOUT);
    this._renderActions(renderer, LAYOUT);
  }

  handleTap(canvasX, canvasY, currentTime) {
    const LAYOUT = buildLayout();
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

  _renderBackground(r, LAYOUT) {
    const t = performance.now() / 1000;
    if (LAYOUT.band) {
      r.drawRect(LAYOUT.band.x, LAYOUT.band.y, LAYOUT.band.w, LAYOUT.band.h, '#0a0810');
      MobileControls._drawStoneRelief(r, LAYOUT.band, t);
      r.drawRect(0, LAYOUT.band.y, CANVAS_WIDTH, 2, COLOR.goldDim);
      r.drawRect(0, LAYOUT.band.y + 3, CANVAS_WIDTH, 1, '#5a4830');
      MobileControls._drawTorch(r, LAYOUT.dpadX + LAYOUT.dpadSize + 22, LAYOUT.band.y + 20, t, false);
      MobileControls._drawTorch(r, LAYOUT.actX - 32, LAYOUT.band.y + 20, t, true);
      MobileControls._drawSigil(r, CANVAS_WIDTH / 2, LAYOUT.band.y + CONTROL_HEIGHT - 22, t);
    }
    for (const s of LAYOUT.strips) {
      r.drawRect(s.x, s.y, s.w, s.h, '#0a0810');
      MobileControls._drawStoneRelief(r, s, t);
      if (s.x === 0) r.drawRect(s.x + s.w - 1, s.y, 1, s.h, COLOR.goldDim);
      else r.drawRect(s.x, s.y, 1, s.h, COLOR.goldDim);
    }
  }

  static _drawStoneRelief(r, rect, time) {
    const ctx = r.ctx;
    ctx.save();
    ctx.globalAlpha = 0.72;
    for (let y = rect.y + 12; y < rect.y + rect.h; y += 28) {
      const offset = ((Math.floor((y - rect.y) / 28) % 2) * 18);
      for (let x = rect.x - offset; x < rect.x + rect.w; x += 54) {
        r.drawRect(x, y, 50, 1, '#19131f');
        r.drawRect(x + 1, y + 1, 49, 1, '#14101a');
      }
    }
    ctx.globalAlpha = 0.34;
    for (let i = 0; i < 18; i++) {
      const x = rect.x + ((i * 37 + rect.w * 3) % Math.max(1, rect.w));
      const y = rect.y + 10 + ((i * 23) % Math.max(1, rect.h - 20));
      r.drawRect(x, y, 2, 2, i % 3 === 0 ? COLOR.goldDim : '#2a2230');
    }
    ctx.globalAlpha = 0.12 + Math.sin(time * 1.4) * 0.03;
    const g = ctx.createRadialGradient(
      rect.x + rect.w / 2, rect.y + rect.h * 0.52, 8,
      rect.x + rect.w / 2, rect.y + rect.h * 0.52, rect.w * 0.58
    );
    g.addColorStop(0, COLOR.gold);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  static _drawTorch(r, x, y, time, flip) {
    const ctx = r.ctx;
    ctx.save();
    ctx.globalAlpha = 0.8;
    const flicker = Math.sin(time * 8 + x * 0.03) * 2;
    r.drawRect(x - 2, y + 18, 4, 38, '#3a2418');
    r.drawRect(x - 5, y + 14, 10, 5, '#6a4428');
    ctx.globalAlpha = 0.18;
    const glow = ctx.createRadialGradient(x, y + 12, 3, x, y + 12, 36 + flicker);
    glow.addColorStop(0, COLOR.goldHi);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 42, y - 30, 84, 84);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f0d890';
    ctx.beginPath();
    ctx.moveTo(x, y + 2 + flicker);
    ctx.lineTo(x + (flip ? -8 : 8), y + 14);
    ctx.lineTo(x, y + 26);
    ctx.lineTo(x + (flip ? 6 : -6), y + 15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e85a4a';
    ctx.fillRect(x - 2, y + 13, 4, 8);
    ctx.restore();
  }

  static _drawSigil(r, cx, cy, time) {
    const ctx = r.ctx;
    ctx.save();
    ctx.globalAlpha = 0.42 + Math.sin(time * 1.8) * 0.08;
    ctx.strokeStyle = COLOR.goldDim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 13);
    ctx.lineTo(cx + 13, cy);
    ctx.lineTo(cx, cy + 13);
    ctx.lineTo(cx - 13, cy);
    ctx.closePath();
    ctx.stroke();
    r.drawText('V', cx, cy - 8, {
      size: uiSize(11), bold: true, align: 'center',
      family: FONT_DISPLAY, color: COLOR.goldDim
    });
    ctx.restore();
  }

  _renderDpad(r, LAYOUT) {
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
        r.drawRect(bx, by, sz, sz, pressed ? '#4a3a58' : '#2e2838');
        r.drawStrokedRect(bx, by, sz, sz, pressed ? COLOR.gold : '#7a7088', pressed ? 2 : 1);
        const gem = pressed ? COLOR.goldHi : COLOR.gold;
        r.drawRect(bx + sz * 0.3, by + sz * 0.3, sz * 0.4, sz * 0.4, gem);
        r.drawRect(bx + sz * 0.38, by + sz * 0.38, sz * 0.24, sz * 0.24, '#fff8e0');
      } else {
        r.drawRect(bx, by, LAYOUT.dpadBtn, LAYOUT.dpadBtn,
          pressed ? COLOR.bgCardHi : '#2a2438');
        r.drawStrokedRect(bx, by, LAYOUT.dpadBtn, LAYOUT.dpadBtn,
          pressed ? COLOR.gold : '#8a8098', pressed ? 2 : 1);
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

  _renderActions(r, LAYOUT) {
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
      MobileControls._drawActionIcon(r, ACTION_LABELS[i].icon, ax + 18, ay + LAYOUT.actH / 2, pressed, isMenu);
      r.drawText(ACTION_LABELS[i].label, ax + 42, ay + LAYOUT.actH / 2, {
        size: uiSize(11), bold: true, align: 'left', baseline: 'middle',
        color: pressed ? COLOR.goldHi : (isMenu ? COLOR.gold : COLOR.textPrimary)
      });
    }
  }

  static _drawActionIcon(r, icon, cx, cy, pressed, isMenu) {
    const ctx = r.ctx;
    const col = pressed ? COLOR.goldHi : (isMenu ? COLOR.gold : COLOR.textPrimary);
    const dim = pressed ? '#5a4830' : '#4a4258';
    ctx.save();
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 2;
    if (icon === 'III') {
      for (let i = -1; i <= 1; i++) r.drawRect(cx - 7, cy + i * 5 - 1, 14, 2, col);
    } else if (icon === 'GEM') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9); ctx.lineTo(cx + 8, cy); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 8, cy);
      ctx.closePath(); ctx.stroke();
      r.drawRect(cx - 2, cy - 2, 4, 4, COLOR.goldDim);
    } else if (icon === 'STAIR') {
      for (let i = 0; i < 4; i++) {
        r.drawRect(cx - 10 + i * 4, cy - 8 + i * 4, 14 - i * 2, 2, col);
      }
      r.drawRect(cx + 4, cy + 6, 4, 2, dim);
    } else if (icon === 'BAG') {
      r.drawRect(cx - 8, cy - 4, 16, 12, dim);
      r.drawStrokedRect(cx - 8, cy - 4, 16, 12, col, 1);
      r.drawRect(cx - 4, cy - 8, 8, 4, col);
    } else if (icon === 'HELM') {
      r.drawRect(cx - 8, cy - 6, 16, 9, dim);
      r.drawRect(cx - 6, cy - 8, 12, 3, col);
      r.drawRect(cx - 5, cy - 1, 10, 2, '#0a0810');
      r.drawRect(cx - 4, cy, 2, 2, COLOR.textCrit);
      r.drawRect(cx + 2, cy, 2, 2, COLOR.textCrit);
    }
    ctx.restore();
  }

  static get geometry() {
    const LAYOUT = buildLayout();
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
