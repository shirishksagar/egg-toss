'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../www/core.js');

const FRAME = 1 / 60;

function playing(seed = 42) {
  return core.start(core.newGame(0, seed));
}

/** Runs frames until the egg settles (sits again or finishes cracking). Returns all events. */
function settle(state, maxSeconds = 6) {
  const events = [];
  for (let t = 0; t < maxSeconds && state.phase === 'playing'; t += FRAME) {
    events.push(...core.update(state, FRAME));
    if (state.egg.mode === 'sitting' && t > 0) break;
  }
  return events;
}

/** Puts the next basket directly under the egg's path (offset from its centre) and freezes it. */
function aimNext(state, offset = 0) {
  const next = core.basket(state, state.current + 1);
  next.x = state.egg.x + offset;
  next.vx = 0;
  return next;
}

/** Moves a basket far from the egg and freezes it. */
function moveAway(state, n) {
  const b = core.basket(state, n);
  b.x = state.egg.x < core.WORLD_W / 2 ? core.WORLD_W - b.width / 2 - 10 : b.width / 2 + 10;
  b.vx = 0;
}

/** Moves basket n and every basket below it out of the egg's path. */
function clearPathDown(state, n) {
  for (let i = n; i >= 0; i--) moveAway(state, i);
}

/** Catches the egg in the next basket (centred), so it climbs one level. */
function climb(state) {
  aimNext(state, 0);
  core.toss(state);
  return settle(state);
}

/** Throws with every basket out of the way, so the egg falls to the ground. */
function throwToGround(state) {
  moveAway(state, state.current + 1);
  core.toss(state);
  clearPathDown(state, state.current);
  const events = [];
  for (let i = 0; i < 900 && !events.some((e) => e.type === 'crack'); i++) events.push(...core.update(state, FRAME));
  return events;
}

test('a new game starts ready, with 3 eggs sitting in a still starting basket', () => {
  const s = core.newGame(7, 1);
  assert.equal(s.phase, 'ready');
  assert.equal(s.lives, 3);
  assert.equal(s.score, 0);
  assert.equal(s.best, 7);
  assert.equal(s.egg.mode, 'sitting');
  assert.equal(core.basket(s, 0).vx, 0);
  assert.equal(core.basket(s, 0).x, core.WORLD_W / 2);
});

test('tossing only works while playing and while the egg is sitting', () => {
  const s = core.newGame(0, 1);
  assert.deepEqual(core.toss(s), []);
  core.start(s);
  assert.deepEqual(core.toss(s), [{ type: 'toss' }]);
  assert.deepEqual(core.toss(s), [], 'cannot toss mid-air');
});

test('a toss rises above the next basket before falling', () => {
  const s = playing();
  core.toss(s);
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    core.update(s, FRAME);
    peak = Math.max(peak, s.egg.y);
  }
  assert.ok(peak > core.BASKET_GAP + 30, `peak ${peak} should clear the next basket`);
});

test('the egg flies straight up: its x never changes in the air', () => {
  const s = playing();
  const x = s.egg.x;
  moveAway(s, 1);
  core.toss(s);
  for (let i = 0; i < 30; i++) {
    core.update(s, FRAME);
    assert.equal(s.egg.x, x);
  }
});

test('landing near the centre of the next basket is a Perfect worth 2', () => {
  const s = playing();
  aimNext(s, 0);
  core.toss(s);
  const events = settle(s);
  const caught = events.find((e) => e.type === 'catch');
  assert.ok(caught);
  assert.equal(caught.perfect, true);
  assert.equal(caught.points, 2);
  assert.equal(s.score, 2);
  assert.equal(s.current, 1);
});

test('landing near the edge of the next basket scores 1, not Perfect', () => {
  const s = playing();
  const next = core.basket(s, 1);
  aimNext(s, next.width * 0.35);
  core.toss(s);
  const caught = settle(s).find((e) => e.type === 'catch');
  assert.ok(caught);
  assert.equal(caught.perfect, false);
  assert.equal(s.score, 1);
});

test('missing the next basket drops the egg back into its own basket with no penalty', () => {
  const s = playing();
  moveAway(s, 1);
  core.toss(s);
  const events = settle(s);
  assert.ok(events.some((e) => e.type === 'landBack'));
  assert.equal(s.lives, 3);
  assert.equal(s.score, 0);
  assert.equal(s.current, 0);
  assert.equal(s.egg.mode, 'sitting');
});

test('missing every basket cracks the egg on the ground, costs one life, and respawns after the crack time', () => {
  const s = playing();
  climb(s); // now in basket 1
  const events = throwToGround(s);
  const crack = events.find((e) => e.type === 'crack');
  assert.ok(crack);
  assert.equal(crack.y, core.GROUND_Y);
  assert.equal(s.lives, 2);
  assert.equal(s.egg.mode, 'cracked');

  // Still cracked just before the crack time is up, back in the basket after it.
  for (let t = 0; t < core.CRACK_TIME - 0.1; t += FRAME) core.update(s, FRAME);
  assert.equal(s.egg.mode, 'cracked');
  const later = [];
  for (let t = 0; t < 0.3; t += FRAME) later.push(...core.update(s, FRAME));
  assert.ok(later.some((e) => e.type === 'respawn'));
  assert.equal(s.egg.mode, 'sitting');
  assert.equal(s.current, 1, 'the egg comes back in the basket it was thrown from');
});

