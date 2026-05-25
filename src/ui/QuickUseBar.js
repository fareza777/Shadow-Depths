/**
 * QuickUseBar — tap-to-use potions / consumables without opening the satchel.
 *
 * Renders in the control-band center (portrait) or left strip pocket (landscape).
 * Hotkeys 1–3 map to quick slots; 4–9 still target bag slots 3–8.
 */
import {
  COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, CONTROL_HEIGHT,
  SIDE_CONTROL_WIDTH, IS_LANDSCAPE, FONT_DISPLAY, FONT_MONO, uiSize
} from '../config/constants.js';
import { findQuickUseSlots, QUICK_USE_SLOT_COUNT } from '../items/quickUse.js';

const SLOT_COUNT = QUICK_USE_SLOT_COUNT;

const LAYOUT = (() => {
  if (IS_LANDSCAPE) {
    const stripW = SIDE_CONTROL_WIDTH;
    const dpadBtn = 42;
    const dpadGap = 5;
    const dpadSize = dpadBtn * 3 + dpadGap * 2;
    const dpadY = HUD_HEIGHT + 10;
    const cr = {
      x: 6,
      y: dpadY + dpadSize + 10,
      w: stripW - 12,
      h: CANVAS_HEIGHT - (dpadY + dpadSize + 10) - 10
    };
    const slot = Math.min(44, cr.w - 4);
    const gap = 6;
    const totalH = SLOT_COUNT * slot + (SLOT_COUNT - 1) * gap;
    const x = cr.x + (cr.w - slot) / 2;
    const y0 = cr.y + Math.max(8, (cr.h - totalH) / 2);
    return { slot, gap, rects: Array.from({ length: SLOT_COUNT }, (_, i) => ({
      x, y: y0 + i * (slot + gap), w: slot, h: slot
    })) };
  }
  const bandY = CANVAS_HEIGHT - CONTROL_HEIGHT;
  const dpadBtn = 56;
  const dpadGap = 5;
  const dpadSize = dpadBtn * 3 + dpadGap * 2;
  const dpadX = 10;
  const actW = 78;
  const actX = CANVAS_WIDTH - actW - 10;
  const centerX = dpadX + dpadSize + 14;
  const centerW = actX - centerX - 28;
  const slot = Math.min(56, Math.floor((centerW - (SLOT_COUNT - 1) * 6) / SLOT_COUNT));
  const gap = 6;
  const totalW = SLOT_COUNT * slot + (SLOT_COUNT - 1) * gap;
  const x = centerX + Math.max(0, (centerW - totalW) / 2);
  const y = bandY + (CONTROL_HEIGHT - slot) / 2;
  return { slot, gap, rects: Array.from({ length: SLOT_COUNT }, (_, i) => ({
    x: x + i * (slot + gap), y, w: slot, h: slot
  })) };
})();

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

    for (let qi = 0; qi < SLOT_COUNT; qi++) {
      const rect = LAYOUT.rects[qi];
      const invIdx = slots[qi];
      const item = invIdx >= 0 ? inv.getSlot(invIdx) : null;
      const pressed = this._pressed === qi;

      renderer.drawRect(rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2, '#0a0810');
      renderer.drawRect(rect.x, rect.y, rect.w, rect.h,
        pressed ? COLOR.bgCardHi : (item ? COLOR.bgCard : COLOR.bgPanelAlt));
      renderer.drawStrokedRect(rect.x, rect.y, rect.w, rect.h,
        pressed ? COLOR.gold : (item ? COLOR.goldDim : COLOR.borderSoft), pressed ? 2 : 1);

      const badge = String(qi + 1);
      renderer.drawRect(rect.x + 2, rect.y + 2, 14, 14, '#0a0810cc');
      renderer.drawText(badge, rect.x + 9, rect.y + 9,
        { size: uiSize(10), bold: true, align: 'center', baseline: 'middle',
          family: FONT_DISPLAY, color: COLOR.gold });

      if (item && renderer.sprites) {
        const pad = 10;
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
          { size: uiSize(14), align: 'center', baseline: 'middle',
            color: COLOR.textMuted, family: FONT_BODY });
      }
    }

    const labelY = IS_LANDSCAPE
      ? LAYOUT.rects[0].y - 12
      : LAYOUT.rects[0].y + LAYOUT.rects[0].h + 4;
    const labelX = IS_LANDSCAPE
      ? LAYOUT.rects[0].x + LAYOUT.rects[0].w / 2
      : CANVAS_WIDTH / 2;
    renderer.drawText('QUICK  1 · 2 · 3', labelX, labelY,
      { size: uiSize(9), align: 'center', family: FONT_MONO, color: COLOR.textMuted });
  }

  /**
   * @param {number} canvasX
   * @param {number} canvasY
   * @param {number} [time]
   * @returns {number} quick index 0..2, or -1
   */
  hitTest(canvasX, canvasY, time) {
    for (let i = 0; i < LAYOUT.rects.length; i++) {
      const r = LAYOUT.rects[i];
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
