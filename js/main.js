/* ============================================================
   THE OBSESSN — entry point
   ============================================================ */

import { createAtmosphere } from './gl.js';
import { createIvy } from './ivy.js';
import { splitText, reveals, cursor, magnets, tilts, marquee, nav, parallax, chrome } from './motion.js';

const $ = (s) => document.querySelector(s);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = {
  pre: $('#preloader'),
  preFill: $('#pre-fill'),
  preNum: $('#pre-num'),
  gate: $('#gate'),
  enter: $('#gate-enter'),
  gateSkip: $('#gate-skip'),
  ivy: $('#ivy'),
  shell: $('#shell'),
  canvas: $('#gl-canvas'),
};

// The rewrite renamed two section anchors (#hero -> #top, #about -> #story).
// Links to the old ones exist in the wild — social posts, bookmarks, other
// sites — and would otherwise land at the top with no scroll and no clue why.
// Remap before anything reads location.hash, then scroll on reveal, since the
// browser already gave up trying when the element did not exist at parse time.
const LEGACY_HASH = { '#hero': '#top', '#about': '#story' };
let legacyTarget = null;
if (LEGACY_HASH[location.hash]) {
  legacyTarget = LEGACY_HASH[location.hash];
  history.replaceState(null, '', location.pathname + location.search + legacyTarget);
}

document.body.classList.add('is-locked');
el.shell.setAttribute('inert', '');  // set here, not in markup — see the <noscript> block

/* ---------- atmosphere ---------- */
const atmosphere = createAtmosphere(el.canvas, { reducedMotion: RM });

/* ---------- static chrome (safe to build immediately) ---------- */
splitText();
chrome();

