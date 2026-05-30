/**
 * Choice modal for floor micro-events (shrine, merchant, altar, lore).
 */
import { COLOR, FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize } from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import { EVENT_LABELS } from '../gameplay/floorEvents.js';
import { IRON } from './ironHud.js';

const BRASS = '#d4ac6c';
const BRASS_HI = '#f1d49a';

export class FloorEventPanel {
  constructor({ bus }) {
    this.bus = bus;
    this.open = false;
    this._options = [];
    this._title = '';
    this._subtitle = '';
    this._rowRects = [];
    this._closeRect = null;
    this._onPick = null;
  }

  /**
   * @param {{ title, subtitle, options: Array<{id,label,detail,enabled?}>, onPick: (id)=>void }} cfg
   */
  show(cfg) {
    this.open = true;
    this._title = cfg.title || 'Event';
    this._subtitle = cfg.subtitle || '';
    this._options = cfg.options || [];
    this._onPick = cfg.onPick || null;
  }

  hide() {
    this.open = false;
    this._onPick = null;
  }

  render(r) {
    if (!this.open) return;
    const padX = 20;
    const modalY = Layout.hud + 40;
    const modalW = Layout.canvasW - padX * 2;
    const bottomReserve = Layout.control + 24;
    const modalH = Math.min(420, Layout.canvasH - modalY - bottomReserve);
    const modalX = padX;

    const ctx = r.ctx;
    ctx.save();
    const g = ctx.createLinearGradient(0, modalY, 0, modalY + modalH);
    g.addColorStop(0, IRON.plate1);
    g.addColorStop(1, IRON.plate0);
    ctx.fillStyle = g;
    ctx.fillRect(modalX, modalY, modalW, modalH);
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 2;
    ctx.strokeRect(modalX + 0.5, modalY + 0.5, modalW - 1, modalH - 1);
    ctx.restore();

    r.drawText(this._title, Layout.canvasW / 2, modalY + 20, {
      size: uiSize(17), bold: true, align: 'center',
      family: FONT_DISPLAY, color: BRASS_HI
    });
    if (this._subtitle) {
      r.drawText(this._subtitle, Layout.canvasW / 2, modalY + 42, {
        size: uiSize(10), italic: true, align: 'center',
        family: FONT_BODY, color: COLOR.textMuted
      });
    }

    const rowH = 56;
    const listX = modalX + 12;
    const listW = modalW - 24;
    let y = modalY + (this._subtitle ? 58 : 48);
    this._rowRects = [];
    for (const opt of this._options) {
      const enabled = opt.enabled !== false;
      this._rowRects.push({ id: opt.id, x: listX, y, w: listW, h: rowH, enabled });
      r.drawRect(listX, y, listW, rowH, enabled ? IRON.plate2 : '#0c0a14');
      r.drawStrokedRect(listX, y, listW, rowH, enabled ? BRASS : IRON.ink, 1);
      r.drawText(opt.label, listX + 10, y + 8, {
        size: uiSize(12), bold: true, family: FONT_DISPLAY,
        color: enabled ? BRASS_HI : IRON.boneDim
      });
      r.drawText(opt.detail || '', listX + 10, y + 28, {
        size: uiSize(9), family: FONT_MONO,
        color: enabled ? COLOR.textPrimary : COLOR.textMuted
      });
      y += rowH + 6;
    }

    const closeY = modalY + modalH - 44;
    const closeX = Layout.canvasW / 2 - 70;
    r.drawRect(closeX, closeY, 140, 32, IRON.plate0);
    r.drawStrokedRect(closeX, closeY, 140, 32, BRASS, 2);
    r.drawText('LEAVE', Layout.canvasW / 2, closeY + 16, {
      size: uiSize(12), bold: true, align: 'center', baseline: 'middle',
      family: FONT_DISPLAY, color: BRASS_HI
    });
    this._closeRect = { x: closeX, y: closeY, w: 140, h: 32 };
  }

  handleTap(x, y) {
    if (!this.open) return false;
    if (this._closeRect && _in(x, y, this._closeRect)) {
      this.hide();
      return true;
    }
    for (const row of this._rowRects) {
      if (row.enabled && _in(x, y, row)) {
        this._onPick?.(row.id);
        this.hide();
        return true;
      }
    }
    return true;
  }
}

export function eventPanelTitle(kind) {
  return EVENT_LABELS[kind] || 'Strange Place';
}

function _in(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