test('losing all three eggs ends the game', () => {
  const s = playing();
  climb(s);
  const events = [];
  for (let life = 0; life < 3; life++) {
    events.push(...throwToGround(s));
    for (let i = 0; i < 300 && s.phase === 'playing' && s.egg.mode === 'cracked'; i++) {
      events.push(...core.update(s, FRAME));
    }
  }
  assert.equal(s.lives, 0);
  assert.equal(s.phase, 'over');
  assert.equal(events.filter((e) => e.type === 'crack').length, 3);
  assert.ok(events.some((e) => e.type === 'gameOver'));
});

test('a lower basket in the egg\'s path catches it: no egg lost, no points', () => {
  const s = playing();
  climb(s);
  climb(s);
  climb(s); // in basket 3, score 6
  assert.equal(s.current, 3);
  moveAway(s, 4);
  core.toss(s);
  moveAway(s, 3);
  moveAway(s, 2);
  const low = core.basket(s, 1);
  low.x = s.egg.x;
  low.vx = 0;
  const events = settle(s);
  const caught = events.find((e) => e.type === 'catchLow');
  assert.ok(caught, 'basket 1 should catch the falling egg');
  assert.equal(caught.basket, 1);
  assert.equal(s.current, 1);
  assert.equal(s.lives, 3);
  assert.equal(s.score, 6);
  assert.equal(s.egg.mode, 'sitting');
});

test('the nearest basket below wins when several are in the path', () => {
  const s = playing();
  climb(s);
  climb(s);
  climb(s);
  moveAway(s, 4);
  core.toss(s);
  moveAway(s, 3);
  for (const n of [2, 1, 0]) {
    const b = core.basket(s, n);
    b.x = s.egg.x;
    b.vx = 0;
  }
  const caught = settle(s).find((e) => e.type === 'catchLow');
  assert.equal(caught.basket, 2);
});

test('climbing back through baskets already reached scores nothing until a new one', () => {
  const s = playing();
  climb(s);
  climb(s); // basket 2, highest 2, score 4
  moveAway(s, 3);
  core.toss(s);
  moveAway(s, 2);
  const low = core.basket(s, 1);
  low.x = s.egg.x;
  low.vx = 0;
  settle(s);
  assert.equal(s.current, 1);

  const again = climb(s).find((e) => e.type === 'catch'); // back to 2: already reached
  assert.equal(again.points, 0);
  assert.equal(again.perfect, false);
  assert.equal(s.score, 4);

  const fresh = climb(s).find((e) => e.type === 'catch'); // 3 is new
  assert.equal(fresh.points, 2);
  assert.equal(s.score, 6);
});

test('the camera follows a falling egg down and returns to its basket', () => {
  const s = playing();
  for (let i = 0; i < 4; i++) climb(s);
  for (let i = 0; i < 180; i++) core.update(s, FRAME);
  const high = s.cameraY;
  throwToGround(s);
  assert.ok(s.cameraY < high - core.BASKET_GAP * 2, 'camera went down with the egg');
  for (let i = 0; i < 600 && s.egg.mode !== 'sitting'; i++) core.update(s, FRAME);
  for (let i = 0; i < 300; i++) core.update(s, FRAME);
  assert.ok(Math.abs(s.cameraY - high) < 10, 'camera back up at the egg\'s basket');
});

test('level L has 5 × L baskets up to 20, then 50 each, then the endless Master level', () => {
  assert.equal(core.LEVELS, 70);
  assert.equal(core.MASTER_LEVEL, 71);
  assert.equal(core.MASTER_START, 3550);
  assert.equal(core.MASTER_START, 1050 + 50 * (core.LEVELS - 20));
  assert.equal(core.levelSize(1), 5);
  assert.equal(core.levelSize(2), 10);
  assert.equal(core.levelSize(20), 100);
  for (let level = 21; level <= core.LEVELS; level++) assert.equal(core.levelSize(level), 50, `level ${level}`);
  assert.equal(core.levelSize(core.MASTER_LEVEL), Infinity);
  // Catching basket 5 completes level 1, basket 15 completes level 2, and so on.
  assert.equal(core.levelOf(0), 1);
  assert.equal(core.levelOf(4), 1);
  assert.equal(core.levelOf(5), 2);
  assert.equal(core.levelOf(14), 2);
  assert.equal(core.levelOf(15), 3);
  assert.equal(core.levelEnd(20), 1050, 'levels 1-20 are unchanged');
  assert.equal(core.levelOf(1049), 20);
  assert.equal(core.levelOf(1050), 21);
  assert.equal(core.levelEnd(21), 1100);
  assert.equal(core.levelOf(core.MASTER_START - 1), core.LEVELS);
  assert.equal(core.levelOf(core.MASTER_START), core.MASTER_LEVEL);
  assert.equal(core.levelOf(100000), core.MASTER_LEVEL, 'Master never ends');
  // Each level's basket count matches its size.
  for (let level = 1; level <= core.LEVELS; level++) {
    let count = 0;
    for (let n = 1; n <= core.MASTER_START; n++) if (core.levelOf(n - 1) === level) count++;
    assert.equal(count, core.levelSize(level), `level ${level}`);
    assert.equal(core.levelStart(level + 1), core.levelEnd(level));
  }
  assert.equal(core.levelStart(1), 0);
  assert.equal(core.levelStart(core.MASTER_LEVEL), core.MASTER_START);
  assert.deepEqual(core.levelProgress(7), { level: 2, done: 2, size: 10 });
  assert.deepEqual(core.levelProgress(1060), { level: 21, done: 10, size: 50 });
  assert.deepEqual(core.levelProgress(core.MASTER_START + 10), { level: core.MASTER_LEVEL, done: 10, size: Infinity });
});

