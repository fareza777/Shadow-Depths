/**
 * AdService — AdMob banner / interstitial / rewarded, with a hard ad-free gate.
 *
 * Three rules shape everything here:
 *   1. Owning the ad-free entitlement removes every ad immediately, including
 *      a banner already on screen (see the billing:unlocked handler).
 *   2. Ads never cover the controls. The banner is pinned TOP_CENTER and the
 *      page reserves an equal strip above the canvas, so it sits in dead space
 *      rather than over the HUD, D-pad or action buttons.
 *   3. Nothing here may break the game. Every call is wrapped: on web, on a
 *      device without Play Services, or when the SDK throws, the service goes
 *      inert and the game carries on ad-free.
 */
import { Capacitor } from '@capacitor/core';
import { LOG } from '../config/constants.js';
import { resolveAdConfig } from './adConfig.js';

const BANNER_RESERVE_VAR = '--ad-banner-reserve';

export class AdService {
  /**
   * @param {{ billing:object, eventBus:object, balance?:object }} deps
   */
  constructor({ billing, eventBus, balance }) {
    this.billing = billing;
    this.bus = eventBus;
    this.config = resolveAdConfig(balance?.monetization);

    this._admob = null;
    this._ready = false;
    this._bannerVisible = false;
    this._interstitialLoaded = false;
    this._rewardedLoaded = false;
    this._descentsSinceAd = 0;
    this._lastInterstitialAt = 0;
    this._revivesUsedThisRun = 0;
    this._canRequestAds = false;
    this._npaRequired = false;
    this._consentInfo = null;
    this._lastError = '';

    this.bus?.on?.('billing:unlocked', () => { this.removeAllAds(); });
    this.bus?.on?.('run:started', (payload = {}) => {
      if (payload.revived) return;
      this._revivesUsedThisRun = 0;
      this._descentsSinceAd = 0;
    });
  }

  get isNative() {
    try { return Capacitor.isNativePlatform(); } catch { return false; }
  }

  /** Ads are off for owners, when disabled in config, and everywhere but native. */
  get adsDisabled() {
    return !this.config.enabled
      || !this.isNative
      || !!this.billing?.adsRemoved?.();
  }

  get lastError() { return this._lastError; }

  /** True once UMP has either allowed ads or failed in a recoverable way. */
  get canRequestAds() { return this._canRequestAds; }

  /**
   * True when consent is unknown, so ad requests must be non-personalised.
   * Passed to every ad call as `npa`.
   */
  get npaRequired() { return this._npaRequired; }

  async init() {
    if (this._ready || this.adsDisabled) return;
    // Only a real refusal keeps us out; an unavailable verdict falls through
    // to non-personalised ads (see _requestConsent).
    if (this._consentInfo && !this._canRequestAds) return;
    try {
      const mod = await import('@capacitor-community/admob');
      if (!this._admob) this._admob = mod.AdMob;
      if (!this._consentInfo) await this._requestConsent(mod);
      if (!this._canRequestAds) return;
      await this._admob.initialize({
        initializeForTesting: this.config.testMode,
        testingDevices: this.config.testingDevices || []
      });
      this._ready = true;
      if (this.config.usingTestUnits) {
        console.warn(LOG.CORE,
          'AdMob on TEST units — no revenue. Set monetization.ads.unitIds in balance.json.');
      }
      // Warm the cached formats so the first interstitial / revive is instant.
      this._preloadInterstitial();
      this._preloadRewarded();
    } catch (err) {
      this._lastError = err?.message || String(err);
      console.warn(LOG.CORE, 'AdMob init failed — running ad-free:', err);
      this._admob = null;
    }
  }

