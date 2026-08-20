/**
 * Ad configuration.
 *
 * Unit ids live in data/balance.json under `monetization.ads.unitIds` so they
 * can be swapped without a code change. When an id is blank the service falls
 * back to Google's public TEST unit and forces test mode on — that way a
 * misconfigured build shows test ads instead of either crashing or, far worse,
 * serving live ads against the wrong account.
 *
 * @see https://developers.google.com/admob/android/test-ads
 */

/** Google's official sample units. Safe to develop against; earn nothing. */
export const TEST_AD_UNITS = Object.freeze({
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917'
});

/** Google's sample App ID. Mirrors the value in AndroidManifest.xml. */
export const TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

export const AD_DEFAULTS = Object.freeze({
  enabled: true,
  /** Height reserved above the canvas so the banner never covers the HUD. */
  bannerHeightDp: 50,
  /** Show an interstitial on every Nth descent. */
  interstitialEveryNFloors: 3,
  /** Never interrupt before this floor index — keep the first minutes clean. */
  interstitialMinFloorIndex: 3,
  /** Rewarded revives allowed per run. */
  rewardedRevivePerRun: 1
});

/**
 * Merge balance config over the defaults and resolve unit ids.
 * @param {object} [monetization] balance.monetization
 */
export function resolveAdConfig(monetization = {}) {
  const raw = monetization.ads || {};
  const ids = raw.unitIds || {};
  const pick = (key) => {
    const id = typeof ids[key] === 'string' ? ids[key].trim() : '';
    return id || TEST_AD_UNITS[key];
  };
  const banner = pick('banner');
  const interstitial = pick('interstitial');
  const rewarded = pick('rewarded');
  // Any fallback in play means we are not on the live account — never let the
  // SDK treat these as production requests.
  const usingTestUnits = banner === TEST_AD_UNITS.banner
    || interstitial === TEST_AD_UNITS.interstitial
    || rewarded === TEST_AD_UNITS.rewarded;

  return {
    ...AD_DEFAULTS,
    ...raw,
    unitIds: { banner, interstitial, rewarded },
    testMode: raw.testMode === true || usingTestUnits,
    usingTestUnits
  };
}