/** Puts the egg in basket n as if the player had already climbed there. */
function jumpTo(state, n) {
  state.current = n;
  state.highest = n;
  const b = core.basket(state, n);
  state.egg.x = b.x;
  state.egg.y = b.y;
  state.cameraY = core.cameraTarget(state);
}

test('catching the 5th basket announces level 2, once', () => {
  const s = playing();
  for (let i = 0; i < 4; i++) {
    assert.equal(climb(s).filter((e) => e.type === 'levelUp').length, 0);
  }
  const up = climb(s).filter((e) => e.type === 'levelUp');
  assert.deepEqual(up.map((e) => e.level), [2]);

  // Falling back into level 1 and climbing to basket 5 again does not repeat it.
  moveAway(s, 6);
  core.toss(s);
  moveAway(s, 5);
  const low = core.basket(s, 4);
  low.x = s.egg.x;
  low.vx = 0;
  settle(s);
  assert.equal(s.current, 4);
  assert.equal(climb(s).filter((e) => e.type === 'levelUp').length, 0);
});

test('reaching basket 1050 enters level 21', () => {
  const s = playing();
  jumpTo(s, 1049);
  const up = climb(s).filter((e) => e.type === 'levelUp');
  assert.deepEqual(up.map((e) => e.level), [21]);
});

test('points go to the level each catch was made in', () => {
  const s = playing();
  climb(s); // Perfect in level 1
  const edge = core.basket(s, 2);
  aimNext(s, edge.width * 0.35);
  core.toss(s);
  settle(s); // +1 in level 1
  assert.deepEqual(s.levelPoints, { 1: 3 });

  jumpTo(s, 4);
  assert.equal(climb(s).find((e) => e.type === 'catch').level, 1, 'basket 5 completes level 1');
  assert.equal(climb(s).find((e) => e.type === 'catch').level, 2, 'basket 6 is in level 2');
  assert.deepEqual(s.levelPoints, { 1: 5, 2: 2 });
  assert.equal(s.score, 7);
});

test('climbing back through old baskets adds nothing to the level\'s points', () => {
  const s = playing();
  climb(s);
  climb(s);
  moveAway(s, 3);
  core.toss(s);
  moveAway(s, 2);
  const low = core.basket(s, 1);
  low.x = s.egg.x;
  low.vx = 0;
  settle(s);
  climb(s);
  assert.deepEqual(s.levelPoints, { 1: 4 });
});

test('higher baskets are narrower and faster', () => {
  for (let n = 2; n < 1300; n++) {
    const lower = core.basketSpec(n - 1);
    const higher = core.basketSpec(n);
    assert.ok(higher.width <= lower.width, `width at ${n}`);
    assert.ok(higher.speed >= lower.speed, `speed at ${n}`);
  }
  // Every level up to 20 ends noticeably harder than it started.
  for (let level = 1; level <= 20; level++) {
    const first = core.basketSpec(level === 1 ? 1 : core.levelEnd(level - 1) + 1);
    const last = core.basketSpec(core.levelEnd(level));
    assert.ok(last.speed - first.speed > 5, `speed rises through level ${level}`);
    assert.ok(first.width - last.width > 1, `width shrinks through level ${level}`);
  }
  assert.ok(core.basketSpec(1049).width < 60, 'level 20 baskets are narrow');
  assert.ok(core.basketSpec(1049).speed > 255, 'level 20 baskets are fast');
});

test('in the Master level every basket is faster than the one before', () => {
  for (let n = core.MASTER_START + 1; n < core.MASTER_START + 500; n++) {
    assert.ok(core.basketSpec(n).speed > core.basketSpec(n - 1).speed, `speed at ${n}`);
  }
  assert.ok(core.basketSpec(core.MASTER_START + 100).speed > core.basketSpec(core.MASTER_START).speed + 100);
});

