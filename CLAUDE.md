# Egg Toss

Android game: tap to throw an egg straight up into the next moving basket. Plain HTML/JS in
`www/` wrapped with Capacitor 8 into a signed APK. App id `com.dk.eggtoss`, portrait, VIBRATE.

## Run, test, build

- Tests: `npm test` (Node 22+; plain `node --test tests/core.test.js`, needs no packages). It includes a
  look-ahead bot that clears the start of every level after 20 and climbs into the Master level.
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

- `www/core.js` — pure game logic, no DOM (runs in Node): levels, basket tricks, scoring, starting from a
  level, save migration (`migrateSave`). A missed egg can be caught by any lower basket.
- `www/game.js` — drawing, input, menus, saving. `www/backgrounds.js` — one sky scene per level, then Master.
- `www/audio.js` — synthesized Web Audio music and effects, Music/Sounds switches.
- `tests/core.test.js` — logic tests.

## Levels

- Levels 1-20 have 5 × L baskets (5, 10 … 100): basket 1050 completes level 20. They never change: same
  baskets, same random numbers, same difficulty (a test checks a seed-42 fingerprint taken from v1.1).
- Levels 21 and up have 50 baskets each. `LEVELS` is the last normal level; the Master level
  (`MASTER_LEVEL = LEVELS + 1`, from basket `MASTER_START`) is always the level after it, endless.
- Difficulty after 20: width stays 56; speed rises gently from 265 (start of level 21) by 65/4000 per
  basket, so about 330 by the end of level 100. Master carries on from there and adds 1.5 per basket.
  The tricks bring the challenge, so keep the speed rise small: kids must still be able to play.
- Each level has its own named scene in `backgrounds.js` (`THEMES`, Master last). The "Best per level"
  grid shows every level plus Master, 7 to a row, and scrolls inside its box.

## Basket tricks (levels 21+)

- A trick is plain data stored in the basket (so `structuredClone` works) and decided by the seeded RNG
  when the basket is made. Extra random numbers are drawn only for baskets above 1050, so levels 1-20 are
  untouched. `TRICK_BANDS` lists, per band of levels, the tricks (with weights) and the chance a basket has
  one (rising through the band). Master uses the last band at its top chance. Never change a shipped band:
  that would change baskets people have already played.
- Each trick has an entry in `TRICKS` with the first level that uses it and a short tip; the level-up
  banner shows the tip on that level. index.html lists each trick in "Basket tricks". Basket marks in
  game.js (`drawTrickMarks`) tell the tricks apart.
- **Turn (levels 21-30, v2):** chance 35% → 65% through the band. The basket goes on for `go` = 0.9-1.6 s,
  suddenly turns back for `back` = 0.3-0.5 s, then turns again and carries on (go is always more than back,
  so it still crosses the whole screen; turning at fixed times instead could trap a basket on one side).
  It wiggles and its arrows flash red for 0.35 s (`TURN_WARN`) before each turn. Teal band with arrows.
- **Pulse (levels 31-40, v3):** band mix pulse 2 : turn 1, chance 45% → 70%. Speed swings smoothly between
  (1 - amp) and (1 + amp) × its normal speed: amp 0.45-0.6, rate 2.2-3.4 rad/s (one swing every 1.8-2.9 s),
  random start phase. It keeps its direction and never stops. Orange band with 1-3 speed stripes.
- **Grow (levels 41-50, v4):** band mix grow 2 : pulse 1 : turn 1, chance 50% → 72%. Width swings smoothly
  between (1.15 - amp) and (1.15 + amp) × its normal width (`GROW_MID`): amp 0.3-0.4, rate 1.8-2.8 rad/s,
  random start phase, so a 56 basket is about 42-87 wide. A catch uses the width at that moment. Growing
  next to a wall pushes the basket back inside. Purple rim, with arrows pointing out (growing) or in.
