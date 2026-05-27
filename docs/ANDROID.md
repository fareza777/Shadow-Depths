# Android / Play Store packaging

Shadow Depths ships as a Capacitor-wrapped WebView APK. The web build
(`dist/`) is the source of truth; Capacitor just bundles it into a
native Android shell with the right manifest + launcher icon.

## Prerequisites (one-time)

1. **JDK 17** — `java -version` should report 17.x.
2. **Android Studio** with the Android 14 (API 34) SDK + Build Tools 34.x.
3. The `ANDROID_HOME` env var pointing at your SDK (e.g.
   `C:\Users\USER\AppData\Local\Android\Sdk` on Windows).
4. (Optional) `adb` on PATH for installing debug builds via USB.

## First-time setup

```bash
# 1. Build the web bundle so Capacitor has something to wrap.
npm run build

# 2. Generate the android/ directory (run ONCE — committed to git after).
npm run android:init

# 3. Open the project in Android Studio for the rest of the work.
npm run android:open
```

## Iterating

Every time you change web code:

```bash
npm run android:sync     # builds the dist + copies to android/app/src/main/assets
```

Then either:
- press **Run** in Android Studio → installs on connected device/emulator, OR
- `cd android && ./gradlew assembleDebug` → APK at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Release builds (for Play Store)

```bash
# Generate a release keystore (one-time, keep it OUT of git):
keytool -genkey -v -keystore android/release.keystore \
        -alias shadow-depths -keyalg RSA -keysize 2048 -validity 10000

# Build the signed AAB:
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

Upload the `.aab` to Play Console → Internal Testing track first; promote
to closed/open testing after smoke-testing, then production.

## App icon + splash

Capacitor reads `resources/icon.png` (1024×1024) and `resources/splash.png`
(2732×2732) and generates the platform-specific sizes when you run
`npx @capacitor/assets generate`. Drop the source PNGs in `resources/`
before running that command.

## Config reference

- App ID: `com.shadowdepths.game`
- App name: `Shadow Depths`
- Splash background: `#08060c` (1.2s)
- Min WebView version: 80 (covers ~99% of active Android devices)
- Web dir: `dist/`

See `capacitor.config.json` for the full configuration.