test('moving baskets stay inside the screen', () => {
  const s = playing(3);
  for (let i = 0; i < 2000; i++) {
    core.update(s, FRAME);
    for (const b of s.baskets) {
      assert.ok(b.x - b.width / 2 >= 0 && b.x + b.width / 2 <= core.WORLD_W, `basket ${b.n} at ${b.x}`);
    }
  }
});

test('pausing freezes everything', () => {
  const s = playing();
  core.toss(s);
  core.update(s, FRAME * 5);
  core.pause(s);
  const before = JSON.stringify(s);
  assert.deepEqual(core.update(s, 1), []);
  assert.equal(JSON.stringify(s), before);
  core.start(s);
  core.update(s, FRAME);
  assert.notEqual(JSON.stringify(s), before);
});

test('the best score follows the score once it is beaten', () => {
  const s = core.start(core.newGame(1, 5));
  aimNext(s, 0);
  core.toss(s);
  settle(s);
  assert.equal(s.score, 2);
  assert.equal(s.best, 2);
});

test('the camera follows the egg upwards', () => {
  const s = playing();
  for (let i = 0; i < 3; i++) climb(s);
  const before = s.cameraY;
  climb(s);
  for (let i = 0; i < 180; i++) core.update(s, FRAME);
  assert.ok(s.cameraY > before + core.BASKET_GAP * 0.9);
});

test('the basket below the egg stays on screen as well as the next one up', () => {
  const s = playing();
  for (let i = 0; i < 5; i++) climb(s);
  for (let i = 0; i < 300; i++) core.update(s, FRAME);
  const viewHeight = 640; // the shortest phone shape the game is laid out for (9:16)
  const onScreen = (n) => {
    const y = core.basket(s, n).y - s.cameraY;
    return y > 0 && y < viewHeight;
  };
  assert.ok(onScreen(s.current - 1), 'basket below');
  assert.ok(onScreen(s.current), 'own basket');
  assert.ok(onScreen(s.current + 1), 'next basket');
});

test('at the start the camera does not sink into the ground', () => {
  const s = playing();
  for (let i = 0; i < 300; i++) core.update(s, FRAME);
  assert.ok(s.cameraY >= core.GROUND_Y - 150);
});

test('the same seed gives the same baskets', () => {
  const a = core.newGame(0, 99);
  const b = core.newGame(0, 99);
  for (let n = 0; n < 20; n++) assert.deepEqual(core.basket(a, n), core.basket(b, n));
});

/**
 * A copy of the game to try a move on. Only the baskets near the egg are copied; the rest
 * are shared with the original, which is safe because a trial only plays until the egg is
 * caught by (or falls past) the next basket, and only baskets near the egg move.
 */
function trialCopy(state) {
  const { baskets, ...rest } = state;
  const copy = structuredClone(rest);
  copy.baskets = baskets.slice();
  const to = Math.min(baskets.length, state.current + 7);
  for (let n = Math.max(0, state.current - 4); n < to; n++) copy.baskets[n] = structuredClone(baskets[n]);
  return copy;
}

/** Tosses now and plays on: true once the next basket catches the egg, false once it can't. */
function tossCatches(trial) {
  core.toss(trial);
  const nextY = core.basket(trial, trial.current + 1).y;
  for (let t = 0; t < 3; t += FRAME) {
    if (core.update(trial, FRAME).some((e) => e.type === 'catch')) return true;
    if (trial.egg.mode !== 'flying' || (trial.egg.vy < 0 && trial.egg.y < nextY - 1)) return false;
  }
  return false;
}

/**
 * Look-ahead bot: before each toss it tries waiting 0, 1, 2 ... frames on a copy of the
 * game (made with structuredClone), and throws at the first moment that copy shows a catch.
 */
function botWait(state) {
  const base = trialCopy(state);
  for (let wait = 0; wait < 400; wait++) {
    if (tossCatches(trialCopy(base))) return wait;
    core.update(base, FRAME);
  }
  return -1;
}

test('a look-ahead bot can climb 60 baskets without cracking an egg', () => {
  const s = playing(2024);
  for (let climb = 0; climb < 60; climb++) {
    const wait = botWait(s);
    assert.ok(wait >= 0, `no catchable moment found at basket ${s.current}`);
    for (let i = 0; i < wait; i++) core.update(s, FRAME);
    core.toss(s);
    const events = settle(s);
    assert.ok(events.some((e) => e.type === 'catch'), `bot missed at basket ${s.current}`);
  }
  assert.equal(s.current, 60);
  assert.equal(s.lives, 3);
  assert.ok(s.score >= 60 && s.score <= 120);
  assert.ok(core.basket(s, 60).width < core.basket(s, 1).width);
});

