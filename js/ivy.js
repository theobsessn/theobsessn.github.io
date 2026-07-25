/* ============================================================
   IVY — the cinematic intro.
   Lyrics are cued off real playback time; the visuals are driven
   by a live FFT of the voice, not a canned animation.
   ============================================================ */

// Cue times were derived from the original audio analysis and re-checked against
// a band-passed (280-3600 Hz) envelope of ivy-intro.mp3. The anchors line up to
// within 0.25s and there is no drift.
//
// The intro is FULLY CAPTIONED. An earlier envelope analysis flagged 40.7-43.4s
// and 44.1-47.5s as possible uncaptioned speech because they modulate at
// speech-like rates (3-8 Hz). That was wrong — the mp3's own `lyrics-eng` tag
// showed the script ends at "Let me show you everything." followed by an
// echoing ambient outro, which modulates the same way. Read metadata before
// trusting signal analysis.
//
// The full script, transcribed from that tag before the file's metadata was
// stripped (the tagged original remains in git history):
//
//   [Atmospheric dark synth intro, deep bass rumble]
//   [Female Spoken Word, Breathy, Intimate]
//     Hello…  [Pause]  I'm Ivy.  [Short Pause]
//     I'll be your guide tonight.
//   [Cinematic dark synth swell] [Seductive Whisper]
//     Welcome to the world of…
//   [Heavy bass drop]
//     The Obsession.                  <- rendered as the brand spelling, "The Obsessn"
//   [Minimalist pulsing heartbeat synth] [Spoken Word, Confident and low]
//     No genre.  No rules.  [Pause]  Just raw obsession.
//   [Dark synth drone building up] [Breathy, Close to mic]
//     Stay.  [Pause]  Let me show you everything.
//   [Echoing fade out, dark ambient outro]
//
// Cross-checked against that structure: 10 spoken lines in the same order, and
// all 5 `text: null` clears land on the script's own section breaks. The one
// asymmetry is deliberate and original — the script marks [Pause] both between
// "No rules." / "Just raw obsession." and between "Stay." / "Let me show you
// everything.", but only the first has a clear. "Stay." is left on screen for
// its 3.1s instead, which suits a one-word line. Note that showLine() calls
// hideLine() first, so lines always replace; a null cue exists purely to buy a
// deliberate blank beat.
//
const CUES = [
  { t: 1.5,  text: 'Hello…' },
  { t: 4.5,  text: "I'm Ivy." },
  { t: 9.4,  text: "I'll be your guide tonight." },
  { t: 14.0, text: null },
  { t: 17.7, text: 'Welcome to the world of…' },
  { t: 22.7, text: 'The Obsessn', accent: true },
  { t: 25.4, text: null },
  { t: 27.4, text: 'No genre.' },
  { t: 29.2, text: 'No rules.' },
  { t: 30.2, text: null },
  { t: 31.2, text: 'Just raw obsession.' },
  { t: 34.0, text: null },
  { t: 35.4, text: 'Stay.' },
  { t: 38.5, text: 'Let me show you everything.' },
  { t: 47.0, text: null },
];

