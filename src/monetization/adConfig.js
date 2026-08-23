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
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  appOpen: 'ca-app-pub-3940256099942544/9257395921'
});

/** Google's sample App ID. Mirrors the value in AndroidManifest.xml. */
export const TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

export const AD_DEFAULTS = Object.freeze({
  enabled: true,
  /**
   * Fallback strip height until the SDK reports the real banner size. The
   * bannerAdSizeChanged event replaces this with the measured height, which
   * is what keeps an adaptive banner from ever overlapping the HUD.
   */
  bannerHeightDp: 50,
  /** Menu scenes have room to spare — adaptive earns more than fixed 320x50. */
  bannerSize: 'ADAPTIVE_BANNER',
  /** In-dungeon the viewport is tight, so use the smallest standard banner. */
  gameplayBannerSize: 'BANNER',
  /** Scene name treated as "in a run" for banner sizing. */
  gameplayScene: 'game',
  /** Minimum gap between App Open ads. Never shown on a first-ever launch. */
  appOpenMinIntervalMs: 4 * 60 * 60 * 1000,
  /** Rewarded skill rerolls allowed per run, once the free ones are spent. */
  rewardedRerollPerRun: 2,
  /** Show an interstitial on every Nth descent. */
  interstitialEveryNFloors: 3,
  /** Never interrupt before this floor index — keep the first minutes clean. */
  interstitialMinFloorIndex: 3,
  /** Only these non-combat scenes may reserve a banner. */
  eligibleScenes: Object.freeze(['title', 'pause', 'gameover', 'victory']),
  /** Avoid back-to-back interstitials after a long or repeated transition. */
  interstitialCooldownMs: 90000,
  /** Rewarded revives allowed per run. */
  rewardedRevivePerRun: 1
});

const APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/;
const UNIT_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/;
const PUBLISHER_ID_PATTERN = /^pub-\d{16}$/;

function isGoogleSampleId(value) {
  return value === TEST_APP_ID || Object.values(TEST_AD_UNITS).includes(value);
}

/**
 * Validate the public AdMob identifiers required by a production build.
 * Error messages intentionally describe only the failing category, never the
 * identifier value itself.
 */
export function validateAdIds({
  appId,
  banner,
  interstitial,
  rewarded,
  appOpen,
  publisherId,
  release = false
} = {}) {
  const errors = [];
  const appOk = APP_ID_PATTERN.test(appId || '');
  const unitOk = (value) => UNIT_ID_PATTERN.test(value || '');
  const publisherOk = PUBLISHER_ID_PATTERN.test(publisherId || '');

  if (release && !appOk) errors.push('AdMob App ID is missing or malformed');
  if (release && !unitOk(banner)) errors.push('AdMob banner unit ID is missing or malformed');
  if (release && !unitOk(interstitial)) errors.push('AdMob interstitial unit ID is missing or malformed');
  if (release && !unitOk(rewarded)) errors.push('AdMob rewarded unit ID is missing or malformed');
  // appOpen is checked like the rest: leaving it on a sample unit flips
  // usingTestUnits, which forces isTesting on EVERY format. A release that
  // passed this gate while appOpen was still a sample would ship real-looking
  // ads that earn nothing.
  if (release && !unitOk(appOpen)) errors.push('AdMob app open unit ID is missing or malformed');
  if (release && !publisherOk) errors.push('AdMob publisher ID is missing or malformed');
  if (release && [appId, banner, interstitial, rewarded, appOpen].some(isGoogleSampleId)) {
    errors.push('Google sample ad IDs are debug-only');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Merge balance config over the defaults and resolve unit ids.
 * @param {object} [monetization] balance.monetization
 * @param {object} [env] Vite-style environment overrides (injectable in tests)
 */
export function resolveAdConfig(monetization = {}, env) {
  const raw = monetization.ads || {};
  const ids = raw.unitIds || {};
  const runtimeEnv = env === undefined ? (import.meta.env || {}) : (env || {});
  const envValue = (key) => typeof runtimeEnv[key] === 'string' ? runtimeEnv[key].trim() : '';
  const rawValue = (key) => typeof raw[key] === 'string' ? raw[key].trim() : '';
  const pickPublic = (envKey, rawKey) => envValue(envKey) || rawValue(rawKey);
  const pick = (key) => {
    const envId = envValue(`VITE_ADMOB_${key.toUpperCase()}_ID`);
    const jsonId = typeof ids[key] === 'string' ? ids[key].trim() : '';
    return envId || jsonId || TEST_AD_UNITS[key];
  };
  const appId = pickPublic('VITE_ADMOB_APP_ID', 'appId') || TEST_APP_ID;
  const publisherId = pickPublic('VITE_ADMOB_PUBLISHER_ID', 'publisherId');
  const banner = pick('banner');
  const interstitial = pick('interstitial');
  const rewarded = pick('rewarded');
  const appOpen = pick('appOpen');
  // Any fallback in play means we are not on the live account — never let the
  // SDK treat these as production requests.
  const usingTestUnits = banner === TEST_AD_UNITS.banner
    || interstitial === TEST_AD_UNITS.interstitial
    || rewarded === TEST_AD_UNITS.rewarded
    || appOpen === TEST_AD_UNITS.appOpen;
  const usingTestAppId = appId === TEST_APP_ID;
  const releaseReady = validateAdIds({
    appId,
    banner,
    interstitial,
    rewarded,
    appOpen,
    publisherId,
    release: true
  }).ok;

  return {
    ...AD_DEFAULTS,
    ...raw,
    appId,
    publisherId,
    unitIds: { banner, interstitial, rewarded, appOpen },
    eligibleScenes: Array.isArray(raw.eligibleScenes)
      ? [...raw.eligibleScenes]
      : [...AD_DEFAULTS.eligibleScenes],
    testMode: raw.testMode === true || usingTestUnits || usingTestAppId,
    usingTestUnits: usingTestUnits || usingTestAppId,
    releaseReady
  };
}