/** Lets the bot climb `count` baskets; returns the levels it reached on the way. */
function botClimb(state, count) {
  const levels = [];
  for (let i = 0; i < count; i++) {
    const wait = botWait(state);
    assert.ok(wait >= 0, `no catchable moment found at basket ${state.current}`);
    for (let f = 0; f < wait; f++) core.update(state, FRAME);
    core.toss(state);
    const events = settle(state);
    assert.ok(events.some((e) => e.type === 'catch'), `bot missed at basket ${state.current}`);
    levels.push(...events.filter((e) => e.type === 'levelUp').map((e) => e.level));
  }
  return levels;
}

test('the bot climbs through the first levels', () => {
  const s = playing(11);
  assert.deepEqual(botClimb(s, 32), [2, 3, 4], 'levels 1-3 are 5 + 10 + 15 = 30 baskets');
  assert.equal(s.lives, 3);
});

test('the bot can clear the end of level 20 and climb into level 21', () => {
  const s = playing(77);
  jumpTo(s, 1035);
  assert.deepEqual(botClimb(s, 25), [21]);
  assert.equal(s.current, 1060);
  assert.equal(s.lives, 3);
});

// Every level after 20: from just before it starts, through its level-up and first 15 baskets.
for (let level = 21; level <= core.LEVELS; level++) {
  test(`the bot clears the level-up and first 15 baskets of level ${level} without losing an egg`, () => {
    const s = playing(500 + level);
    jumpTo(s, core.levelStart(level) - 2);
    assert.deepEqual(botClimb(s, 17), [level]);
    assert.equal(s.current, core.levelStart(level) + 15);
    assert.equal(s.lives, 3);
  });
}

test('the bot can clear the end of the last level and climb into the Master level', () => {
  const s = playing(78);
  jumpTo(s, core.MASTER_START - 15);
  assert.deepEqual(botClimb(s, 25), [core.MASTER_LEVEL]);
  assert.equal(s.current, core.MASTER_START + 10);
  assert.equal(s.lives, 3);
});

test('deep in the Master level the baskets are fast but still catchable', () => {
  const s = playing(5);
  jumpTo(s, core.MASTER_START + 150);
  assert.ok(core.basketSpec(core.MASTER_START + 151).speed > core.basketSpec(core.MASTER_START).speed + 200);
  botClimb(s, 10);
  assert.equal(s.current, core.MASTER_START + 160);
});

// ---- Levels after 20, starting from a chosen level, saved progress ----------------

test('levels 1-20 keep exactly the same baskets as before (seed 42 fingerprint from v1.1)', () => {
  const s = core.newGame(0, 42);
  core.basket(s, core.BASE_END);
  let h = 0;
  for (let n = 0; n <= core.BASE_END; n++) {
    const b = s.baskets[n];
    h = (h * 31 + Math.round(b.x * 1000) + Math.round(b.vx * 1000) * 7 + Math.round(b.width * 1000) * 13) % 1000000007;
    assert.deepEqual(Object.keys(b), ['n', 'x', 'y', 'width', 'vx'], `basket ${n} has no tricks`);
  }
  assert.equal(h, 462640167);
  assert.equal(s.rng, -170924061, 'and they use the same random numbers');
});

test('after level 20 baskets stay 56 wide and speed up only gently', () => {
  assert.equal(core.basketSpec(core.BASE_END).speed, 265);
  for (let n = core.BASE_END + 1; n < core.MASTER_START; n++) {
    const spec = core.basketSpec(n);
    assert.equal(spec.width, 56);
    assert.ok(spec.speed >= core.basketSpec(n - 1).speed);
  }
  // 265 at the start of level 21, rising towards 330 by the end of level 100.
  const perLevel = core.basketSpec(core.levelEnd(22)).speed - core.basketSpec(core.levelEnd(21)).speed;
  assert.ok(Math.abs(perLevel - 65 / 80) < 1e-9, `${perLevel} faster per level`);
  assert.ok(core.basketSpec(core.MASTER_START - 1).speed < 331);
  // The Master level carries on from there.
  assert.ok(Math.abs(core.basketSpec(core.MASTER_START).speed - core.basketSpec(core.MASTER_START - 1).speed) < 1);
});

test('a game can start at the first basket of a level reached before', () => {
  const start = core.levelStart(23);
  const s = core.start(core.newGame(5, 9, start));
  assert.equal(s.current, start);
  assert.equal(s.highest, start);
  assert.equal(s.floor, start);
  assert.equal(s.score, 0);
  assert.equal(core.levelOf(s.current), 23);
  const pad = core.basket(s, start);
  assert.equal(pad.vx, 0, 'the starting basket stands still');
  assert.equal(pad.x, core.WORLD_W / 2);
  assert.equal(pad.width, core.basketSpec(0).width);
  assert.equal(s.egg.y, pad.y);
  // The baskets above are the same as in a full climb with the same seed.
  const full = core.newGame(5, 9);
  for (let n = start + 1; n < start + 10; n++) assert.deepEqual(core.basket(s, n), core.basket(full, n));

  // Only baskets above the start score, and they count for the level they are in.
  const caught = climb(s).find((e) => e.type === 'catch');
  assert.equal(caught.level, 23);
  assert.equal(caught.points, 2);
  assert.deepEqual(s.levelPoints, { 23: 2 });

  // The ground is just below the starting basket: lower baskets never catch the egg.
  const events = throwToGround(s);
  const crack = events.find((e) => e.type === 'crack');
  assert.ok(crack, 'the egg cracks');
  assert.equal(crack.y, start * core.BASKET_GAP + core.GROUND_Y);
  assert.equal(core.groundY(s), crack.y);
  assert.ok(!events.some((e) => e.type === 'catchLow'));
  for (let i = 0; i < 300 && s.egg.mode !== 'sitting'; i++) core.update(s, FRAME);
  assert.equal(s.current, start + 1, 'back in the basket it was thrown from');
  assert.ok(s.cameraY >= start * core.BASKET_GAP + core.GROUND_Y - 150, 'the camera stays near the start');
});

