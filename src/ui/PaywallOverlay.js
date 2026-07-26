/**
 * PaywallOverlay — one-time unlock modal for Full Descent.
 */
import {
  COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize
} from '../config/constants.js';
import { drawIronPanel, drawIronActionButton, IRON_PALETTE } from './ironPanel.js';
import { t } from '../content/i18n.js';

const BENEFIT_KEYS = [
  'paywall.benefit_floors',
  'paywall.benefit_biomes',
  'paywall.benefit_forever',
  'paywall.benefit_noads'
];

export class PaywallOverlay {
  /**
   * @param {{ bus:object, billing:object }} deps
   */
  constructor({ bus, billing }) {
    this.bus = bus;
    this.billing = billing;
    this.open = false;
    this._busy = false;
    this._status = '';
    this._statusUntil = 0;
    this._reason = 'descend'; // 'descend' | 'continue' | 'menu'
  }

  show(reason = 'descend') {
    this.open = true;
    this._reason = reason;
    this._status = '';
    this._busy = false;
    this.bus?.emit('paywall:shown', { reason });
  }

  hide() {
    this.open = false;
    this._busy = false;
  }

  /**
   * @returns {boolean} true if the tap was consumed
   */
  handleTap(x, y) {
    if (!this.open) return false;
    const g = this._layout();
    if (this._inside(x, y, g.unlock)) {
      this._buy();
      return true;
    }
    if (this._inside(x, y, g.restore)) {
      this._restore();
      return true;
    }
    if (this._inside(x, y, g.close)) {
      this.hide();
      this.bus?.emit('paywall:dismissed', { reason: this._reason });
      return true;
    }
    return true; // block world taps while open
  }

  handleInput(action) {
    if (!this.open) return false;
    if (action.type === 'escape' || action.type === 'inventory') {
      this.hide();
      this.bus?.emit('paywall:dismissed', { reason: this._reason });
      return true;
    }
    if (action.type === 'confirm' || action.type === 'tap') {
      // keyboard confirm → buy
      if (action.type === 'confirm') this._buy();
      return true;
    }
    return true;
  }

  async _buy() {
    if (this._busy || !this.billing) return;
    this._busy = true;
    this._flash(t('paywall.flash_opening'));
    const result = await this.billing.purchase();
    this._busy = false;
    if (result.ok) {
      this._flash(t('paywall.flash_unlocked'));
      this.bus?.emit('paywall:unlocked', { reason: this._reason });
      setTimeout(() => this.hide(), 450);
    } else if (result.reason === 'cancelled') {
      this._flash(t('paywall.flash_cancelled'));
    } else if (result.reason === 'web_mock') {
      this._flash(t('paywall.flash_dev'));
      this.bus?.emit('paywall:unlocked', { reason: this._reason });
      setTimeout(() => this.hide(), 450);
    } else {
      this._flash(t('paywall.flash_failed'));
    }
  }

  async _restore() {
    if (this._busy || !this.billing) return;
    this._busy = true;
    this._flash(t('paywall.flash_restoring'));
    const result = await this.billing.restore();
    this._busy = false;
    if (result.ok) {
      this._flash(t('paywall.flash_restored'));
      this.bus?.emit('paywall:unlocked', { reason: this._reason });
      setTimeout(() => this.hide(), 450);
    } else if (result.reason === 'none') {
      this._flash(t('paywall.flash_none'));
    } else {
      this._flash(t('paywall.flash_restore_fail'));
    }
  }

  _flash(msg) {
    this._status = msg;
    this._statusUntil = performance.now() + 2200;
  }

  _layout() {
    const modalW = Math.min(420, CANVAS_WIDTH - 36);
    const modalH = Math.min(468, CANVAS_HEIGHT - 48);
    const modalX = (CANVAS_WIDTH - modalW) / 2;
    const modalY = Math.max(16, (CANVAS_HEIGHT - modalH) / 2 - 12);
    const btnW = modalW - 48;
    const btnH = 46;
    const unlock = {
      x: modalX + 24,
      y: modalY + modalH - 148,
      w: btnW,
      h: btnH
    };
    const restore = {
      x: modalX + 24,
      y: unlock.y + btnH + 10,
      w: btnW,
      h: btnH - 4
    };
    const close = {
      x: modalX + 24,
      y: restore.y + restore.h + 10,
      w: btnW,
      h: btnH - 6
    };
    return { modalX, modalY, modalW, modalH, unlock, restore, close };
  }

