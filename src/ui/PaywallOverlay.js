/**
 * PaywallOverlay — one-time unlock modal for Full Descent.
 */
import {
  COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize
} from '../config/constants.js';
import { drawIronPanel, drawIronActionButton, IRON_PALETTE } from './ironPanel.js';
import { t } from '../content/i18n.js';

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
    this._flash('Opening Play Store…');
    const result = await this.billing.purchase();
    this._busy = false;
    if (result.ok) {
      this._flash('Full Descent unlocked!');
      this.bus?.emit('paywall:unlocked', { reason: this._reason });
      setTimeout(() => this.hide(), 450);
    } else if (result.reason === 'cancelled') {
      this._flash('Purchase cancelled');
    } else if (result.reason === 'web_mock') {
      this._flash('Unlocked (dev)');
      this.bus?.emit('paywall:unlocked', { reason: this._reason });
      setTimeout(() => this.hide(), 450);
    } else {
      this._flash('Purchase failed — try Restore');
    }
  }

  async _restore() {
    if (this._busy || !this.billing) return;
    this._busy = true;
    this._flash('Restoring…');
    const result = await this.billing.restore();
    this._busy = false;
    if (result.ok) {
      this._flash('Purchases restored!');
      this.bus?.emit('paywall:unlocked', { reason: this._reason });
      setTimeout(() => this.hide(), 450);
    } else if (result.reason === 'none') {
      this._flash('No purchase found');
    } else {
      this._flash('Restore failed');
    }
  }

  _flash(msg) {
    this._status = msg;
    this._statusUntil = performance.now() + 2200;
  }

  _layout() {
    const modalW = Math.min(400, CANVAS_WIDTH - 40);
    const modalH = Math.min(420, CANVAS_HEIGHT - 60);
    const modalX = (CANVAS_WIDTH - modalW) / 2;
    const modalY = Math.max(24, (CANVAS_HEIGHT - modalH) / 2 - 20);
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
    const copy = this.billing?.productCopy?.() || {};

    ctx.save();
    ctx.fillStyle = 'rgba(4, 2, 8, 0.72)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();

    drawIronPanel(ctx, g.modalX, g.modalY, g.modalW, g.modalH);

    const cx = CANVAS_WIDTH / 2;
    r.drawText(t('paywall.title'), cx, g.modalY + 28, {
      size: uiSize(22), bold: true, align: 'center',
      family: FONT_DISPLAY, color: IRON_PALETTE.brass
    });
    r.drawText(t('paywall.subtitle'), cx, g.modalY + 52, {
      size: uiSize(12), italic: true, align: 'center',
      family: FONT_BODY, color: IRON_PALETTE.boneDim
    });

    const lines = this._reason === 'continue'
      ? [
        'Your saved run is deeper than the free trial.',
        `Free players may explore floors 1–${cap}.`,
        'Unlock Full Descent to continue this run',
        'and every floor beyond — forever.'
      ]
      : [
        `You cleared the free depths (floors 1–${cap}).`,
        'Beyond lies the rest of the 100-floor descent:',
        'bosses, biomes, vaults, and the final seal.',
        copy.blurb || 'One purchase unlocks unlimited floors.'
      ];

    let y = g.modalY + 84;
    for (const line of lines) {
      r.drawText(line, cx, y, {
        size: uiSize(13), align: 'center',
        family: FONT_BODY, color: IRON_PALETTE.bone
      });
      y += 20;
    }

    r.drawText(t('paywall.no_ads'), cx, y + 12, {
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

  _inside(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }
}
