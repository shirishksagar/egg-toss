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

test('level L has 5 × L baskets, then the endless Master level', () => {
  assert.equal(core.LEVELS, 20);
  assert.equal(core.MASTER_LEVEL, 21);
  assert.equal(core.levelSize(1), 5);
  assert.equal(core.levelSize(2), 10);
  assert.equal(core.levelSize(20), 100);
  assert.equal(core.levelSize(21), Infinity);
  // Catching basket 5 completes level 1, basket 15 completes level 2, and so on.
  assert.equal(core.levelOf(0), 1);
  assert.equal(core.levelOf(4), 1);
  assert.equal(core.levelOf(5), 2);
  assert.equal(core.levelOf(14), 2);
  assert.equal(core.levelOf(15), 3);
  assert.equal(core.MASTER_START, 1050);
  assert.equal(core.levelOf(1049), 20);
  assert.equal(core.levelOf(1050), 21);
  assert.equal(core.levelOf(100000), 21, 'Master never ends');
  // Each level's basket count matches its size.
  for (let level = 1; level <= 20; level++) {
    let count = 0;
    for (let n = 1; n <= 1050; n++) if (core.levelOf(n - 1) === level) count++;
    assert.equal(count, 5 * level, `level ${level}`);
  }
  assert.deepEqual(core.levelProgress(7), { level: 2, done: 2, size: 10 });
  assert.deepEqual(core.levelProgress(1060), { level: 21, done: 10, size: Infinity });
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

test('reaching basket 1050 enters the Master level', () => {
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
 * Look-ahead bot: before each toss it tries waiting 0, 1, 2 ... frames on a copy of the
 * game, and throws at the first moment that copy shows a catch.
 */
function botWait(state) {
  for (let wait = 0; wait < 400; wait++) {
    const trial = structuredClone(state);
    for (let i = 0; i < wait; i++) core.update(trial, FRAME);
    core.toss(trial);
    const events = settle(trial);
    if (events.some((e) => e.type === 'catch')) return wait;
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

test('the bot can clear the end of level 20 and climb into the Master level', () => {
  const s = playing(77);
  jumpTo(s, 1035);
  assert.deepEqual(botClimb(s, 25), [21]);
  assert.equal(s.current, 1060);
  assert.equal(s.lives, 3);
});

test('deep in the Master level the baskets are fast but still catchable', () => {
  const s = playing(5);
  jumpTo(s, 1200);
  assert.ok(core.basketSpec(1201).speed > 450);
  botClimb(s, 10);
  assert.equal(s.current, 1210);
});