test('starting from level 1 is the normal game, and the Master level can be a start too', () => {
  assert.deepEqual(core.newGame(0, 3, core.levelStart(1)), core.newGame(0, 3));
  const s = core.start(core.newGame(0, 3, core.levelStart(core.MASTER_LEVEL)));
  assert.equal(core.levelOf(s.current), core.MASTER_LEVEL);
  assert.equal(climb(s).find((e) => e.type === 'catch').level, core.MASTER_LEVEL);
});

test('saved level bests: the old Master best moves to the new Master level', () => {
  // v1.1 saved Master under 21 and had no marker.
  const old = core.migrateSave({ levelBests: { 1: 9, 20: 150, 21: 40 } });
  assert.deepEqual(old.levelBests, { 1: 9, 20: 150, [core.MASTER_LEVEL]: 40 });
  assert.equal(old.levelBests[21], undefined, 'it does not become the best of level 21');
  assert.equal(old.masterKey, core.MASTER_LEVEL);
  assert.equal(old.reached, 21, 'reaching Master in v1.1 means reaching level 21 now');

  // Already up to date: nothing changes.
  const same = core.migrateSave({ levelBests: old.levelBests, masterKey: core.MASTER_LEVEL, reached: 21 });
  assert.deepEqual(same, old);

  // From a version whose Master was level 31 to one whose Master is 41 (and so on).
  const moved = core.migrateSave({ levelBests: { 3: 8, 25: 70, 31: 12 }, masterKey: '31', reached: '31' }, 41);
  assert.deepEqual(moved, { levelBests: { 3: 8, 25: 70, 41: 12 }, masterKey: 41, reached: 31 });

  // Nothing saved yet, or rubbish saved.
  assert.deepEqual(core.migrateSave({}), { levelBests: {}, masterKey: core.MASTER_LEVEL, reached: 1 });
  assert.equal(core.migrateSave({ levelBests: null, masterKey: 'x', reached: 'y' }).reached, 1);
  assert.deepEqual(core.migrateSave({ levelBests: { a: 3, 2: 0, 4: 'x', 5: 6 } }).levelBests, { 5: 6 });
  // Before v2 nothing was saved about the highest level, so the bests tell; after that the saved value counts.
  assert.equal(core.migrateSave({ levelBests: { 2: 5, 7: 1 } }).reached, 7);
  assert.equal(core.migrateSave({ levelBests: { 2: 5 }, masterKey: 31, reached: 24 }).reached, 24);
  assert.equal(core.migrateSave({ levelBests: { 2: 5, 31: 9 }, masterKey: 31, reached: 21 }, 31).reached, 21);
  assert.equal(core.migrateSave({ reached: 999 }).reached, core.MASTER_LEVEL);
});

test('tricks appear only after level 20, more often as the levels go on, the same for the same seed', () => {
  const s = core.newGame(0, 4242);
  core.basket(s, core.MASTER_START + 200);
  for (let n = 0; n <= core.BASE_END; n++) assert.equal(Object.keys(s.baskets[n]).length, 5, `basket ${n}`);
  const share = (level) => {
    let count = 0;
    for (let n = core.levelStart(level) + 1; n <= core.levelEnd(level); n++) {
      if (Object.keys(s.baskets[n]).length > 5) count++;
    }
    return count / core.levelSize(level);
  };
  assert.ok(share(21) > 0.1 && share(21) < 0.6, `level 21: ${share(21)}`);
  let early = 0;
  let late = 0;
  for (let level = 21; level <= 23; level++) early += share(level);
  for (let level = core.LEVELS - 2; level <= core.LEVELS; level++) late += share(level);
  assert.ok(late > early, 'later levels have more tricks');
  assert.equal(core.trickChance(20), 0);
  assert.ok(core.trickChance(core.MASTER_LEVEL) >= core.trickChance(core.LEVELS));
  const again = core.newGame(0, 4242);
  core.basket(again, core.MASTER_START + 200);
  assert.deepEqual(again.baskets, s.baskets);
  assert.deepEqual(structuredClone(s.baskets), s.baskets, 'baskets are plain data');
});