/* ---------- preloader ---------- */
function preload() {
  return new Promise((resolve) => {
    let pct = 0;
    let target = 8;
    let done = false;

    const jobs = [
      // Capped: the display face is ~128 KB and on a slow link waiting for it
      // added seconds to the gate. Since the Impact-based fallback is now
      // metric-matched (see @font-face 'Display Fallback'), a swap costs at
      // most a few pixels on the short line — not worth stalling the entry for.
      Promise.race([fonts(), new Promise((r) => setTimeout(r, 1200))]),
      decode('assets/logo-512.webp'),
      new Promise((r) => setTimeout(r, 420)),
    ];
    const total = jobs.length;
    let finished = 0;
    jobs.forEach((j) =>
      Promise.resolve(j)
        .catch(() => {})
        .then(() => {
          finished++;
          target = 8 + (finished / total) * 92;
        })
    );

    // hard ceiling — a stalled font CDN must never gate the site
    const bail = setTimeout(() => { target = 100; }, 4000);

    const tick = () => {
      pct += (target - pct) * 0.15 + 0.7;
      if (pct > 100) pct = 100;
      const shown = Math.floor(pct);
      el.preNum.textContent = String(shown).padStart(2, '0');
      el.preFill.style.right = `${100 - pct}%`;
      if (pct >= 99.5 && !done) {
        done = true;
        clearTimeout(bail);
        el.preNum.textContent = '100';
        setTimeout(() => {
          el.pre.classList.add('done');
          resolve();
        }, 120);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// The font stylesheet loads async (media="print" until onload), so
// document.fonts.ready can resolve before a single face has been requested.
// Ask for the two faces the gate actually renders in.
function fonts() {
  if (!document.fonts?.load) return Promise.resolve();
  return Promise.all([
    document.fonts.load('700 3rem "Bricolage Grotesque"'),
    document.fonts.load('400 1rem "Geist Mono"'),
  ]).then(() => document.fonts.ready).catch(() => {});
}

function decode(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => (img.decode ? img.decode().then(res, res) : res());
    img.onerror = rej;
    img.src = src;
  });
}

/* ---------- site reveal ---------- */
let revealed = false;
function revealSite() {
  if (revealed) return;
  revealed = true;
  atmosphere.setIvy(0);
  atmosphere.setAudio(0);
  document.body.classList.remove('is-locked');
  el.shell.removeAttribute('inert');
  el.shell.classList.add('live');
  // Both dialogs are dismissed by now, and whatever held the keyboard (#ivy-skip or
  // #gate-skip) went with them — so the browser dumps focus on <body> and a keyboard
  // visitor restarts from the top of the document with nothing announced. Put focus
  // on the shell instead: it is tabindex="-1", so the next Tab still reaches the skip
  // link exactly as before, but the position is ours rather than a fallback.
  // Same reasoning as the drawer's focus return in motion.js.
  el.shell.focus({ preventScroll: true });
  // a remapped legacy anchor needs scrolling by hand — see LEGACY_HASH
  if (legacyTarget && legacyTarget !== '#top') {
    requestAnimationFrame(() => {
      document.querySelector(legacyTarget)?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
  // scroll animations only matter once the page is actually scrollable
  requestAnimationFrame(() => {
    reveals();
    marquee();
    nav();
    tilts();
    magnets();
    parallax();
  });
}

/* ---------- ivy ---------- */
const ivy = createIvy({
  root: el.ivy,
  stage: $('#ivy-stage'),
  meterEl: $('#ivy-meter'),
  stateEl: $('#ivy-state'),
  progressEl: $('#ivy-progress-fill'),
  onLevel: (v) => atmosphere.setAudio(v),
  onEnd: revealSite,
});

// Drop ?ivy=1 once it has done its job, or every subsequent reload replays
// the intro the visitor already sat through.
function clearIvyParam() {
  const url = new URL(location.href);
  // Match the parameter, not the substring — `.includes('ivy')` also fired for
  // ?notivy=1 and ?ivyleague=x, rewriting the URL for no reason.
  if (!url.searchParams.has('ivy')) return;
  url.searchParams.delete('ivy');
  history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
}

function dismissGate() {
  el.gate.classList.add('dismissed');
  setTimeout(() => { el.gate.hidden = true; }, 850);
}

// Ivy is scheduled a beat after the gate starts fading. A visitor who clicks
// Enter and immediately changes their mind lands inside that window, so the
// skip intent has to be durable rather than dropped.
let introTimer = 0;
let introStarted = false;
let skipRequested = false;

function enterWithIvy() {
  sessionStorage.setItem('obsessn:seen', '1');
  clearIvyParam();
  introStarted = true;
  dismissGate();
  atmosphere.setIvy(1);
  introTimer = setTimeout(() => {
    if (skipRequested) return;
    ivy.start();
  }, 380);
}

// Skip, whether or not Ivy has actually appeared yet.
function abortIntro() {
  if (skipRequested) return;
  skipRequested = true;
  clearTimeout(introTimer);
  if (!el.ivy.hidden) {
    ivy.finish();
  } else {
    el.ivy.hidden = true;
    revealSite();
  }
}

function skipToSite() {
  sessionStorage.setItem('obsessn:seen', '1');
  clearIvyParam();
  dismissGate();
  el.ivy.hidden = true;
  setTimeout(revealSite, 420);
}

el.enter?.addEventListener('click', enterWithIvy);
el.gateSkip?.addEventListener('click', skipToSite);

// skipping the intro itself
el.ivy?.addEventListener('click', abortIntro);
addEventListener('keydown', (e) => {
  // Only once the gate has handed over — before that, let the buttons do their
  // own keyboard handling.
  if (!introStarted || revealed) return;
  if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    abortIntro();
  }
});

/* ---------- boot ---------- */
cursor();

// A deep link (theobsessn.com/#music) or ?nointro means they want the site, not the show.
// Same for anyone returning inside the session — nobody sits through an intro twice.
const deepLink = location.hash && location.hash !== '#top';
const params = new URLSearchParams(location.search);
const forceSkip = params.has('nointro');
const forceIntro = params.has('ivy');            // shareable "watch the intro" link
// The spoken intro is OFF the visitor path. Its script ("No genre. No rules. Just raw
// obsession.") was written copy, not the artist's words, and the site is meant to carry
// his Spotify/SoundCloud biography and nothing else. Everyone now lands directly on the
// site; the intro only runs if someone deliberately asks for it with ?ivy=1. The gate,
// ivy.js and ivy-intro.mp3 are left in place so it can be brought back with real words.
const straightIn = !forceIntro;

function openDirect() {
  el.gate.classList.add('dismissed');
  el.gate.hidden = true;
  el.ivy.hidden = true;
  // The display fallback is roughly twice as wide as Bricolage, so swapping it
  // in reflows the whole wordmark. Give the real face a brief head start —
  // capped, so a slow font host can never hold the site hostage.
  Promise.race([fonts(), new Promise((r) => setTimeout(r, 500))]).then(() => {
    el.pre.classList.add('done');
    revealSite();
  });
}

if (straightIn) {
  openDirect();
} else {
  preload().then(() => setTimeout(() => {
    el.gate.classList.add('ready');
    // The gate is role="dialog" aria-modal="true" and it was the only one of the three
    // dialogs here that never took the keyboard — the intro focuses #ivy-skip and the
    // drawer focuses its first link, but this one left focus on <body>, so a screen
    // reader was never told a dialog had opened.
    // Focus the DIALOG, not #gate-enter: Chrome matches :focus-visible on programmatic
    // focus even when the last input was the mouse, so focusing the button painted a
    // bright crimson ring over the designed pill for every pointer visitor. Landing on
    // the container announces the aria-label instead, and Tab still reaches Enter next
    // — exactly the sequence a visitor got before, minus the silence.
    el.gate.focus({ preventScroll: true });
  }, 150));
}

// Replay the intro from the footer
$('#replay-intro')?.addEventListener('click', (e) => {
  e.preventDefault();
  sessionStorage.removeItem('obsessn:seen');
  location.href = `${location.pathname}?ivy=1`;
});
