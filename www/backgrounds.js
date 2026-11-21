/*
 * Egg Toss — the level backgrounds: one scene per level plus the Master level (always the
 * last entry of THEMES). Each has a sky gradient and a few decorations (clouds, sun, rain,
 * aurora, planets, kites, lanterns...) that scroll gently with the camera.
 *
 * draw(g, level, view) paints the background for a level into a 2D context whose
 * transform is already set to world units: view = { W, H, cameraY, clock }.
 */
(function () {
  'use strict';

  /** Repeatable pseudo-random number in [0, 1) for decoration index i. */
  const hash = (i) => {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const wrap = (v, size) => ((v % size) + size) % size;

  // ---- Decorations -----------------------------------------------------------
  // Each takes (g, view, opts) and draws in world units, top-left origin.

  function cloud(g, x, y, size, color) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, size, 0, Math.PI * 2);
    g.arc(x + size * 0.9, y + size * 0.15, size * 0.75, 0, Math.PI * 2);
    g.arc(x - size * 0.9, y + size * 0.2, size * 0.65, 0, Math.PI * 2);
    g.arc(x + size * 0.3, y - size * 0.45, size * 0.7, 0, Math.PI * 2);
    g.fill();
  }

  function clouds(g, v, { color = 'rgba(255,255,255,0.8)', spacing = 190, size = 1, parallax = 0.45 } = {}) {
    const camera = v.cameraY * parallax;
    const first = Math.floor(camera / spacing) - 1;
    const last = Math.ceil((camera + v.H) / spacing) + 1;
    for (let i = first; i <= last; i++) {
      const s = (16 + hash(i) * 16) * size;
      const drift = v.clock * (6 + hash(i + 3) * 10);
      const x = wrap(hash(i + 1) * (v.W + 160) + drift, v.W + 160) - 80;
      const y = v.H - (i * spacing - camera);
      cloud(g, x, y, s, color);
    }
  }

  function sun(g, v, { x = 0.78, y = 0.16, r = 34, color = '#ffe066', glow = 'rgba(255,230,120,0.35)' } = {}) {
    const cx = v.W * x;
    const cy = v.H * y;
    const halo = g.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.6);
    halo.addColorStop(0, glow);
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = halo;
    g.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
    g.fillStyle = color;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }

  function moon(g, v, { x = 0.75, y = 0.18, r = 26 } = {}) {
    const cx = v.W * x;
    const cy = v.H * y;
    const halo = g.createRadialGradient(cx, cy, r, cx, cy, r * 3);
    halo.addColorStop(0, 'rgba(230,235,255,0.25)');
    halo.addColorStop(1, 'rgba(230,235,255,0)');
    g.fillStyle = halo;
    g.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
    g.fillStyle = '#f4f1de';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(180,175,160,0.45)';
    for (const [dx, dy, rr] of [[-8, -6, 6], [9, 4, 4], [-2, 11, 3.5], [10, -10, 3]]) {
      g.beginPath();
      g.arc(cx + dx * r / 26, cy + dy * r / 26, rr * r / 26, 0, Math.PI * 2);
      g.fill();
    }
  }

  function stars(g, v, { count = 50, alpha = 1, parallax = 0.12 } = {}) {
    const shift = v.cameraY * parallax;
    for (let k = 0; k < count; k++) {
      const x = hash(k) * v.W;
      const y = wrap(hash(k + 99) * (v.H + 100) + shift, v.H + 100) - 50;
      const tw = 0.6 + 0.4 * Math.sin(v.clock * (1.5 + hash(k + 3) * 3) + k);
      const r = (0.6 + hash(k + 7) * 1.3) * tw;
      g.fillStyle = `rgba(255,255,255,${alpha * tw})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  function birds(g, v, { count = 5, color = 'rgba(40,40,60,0.6)' } = {}) {
    g.strokeStyle = color;
    g.lineWidth = 1.6;
    g.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * v.W + v.clock * (20 + hash(i + 1) * 15), v.W + 40) - 20;
      const y = v.H * (0.1 + hash(i + 2) * 0.4) + Math.sin(v.clock * 2 + i) * 4;
      const flap = Math.sin(v.clock * 8 + i * 2) * 3;
      g.beginPath();
      g.moveTo(x - 7, y - flap);
      g.quadraticCurveTo(x - 3, y - 3, x, y);
      g.quadraticCurveTo(x + 3, y - 3, x + 7, y - flap);
      g.stroke();
    }
  }

  function balloons(g, v) {
    const colors = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff'];
    const spacing = 240;
    const camera = v.cameraY * 0.3;
    const first = Math.floor(camera / spacing) - 1;
    const last = Math.ceil((camera + v.H) / spacing) + 1;
    for (let i = first; i <= last; i++) {
      const x = 30 + hash(i + 11) * (v.W - 60) + Math.sin(v.clock * 0.6 + i) * 8;
      const y = v.H - (i * spacing - camera) + Math.sin(v.clock + i) * 5;
      const r = 13 + hash(i + 4) * 7;
      g.fillStyle = colors[wrap(i, colors.length)];
      g.beginPath();
      g.ellipse(x, y, r, r * 1.15, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.ellipse(x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.35, -0.4, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(90,60,30,0.6)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x - r * 0.5, y + r * 1.0);
      g.lineTo(x - r * 0.35, y + r * 1.7);
      g.moveTo(x + r * 0.5, y + r * 1.0);
      g.lineTo(x + r * 0.35, y + r * 1.7);
      g.stroke();
      g.fillStyle = '#9b6331';
      g.fillRect(x - r * 0.38, y + r * 1.7, r * 0.76, r * 0.5);
    }
  }

  function rainbow(g, v) {
    const cx = v.W * 0.5;
    const cy = v.H * 0.62;
    const colors = ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
    g.globalAlpha = 0.35;
    g.lineWidth = 9;
    colors.forEach((c, i) => {
      g.strokeStyle = c;
      g.beginPath();
      g.arc(cx, cy, 230 - i * 9, Math.PI, Math.PI * 2);
      g.stroke();
    });
    g.globalAlpha = 1;
  }

  function rain(g, v, { count = 70, color = 'rgba(210,225,255,0.55)', speed = 520 } = {}) {
    g.strokeStyle = color;
    g.lineWidth = 1.3;
    g.beginPath();
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * v.W - v.clock * 60, v.W);
      const y = wrap(hash(i + 50) * v.H + v.clock * speed * (0.8 + hash(i + 9) * 0.4), v.H + 20) - 10;
      g.moveTo(x, y);
      g.lineTo(x - 3, y + 12);
    }
    g.stroke();
  }

  function snow(g, v, { count = 60 } = {}) {
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * v.W + Math.sin(v.clock + i) * 12, v.W);
      const y = wrap(hash(i + 40) * v.H + v.clock * (30 + hash(i + 2) * 30), v.H + 10) - 5;
      g.beginPath();
      g.arc(x, y, 1.2 + hash(i + 3) * 2, 0, Math.PI * 2);
      g.fill();
    }
  }

  function leaves(g, v, { count = 22 } = {}) {
    const colors = ['#e4572e', '#f3a712', '#a8201a', '#d1823f'];
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * v.W + v.clock * (25 + hash(i + 5) * 20) + Math.sin(v.clock * 2 + i) * 15, v.W + 20) - 10;
      const y = wrap(hash(i + 30) * v.H + v.clock * (40 + hash(i + 2) * 30), v.H + 20) - 10;
      g.save();
      g.translate(x, y);
      g.rotate(v.clock * 2 + i);
      g.fillStyle = colors[i % colors.length];
      g.beginPath();
      g.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  function mountains(g, v, { color = '#9fb7d0', snowCap = false } = {}) {
    const base = v.H;
    const peaks = [[0, 0.62], [0.18, 0.48], [0.38, 0.6], [0.58, 0.42], [0.8, 0.56], [1, 0.5]];
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, base);
    for (const [px, py] of peaks) g.lineTo(px * v.W, py * v.H);
    g.lineTo(v.W, base);
    g.closePath();
    g.fill();
    if (snowCap) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 1; i < peaks.length - 1; i++) {
        const [px, py] = peaks[i];
        const x = px * v.W;
        const y = py * v.H;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - 18, y + 22);
        g.lineTo(x - 6, y + 17);
        g.lineTo(x + 4, y + 24);
        g.lineTo(x + 17, y + 20);
        g.closePath();
        g.fill();
      }
    }
  }

  function aurora(g, v) {
    const bands = [['rgba(80,255,170,0.22)', 0.22], ['rgba(120,200,255,0.18)', 0.3], ['rgba(190,120,255,0.14)', 0.38]];
    for (const [color, yFrac] of bands) {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, v.H * yFrac + 40);
      for (let x = 0; x <= v.W; x += 12) {
        g.lineTo(x, v.H * yFrac + Math.sin(x * 0.025 + v.clock * 0.8 + yFrac * 10) * 22);
      }
      for (let x = v.W; x >= 0; x -= 12) {
        g.lineTo(x, v.H * yFrac + 70 + Math.sin(x * 0.02 + v.clock * 0.6) * 18);
      }
      g.closePath();
      g.fill();
    }
  }

  function lightning(g, v) {
    // A flash roughly every 4 seconds.
    const cycle = v.clock % 4;
    if (cycle > 0.18) return;
    g.fillStyle = `rgba(255,255,240,${0.25 * (1 - cycle / 0.18)})`;
    g.fillRect(0, 0, v.W, v.H);
    const seed = Math.floor(v.clock / 4);
    let x = v.W * (0.2 + hash(seed) * 0.6);
    let y = 0;
    g.strokeStyle = 'rgba(255,255,210,0.9)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < 7; i++) {
      x += (hash(seed + i * 3) - 0.5) * 50;
      y += v.H * 0.07;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  function planet(g, v, { x = 0.25, y = 0.22, r = 30, color = '#e0a458', ring = true } = {}) {
    const cx = v.W * x;
    const cy = v.H * y;
    if (ring) {
      g.strokeStyle = 'rgba(240,220,180,0.7)';
      g.lineWidth = 4;
      g.beginPath();
      g.ellipse(cx, cy, r * 1.9, r * 0.45, -0.35, Math.PI, Math.PI * 2);
      g.stroke();
    }
    const grad = g.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.2, cx, cy, r);
    grad.addColorStop(0, '#ffe7b8');
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    if (ring) {
      g.strokeStyle = 'rgba(240,220,180,0.85)';
      g.lineWidth = 4;
      g.beginPath();
      g.ellipse(cx, cy, r * 1.9, r * 0.45, -0.35, 0, Math.PI);
      g.stroke();
    }
  }

  function nebula(g, v) {
    const blobs = [[0.3, 0.3, 120, 'rgba(255,80,200,0.22)'], [0.7, 0.45, 140, 'rgba(120,80,255,0.22)'], [0.45, 0.7, 110, 'rgba(80,200,255,0.16)']];
    for (const [x, y, r, color] of blobs) {
      const cx = v.W * x + Math.sin(v.clock * 0.2 + x * 9) * 10;
      const cy = v.H * y;
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }

  function galaxy(g, v) {
    const cx = v.W * 0.55;
    const cy = v.H * 0.35;
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, 60);
    core.addColorStop(0, 'rgba(255,240,220,0.7)');
    core.addColorStop(1, 'rgba(255,240,220,0)');
    g.fillStyle = core;
    g.fillRect(cx - 60, cy - 60, 120, 120);
    const turn = v.clock * 0.05;
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < 70; i++) {
        const t = i / 70;
        const a = turn + arm * Math.PI + t * 4.2;
        const rr = 8 + t * 120;
        const x = cx + Math.cos(a) * rr + (hash(i + arm * 70) - 0.5) * 10;
        const y = cy + Math.sin(a) * rr * 0.45 + (hash(i + arm * 70 + 5) - 0.5) * 6;
        g.fillStyle = `rgba(${arm ? '200,180,255' : '255,210,240'},${0.7 * (1 - t)})`;
        g.beginPath();
        g.arc(x, y, 1.2 + (1 - t) * 1.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  function sparkles(g, v, { count = 30, color = '255,220,120' } = {}) {
    for (let i = 0; i < count; i++) {
      const x = hash(i) * v.W;
      const y = wrap(hash(i + 20) * v.H - v.clock * (10 + hash(i + 4) * 15), v.H);
      const a = 0.5 + 0.5 * Math.sin(v.clock * 3 + i);
      const s = 2 + hash(i + 6) * 3;
      g.strokeStyle = `rgba(${color},${a})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x - s, y);
      g.lineTo(x + s, y);
      g.moveTo(x, y - s);
      g.lineTo(x, y + s);
      g.stroke();
    }
  }

  /** Things that scroll past with the camera, one every `spacing` world units. */
  function scrolling(v, spacing, parallax, drawOne) {
    const camera = v.cameraY * parallax;
    const first = Math.floor(camera / spacing) - 1;
    const last = Math.ceil((camera + v.H) / spacing) + 1;
    for (let i = first; i <= last; i++) drawOne(i, v.H - (i * spacing - camera));
  }

  function kites(g, v) {
    const colors = [['#ff595e', '#ffca3a'], ['#1982c4', '#8ac926'], ['#6a4c93', '#ff924c'], ['#ff7eb6', '#4ecdc4']];
    scrolling(v, 210, 0.35, (i, y0) => {
      const x = 40 + hash(i + 21) * (v.W - 80) + Math.sin(v.clock * 0.9 + i) * 14;
      const y = y0 + Math.sin(v.clock * 1.3 + i * 2) * 6;
      const s = 14 + hash(i + 8) * 8;
      const tilt = Math.sin(v.clock * 1.1 + i) * 0.25;
      const [c1, c2] = colors[wrap(i, colors.length)];
      g.save();
      g.translate(x, y);
      g.rotate(tilt);
      g.fillStyle = c1;
      g.beginPath();
      g.moveTo(0, -s * 1.2); g.lineTo(s * 0.8, 0); g.lineTo(0, s * 1.4); g.lineTo(-s * 0.8, 0);
      g.closePath();
      g.fill();
      g.fillStyle = c2;
      g.beginPath();
      g.moveTo(0, -s * 1.2); g.lineTo(s * 0.8, 0); g.lineTo(0, 0);
      g.moveTo(0, s * 1.4); g.lineTo(-s * 0.8, 0); g.lineTo(0, 0);
      g.fill();
      // Wavy tail with bows.
      g.strokeStyle = 'rgba(70,50,40,0.6)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(0, s * 1.4);
      for (let k = 1; k <= 6; k++) g.lineTo(Math.sin(v.clock * 4 + k + i) * 5, s * 1.4 + k * 7);
      g.stroke();
      g.fillStyle = c2;
      for (let k = 2; k <= 6; k += 2) {
        const bx = Math.sin(v.clock * 4 + k + i) * 5;
        const by = s * 1.4 + k * 7;
        g.beginPath();
        g.moveTo(bx, by); g.lineTo(bx - 4, by - 3); g.lineTo(bx - 4, by + 3);
        g.moveTo(bx, by); g.lineTo(bx + 4, by - 3); g.lineTo(bx + 4, by + 3);
        g.fill();
      }
      g.restore();
    });
  }

  function bubbles(g, v, { count = 26, tint = '255,255,255' } = {}) {
    g.lineWidth = 1.3;
    for (let i = 0; i < count; i++) {
      const r = 4 + hash(i + 12) * 12;
      const x = wrap(hash(i) * v.W + Math.sin(v.clock * 1.5 + i) * 10, v.W);
      const y = wrap(hash(i + 30) * (v.H + 40) - v.clock * (18 + hash(i + 5) * 26), v.H + 40) - 20;
      g.fillStyle = `rgba(${tint},0.12)`;
      g.strokeStyle = `rgba(${tint},0.6)`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = `rgba(${tint},0.7)`;
      g.beginPath();
      g.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2);
      g.fill();
    }
  }

  function lanterns(g, v, { color = '#ff8c42' } = {}) {
    scrolling(v, 120, 0.25, (i, y0) => {
      const x = 20 + hash(i + 40) * (v.W - 40) + Math.sin(v.clock * 0.5 + i) * 6;
      const y = y0 - ((v.clock * (8 + hash(i) * 6)) % 120);
      const s = 8 + hash(i + 2) * 6;
      const flicker = 0.75 + 0.25 * Math.sin(v.clock * 7 + i * 3);
      const glow = g.createRadialGradient(x, y, 1, x, y, s * 3.2);
      glow.addColorStop(0, `rgba(255,190,90,${0.45 * flicker})`);
      glow.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = glow;
      g.fillRect(x - s * 3.2, y - s * 3.2, s * 6.4, s * 6.4);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(x - s * 0.7, y - s);
      g.lineTo(x + s * 0.7, y - s);
      g.quadraticCurveTo(x + s * 1.1, y, x + s * 0.55, y + s);
      g.lineTo(x - s * 0.55, y + s);
      g.quadraticCurveTo(x - s * 1.1, y, x - s * 0.7, y - s);
      g.fill();
      g.fillStyle = `rgba(255,240,180,${0.8 * flicker})`;
      g.beginPath();
      g.ellipse(x, y + s * 0.6, s * 0.3, s * 0.2, 0, 0, Math.PI * 2);
      g.fill();
    });
  }

  function meteors(g, v, { count = 4, color = '255,255,255' } = {}) {
    g.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const period = 2.2 + hash(i + 3) * 2;
      const t = (v.clock + hash(i) * period) % period;
      if (t > 0.9) continue;
      const round = Math.floor((v.clock + hash(i) * period) / period);
      const sx = v.W * (0.2 + hash(i * 7 + round) * 0.9);
      const sy = v.H * (0.05 + hash(i * 5 + round + 1) * 0.4);
      const x = sx - t * 260;
      const y = sy + t * 150;
      const fade = 1 - t / 0.9;
      const grad = g.createLinearGradient(x, y, x + 60, y - 35);
      grad.addColorStop(0, `rgba(${color},${fade})`);
      grad.addColorStop(1, `rgba(${color},0)`);
      g.strokeStyle = grad;
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 60, y - 35);
      g.stroke();
    }
  }

  function fireflies(g, v, { count = 28, color = '220,255,120' } = {}) {
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * v.W + Math.sin(v.clock * (0.5 + hash(i + 1)) + i) * 26, v.W);
      const y = v.H * (0.2 + hash(i + 9) * 0.75) + Math.cos(v.clock * (0.4 + hash(i + 2)) + i * 2) * 18;
      const a = Math.max(0, Math.sin(v.clock * (1.5 + hash(i + 4) * 2) + i * 5));
      const glow = g.createRadialGradient(x, y, 0, x, y, 9);
      glow.addColorStop(0, `rgba(${color},${0.9 * a})`);
      glow.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = glow;
      g.fillRect(x - 9, y - 9, 18, 18);
    }
  }

  function treeline(g, v, { color = '#0b2420', height = 0.22 } = {}) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, v.H);
    for (let i = 0; i <= 14; i++) {
      const x = (i / 14) * v.W;
      const h = v.H * height * (0.6 + hash(i + 70) * 0.5);
      g.lineTo(x - 13, v.H - h * 0.35);
      g.lineTo(x, v.H - h);
      g.lineTo(x + 13, v.H - h * 0.35);
    }
    g.lineTo(v.W, v.H);
    g.closePath();
    g.fill();
  }

  function paperPlanes(g, v) {
    for (let i = 0; i < 5; i++) {
      const speed = 30 + hash(i + 2) * 25;
      const x = wrap(hash(i) * v.W + v.clock * speed, v.W + 60) - 30;
      const y = v.H * (0.12 + hash(i + 6) * 0.6) + Math.sin(v.clock * 1.2 + i) * 12;
      const tilt = Math.cos(v.clock * 1.2 + i) * 0.15;
      g.save();
      g.translate(x, y);
      g.rotate(tilt);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.moveTo(14, 0); g.lineTo(-12, -7); g.lineTo(-6, 0);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(200,210,235,0.95)';
      g.beginPath();
      g.moveTo(14, 0); g.lineTo(-6, 0); g.lineTo(-10, 6);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  function jellyfish(g, v) {
    const colors = ['255,140,200', '170,150,255', '120,220,255'];
    scrolling(v, 170, 0.3, (i, y0) => {
      const x = 30 + hash(i + 50) * (v.W - 60) + Math.sin(v.clock * 0.7 + i) * 10;
      const pulse = Math.sin(v.clock * 2.5 + i);
      const y = y0 - pulse * 4;
      const r = 12 + hash(i + 3) * 8;
      const c = colors[wrap(i, colors.length)];
      g.fillStyle = `rgba(${c},0.55)`;
      g.beginPath();
      g.ellipse(x, y, r * (1 + pulse * 0.08), r * 0.75, 0, Math.PI, Math.PI * 2);
      g.closePath();
      g.fill();
      g.strokeStyle = `rgba(${c},0.6)`;
      g.lineWidth = 1.4;
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.moveTo(x + k * r * 0.35, y);
        for (let j = 1; j <= 5; j++) g.lineTo(x + k * r * 0.35 + Math.sin(v.clock * 3 + j + k) * 3, y + j * r * 0.35);
        g.stroke();
      }
    });
  }

  function comet(g, v) {
    const cx = v.W * 0.7 + Math.sin(v.clock * 0.1) * 6;
    const cy = v.H * 0.2;
    const tail = g.createLinearGradient(cx, cy, cx - 170, cy + 110);
    tail.addColorStop(0, 'rgba(190,240,255,0.8)');
    tail.addColorStop(1, 'rgba(190,240,255,0)');
    g.fillStyle = tail;
    g.beginPath();
    g.moveTo(cx + 6, cy - 6);
    g.lineTo(cx - 180, cy + 100);
    g.lineTo(cx - 150, cy + 125);
    g.lineTo(cx - 6, cy + 6);
    g.closePath();
    g.fill();
    const head = g.createRadialGradient(cx, cy, 0, cx, cy, 16);
    head.addColorStop(0, 'rgba(255,255,255,1)');
    head.addColorStop(1, 'rgba(190,240,255,0)');
    g.fillStyle = head;
    g.fillRect(cx - 16, cy - 16, 32, 32);
  }

  function butterflies(g, v, { count = 9 } = {}) {
    const colors = ['#ff70a6', '#ffd670', '#70d6ff', '#c77dff', '#ff9770'];
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * v.W + v.clock * (14 + hash(i + 1) * 12) + Math.sin(v.clock * 1.7 + i) * 20, v.W + 30) - 15;
      const y = v.H * (0.15 + hash(i + 4) * 0.7) + Math.sin(v.clock * 2.3 + i * 3) * 14;
      const flap = Math.abs(Math.sin(v.clock * 12 + i));
      g.fillStyle = colors[i % colors.length];
      for (const side of [-1, 1]) {
        g.beginPath();
        g.ellipse(x + side * 5 * flap, y - 2, 5 * flap + 1, 6, side * 0.4, 0, Math.PI * 2);
        g.ellipse(x + side * 4 * flap, y + 4, 3.5 * flap + 1, 4, -side * 0.4, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#3b2a1a';
      g.fillRect(x - 0.8, y - 5, 1.6, 11);
    }
  }

  function dandelions(g, v, { count = 24 } = {}) {
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 0.8;
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * v.W + v.clock * (12 + hash(i + 2) * 14) + Math.sin(v.clock + i) * 10, v.W + 20) - 10;
      const y = wrap(hash(i + 60) * v.H - v.clock * (6 + hash(i + 3) * 10), v.H + 20) - 10;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + 7);
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.45;
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
      }
      g.stroke();
      g.beginPath();
      g.arc(x, y + 7, 1.2, 0, Math.PI * 2);
      g.fill();
    }
  }

  function skyline(g, v, { color = '#1a1f3a', lit = 'rgba(255,220,120,0.85)', neon = null } = {}) {
    const ground = v.H;
    let x = -6;
    let i = 0;
    while (x < v.W) {
      const w = 26 + hash(i + 80) * 26;
      const h = v.H * (0.12 + hash(i + 81) * 0.2);
      g.fillStyle = color;
      g.fillRect(x, ground - h, w - 2, h);
      for (let wy = ground - h + 6; wy < ground - 6; wy += 10) {
        for (let wx = x + 4; wx < x + w - 8; wx += 8) {
          const on = hash(Math.floor(wx * 3 + wy * 7) + Math.floor(v.clock / 3 + hash(i)) * 13) > 0.55;
          if (!on) continue;
          g.fillStyle = lit;
          g.fillRect(wx, wy, 3.5, 5);
        }
      }
      if (neon) {
        g.strokeStyle = neon[i % neon.length];
        g.globalAlpha = 0.6 + 0.4 * Math.sin(v.clock * 3 + i);
        g.lineWidth = 2;
        g.strokeRect(x + 1, ground - h + 1, w - 4, h);
        g.globalAlpha = 1;
      }
      x += w;
      i++;
    }
  }

  function dunes(g, v, { colors = ['#f2c57c', '#e0a458', '#c98b3f'] } = {}) {
    colors.forEach((color, k) => {
      const base = v.H * (0.68 + k * 0.1);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, v.H);
      for (let x = 0; x <= v.W; x += 10) g.lineTo(x, base + Math.sin(x * 0.012 + k * 2) * 22 + Math.sin(x * 0.03 + k) * 6);
      g.lineTo(v.W, v.H);
      g.closePath();
      g.fill();
    });
  }

  function ufo(g, v) {
    const x = v.W * 0.5 + Math.sin(v.clock * 0.6) * v.W * 0.3;
    const y = v.H * 0.22 + Math.sin(v.clock * 1.4) * 10;
    const beam = g.createLinearGradient(x, y, x, y + 160);
    beam.addColorStop(0, 'rgba(160,255,200,0.35)');
    beam.addColorStop(1, 'rgba(160,255,200,0)');
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(x - 10, y + 6);
    g.lineTo(x + 10, y + 6);
    g.lineTo(x + 45, y + 160);
    g.lineTo(x - 45, y + 160);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(180,230,255,0.8)';
    g.beginPath();
    g.ellipse(x, y - 6, 13, 11, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = '#9aa5b8';
    g.beginPath();
    g.ellipse(x, y, 32, 9, 0, 0, Math.PI * 2);
    g.fill();
    for (let k = -2; k <= 2; k++) {
      g.fillStyle = Math.sin(v.clock * 6 + k) > 0 ? '#ffe066' : '#ff6b6b';
      g.beginPath();
      g.arc(x + k * 11, y + 2, 2.2, 0, Math.PI * 2);
      g.fill();
    }
  }

  function confetti(g, v, { count = 50 } = {}) {
    const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff7eb6'];
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * v.W + Math.sin(v.clock * 1.3 + i) * 16, v.W);
      const y = wrap(hash(i + 70) * v.H + v.clock * (35 + hash(i + 7) * 30), v.H + 20) - 10;
      g.save();
      g.translate(x, y);
      g.rotate(v.clock * (2 + hash(i + 3) * 3) + i);
      g.fillStyle = colors[i % colors.length];
      g.fillRect(-3, -1.5 * Math.abs(Math.cos(v.clock * 4 + i)) - 0.5, 6, 3 * Math.abs(Math.cos(v.clock * 4 + i)) + 1);
      g.restore();
    }
  }

  function sea(g, v, { color = '#2e86c1', foam = 'rgba(255,255,255,0.6)', level = 0.8 } = {}) {
    const top = v.H * level;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, v.H);
    for (let x = 0; x <= v.W; x += 8) g.lineTo(x, top + Math.sin(x * 0.05 + v.clock * 1.5) * 4);
    g.lineTo(v.W, v.H);
    g.closePath();
    g.fill();
    g.strokeStyle = foam;
    g.lineWidth = 1.5;
    for (let row = 1; row <= 3; row++) {
      g.beginPath();
      for (let x = 0; x <= v.W; x += 8) {
        const y = top + row * 14 + Math.sin(x * 0.07 + v.clock * (1 + row * 0.3) + row) * 3;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  }

  function sailboats(g, v, { level = 0.8 } = {}) {
    for (let i = 0; i < 3; i++) {
      const x = wrap(hash(i + 90) * v.W + v.clock * (6 + i * 3), v.W + 60) - 30;
      const y = v.H * level + Math.sin(v.clock * 1.5 + i) * 2;
      g.fillStyle = '#7a4a2a';
      g.beginPath();
      g.moveTo(x - 16, y - 4); g.lineTo(x + 16, y - 4); g.lineTo(x + 10, y + 4); g.lineTo(x - 10, y + 4);
      g.closePath();
      g.fill();
      g.fillStyle = i % 2 ? '#ffffff' : '#ffe0b0';
      g.beginPath();
      g.moveTo(x, y - 34); g.lineTo(x + 14, y - 6); g.lineTo(x, y - 6);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(x - 2, y - 28); g.lineTo(x - 2, y - 6); g.lineTo(x - 12, y - 6);
      g.closePath();
      g.fill();
    }
  }

  function petals(g, v, { count = 34, color = '255,183,213' } = {}) {
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * v.W + v.clock * (18 + hash(i + 5) * 16) + Math.sin(v.clock * 1.5 + i) * 18, v.W + 20) - 10;
      const y = wrap(hash(i + 33) * v.H + v.clock * (24 + hash(i + 2) * 22), v.H + 20) - 10;
      g.save();
      g.translate(x, y);
      g.rotate(Math.sin(v.clock * 2 + i) * 1.2);
      g.fillStyle = `rgba(${color},${0.6 + hash(i + 8) * 0.4})`;
      g.beginPath();
      g.ellipse(0, 0, 4.5, 2.6, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  function hotAirBalloons(g, v) {
    const stripes = [['#ff595e', '#ffca3a'], ['#1982c4', '#ffffff'], ['#8ac926', '#ff924c'], ['#6a4c93', '#ffd6e0']];
    scrolling(v, 260, 0.28, (i, y0) => {
      const x = 45 + hash(i + 31) * (v.W - 90) + Math.sin(v.clock * 0.4 + i) * 12;
      const y = y0 + Math.sin(v.clock * 0.8 + i) * 6;
      const r = 20 + hash(i + 6) * 10;
      const [c1, c2] = stripes[wrap(i, stripes.length)];
      g.save();
      g.beginPath();
      g.ellipse(x, y, r, r * 1.15, 0, 0, Math.PI * 2);
      g.clip();
      for (let k = -3; k <= 3; k++) {
        g.fillStyle = k % 2 ? c1 : c2;
        g.fillRect(x + k * r * 0.3 - r * 0.15, y - r * 1.2, r * 0.3, r * 2.4);
      }
      g.restore();
      g.strokeStyle = 'rgba(80,50,30,0.7)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x - r * 0.55, y + r * 0.95); g.lineTo(x - r * 0.25, y + r * 1.6);
      g.moveTo(x + r * 0.55, y + r * 0.95); g.lineTo(x + r * 0.25, y + r * 1.6);
      g.stroke();
      g.fillStyle = '#8b5a2b';
      g.fillRect(x - r * 0.28, y + r * 1.6, r * 0.56, r * 0.4);
    });
  }

  function windmills(g, v, { color = '#f4f1e8' } = {}) {
    for (let i = 0; i < 3; i++) {
      const x = v.W * (0.18 + i * 0.32);
      const base = v.H;
      const h = v.H * (0.2 + hash(i + 40) * 0.08);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(x - 9, base); g.lineTo(x - 4, base - h); g.lineTo(x + 4, base - h); g.lineTo(x + 9, base);
      g.closePath();
      g.fill();
      const turn = v.clock * (1 + i * 0.3) + i;
      g.save();
      g.translate(x, base - h);
      g.rotate(turn);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      for (let k = 0; k < 3; k++) {
        g.rotate((Math.PI * 2) / 3);
        g.beginPath();
        g.moveTo(-2, 0); g.lineTo(-4, -h * 0.5); g.lineTo(4, -h * 0.5); g.lineTo(2, 0);
        g.closePath();
        g.fill();
      }
      g.fillStyle = '#c9a66b';
      g.beginPath();
      g.arc(0, 0, 3, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  function castle(g, v, { color = 'rgba(120,90,160,0.55)' } = {}) {
    const base = v.H * 0.78;
    const cx = v.W * 0.5;
    g.fillStyle = color;
    const towers = [[-80, 70, 22], [-40, 110, 26], [0, 150, 30], [40, 110, 26], [80, 70, 22]];
    for (const [dx, h, w] of towers) {
      g.fillRect(cx + dx - w / 2, base - h, w, h);
      g.beginPath();
      g.moveTo(cx + dx - w / 2 - 4, base - h);
      g.lineTo(cx + dx, base - h - w * 1.1);
      g.lineTo(cx + dx + w / 2 + 4, base - h);
      g.closePath();
      g.fill();
    }
    g.fillRect(cx - 95, base - 45, 190, 45);
    clouds(g, { ...v, cameraY: 0 }, { color: 'rgba(255,255,255,0.85)', spacing: 60, size: 1.2, parallax: 0 });
    g.fillStyle = 'rgba(255,240,180,0.9)';
    for (const [dx, h] of [[-40, 80], [0, 115], [40, 80]]) {
      g.beginPath();
      g.ellipse(cx + dx, base - h, 3, 5, 0, 0, Math.PI * 2);
      g.fill();
    }
    const flag = Math.sin(v.clock * 4) * 3;
    g.fillStyle = '#ff6b6b';
    g.beginPath();
    g.moveTo(cx, base - 183); g.lineTo(cx + 14, base - 179 + flag); g.lineTo(cx, base - 174);
    g.closePath();
    g.fill();
  }

  function volcano(g, v) {
    const cx = v.W * 0.55;
    const base = v.H * 0.82;
    for (let i = 0; i < 6; i++) {
      const t = (v.clock * 0.25 + i / 6) % 1;
      const r = 10 + t * 30;
      g.fillStyle = `rgba(120,110,110,${0.5 * (1 - t)})`;
      g.beginPath();
      g.arc(cx + Math.sin(t * 5 + i) * 15 + t * 30, base - 120 - t * 160, r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#5b3a29';
    g.beginPath();
    g.moveTo(cx - 140, base); g.lineTo(cx - 25, base - 120); g.lineTo(cx + 25, base - 120); g.lineTo(cx + 140, base);
    g.closePath();
    g.fill();
    g.fillStyle = '#ff7b00';
    g.beginPath();
    g.moveTo(cx - 25, base - 120); g.lineTo(cx + 25, base - 120); g.lineTo(cx + 12, base - 95);
    g.lineTo(cx + 4, base - 108); g.lineTo(cx - 6, base - 80); g.lineTo(cx - 12, base - 104);
    g.closePath();
    g.fill();
  }

  function rocket(g, v) {
    const t = (v.clock * 0.12) % 1;
    const x = v.W * 0.3 + t * v.W * 0.15;
    const y = v.H * (1.1 - t * 1.4);
    g.save();
    g.translate(x, y);
    g.rotate(0.12);
    const flame = 10 + Math.sin(v.clock * 30) * 4;
    g.fillStyle = '#ffb703';
    g.beginPath();
    g.moveTo(-6, 18); g.lineTo(0, 18 + flame + 8); g.lineTo(6, 18);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -24); g.quadraticCurveTo(10, -10, 8, 18); g.lineTo(-8, 18); g.quadraticCurveTo(-10, -10, 0, -24);
    g.fill();
    g.fillStyle = '#e63946';
    g.beginPath();
    g.moveTo(-8, 8); g.lineTo(-15, 22); g.lineTo(-8, 18);
    g.moveTo(8, 8); g.lineTo(15, 22); g.lineTo(8, 18);
    g.fill();
    g.fillStyle = '#4cc9f0';
    g.beginPath();
    g.arc(0, -6, 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
    for (let k = 1; k <= 8; k++) {
      g.fillStyle = `rgba(255,255,255,${0.35 - k * 0.04})`;
      g.beginPath();
      g.arc(x - k * 2.5, y + 30 + k * 10, 5 + k * 1.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  function icebergs(g, v) {
    const level = v.H * 0.8;
    for (const [fx, w, h] of [[0.15, 70, 60], [0.55, 110, 95], [0.9, 60, 45]]) {
      const x = v.W * fx;
      const bob = Math.sin(v.clock + fx * 9) * 2;
      g.fillStyle = '#f2fbff';
      g.beginPath();
      g.moveTo(x - w / 2, level + bob);
      g.lineTo(x - w * 0.2, level - h + bob);
      g.lineTo(x + w * 0.05, level - h * 0.8 + bob);
      g.lineTo(x + w * 0.25, level - h * 0.95 + bob);
      g.lineTo(x + w / 2, level + bob);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(150,200,230,0.6)';
      g.beginPath();
      g.moveTo(x + w * 0.05, level - h * 0.8 + bob);
      g.lineTo(x + w * 0.25, level - h * 0.95 + bob);
      g.lineTo(x + w / 2, level + bob);
      g.lineTo(x + w * 0.1, level + bob);
      g.closePath();
      g.fill();
    }
  }

  function hearts(g, v, { count = 16 } = {}) {
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * v.W + Math.sin(v.clock + i) * 12, v.W);
      const y = wrap(hash(i + 44) * (v.H + 40) - v.clock * (14 + hash(i + 2) * 16), v.H + 40) - 20;
      const s = 5 + hash(i + 7) * 6;
      g.fillStyle = `rgba(255,${90 + Math.floor(hash(i + 1) * 80)},${140 + Math.floor(hash(i + 3) * 60)},0.75)`;
      g.beginPath();
      g.moveTo(x, y + s * 0.9);
      g.bezierCurveTo(x - s * 1.4, y - s * 0.2, x - s * 0.6, y - s * 1.2, x, y - s * 0.4);
      g.bezierCurveTo(x + s * 0.6, y - s * 1.2, x + s * 1.4, y - s * 0.2, x, y + s * 0.9);
      g.fill();
    }
  }

  function zeppelin(g, v) {
    const x = wrap(v.clock * 14, v.W + 200) - 100;
    const y = v.H * 0.25 + Math.sin(v.clock * 0.7) * 6;
    g.fillStyle = '#c0c8d6';
    g.beginPath();
    g.ellipse(x, y, 60, 18, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.beginPath();
    g.ellipse(x + 5, y - 7, 45, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e76f51';
    g.beginPath();
    g.moveTo(x - 55, y); g.lineTo(x - 72, y - 16); g.lineTo(x - 66, y);
    g.lineTo(x - 72, y + 16);
    g.closePath();
    g.fill();
    g.fillStyle = '#6d597a';
    g.fillRect(x - 12, y + 16, 24, 7);
  }

  function mist(g, v, { color = '255,255,255', alpha = 0.25 } = {}) {
    for (let k = 0; k < 3; k++) {
      const y = v.H * (0.55 + k * 0.15);
      const grad = g.createLinearGradient(0, y - 30, 0, y + 30);
      grad.addColorStop(0, `rgba(${color},0)`);
      grad.addColorStop(0.5, `rgba(${color},${alpha})`);
      grad.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = grad;
      g.fillRect(0, y - 30 + Math.sin(v.clock * 0.3 + k) * 6, v.W, 60);
    }
  }

  function sheep(g, v) {
    // Fluffy sheep hopping over a fence, one after another.
    const ground = v.H * 0.9;
    g.fillStyle = 'rgba(70,110,60,0.9)';
    g.fillRect(0, ground, v.W, v.H - ground);
    const fx = v.W * 0.5;
    g.strokeStyle = '#a0764b';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(fx - 22, ground); g.lineTo(fx - 22, ground - 26);
    g.moveTo(fx + 22, ground); g.lineTo(fx + 22, ground - 26);
    g.moveTo(fx - 28, ground - 10); g.lineTo(fx + 28, ground - 10);
    g.moveTo(fx - 28, ground - 21); g.lineTo(fx + 28, ground - 21);
    g.stroke();
    for (let k = 0; k < 3; k++) {
      const t = (v.clock * 0.22 + k / 3) % 1;
      const x = -30 + t * (v.W + 60);
      const hop = Math.max(0, 1 - Math.pow((x - fx) / 70, 2));
      const y = ground - 12 - hop * 50 - Math.abs(Math.sin(v.clock * 8 + k)) * 2;
      g.fillStyle = '#ffffff';
      for (const [dx, dy, r] of [[-8, 0, 8], [0, -4, 9], [8, 0, 8], [0, 3, 8]]) {
        g.beginPath();
        g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#3b3b3b';
      g.beginPath();
      g.ellipse(x + 15, y - 2, 5, 4, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(x - 7, y + 8, 2.5, 8);
      g.fillRect(x + 6, y + 8, 2.5, 8);
    }
  }

  function crescent(g, v, { x = 0.75, y = 0.18, r = 28, face = true } = {}) {
    const cx = v.W * x;
    const cy = v.H * y;
    const halo = g.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.8);
    halo.addColorStop(0, 'rgba(255,240,180,0.3)');
    halo.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = halo;
    g.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
    g.fillStyle = '#ffe9a0';
    g.beginPath();
    g.arc(cx, cy, r, Math.PI * 0.35, Math.PI * 1.65, false);
    g.arc(cx + r * 0.45, cy - r * 0.1, r * 0.82, Math.PI * 1.5, Math.PI * 0.45, true);
    g.closePath();
    g.fill();
    if (face) {
      g.strokeStyle = '#b8902f';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(cx - r * 0.5, cy - r * 0.15, r * 0.14, 0.1 * Math.PI, 0.9 * Math.PI);
      g.stroke();
      g.beginPath();
      g.arc(cx - r * 0.45, cy + r * 0.3, r * 0.16, 0.2 * Math.PI, 0.8 * Math.PI);
      g.stroke();
    }
  }

  function owls(g, v) {
    const y = v.H * 0.72;
    g.strokeStyle = '#2b1b10';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-10, y + 12);
    g.quadraticCurveTo(v.W * 0.5, y + 2, v.W + 10, y + 16);
    g.stroke();
    for (const fx of [0.25, 0.5, 0.78]) {
      const x = v.W * fx;
      const blink = Math.sin(v.clock * 0.9 + fx * 20) > 0.97;
      g.fillStyle = '#5a3d2b';
      g.beginPath();
      g.ellipse(x, y - 8, 11, 15, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(x - 10, y - 18); g.lineTo(x - 7, y - 27); g.lineTo(x - 3, y - 20);
      g.moveTo(x + 10, y - 18); g.lineTo(x + 7, y - 27); g.lineTo(x + 3, y - 20);
      g.fill();
      for (const ex of [x - 5, x + 5]) {
        g.fillStyle = '#ffe066';
        g.beginPath();
        if (blink) g.fillRect(ex - 3.5, y - 13, 7, 1.5);
        else g.arc(ex, y - 12, 3.8, 0, Math.PI * 2);
        g.fill();
        if (!blink) {
          g.fillStyle = '#1a1a1a';
          g.beginPath();
          g.arc(ex, y - 12, 1.6, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.fillStyle = '#f4a261';
      g.beginPath();
      g.moveTo(x - 2, y - 8); g.lineTo(x + 2, y - 8); g.lineTo(x, y - 4);
      g.fill();
    }
  }

  function tulips(g, v) {
    const colors = ['#ff4d6d', '#ffd60a', '#ff8fab', '#f77f00', '#c77dff'];
    const rows = [[0.86, 9, 1], [0.92, 11, 1.15], [0.98, 13, 1.3]];
    rows.forEach(([fy, step, s], row) => {
      const y = v.H * fy;
      for (let x = 4 + row * 5; x < v.W; x += step * 2) {
        const sway = Math.sin(v.clock * 1.5 + x * 0.1) * 1.5;
        g.strokeStyle = '#3a7d44';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x, y + 14);
        g.lineTo(x + sway, y);
        g.stroke();
        g.fillStyle = colors[Math.floor(hash(x + row * 50) * colors.length)];
        g.beginPath();
        g.moveTo(x + sway - 4 * s, y - 6 * s);
        g.lineTo(x + sway - 2 * s, y - 2 * s);
        g.lineTo(x + sway, y - 6 * s);
        g.lineTo(x + sway + 2 * s, y - 2 * s);
        g.lineTo(x + sway + 4 * s, y - 6 * s);
        g.quadraticCurveTo(x + sway + 4 * s, y + 2 * s, x + sway, y + 2 * s);
        g.quadraticCurveTo(x + sway - 4 * s, y + 2 * s, x + sway - 4 * s, y - 6 * s);
        g.fill();
      }
    });
  }

  function cacti(g, v, { color = '#2d6a4f' } = {}) {
    for (const [fx, h] of [[0.12, 70], [0.42, 46], [0.8, 86]]) {
      const x = v.W * fx;
      const base = v.H * 0.9;
      g.strokeStyle = color;
      g.lineCap = 'round';
      g.lineWidth = 12;
      g.beginPath();
      g.moveTo(x, base); g.lineTo(x, base - h);
      g.stroke();
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(x, base - h * 0.45); g.lineTo(x - 14, base - h * 0.45); g.lineTo(x - 14, base - h * 0.75);
      g.moveTo(x, base - h * 0.6); g.lineTo(x + 13, base - h * 0.6); g.lineTo(x + 13, base - h * 0.85);
      g.stroke();
    }
    g.lineCap = 'butt';
  }

  function mushrooms(g, v) {
    const base = v.H * 0.92;
    for (const [fx, s, cap] of [[0.1, 1, '#e63946'], [0.3, 0.7, '#f4a261'], [0.62, 1.3, '#e63946'], [0.88, 0.8, '#9d4edd']]) {
      const x = v.W * fx;
      g.fillStyle = '#f1e3c8';
      g.fillRect(x - 5 * s, base - 22 * s, 10 * s, 22 * s);
      g.fillStyle = cap;
      g.beginPath();
      g.ellipse(x, base - 22 * s, 22 * s, 15 * s, 0, Math.PI, Math.PI * 2);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [dx, dy, r] of [[-10, -6, 3], [2, -11, 3.5], [11, -5, 2.5]]) {
        g.beginPath();
        g.arc(x + dx * s, base - 22 * s + dy * s, r * s, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  function dragonflies(g, v, { count = 6 } = {}) {
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * v.W + Math.sin(v.clock * 0.7 + i) * 60 + v.clock * 10, v.W + 20) - 10;
      const y = v.H * (0.4 + hash(i + 5) * 0.4) + Math.sin(v.clock * 3 + i * 2) * 8;
      const flick = Math.abs(Math.sin(v.clock * 25 + i));
      g.fillStyle = `rgba(200,240,255,${0.35 + flick * 0.35})`;
      for (const side of [-1, 1]) {
        g.beginPath();
        g.ellipse(x - 2, y + side * 5, 7, 2.2, side * 0.3, 0, Math.PI * 2);
        g.ellipse(x + 3, y + side * 5, 6, 2, -side * 0.3, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = i % 2 ? '#2ec4b6' : '#4361ee';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 10, y); g.lineTo(x + 8, y);
      g.stroke();
    }
  }

  function reeds(g, v) {
    g.strokeStyle = '#4f772d';
    g.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const x = hash(i + 200) * v.W;
      const h = 30 + hash(i + 201) * 40;
      const sway = Math.sin(v.clock * 1.2 + i) * 4;
      g.beginPath();
      g.moveTo(x, v.H);
      g.quadraticCurveTo(x, v.H - h * 0.6, x + sway, v.H - h);
      g.stroke();
      if (i % 3 === 0) {
        g.fillStyle = '#7f4f24';
        g.beginPath();
        g.ellipse(x + sway, v.H - h, 2.5, 7, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  function pumpkins(g, v) {
    const base = v.H * 0.94;
    for (const [fx, s] of [[0.15, 1], [0.45, 1.4], [0.8, 0.9]]) {
      const x = v.W * fx;
      g.fillStyle = '#f77f00';
      for (const dx of [-9, 9, 0]) {
        g.beginPath();
        g.ellipse(x + dx * s, base - 12 * s, 11 * s, 13 * s, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#386641';
      g.fillRect(x - 2 * s, base - 30 * s, 4 * s, 7 * s);
      const glow = 0.6 + 0.4 * Math.sin(v.clock * 5 + fx * 10);
      g.fillStyle = `rgba(255,230,120,${glow})`;
      g.beginPath();
      g.moveTo(x - 8 * s, base - 16 * s); g.lineTo(x - 4 * s, base - 20 * s); g.lineTo(x - 2 * s, base - 15 * s);
      g.moveTo(x + 8 * s, base - 16 * s); g.lineTo(x + 4 * s, base - 20 * s); g.lineTo(x + 2 * s, base - 15 * s);
      g.moveTo(x - 7 * s, base - 9 * s); g.lineTo(x + 7 * s, base - 9 * s); g.lineTo(x, base - 5 * s);
      g.fill();
    }
  }

  function snowmen(g, v) {
    const base = v.H * 0.92;
    g.fillStyle = '#f8fbff';
    g.beginPath();
    g.moveTo(0, v.H);
    for (let x = 0; x <= v.W; x += 20) g.lineTo(x, base + Math.sin(x * 0.02) * 8);
    g.lineTo(v.W, v.H);
    g.closePath();
    g.fill();
    for (const [fx, s] of [[0.22, 1], [0.7, 1.25]]) {
      const x = v.W * fx;
      g.fillStyle = '#ffffff';
      g.strokeStyle = 'rgba(150,170,200,0.6)';
      g.lineWidth = 1;
      for (const [dy, r] of [[-12, 15], [-36, 11], [-54, 8]]) {
        g.beginPath();
        g.arc(x, base + dy * s, r * s, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      g.fillStyle = '#222';
      g.beginPath();
      g.arc(x - 3 * s, base - 56 * s, 1.3 * s, 0, Math.PI * 2);
      g.arc(x + 3 * s, base - 56 * s, 1.3 * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f77f00';
      g.beginPath();
      g.moveTo(x, base - 53 * s); g.lineTo(x + 9 * s, base - 52 * s); g.lineTo(x, base - 51 * s);
      g.fill();
      g.fillStyle = '#d62828';
      g.fillRect(x - 9 * s, base - 47 * s, 18 * s, 4 * s);
      g.fillStyle = '#222';
      g.fillRect(x - 7 * s, base - 70 * s, 14 * s, 9 * s);
      g.fillRect(x - 10 * s, base - 62 * s, 20 * s, 2 * s);
    }
  }

  function pinwheels(g, v) {
    const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4'];
    for (const [fx, fy, s] of [[0.15, 0.82, 1], [0.38, 0.88, 0.8], [0.65, 0.84, 1.2], [0.88, 0.9, 0.9]]) {
      const x = v.W * fx;
      const y = v.H * fy;
      g.strokeStyle = '#8d6e63';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, v.H);
      g.stroke();
      g.save();
      g.translate(x, y);
      g.rotate(v.clock * (3 + fx * 2));
      for (let k = 0; k < 4; k++) {
        g.fillStyle = colors[k];
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(14 * s, -2 * s);
        g.lineTo(14 * s, -14 * s);
        g.closePath();
        g.fill();
        g.rotate(Math.PI / 2);
      }
      g.restore();
    }
  }

  function bunting(g, v) {
    const colors = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5'];
    for (const [y0, sag] of [[0.12, 30], [0.3, 24]]) {
      const y = v.H * y0;
      g.strokeStyle = 'rgba(90,60,40,0.7)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(0, y);
      g.quadraticCurveTo(v.W / 2, y + sag * 2, v.W, y);
      g.stroke();
      for (let k = 0; k < 12; k++) {
        const t = (k + 0.5) / 12;
        const x = t * v.W;
        const yy = y + sag * 4 * t * (1 - t);
        const flap = Math.sin(v.clock * 6 + k) * 3;
        g.fillStyle = colors[k % colors.length];
        g.beginPath();
        g.moveTo(x - 9, yy);
        g.lineTo(x + 9, yy);
        g.lineTo(x + flap, yy + 16);
        g.closePath();
        g.fill();
      }
    }
  }

  function whirlwind(g, v) {
    const cx = v.W * 0.5 + Math.sin(v.clock * 0.5) * v.W * 0.3;
    const base = v.H * 0.9;
    g.strokeStyle = 'rgba(210,190,150,0.55)';
    g.lineWidth = 3;
    for (let k = 0; k < 9; k++) {
      const y = base - k * 18;
      const r = 8 + k * 6;
      const sway = Math.sin(v.clock * 2 + k * 0.6) * k * 2;
      g.beginPath();
      g.ellipse(cx + sway, y, r, r * 0.25, 0, v.clock * 6 + k, v.clock * 6 + k + Math.PI * 1.4);
      g.stroke();
    }
  }

  function lighthouse(g, v) {
    const x = v.W * 0.78;
    const base = v.H * 0.8;
    const angle = v.clock * 1.2;
    const beam = g.createRadialGradient(x, base - 118, 0, x, base - 118, 260);
    beam.addColorStop(0, 'rgba(255,245,180,0.45)');
    beam.addColorStop(1, 'rgba(255,245,180,0)');
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(x, base - 118);
    g.arc(x, base - 118, 260, Math.PI + Math.sin(angle) * 0.6 - 0.12, Math.PI + Math.sin(angle) * 0.6 + 0.12);
    g.closePath();
    g.fill();
    g.fillStyle = '#5c4033';
    g.beginPath();
    g.moveTo(x - 40, base + 5); g.lineTo(x - 20, base - 12); g.lineTo(x + 30, base - 8); g.lineTo(x + 50, base + 5);
    g.closePath();
    g.fill();
    for (let k = 0; k < 4; k++) {
      g.fillStyle = k % 2 ? '#ffffff' : '#e63946';
      const y1 = base - 10 - k * 25;
      const w1 = 16 - k * 1.5;
      g.beginPath();
      g.moveTo(x - w1, y1); g.lineTo(x - w1 + 1.5, y1 - 25); g.lineTo(x + w1 - 1.5, y1 - 25); g.lineTo(x + w1, y1);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#ffe066';
    g.fillRect(x - 8, base - 124, 16, 12);
    g.fillStyle = '#3d405b';
    g.beginPath();
    g.moveTo(x - 12, base - 124); g.lineTo(x, base - 136); g.lineTo(x + 12, base - 124);
    g.closePath();
    g.fill();
  }

  function pirateShip(g, v, { level = 0.8 } = {}) {
    const x = v.W * 0.35 + Math.sin(v.clock * 0.3) * 20;
    const y = v.H * level + Math.sin(v.clock * 1.4) * 3;
    const tilt = Math.sin(v.clock * 1.4) * 0.05;
    g.save();
    g.translate(x, y);
    g.rotate(tilt);
    g.fillStyle = '#6f4518';
    g.beginPath();
    g.moveTo(-50, -14); g.lineTo(50, -14); g.lineTo(38, 6); g.lineTo(-38, 6);
    g.closePath();
    g.fill();
    g.strokeStyle = '#4a2c10';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, -14); g.lineTo(0, -80);
    g.stroke();
    const billow = 6 + Math.sin(v.clock * 2) * 2;
    g.fillStyle = '#fdf0d5';
    g.beginPath();
    g.moveTo(-26, -74); g.quadraticCurveTo(-26 + billow, -55, -26, -36); g.lineTo(26, -36);
    g.quadraticCurveTo(26 + billow, -55, 26, -74);
    g.closePath();
    g.fill();
    g.fillStyle = '#222';
    g.beginPath();
    g.moveTo(0, -80); g.lineTo(18, -86 + Math.sin(v.clock * 6) * 2); g.lineTo(0, -92);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, -55, 6, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function palmTrees(g, v) {
    for (const [fx, h, lean] of [[0.12, 120, 0.25], [0.86, 100, -0.3]]) {
      const x = v.W * fx;
      const base = v.H * 0.92;
      const sway = Math.sin(v.clock * 1.6 + fx * 5) * 0.06;
      const topX = x + Math.sin(lean + sway) * h;
      const topY = base - Math.cos(lean + sway) * h;
      g.strokeStyle = '#8d6e46';
      g.lineWidth = 8;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, base);
      g.quadraticCurveTo(x + (topX - x) * 0.2, base - h * 0.5, topX, topY);
      g.stroke();
      g.strokeStyle = '#2d6a4f';
      g.lineWidth = 5;
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.55 + Math.sin(v.clock * 3 + k) * 0.08;
        g.beginPath();
        g.moveTo(topX, topY);
        g.quadraticCurveTo(topX + Math.cos(a) * 30, topY + Math.sin(a) * 30 - 6, topX + Math.cos(a) * 46, topY + Math.sin(a) * 46 + 14);
        g.stroke();
      }
      g.lineCap = 'butt';
    }
  }

  function cloudStreaks(g, v, { color = 'rgba(255,255,255,0.55)', speed = 120 } = {}) {
    g.strokeStyle = color;
    g.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const y = v.H * (0.08 + hash(i + 120) * 0.7);
      const len = 30 + hash(i + 121) * 60;
      const x = wrap(hash(i + 122) * v.W + v.clock * speed * (0.7 + hash(i + 123) * 0.6), v.W + len * 2) - len;
      g.lineWidth = 2 + hash(i + 124) * 4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y);
      g.stroke();
    }
    g.lineCap = 'butt';
  }

  function whales(g, v, { level = 0.8 } = {}) {
    for (const [fx, s, dir] of [[0.3, 1, 1], [0.75, 0.7, -1]]) {
      const x = v.W * fx + Math.sin(v.clock * 0.2 + fx) * 20;
      const y = v.H * level + 6;
      g.fillStyle = '#3d5a80';
      g.beginPath();
      g.ellipse(x, y, 38 * s, 14 * s, 0, Math.PI, Math.PI * 2);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(x - dir * 34 * s, y);
      g.lineTo(x - dir * 50 * s, y - 14 * s);
      g.lineTo(x - dir * 42 * s, y);
      g.closePath();
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(x + dir * 22 * s, y - 6 * s, 1.8 * s, 0, Math.PI * 2);
      g.fill();
      const t = (v.clock * 0.5 + fx) % 1;
      if (t < 0.5) {
        const h = Math.sin(t * Math.PI * 2) * 28 * s;
        g.strokeStyle = 'rgba(220,240,255,0.85)';
        g.lineWidth = 2;
        for (const a of [-0.5, 0, 0.5]) {
          g.beginPath();
          g.moveTo(x + dir * 10 * s, y - 13 * s);
          g.quadraticCurveTo(x + dir * 10 * s + a * 10, y - 13 * s - h, x + dir * 10 * s + a * 18, y - 13 * s - h * 0.7);
          g.stroke();
        }
      }
    }
  }

  function slantRain(g, v, { count = 80, color = 'rgba(200,215,240,0.55)', slant = 0.5 } = {}) {
    g.strokeStyle = color;
    g.lineWidth = 1.3;
    g.beginPath();
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * v.W + v.clock * 260 * slant, v.W + 40) - 20;
      const y = wrap(hash(i + 50) * v.H + v.clock * 520, v.H + 20) - 10;
      g.moveTo(x, y);
      g.lineTo(x + 12 * slant, y + 12);
    }
    g.stroke();
  }

  // ---- The levels ----------------------------------------------------------------

  const THEMES = [
    { name: 'Sunny Meadow', top: '#5fb4ec', bottom: '#cdeeff', text: '#fff',
      deco: (g, v) => { sun(g, v); clouds(g, v); } },
    { name: 'Breezy Hills', top: '#6cc3f0', bottom: '#e3f6ff',
      deco: (g, v) => { mountains(g, v, { color: 'rgba(120,190,140,0.55)' }); clouds(g, v); birds(g, v); } },
    { name: 'Balloon Festival', top: '#7ccff5', bottom: '#fff1d6',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(255,255,255,0.7)' }); balloons(g, v); } },
    { name: 'Golden Afternoon', top: '#f2b94b', bottom: '#fff3c4',
      deco: (g, v) => { sun(g, v, { r: 42, color: '#fff2a8', glow: 'rgba(255,240,170,0.5)' }); clouds(g, v, { color: 'rgba(255,248,225,0.75)' }); } },
    { name: 'Rainbow Sky', top: '#8fd3ff', bottom: '#fdfbe8',
      deco: (g, v) => { rainbow(g, v); clouds(g, v); } },
    { name: 'Rainy Day', top: '#6f8196', bottom: '#b9c5d2',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(120,130,145,0.85)', size: 1.4, spacing: 140 }); rain(g, v); } },
    { name: 'Autumn Breeze', top: '#ec9a45', bottom: '#fde2b8',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(255,240,220,0.7)' }); leaves(g, v); } },
    { name: 'Sunset Beach', top: '#ff6f61', bottom: '#ffc78a',
      deco: (g, v) => { sun(g, v, { x: 0.5, y: 0.55, r: 48, color: '#ffe08a', glow: 'rgba(255,170,90,0.45)' }); birds(g, v, { color: 'rgba(80,30,40,0.6)' }); } },
    { name: 'Lavender Dusk', top: '#5b4fc4', bottom: '#f3a6c8',
      deco: (g, v) => { stars(g, v, { count: 18, alpha: 0.6 }); clouds(g, v, { color: 'rgba(255,200,230,0.55)' }); } },
    { name: 'Snowy Peaks', top: '#9fc0e3', bottom: '#eef6ff',
      deco: (g, v) => { mountains(g, v, { color: '#8aa6c4', snowCap: true }); snow(g, v); } },
    { name: 'Cotton Candy', top: '#ff9ecf', bottom: '#a7e9ff',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(255,225,245,0.85)', size: 1.3 }); sparkles(g, v, { color: '255,255,255' }); } },
    { name: 'Thunderstorm', top: '#26313f', bottom: '#56677a',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(70,80,95,0.9)', size: 1.5, spacing: 130 }); rain(g, v, { count: 90 }); lightning(g, v); } },
    { name: 'Starry Night', top: '#0b1a3a', bottom: '#25386b',
      deco: (g, v) => { stars(g, v); moon(g, v); } },
    { name: 'Northern Lights', top: '#061a2b', bottom: '#0f3b4a',
      deco: (g, v) => { stars(g, v, { count: 40 }); aurora(g, v); } },
    { name: 'Stratosphere', top: '#10215a', bottom: '#3a6fd8',
      deco: (g, v) => { stars(g, v, { count: 30, alpha: 0.7 }); clouds(g, v, { color: 'rgba(200,220,255,0.35)', size: 0.8, parallax: 0.6 }); } },
    { name: 'Moonwalk', top: '#0b0b16', bottom: '#2a2a40',
      deco: (g, v) => { stars(g, v, { count: 60 }); moon(g, v, { x: 0.3, y: 0.3, r: 70 }); } },
    { name: 'Ringed Planet', top: '#120a2a', bottom: '#2b1a55',
      deco: (g, v) => { stars(g, v, { count: 60 }); planet(g, v); } },
    { name: 'Nebula', top: '#1a0630', bottom: '#45105a',
      deco: (g, v) => { nebula(g, v); stars(g, v, { count: 70 }); } },
    { name: 'Galaxy Swirl', top: '#050510', bottom: '#1a1440',
      deco: (g, v) => { stars(g, v, { count: 70 }); galaxy(g, v); } },
    { name: 'Egg Heaven', top: '#ffd76a', bottom: '#fff8e7',
      deco: (g, v) => { sun(g, v, { x: 0.5, y: 0.2, r: 40, color: '#fffbe6', glow: 'rgba(255,230,140,0.6)' }); clouds(g, v, { color: 'rgba(255,255,255,0.9)', size: 1.3 }); sparkles(g, v); } },
    // Levels 21-30 (v2): turning baskets.
    { name: 'Kite Day', top: '#4fb0e8', bottom: '#d8f3ff',
      deco: (g, v) => { sun(g, v, { x: 0.2, y: 0.14 }); clouds(g, v, { size: 0.8 }); kites(g, v); } },
    { name: 'Bubble Bay', top: '#2fb5c4', bottom: '#dcfbfd',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(255,255,255,0.5)', size: 0.7 }); bubbles(g, v); } },
    { name: 'Lantern Night', top: '#1b1440', bottom: '#5a2a5e',
      deco: (g, v) => { stars(g, v, { count: 35, alpha: 0.7 }); lanterns(g, v); } },
    { name: 'Meteor Shower', top: '#070b24', bottom: '#1d2a5c',
      deco: (g, v) => { stars(g, v, { count: 70 }); meteors(g, v); } },
    { name: 'Firefly Forest', top: '#0e2a2a', bottom: '#2f5d50',
      deco: (g, v) => { stars(g, v, { count: 20, alpha: 0.5 }); moon(g, v, { x: 0.8, y: 0.12, r: 18 }); treeline(g, v); fireflies(g, v); } },
    { name: 'Paper Planes', top: '#8ec5fc', bottom: '#e0c3fc',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(255,255,255,0.65)' }); paperPlanes(g, v); } },
    { name: 'Misty Sunrise', top: '#ff9a8b', bottom: '#ffe3b3',
      deco: (g, v) => { sun(g, v, { x: 0.35, y: 0.6, r: 46, color: '#fff0c2', glow: 'rgba(255,200,150,0.5)' }); mountains(g, v, { color: 'rgba(190,120,140,0.45)' }); clouds(g, v, { color: 'rgba(255,240,235,0.55)', size: 1.4, spacing: 150 }); birds(g, v, { color: 'rgba(110,50,60,0.55)' }); } },
    { name: 'Jellyfish Sky', top: '#2b1055', bottom: '#7597de',
      deco: (g, v) => { bubbles(g, v, { count: 14, tint: '200,220,255' }); jellyfish(g, v); } },
    { name: 'Popcorn Clouds', top: '#ffb347', bottom: '#fff5d1',
      deco: (g, v) => { sun(g, v, { r: 30, color: '#fff7c7' }); clouds(g, v, { color: 'rgba(255,253,240,0.95)', size: 1.6, spacing: 120, parallax: 0.5 }); } },
    { name: 'Comet Night', top: '#0f2027', bottom: '#2c5364',
      deco: (g, v) => { stars(g, v, { count: 60 }); comet(g, v); meteors(g, v, { count: 2, color: '190,240,255' }); } },
    // Levels 31-40 (v3): pulsing baskets.
    { name: 'Butterfly Garden', top: '#7fd8be', bottom: '#f6fff8',
      deco: (g, v) => { sun(g, v, { x: 0.8, y: 0.12, r: 28 }); clouds(g, v, { size: 0.8 }); butterflies(g, v); } },
    { name: 'Dandelion Drift', top: '#9ad0ec', bottom: '#f4f9e9',
      deco: (g, v) => { mountains(g, v, { color: 'rgba(150,200,120,0.6)' }); clouds(g, v, { color: 'rgba(255,255,255,0.7)' }); dandelions(g, v); } },
    { name: 'City Lights', top: '#0d1b3d', bottom: '#3b3f72',
      deco: (g, v) => { stars(g, v, { count: 30, alpha: 0.6 }); moon(g, v, { x: 0.2, y: 0.15, r: 20 }); skyline(g, v); } },
    { name: 'Desert Dunes', top: '#ffb366', bottom: '#ffe8c2',
      deco: (g, v) => { sun(g, v, { x: 0.7, y: 0.25, r: 50, color: '#fff3b0', glow: 'rgba(255,220,140,0.5)' }); dunes(g, v); birds(g, v, { count: 3, color: 'rgba(90,50,20,0.5)' }); } },
    { name: 'UFO Night', top: '#05051a', bottom: '#1f2a48',
      deco: (g, v) => { stars(g, v, { count: 70 }); ufo(g, v); } },
    { name: 'Confetti Party', top: '#ffafcc', bottom: '#fff0f6',
      deco: (g, v) => { balloons(g, v); confetti(g, v); } },
    { name: 'Ocean Breeze', top: '#56ccf2', bottom: '#e0f7ff',
      deco: (g, v) => { sun(g, v, { x: 0.25, y: 0.15, r: 30 }); clouds(g, v, { color: 'rgba(255,255,255,0.8)', size: 0.9 }); sea(g, v); birds(g, v, { count: 4 }); } },
    { name: 'Cherry Blossom', top: '#ffc6d9', bottom: '#fff5f8',
      deco: (g, v) => { mountains(g, v, { color: 'rgba(180,150,200,0.45)', snowCap: true }); petals(g, v); } },
    { name: 'Sunset Sails', top: '#ff7e5f', bottom: '#feb47b',
      deco: (g, v) => { sun(g, v, { x: 0.6, y: 0.7, r: 44, color: '#ffe29a', glow: 'rgba(255,160,90,0.5)' }); sea(g, v, { color: '#6c5b7b', foam: 'rgba(255,220,200,0.55)', level: 0.78 }); sailboats(g, v, { level: 0.78 }); } },
    { name: 'Neon Night', top: '#12002b', bottom: '#3a0f5c',
      deco: (g, v) => { stars(g, v, { count: 40, alpha: 0.7 }); meteors(g, v, { count: 2, color: '255,120,240' }); skyline(g, v, { color: '#160a2e', lit: 'rgba(120,240,255,0.8)', neon: ['#ff4fd8', '#4fe3ff', '#b6ff4f'] }); } },
    // Levels 41-50 (v4): growing baskets.
    { name: 'Hot Air Valley', top: '#87ceeb', bottom: '#f0fff0',
      deco: (g, v) => { mountains(g, v, { color: 'rgba(110,170,110,0.55)' }); clouds(g, v, { size: 0.8 }); hotAirBalloons(g, v); } },
    { name: 'Windmill Fields', top: '#a0d8ef', bottom: '#fdf6d8',
      deco: (g, v) => { sun(g, v, { x: 0.82, y: 0.12, r: 30 }); clouds(g, v, { color: 'rgba(255,255,255,0.75)' }); windmills(g, v); } },
    { name: 'Castle in the Clouds', top: '#f7a8d8', bottom: '#fde2f3',
      deco: (g, v) => { sparkles(g, v, { count: 20, color: '255,255,255' }); castle(g, v); birds(g, v, { count: 3, color: 'rgba(120,60,110,0.5)' }); } },
    { name: 'Volcano Island', top: '#ff9966', bottom: '#ffe0b2',
      deco: (g, v) => { volcano(g, v); sea(g, v, { color: '#1b98b5', level: 0.82 }); } },
    { name: 'Rocket Launch', top: '#1d2b64', bottom: '#f8cdda',
      deco: (g, v) => { stars(g, v, { count: 35, alpha: 0.8 }); rocket(g, v); } },
    { name: 'Iceberg Bay', top: '#a8e6f0', bottom: '#effcff',
      deco: (g, v) => { snow(g, v, { count: 30 }); icebergs(g, v); sea(g, v, { color: '#3aa6c4', foam: 'rgba(255,255,255,0.7)', level: 0.8 }); } },
    { name: 'Sweetheart Sky', top: '#ff8fab', bottom: '#ffe5ec',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(255,240,245,0.8)' }); hearts(g, v); } },
    { name: 'Zeppelin Skies', top: '#5d9cec', bottom: '#dbe9fb',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(255,255,255,0.85)', size: 1.2 }); zeppelin(g, v); birds(g, v, { count: 3 }); } },
    { name: 'Jungle Rain', top: '#2d6a4f', bottom: '#95d5b2',
      deco: (g, v) => { treeline(g, v, { color: '#1b4332', height: 0.3 }); mist(g, v); rain(g, v, { count: 50, color: 'rgba(220,255,230,0.5)' }); } },
    { name: 'Glacier Glow', top: '#03122b', bottom: '#14506b',
      deco: (g, v) => { stars(g, v, { count: 45 }); aurora(g, v); mountains(g, v, { color: '#2a4d69', snowCap: true }); } },
    // Levels 51-60 (v5): sleepy baskets.
    { name: 'Counting Sheep', top: '#283c86', bottom: '#8e9eab',
      deco: (g, v) => { stars(g, v, { count: 30, alpha: 0.7 }); crescent(g, v); sheep(g, v); } },
    { name: 'Owl Woods', top: '#14213d', bottom: '#3d5a80',
      deco: (g, v) => { stars(g, v, { count: 25, alpha: 0.6 }); moon(g, v, { x: 0.2, y: 0.15, r: 22 }); treeline(g, v, { color: '#0d1b2a', height: 0.25 }); owls(g, v); } },
    { name: 'Tulip Fields', top: '#8fd3fe', bottom: '#fefae0',
      deco: (g, v) => { sun(g, v, { x: 0.2, y: 0.14, r: 30 }); clouds(g, v, { size: 0.9 }); windmills(g, v, { color: 'rgba(240,230,215,0.8)' }); tulips(g, v); } },
    { name: 'Cactus Canyon', top: '#f8961e', bottom: '#ffd6a5',
      deco: (g, v) => { sun(g, v, { x: 0.75, y: 0.2, r: 38, color: '#fff3b0' }); dunes(g, v, { colors: ['#e76f51', '#d35d3e', '#b5452c'] }); cacti(g, v); } },
    { name: 'Mushroom Glade', top: '#3a0ca3', bottom: '#7b6fd6',
      deco: (g, v) => { mist(g, v, { color: '200,190,255', alpha: 0.2 }); treeline(g, v, { color: '#240a5c', height: 0.2 }); mushrooms(g, v); fireflies(g, v, { count: 18, color: '190,255,230' }); } },
    { name: 'Dragonfly Pond', top: '#90e0ef', bottom: '#e9f5db',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(255,255,255,0.7)', size: 0.8 }); sea(g, v, { color: '#52b69a', foam: 'rgba(230,255,240,0.6)', level: 0.84 }); reeds(g, v); dragonflies(g, v); } },
    { name: 'Pumpkin Patch', top: '#3c096c', bottom: '#ff9e00',
      deco: (g, v) => { moon(g, v, { x: 0.7, y: 0.2, r: 30 }); leaves(g, v, { count: 14 }); pumpkins(g, v); } },
    { name: 'Snowman Hill', top: '#bde0fe', bottom: '#f1f8ff',
      deco: (g, v) => { snow(g, v, { count: 70 }); snowmen(g, v); } },
    { name: 'Sleepy Moon', top: '#0b132b', bottom: '#3a506b',
      deco: (g, v) => { stars(g, v, { count: 60 }); crescent(g, v, { x: 0.5, y: 0.3, r: 60 }); clouds(g, v, { color: 'rgba(170,185,220,0.35)', size: 1.2 }); } },
    { name: 'Pillow Clouds', top: '#cdb4db', bottom: '#fff1f8',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(255,255,255,0.92)', size: 1.7, spacing: 110, parallax: 0.5 }); sparkles(g, v, { count: 20, color: '255,255,255' }); } },
    // Levels 61-70 (v6): windy baskets.
    { name: 'Pinwheel Park', top: '#74c0fc', bottom: '#e7f5ff',
      deco: (g, v) => { clouds(g, v, { size: 0.9 }); cloudStreaks(g, v, { color: 'rgba(255,255,255,0.4)', speed: 80 }); pinwheels(g, v); } },
    { name: 'Festival Flags', top: '#ffd6a5', bottom: '#fffbe6',
      deco: (g, v) => { sun(g, v, { x: 0.8, y: 0.2, r: 28 }); bunting(g, v); balloons(g, v); } },
    { name: 'Whirlwind Plains', top: '#e9c46a', bottom: '#fefae0',
      deco: (g, v) => { dunes(g, v, { colors: ['#a7c957', '#8ab33e', '#6a994e'] }); whirlwind(g, v); leaves(g, v, { count: 16 }); } },
    { name: 'Lighthouse Point', top: '#22223b', bottom: '#9a8c98',
      deco: (g, v) => { stars(g, v, { count: 30, alpha: 0.6 }); sea(g, v, { color: '#33415c', foam: 'rgba(220,230,255,0.45)', level: 0.8 }); lighthouse(g, v); } },
    { name: 'Pirate Seas', top: '#48cae4', bottom: '#caf0f8',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(255,255,255,0.8)' }); sea(g, v, { color: '#0077b6', level: 0.8 }); pirateShip(g, v); birds(g, v, { count: 3 }); } },
    { name: 'Palm Beach Breeze', top: '#00b4d8', bottom: '#ffe8a3',
      deco: (g, v) => { sun(g, v, { x: 0.5, y: 0.18, r: 34 }); sea(g, v, { color: '#00a6a6', level: 0.86 }); palmTrees(g, v); } },
    { name: 'Racing Clouds', top: '#4361ee', bottom: '#bde0fe',
      deco: (g, v) => { cloudStreaks(g, v, { speed: 200 }); clouds(g, v, { color: 'rgba(255,255,255,0.7)', size: 1.1 }); birds(g, v, { count: 6, color: 'rgba(20,30,70,0.5)' }); } },
    { name: 'Whale Bay', top: '#5fa8d3', bottom: '#e0fbfc',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(255,255,255,0.75)', size: 0.8 }); sea(g, v, { color: '#1b4965', foam: 'rgba(200,230,255,0.5)', level: 0.8 }); whales(g, v); birds(g, v, { count: 4 }); } },
    { name: 'Gusty Hilltop', top: '#90be6d', bottom: '#f1faee',
      deco: (g, v) => { cloudStreaks(g, v, { color: 'rgba(255,255,255,0.6)', speed: 150 }); windmills(g, v); leaves(g, v, { count: 26 }); } },
    { name: 'Storm Front', top: '#1b263b', bottom: '#5c677d',
      deco: (g, v) => { clouds(g, v, { color: 'rgba(60,70,85,0.9)', size: 1.5, spacing: 130 }); cloudStreaks(g, v, { color: 'rgba(150,160,180,0.4)', speed: 220 }); slantRain(g, v); lightning(g, v); } },
    // The last scene is the endless Master level.
    { name: 'Master Level', top: '#14001f', bottom: '#3d0a2e',
      deco: (g, v) => { nebula(g, v); stars(g, v, { count: 80 }); galaxy(g, v); sparkles(g, v, { count: 40 }); masterGlow(g, v); } },
  ];

  /** A slow golden pulse along the edges for the Master level. */
  function masterGlow(g, v) {
    const a = 0.18 + 0.1 * Math.sin(v.clock * 2);
    for (const [x0, x1] of [[0, 40], [v.W, v.W - 40]]) {
      const grad = g.createLinearGradient(x0, 0, x1, 0);
      grad.addColorStop(0, `rgba(255,200,60,${a})`);
      grad.addColorStop(1, 'rgba(255,200,60,0)');
      g.fillStyle = grad;
      g.fillRect(Math.min(x0, x1), 0, 40, v.H);
    }
  }

  /** Every normal level has its own scene; the Master level (and anything above) has the last one. */
  function theme(level) {
    return THEMES[Math.min(level, THEMES.length) - 1];
  }

  function draw(g, level, view) {
    const t = theme(level);
    const grad = g.createLinearGradient(0, 0, 0, view.H);
    grad.addColorStop(0, t.top);
    grad.addColorStop(1, t.bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, view.W, view.H);
    t.deco(g, view);
  }

  window.EggBackgrounds = { THEMES, theme, draw };
})();
