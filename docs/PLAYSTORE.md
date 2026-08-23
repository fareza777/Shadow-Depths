# Google Play Store — release checklist

Shadow Depths ships as a **Capacitor Android App Bundle (`.aab`)**.  
App ID: `com.shadowdepths.game` · Display name: **Shadow Depths** · Version: **0.2.9**

## Monetization model

| Offer | Access |
|------|--------|
| **Free with ads** | All **100 floors** are playable without an account or purchase. Banner, interstitial, and optional rewarded-revive ads support the free game. |
| **Remove Ads** | New one-time, non-consumable product `remove_ads`; live fallback price **Rp 88.000**. It permanently removes every ad. |
| **Legacy restore** | `full_descent_unlock` is restore-only. Existing owners keep permanent ad-free access; do not remove or rename this entitlement. |

- New product in Play Console: `remove_ads` (one-time / non-consumable), live price **Rp 88.000**.
- Test both a fresh account and an account that owns `full_descent_unlock`; the latter must never request or display ads.
- Restore purchases from Settings before the first ad placement is allowed.

## Quick commands (Windows)

```powershell
# Generate launcher/splash sources (once, or after art change)
node scripts/generate-android-assets.mjs

# Local debug preparation — Google's sample IDs only
npm run android:admob:debug
npm run android:sync
cd android
.\gradlew.bat assembleDebug
# android\app\build\outputs\apk\debug\app-debug.apk

# Production release (requires the six ADMOB_* environment variables)
$env:ADMOB_APP_ID = 'ca-app-pub-<your-publisher>~<app-suffix>'
$env:ADMOB_BANNER_ID = 'ca-app-pub-<your-publisher>/<banner-suffix>'
$env:ADMOB_INTERSTITIAL_ID = 'ca-app-pub-<your-publisher>/<interstitial-suffix>'
$env:ADMOB_REWARDED_ID = 'ca-app-pub-<your-publisher>/<rewarded-suffix>'
$env:ADMOB_APP_OPEN_ID = 'ca-app-pub-<your-publisher>/<app-open-suffix>'
$env:ADMOB_PUBLISHER_ID = 'pub-<your-16-digit-publisher-id>'
.\scripts\build-release-aab.ps1
# Output: release\app-release.aab
```

The release script refuses missing, malformed, or Google sample IDs. It writes the
same App ID to Android resources, the unit IDs to the Vite build, and the publisher
line to `https://shadow-depths.vercel.app/app-ads.txt`. AdMob app and unit IDs are
public identifiers; never commit keystores or passwords.

## Play Console setup

1. [Google Play Console](https://play.google.com/console) → **Create app**.
2. **App access:** full access (no login required).
3. **Contains ads:** **Yes**. The AdMob SDK and interstitial/banner placements make this declaration mandatory.
4. **Content rating:** complete the IARC questionnaire (dark fantasy and fantasy violence).
5. **Target audience:** 13+ recommended; confirm the audience and Families answers match the current app.
6. **Data safety:** disclose the Google Mobile Ads SDK categories currently shown in the SDK disclosure (app/ad interactions, diagnostics, device/account identifiers, and IP/general-location estimation where applicable). Disclose optional anonymous analytics separately, and mark it optional only if the runtime opt-in remains off by default. Recheck this form whenever the SDK or endpoint changes.
7. **Privacy policy URL:** `https://shadow-depths.vercel.app/privacy.html`
8. **Developer website:** `https://shadow-depths.vercel.app`
9. **AdMob verification:** host `app-ads.txt` at `https://shadow-depths.vercel.app/app-ads.txt` after the real publisher ID is supplied; verify it in AdMob before production.
10. **Monetize → Products → In-app products:** create and activate `remove_ads` as a one-time non-consumable at Rp 88.000. Keep `full_descent_unlock` active for restore testing but do not market it as the new offer.

## Store listing copy

### Short description (≤80 characters)

```text
100-floor turn-based roguelike. Free with ads; optional ad-free upgrade.
```

### Full description draft

```text
Descend into Shadow Depths, a turn-based roguelike where every tile is a decision.

Explore all 100 floors for free. Read enemy intent, manage torchlight, find relics,
craft gear, choose skills, and survive permadeath in a melancholic dark-fantasy crypt.

The free game is supported by occasional banners and natural-break interstitials.
You can also watch one optional rewarded ad per run to revive from a safe checkpoint.
Remove Ads is a one-time Rp 88.000 purchase that disables every ad forever. Players who
owned the retired Full Descent product keep their permanent ad-free entitlement.

No account is required. Progress is stored locally, purchases restore through Google
Play, and consent choices are handled by Google's privacy form when required.
```

## Store listing assets

- App icon: 512×512 PNG → `store-assets/app-icon-512.png`.
- Feature graphic: 1024×500 PNG → `store-assets/feature-graphic-1024x500.png`.
- Phone screenshots (8 captioned, 1080×1920): `store-assets/play-screenshots/play-shot-01.png` … `play-shot-08.png` (JPG copies are also available).
- Regenerate captions: `python scripts/compose-play-screenshots.py`.
- Captions must say all floors are free and the ad-free upgrade is optional; never promise an ad-free experience to every player.

**Promotional video:**

```text
store-assets/promo/shadow-depths-trailer.mp4
store-assets/promo/shadow-depths-trailer-portrait.mp4
```

Regenerate with `python scripts/compose-promo-video.py`, upload the finished video to
YouTube, and paste the YouTube URL into Play Console → Store listing → Promotional video.

## Versioning and test gate

- `versionName` comes from `package.json` (`0.2.9`).
- `versionCode` is computed as `major*10000 + minor*100 + patch`, so `0.2.9` = **209**.
- Test a fresh install: all 100 floors remain open, banners appear only on title/pause/game-over/victory, interstitials occur at natural floor breaks, and the rewarded revive is limited to once per run.
- Test `remove_ads`: purchase, relaunch, restore, and verify banner/interstitial/rewarded requests stop immediately.
- Test a licensed legacy account: restore `full_descent_unlock` and verify the same ad-free behavior.
- Upload the signed AAB to **Internal testing** first, inspect Play pre-launch reports, then promote to production.

## Files that must not be committed

| File | Reason |
|------|--------|
| `android/release.keystore` | signing secret |
| `android/keystore.properties` | passwords |
| `android/local.properties` | machine-specific SDK path |
| `public/app-ads.txt` before real publisher ID | prevents publishing a fake account line |

See also: [ANDROID.md](./ANDROID.md)
