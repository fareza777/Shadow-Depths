# Google Play Store — release checklist

Shadow Depths ships as a **Capacitor Android App Bundle (`.aab`)**.  
App ID: `com.shadowdepths.game` · Display name: **Shadow Depths** · Version: **0.2.0**

## Monetization model (v0.2)

| Tier | Access |
|------|--------|
| **Free** | Floors **1–10** (first biome + floor-10 boss) + tutorial + meta shop |
| **Full Descent** | One-time IAP unlocks **all 100 floors** forever (no ads, no subscription) |

- **Play Console product ID:** `full_descent_unlock` (managed / non-consumable)
- **Suggested price (ID):** Rp 29.000 (set live price in Play Console)
- In-app: title menu **FULL DESCENT**, paywall on descend past floor 10, Settings → Restore purchases

## Quick commands (Windows)

```powershell
# 1. Generate launcher/splash sources (once, or after art change)
node scripts/generate-android-assets.mjs
# Optional: npx @capacitor/assets generate --android
# Feature graphic (1024×500) + phone screenshots are still uploaded manually
# in Play Console → Store listing.

# Fonts are self-hosted under public/fonts/ (no Google CDN at runtime).

# 2. First-time signing setup
Copy-Item android\keystore.properties.example android\keystore.properties
keytool -genkey -v -keystore android\release.keystore -alias shadow-depths -keyalg RSA -keysize 2048 -validity 10000
# Edit android\keystore.properties with your passwords

# 3. Build upload artifact
.\scripts\build-release-aab.ps1
# Output: release\app-release.aab  (copy of signed bundle)
```

Debug APK for device testing:

```powershell
npm run android:sync
cd android
.\gradlew.bat assembleDebug
# android\app\build\outputs\apk\debug\app-debug.apk
# also copied to: release\Shadow-Depths-debug.apk
```

## Play Console setup (one-time)

1. [Google Play Console](https://play.google.com/console) → **Create app**
2. **App access:** full access (no login)
3. **Ads:** declare **no ads**
4. **Content rating:** IARC questionnaire (fantasy violence)
5. **Target audience:** 13+ recommended
6. **Data safety:**
   - Data collected: **No** personal data by default (local saves only)
   - Optional: if player opts in to anonymous analytics in Settings, declare
     **App activity** / analytics as collected + optional (not required to play)
   - Purchases: processed by Google Play (declare in-app purchases)
   - Data shared: **No** (unless you later send analytics to a third-party endpoint — update this form then)
7. **Privacy policy URL:**  
   `https://shadow-depths.vercel.app/privacy.html`
8. **Monetize → Products → In-app products:**
   - Create `full_descent_unlock` (one-time / non-consumable)
   - Activate for Internal testing track before production
9. **Store listing assets:**
   - App icon: 512×512 PNG → `store-assets/app-icon-512.png` (also `release/play-store/`)
   - Feature graphic: 1024×500 PNG → `store-assets/feature-graphic-1024x500.png`
   - Phone screenshots: min 2, portrait gameplay (capture from device / emulator)
   - Short description (80 chars)
   - Full description (4000 chars) — mention free 10 floors + one-time unlock

Upload these two files on **Store listings → Graphics**:
```
store-assets/app-icon-512.png
store-assets/feature-graphic-1024x500.png
```


### Suggested short description

```
Descend the crypts. Turn-based roguelike. Free 10 floors — unlock the full 100.
```

## Versioning

- `versionName` comes from `package.json` (`0.2.0`)
- `versionCode` is computed: `major*10000 + minor*100 + patch` → `0.2.0` = **200**
- Bump `package.json` version before each Play upload

## Testing before production

1. Install debug APK on a physical phone (USB debugging)
2. Play free floors 1–10; confirm paywall on descend to 11
3. On licensed tester account: purchase / restore Full Descent
4. Verify Continue blocked for deep saves until unlock
5. Upload **Internal testing** AAB → invite testers → then Production

## Files you must NOT commit

| File | Reason |
|------|--------|
| `android/release.keystore` | signing secret |
| `android/keystore.properties` | passwords |
| `android/local.properties` | machine-specific SDK path |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `npm install` SSL error | `set NODE_OPTIONS=--use-system-ca` then retry |
| Gradle SDK not found | Set `ANDROID_HOME`, open once in Android Studio |
| White screen on launch | `npm run android:sync` after `npm run build` |
| Signing failed | Check `keystore.properties` paths are relative to `android/` |
| IAP “item unavailable” | Product ID must be `full_descent_unlock` and **Active** in Play Console; app must be installed from Play (internal track) |

See also: [ANDROID.md](./ANDROID.md)
