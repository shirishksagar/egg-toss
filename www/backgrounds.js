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
