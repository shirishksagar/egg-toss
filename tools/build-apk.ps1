# Builds the signed release APK: builds/EggToss-v<versionName>.apk (also copied to ..\MyAppsAPK)
# Usage (from the project folder):  npm run build:apk
#
# Tooling lives on D:\Tools: JDK 21 (Capacitor 8's Gradle cannot run on newer Java) and
# the Gradle download cache. The Android SDK is the one installed by Android Studio.
# Tools like Gradle print progress to stderr, so failures are detected from exit codes below.
$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$env:JAVA_HOME = 'D:\Tools\jdk-21'
$env:GRADLE_USER_HOME = 'D:\Tools\gradle-home'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
# Downloads have timed out over IPv6 on this network; IPv4 is reliable.
$env:JAVA_OPTS = '-Djava.net.preferIPv4Stack=true'
$env:GRADLE_OPTS = '-Djava.net.preferIPv4Stack=true'

foreach ($required in @("$env:JAVA_HOME\bin\java.exe", $env:ANDROID_HOME, 'keystore.properties', 'eggtoss-release.jks')) {
    if (-not (Test-Path $required)) { throw "Missing: $required" }
}

Write-Host '== Logic tests'
node --test tests/core.test.js
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }

Write-Host '== Copy web files into the Android project'
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw 'cap sync failed' }

Write-Host '== Gradle release build'
Push-Location android
try {
    .\gradlew.bat assembleRelease --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }
} finally {
    Pop-Location
}

$versionName = (Select-String -Path android\app\build.gradle -Pattern 'versionName\s+"([^"]+)"').Matches[0].Groups[1].Value
$built = 'android\app\build\outputs\apk\release\app-release.apk'
New-Item -ItemType Directory -Force builds | Out-Null
$target = "builds\EggToss-v$versionName.apk"
Copy-Item $built $target -Force

Write-Host '== Check the signature'
$buildTools = Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') -Directory | Sort-Object Name | Select-Object -Last 1
& (Join-Path $buildTools.FullName 'apksigner.bat') verify --print-certs $target
if ($LASTEXITCODE -ne 0) { throw 'APK signature check failed' }

Write-Host "== Done: $target ($([math]::Round((Get-Item $target).Length / 1MB, 1)) MB)"

# Keep a copy with every other finished app, in ClaudeApps\MyAppsAPK next to this project.
$allApps = Join-Path (Split-Path $root -Parent) 'MyAppsAPK'
New-Item -ItemType Directory -Force $allApps | Out-Null
Copy-Item $target $allApps -Force
Write-Host "== Copied to $allApps"
