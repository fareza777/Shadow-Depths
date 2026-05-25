/**
 * QuickUseBar — tap-to-use potions / consumables (row above the D-pad).
 */
import {
  COLOR, FONT_DISPLAY, FONT_MONO, uiSize
} from '../config/constants.js';
import { findQuickUseSlots } from '../items/quickUse.js';
import {
  getQuickUseLayout, QUICK_SLOT_COUNT, getViewportBottomY
} from './controlBandLayout.js';

export class QuickUseBar {
  constructor({ bus }) {
    this.bus = bus;
    this._pressed = -1;
    this._pressedUntil = 0;
    bus.on('tick', ({ time }) => {
      if (this._pressed >= 0 && time > this._pressedUntil) this._pressed = -1;
    });
  }

  /**
   * @param {import('../rendering/Renderer.js').Renderer} renderer
   * @param {import('../entities/Player.js').Player|null} player
   */
  render(renderer, player) {
    if (!player) return;
    const LAYOUT = getQuickUseLayout();
    const slots = findQuickUseSlots(player.inventory);
    const inv = player.inventory;

    const pad = 4;
    const ctx = renderer.ctx;
    const railX = LAYOUT.quickX - pad;
    const railY = LAYOUT.quickY - 14;
    const railW = QuickUseBar._railWidth(LAYOUT) + pad * 2;
    const railH = LAYOUT.quickSlot + 18;
    ctx.save();
    const rail = ctx.createLinearGradient(railX, railY, railX, railY + railH);
    rail.addColorStop(0, '#2b2533ee');
    rail.addColorStop(0.5, '#191421ee');
    rail.addColorStop(1, '#09070dee');
    ctx.fillStyle = rail;
    ctx.fillRect(railX, railY, railW, railH);
    ctx.globalAlpha = 0.35;
    renderer.drawRect(railX + 4, railY + 3, railW - 8, 1, COLOR.goldDim);
    renderer.drawRect(railX + 8, railY + railH - 4, railW - 16, 1, '#ffffff20');
    ctx.restore();
    renderer.drawRect(
      railX,
      railY,
      railW,
      1,
      '#0a0810'
    );

    for (let qi = 0; qi < QUICK_SLOT_COUNT; qi++) {
      const rect = LAYOUT.quickRects[qi];
      const invIdx = slots[qi];
      const item = invIdx >= 0 ? inv.getSlot(invIdx) : null;
      const pressed = this._pressed === qi;

      renderer.drawRect(rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2, '#0a0810');
      renderer.drawRect(rect.x, rect.y, rect.w, rect.h,
        pressed ? COLOR.bgCardHi : (item ? COLOR.bgCard : COLOR.bgPanelAlt));
      renderer.drawStrokedRect(rect.x, rect.y, rect.w, rect.h,
        pressed ? COLOR.gold : (item ? COLOR.goldDim : COLOR.borderSoft), pressed ? 2 : 1);
      if (!pressed) {
        renderer.drawRect(rect.x + 3, rect.y + 3, rect.w - 6, 2, item ? '#ffffff24' : '#ffffff12');
        renderer.drawRect(rect.x + rect.w - 4, rect.y + 5, 1, rect.h - 10, '#00000066');
      }

      renderer.drawRect(rect.x + 2, rect.y + 2, 14, 14, '#0a0810cc');
      renderer.drawText(String(qi + 1), rect.x + 9, rect.y + 9,
        { size: uiSize(10), bold: true, align: 'center', baseline: 'middle',
          family: FONT_DISPLAY, color: COLOR.gold });

      if (item && renderer.sprites) {
        const pad = 8;
        const icon = rect.w - pad * 2;
        renderer.sprites.draw(item.spriteKey, renderer.ctx,
          rect.x + pad, rect.y + pad, { size: icon });
        if (item.stackable && item.count > 1) {
          renderer.drawRect(rect.x + rect.w - 22, rect.y + rect.h - 16, 20, 12, '#0a0810dd');
          renderer.drawText(`×${item.count}`, rect.x + rect.w - 6, rect.y + rect.h - 6,
            { size: uiSize(10), bold: true, align: 'right', baseline: 'bottom', family: FONT_MONO });
        }
      } else {
        renderer.drawText('—', rect.x + rect.w / 2, rect.y + rect.h / 2,
          { size: uiSize(12), align: 'center', baseline: 'middle',
            color: COLOR.textMuted, family: FONT_MONO });
      }
    }

    renderer.drawText('QUICK', LAYOUT.quickX + LAYOUT.quickRowW / 2, LAYOUT.quickY - 10,
      { size: uiSize(9), align: 'center', family: FONT_MONO, color: COLOR.textMuted });
    this._renderActionButtons(renderer, LAYOUT);
  }