  /**
   * EU consent (UMP).
   *
   * Two outcomes must be told apart, because conflating them costs every
   * cent of revenue:
   *
   *   - UMP answered and said no (user declined in the EEA/UK). Respect it:
   *     no ads at all.
   *   - UMP could not answer — no consent form published for this app ID,
   *     no network, SDK error. That is OUR misconfiguration, not a user
   *     refusal, and it says nothing about whether this player needs consent
   *     in the first place. Blocking here silently disabled ads worldwide,
   *     including for the vast majority of players outside the EEA.
   *
   * On a failure we therefore proceed but force non-personalised ads, which
   * is the setting that needs no consent anywhere.
   */
  async _requestConsent(mod) {
    try {
      const info = await this._admob.requestConsentInfo();
      const REQUIRED = mod.AdmobConsentStatus?.REQUIRED || 'REQUIRED';
      let resolvedInfo = info;
      if (info?.isConsentFormAvailable && info?.status === REQUIRED) {
        const formResult = await this._admob.showConsentForm();
        if (formResult && typeof formResult.canRequestAds === 'boolean') {
          resolvedInfo = formResult;
        } else {
          resolvedInfo = await this._admob.requestConsentInfo();
        }
      }
      if (resolvedInfo && typeof resolvedInfo.canRequestAds === 'boolean') {
        this._consentInfo = resolvedInfo;
        this._canRequestAds = resolvedInfo.canRequestAds;
        // Consent still outstanding while the SDK allows requests → NPA.
        this._npaRequired = resolvedInfo.status === REQUIRED;
        return this._consentInfo;
      }
      // No usable verdict — treat as unknown, not as refusal.
      return this._consentUnavailable('consent info incomplete');
    } catch (err) {
      return this._consentUnavailable(err?.message || err);
    }
  }

  /** UMP gave no usable answer: keep serving, but non-personalised only. */
  _consentUnavailable(reason) {
    this._consentInfo = { canRequestAds: true, status: 'UNKNOWN' };
    this._canRequestAds = true;
    this._npaRequired = true;
    console.warn(LOG.CORE,
      'AdMob consent unavailable — serving non-personalised ads:', reason);
    return this._consentInfo;
  }

  // --- banner ---------------------------------------------------------
  /**
   * Show the banner in a strip reserved above the canvas. Reserving first,
   * then showing, means the canvas has already shrunk by the time the native
   * view appears — it can never land on top of the HUD or the controls.
   */
  async showBanner() {
    if (this.adsDisabled || this._bannerVisible) return;
    if (!this._ready) await this.init();
    if (!this._admob || !this._ready) return;
    try {
      const mod = await import('@capacitor-community/admob');
      this._reserveBannerStrip(this.config.bannerHeightDp);
      await this._admob.showBanner({
        adId: this.config.unitIds.banner,
        adSize: mod.BannerAdSize?.BANNER || 'BANNER',
        position: mod.BannerAdPosition?.TOP_CENTER || 'TOP_CENTER',
        margin: 0,
        isTesting: this.config.testMode,
        npa: this._npaRequired
      });
      this._bannerVisible = true;
    } catch (err) {
      this._lastError = err?.message || String(err);
      console.warn(LOG.CORE, 'showBanner failed:', err);
      this._reserveBannerStrip(0);
    }
  }

  async hideBanner() {
    if (this._bannerVisible && this._admob) {
      try {
        await this._admob.hideBanner();
      } catch (err) {
        console.warn(LOG.CORE, 'hideBanner failed:', err);
      }
    }
    this._bannerVisible = false;
    this._reserveBannerStrip(0);
  }

  /** Route a scene transition to a safe banner placement or a hidden strip. */
  async onSceneChanged(sceneName) {
    const eligible = this.config.eligibleScenes?.includes?.(sceneName);
    return eligible ? this.showBanner() : this.hideBanner();
  }

  /**
   * Shrink the page by `dp` at the top and let the canvas re-fit. The resize
   * event is what drives syncLayoutFromWindow in the Renderer, so dispatching
   * it keeps HUD geometry and tap hit-tests in agreement with what is drawn.
   */
  _reserveBannerStrip(dp) {
    if (typeof document === 'undefined') return;
    try {
      document.documentElement.style.setProperty(BANNER_RESERVE_VAR, `${dp || 0}px`);
      window.dispatchEvent(new Event('resize'));
    } catch { /* non-DOM context */ }
  }

