/**
 * Play Store product catalog — one-time unlock for full 100-floor descent.
 *
 * Create this managed product in Google Play Console (Monetize → Products
 * → In-app products) with the same productId before shipping.
 */
export const PRODUCT_FULL_DESCENT = 'full_descent_unlock';

export const PRODUCTS = Object.freeze({
  [PRODUCT_FULL_DESCENT]: Object.freeze({
    id: PRODUCT_FULL_DESCENT,
    kind: 'non_consumable',
    title: 'Full Descent',
    blurb: 'Unlock all 100 floors. One purchase, forever.'
  })
});

/** Default display price when the store catalog is unavailable (web / offline). */
export const FALLBACK_PRICE_LABEL = 'Rp 29.000';