test('each trick has a tip on the first level that uses it, and only there', () => {
  assert.equal(core.trickTip(20), null);
  for (const [name, info] of Object.entries(core.TRICKS)) {
    assert.equal(typeof core.trickTip(info.first), 'string', name);
    assert.ok(info.first > 20 && info.first <= core.LEVELS, name);
  }
  const firsts = new Set(Object.values(core.TRICKS).map((t) => t.first));
  for (let level = 1; level <= core.MASTER_LEVEL; level++) {
    if (!firsts.has(level)) assert.equal(core.trickTip(level), null, `level ${level}`);
  }
});

/** The first basket after `from` that has the trick. */
function findTrick(state, trick, from = core.BASE_END) {
  for (let n = from + 1; n < core.MASTER_START + 500; n++) if (core.basket(state, n)[trick]) return core.basket(state, n);
  throw new Error(`no ${trick} basket`);
}

test('a turning basket goes on, suddenly turns back for a moment, then carries on', () => {
  const s = playing(8);
  const b = findTrick(s, 'turn');
  assert.ok(b.n > core.BASE_END);
  jumpTo(s, b.n - 1);
  b.x = core.WORLD_W / 2;
  b.vx = Math.abs(b.vx);
  Object.assign(b.turn, { go: 1, back: 0.4, left: 0.1, backing: false });
  core.update(s, 0.05);
  assert.ok(b.vx > 0, 'still going right');
  core.update(s, 0.1);
  assert.ok(b.vx < 0, 'turned back');
  assert.equal(b.turn.backing, true);
  const x = b.x;
  core.update(s, 0.2);
  assert.ok(b.x < x, 'moving left');
  core.update(s, 0.2);
  assert.ok(b.vx > 0, 'turned again after 0.4 s');
  assert.equal(b.turn.backing, false);
  // Every turning basket goes further forward than back, so it still crosses the screen.
  const t = core.newGame(0, 1);
  core.basket(t, core.MASTER_START + 300);
  for (const basket of t.baskets) if (basket.turn) assert.ok(basket.turn.go > basket.turn.back * 1.5);
  // A frozen basket stays frozen.
  b.vx = 0;
  core.update(s, 2);
  assert.equal(b.vx, 0);
});

test('a pulsing basket speeds up and slows down smoothly but never stops', () => {
  const s = playing(8);
  const all = core.newGame(0, 2);
  core.basket(all, core.MASTER_START + 300);
  for (const b of all.baskets) {
    if (!b.pulse) continue;
    assert.ok(core.levelOf(b.n - 1) >= 31, `basket ${b.n}: pulsing starts in level 31`);
    assert.ok(b.pulse.amp < 0.65, 'never slower than a third of its speed');
  }
  const b = findTrick(s, 'pulse', core.levelStart(31));
  jumpTo(s, b.n - 1);
  b.x = core.WORLD_W - b.width / 2 - 10;
  b.vx = -Math.abs(b.vx);
  Object.assign(b.pulse, { amp: 0.5, rate: Math.PI, phase: 0 }); // one swing every 2 s
  const base = b.pulse.base;
  core.update(s, 0.25);
  core.update(s, 0.25);
  assert.ok(Math.abs(Math.abs(b.vx) - base * 1.5) < base * 0.01, 'fastest a quarter of the way through');
  assert.ok(b.vx < 0, 'still going the same way');
  for (let i = 0; i < 4; i++) core.update(s, 0.25);
  assert.ok(Math.abs(Math.abs(b.vx) - base * 0.5) < base * 0.01, 'slowest three quarters of the way through');
  b.vx = 0;
  core.update(s, 1);
  assert.equal(b.vx, 0, 'a frozen basket stays frozen');
});

test('a growing basket catches with the width it has at that moment', () => {
  const all = core.newGame(0, 2);
  core.basket(all, core.MASTER_START + 300);
  for (const b of all.baskets) {
    if (!b.grow) continue;
    assert.ok(core.levelOf(b.n - 1) >= 41, `basket ${b.n}: growing starts in level 41`);
    const smallest = b.grow.base * (core.GROW_MID - b.grow.amp);
    const biggest = b.grow.base * (core.GROW_MID + b.grow.amp);
    assert.ok(smallest >= 40 && biggest <= 90, `basket ${b.n}: ${smallest}-${biggest} wide`);
    assert.ok(b.width >= smallest - 1e-9 && b.width <= biggest + 1e-9);
  }

  // Big: an egg well off the normal width still lands.
  const s = playing(8);
  const b = findTrick(s, 'grow', core.levelStart(41));
  jumpTo(s, b.n - 1);
  const base = b.grow.base;
  Object.assign(b.grow, { amp: 0.4, rate: 0, phase: Math.PI / 2 });
  aimNext(s, (s.egg.x < core.WORLD_W / 2 ? 1 : -1) * base * 0.6);
  core.toss(s);
  const caught = settle(s).find((e) => e.type === 'catch');
  assert.ok(caught, 'caught by the stretched basket');
  assert.ok(Math.abs(b.width - base * 1.55) < 1e-9);

  // Small: the same kind of throw misses.
  const t = playing(8);
  const c = findTrick(t, 'grow', core.levelStart(41));
  jumpTo(t, c.n - 1);
  Object.assign(c.grow, { amp: 0.4, rate: 0, phase: -Math.PI / 2 });
  aimNext(t, (t.egg.x < core.WORLD_W / 2 ? 1 : -1) * c.grow.base * 0.36);
  core.toss(t);
  const events = settle(t);
  assert.ok(!events.some((e) => e.type === 'catch'), 'missed the shrunken basket');
  assert.ok(Math.abs(c.width - c.grow.base * 0.75) < 1e-9);

  // It grows and shrinks over time and stays inside the screen while it does.
  const u = playing(8);
  const d = findTrick(u, 'grow', core.levelStart(41));
  jumpTo(u, d.n - 1);
  Object.assign(d.grow, { amp: 0.4, rate: Math.PI, phase: 0 });
  const widths = [];
  for (let i = 0; i < 120; i++) {
    core.update(u, FRAME);
    widths.push(d.width);
    assert.ok(d.x - d.width / 2 >= 0 && d.x + d.width / 2 <= core.WORLD_W, 'inside the screen');
  }
  assert.ok(Math.max(...widths) > d.grow.base * 1.5 && Math.min(...widths) < d.grow.base * 0.8);
});