// Fallback only — the real duration comes from audio.duration once metadata
// lands. ivy-intro.mp3 measures 51.76s; 50 used to cut the outro ~1.8s short
// whenever metadata was slow.
const DURATION = 51.8;
const BARS = 56;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createIvy({ root, stage, meterEl, stateEl, progressEl, onLevel, onEnd }) {
  let audio = null;
  let ctx = null;
  let analyser = null;
  let freq = null;
  let raf = 0;
  let finished = false;
  let cueIdx = -1;
  let current = null;
  let fallbackTimers = [];

  // ── meter ────────────────────────────────────────────────
  const bars = [];
  for (let i = 0; i < BARS; i++) {
    const b = document.createElement('i');
    meterEl.appendChild(b);
    bars.push(b);
  }

  function setState(txt) { if (stateEl) stateEl.textContent = txt; }

  // ── lyric rendering ──────────────────────────────────────
  function showLine(cue) {
    hideLine();
    const el = document.createElement('div');
    el.className = 'ivy-line' + (cue.accent ? ' accent' : '');
    // The inner box hugs the text, so a gradient fill lands on the words
    // instead of being stretched across the whole viewport.
    const box = document.createElement('span');
    box.className = 'ivy-words';
    const words = cue.text.split(' ');
    words.forEach((word, i) => {
      const w = document.createElement('span');
      w.className = 'w';
      w.textContent = word;
      w.style.transitionDelay = (i * 0.075).toFixed(3) + 's';
      box.appendChild(w);
      if (i < words.length - 1) box.appendChild(document.createTextNode(' '));
    });
    el.appendChild(box);
    stage.appendChild(el);
    current = el;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  }

  function hideLine() {
    if (!current) return;
    const el = current;
    current = null;
    el.classList.remove('in');
    el.classList.add('out');
    el.querySelectorAll('.w').forEach((w, i) => {
      w.style.transitionDelay = `${i * 0.025}s`;
    });
    setTimeout(() => el.remove(), 700);
  }

  function applyCue(i) {
    const cue = CUES[i];
    if (!cue) return;
    if (cue.text === null) hideLine();
    else showLine(cue);
  }

  // ── audio graph ──────────────────────────────────────────
  function attachAnalyser(el) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      const src = ctx.createMediaElementSource(el);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    } catch {
      analyser = null;
      return false;
    }
  }

  function readLevel() {
    if (!analyser) return null;
    analyser.getByteFrequencyData(freq);
    let sum = 0;
    // voice sits in the lower-mid bins; weight those
    const n = Math.min(freq.length, 64);
    for (let i = 0; i < n; i++) sum += freq[i] * (1 - i / (n * 1.6));
    return Math.min(1, sum / (n * 118));
  }

  let meterPainted = false;
  function paintMeter(level) {
    // Someone who asked for reduced motion should not get 56 bars oscillating
    // for the length of the intro. Draw the waveform once and leave it —
    // "speaking"/"listening" in the badge still carries the state.
    if (REDUCED) {
      if (meterPainted) return;
      meterPainted = true;
      for (let i = 0; i < BARS; i++) {
        const taper = Math.sin((i / (BARS - 1)) * Math.PI) ** 0.6;
        bars[i].style.height = `${(3 + taper * 26).toFixed(1)}px`;
        bars[i].style.opacity = (0.3 + taper * 0.5).toFixed(2);
      }
      return;
    }
    for (let i = 0; i < BARS; i++) {
      let v;
      if (analyser) {
        const bin = Math.floor((i / BARS) * 48) + 1;
        v = (freq[bin] || 0) / 255;
      } else {
        v = 0.35 + Math.sin(performance.now() / 260 + i * 0.42) * 0.3;
      }
      // taper the ends so it reads as a waveform, not a bar chart
      const taper = Math.sin((i / (BARS - 1)) * Math.PI) ** 0.6;
      const h = 3 + v * taper * 52 * (0.45 + level * 1.1);
      bars[i].style.height = `${h.toFixed(1)}px`;
      bars[i].style.opacity = (0.35 + v * 0.65).toFixed(2);
    }
  }

  // ── loop ─────────────────────────────────────────────────
  function tick() {
    raf = requestAnimationFrame(tick);
    if (finished) return;

    const level = readLevel() ?? 0.25;
    if (!REDUCED) onLevel?.(level);
    paintMeter(level);
    setState(level > 0.06 ? 'speaking' : 'listening');

    if (!audio) return;
    const t = audio.currentTime;
    const dur = Number.isFinite(audio.duration) && audio.duration > 1 ? audio.duration : DURATION;
    if (progressEl) progressEl.style.width = `${Math.min(100, (t / dur) * 100)}%`;

    for (let i = CUES.length - 1; i >= 0; i--) {
      if (t >= CUES[i].t && i > cueIdx) { cueIdx = i; applyCue(i); break; }
    }

    if (audio.ended || t >= dur - 0.15) finish();
  }

  // ── text-only fallback ───────────────────────────────────
  let fallbackRunning = false;
  function runFallback() {
    // Both the `error` listener and the load guard can reach here. Without this
    // latch they each start their own timer set and rAF loop, and the two
    // sequences fight — lyrics jump and the progress bar runs backwards.
    if (fallbackRunning || finished) return;
    fallbackRunning = true;
    // If playback was blocked the analyser only ever reports silence —
    // drop it so the meter falls back to its synthetic waveform.
    analyser = null;
    freq = null;
    if (ctx) { try { ctx.close(); } catch {} ctx = null; }
    setState('speaking');
    let acc = 0;
    const spoken = CUES.filter((c) => c.text !== null);
    spoken.forEach((cue, i) => {
      const delay = acc;
      fallbackTimers.push(setTimeout(() => showLine(cue), delay));
      acc += 1200 + cue.text.length * 42;
      if (i === spoken.length - 1) {
        fallbackTimers.push(setTimeout(finish, acc + 900));
      }
    });
    const total = acc + 900;
    const t0 = performance.now();
    const step = () => {
      if (finished) return;
      const p = Math.min(1, (performance.now() - t0) / total);
      if (progressEl) progressEl.style.width = `${p * 100}%`;
      paintMeter(0.4);
      if (!REDUCED) onLevel?.(0.3 + Math.sin(performance.now() / 220) * 0.18);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    fallbackRunning = false;
    fallbackTimers.forEach(clearTimeout);
    fallbackTimers = [];
    hideLine();
    setState('signing off');
    if (audio) { try { audio.pause(); } catch {} }
    if (ctx) { try { ctx.close(); } catch {} }
    onLevel?.(0);
    root.classList.add('done');
    setTimeout(() => { root.hidden = true; }, 1100);
    onEnd?.();
  }

  function start() {
    root.hidden = false;
    setState('connecting');
    // Ivy is a modal takeover; put the keyboard on the way out of it.
    void root.offsetWidth;
    root.querySelector('#ivy-skip')?.focus({ preventScroll: true });

    audio = new Audio('ivy-intro.mp3');
    audio.preload = 'auto';
    audio.volume = 0.95;
    audio.crossOrigin = 'anonymous';

    let launched = false;
    let guard = 0;
    const launch = () => {
      if (launched || finished) return;
      launched = true;
      clearTimeout(guard);
      attachAnalyser(audio);
      audio.play()
        .then(() => { raf = requestAnimationFrame(tick); })
        .catch(() => { audio = null; runFallback(); });
    };

    // Completion must not hinge on rAF alone: a backgrounded tab throttles or
    // stops it, and the intro would then never hand off even after the audio
    // finished. The media element's own event is the reliable signal.
    audio.addEventListener('ended', () => finish(), { once: true });

    // Don't wait for a full buffer on a slow line — `canplay` plus the
    // browser's own streaming is enough, and the guard covers the rest.
    audio.addEventListener('canplaythrough', launch, { once: true });
    audio.addEventListener('canplay', launch, { once: true });
    audio.addEventListener('error', () => {
      launched = true;                 // disarm the guard; it must not re-enter
      clearTimeout(guard);
      audio = null;
      runFallback();
    }, { once: true });

    guard = setTimeout(() => {
      if (launched || finished) return;
      launched = true;
      try { audio.pause(); } catch {}
      audio = null;
      runFallback();
    }, 6000);

    audio.load();
  }

  return { start, finish };
}
