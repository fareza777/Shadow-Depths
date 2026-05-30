# Google Play Store — release checklist

Shadow Depths ships as a **Capacitor Android App Bundle (`.aab`)**.  
App ID: `com.shadowdepths.game` · Display name: **Shadow Depths**

## Quick commands (Windows)

```powershell
# 1. Generate launcher/splash sources (once, or after art change)
node scripts/generate-android-assets.mjs
# Optional: npx @capacitor/assets generate --android

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
```

## Play Console setup (one-time)

1. [Google Play Console](https://play.google.com/console) → **Create app**
2. **App access:** full access (no login) unless you add accounts later
3. **Ads:** declare no ads (unless you add them)
4. **Content rating:** complete IARC questionnaire (fantasy violence)
5. **Target audience:** 13+ recommended for dark fantasy combat
6. **Data safety:**  
   - Data collected: **No** (offline local saves only)  
   - Data shared: **No**  
   - Encryption in transit: N/A for offline play
7. **Privacy policy URL:**  
   `https://shadow-depths.vercel.app/privacy.html`  
   (deploy after pushing `public/privacy.html`)
8. **Store listing assets:**
   - App icon: 512×512 PNG (export from `resources/icon.png`)
   - Feature graphic: 1024×500 PNG
   - Phone screenshots: min 2, 16:9 or 9:16 (portrait gameplay recommended)
   - Short description (80 chars)
   - Full description (4000 chars)

### Suggested short description

```
Descend the crypts. Turn-based roguelike. Every floor remembers your failures.
```

## Versioning

- `versionName` comes from `package.json` (`0.1.0`)
- `versionCode` is computed: `major*10000 + minor*100 + patch` → `0.1.0` = **100**
- Bump `package.json` version before each Play upload

## Testing before production

1. Install debug APK on a physical phone (USB debugging)
2. Verify portrait + landscape in Settings → reload
3. Play 10+ minutes: save/load, forge floor, death, audio
4. Upload **Internal testing** track first → invite testers → then Production

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

See also: [ANDROID.md](./ANDROID.md)