test('a sleepy basket stops for a short nap, then goes on', () => {
  const all = core.newGame(0, 2);
  core.basket(all, core.MASTER_START + 300);
  for (const b of all.baskets) {
    if (!b.nap) continue;
    assert.ok(core.levelOf(b.n - 1) >= 51, `basket ${b.n}: napping starts in level 51`);
    assert.ok(b.nap.sleep <= 1.1 && b.nap.awake >= 1.2, 'short naps, longer awake');
  }
  const s = playing(8);
  const b = findTrick(s, 'nap', core.levelStart(51));
  jumpTo(s, b.n - 1);
  b.x = core.WORLD_W / 2;
  Object.assign(b.nap, { awake: 1, sleep: 0.5, left: 0.1, asleep: false });
  let x = b.x;
  core.update(s, 0.05);
  assert.notEqual(b.x, x, 'awake: moving');
  core.update(s, 0.1);
  assert.equal(b.nap.asleep, true, 'fell asleep');
  x = b.x;
  core.update(s, 0.3);
  assert.equal(b.x, x, 'stands still while napping');
  assert.notEqual(b.vx, 0, 'but keeps its speed for later');
  core.update(s, 0.2);
  assert.equal(b.nap.asleep, false, 'woke up after 0.5 s');
  assert.notEqual(b.x, x, 'and goes on');
});

test('wind blows an egg thrown from a windy basket sideways, the same way all through its flight', () => {
  const all = core.newGame(0, 2);
  core.basket(all, core.MASTER_START + 300);
  let windy = 0;
  for (const b of all.baskets) {
    if (!b.wind) continue;
    windy++;
    assert.ok(core.levelOf(b.n - 1) >= 61, `basket ${b.n}: wind starts in level 61`);
    assert.ok(Math.abs(b.wind) >= 20 && Math.abs(b.wind) <= 50, 'gentle to medium wind');
  }
  assert.ok(windy > 20);

  // How long the egg takes to come back down to the next basket.
  const v0 = core.TOSS_SPEED;
  const flight = (v0 + Math.sqrt(v0 * v0 - 2 * core.GRAVITY * core.BASKET_GAP)) / core.GRAVITY;

  const throwFrom = (wind, offset) => {
    const s = playing(8);
    const b = findTrick(s, 'wind', core.levelStart(61));
    jumpTo(s, b.n);
    const own = core.basket(s, b.n);
    own.x = core.WORLD_W / 2;
    own.vx = 0;
    own.wind = wind;
    s.egg.x = own.x;
    const next = aimNext(s, offset);
    for (const trick of ['turn', 'pulse', 'grow', 'nap']) delete next[trick]; // a plain basket
    next.width = core.basketSpec(next.n).width;
    const x = s.egg.x;
    core.toss(s);
    assert.equal(s.egg.wind, wind);
    core.update(s, 0.15);
    core.update(s, 0.15);
    const drift = s.egg.x - x;
    return { drift, events: settle(s), s };
  };

  // Aimed straight up, a strong wind blows it past the basket.
  const missed = throwFrom(40, 0);
  assert.ok(Math.abs(missed.drift - 12) < 0.5, 'drifts 40 units a second');
  assert.ok(!missed.events.some((e) => e.type === 'catch'), 'blown past the next basket');
  // With the basket where the wind takes the egg, it is caught.
  const caught = throwFrom(-40, -40 * flight);
  assert.ok(caught.drift < 0, 'negative wind blows to the left');
  assert.ok(caught.events.some((e) => e.type === 'catch' && e.perfect), 'caught where the wind took it');
  // No wind: straight up as always.
  const still = throwFrom(0, 0);
  assert.equal(still.drift, 0);
});
