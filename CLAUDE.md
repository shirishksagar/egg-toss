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

## Version branches

`main` holds v1.1 (20 levels + Master). In Nov 2026 the owner asked for 10 more levels per branch, up to 100,
each with a new trick. Every branch is made from the one before (so it holds all earlier levels) and they are
**not** merged into `main`. Each branch's own CLAUDE.md has the rules, numbers and decisions for its trick.
From v2 on, levels 21+ have 50 baskets each and the menu has "Start at" (any level reached), because a
single climb to level 21 takes 1050 catches.

| Branch | Version (code) | Levels | New trick |
|---|---|---|---|
| `egg-toss-v2-levels-21-30` | 2.0 (20) | 30 | baskets that turn back; "Start at" a reached level |
| `egg-toss-v3-levels-31-40` | 3.0 (30) | 40 | baskets that speed up and slow down |
| `egg-toss-v4-levels-41-50` | 4.0 (40) | 50 | baskets that grow and shrink |
| `egg-toss-v5-levels-51-60` | 5.0 (50) | 60 | sleepy baskets that stop for a moment |
| `egg-toss-v6-levels-61-70` | 6.0 (60) | 70 | wind that pushes the egg sideways |
| `egg-toss-v7-levels-71-80` | 7.0 (70) | 80 | ghost baskets that fade in and out |
| `egg-toss-v8-levels-81-90` | 8.0 (80) | 90 | heart baskets (an egg back) and gold baskets (+3) |
| `egg-toss-v9-levels-91-100` | 9.0 (90) | 100 | grand finale mixing every trick; Master is level 101 |

APKs for every version are in `D:\MyProjects\ClaudeApps\MyAppsAPK` (never in Git). They are built by checking
each branch out here and running `npm run build:apk`; the signing key stays in this folder, untracked.
Branch names start with the app name (`egg-toss-`), like the owner's other repos.