  // --- interstitial ---------------------------------------------------
  async _preloadInterstitial() {
    if (this.adsDisabled || !this._admob || this._interstitialLoaded) return;
    try {
      await this._admob.prepareInterstitial({
        adId: this.config.unitIds.interstitial,
        isTesting: this.config.testMode,
        npa: this._npaRequired
      });
      this._interstitialLoaded = true;
    } catch (err) {
      console.warn(LOG.CORE, 'prepareInterstitial failed:', err?.message || err);
    }
  }

  /**
   * Called on each descent. Shows an interstitial every Nth floor, never
   * before `interstitialMinFloorIndex`, so the opening minutes stay clean.
   * @param {number} floorIndex the floor just entered (0-based)
   * @returns {Promise<boolean>} true if an ad was shown
   */
  async onDescend(floorIndex) {
    if (this.adsDisabled) return false;
    if ((floorIndex || 0) < this.config.interstitialMinFloorIndex) return false;
    const now = Date.now();
    if (this._lastInterstitialAt > 0
      && now - this._lastInterstitialAt < this.config.interstitialCooldownMs) {
      return false;
    }
    this._descentsSinceAd += 1;
    if (this._descentsSinceAd < this.config.interstitialEveryNFloors) return false;

    if (!this._ready) await this.init();
    if (!this._admob || !this._ready) return false;
    if (!this._interstitialLoaded) await this._preloadInterstitial();
    if (!this._interstitialLoaded) return false;

    this._descentsSinceAd = 0;
    try {
      await this._admob.showInterstitial();
      this._interstitialLoaded = false;
      this._lastInterstitialAt = Date.now();
      this._preloadInterstitial();
      return true;
    } catch (err) {
      this._lastError = err?.message || String(err);
      console.warn(LOG.CORE, 'showInterstitial failed:', err);
      this._interstitialLoaded = false;
      return false;
    }
  }

  // --- rewarded revive ------------------------------------------------
  async _preloadRewarded() {
    if (this.adsDisabled || !this._admob || this._rewardedLoaded) return;
    try {
      await this._admob.prepareRewardVideoAd({
        adId: this.config.unitIds.rewarded,
        isTesting: this.config.testMode,
        npa: this._npaRequired
      });
      this._rewardedLoaded = true;
    } catch (err) {
      console.warn(LOG.CORE, 'prepareRewardVideoAd failed:', err?.message || err);
    }
  }

  /** True when a revive offer should appear on the death screen. */
  canOfferRevive() {
    if (this.adsDisabled) return false;
    if (this._consentInfo && !this._canRequestAds) return false;
    return this._revivesUsedThisRun < this.config.rewardedRevivePerRun;
  }

  /** Revives already spent this run. */
  get revivesUsedThisRun() { return this._revivesUsedThisRun; }

  /**
   * Play the rewarded ad. Resolves true ONLY when the SDK reports a reward, so
   * a player who backs out of the video early does not get a free revive.
   * @returns {Promise<boolean>}
   */
  async showRewardedRevive() {
    if (!this.canOfferRevive()) return false;
    if (!this._ready) await this.init();
    if (!this._admob || !this._ready) return false;
    if (!this._rewardedLoaded) await this._preloadRewarded();
    if (!this._rewardedLoaded) return false;
    try {
      const reward = await this._admob.showRewardVideoAd();
      this._rewardedLoaded = false;
      this._preloadRewarded();
      const earned = typeof reward?.type === 'string'
        ? reward.type.trim().length > 0
        : !!reward?.type;
      if (earned) this._revivesUsedThisRun += 1;
      return earned;
    } catch (err) {
      this._lastError = err?.message || String(err);
      console.warn(LOG.CORE, 'showRewardVideoAd failed:', err);
      this._rewardedLoaded = false;
      return false;
    }
  }

  /** Tear every ad down — called the moment the removal is purchased. */
  async removeAllAds() {
    this._interstitialLoaded = false;
    this._rewardedLoaded = false;
    if (!this._admob) {
      this._reserveBannerStrip(0);
      return;
    }
    try { await this._admob.removeBanner(); } catch { /* no banner up */ }
    this._bannerVisible = false;
    this._reserveBannerStrip(0);
  }
}
