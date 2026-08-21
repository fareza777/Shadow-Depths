# Ads Monetization and Legacy Entitlement Design

## Goal

Make Shadow Depths a free-with-ads Android game while preserving a permanent,
ad-free experience for both the new `remove_ads` purchase (US$4.99 in the base
price) and every player who previously purchased `full_descent_unlock`.

The game must remain playable when an ad SDK, consent form, Play Services, or
network request is unavailable. Ads must be shown only at deliberate pauses and
must not cover the combat HUD or add work to the active turn/render path.

## Current state and constraints

- `BillingService` already treats `remove_ads` as the current product and
  `full_descent_unlock` as a legacy entitlement, but the fallback price and
  store copy are stale.
- `AdService` already wraps the Capacitor Community AdMob plugin and has banner,
  interstitial, and rewarded primitives. It is not yet wired to a rewarded
  game-over action, has no `canRequestAds` gate, and currently shows a banner
  globally after boot.
- The Android project has the JavaScript dependency in `package.json`, but the
  generated Capacitor Android project has not yet been synced with the AdMob
  native plugin.
- The manifest and ad configuration contain Google's sample IDs. They remain
  valid for local testing only. A production release requires the developer's
  real App ID, banner/interstitial/rewarded unit IDs, and publisher ID.
- `public/app-ads.txt` is absent. It can only contain a valid production
  publisher ID; the implementation must not invent one.
- Existing user saves keep the `premiumUnlocked` flag. Its meaning is the
  ad-free entitlement, so the migration must remain backward compatible.

## Product and entitlement model

`remove_ads` remains the only product offered to new users. Its catalog copy
describes a one-time US$4.99 purchase, while Play Billing supplies the
localized price at runtime. `full_descent_unlock` is not offered for new
purchase, but remains in the restore entitlement set forever.

`BillingService.adsRemoved()` is the single entitlement gate. The gate is
consulted before AdMob initialization, consent display, preloading, banner
reservation, interstitial presentation, and rewarded presentation. The
`billing:unlocked` event tears down a banner and clears all in-memory ad state
immediately. Restore runs before ad initialization on native startup to prevent
an ad flash for an existing owner.

All floors remain free. No ad flow can block descending, loading a save, or
starting a run.

## Ad lifecycle and placement

### Consent and initialization

On every native launch, `AdService` requests UMP consent information. If a form
is required, it is shown before initializing/serving ads. The service continues
without ads when the SDK reports `canRequestAds === false`, when the user is an
ad-free owner, or when initialization fails. Web builds and unsupported devices
remain inert.

Production builds must fail validation when any live ID is missing or still a
Google sample ID. Debug/test builds may use Google's sample App ID and unit IDs.

### Banner

The native banner is displayed only on non-combat scenes: title/menu, pause or
settings, game-over, and victory. The service reserves the banner strip before
showing it and releases that strip when hiding/removing it, so the canvas and
hit-tests remain aligned. It is hidden during active floor play, cinematic
transitions, and modal reward/purchase flows.

### Interstitial

Interstitials are prepared in the background and shown only after a successful
floor transition has been saved. The default cadence is every third eligible
descent, never before floor index 3, with a cooldown that prevents a second
full-screen ad during the same short transition window. A failed load/show is a
no-op and never delays the game.

### Rewarded revive

The death flow retains the latest valid run snapshot before finalizing the run.
The game-over screen receives a single explicit `WATCH AD TO REVIVE` action when
the player is not ad-free and has not used the per-run reward. The action:

1. asks `AdService` to show a prepared rewarded ad;
2. grants a reward only when the plugin resolves an item with a reward type;
3. resumes the saved run at the last safe turn with the hero alive at a modest
   fraction of max HP; and
4. consumes the one-per-run reward quota.

If the player dismisses/fails the ad, the run is not resumed and the normal
restart/title actions remain available. The death record is finalized exactly
once, so a revived run cannot double-count coins, high scores, or unlocks.

## Privacy, app-ads.txt, and Play Console alignment

`public/privacy.html` will describe local saves, Google Play Billing, AdMob and
UMP consent, advertising/device identifiers, IP/general location estimation,
ad and app interactions, diagnostics, encrypted transport, the ad-free
entitlement, and the user's available consent/choice controls. The policy will
not promise “no data” while ads are enabled.

`public/app-ads.txt` will be added with the standard Google Authorized Seller
line only after the real AdMob publisher ID is supplied. The Vercel developer
site must publish it at `/app-ads.txt`, and that same site must be entered as the
developer website in the Play listing.

`docs/PLAYSTORE.md` and the local ASO copy will be updated to:

- declare **Contains ads: Yes**;
- describe 100 free floors supported by ads;
- describe the optional one-time Remove Ads purchase at US$4.99;
- retain the legacy buyer/ad-free restore note for internal testing;
- update Data Safety guidance to account for the AdMob SDK;
- remove stale “no ads” and “free 10 floors / unlock the full 100” claims from
  listing text and generated promotional captions; and
- keep the privacy URL and developer website consistent.

The actual Play Console form, AdMob account settings, live product price, and
listing submission remain external release steps. The repository checklist will
make each required field explicit without claiming that an external form was
submitted.

## Verification and release gate

The implementation will add tests for:

- current and legacy ad-free entitlement matching;
- no SDK initialization or presentation for an owner;
- UMP `canRequestAds` gating;
- banner scene placement and reserve cleanup;
- interstitial cadence/cooldown and failure fallback;
- one rewarded revive per run with reward-callback-only granting;
- exactly-once finalization around a revived run; and
- privacy/config/listing consistency and production-ID validation.

The release sequence is `npm test`, `npm run lint`, `npm run build`, Capacitor
Android sync, a signed AAB build, manifest/permission inspection, and artifact
hash/signature verification. A production AAB is blocked until the real AdMob
App ID, three live unit IDs, and publisher ID replace the sample/test values.
