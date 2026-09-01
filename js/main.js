/* ============================================================
   THE OBSESSN — entry point
   ============================================================ */

import { createAtmosphere } from './gl.js';
import { splitText, reveals, cursor, magnets, tilts, nav, parallax, chrome } from './motion.js';

const $ = (s) => document.querySelector(s);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = {
  pre: $('#preloader'),
  preFill: $('#pre-fill'),
  preNum: $('#pre-num'),
  gate: $('#gate'),
  enter: $('#gate-enter'),
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
createAtmosphere(el.canvas, { reducedMotion: RM });

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
  document.body.classList.remove('is-locked');
  el.shell.removeAttribute('inert');
  el.shell.classList.add('live');
  // The gate is dismissed by now and it held the keyboard, so the browser would
  // otherwise dump focus on <body> and a keyboard visitor would restart from the top
  // of the document with nothing announced. Put focus on the shell instead: it is
  // tabindex="-1", so the next Tab still reaches the skip link exactly as before, but
  // the position is ours rather than a fallback.
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
    nav();
    tilts();
    magnets();
    parallax();
  });
}

/* ---------- gate ---------- */
function dismissGate() {
  el.gate.classList.add('dismissed');
  setTimeout(() => { el.gate.hidden = true; }, 850);
}

// The gate fades for 850ms; the shell starts crossing in halfway through it, so
// the two dissolve into each other instead of cutting.
function enterSite() {
  sessionStorage.setItem('obsessn:seen', '1');
  dismissGate();
  setTimeout(revealSite, 420);
}

el.enter?.addEventListener('click', enterSite);

/* ---------- boot ---------- */
cursor();

// A deep link (theobsessn.com/#music) or ?nointro means they want the site, not the
// curtain. Same for anyone returning inside the session — the gate is an entrance,
// and you only walk through it once.
const deepLink = location.hash && location.hash !== '#top';
const params = new URLSearchParams(location.search);
const forceSkip = params.has('nointro');
const straightIn = deepLink || forceSkip || !!sessionStorage.getItem('obsessn:seen');

function openDirect() {
  el.gate.classList.add('dismissed');
  el.gate.hidden = true;
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
    // The gate is role="dialog" aria-modal="true" and it used to be the one dialog here
    // that never took the keyboard — the drawer focuses its first link, but this one
    // left focus on <body>, so a screen reader was never told a dialog had opened.
    // Focus the DIALOG, not #gate-enter: Chrome matches :focus-visible on programmatic
    // focus even when the last input was the mouse, so focusing the button painted a
    // bright crimson ring over the designed pill for every pointer visitor. Landing on
    // the container announces the aria-label instead, and Tab still reaches Enter next
    // — exactly the sequence a visitor got before, minus the silence.
    el.gate.focus({ preventScroll: true });
  }, 150));
}
