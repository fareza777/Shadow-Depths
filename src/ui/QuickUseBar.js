/**
 * QuickUseBar — top row of the Iron Portcullis HUD.
 *
 * Left: 3 iron quick-slot plates (auto-filled with the player's first
 *       stackable consumables/throwables). Numbered 1-3, with count badge.
 * Right: 3 iron nav buttons (HERO / BAG / PICK) with brass-trimmed accent
 *       when their action is currently available.
 */
import {
  COLOR, FONT_DISPLAY, FONT_MONO, uiSize
} from '../config/constants.js';
import { findQuickUseSlots } from '../items/quickUse.js';
import {
  getQuickUseLayout, QUICK_SLOT_COUNT, getViewportBottomY
} from './controlBandLayout.js';
import {
  IRON, drawIronPlate, drawIronRivet, drawBrassRivet
} from './ironHud.js';

export class QuickUseBar {
  constructor({ bus }) {
    this.bus = bus;
    this._pressed = -1;
    this._pressedUntil = 0;
    /** Optional context (player, pickAvailable) set per render frame. */
    this._ctx = null;
    bus.on('tick', ({ time }) => {
      if (this._pressed >= 0 && time > this._pressedUntil) this._pressed = -1;
    });
  }

  setContext(ctx) { this._ctx = ctx; }

  /**
   * @param {import('../rendering/Renderer.js').Renderer} renderer
   * @param {import('../entities/Player.js').Player|null} player
   */
  render(renderer, player) {
    if (!player) return;
    const LAYOUT = getQuickUseLayout();
    const slots = findQuickUseSlots(player.inventory);
    const inv = player.inventory;
    const ctx = renderer.ctx;

    // Subtle "QUICK" label above the slot row.
    renderer.drawText('QUICK', LAYOUT.quickX + LAYOUT.quickRowW / 2,
      LAYOUT.quickY - 8, {
        size: uiSize(8), align: 'center', family: FONT_DISPLAY, color: IRON.brass
      });

    // 1) Render quick slots as iron plates.
    for (let qi = 0; qi < QUICK_SLOT_COUNT; qi++) {
      const rect = LAYOUT.quickRects[qi];
      const invIdx = slots[qi];
      const item = invIdx >= 0 ? inv.getSlot(invIdx) : null;
      const filled = !!item;
      const pressed = this._pressed === qi;
      drawIronPlate(ctx, rect.x, rect.y, rect.w, rect.h, {
        pressed,
        glow: filled ? `${IRON.ember}55` : null,
        rivets: true
      });
      if (!filled) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#0a0810';
        ctx.fillRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
        ctx.restore();
      }

      // Engraved slot number in corner.
      renderer.drawText(String(qi + 1), rect.x + 6, rect.y + 5, {
        size: uiSize(9), family: FONT_MONO, color: IRON.brass
      });

      // Icon centered (if filled).
      if (filled && renderer.sprites) {
        const pad = 10;
        const icon = rect.w - pad * 2;
        renderer.sprites.draw(item.spriteKey, ctx, rect.x + pad, rect.y + pad,
          { size: icon });
        // Count badge bottom-right.
        if (item.stackable && item.count > 1) {
          ctx.save();
          ctx.shadowColor = IRON.ink;
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 1;
          renderer.drawText(`×${item.count}`, rect.x + rect.w - 4, rect.y + rect.h - 4, {
            size: uiSize(10), bold: true, align: 'right', baseline: 'bottom',
            family: FONT_MONO, color: IRON.bone
          });
          ctx.restore();
        }
      } else {
        renderer.drawText('—', rect.x + rect.w / 2, rect.y + rect.h / 2, {
          size: uiSize(14), align: 'center', baseline: 'middle',
          family: 'serif', color: IRON.boneDim
        });
      }
    }

    // 2) Render nav buttons (HERO / BAG / PICK).
    this._renderNavButtons(renderer, LAYOUT);
  }

  _renderNavButtons(r, LAYOUT) {
    const ctx = r.ctx;
    const pickAvail = !!this._ctx?.pickAvailable;
    for (let i = 0; i < LAYOUT.actionRects.length; i++) {
      const rect = LAYOUT.actionRects[i];
      const isPick = rect.type === 'pickup';
      const available = isPick ? pickAvail : true;
      const pressed = this._pressed === QUICK_SLOT_COUNT + i;
      const glow = available && isPick ? `${IRON.ember}66` : null;
      drawIronPlate(ctx, rect.x, rect.y, rect.w, rect.h, { pressed, glow });
      if (!available) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#0a0810';
        ctx.fillRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
        ctx.restore();
      }
      // Glyph (icon) + label.
      this._renderNavGlyph(r, rect.type, rect.x + 18, rect.y + rect.h / 2, pressed, available);
      const color = pressed ? IRON.brassHi
                  : !available ? IRON.boneDim
                  : (isPick ? IRON.ember : IRON.bone);
      r.drawText(rect.label, rect.x + 38, rect.y + rect.h / 2, {
        size: uiSize(11), bold: true, baseline: 'middle',
        family: FONT_DISPLAY, color
      });
    }
  }

  _renderNavGlyph(r, type, cx, cy, pressed, available) {
    const ctx = r.ctx;
    const col = pressed ? IRON.brassHi : (available ? IRON.brass : IRON.boneDim);
    ctx.save();
    if (type === 'vigil') {
      // Helmet glyph (HERO).
      ctx.fillStyle = IRON.plate2;
      ctx.fillRect(cx - 8, cy - 6, 16, 9);
      ctx.fillStyle = col;
      ctx.fillRect(cx - 6, cy - 8, 12, 3);
      ctx.fillStyle = IRON.ink;
      ctx.fillRect(cx - 5, cy - 1, 10, 2);
      ctx.fillStyle = IRON.ember;
      ctx.fillRect(cx - 4, cy, 2, 2);
      ctx.fillRect(cx + 2, cy, 2, 2);
    } else if (type === 'inventory') {
      // Pouch glyph (BAG).
      ctx.fillStyle = IRON.plate2;
      ctx.fillRect(cx - 8, cy - 4, 16, 12);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 8, cy - 4, 16, 12);
      ctx.fillStyle = col;
      ctx.fillRect(cx - 4, cy - 8, 8, 4);
      drawBrassRivet(ctx, cx, cy + 2, 2);
    } else if (type === 'pickup') {
      // Gem glyph (PICK).
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx + 8, cy);
      ctx.lineTo(cx, cy + 9);
      ctx.lineTo(cx - 8, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = available ? IRON.ember : IRON.brassDark;
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
    }
    ctx.restore();
  }

  hitTest(canvasX, canvasY, time, inventory) {
    if (canvasY < getViewportBottomY()) return -1;
    const LAYOUT = getQuickUseLayout();
    const slots = inventory ? findQuickUseSlots(inventory) : [];
    for (let i = 0; i < LAYOUT.quickRects.length; i++) {
      const r = LAYOUT.quickRects[i];
      if (canvasX >= r.x && canvasX <= r.x + r.w &&
          canvasY >= r.y && canvasY <= r.y + r.h) {
        if (slots[i] === undefined || slots[i] < 0) return -1;
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
}
