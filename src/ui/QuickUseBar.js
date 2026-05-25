/**
 * QuickUseBar — tap-to-use potions / consumables (row above the D-pad).
 */
import { COLOR, FONT_DISPLAY, FONT_MONO, uiSize } from '../config/constants.js';
import { findQuickUseSlots } from '../items/quickUse.js';
import { getControlBandLayout, QUICK_SLOT_COUNT } from './controlBandLayout.js';

const LAYOUT = getControlBandLayout();

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
    const slots = findQuickUseSlots(player.inventory);
    const inv = player.inventory;

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

    const quickRowW = QUICK_SLOT_COUNT * LAYOUT.quickSlot
      + (QUICK_SLOT_COUNT - 1) * LAYOUT.quickGap;
    renderer.drawText('QUICK', LAYOUT.quickX + quickRowW / 2, LAYOUT.quickY - 10,
      { size: uiSize(9), align: 'center', family: FONT_MONO, color: COLOR.textMuted });
  }

  hitTest(canvasX, canvasY, time) {
    for (let i = 0; i < LAYOUT.quickRects.length; i++) {
      const r = LAYOUT.quickRects[i];
      if (canvasX >= r.x && canvasX <= r.x + r.w &&
          canvasY >= r.y && canvasY <= r.y + r.h) {
        this._pressed = i;
        this._pressedUntil = (time ?? performance.now() / 1000) + 0.12;
        return i;
      }
    }
    return -1;
  }

  static get layout() { return LAYOUT; }
}
