# Build a signed Play Store AAB (Android App Bundle).
# Prerequisites: JDK 17, ANDROID_HOME, android/keystore.properties + release.keystore
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host 'Validating AdMob release identifiers...'
node scripts/prepare-admob-release.mjs --release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:VITE_ADMOB_APP_ID = $env:ADMOB_APP_ID
$env:VITE_ADMOB_BANNER_ID = $env:ADMOB_BANNER_ID
$env:VITE_ADMOB_INTERSTITIAL_ID = $env:ADMOB_INTERSTITIAL_ID
$env:VITE_ADMOB_REWARDED_ID = $env:ADMOB_REWARDED_ID
$env:VITE_ADMOB_APP_OPEN_ID = $env:ADMOB_APP_OPEN_ID
$env:VITE_ADMOB_PUBLISHER_ID = $env:ADMOB_PUBLISHER_ID

if (-not (Test-Path 'android\keystore.properties')) {
  Write-Host 'Missing android\keystore.properties — copy from android\keystore.properties.example' -ForegroundColor Red
  exit 1
}

Write-Host 'Building web bundle...'
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Syncing Capacitor...'
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Gradle bundleRelease...'
Set-Location android
.\gradlew.bat bundleRelease
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$out = 'app\build\outputs\bundle\release\app-release.aab'
if (Test-Path $out) {
  Write-Host "Success: android\$out" -ForegroundColor Green
} else {
  Write-Host 'AAB not found — check Gradle output.' -ForegroundColor Red
  exit 1
}