  _renderActionButtons(r, LAYOUT) {
    for (let i = 0; i < LAYOUT.actionRects.length; i++) {
      const rect = LAYOUT.actionRects[i];
      const pressed = this._pressed === QUICK_SLOT_COUNT + i;
      r.drawRect(rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2, '#0a0810');
      r.drawRect(rect.x, rect.y, rect.w, rect.h, pressed ? COLOR.bgCardHi : COLOR.bgCard);
      r.drawStrokedRect(rect.x, rect.y, rect.w, rect.h,
        pressed ? COLOR.gold : COLOR.goldDim, pressed ? 2 : 1);
      if (!pressed) r.drawRect(rect.x + 2, rect.y + 2, rect.w - 4, 2, '#252030');
      if (i > 0) r.drawRect(rect.x - LAYOUT.quickGap / 2 - 1, rect.y + 7, 1, rect.h - 14, '#d4be7a2c');
      this._drawActionGlyph(r, rect.type, rect.x + rect.w / 2, rect.y + 17, pressed);
      r.drawText(rect.label, rect.x + rect.w / 2, rect.y + rect.h - 13, {
        size: uiSize(8), bold: true, align: 'center', baseline: 'middle',
        family: FONT_DISPLAY, color: pressed ? COLOR.goldHi : COLOR.textPrimary
      });
    }
  }

  _drawActionGlyph(r, type, cx, cy, pressed) {
    const ctx = r.ctx;
    const col = pressed ? COLOR.goldHi : COLOR.gold;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 2;
    if (type === 'vigil') {
      r.drawRect(cx - 8, cy - 6, 16, 9, '#3a3040');
      r.drawRect(cx - 6, cy - 8, 12, 3, col);
      r.drawRect(cx - 5, cy - 1, 10, 2, '#0a0810');
      r.drawRect(cx - 4, cy, 2, 2, COLOR.textCrit);
      r.drawRect(cx + 2, cy, 2, 2, COLOR.textCrit);
    } else if (type === 'inventory') {
      r.drawRect(cx - 8, cy - 4, 16, 12, '#3a3040');
      r.drawStrokedRect(cx - 8, cy - 4, 16, 12, col, 1);
      r.drawRect(cx - 4, cy - 8, 8, 4, col);
    } else {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9); ctx.lineTo(cx + 8, cy); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 8, cy);
      ctx.closePath(); ctx.stroke();
      r.drawRect(cx - 2, cy - 2, 4, 4, COLOR.goldDim);
    }
    ctx.restore();
  }

  /**
   * @param {number} canvasX
   * @param {number} canvasY
   * @param {number} [time]
   * @param {import('../items/Inventory.js').Inventory} [inventory]
   */
  hitTest(canvasX, canvasY, time, inventory) {
    if (canvasY < getViewportBottomY()) return -1;
    const LAYOUT = getQuickUseLayout();

    const slots = inventory ? findQuickUseSlots(inventory) : [];
    for (let i = 0; i < LAYOUT.quickRects.length; i++) {
      const r = LAYOUT.quickRects[i];
      if (canvasX >= r.x && canvasX <= r.x + r.w &&
          canvasY >= r.y && canvasY <= r.y + r.h) {
        if (slots[i] === undefined) return -1;
        this._pressed = i;
        this._pressedUntil = (time ?? performance.now() / 1000) + 0.12;
        return i;
      }
    }
    for (let i = 0; i < LAYOUT.actionRects.length; i++) {
      const r = LAYOUT.actionRects[i];
      if (canvasX >= r.x && canvasX <= r.x + r.w &&
          canvasY >= r.y && canvasY <= r.y + r.h) {
        this._pressed = QUICK_SLOT_COUNT + i;
        this._pressedUntil = (time ?? performance.now() / 1000) + 0.12;
        return { type: r.type };
      }
    }
    return -1;
  }

  static get layout() { return getQuickUseLayout(); }

  static _railWidth(layout) {
    const L = layout || getQuickUseLayout();
    if (!L.actionRects.length) return L.quickRowW;
    const last = L.actionRects[L.actionRects.length - 1];
    return last.x + last.w - L.quickX;
  }
}
