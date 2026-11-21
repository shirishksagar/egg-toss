/*
 * Egg Toss — pure game logic. No DOM, no timers, no randomness except the seeded RNG
 * stored in the state, so the same inputs always give the same game (and tests can
 * replay it).
 *
 * World coordinates: x runs 0..WORLD_W left to right, y runs upwards. Basket n sits
 * at y = n * BASKET_GAP. The egg rests on a basket's rim at the basket's y.
 *
 * A falling egg can be caught by any basket in its path: the next one up, its own, or
 * any lower one. Only baskets higher than any reached before score. It cracks only if
 * it reaches the ground.
 *
 * update(state, dt) mutates the state and returns a list of events for the
 * presentation layer (sound, vibration, floating text):
 *   toss, catch {basket, level, perfect, points}, levelUp {level}, landBack, catchLow {basket},
 *   crack {x, y}, respawn, gameOver
 *
 * Levels 1-20 have 5, 10, 15 ... 100 baskets; levels 21 and up have 50 each. The level
 * after the last one (MASTER_LEVEL) is the endless Master level where every basket is
 * faster than the last (see levelOf, basketSpec). The game draws a new background for
 * each level.
 *
 * From level 21 baskets can have tricks (see TRICK_BANDS): plain data stored in the basket,
 * drawn from the seeded RNG only for baskets above basket 1050, so levels 1-20 play exactly
 * as they always did.
 *
 * A game can start at the first basket of any level (newGame's startBasket). That basket
 * becomes a still, wide starting basket and the ground sits just below it; only baskets
 * above it score.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EggCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WORLD_W = 360;
  const BASKET_GAP = 170;      // vertical distance between baskets
  const GRAVITY = 1400;        // world units / s²
  const TOSS_HEIGHT = BASKET_GAP + 75;
  const TOSS_SPEED = Math.sqrt(2 * GRAVITY * TOSS_HEIGHT);
  const EGG_RADIUS = 13;
  const SIDE_MARGIN = 8;
  const START_LIVES = 3;
  const CRACK_TIME = 1.8;      // seconds the cracked egg stays on screen
  const GROUND_Y = -30;        // where an egg that misses every basket cracks
  const PERFECT_FRACTION = 0.16; // |offset| <= this × width counts as Perfect
  // Keep the egg's basket this far above the bottom of the view, so the basket below it
  // (the one most likely to save a missed egg) is on screen too.
  const CAMERA_BELOW = BASKET_GAP + 120;
  const CAMERA_LOWEST = GROUND_Y - 150; // never show more grass than this
  const CAMERA_FALL = 260;     // while the egg falls below its basket, keep it this far above the bottom
  const BASE_LEVELS = 20;      // the first levels: level L has 5 × L baskets
  const BASE_END = 1050;       // basket that completes level 20
  const LATE_SIZE = 50;        // baskets in each level after 20
  const LEVELS = 50;           // normal levels
  const MASTER_LEVEL = LEVELS + 1; // endless, and faster with every basket
  const OLD_MASTER_KEY = 21;   // where v1.x saved the Master level's best
  // After level 20 baskets stay 56 wide and speed up gently: 265 at basket 1050, 330 by
  // the end of level 100. The tricks bring the challenge.
  const LATE_SPEED_RISE = 65 / 4000;
  const TURN_WARN = 0.35;      // seconds a turning basket wiggles before it turns
  const GROW_MID = 1.15;       // a growing basket's width swings around this × its normal width

  /**
   * Tricks for the levels after 20. Each band of levels lists the tricks its baskets can
   * have (with weights) and the chance that a basket has one, rising through the band.
   * The Master level uses the last band at its highest chance. Never change a band once
   * shipped: that would change the baskets of levels people have already played.
   */
  const TRICK_BANDS = [
    { from: 21, to: 30, tricks: [['turn', 1]], chance: [0.35, 0.65] },
    { from: 31, to: 40, tricks: [['pulse', 2], ['turn', 1]], chance: [0.45, 0.7] },
    { from: 41, to: 50, tricks: [['grow', 2], ['pulse', 1], ['turn', 1]], chance: [0.5, 0.72] },
  ];

  /** First level that uses each trick, and the tip shown in its level-up banner. */
  const TRICKS = {
    turn: { first: 21, tip: 'Wiggly baskets suddenly turn back!' },
    pulse: { first: 31, tip: 'Zoomy baskets speed up and slow down!' },
    grow: { first: 41, tip: 'Stretchy baskets grow and shrink!' },
  };

  /** Small, fast, seedable PRNG (mulberry32). Returns the next float in [0, 1). */
  function nextRandom(state) {
    let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Number of baskets to catch in a level: 5, 10, 15 ... 100, then 50 each, then endless for Master. */
  function levelSize(level) {
    if (level <= BASE_LEVELS) return 5 * level;
    return level <= LEVELS ? LATE_SIZE : Infinity;
  }

  /** The basket number at which a level is completed: 5, 15, 30 ... 1050, 1100, 1150 ... */
  function levelEnd(level) {
    if (level <= BASE_LEVELS) return (5 * level * (level + 1)) / 2;
    return level <= LEVELS ? BASE_END + LATE_SIZE * (level - BASE_LEVELS) : Infinity;
  }

  /** The basket a level starts from (the egg sits in it before the level's first catch). */
  function levelStart(level) {
    return level <= 1 ? 0 : levelEnd(level - 1);
  }

  const MASTER_START = levelEnd(LEVELS); // 2550

  /**
   * Level the egg is in while it sits in basket n. Catching the last basket of a level
   * (basket 5, 15, 30 ...) moves it into the next level.
   */
  function levelOf(n) {
    if (n >= MASTER_START) return MASTER_LEVEL;
    let level = 1;
    while (n >= levelEnd(level)) level++;
    return level;
  }

  /** How far into its level basket n is: { level, done, size } (size is Infinity for Master). */
  function levelProgress(n) {
    const level = levelOf(n);
    return { level, done: n - levelStart(level), size: levelSize(level) };
  }

  const lateSpeed = (n) => 265 + (n - BASE_END) * LATE_SPEED_RISE;

  /**
   * Width and speed for basket n. Through levels 1-20 baskets get narrower and faster a
   * little with every basket; after that they stay narrow and speed up gently, and in the
   * Master level they keep speeding up with every basket.
   */
  function basketSpec(n) {
    if (n === 0) return { width: 120, speed: 0 };
    if (n >= MASTER_START) return { width: 56, speed: lateSpeed(MASTER_START) + (n - MASTER_START) * 1.5 };
    if (n >= BASE_END) return { width: 56, speed: lateSpeed(n) };
    const { level, done, size } = levelProgress(n);
    const p = (level - 1 + done / size) / BASE_LEVELS; // 0 at the start, 1 at the end of level 20
    return {
      width: 112 - 56 * Math.pow(p, 0.8),
      speed: 70 + 195 * Math.pow(p, 0.75),
    };
  }

  function makeBasket(state, n) {
    const { width, speed } = basketSpec(n);
    const half = width / 2 + SIDE_MARGIN;
    const x = n === 0 ? WORLD_W / 2 : half + nextRandom(state) * (WORLD_W - 2 * half);
    const dir = nextRandom(state) < 0.5 ? -1 : 1;
    const b = { n, x, y: n * BASKET_GAP, width, vx: speed * dir };
    if (n > BASE_END) addTricks(state, b, levelOf(n - 1));
    return b;
  }

  /** The trick band for a level after 20 (the Master level uses the last one), or null. */
  function trickBand(level) {
    if (level <= BASE_LEVELS) return null;
    for (const band of TRICK_BANDS) if (level >= band.from && level <= band.to) return band;
    return level > LEVELS ? TRICK_BANDS[TRICK_BANDS.length - 1] : null;
  }

  /** Chance that a basket in this level has a trick. */
  function trickChance(level) {
    const band = trickBand(level);
    if (!band) return 0;
    const [low, high] = band.chance;
    if (level > band.to) return high;
    return low + ((high - low) * (level - band.from)) / Math.max(1, band.to - band.from);
  }

  function pickTrick(band, r) {
    const total = band.tricks.reduce((sum, [, w]) => sum + w, 0);
    let x = r * total;
    for (const [name, w] of band.tricks) {
      if (x < w) return name;
      x -= w;
    }
    return band.tricks[band.tricks.length - 1][0];
  }

  /** Sets up one trick on a basket; each draws its own numbers from the seeded RNG. */
  const TRICK_SETUP = {
    // Goes on for `go` seconds, suddenly turns back for `back` seconds, then turns again and
    // carries on. It always gets further forward than back, so it still crosses the screen.
    turn(state, b) {
      const go = 0.9 + nextRandom(state) * 0.7;
      const back = 0.3 + nextRandom(state) * 0.2;
      b.turn = { go, back, left: go * (0.3 + 0.7 * nextRandom(state)), backing: false };
    },
    // Speed swings smoothly between (1 - amp) and (1 + amp) times its normal speed, once
    // every 2π / rate seconds. It never stops and keeps its direction.
    pulse(state, b) {
      b.pulse = {
        base: Math.abs(b.vx),
        amp: 0.45 + nextRandom(state) * 0.15,
        rate: 2.2 + nextRandom(state) * 1.2,
        phase: nextRandom(state) * Math.PI * 2,
      };
    },
    // Width swings smoothly between (GROW_MID - amp) and (GROW_MID + amp) times its normal
    // width (about 42 to 87 for a 56 basket): catching needs the egg inside the width it
    // has at that moment.
    grow(state, b) {
      b.grow = {
        base: b.width,
        amp: 0.3 + nextRandom(state) * 0.1,
        rate: 1.8 + nextRandom(state) * 1.0,
        phase: nextRandom(state) * Math.PI * 2,
      };
      b.width = growWidth(b.grow);
    },
  };

  function growWidth(grow) {
    return grow.base * (GROW_MID + grow.amp * Math.sin(grow.phase));
  }

  function addTricks(state, b, level) {
    const band = trickBand(level);
    if (!band) return;
    const has = nextRandom(state) < trickChance(level);
    const which = pickTrick(band, nextRandom(state));
    if (has) TRICK_SETUP[which](state, b);
  }

  /** Tip for the level-up banner when a level is the first to use a trick, else null. */
  function trickTip(level) {
    for (const info of Object.values(TRICKS)) if (info.first === level) return info.tip;
    return null;
  }

  function basket(state, n) {
    while (state.baskets.length <= n) state.baskets.push(makeBasket(state, state.baskets.length));
    return state.baskets[n];
  }

  /** World y of the ground: just below basket 0, or below the starting basket. */
  function groundY(state) {
    return state.floor * BASKET_GAP + GROUND_Y;
  }

  /**
   * A new game. `best` is the saved best score; `seed` makes the run repeatable.
   * `startBasket` (a level's first basket, see levelStart) starts the climb higher up:
   * the baskets below it are made as usual, so the ones above are the same as in a full
   * climb, but it becomes a still, wide starting basket with the ground just below it.
   * The game starts in the 'ready' phase; call start() to play.
   */
  function newGame(best = 0, seed = Date.now(), startBasket = 0) {
    const floor = Math.max(0, Math.floor(startBasket));
    const state = {
      phase: 'ready',          // ready | playing | paused | over
      score: 0,
      best,
      lives: START_LIVES,
      floor,                   // the starting basket; nothing below it is used
      current: floor,          // index of the basket the egg belongs to
      highest: floor,          // highest basket reached; only higher ones score
      levelPoints: {},         // points scored in each level this game: { [level]: points }
      baskets: [],
      egg: { mode: 'sitting', x: WORLD_W / 2, y: floor * BASKET_GAP, vy: 0 }, // sitting | flying | cracked
      crack: null,             // { x, y, timer } while the cracked egg is shown
      cameraY: floor * BASKET_GAP + CAMERA_LOWEST,
      time: 0,
      rng: seed | 0,
    };
    basket(state, floor + 1);
    if (floor > 0) {
      const { n, y } = state.baskets[floor];
      state.baskets[floor] = { n, x: WORLD_W / 2, y, width: basketSpec(0).width, vx: 0 };
    }
    return state;
  }

  function start(state) {
    if (state.phase === 'ready' || state.phase === 'paused') state.phase = 'playing';
    return state;
  }

  function pause(state) {
    if (state.phase === 'playing') state.phase = 'paused';
    return state;
  }

  /** Throw the egg straight up. Only works while it is sitting in a basket. */
  function toss(state) {
    if (state.phase !== 'playing' || state.egg.mode !== 'sitting') return [];
    state.egg.mode = 'flying';
    state.egg.vy = TOSS_SPEED;
    return [{ type: 'toss' }];
  }

  function moveBaskets(state, dt) {
    // Only baskets that can be on screen move: around the egg's basket and, while it
    // falls, around the egg itself.
    const eggLevel = Math.floor(state.egg.y / BASKET_GAP);
    const from = Math.max(state.floor, Math.min(state.current - 1, eggLevel - 2));
    const to = state.current + 4;
    for (let n = from; n <= to; n++) {
      const b = basket(state, n);
      stepTricks(b, dt);
      if (b.vx === 0) continue;
      b.x += b.vx * dt;
      const min = b.width / 2 + SIDE_MARGIN;
      const max = WORLD_W - min;
      if (b.x < min) { b.x = Math.min(max, min + (min - b.x)); b.vx = Math.abs(b.vx); }
      if (b.x > max) { b.x = Math.max(min, max - (b.x - max)); b.vx = -Math.abs(b.vx); }
    }
  }

  /** Runs a basket's tricks for dt seconds (a frozen basket, vx 0, stays frozen). */
  function stepTricks(b, dt) {
    const turn = b.turn;
    if (turn) {
      turn.left -= dt;
      if (turn.left <= 0) {
        turn.backing = !turn.backing;
        turn.left += turn.backing ? turn.back : turn.go;
        b.vx = -b.vx;
      }
    }
    const pulse = b.pulse;
    if (pulse) {
      pulse.phase = (pulse.phase + pulse.rate * dt) % (Math.PI * 2);
      b.vx = Math.sign(b.vx) * pulse.base * (1 + pulse.amp * Math.sin(pulse.phase));
    }
    const grow = b.grow;
    if (grow) {
      grow.phase = (grow.phase + grow.rate * dt) % (Math.PI * 2);
      b.width = growWidth(grow);
      const min = b.width / 2 + SIDE_MARGIN; // growing near a wall pushes it back inside
      b.x = Math.min(WORLD_W - min, Math.max(min, b.x));
    }
  }

  /** How far the egg is from a basket's centre, or null if it would miss the basket. */
  function catchOffset(b, eggX) {
    const offset = eggX - b.x;
    return Math.abs(offset) <= b.width / 2 - EGG_RADIUS * 0.4 ? offset : null;
  }

  function stepEgg(state, dt, events) {
    const egg = state.egg;
    const own = basket(state, state.current);

    if (egg.mode === 'sitting') {
      egg.x = own.x;
      egg.y = own.y;
      return;
    }

    if (egg.mode === 'cracked') {
      state.crack.timer -= dt;
      if (state.crack.timer > 0) return;
      state.crack = null;
      if (state.lives <= 0) {
        state.phase = 'over';
        events.push({ type: 'gameOver', score: state.score, best: state.best });
      } else {
        egg.mode = 'sitting';
        egg.vy = 0;
        egg.x = own.x;
        egg.y = own.y;
        events.push({ type: 'respawn' });
      }
      return;
    }

    // Flying: straight up and down, no sideways motion.
    const prevY = egg.y;
    egg.vy -= GRAVITY * dt;
    egg.y += egg.vy * dt;
    if (egg.vy >= 0) return;

    const next = basket(state, state.current + 1);
    if (prevY >= next.y && egg.y < next.y) {
      const offset = catchOffset(next, egg.x);
      if (offset !== null) {
        state.current += 1;
        // Only baskets above the highest one reached so far score.
        const isNew = state.current > state.highest;
        const newLevel = isNew && levelOf(state.current) > levelOf(state.highest);
        const perfect = isNew && Math.abs(offset) <= next.width * PERFECT_FRACTION;
        const points = isNew ? (perfect ? 2 : 1) : 0;
        state.highest = Math.max(state.highest, state.current);
        state.score += points;
        if (state.score > state.best) state.best = state.score;
        // The catch belongs to the level it was made in: catching basket 5 completes level 1.
        const level = levelOf(state.current - 1);
        if (points > 0) state.levelPoints[level] = (state.levelPoints[level] || 0) + points;
        settle(egg, next);
        basket(state, state.current + 1); // make sure the next target exists
        events.push({ type: 'catch', basket: state.current, level, perfect, points, x: egg.x, y: egg.y });
        if (newLevel) events.push({ type: 'levelUp', level: levelOf(state.current) });
        return;
      }
    }

    // Any basket at or below its own (down to the starting basket) can catch the egg on the way down.
    for (let n = Math.min(state.current, Math.floor(prevY / BASKET_GAP)); n >= state.floor; n--) {
      const b = basket(state, n);
      if (b.y <= egg.y) break; // not reached yet
      if (prevY >= b.y && catchOffset(b, egg.x) !== null) {
        settle(egg, b);
        if (n === state.current) {
          events.push({ type: 'landBack' });
        } else {
          state.current = n;
          events.push({ type: 'catchLow', basket: n, x: egg.x, y: egg.y });
        }
        return;
      }
    }

    const ground = groundY(state);
    if (egg.y < ground) {
      egg.mode = 'cracked';
      egg.vy = 0;
      egg.y = ground;
      state.lives -= 1;
      state.crack = { x: egg.x, y: ground, timer: CRACK_TIME };
      events.push({ type: 'crack', x: egg.x, y: ground, livesLeft: state.lives });
    }
  }

  function settle(egg, b) {
    egg.mode = 'sitting';
    egg.vy = 0;
    egg.y = b.y;
  }

  /**
   * Where the camera wants to be: the egg's basket near the bottom of the view, or
   * lower while the egg falls below it or lies cracked on the ground.
   */
  function cameraTarget(state) {
    let target = basket(state, state.current).y - CAMERA_BELOW;
    if (state.egg.mode === 'flying' && state.egg.vy < 0) target = Math.min(target, state.egg.y - CAMERA_FALL);
    const lowest = state.floor * BASKET_GAP + CAMERA_LOWEST;
    if (state.egg.mode === 'cracked') target = lowest;
    return Math.max(target, lowest);
  }

  /**
   * Brings saved progress up to date with this version. `save` holds what was stored:
   * levelBests { [level]: points }, masterKey (the level number the Master best was saved
   * under; missing means 21, as in v1.x) and reached (highest level reached). The Master
   * level moves up whenever levels are added, so its best moves to the new Master key
   * instead of turning into a normal level's best. Saves from before v2 (no masterKey) do
   * not know the highest level reached, so it comes from the levels that have a best: the
   * old Master level number is now the first level after 20.
   */
  function migrateSave({ levelBests = {}, masterKey = null, reached = 0 } = {}, master = MASTER_LEVEL) {
    const marker = parseInt(masterKey, 10);
    const oldMaster = marker || OLD_MASTER_KEY;
    const bests = {};
    let top = Math.max(1, parseInt(reached, 10) || 1);
    for (const [key, value] of Object.entries(levelBests || {})) {
      const level = parseInt(key, 10);
      const points = Number(value);
      if (!(level >= 1) || !(points > 0)) continue;
      if (!marker) top = Math.max(top, level);
      const to = level === oldMaster ? master : level;
      bests[to] = Math.max(bests[to] || 0, points);
    }
    return { levelBests: bests, masterKey: master, reached: Math.min(top, master) };
  }

  /** Advance the game by dt seconds. Returns the events that happened. */
  function update(state, dt) {
    const events = [];
    if (state.phase !== 'playing') return events;
    // Large frame gaps (tab switches, slow devices) are split so collisions are never skipped.
    let remaining = Math.min(dt, 0.25);
    while (remaining > 0) {
      const step = Math.min(remaining, 1 / 120);
      remaining -= step;
      state.time += step;
      moveBaskets(state, step);
      stepEgg(state, step, events);
      // The camera chases a falling egg quickly and drifts back up gently.
      const target = cameraTarget(state);
      const rate = target < state.cameraY ? 12 : 4;
      state.cameraY += (target - state.cameraY) * Math.min(1, step * rate);
      if (state.phase !== 'playing') break;
    }
    return events;
  }

  return {
    WORLD_W, BASKET_GAP, GRAVITY, TOSS_SPEED, EGG_RADIUS, START_LIVES, CRACK_TIME, PERFECT_FRACTION, GROUND_Y,
    BASE_LEVELS, BASE_END, LEVELS, MASTER_LEVEL, MASTER_START, TRICK_BANDS, TRICKS, TURN_WARN, GROW_MID,
    newGame, start, pause, toss, update, basket, basketSpec, levelOf, levelSize, levelEnd, levelStart, levelProgress,
    cameraTarget, groundY, trickChance, trickTip, migrateSave,
  };
});
