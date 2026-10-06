# Build a separate test installation, without changing release IDs/signing.
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskStartDirectory = Get-Location
$taskEnvironment = @{}
$taskOverrides = @{
    VITE_ADMOB_APP_ID = 'ca-app-pub-3940256099942544~3347511713'
    VITE_ADMOB_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111'
    VITE_ADMOB_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712'
    VITE_ADMOB_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917'
    VITE_ADMOB_APP_OPEN_ID = 'ca-app-pub-3940256099942544/9257395921'
    VITE_ADMOB_APPOPEN_ID = 'ca-app-pub-3940256099942544/9257395921'
}

try {
    Set-Location -LiteralPath $taskRoot
    foreach ($taskKey in $taskOverrides.Keys) {
        $taskEnvironment[$taskKey] = [Environment]::GetEnvironmentVariable($taskKey, 'Process')
        [Environment]::SetEnvironmentVariable($taskKey, $taskOverrides[$taskKey], 'Process')
    }

    # Capacitor 8 needs Java 21. Use the installed Java selected on PATH.
    $taskJava = (Get-Command java.exe -ErrorAction Stop).Source
    $taskEnvironment['JAVA_HOME'] = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'Process')
    $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $taskJava)

    Write-Host 'Building test gameplay assets...'
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Gameplay asset build failed.' }

    Write-Host 'Syncing Android assets and plugins...'
    npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'Android asset sync failed.' }

    Write-Host 'Assembling isolated debug APK...'
    Push-Location -LiteralPath (Join-Path $taskRoot 'android')
    try {
        .\gradlew.bat assembleDebug --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Android APK assembly failed.' }
    } finally {
        Pop-Location
    }

    $taskSourceApk = Join-Path $taskRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
    if (-not (Test-Path -LiteralPath $taskSourceApk)) { throw 'Test APK was not produced.' }
    $taskPackage = Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json
    $taskOutputDirectory = Join-Path $taskRoot 'release'
    New-Item -ItemType Directory -Path $taskOutputDirectory -Force | Out-Null
    $taskOutputApk = Join-Path $taskOutputDirectory "Shadow-Depths-$($taskPackage.version)-audit-test.apk"
    Copy-Item -LiteralPath $taskSourceApk -Destination $taskOutputApk
    Write-Host "Test APK ready: $taskOutputApk" -ForegroundColor Green
} finally {
    foreach ($taskKey in $taskEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($taskKey, $taskEnvironment[$taskKey], 'Process')
    }
    Set-Location -LiteralPath $taskStartDirectory
}
