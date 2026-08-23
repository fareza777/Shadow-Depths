# One-shot: local JDK 17 + Android SDK + signing + release AAB.
# Output: release\app-release.aab  (and android\SIGNING-README.txt with passwords)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
if (-not $env:NODE_OPTIONS) { $env:NODE_OPTIONS = '--use-system-ca' }

Write-Host 'Validating AdMob release identifiers...'
node scripts/prepare-admob-release.mjs --release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:VITE_ADMOB_APP_ID = $env:ADMOB_APP_ID
$env:VITE_ADMOB_BANNER_ID = $env:ADMOB_BANNER_ID
$env:VITE_ADMOB_INTERSTITIAL_ID = $env:ADMOB_INTERSTITIAL_ID
$env:VITE_ADMOB_REWARDED_ID = $env:ADMOB_REWARDED_ID
$env:VITE_ADMOB_APP_OPEN_ID = $env:ADMOB_APP_OPEN_ID
$env:VITE_ADMOB_PUBLISHER_ID = $env:ADMOB_PUBLISHER_ID

$Tools = Join-Path $Root '.tools'
$JdkDir = Join-Path $Tools 'jdk-21'
# Avoid spaces in SDK path — sdkmanager/Gradle break on paths like "Game Playstore".
$SdkRoot = if ($env:LOCALAPPDATA) {
  Join-Path $env:LOCALAPPDATA 'shadow-depths-android-sdk'
} else {
  'C:\shadow-depths-android-sdk'
}
$ReleaseDir = Join-Path $Root 'release'
$JdkZip = Join-Path $Tools 'jdk-21.zip'
$CmdlineZip = Join-Path $Tools 'cmdline-tools.zip'

function Ensure-Dir($p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }

function Test-ZipFile($Path) {
  if (-not (Test-Path $Path)) { return $false }
  $b = [IO.File]::ReadAllBytes($Path)
  if ($b.Length -lt 4) { return $false }
  return ($b[0] -eq 0x50 -and $b[1] -eq 0x4B)
}

function Download-File($Url, $Dest, [long]$MinBytes = 1MB) {
  if ((Test-Path $Dest) -and (Test-ZipFile $Dest)) {
    $len = (Get-Item $Dest).Length
    if ($len -ge $MinBytes) {
      Write-Host "Using cached $(Split-Path $Dest -Leaf) ($([math]::Round($len/1MB,1)) MB)"
      return
    }
    Remove-Item $Dest -Force
  }
  Write-Host "Downloading $Url ..."
  Ensure-Dir (Split-Path $Dest -Parent)
  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($curl) {
    # Windows schannel often fails revocation checks on some networks.
    & curl.exe -fL --ssl-no-revoke --retry 5 --retry-delay 3 -o $Dest $Url
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'curl failed, retrying with Invoke-WebRequest...' -ForegroundColor Yellow
      Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing -TimeoutSec 900
    }
  } else {
    Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing -TimeoutSec 900
  }
  if (-not (Test-ZipFile $Dest)) { throw "Download is not a valid zip: $Dest" }
  $len = (Get-Item $Dest).Length
  if ($len -lt $MinBytes) { throw "Download too small ($len bytes): $Url" }
}

function Expand-Zip($Zip, $Dest) {
  if (Test-Path $Dest) { return }
  Ensure-Dir $Dest
  Expand-Archive -Path $Zip -DestinationPath $Dest -Force
}

# --- JDK 17 (Microsoft build, portable) ---
$javaExe = Join-Path $JdkDir 'bin\java.exe'
if (-not (Test-Path $javaExe)) {
  Ensure-Dir $Tools
  $jdkUrl = 'https://aka.ms/download-jdk/microsoft-jdk-21.0.6-windows-x64.zip'
  Download-File $jdkUrl $JdkZip
  $extract = Join-Path $Tools 'jdk-extract'
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Zip $JdkZip $extract
  $nested = Get-ChildItem $extract -Directory | Select-Object -First 1
  if (-not $nested) { throw 'JDK zip extract failed' }
  if (Test-Path $JdkDir) { Remove-Item $JdkDir -Recurse -Force }
  Move-Item $nested.FullName $JdkDir
}
$env:JAVA_HOME = $JdkDir
$env:PATH = "$JdkDir\bin;$env:PATH"
Write-Host "JAVA_HOME=$env:JAVA_HOME"
& $javaExe -version

# --- Android SDK (project-local) ---
Ensure-Dir $SdkRoot
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot

# SDK packages installed via direct zip download below (sdkmanager often fails on some networks).

$localProps = Join-Path $Root 'android\local.properties'
$sdkDirEsc = ($SdkRoot -replace '\\', '/')
@("sdk.dir=$sdkDirEsc") | Set-Content -Encoding ASCII $localProps

