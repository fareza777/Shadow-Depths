/**
 * Play Store product catalog.
 *
 * The game is free: all 100 floors are open to everyone. The only paid item
 * is a one-time "Remove Ads" unlock.
 *
 * LEGACY_ENTITLEMENT_IDS matters for players who bought the old
 * `full_descent_unlock` product back when floors 11+ were paywalled. Owning it
 * still grants the ad-free entitlement, so nobody who already paid ever sees
 * an ad — restore() checks every id in this list, not just the one on sale.
 */
export const PRODUCT_REMOVE_ADS = 'remove_ads';

/** Retired: the pre-0.3.0 full-game unlock. Still honoured as ad-free. */
export const PRODUCT_FULL_DESCENT = 'full_descent_unlock';

/** Every product id that grants the ad-free entitlement. */
export const LEGACY_ENTITLEMENT_IDS = Object.freeze([
  PRODUCT_REMOVE_ADS,
  PRODUCT_FULL_DESCENT
]);

export const PRODUCTS = Object.freeze({
  [PRODUCT_REMOVE_ADS]: Object.freeze({
    id: PRODUCT_REMOVE_ADS,
    kind: 'non_consumable',
    title: 'Remove Ads',
    blurb: 'Play the whole descent ad-free. One purchase, forever.'
  }),
  [PRODUCT_FULL_DESCENT]: Object.freeze({
    id: PRODUCT_FULL_DESCENT,
    kind: 'non_consumable',
    title: 'Remove Ads',
    blurb: 'Play the whole descent ad-free. One purchase, forever.'
  })
});

/** Default display price when the store catalog is unavailable (web / offline). */
export const FALLBACK_PRICE_LABEL = 'Rp 29.000';
