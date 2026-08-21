# Ads Monetization and Legacy Entitlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a free-with-ads Shadow Depths build with a US$4.99 Remove Ads purchase, permanent ad-free access for legacy Full Descent buyers, compliant consent/privacy/store metadata, and a verified Android release path.

**Architecture:** Keep `BillingService.adsRemoved()` as the single entitlement gate and make `AdService` the only owner of AdMob lifecycle/placement. Scene transitions drive banner visibility, saved floor transitions drive throttled interstitials, and a pending game-over snapshot drives an explicit one-time rewarded revive without double-recording the run.

**Tech Stack:** Vanilla ES modules, Vite, Vitest, Capacitor 8, `@capacitor-community/admob` 8, `@capgo/native-purchases`, Android Gradle, PowerShell release scripts.

**Spec:** `docs/superpowers/specs/2026-08-21-ads-monetization-design.md`

## Global Constraints

- `remove_ads` is the only product offered to new users and its base price is US$4.99.
- `full_descent_unlock` remains a restore-only legacy entitlement and always removes every ad.
- Every floor remains free; no ad request may block gameplay, saving, or scene transitions.
- Web builds and devices without a working SDK remain inert rather than crashing or blocking the game.
- Google sample App ID/unit IDs are debug-only; release preparation rejects missing or sample production IDs.
- `public/app-ads.txt` contains only a real AdMob publisher ID supplied through release environment variables.
- Play Store metadata declares **Contains ads: Yes** and does not claim the game is ad-free for everyone.
- Do not log purchase tokens, advertising IDs, consent payloads, or other sensitive identifiers.

## File Map

- `src/monetization/products.js`: current/legacy product catalog and US$4.99 fallback label.
- `src/monetization/adConfig.js`: test IDs, environment overrides, placement defaults, and release-ID validation.
- `src/monetization/AdService.js`: consent, initialization, banner/interstitial/rewarded lifecycle, scene placement, and ad-free teardown.
- `src/core/Game.js`: pending game-over finalization and rewarded-run resume orchestration.
- `src/core/GameScene.js`: safe pre-death snapshot, run lifecycle events, and rewarded revive hydration.
- `src/ui/GameOverScreen.js`: explicit rewarded revive action and three-button hit testing/layout.
- `src/main.js`: dependency wiring and scene-aware AdService startup.
- `data/balance.json`, `src/config/balance.js`: monetization defaults and ad cadence.
- `tests/adConfig.test.js`, `tests/adService.test.js`, `tests/rewardedRevive.test.js`, `tests/monetization.test.js`: red-green coverage for configuration, SDK gating, placement, and legacy ownership.
- `scripts/prepare-admob-release.mjs`: validates release environment IDs, writes Android App ID resource and root `app-ads.txt`.
- `scripts/build-release-aab.ps1`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/res/values/admob.xml`: native release wiring.
- `public/privacy.html`: AdMob/UMP and Google Play Billing disclosure.
- `docs/PLAYSTORE.md`, `scripts/compose-play-screenshots.py`, `scripts/compose-promo-video.py`: Play Console checklist and ASO/promo copy.
- `package.json`, `package-lock.json`: version 0.2.8 and build/test scripts.

### Task 1: Lock the product catalog and ad configuration

**Files:**
- Modify: `src/monetization/products.js`
- Modify: `src/config/balance.js`
- Modify: `data/balance.json`
- Create: `tests/adConfig.test.js`
- Modify: `tests/monetization.test.js`

**Interfaces:**
- Produces `PRODUCT_REMOVE_ADS === 'remove_ads'`, `PRODUCT_FULL_DESCENT === 'full_descent_unlock'`, and `FALLBACK_PRICE_LABEL === 'US$4.99'`.
- Produces `resolveAdConfig(monetization, env?)` with `unitIds`, `testMode`, `usingTestUnits`, `releaseReady`, `eligibleScenes`, `interstitialCooldownMs`, and `rewardedRevivePerRun`.
- Produces `validateAdIds({ appId, banner, interstitial, rewarded, publisherId, release })` returning `{ ok: boolean, errors: string[] }` without exposing any secret values.

- [ ] **Step 1: Write the failing catalog/config tests**

```js
import { describe, expect, it } from 'vitest';
import { FALLBACK_PRICE_LABEL, PRODUCT_FULL_DESCENT, PRODUCT_REMOVE_ADS } from '../src/monetization/products.js';
import { resolveAdConfig, validateAdIds, TEST_AD_UNITS, TEST_APP_ID } from '../src/monetization/adConfig.js';

