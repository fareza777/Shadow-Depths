/**
 * BillingService — one-time "Remove Ads" purchase with a web/dev fallback.
 *
 * The game itself is free: every floor is open to every player. The only
 * entitlement this service manages is ad removal.
 *
 * Players who bought the retired `full_descent_unlock` product keep their
 * entitlement — restore() matches every id in LEGACY_ENTITLEMENT_IDS, so an
 * existing owner is silently upgraded to ad-free on the next launch.
 *
 * Native (Capacitor Android): @capgo/native-purchases + Google Play Billing.
 * Web / debug: mock unlock so the offer UX can be tested in the browser.
 */
import { Capacitor } from '@capacitor/core';
import { LOG } from '../config/constants.js';
import {
  PRODUCT_REMOVE_ADS, PRODUCT_FULL_DESCENT, PRODUCTS,
  LEGACY_ENTITLEMENT_IDS, FALLBACK_PRICE_LABEL
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

  /** The product actually offered for sale. */
  get productId() {
    return this.balance?.monetization?.productId || PRODUCT_REMOVE_ADS;
  }

  /**
   * Every id that grants ad-free, newest first. Owning ANY of them is enough,
   * which is what keeps pre-0.3.0 `full_descent_unlock` buyers whole.
   */
  get entitlementIds() {
    const configured = this.balance?.monetization?.entitlementIds;
    const ids = Array.isArray(configured) && configured.length
      ? configured
      : LEGACY_ENTITLEMENT_IDS;
    return ids.includes(this.productId) ? ids : [this.productId, ...ids];
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

  /**
   * True when the player owns the ad-free entitlement. The persisted flag is
   * still called `premiumUnlocked` so existing saves keep their purchase; its
   * meaning changed from "floors unlocked" to "ads removed".
   */
  isPremium() {
    return !!this.meta?.isPremium?.() || !!this.meta?.state?.premiumUnlocked;
  }

  /** Ads are shown to everyone who has not bought the removal. */
  adsRemoved() {
    return this.isPremium();
  }

  /**
   * Every floor is free now. Kept so older call sites and saved runs keep
   * working without a migration; it simply never blocks.
   */
  canAccessFloorIndex(_floorIndex, _mode = 'normal') {
    return true;
  }

  /** Descending is never gated. */
  needsUnlockToDescend(_currentIndex, _mode = 'normal') {
    return false;
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

      const entitled = new Set(this.entitlementIds);
      const ownsAny = (list) => Array.isArray(list) && list.some((p) => {
        const id = p?.productIdentifier || p?.productId || p?.sku;
        return !!id && entitled.has(id);
      });

      const result = await this._native.restorePurchases();
      const owned = ownsAny(result?.purchases || result?.transactions || []);

      // Some plugin versions only sync entitlements into getPurchases().
      if (!owned && typeof this._native.getPurchases === 'function') {
        try {
          const gp = await this._native.getPurchases();
          if (ownsAny(gp?.purchases || [])) {
            this._grantPremium('restore_legacy');
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
    return PRODUCTS[this.productId]
      || PRODUCTS[PRODUCT_REMOVE_ADS]
      || PRODUCTS[PRODUCT_FULL_DESCENT];
  }
}
