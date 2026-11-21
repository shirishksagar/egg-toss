# Egg Toss

Android game: tap to throw an egg straight up into the next moving basket. Plain HTML/JS in
`www/` wrapped with Capacitor 8 into a signed APK. App id `com.dk.eggtoss`, portrait, VIBRATE.

## Run, test, build

- Tests: `npm test` (Node 22+; includes a look-ahead bot that climbs into the Master level).
- Play in a browser: `npm run serve` → http://localhost:5173 (also in `.claude/launch.json` as `egg-toss`).
  Check changes in the browser pane at phone size, not the emulator.
- Signed APK: `npm run build:apk` (`tools/build-apk.ps1`): runs the tests, `npx cap sync android`, a Gradle
  release build, checks the signature, writes `builds/EggToss-v<versionName>.apk`, and copies it to `..\MyAppsAPK`.

### Tooling (all on D:)

- JDK 21 at `D:\Tools\jdk-21` — Capacitor 8's Gradle 8.14 cannot run on Android Studio's Java 25.
- Gradle cache at `D:\Tools\gradle-home`. Java downloads have timed out over IPv6, so the script prefers IPv4.
- Android SDK: `%LOCALAPPDATA%\Android\Sdk`.

### Signing

`eggtoss-release.jks` and `keystore.properties` sit in the project folder and are gitignored.
Never print, commit or overwrite them; without them no update to the same app can be published.

## Code layout

- `www/core.js` — pure game logic, no DOM (runs in Node). Levels 1-20 have 5 × L baskets, then the
  endless Master level (21) that speeds up every basket. A missed egg can be caught by any lower basket.
- `www/game.js` — drawing, input, menus. `www/backgrounds.js` — the 21 level scenes.
- `www/audio.js` — synthesized Web Audio music and effects, Music/Sounds switches.
- `tests/core.test.js` — logic tests.

## Shipping a version

Bump `versionCode` / `versionName` in `android/app/build.gradle`, run `npm run build:apk`, then commit
(not the APK: APKs stay in `builds/` and `MyAppsAPK` on this laptop, never in Git) and push to https://github.com/shirishksagar/egg-toss.

## Working with the owner

- New to Android development: explain steps in plain language.
- After final testing, the APK goes into `D:\MyProjects\ClaudeApps\MyAppsAPK` (the build script does this).