  render(renderer) {
    if (!this.open) return;
    const r = renderer;
    const ctx = r.ctx;
    const g = this._layout();
    const cap = this.billing?.freeFloorCap ?? 10;
    const price = this.billing?.priceLabel || '—';

    ctx.save();
    ctx.fillStyle = 'rgba(4, 2, 8, 0.72)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();

    drawIronPanel(ctx, g.modalX, g.modalY, g.modalW, g.modalH);

    const cx = CANVAS_WIDTH / 2;
    this._drawBrassDiamond(ctx, cx, g.modalY + 22, 7);

    r.drawText(t('paywall.title'), cx, g.modalY + 42, {
      size: uiSize(22), bold: true, align: 'center',
      family: FONT_DISPLAY, color: IRON_PALETTE.brass
    });
    r.drawText(t('paywall.subtitle'), cx, g.modalY + 64, {
      size: uiSize(12), italic: true, align: 'center',
      family: FONT_BODY, color: IRON_PALETTE.boneDim
    });

    const lines = this._reason === 'continue'
      ? [
        t('paywall.continue_deep'),
        t('paywall.continue_cap', { cap }),
        t('paywall.continue_unlock')
      ]
      : [
        t('paywall.cleared_free', { cap }),
        t('paywall.beyond')
      ];

    let y = g.modalY + 92;
    for (const line of lines) {
      r.drawText(line, cx, y, {
        size: uiSize(13), align: 'center',
        family: FONT_BODY, color: IRON_PALETTE.bone
      });
      y += 18;
    }

    y += 10;
    for (const key of BENEFIT_KEYS) {
      this._drawBenefitRow(r, ctx, cx, y, t(key), g.modalW);
      y += 20;
    }

    r.drawText(t('paywall.no_ads'), cx, Math.min(y + 8, g.unlock.y - 14), {
      size: uiSize(11), bold: true, align: 'center',
      family: FONT_MONO, color: COLOR.goldHi
    });

    drawIronActionButton(r, g.unlock.x, g.unlock.y, g.unlock.w, g.unlock.h,
      this._busy ? t('paywall.wait') : `${t('paywall.unlock')}  ·  ${price}`,
      { accent: IRON_PALETTE.brass, fontSize: uiSize(14) });
    drawIronActionButton(r, g.restore.x, g.restore.y, g.restore.w, g.restore.h,
      t('paywall.restore'),
      { accent: '#8a8098', fontSize: uiSize(12) });
    drawIronActionButton(r, g.close.x, g.close.y, g.close.w, g.close.h,
      t('paywall.not_now'),
      { accent: IRON_PALETTE.boneDim, fontSize: uiSize(12) });

    if (this._status && performance.now() < this._statusUntil) {
      r.drawText(this._status, cx, g.modalY + g.modalH - 16, {
        size: uiSize(11), align: 'center',
        family: FONT_MONO, color: COLOR.goldHi
      });
    }
  }

  _drawBenefitRow(r, ctx, cx, y, label, modalW) {
    const textW = Math.min(280, modalW - 72);
    const left = cx - textW / 2;
    // Brass bullet
    ctx.save();
    ctx.fillStyle = IRON_PALETTE.brass;
    ctx.beginPath();
    ctx.arc(left - 4, y + 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    r.drawText(label, left + 8, y, {
      size: uiSize(12), align: 'left',
      family: FONT_BODY, color: IRON_PALETTE.bone
    });
  }

  _drawBrassDiamond(ctx, cx, cy, half) {
    ctx.save();
    const g = ctx.createLinearGradient(cx, cy - half, cx, cy + half);
    g.addColorStop(0, IRON_PALETTE.brassHi);
    g.addColorStop(0.45, IRON_PALETTE.brass);
    g.addColorStop(1, IRON_PALETTE.brassDark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cy - half);
    ctx.lineTo(cx + half, cy);
    ctx.lineTo(cx, cy + half);
    ctx.lineTo(cx - half, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = IRON_PALETTE.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  _inside(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }
}