function Install-SdkZip($Url, $DestDir, $RootFolder, [long]$MinZipBytes = 1MB) {
  $marker = Join-Path $DestDir '.installed'
  if (Test-Path $marker) { Write-Host "SDK ok: $DestDir"; return }
  $zip = Join-Path $Tools ("sdk-" + ($RootFolder -replace '[^a-zA-Z0-9]', '-') + '.zip')
  Download-File $Url $zip $MinZipBytes
  $tmp = Join-Path $Tools 'sdk-unzip'
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Zip $zip $tmp
  $folder = Join-Path $tmp $RootFolder
  if (-not (Test-Path $folder)) {
    $folder = Get-ChildItem $tmp -Directory | Select-Object -First 1
    if (-not $folder) { throw "Zip layout unknown: $Url" }
    $folder = $folder.FullName
  }
  Ensure-Dir (Split-Path $DestDir -Parent)
  if (Test-Path $DestDir) { Remove-Item $DestDir -Recurse -Force }
  Move-Item $folder $DestDir
  New-Item -ItemType File -Path $marker -Force | Out-Null
}

Write-Host 'Installing Android SDK packages (direct download)...'
$repo = 'https://dl.google.com/android/repository'
Install-SdkZip "$repo/platform-tools-latest-windows.zip" (Join-Path $SdkRoot 'platform-tools') 'platform-tools' 5MB
Install-SdkZip "$repo/platform-36_r02.zip" (Join-Path $SdkRoot 'platforms\android-36') 'android-36' 20MB
Install-SdkZip "$repo/build-tools_r35.0.1_windows.zip" (Join-Path $SdkRoot 'build-tools\35.0.1') 'android-13' 30MB
# build-tools zip root folder may be android-13; detect if wrong:
$bt = Join-Path $SdkRoot 'build-tools\35.0.1'
if (-not (Test-Path (Join-Path $bt 'aapt.exe'))) {
  $alt = Get-ChildItem (Join-Path $SdkRoot 'build-tools') -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'aapt.exe') } | Select-Object -First 1
  if ($alt -and $alt.FullName -ne $bt) {
    if (Test-Path $bt) { Remove-Item $bt -Recurse -Force }
    Move-Item $alt.FullName $bt
  }
}

# --- Release keystore (one-time, gitignored) ---
$ksPath = Join-Path $Root 'android\release.keystore'
$ksProps = Join-Path $Root 'android\keystore.properties'
$readme = Join-Path $Root 'android\SIGNING-README.txt'

if (-not (Test-Path $ksPath)) {
  Add-Type -AssemblyName System.Web
  $storePass = [System.Web.Security.Membership]::GeneratePassword(20, 4)
  $keyPass = $storePass
  $dname = 'CN=Shadow Depths, OU=Mobile, O=Shadow Depths, L=Jakarta, ST=JK, C=ID'
  Write-Host 'Creating release.keystore...'
  & "$JdkDir\bin\keytool.exe" -genkeypair -v `
    -keystore $ksPath `
    -alias shadow-depths `
    -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $storePass -keypass $keyPass `
    -dname $dname
  if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [IO.File]::WriteAllLines($ksProps, @(
    "storeFile=release.keystore"
    "storePassword=$storePass"
    "keyAlias=shadow-depths"
    "keyPassword=$keyPass"
  ), $utf8)
  @(
    'BACKUP THESE FILES — required for every Play Store update:'
    "  android\release.keystore"
    "  android\keystore.properties"
    ''
    "Store password: $storePass"
    "Key alias: shadow-depths"
    "Key password: $keyPass"
    ''
    'If you lose the keystore, you cannot publish updates to the same app.'
  ) | Set-Content -Encoding UTF8 $readme
  Write-Host "Signing credentials written to android\SIGNING-README.txt" -ForegroundColor Yellow
} elseif (-not (Test-Path $ksProps)) {
  throw 'release.keystore exists but keystore.properties is missing'
}

# --- Web + Capacitor sync ---
Write-Host 'Building web bundle...'
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Capacitor sync...'
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# --- Gradle release bundle ---
$jdkHomeGradle = ($JdkDir -replace '\\', '/')
$gradleProps = Join-Path $Root 'android\gradle.properties'
$gradleText = Get-Content $gradleProps -Raw
if ($gradleText -notmatch 'org.gradle.java.home') {
  Add-Content $gradleProps "`norg.gradle.java.home=$jdkHomeGradle"
}

Set-Location (Join-Path $Root 'android')
Write-Host 'Gradle bundleRelease...'
.\gradlew.bat bundleRelease --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$aabSrc = 'app\build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path $aabSrc)) { throw 'AAB not produced' }

Ensure-Dir $ReleaseDir
$aabDest = Join-Path $ReleaseDir 'app-release.aab'
Copy-Item $aabSrc $aabDest -Force

Write-Host ''
Write-Host 'SUCCESS' -ForegroundColor Green
Write-Host "Upload this file to Play Console:"
Write-Host "  $aabDest"
Write-Host 'Read android\SIGNING-README.txt and back up your keystore.'
