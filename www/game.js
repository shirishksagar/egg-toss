/*
 * Egg Toss — drawing, input, menus and glue between the game logic (core.js) and sound
 * (audio.js). All rules live in core.js; this file only shows them.
 */
(function () {
  'use strict';

  const C = window.EggCore;
  const A = window.EggAudio;
  const B = window.EggBackgrounds;
  const W = C.WORLD_W;
  const GAP = C.BASKET_GAP;
  const KEY_BEST = 'eggtoss.best';

  const canvas = document.getElementById('game');
  const g = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const hud = $('hud');
  const scoreEl = $('score');
  const bestEl = $('best');
  const levelEl = $('level');
  const panels = { start: $('start-panel'), pause: $('pause-panel'), over: $('over-panel') };

  function loadBest() {
    try { return parseInt(localStorage.getItem(KEY_BEST), 10) || 0; } catch (e) { return 0; }
  }
  function saveBest(value) {
    try { localStorage.setItem(KEY_BEST, String(value)); } catch (e) { /* storage unavailable */ }
  }

  function load(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) { /* storage unavailable */ }
  }

  // Saved progress: best points scored within each level ({ [level]: points }), the level
  // the Master best is saved under (it moves up when levels are added), the highest level
  // reached, and the level the player last chose to start from. migrateSave brings saves
  // from older versions up to date.
  const KEY_LEVEL_BESTS = 'eggtoss.levelBests';
  const KEY_MASTER = 'eggtoss.masterKey';
  const KEY_REACHED = 'eggtoss.reached';
  const KEY_START = 'eggtoss.startLevel';
  function saveLevelBests() {
    store(KEY_LEVEL_BESTS, JSON.stringify(levelBests));
  }
  let savedBests = {};
  try { savedBests = JSON.parse(load(KEY_LEVEL_BESTS)) || {}; } catch (e) { /* unreadable: start afresh */ }
  const saved = C.migrateSave({ levelBests: savedBests, masterKey: load(KEY_MASTER), reached: load(KEY_REACHED) });
  const levelBests = saved.levelBests;
  let reached = saved.reached;
  saveLevelBests();
  store(KEY_MASTER, C.MASTER_LEVEL);
  store(KEY_REACHED, reached);
  let startLevel = Math.min(reached, parseInt(load(KEY_START), 10) || 1);
  let newLevelBests = new Set(); // levels whose best was beaten this game

  let best = loadBest();
  let bestAtStart = best;
  let state = C.newGame(best);
  let clock = 0;           // animation time; stands still while paused
  let floaters = [];       // floating "+1" / "Perfect +2" texts
  let crackFx = null;      // the funny crack scene while it is on screen
  let overTimeout = null;

  // ---- Layout --------------------------------------------------------------

  let dpr = 1;
  let scale = 1;           // screen px per world unit
  let viewH = 640;         // visible world height

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = w / W;
    viewH = h / scale;
  }
  window.addEventListener('resize', resize);
  resize();

  /** World y (upwards) to screen y (downwards), in world units. */
  const sy = (y) => viewH - (y - state.cameraY);

  // ---- Menus ---------------------------------------------------------------

  function showPanel(name) {
    for (const [key, el] of Object.entries(panels)) el.hidden = key !== name;
    hud.hidden = name === 'start';
    $('pause-btn').hidden = name !== null;
  }

  /** Music / Sounds switches, kept in step across the start and pause panels. */
  const switchInputs = { music: [], sounds: [] };
  function buildSwitches() {
    for (const container of document.querySelectorAll('.switches')) {
      for (const [kind, label] of [['music', 'Music'], ['sounds', 'Sounds']]) {
        const wrap = document.createElement('label');
        wrap.className = 'switch';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = kind === 'music' ? A.musicOn : A.soundsOn;
        input.addEventListener('change', () => {
          if (kind === 'music') A.setMusic(input.checked);
          else A.setSounds(input.checked);
          for (const other of switchInputs[kind]) other.checked = input.checked;
        });
        const track = document.createElement('span');
        track.className = 'track';
        wrap.append(input, track, document.createTextNode(label));
        container.append(wrap);
        switchInputs[kind].push(input);
      }
    }
  }
  buildSwitches();

  function updateBestLabels() {
    bestEl.textContent = best;
    for (const el of document.querySelectorAll('.best-value')) el.textContent = best;
    renderLevelBests();
    renderStartPickers();
  }

  function levelName(level) {
    return level >= C.MASTER_LEVEL ? '★ Master level' : `Level ${level} · ${B.theme(level).name}`;
  }

  /**
   * "Start at" pickers: every level reached so far, highest first, level 1 always there.
   * Hidden until there is more than level 1 to pick.
   */
  function renderStartPickers() {
    startLevel = Math.max(1, Math.min(startLevel, reached));
    for (const select of document.querySelectorAll('.start-level')) {
      select.textContent = '';
      for (let level = reached; level >= 1; level--) {
        const option = document.createElement('option');
        option.value = String(level);
        option.textContent = levelName(level);
        select.append(option);
      }
      select.value = String(startLevel);
    }
    for (const row of document.querySelectorAll('.start-from')) row.hidden = reached <= 1;
  }
  for (const select of document.querySelectorAll('.start-level')) {
    select.addEventListener('change', () => {
      startLevel = parseInt(select.value, 10) || 1;
      store(KEY_START, startLevel);
      renderStartPickers();
    });
  }

  /** Fills every level-bests grid (all levels and Master), highlighted where this game set a new best. */
  function renderLevelBests() {
    for (const grid of document.querySelectorAll('.level-bests')) {
      grid.textContent = '';
      for (let level = 1; level <= C.MASTER_LEVEL; level++) {
        const cell = document.createElement('div');
        const value = levelBests[level];
        const master = level === C.MASTER_LEVEL;
        cell.className = 'cell' + (value ? '' : ' empty') + (newLevelBests.has(level) ? ' new' : '') + (master ? ' master' : '');
        cell.title = master ? 'Master level' : `Level ${level}: ${B.theme(level).name} (${C.levelSize(level)} baskets)`;
        cell.innerHTML = `<span class="lv">${master ? '★' : 'L' + level}</span><span class="pts">${value || '–'}</span>`;
        grid.append(cell);
      }
      if (!grid.previousElementSibling || !grid.previousElementSibling.classList.contains('level-bests-title')) {
        const title = document.createElement('p');
        title.className = 'level-bests-title';
        title.textContent = 'Best per level';
        grid.before(title);
      }
    }
  }

  /** "Level 3 · 7/15 · best 14" in the corner, for the level the egg is in. */
  let levelLabel = '';
  function updateLevelLabel() {
    const { level, done, size } = C.levelProgress(state.current);
    const name = level >= C.MASTER_LEVEL ? 'Master' : `Level ${level}`;
    const progress = size === Infinity ? done : `${done}/${size}`;
    const text = `${name} · ${progress} · best ${levelBests[level] || 0}`;
    if (text !== levelLabel) {
      levelLabel = text;
      levelEl.textContent = text;
    }
  }

  function newRun() {
    clearTimeout(overTimeout);
    A.unlock();
    bestAtStart = best;
    const level = Math.max(1, Math.min(startLevel, reached));
    state = C.newGame(best, Date.now(), C.levelStart(level));
    C.start(state);
    floaters = [];
    crackFx = null;
    scoreEl.textContent = '0';
    shownLevel = level;
    fadingFrom = null;
    newLevelBests = new Set();
    renderLevelBests();
    showBanner(level);
    A.startMusic();
    showPanel(null);
  }

  function pauseGame() {
    if (state.phase !== 'playing') return;
    C.pause(state);
    A.stopMusic();
    showPanel('pause');
  }

  function resumeGame() {
    if (state.phase !== 'paused') return;
    A.unlock();
    C.start(state);
    A.startMusic();
    showPanel(null);
  }

  $('play-btn').addEventListener('click', newRun);
  $('again-btn').addEventListener('click', newRun);
  $('restart-btn').addEventListener('click', newRun);
  $('resume-btn').addEventListener('click', resumeGame);
  $('pause-btn').addEventListener('click', (e) => { e.stopPropagation(); pauseGame(); });

  // Auto-pause when the app or tab goes to the background.
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  window.addEventListener('pagehide', pauseGame);
  window.addEventListener('blur', pauseGame);

  // ---- Input ---------------------------------------------------------------

  function tossEgg() {
    if (state.phase === 'playing') handleEvents(C.toss(state));
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tossEgg();
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.target && e.target.tagName === 'SELECT') return; // arrow keys pick a start level there
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
      e.preventDefault();
      if (state.phase === 'playing') tossEgg();
      else if (!panels.start.hidden) newRun();
      else if (state.phase === 'paused') resumeGame();
      else if (!panels.over.hidden) newRun();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state.phase === 'playing') pauseGame();
      else if (state.phase === 'paused') resumeGame();
    }
  });

  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* not supported */ }
  }

  // ---- Game events -> sound, vibration, effects ------------------------------

  function handleEvents(events) {
    for (const e of events) {
      switch (e.type) {
        case 'toss':
          A.toss();
          break;
        case 'catch':
          A.catchPop();
          if (e.perfect) A.perfectChime();
          buzz(e.perfect ? [15, 40, 25] : 18);
          // Climbing back through baskets already reached scores nothing, so no "+0".
          if (e.points > 0) {
            floaters.push({
              text: e.perfect ? 'Perfect +2' : '+1',
              x: e.x, y: e.y, age: 0,
              color: e.perfect ? '#ffd23f' : '#ffffff',
              size: e.perfect ? 26 : 24,
            });
          }
          scoreEl.textContent = state.score;
          if (e.points > 0 && state.levelPoints[e.level] > (levelBests[e.level] || 0)) {
            levelBests[e.level] = state.levelPoints[e.level];
            newLevelBests.add(e.level);
            saveLevelBests();
          }
          if (state.best > best) {
            best = state.best;
            saveBest(best);
            updateBestLabels();
          }
          break;
        case 'levelUp':
          A.perfectChime();
          buzz([20, 60, 20, 60, 40]);
          showBanner(e.level);
          if (e.level > reached) {
            reached = e.level;
            store(KEY_REACHED, reached);
          }
          break;
        case 'landBack':
          A.catchPop();
          floaters.push({ text: 'Phew!', x: state.egg.x, y: state.egg.y, age: 0, color: '#e8f4ff', size: 18 });
          break;
        case 'catchLow':
          A.catchPop();
          buzz(18);
          floaters.push({ text: 'Saved!', x: e.x, y: e.y, age: 0, color: '#b8f0a0', size: 22 });
          break;
        case 'crack': {
          A.crack();
          A.sadTrombone();
          buzz([60, 40, 140]);
          const dir = Math.random() < 0.5 ? -1 : 1;
          crackFx = { x: e.x, y: e.y, age: 0, pieceVx: 95 * dir, pieceVy: -300, spinDir: dir };
          break;
        }
        case 'respawn':
          crackFx = null;
          break;
        case 'gameOver':
          crackFx = null;
          A.stopMusic();
          A.gameOverJingle();
          if (state.best > best) { best = state.best; saveBest(best); }
          updateBestLabels();
          $('final-score').textContent = state.score;
          $('new-best').hidden = !(state.score > bestAtStart && state.score > 0);
          overTimeout = setTimeout(() => showPanel('over'), 450);
          break;
      }
    }
  }

  // ---- Drawing -------------------------------------------------------------

  // Background: the level of the egg's basket picks the scene; changing level cross-fades.
  const FADE_TIME = 1.2;
  let shownLevel = 1;
  let fadingFrom = null;   // previous level while cross-fading
  let fadeAge = 0;

  function drawBackground() {
    const level = C.levelOf(state.current);
    if (level !== shownLevel) {
      fadingFrom = shownLevel;
      fadeAge = 0;
      shownLevel = level;
    }
    const view = { W, H: viewH, cameraY: state.cameraY, clock };
    if (fadingFrom !== null) {
      B.draw(g, fadingFrom, view);
      g.globalAlpha = Math.min(1, fadeAge / FADE_TIME);
      B.draw(g, shownLevel, view);
      g.globalAlpha = 1;
      if (fadeAge >= FADE_TIME) fadingFrom = null;
    } else {
      B.draw(g, shownLevel, view);
    }
  }

  /**
   * "Level 2 · Breezy Hills" across the middle of the screen, fading out. On the first
   * level with a new basket trick it also shows a tip and stays a little longer.
   */
  let banner = null;       // { level, age, tip, time }
  const BANNER_TIME = 2.4;
  const TIP_BANNER_TIME = 3.8;

  function showBanner(level) {
    const tip = C.trickTip(level);
    banner = { level, age: 0, tip, time: tip ? TIP_BANNER_TIME : BANNER_TIME };
  }

  function drawBanner() {
    if (!banner || banner.age > banner.time) return;
    const t = banner.age;
    const end = banner.time;
    const alpha = t < 0.3 ? t / 0.3 : t > end - 0.6 ? (end - t) / 0.6 : 1;
    const pop = t < 0.3 ? 0.7 + 0.3 * Math.sin((t / 0.3) * Math.PI / 2) : 1;
    const y = viewH * 0.36;
    g.save();
    g.globalAlpha = Math.max(0, alpha);
    g.translate(W / 2, y);
    g.scale(pop, pop);
    g.fillStyle = 'rgba(40, 25, 10, 0.45)';
    g.beginPath();
    g.roundRect(-160, -42, 320, banner.tip ? 112 : 84, 22);
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 34px "Trebuchet MS", system-ui, sans-serif';
    g.lineWidth = 6;
    g.strokeStyle = '#7a3b12';
    const master = banner.level >= C.MASTER_LEVEL;
    const title = master ? 'MASTER LEVEL' : `Level ${banner.level}`;
    const subtitle = master
      ? 'Endless baskets, faster every time'
      : `${B.theme(banner.level).name} · ${C.levelSize(banner.level)} baskets`;
    g.strokeText(title, 0, -12);
    g.fillStyle = '#ffd23f';
    g.fillText(title, 0, -12);
    g.font = '800 16px "Trebuchet MS", system-ui, sans-serif';
    g.fillStyle = '#fff';
    g.fillText(subtitle, 0, 22);
    if (banner.tip) {
      g.font = '800 15px "Trebuchet MS", system-ui, sans-serif';
      g.fillStyle = '#bff5ff';
      g.fillText(banner.tip, 0, 50, 300);
    }
    g.restore();
  }

  function drawGround() {
    const top = sy(C.groundY(state) - 4);
    if (top > viewH) return;
    g.fillStyle = '#7ccf5a';
    g.beginPath();
    g.moveTo(0, viewH);
    g.lineTo(0, top + 10);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, top + Math.sin(x * 0.05) * 6);
    g.lineTo(W, viewH);
    g.fill();
    g.fillStyle = '#5fb341';
    g.fillRect(0, top + 22, W, viewH);
  }

  const RIM_RY = 7;
  const BASKET_DEPTH = 30;

  function basketBodyPath(x, rimY, w) {
    const top = w / 2;
    const bottom = w * 0.36;
    g.beginPath();
    g.moveTo(x - top, rimY);
    g.lineTo(x - bottom, rimY + BASKET_DEPTH - 6);
    g.quadraticCurveTo(x - bottom, rimY + BASKET_DEPTH, x - bottom + 6, rimY + BASKET_DEPTH);
    g.lineTo(x + bottom - 6, rimY + BASKET_DEPTH);
    g.quadraticCurveTo(x + bottom, rimY + BASKET_DEPTH, x + bottom, rimY + BASKET_DEPTH - 6);
    g.lineTo(x + top, rimY);
    g.ellipse(x, rimY, top, RIM_RY, 0, 0, Math.PI, false);
    g.closePath();
  }

  function drawBasketBack(b, x) {
    const rimY = sy(b.y);
    g.fillStyle = '#5c3a1c';
    g.beginPath();
    g.ellipse(x, rimY, b.width / 2, RIM_RY, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#a86d38';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(x, rimY, b.width / 2, RIM_RY, 0, Math.PI, Math.PI * 2);
    g.stroke();
  }

  function drawBasketFront(b, x) {
    const rimY = sy(b.y);
    const grad = g.createLinearGradient(0, rimY, 0, rimY + BASKET_DEPTH);
    grad.addColorStop(0, '#d4954f');
    grad.addColorStop(1, '#94592a');
    g.fillStyle = grad;
    basketBodyPath(x, rimY, b.width);
    g.fill();

    // Woven texture.
    g.save();
    basketBodyPath(x, rimY, b.width);
    g.clip();
    g.strokeStyle = 'rgba(90, 52, 20, 0.45)';
    g.lineWidth = 1.5;
    for (let yy = rimY + 9; yy < rimY + BASKET_DEPTH; yy += 7) {
      g.beginPath();
      g.moveTo(x - b.width, yy);
      g.lineTo(x + b.width, yy);
      g.stroke();
    }
    for (let xx = -b.width / 2; xx < b.width / 2; xx += 10) {
      g.beginPath();
      g.moveTo(x + xx, rimY);
      g.lineTo(x + xx * 0.72, rimY + BASKET_DEPTH);
      g.stroke();
    }
    g.restore();

    // Front of the rim.
    g.strokeStyle = '#e8b06e';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.ellipse(x, rimY, b.width / 2, RIM_RY, 0, 0, Math.PI, false);
    g.stroke();

    drawTrickMarks(b, x, rimY);
  }

  // ---- Basket tricks (levels after 20) ----------------------------------------

  /** Where to draw a basket: a turning basket wiggles just before it turns. */
  function basketDrawX(b) {
    if (b.turn && b.vx !== 0 && b.turn.left < C.TURN_WARN) return b.x + Math.sin(clock * 70) * 2.5;
    return b.x;
  }

  /** A small arrow pointing left or right. */
  function arrow(x, y, dir, size, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x + dir * size, y);
    g.lineTo(x - dir * size * 0.6, y - size * 0.75);
    g.lineTo(x - dir * size * 0.6, y + size * 0.75);
    g.closePath();
    g.fill();
  }

  /** Marks that tell which trick a basket has. */
  function drawTrickMarks(b, x, rimY) {
    if (b.turn) {
      // Teal band with arrows pointing the way it goes; they flash just before it turns.
      const bandY = rimY + 13;
      g.fillStyle = '#3fc1b0';
      g.fillRect(x - b.width * 0.42, bandY - 4, b.width * 0.84, 8);
      const warn = b.turn.left < C.TURN_WARN && Math.sin(clock * 30) > 0;
      const dir = b.vx < 0 ? -1 : 1;
      arrow(x - 9, bandY, dir, 5, warn ? '#ff4d4d' : '#ffffff');
      arrow(x + 9, bandY, dir, 5, warn ? '#ff4d4d' : '#ffffff');
    }
    if (b.pulse) {
      // Orange band with speed stripes: one to three, the faster it goes right now.
      const bandY = rimY + 22;
      g.fillStyle = '#ff8c42';
      g.fillRect(x - b.width * 0.36, bandY - 3.5, b.width * 0.72, 7);
      const stripes = 1 + Math.round(1 + Math.sin(b.pulse.phase));
      const dir = b.vx < 0 ? -1 : 1;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.6;
      for (let k = 0; k < stripes; k++) {
        const sx = x + dir * (6 - k * 6);
        g.beginPath();
        g.moveTo(sx - dir * 3, bandY - 2.5);
        g.lineTo(sx + dir, bandY);
        g.lineTo(sx - dir * 3, bandY + 2.5);
        g.stroke();
      }
    }
  }

  const EGG_RX = 13;
  const EGG_RY = 17;

  function drawEgg(x, cy, rising) {
    const grad = g.createRadialGradient(x - 4, cy - 6, 2, x, cy, EGG_RY + 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#ecdcc0');
    g.fillStyle = grad;
    g.strokeStyle = 'rgba(120, 90, 50, 0.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(x, cy, EGG_RX, EGG_RY, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // A small happy face; eyes go wide on the way up.
    g.fillStyle = '#3b2a1a';
    const eye = rising ? 2.3 : 1.7;
    g.beginPath();
    g.arc(x - 4.5, cy - 3, eye, 0, Math.PI * 2);
    g.arc(x + 4.5, cy - 3, eye, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3b2a1a';
    g.lineWidth = 1.4;
    g.beginPath();
    if (rising) g.ellipse(x, cy + 4, 2.4, 3, 0, 0, Math.PI * 2);
    else g.arc(x, cy + 2, 4, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    g.fillStyle = 'rgba(255, 140, 140, 0.45)';
    g.beginPath();
    g.ellipse(x - 8, cy + 2, 2.5, 1.6, 0, 0, Math.PI * 2);
    g.ellipse(x + 8, cy + 2, 2.5, 1.6, 0, 0, Math.PI * 2);
    g.fill();
  }

  function starPath(x, y, r, angle) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = angle + (i * Math.PI) / 5 - Math.PI / 2;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
  }

  /** Zig-zag line across the shell, used for both the bottom half and the flying piece. */
  function zigzag(x, y, halfWidth, teeth, height) {
    for (let i = 0; i <= teeth; i++) {
      const px = x - halfWidth + (2 * halfWidth * i) / teeth;
      g.lineTo(px, y + (i % 2 === 0 ? 0 : height));
    }
  }

  /** The funny crack: half shell with a dizzy face, stars, flying piece, yolk and "Oops!". */
  function drawCrack(fx) {
    const t = fx.age;
    const ground = sy(fx.y);
    // Drawn 1.5× size around the landing spot, kept clear of the screen edges.
    const SIZE = 1.5;
    const x = Math.max(45, Math.min(W - 45, fx.x));
    g.save();
    g.translate(x, ground);
    g.scale(SIZE, SIZE);
    g.translate(-x, -ground);
    const shellRx = 19;
    const shellRy = 22;
    const cy = ground - 14;           // centre of the (whole) shell ellipse
    const cutY = cy - 3;              // where the shell broke

    // Yolk puddle spreading out.
    const spread = Math.min(1, t / 0.35);
    const ease = 1 - Math.pow(1 - spread, 3);
    g.fillStyle = 'rgba(255, 255, 255, 0.85)';
    g.beginPath();
    g.ellipse(x + 6, ground + 9, 12 + 34 * ease, 4 + 6 * ease, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffc21a';
    g.beginPath();
    g.ellipse(x + 10, ground + 9, 6 + 14 * ease, 3 + 3.5 * ease, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.6)';
    g.beginPath();
    g.ellipse(x + 6, ground + 7, 3 + 4 * ease, 1.2 + ease, 0, 0, Math.PI * 2);
    g.fill();

    // Wobbling bottom half of the shell.
    const wobble = Math.sin(t * 14) * 0.12 * Math.exp(-t * 1.5);
    g.save();
    g.translate(x, ground + 8);
    g.rotate(wobble);
    g.translate(-x, -(ground + 8));

    g.fillStyle = '#f6ecd8';
    g.strokeStyle = 'rgba(120, 90, 50, 0.6)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x - shellRx, cutY);
    zigzag(x, cutY, shellRx, 8, -5);
    g.ellipse(x, cy, shellRx, shellRy, 0, 0, Math.PI, false);
    g.closePath();
    g.fill();
    g.stroke();

    // Dizzy X X eyes.
    g.strokeStyle = '#3b2a1a';
    g.lineWidth = 2;
    g.lineCap = 'round';
    for (const ex of [x - 7, x + 7]) {
      const ey = cy + 4;
      g.beginPath();
      g.moveTo(ex - 3, ey - 3); g.lineTo(ex + 3, ey + 3);
      g.moveTo(ex + 3, ey - 3); g.lineTo(ex - 3, ey + 3);
      g.stroke();
    }

    // Blush.
    g.fillStyle = 'rgba(255, 120, 130, 0.55)';
    g.beginPath();
    g.ellipse(x - 12, cy + 10, 3.5, 2.2, 0, 0, Math.PI * 2);
    g.ellipse(x + 12, cy + 10, 3.5, 2.2, 0, 0, Math.PI * 2);
    g.fill();

    // Wobbly open mouth with a tongue.
    const mouthY = cy + 13;
    g.fillStyle = '#7a1f1f';
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 1 + Math.sin(a * 3 + t * 18) * 0.12;
      g.lineTo(x + Math.cos(a) * 6 * r, mouthY + Math.sin(a) * 4.5 * r);
    }
    g.closePath();
    g.fill();
    g.fillStyle = '#ff7f9a';
    g.beginPath();
    g.ellipse(x + 1, mouthY + 2.6, 3.4, 2.2, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // Three spinning stars circling the head.
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      const px = x + Math.cos(a) * 20;
      const py = cutY - 12 + Math.sin(a) * 5;
      g.fillStyle = '#ffd23f';
      g.strokeStyle = '#d18c00';
      g.lineWidth = 1;
      starPath(px, py, 5.5, t * 8 + i);
      g.fill();
      g.stroke();
    }

    // The top of the shell flying away.
    const px = x + fx.pieceVx * t;
    const py = cutY - 4 + fx.pieceVy * t + 0.5 * 900 * t * t;
    if (py < viewH + 40) {
      g.save();
      g.translate(px, py);
      g.rotate(fx.spinDir * t * 9);
      g.fillStyle = '#f6ecd8';
      g.strokeStyle = 'rgba(120, 90, 50, 0.6)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(0, 6, shellRx * 0.8, shellRy * 0.7, 0, Math.PI, Math.PI * 2, false);
      zigzag(0, 6, shellRx * 0.8, 6, -4);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }

    // "Oops!" popping in.
    const pop = Math.min(1, t / 0.25);
    const s = pop < 1 ? 0.4 + 0.8 * Math.sin((pop * Math.PI) / 2) * 1.08 : 1 + Math.sin(t * 6) * 0.03;
    g.save();
    g.translate(x < 55 ? 55 : x > W - 55 ? W - 55 : x, cy - 46);
    g.rotate(Math.sin(t * 5) * 0.06);
    g.scale(s, s);
    g.font = '900 26px "Trebuchet MS", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 5;
    g.strokeStyle = '#7a3b12';
    g.strokeText('Oops!', 0, 0);
    g.fillStyle = '#ffb347';
    g.fillText('Oops!', 0, 0);
    g.restore();
    g.restore();
  }

  function drawFloaters() {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const f of floaters) {
      const alpha = Math.max(0, 1 - f.age / 1.1);
      g.globalAlpha = alpha;
      g.font = `900 ${f.size}px "Trebuchet MS", system-ui, sans-serif`;
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(60, 35, 10, 0.75)';
      const y = sy(f.y) - 40 - f.age * 45;
      const x = Math.max(60, Math.min(W - 60, f.x));
      g.strokeText(f.text, x, y);
      g.fillStyle = f.color;
      g.fillText(f.text, x, y);
    }
    g.globalAlpha = 1;
  }

  /** Remaining eggs at the top centre: whole for each life left, cracked for each lost. */
  function drawLives() {
    const y = 34;
    for (let i = 0; i < C.START_LIVES; i++) {
      const x = W / 2 + (i - 1) * 24;
      const alive = i < state.lives;
      g.fillStyle = alive ? '#fffaf0' : 'rgba(255,255,255,0.35)';
      g.strokeStyle = alive ? 'rgba(120, 90, 50, 0.5)' : 'rgba(80, 60, 40, 0.4)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(x, y, 7.5, 9.5, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      if (!alive) {
        g.beginPath();
        g.moveTo(x - 7, y);
        zigzag(x, y, 7, 4, -3);
        g.stroke();
      }
    }
  }

  function draw() {
    g.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    drawBackground();
    drawGround();

    const egg = state.egg;
    const first = Math.max(state.floor, Math.floor((state.cameraY - 60) / GAP));
    const last = Math.ceil((state.cameraY + viewH + 60) / GAP);
    for (let n = first; n <= last; n++) {
      const b = C.basket(state, n);
      const x = basketDrawX(b);
      drawBasketBack(b, x);
      if (egg.mode === 'sitting' && n === state.current) drawEgg(egg.x + x - b.x, sy(egg.y) - 6, false);
      drawBasketFront(b, x);
    }
    if (egg.mode === 'flying') drawEgg(egg.x, sy(egg.y) - 6, egg.vy > 0);
    if (crackFx) drawCrack(crackFx);
    drawFloaters();
    if (state.phase !== 'ready') drawLives();
    drawBanner();
  }

  // ---- Main loop -----------------------------------------------------------

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (state.phase !== 'paused') {
      clock += dt;
      handleEvents(C.update(state, dt));
      if (state.phase === 'playing' || state.phase === 'over') {
        for (const f of floaters) f.age += dt;
        floaters = floaters.filter((f) => f.age < 1.1);
        if (crackFx) crackFx.age += dt;
        if (banner) banner.age += dt;
      }
      fadeAge += dt;
      updateLevelLabel(); // also catches falling back into a lower level
    }
    draw();
    requestAnimationFrame(frame);
  }

  updateBestLabels();
  showPanel('start');
  requestAnimationFrame(frame);

  // Read-only handle for checking the game from the browser's developer tools.
  window.eggToss = { get state() { return state; } };
})();