describe('release monetization contract', () => {
  it('offers Remove Ads at the US$4.99 base price and keeps the legacy id', async () => {
    expect(PRODUCT_REMOVE_ADS).toBe('remove_ads');
    expect(PRODUCT_FULL_DESCENT).toBe('full_descent_unlock');
    expect(FALLBACK_PRICE_LABEL).toBe('US$4.99');
  });

  it('uses test units only when live environment IDs are absent', () => {
    const cfg = resolveAdConfig({ ads: {} }, {});
    expect(cfg.usingTestUnits).toBe(true);
    expect(cfg.testMode).toBe(true);
    expect(cfg.releaseReady).toBe(false);
  });

  it('accepts complete non-sample release IDs', () => {
    const result = validateAdIds({
      appId: 'ca-app-pub-1234567890123456~1234567890',
      banner: 'ca-app-pub-1234567890123456/1234567890',
      interstitial: 'ca-app-pub-1234567890123456/1234567891',
      rewarded: 'ca-app-pub-1234567890123456/1234567892',
      publisherId: 'pub-1234567890123456', release: true
    });
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('rejects sample IDs for a release build', () => {
    const result = validateAdIds({
      appId: TEST_APP_ID,
      ...TEST_AD_UNITS,
      publisherId: 'pub-0000000000000000', release: true
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the focused tests and verify the expected RED failure**

Run: `npm test -- tests/adConfig.test.js tests/monetization.test.js`

Expected: FAIL because the current fallback label and configuration helpers do not yet implement the release contract.

- [ ] **Step 3: Implement the minimal catalog/config changes**

Set the fallback label to `US$4.99`, preserve both entitlement IDs, and make `resolveAdConfig` prefer `VITE_ADMOB_*` environment values over JSON values. Keep Google's sample IDs as the safe fallback, force `testMode` when any fallback is used, and expose:

```js
export function validateAdIds({ appId, banner, interstitial, rewarded, publisherId, release = false }) {
  const errors = [];
  const appOk = /^ca-app-pub-\d{16}~\d{10}$/.test(appId || '');
  const unitOk = (value) => /^ca-app-pub-\d{16}\/\d{10}$/.test(value || '');
  const publisherOk = /^pub-\d{16}$/.test(publisherId || '');
  if (release && !appOk) errors.push('AdMob App ID is missing or malformed');
  if (release && !unitOk(banner)) errors.push('AdMob banner unit ID is missing or malformed');
  if (release && !unitOk(interstitial)) errors.push('AdMob interstitial unit ID is missing or malformed');
  if (release && !unitOk(rewarded)) errors.push('AdMob rewarded unit ID is missing or malformed');
  if (release && !publisherOk) errors.push('AdMob publisher ID is missing or malformed');
  if (release && [appId, banner, interstitial, rewarded].some(isGoogleSampleId)) {
    errors.push('Google sample ad IDs are debug-only');
  }
  return { ok: errors.length === 0, errors };
}
```

Add `eligibleScenes: ['title', 'pause', 'gameover', 'victory']`, `interstitialCooldownMs: 90000`, and `rewardedRevivePerRun: 1` to both JSON and code defaults. Do not remove `full_descent_unlock` from `entitlementIds`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- tests/adConfig.test.js tests/monetization.test.js`

Expected: PASS with all catalog, legacy entitlement, test fallback, and release validation assertions green.

- [ ] **Step 5: Commit the catalog/config unit**

```powershell
git add src/monetization/products.js src/monetization/adConfig.js src/config/balance.js data/balance.json tests/adConfig.test.js tests/monetization.test.js
git commit -m "feat: lock ads catalog and release ID validation"
```

### Task 2: Make AdService consent-safe and scene-aware

**Files:**
- Modify: `src/monetization/AdService.js`
- Create: `tests/adService.test.js`

**Interfaces:**
- Consumes `resolveAdConfig` from Task 1 and a billing object exposing `adsRemoved()`.
- Produces `async init()`, `async showBanner()`, `async hideBanner()`, `async onDescend(floorIndex)`, `canOfferRevive()`, `async showRewardedRevive()`, `async onSceneChanged(sceneName)`, and `async removeAllAds()`.
- `onSceneChanged` shows a banner only for configured eligible scenes and hides it for `opening`/`game`/unknown scenes.

- [ ] **Step 1: Write failing AdService tests with a fake SDK**

```js
import { describe, expect, it, vi } from 'vitest';
import { AdService } from '../src/monetization/AdService.js';

function makeBus() {
  const handlers = new Map();
  return {
    on(event, fn) { handlers.set(event, fn); },
    emit(event, payload) { handlers.get(event)?.(payload); }
  };
}

function makeService({ premium = false, native = true } = {}) {
  const bus = makeBus();
  const billing = { adsRemoved: () => premium };
  const service = new AdService({ billing, eventBus: bus, balance: {
    monetization: { ads: { enabled: true, unitIds: {} } }
  }});
  Object.defineProperty(service, 'isNative', { get: () => native });
  return { service, bus };
}

describe('AdService safety gate', () => {
  it('never initializes or shows ads for an ad-free owner', async () => {
    const { service } = makeService({ premium: true });
    service._admob = { initialize: vi.fn() };
    await service.init();
    expect(service._admob.initialize).not.toHaveBeenCalled();
    expect(service.adsDisabled).toBe(true);
  });

  it('does not initialize when consent says ads cannot be requested', async () => {
    const { service } = makeService();
    service._admob = {
      requestConsentInfo: vi.fn().mockResolvedValue({
        canRequestAds: false, isConsentFormAvailable: false, status: 'NOT_REQUIRED'
      }),
      initialize: vi.fn()
    };
    await service._requestConsent({ AdmobConsentStatus: { REQUIRED: 'REQUIRED' } });
    expect(service.canRequestAds).toBe(false);
    await service.init();
    expect(service._admob.initialize).not.toHaveBeenCalled();
  });

  it('shows banners only on non-combat scenes', async () => {
    const { service } = makeService();
    service._admob = { showBanner: vi.fn().mockResolvedValue(undefined), hideBanner: vi.fn().mockResolvedValue(undefined) };
    service._ready = true;
    await service.onSceneChanged('game');
    expect(service._admob.showBanner).not.toHaveBeenCalled();
    await service.onSceneChanged('title');
    expect(service._admob.showBanner).toHaveBeenCalledTimes(1);
    await service.onSceneChanged('gameover');
    expect(service._admob.showBanner).toHaveBeenCalledTimes(1);
  });

  it('counts a rewarded revive only after a reward item is returned', async () => {
    const { service } = makeService();
    service._admob = { showRewardVideoAd: vi.fn().mockResolvedValue({ type: 'revive', amount: 1 }) };
    service._ready = true;
    service._rewardedLoaded = true;
    expect(await service.showRewardedRevive()).toBe(true);
    expect(service.revivesUsedThisRun).toBe(1);
    expect(await service.showRewardedRevive()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused tests and verify the expected RED failure**

Run: `npm test -- tests/adService.test.js`

Expected: FAIL because `canRequestAds`, scene routing, and the testable consent state do not exist yet.

- [ ] **Step 3: Implement consent and placement lifecycle**

Add `_canRequestAds = false` and a public `canRequestAds` getter. `_requestConsent` must retain the returned consent object, show the form when required, retain the form result, and set `_canRequestAds = info?.canRequestAds === true`. `init()` returns without SDK initialization when that flag is false. Keep every native SDK call wrapped in the existing failure-safe `try/catch` path.

Add `onSceneChanged(sceneName)` that calls `showBanner()` for `config.eligibleScenes` and `hideBanner()` otherwise. Keep `removeAllAds()` idempotent and clear the CSS reserve even if the SDK is absent. Add a cooldown timestamp in `onDescend` so a successful interstitial cannot show again until `interstitialCooldownMs` has elapsed. Make `showRewardedRevive` accept only a returned reward object with a non-empty `type`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- tests/adService.test.js`

Expected: PASS with owner, consent, scene, cooldown, and reward callback assertions green.

- [ ] **Step 5: Commit the AdService unit**

```powershell
git add src/monetization/AdService.js tests/adService.test.js
git commit -m "feat: make AdMob lifecycle consent and scene safe"
```

### Task 3: Wire scene lifecycle and banner-safe layout

**Files:**
- Modify: `src/main.js:172-193,275-289`
- Modify: `src/core/SceneManager.js` only if the existing `scene:switched` payload needs a typed helper; otherwise leave it unchanged.
- Modify: `index.html:20-70`
- Modify: `tests/workflowSmoke.test.js`

**Interfaces:**
- `main.js` passes the same `adService` instance to `GameScene` and `GameOverScreen`.
- `scene:switched` continues to emit `{ from, to }`; `AdService.onSceneChanged(to)` consumes it.

- [ ] **Step 1: Add a failing integration assertion**

Extend `tests/workflowSmoke.test.js` with a source-level wiring check:

```js
import { readFileSync } from 'node:fs';

it('routes scene changes through AdService instead of showing a boot-global banner', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  expect(source).toContain("bus.on('scene:switched'");
  expect(source).toContain('adService.onSceneChanged(to)');
  expect(source).toContain('adService }));');
  expect(source).not.toContain('.then(() => adService.showBanner())');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/workflowSmoke.test.js`

Expected: FAIL because bootstrap still calls `showBanner()` unconditionally and does not route scene changes.

- [ ] **Step 3: Implement scene wiring and reserve cleanup**

Register `bus.on('scene:switched', ({ to }) => adService.onSceneChanged(to))` after `adService` construction. Replace the boot-global `.then(() => adService.showBanner())` with `adService.init().then(() => adService.onSceneChanged(sceneManager.currentName || 'title'))`. Pass `adService` into the game-over scene factory. Emit `run:started` from `Game.newRun` and `Game.continueRun` after switching scenes, with `{ revived: false }` for normal starts and `{ revived: false }` for ordinary resume. The rewarded resume path in Task 4 will use `{ revived: true }`.

Keep the existing `--ad-banner-reserve` CSS contract, but ensure `#game-root` is the element that receives the reserve and that a hidden/removed banner dispatches `resize` so renderer layout and hit-tests recalculate.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/workflowSmoke.test.js`

Expected: PASS with the scene-aware startup assertions green.

- [ ] **Step 5: Commit scene wiring**

```powershell
git add src/main.js src/core/Game.js index.html tests/workflowSmoke.test.js
git commit -m "feat: place banners only on safe scenes"
```

### Task 4: Add the exactly-once rewarded revive flow

**Files:**
- Modify: `src/core/GameScene.js:1624-1659`
- Modify: `src/core/Game.js:53-63,90-216`
- Modify: `src/ui/GameOverScreen.js`
- Create: `tests/rewardedRevive.test.js`

**Interfaces:**
- `GameScene._endRun(false)` includes `reviveSnapshot` from `save.loadRun()` and `canOfferRevive` when a safe snapshot and an eligible AdService exist.
- `Game` stores one `_pendingRunOver` summary, finalizes it through `_recordRunOver(summary)` exactly once, and handles `request:reviveRun` with `{ snapshot }`.
- `GameOverScreen` accepts `adService`, exposes `hitTest()` index `2` for the reward button, and calls `adService.showRewardedRevive()` before emitting `request:reviveRun`.

- [ ] **Step 1: Write failing rewarded-flow tests**

```js
import { describe, expect, it, vi } from 'vitest';
import { GameOverScreen } from '../src/ui/GameOverScreen.js';

const renderer = {
  ctx: {
    save() {}, restore() {}, fillRect() {}, createLinearGradient() {
      return { addColorStop() {} };
    }
  },
  measureText: () => 40,
  drawRect() {}, drawText() {}, drawStrokedRect() {}
};

describe('rewarded game-over action', () => {
  it('offers revive only when the summary says it is eligible', () => {
    const bus = { emit: vi.fn() };
    const screen = new GameOverScreen({
      bus,
      adService: { canOfferRevive: () => true },
      summary: { died: true, canOfferRevive: true, reviveSnapshot: { seed: 7 } }
    });
    screen.render(renderer);
    expect(screen.hitTest(240, screen._layout(renderer).revive.y + 2)).toBe(2);
  });

  it('resumes only after the rewarded SDK resolves a reward', async () => {
    const bus = { emit: vi.fn() };
    const ads = { canOfferRevive: () => true, showRewardedRevive: vi.fn().mockResolvedValue(true) };
    const screen = new GameOverScreen({
      bus, adService: ads,
      summary: { died: true, canOfferRevive: true, reviveSnapshot: { seed: 7 } }
    });
    await screen._activate(2);
    expect(ads.showRewardedRevive).toHaveBeenCalledTimes(1);
    expect(bus.emit).toHaveBeenCalledWith('request:reviveRun', {
      snapshot: { seed: 7 }
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/rewardedRevive.test.js`

Expected: FAIL because the current screen has only restart/title buttons and no pending-run action.

- [ ] **Step 3: Implement snapshot retention and pending finalization**

In `GameScene._endRun`, read `const reviveSnapshot = !victory ? this.save?.loadRun?.() : null` before clearing the run. Add `canOfferRevive: !victory && !!reviveSnapshot && !!this.ads?.canOfferRevive?.()` and the snapshot to the emitted summary. In `Game`, replace direct `run:over` recording with `_onRunOver(summary)` that stores a pending summary when the revive fields are present; otherwise call `_recordRunOver(summary)` immediately. Make `request:newRun` and `request:quitToTitle` finalize `_pendingRunOver` before routing. `_recordRunOver` contains the existing score/coin/high-score enrichment exactly once.

Add `request:reviveRun` handling that validates the pending snapshot, clears the pending summary without recording it, creates a game scene with `resumeSnapshot` and `reviveAfterReward: true`, switches to it, and emits `run:started` with `{ revived: true }`. Ignore duplicate revive requests after the pending summary is cleared.

- [ ] **Step 4: Implement GameOverScreen reward layout/action**

Add a `revive` rectangle when `summary.canOfferRevive` is true, include its height in the adaptive layout, draw `WATCH AD · REVIVE`, and reserve hit-test index `2`. `_activate(2)` must guard `_busy`, await `showRewardedRevive()`, emit `request:reviveRun` with the exact snapshot only on `true`, and otherwise show a short local failure status without changing scene state. Existing restart/title actions remain indexes `0` and `1`.

- [ ] **Step 5: Hydrate a revived snapshot safely**

Pass `reviveAfterReward` through the game factory. After `_restorePlayerSnapshot` in `GameScene._enterFromSnapshot`, when the flag is true set `player.isDead = false`, clear lethal status effects, clear `runStats.killedBy`, and set HP to `Math.max(1, Math.ceil(stats.hpMax * 0.5))` before adding the player to the floor and saving. Emit `player:revived` with `{ entity: player, source: 'rewarded_ad' }`.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm test -- tests/rewardedRevive.test.js tests/monetization.test.js tests/workflowSmoke.test.js`

Expected: PASS, including legacy owners, reward callback gating, button hit testing, pending finalization, and duplicate-request protection.

- [ ] **Step 7: Commit the rewarded flow**

```powershell
git add src/core/Game.js src/core/GameScene.js src/ui/GameOverScreen.js tests/rewardedRevive.test.js
git commit -m "feat: wire one-time rewarded revive flow"
```

### Task 5: Sync AdMob into Android and enforce release IDs

**Files:**
- Create: `scripts/prepare-admob-release.mjs`
- Modify: `scripts/build-release-aab.ps1`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Create: `android/app/src/main/res/values/admob.xml`
- Modify: `package.json`
- Modify: `.gitignore` only if a generated local handoff file needs an explicit ignore rule.
- Create: `tests/releaseConfig.test.js`

**Interfaces:**
- `node scripts/prepare-admob-release.mjs --release` reads `ADMOB_APP_ID`, `ADMOB_BANNER_ID`, `ADMOB_INTERSTITIAL_ID`, `ADMOB_REWARDED_ID`, and `ADMOB_PUBLISHER_ID`, validates them with Task 1, writes `android/app/src/main/res/values/admob.xml` and `public/app-ads.txt`, and exits nonzero with category-only errors when any value is absent/sample.
- `node scripts/prepare-admob-release.mjs --debug` writes Google's documented sample App ID resource and no production `app-ads.txt`.
- Release PowerShell invokes `--release` before `npm run build`; it copies the same four `ADMOB_*` values into `VITE_ADMOB_*` variables for Vite.

- [ ] **Step 1: Write failing release-preparation tests**

```js
import { describe, expect, it } from 'vitest';
import { validateAdIds } from '../src/monetization/adConfig.js';

describe('release ID gate', () => {
  it('requires all five public AdMob identifiers', () => {
    const result = validateAdIds({ release: true });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'AdMob App ID is missing or malformed',
      'AdMob publisher ID is missing or malformed'
    ]));
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/releaseConfig.test.js`

Expected: FAIL until the release gate and preparation script exist.

- [ ] **Step 3: Add native resource and manifest wiring**

Change the manifest metadata value to `@string/admob_app_id`, add the normal `com.google.android.gms.permission.AD_ID` permission used by target SDK 36 ad builds, and create `admob.xml` with the documented Google sample App ID for local debug sync. Do not add any real account ID to git.

- [ ] **Step 4: Implement the preparation script and release script hook**

Use Node's `fs` and `process.env` to validate IDs, write:

```text
google.com, <ADMOB_PUBLISHER_ID>, DIRECT, f08c47fec0942fa0
```

to `public/app-ads.txt`, and write the escaped App ID to `admob.xml`. The script must refuse to overwrite a production file on invalid input and must never print full IDs in an error. Update `build-release-aab.ps1` to call `node scripts/prepare-admob-release.mjs --release`, then assign `VITE_ADMOB_APP_ID`, `VITE_ADMOB_BANNER_ID`, `VITE_ADMOB_INTERSTITIAL_ID`, and `VITE_ADMOB_REWARDED_ID` from the corresponding `ADMOB_*` variables before `npm run build`. Add `npm run android:admob:debug` for the sample-only preparation path.

- [ ] **Step 5: Sync and verify the native plugin**

Run: `npx cap sync android`

Expected: generated Capacitor files include the AdMob Android module/dependencies alongside the existing app/browser/native-purchases modules, and the manifest merge has one AdMob App ID metadata entry.

- [ ] **Step 6: Run release tests and verify GREEN**

Run: `npm test -- tests/releaseConfig.test.js tests/adConfig.test.js`

Expected: PASS, with invalid/sample release IDs rejected and debug sample IDs accepted only in debug mode.

- [ ] **Step 7: Commit native integration**

```powershell
git add scripts/prepare-admob-release.mjs scripts/build-release-aab.ps1 android/app/src/main/AndroidManifest.xml android/app/src/main/res/values/admob.xml package.json package-lock.json tests/releaseConfig.test.js
git commit -m "build: sync AdMob and gate production identifiers"
```

### Task 6: Update privacy, Play checklist, ASO, and promo assets

**Files:**
- Modify: `public/privacy.html`
- Modify: `docs/PLAYSTORE.md`
- Modify: `scripts/compose-play-screenshots.py`
- Modify: `scripts/compose-promo-video.py`
- Modify: `tests/workflowSmoke.test.js`
- Modify: `package.json` version to `0.2.8` and lockfile version.

**Interfaces:**
- Privacy page remains a static Vercel-safe document at `/privacy.html` and names AdMob/UMP, Google Play Billing, local saves, consent choices, and contact path.
- Play Store checklist documents `Contains ads: Yes`, 100 free floors, US$4.99 Remove Ads, legacy restore testing, Data Safety categories, privacy URL, developer website, and app-ads.txt URL.
- Generated captions no longer imply that only ten floors are free or that every player receives a no-ad experience.

- [ ] **Step 1: Write failing copy-consistency assertions**

```js
it('keeps privacy and Play Store copy aligned with free-with-ads monetization', () => {
  const privacy = readFileSync(new URL('../public/privacy.html', import.meta.url), 'utf8');
  const playStore = readFileSync(new URL('../docs/PLAYSTORE.md', import.meta.url), 'utf8');
  expect(privacy).toMatch(/AdMob|Google Mobile Ads/i);
  expect(privacy).toMatch(/consent|personalized|non-personalized/i);
  expect(playStore).toMatch(/Contains ads.*Yes/i);
  expect(playStore).toMatch(/US\$4\.99/);
  expect(playStore).toMatch(/100 floors.*free/i);
  expect(playStore).not.toMatch(/declare \*\*no ads\*\*/i);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/workflowSmoke.test.js`

Expected: FAIL because the current privacy and Play Store documents still describe the old no-ads/ten-floor model.

- [ ] **Step 3: Rewrite privacy and Play Store copy**

Update the policy date to the release date and describe the Google Mobile Ads SDK's disclosed categories (IP/general location estimation, ad/app interactions, diagnostics, device/account identifiers), UMP consent controls, encrypted transport, local saves, purchases, and the permanent ad-free entitlement. Update the checklist's short description to `100-floor turn-based roguelike. Free to play with ads; optional one-time ad-free upgrade.` and remove the old floor cap/product instructions.

- [ ] **Step 4: Update ASO caption sources and regenerate derived assets**

Replace stale caption strings in both Python composition scripts with `100 floors free · optional ad-free upgrade` language. Keep “no ads” only where it clearly describes the optional Remove Ads benefit. Run the existing scripts to regenerate `store-assets/play-screenshots/play-shot-*.png/.jpg` and promo posters/videos, then inspect their dimensions and file sizes.

- [ ] **Step 5: Bump version and verify copy tests GREEN**

Set `package.json` and `package-lock.json` to `0.2.8`; the Gradle formula then computes version code `208`. Run: `npm test -- tests/workflowSmoke.test.js tests/playStore.test.js`

Expected: PASS with current package URL, free-with-ads model, and updated copy assertions.

- [ ] **Step 6: Commit policy/store metadata**

```powershell
git add public/privacy.html docs/PLAYSTORE.md scripts/compose-play-screenshots.py scripts/compose-promo-video.py store-assets package.json package-lock.json tests/workflowSmoke.test.js
git commit -m "docs: align privacy and Play listing with ads"
```

### Task 7: Full verification and release artifact gate

**Files:**
- Modify: `CHANGELOG.md` with the 0.2.8 monetization/privacy entry.
- Create: `tests/releaseChecklist.test.js` if the existing checks need a dedicated manifest/app-ads audit.
- Generated/ignored: `dist/`, `android/app/build/`, `release/`.

**Interfaces:**
- `npm test` is the complete unit/regression suite.
- `npm run lint` checks source JavaScript with zero errors.
- `npm run build` produces a Vite bundle without unresolved imports.
- `npm run android:bundle` is a production-only gate and refuses sample/missing AdMob IDs.

- [ ] **Step 1: Run the complete JavaScript verification**

Run: `npm test`

Expected: all Vitest files pass, including the new catalog, AdService, rewarded-flow, release-config, and copy-consistency tests.

- [ ] **Step 2: Run lint and production web build**

Run: `npm run lint` and `npm run build`

Expected: lint exits 0 with no errors; Vite exits 0 and writes `dist/`.

- [ ] **Step 3: Run Android debug sync/build checks**

Run: `npm run android:admob:debug`, `npx cap sync android`, then `cd android; .\gradlew.bat assembleDebug --no-daemon`.

Expected: the debug APK compiles with sample IDs and the AdMob plugin is present in the merged Android project.

- [ ] **Step 4: Run the production release gate when real IDs are available**

Set the five `ADMOB_*` environment variables in the local release shell, then run: `npm run android:bundle`.

Expected: release preparation writes a valid root `public/app-ads.txt`, Vite uses live unit IDs, Gradle builds version `0.2.8`/code `208`, and the signed AAB is emitted under `android/app/build/outputs/bundle/release/app-release.aab`.

- [ ] **Step 5: Inspect the final artifact**

Run the existing bundle inspection/hash/signature commands from `docs/ANDROID.md` and `docs/PLAYSTORE.md`. Confirm package `com.shadowdepths.game`, version code `208`, target SDK 36, one manifest App ID, `INTERNET`, Billing, and `AD_ID` permissions, and no debug/sample IDs in the release bundle.

- [ ] **Step 6: Record release notes and handoff**

Update `CHANGELOG.md` with the ad placements, legacy entitlement preservation, privacy disclosure, and release-ID gate. Report the AAB path and hash only after fresh verification; if real AdMob IDs are absent, report the exact release blocker instead of labeling the test build production-ready.

