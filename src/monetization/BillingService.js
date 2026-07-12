/**
 * BillingService — one-time Play Store unlock with a web/dev fallback.
 *
 * Native (Capacitor Android): @capgo/native-purchases + Google Play Billing.
 * Web / debug: mock unlock so freemium UX can be tested in the browser.
 */
import { Capacitor } from '@capacitor/core';
import { LOG } from '../config/constants.js';
import {
  PRODUCT_FULL_DESCENT, PRODUCTS, FALLBACK_PRICE_LABEL
} from './products.js';

export class BillingService {
  /**
   * @param {{ metaProgress:object, eventBus:object, balance?:object }} deps
   */
  constructor({ metaProgress, eventBus, balance }) {
    this.meta = metaProgress;
    this.bus = eventBus;
    this.balance = balance || {};
    this._native = null;
    this._purchaseType = null;
    this._priceLabel = FALLBACK_PRICE_LABEL;
    this._ready = false;
    this._busy = false;
    this._lastError = '';
  }

  get productId() {
    return this.balance?.monetization?.productId || PRODUCT_FULL_DESCENT;
  }

  get freeFloorCap() {
    return this.balance?.monetization?.freeFloorCap ?? 10;
  }

  get priceLabel() {
    return this._priceLabel || FALLBACK_PRICE_LABEL;
  }

  get isNative() {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  }

  isPremium() {
    return !!this.meta?.isPremium?.() || !!this.meta?.state?.premiumUnlocked;
  }

  /**
   * Floors are 0-indexed. Cap 10 → indices 0..9 free; index 10+ needs premium.
   * Tutorial mode is always free.
   */
  canAccessFloorIndex(floorIndex, mode = 'normal') {
    if (mode === 'tutorial') return true;
    if (this.isPremium()) return true;
    return (floorIndex || 0) < this.freeFloorCap;
  }

  /** True when standing on the last free floor and about to descend deeper. */
  needsUnlockToDescend(currentIndex, mode = 'normal') {
    if (mode === 'tutorial') return false;
    if (this.isPremium()) return false;
    return (currentIndex || 0) + 1 >= this.freeFloorCap;
  }

  async init() {
    if (this._ready) return;
    if (!this.isNative) {
      this._ready = true;
      // Optional web QA: ?premium=1 unlocks immediately.
      try {
        const params = new URLSearchParams(window.location.search || '');
        if (params.get('premium') === '1' && !this.isPremium()) {
          this._grantPremium('web_query');
        }
      } catch { /* ignore */ }
      return;
    }
    try {
      const mod = await import('@capgo/native-purchases');
      this._native = mod.NativePurchases;
      this._purchaseType = mod.PURCHASE_TYPE?.INAPP || 'inapp';
      const supported = await this._native.isBillingSupported();
      if (supported?.isBillingSupported === false) {
        this._lastError = 'Billing not supported on this device';
        console.warn(LOG.CORE, this._lastError);
      } else {
        await this._refreshProduct();
        await this.restore({ silent: true });
      }
    } catch (err) {
      this._lastError = err?.message || String(err);
      console.warn(LOG.CORE, 'Billing init failed:', err);
    }
    this._ready = true;
  }

  async _refreshProduct() {
    if (!this._native) return;
    try {
      const { products } = await this._native.getProducts({
        productIdentifiers: [this.productId],
        productType: this._purchaseType
      });
      const p = products?.[0];
      if (p?.priceString) this._priceLabel = p.priceString;
      else if (p?.price) this._priceLabel = String(p.price);
    } catch (err) {
      console.warn(LOG.CORE, 'getProducts failed:', err);
    }
  }

  /**
   * Launch the store purchase sheet (or mock unlock on web).
   * @returns {Promise<{ ok:boolean, reason?:string }>}
   */
  async purchase() {
    if (this.isPremium()) return { ok: true, reason: 'already' };
    if (this._busy) return { ok: false, reason: 'busy' };
    this._busy = true;
    this._lastError = '';
    try {
      if (!this.isNative) {
        this._grantPremium('web_mock');
        return { ok: true, reason: 'web_mock' };
      }
      if (!this._native) await this.init();
      if (!this._native) {
        return { ok: false, reason: 'unavailable' };
      }
      await this._native.purchaseProduct({
        productIdentifier: this.productId,
        productType: this._purchaseType,
        quantity: 1
      });
      this._grantPremium('purchase');
      return { ok: true, reason: 'purchase' };
    } catch (err) {
      this._lastError = err?.message || String(err);
      console.warn(LOG.CORE, 'purchase failed:', err);
      const msg = (this._lastError || '').toLowerCase();
      if (msg.includes('cancel')) return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: 'error' };
    } finally {
      this._busy = false;
    }
  }

  /**
   * Restore prior purchases (reinstall / new device).
   * @param {{ silent?:boolean }} [opts]
   */
  async restore(opts = {}) {
    if (this.isPremium() && opts.silent) return { ok: true, reason: 'already' };
    if (this._busy) return { ok: false, reason: 'busy' };
    this._busy = true;
    this._lastError = '';
    try {
      if (!this.isNative) {
        if (this.isPremium()) return { ok: true, reason: 'already' };
        return { ok: false, reason: 'none' };
      }
      if (!this._native) await this.init();
      if (!this._native) return { ok: false, reason: 'unavailable' };

      const result = await this._native.restorePurchases();
      const purchases = result?.purchases || result?.transactions || [];
      const owned = Array.isArray(purchases)
        ? purchases.some((p) => {
          const id = p.productIdentifier || p.productId || p.sku;
          return id === this.productId;
        })
        : false;

      // Some plugin versions only sync entitlements into getPurchases().
      if (!owned && typeof this._native.getPurchases === 'function') {
        try {
          const gp = await this._native.getPurchases();
          const list = gp?.purchases || [];
          if (list.some((p) => (p.productIdentifier || p.productId) === this.productId)) {
            this._grantPremium('restore');
            return { ok: true, reason: 'restore' };
          }
        } catch { /* ignore */ }
      }

      if (owned) {
        this._grantPremium('restore');
        return { ok: true, reason: 'restore' };
      }
      return { ok: false, reason: 'none' };
    } catch (err) {
      this._lastError = err?.message || String(err);
      console.warn(LOG.CORE, 'restore failed:', err);
      return { ok: false, reason: 'error' };
    } finally {
      this._busy = false;
    }
  }

  _grantPremium(source) {
    if (this.meta?.unlockPremium) this.meta.unlockPremium({ source });
    else if (this.meta?.state) {
      this.meta.state.premiumUnlocked = true;
      this.meta.state.premiumUnlockedAt = Date.now();
      this.meta.state.premiumSource = source;
    }
    this.bus?.emit('billing:unlocked', {
      productId: this.productId,
      source,
      product: PRODUCTS[this.productId]
    });
  }

  productCopy() {
    return PRODUCTS[this.productId] || PRODUCTS[PRODUCT_FULL_DESCENT];
  }
}