- **Nap (levels 51-60, v5):** band mix nap 2 : grow 1 : pulse 1 : turn 1, chance 50% → 75%. Moves for
  `awake` = 1.2-2.2 s, then stops for a `sleep` = 0.7-1.1 s nap, then goes on (it keeps its speed and
  direction). Blue band with a face: shut eyes and floating z's while napping, blinking for 0.3 s
  (`NAP_WARN`) before it wakes.
- **Wind (levels 61-70, v6):** band mix wind 3 : nap 1 : grow 1 : pulse 1 : turn 1, chance 55% → 75%. A
  windy basket has `wind` = ±20-50 units/s: an egg thrown from it (`egg.wind`, set by `toss`) drifts
  sideways at that speed all the way (kept on screen), about ±18-46 units by the time it reaches the next
  basket. A windy basket moves slower (`WIND_SLOW`: × 0.5 if its number is even, × 0.75 if odd): easier
  to aim from, and two baskets moving in step could otherwise keep a drifting egg from ever landing (the
  bot found that). A flag on the basket blows the wind's way; while the egg is in a windy basket, wind
  streaks cross the screen and an arrow under the eggs shows the direction and strength.

## Starting from a level, saves

- Players can start from any level they have reached (start and game-over panels, "Start at" picker,
  highest first, level 1 always there, hidden until a level after 1 is reached). Play / Play again still
  start with one tap, from the level picked last (`eggtoss.startLevel`, level 1 at first).
- `newGame(best, seed, startBasket)` starts on a level's first basket (`levelStart(level)`): baskets below
  it are made as usual (so the ones above match a full climb with the same seed), it becomes a still, wide
  starting basket, the ground sits just below it (`state.floor`, `groundY`), and only baskets above it score.
- localStorage: `eggtoss.best`, `eggtoss.levelBests` ({ level: points }), `eggtoss.masterKey` (level the
  Master best is saved under; missing means 21, as in v1.x), `eggtoss.reached` (highest level reached),
  `eggtoss.startLevel`, plus the Music/Sounds switches.
- When Master moves up, `migrateSave` moves its best from the old key to the new Master key, so it does not
  become a normal level's best. Saves from before v2 have no `reached`; it comes from the levels with a best
  (the old Master key 21 means level 21 was reached).

## Version branches

Each version adds 10 levels and one new basket trick on its own branch, built on the previous one.
Branches are not merged into main.

| Branch | Version (code) | Levels | Master | Added |
|---|---|---|---|---|
| `egg-toss-v2-levels-21-30` | 2.0 (20) | 30 | 31 | Start from a reached level, 50-basket levels, turning baskets, scenes Kite Day … Comet Night |
| `egg-toss-v3-levels-31-40` | 3.0 (30) | 40 | 41 | Pulsing baskets (speed up and slow down), scenes Butterfly Garden … Neon Night |
| `egg-toss-v4-levels-41-50` | 4.0 (40) | 50 | 51 | Growing baskets (catch width changes), scenes Hot Air Valley … Glacier Glow |
| `egg-toss-v5-levels-51-60` | 5.0 (50) | 60 | 61 | Sleepy baskets (stop for a nap, then go on), scenes Counting Sheep … Pillow Clouds |
| `egg-toss-v6-levels-61-70` | 6.0 (60) | 70 | 71 | Wind that pushes the flying egg sideways (flag + arrow), scenes Pinwheel Park … Storm Front |

## Shipping a version

Bump `versionCode` / `versionName` in `android/app/build.gradle` (and `version` in `package.json` and the
root of `package-lock.json`), run `npm run build:apk`, then commit (not the APK: APKs stay in `builds/` and
`D:\MyProjects\ClaudeApps\MyAppsAPK` on this laptop, never in Git) and push to https://github.com/shirishksagar/egg-toss.

## Working with the owner

- New to Android development: explain steps in plain language.
- After final testing, the APK goes into `D:\MyProjects\ClaudeApps\MyAppsAPK` (the build script does this).
