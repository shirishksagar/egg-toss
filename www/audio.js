/*
 * Egg Toss — all sound, synthesized with the Web Audio API (no audio files).
 *
 * Music: a looping, cheerful C-major-pentatonic tune at 112 bpm, played only while the
 * game is running. Effects: toss whoosh, catch pop, Perfect chime, egg crack, a sad
 * trombone (the music ducks under it) and a game-over jingle.
 * The Music and Sounds switches are saved in localStorage; both default to on.
 */
(function () {
  'use strict';

  const KEY_MUSIC = 'eggtoss.music';
  const KEY_SOUNDS = 'eggtoss.sounds';
  const BPM = 112;
  const EIGHTH = 60 / BPM / 2;
  const LOOKAHEAD = 0.12; // seconds of music scheduled ahead

  function loadFlag(key) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? true : v === '1';
    } catch (e) {
      return true;
    }
  }
  function saveFlag(key, on) {
    try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
  }

  let musicOn = loadFlag(KEY_MUSIC);
  let soundsOn = loadFlag(KEY_SOUNDS);

  let ctx = null;
  let master, musicBus, duck, sfxBus, noiseBuffer;
  let session = null;       // { gain, timer, nextTime, step } while music plays
  let tromboneEnd = 0;      // when the sad trombone finishes (for the jingle and ducking)

  function ensureContext() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
      duck = ctx.createGain();
      duck.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.3;
      musicBus.connect(duck);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);

      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  /** One enveloped oscillator note. */
  function tone(dest, { type = 'sine', freq, start, dur, vol = 0.3, attack = 0.01, glideTo = null }) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    return osc;
  }

  /** A burst of filtered noise. */
  function noise(dest, { start, dur, vol = 0.3, type = 'bandpass', freq = 1000, freqTo = null, q = 1 }) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, start);
    if (freqTo) filter.frequency.exponentialRampToValueAtTime(freqTo, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  // ---- Music ---------------------------------------------------------------

  // C major pentatonic (C D E G A) as MIDI notes; null is a rest. 32 eighths = 4 bars.
  const MELODY = [
    72, null, 76, 79, 81, 79, 76, null,
    74, 76, 79, null, 76, 74, 72, null,
    72, 74, 76, 79, 81, null, 84, 81,
    79, 76, 74, 76, 72, null, null, null,
  ];
  // Second half answers the first a little higher, then the whole 64-step loop repeats.
  const MELODY_B = [
    79, null, 81, 84, 81, 79, 76, null,
    81, 79, 76, null, 74, 76, 79, null,
    84, 81, 79, 76, 74, null, 76, 79,
    76, 74, 72, 74, 72, null, null, null,
  ];
  const BASS = [48, 45, 43, 48, 48, 45, 50, 43]; // one root per bar (C A G C / C A D G)

  function scheduleStep(step, t) {
    const bar = Math.floor(step / 8) % 8;
    const inBar = step % 8;
    const tune = step % 64 < 32 ? MELODY : MELODY_B;
    const note = tune[step % 32];
    if (note !== null) {
      tone(session.gain, { type: 'triangle', freq: hz(note), start: t, dur: EIGHTH * 1.6, vol: 0.32 });
      tone(session.gain, { type: 'sine', freq: hz(note + 12), start: t, dur: EIGHTH, vol: 0.05 });
    }
    // Bass on beats 1 and 3, a fifth on beat 2 and 4 for bounce.
    if (inBar % 2 === 0) {
      const root = BASS[bar];
      const bassNote = inBar === 0 || inBar === 4 ? root : root + 7;
      tone(session.gain, { type: 'sine', freq: hz(bassNote - 12), start: t, dur: EIGHTH * 1.8, vol: 0.38 });
    }
    // Light drums: kick on 1 and 3, hi-hat on the off-beats.
    if (inBar === 0 || inBar === 4) {
      tone(session.gain, { type: 'sine', freq: 140, glideTo: 45, start: t, dur: 0.16, vol: 0.45, attack: 0.003 });
    }
    if (inBar % 2 === 1) noise(session.gain, { start: t, dur: 0.05, vol: 0.06, type: 'highpass', freq: 7000 });
  }

  function pump() {
    if (!session) return;
    while (session.nextTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(session.step, session.nextTime);
      session.step += 1;
      session.nextTime += EIGHTH;
    }
  }

  function startMusic() {
    if (!musicOn || session) return;
    if (!ensureContext()) return;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(musicBus);
    session = { gain, nextTime: ctx.currentTime + 0.06, step: 0, timer: null };
    pump();
    session.timer = setInterval(pump, 25);
  }

  function stopMusic() {
    if (!session) return;
    clearInterval(session.timer);
    const { gain } = session;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);
    setTimeout(() => gain.disconnect(), 300);
    session = null;
  }

  // ---- Effects -------------------------------------------------------------

  function sfx(play) {
    if (!soundsOn || !ensureContext()) return;
    play(ctx.currentTime + 0.005);
  }

  function toss() {
    sfx((t) => noise(sfxBus, { start: t, dur: 0.28, vol: 0.35, freq: 350, freqTo: 2600, q: 2 }));
  }

  function catchPop() {
    sfx((t) => {
      tone(sfxBus, { freq: 880, glideTo: 330, start: t, dur: 0.1, vol: 0.5, attack: 0.002 });
      noise(sfxBus, { start: t, dur: 0.04, vol: 0.15, type: 'highpass', freq: 3000 });
    });
  }

  function perfectChime() {
    sfx((t) => {
      [84, 88, 91, 96].forEach((n, i) => {
        tone(sfxBus, { type: 'triangle', freq: hz(n), start: t + i * 0.07, dur: 0.7, vol: 0.22 });
        tone(sfxBus, { type: 'sine', freq: hz(n + 12), start: t + i * 0.07, dur: 0.4, vol: 0.06 });
      });
    });
  }

  function crack() {
    sfx((t) => {
      noise(sfxBus, { start: t, dur: 0.09, vol: 0.6, type: 'highpass', freq: 1800 });
      noise(sfxBus, { start: t + 0.05, dur: 0.07, vol: 0.4, type: 'bandpass', freq: 2600, q: 3 });
      noise(sfxBus, { start: t + 0.11, dur: 0.06, vol: 0.3, type: 'bandpass', freq: 3400, q: 3 });
      tone(sfxBus, { freq: 160, glideTo: 55, start: t, dur: 0.22, vol: 0.5, attack: 0.003 });
    });
  }

  /** The "wah-wah-wah-waaah". Ducks the music while it plays. */
  function sadTrombone() {
    if (!soundsOn || !ensureContext()) return;
    const t = ctx.currentTime + 0.25; // just after the crack
    const notes = [
      { midi: 58, dur: 0.42 }, // Bb
      { midi: 57, dur: 0.42 }, // A
      { midi: 56, dur: 0.42 }, // Ab
      { midi: 55, dur: 1.25 }, // G, long and wobbly
    ];
    let at = t;
    notes.forEach(({ midi, dur }, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(hz(midi), at);
      if (i === notes.length - 1) {
        // Vibrato on the last note.
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 5.5;
        depth.gain.setValueAtTime(0, at);
        depth.gain.linearRampToValueAtTime(hz(midi) * 0.03, at + 0.4);
        lfo.connect(depth);
        depth.connect(osc.frequency);
        lfo.start(at);
        lfo.stop(at + dur + 0.05);
      }
      // The "wah": a low-pass filter that opens and closes on each note.
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 6;
      filter.frequency.setValueAtTime(300, at);
      filter.frequency.exponentialRampToValueAtTime(1600, at + Math.min(0.15, dur * 0.4));
      filter.frequency.exponentialRampToValueAtTime(400, at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.35, at + 0.04);
      g.gain.setValueAtTime(0.35, at + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(filter);
      filter.connect(g);
      g.connect(sfxBus);
      osc.start(at);
      osc.stop(at + dur + 0.05);
      at += dur;
    });
    tromboneEnd = at;

    // Duck the music under the trombone, then bring it back.
    const now = ctx.currentTime;
    duck.gain.cancelScheduledValues(now);
    duck.gain.setValueAtTime(duck.gain.value, now);
    duck.gain.linearRampToValueAtTime(0.18, t);
    duck.gain.setValueAtTime(0.18, tromboneEnd);
    duck.gain.linearRampToValueAtTime(1, tromboneEnd + 0.4);
  }

  /** Short descending tune, played once the trombone has finished. */
  function gameOverJingle() {
    if (!soundsOn || !ensureContext()) return;
    const t = Math.max(ctx.currentTime + 0.05, tromboneEnd + 0.15);
    [79, 76, 74, 72].forEach((n, i) => {
      tone(sfxBus, { type: 'triangle', freq: hz(n), start: t + i * 0.18, dur: 0.3, vol: 0.3 });
    });
    [60, 64, 67, 72].forEach((n) => {
      tone(sfxBus, { type: 'triangle', freq: hz(n), start: t + 0.8, dur: 1.0, vol: 0.12 });
    });
  }

  function setMusic(on) {
    musicOn = on;
    saveFlag(KEY_MUSIC, on);
    if (!on) stopMusic();
  }

  function setSounds(on) {
    soundsOn = on;
    saveFlag(KEY_SOUNDS, on);
  }

  window.EggAudio = {
    unlock: ensureContext,
    startMusic,
    stopMusic,
    toss,
    catchPop,
    perfectChime,
    crack,
    sadTrombone,
    gameOverJingle,
    setMusic,
    setSounds,
    get musicOn() { return musicOn; },
    get soundsOn() { return soundsOn; },
    get musicPlaying() { return session !== null; },
  };
})();
