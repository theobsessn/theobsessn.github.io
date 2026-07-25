/* ============================================================
   Motion — reveals, cursor, nav, marquee, tilt, counters.
   Everything is IntersectionObserver + rAF. No libraries.
   ============================================================ */

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const COARSE = matchMedia('(pointer: coarse)');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lerp = (a, b, n) => a + (b - a) * n;

/* ---------- split text ---------- */

// background-clip:text cannot survive being split into per-character spans,
// so the gradient is baked per character instead.
// Hold bone white almost to the end, then ignite. A long ramp just makes
// the middle characters look dusty pink.
const TINT_STOPS = [
  [0.00, [244, 239, 233]],
  [0.70, [244, 239, 233]],
  [0.86, [200, 16, 46]],
  [1.00, [255, 90, 45]],
];

function tintAt(t) {
  for (let i = 1; i < TINT_STOPS.length; i++) {
    const [p1, c1] = TINT_STOPS[i - 1];
    const [p2, c2] = TINT_STOPS[i];
    if (t <= p2) {
      const k = p2 === p1 ? 0 : (t - p1) / (p2 - p1);
      return `rgb(${c1.map((c, j) => Math.round(lerp(c, c2[j], k))).join(',')})`;
    }
  }
  return `rgb(${TINT_STOPS[TINT_STOPS.length - 1][1].join(',')})`;
}

export function splitText() {
  $$('[data-split-chars] .ln').forEach((ln) => {
    const text = ln.textContent.trim();
    const tinted = ln.classList.contains('tint');
    const n = Math.max(1, text.length - 1);
    ln.textContent = '';
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch === ' ' ? ' ' : ch;
      s.style.transitionDelay = `${0.35 + i * 0.045}s`;
      if (tinted) s.style.color = tintAt(i / n);
      ln.appendChild(s);
    });
  });

  $$('[data-split-lines]').forEach((el) => {
    const text = el.textContent.trim();
    el.textContent = '';
    const line = document.createElement('span');
    line.className = 'split-line';
    const inner = document.createElement('i');
    inner.textContent = text;
    line.appendChild(inner);
    el.appendChild(line);
  });
}

/* ---------- reveals + counters ---------- */
export function reveals() {
  const targets = $$('[data-reveal], [data-split-lines]');
  if (RM.matches) {
    targets.forEach((el) => el.classList.add('seen'));
    $$('[data-count]').forEach((el) => (el.textContent = el.dataset.count + (el.dataset.suffix || '')));
    return;
  }

  // Markup carries the real numbers so a no-JS visitor sees the truth;
  // zero them only once we know we can animate them back up — and only if the
  // value actually parses, so a malformed data-count keeps its authored text
  // instead of silently becoming 0.
  $$('[data-count]').forEach((el) => {
    if (Number.isFinite(parseFloat(el.dataset.count))) el.textContent = '0';
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('seen');
        io.unobserve(e.target);
        $$('[data-count]', e.target).forEach(countUp);
        if (e.target.matches('[data-count]')) countUp(e.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );
  targets.forEach((el) => io.observe(el));

  // counters that live outside a reveal wrapper
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      countUp(e.target);
      cio.unobserve(e.target);
    });
  }, { threshold: 0.4 });
  $$('[data-count]').forEach((el) => cio.observe(el));
}

const counted = new WeakSet();
function countUp(el) {
  if (counted.has(el)) return;
  counted.add(el);
  const target = parseFloat(el.dataset.count);
  if (!Number.isFinite(target)) return;   // a bad data-count would render "NaN"
  const suffix = el.dataset.suffix || '';
  const dur = 1400;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + (p === 1 ? suffix : '');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- cursor ---------- */
export function cursor() {
  if (COARSE.matches || RM.matches) return;
  const dot = $('.cursor-dot');
  const ring = $('.cursor-ring');
  if (!dot || !ring) return;

  let x = innerWidth / 2, y = innerHeight / 2;
  let rx = x, ry = y;
  let live = false;
  let running = false;

  const loop = () => {
    if (document.hidden) { running = false; return; }  // resumed on visibility/move
    rx = lerp(rx, x, 0.16);
    ry = lerp(ry, y, 0.16);
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    // Idle out once the ring has caught the pointer — the dot tracks instantly and
    // the ring is settled, so there is nothing to animate until the next move.
    // Left running, this was a 60fps rAF plus two style writes for the entire
    // desktop session, including every stretch the pointer sits still (reading).
    if (Math.abs(rx - x) < 0.1 && Math.abs(ry - y) < 0.1) { running = false; return; }
    requestAnimationFrame(loop);
  };
  const kick = () => { if (!running) { running = true; requestAnimationFrame(loop); } };

  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    if (!live) { live = true; rx = x; ry = y; document.body.classList.add('cursor-live'); }
    kick();
  }, { passive: true });

  addEventListener('pointerdown', () => document.body.classList.add('cursor-down'));
  addEventListener('pointerup', () => document.body.classList.remove('cursor-down'));
  addEventListener('pointerleave', () => document.body.classList.remove('cursor-live'));

  const HOVER = 'a, button, [data-tilt], .tag, .era, input, iframe';
  addEventListener('pointerover', (e) => {
    if (e.target.closest?.(HOVER)) document.body.classList.add('cursor-hover');
  }, { passive: true });
  addEventListener('pointerout', (e) => {
    if (e.target.closest?.(HOVER)) document.body.classList.remove('cursor-hover');
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) kick();
  });
}

/* ---------- magnetic buttons ---------- */
export function magnets() {
  if (COARSE.matches || RM.matches) return;
  $$('[data-magnet]').forEach((el) => {
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const run = () => {
      cx = lerp(cx, tx, 0.2);
      cy = lerp(cy, ty, 0.2);
      el.style.translate = `${cx.toFixed(2)}px ${cy.toFixed(2)}px`;
      if (Math.abs(cx - tx) > 0.1 || Math.abs(cy - ty) > 0.1) raf = requestAnimationFrame(run);
      else raf = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(run); };
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) * 0.28;
      ty = (e.clientY - (r.top + r.height / 2)) * 0.38;
      kick();
    });
    el.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  });
}

/* ---------- 3D tilt + spotlight ---------- */
export function tilts() {
  if (COARSE.matches || RM.matches) return;
  $$('[data-tilt]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
      el.style.transform =
        `perspective(900px) rotateY(${(px - 0.5) * 7}deg) rotateX(${(0.5 - py) * 7}deg) translateY(-3px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* ---------- marquee ---------- */
export function marquee() {
  const rail = $('.marquee');
  const track = $('#mq-a');
  if (!rail || !track) return;

  let width = 0;
  const copies = [track];

  const build = () => {
    copies.slice(1).forEach((c) => c.remove());
    copies.length = 1;
    width = track.scrollWidth;
    if (!width) return;
    const need = Math.ceil(innerWidth / width) + 1;
    for (let i = 0; i < need; i++) {
      const c = track.cloneNode(true);
      c.removeAttribute('id');
      c.setAttribute('aria-hidden', 'true');
      rail.appendChild(c);
      copies.push(c);
    }
  };
  build();
  addEventListener('resize', build, { passive: true });

  if (RM.matches) return;

  let offset = 0;
  let last = performance.now();
  let lastY = scrollY;
  let vel = 0;
  let running = false;
  let onScreen = true;

  addEventListener('scroll', () => {
    vel = scrollY - lastY;
    lastY = scrollY;
  }, { passive: true });

  const loop = (now) => {
    if (document.hidden || !onScreen) { running = false; return; }
    const dt = Math.min(48, now - last);
    last = now;
    vel *= 0.9;
    const speed = 0.035 + Math.min(0.22, Math.abs(vel) * 0.0035);
    offset = (offset + dt * speed * 1.6) % (width || 1);
    const skew = Math.max(-6, Math.min(6, vel * 0.14));
    copies.forEach((c) => {
      c.style.transform = `translate3d(${-offset}px,0,0) skewX(${skew.toFixed(2)}deg)`;
    });
    requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || document.hidden || !onScreen) return;
    running = true;
    last = performance.now();             // don't let a pause become one huge dt step
    requestAnimationFrame(loop);
  };

  // Pause the ticker whenever the rail is off-screen — it rewrites a transform on
  // every frame, and there is no reason to recalc style for a band nobody can see
  // while they read the rest of the page. Measured ~120 writes/s off-screen.
  new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting;
    if (onScreen) start();
  }, { rootMargin: '100px' }).observe(rail);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) start();
  });
}

/* ---------- nav ---------- */
export function nav() {
  const bar = $('#nav');
  const pill = $('#nav-pill');
  const links = $$('.nav-link');
  const burger = $('#nav-burger');
  const drawer = $('#drawer');
  const prog = $('#scroll-progress');
  if (!bar) return;

  const movePill = (el) => {
    if (!pill || !el) return;
    pill.style.width = `${el.offsetWidth}px`;
    pill.style.transform = `translateX(${el.offsetLeft}px)`;
    pill.classList.add('on');
  };

  const syncActive = makeSyncActive(links, movePill);

  const active = links.find((l) => l.classList.contains('active'));
  requestAnimationFrame(() => movePill(active || links[0]));
  addEventListener('resize', () => movePill($('.nav-link.active') || links[0]), { passive: true });

  links.forEach((l) => {
    l.addEventListener('pointerenter', () => movePill(l));
    l.addEventListener('pointerleave', () => movePill($('.nav-link.active') || links[0]));
  });

  // burger / drawer
  const drawerLinks = $$('#drawer a');
  let lastFocus = null;

  const setDrawer = (open) => {
    burger?.classList.toggle('open', open);
    drawer?.classList.toggle('open', open);
    burger?.setAttribute('aria-expanded', String(open));
    burger?.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
    drawer?.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('is-locked', open);

    if (open) {
      lastFocus = document.activeElement;
      if (!lastFocus || lastFocus === document.body) lastFocus = burger;
      const active = $('.nav-link.active')?.dataset.sec;
      drawerLinks.forEach((a) =>
        a.classList.toggle('current', a.getAttribute('href') === `#${active}`)
      );
      // The drawer is visibility:hidden until this class lands — flush styles
      // first, or .focus() is a no-op on a still-hidden element.
      void drawer.offsetWidth;
      drawerLinks[0]?.focus({ preventScroll: true });
    } else if (lastFocus) {
      // Restore focus only on a REAL close. `lastFocus` is null unless this drawer
      // was actually opened, and this branch also runs on the init call below —
      // where there is nothing to restore, and doing it anyway had two bugs:
      // on a phone it yanked focus to the burger on page load, and on desktop
      // (burger is display:none) it blurred whatever held focus, erasing the
      // handoff revealSite() makes 25ms earlier and dropping a keyboard visitor
      // back on <body> after the intro.
      const target = document.contains(lastFocus) ? lastFocus : burger;
      if (target && getComputedStyle(target).display !== 'none') target.focus?.();
      // Never leave focus stranded on a link inside the now-hidden drawer — the
      // breakpoint close does exactly that when it hides the burger.
      else if (drawer?.contains(document.activeElement)) document.activeElement.blur();
      lastFocus = null;
    }
  };

  setDrawer(false);
  burger?.addEventListener('click', () => setDrawer(!drawer.classList.contains('open')));

  // Above the mobile breakpoint the burger is display:none. Leaving the drawer
  // open across that boundary traps the visitor behind a full-screen overlay
  // with no visible way out — a tablet rotating portrait→landscape does it.
  const mobileNav = matchMedia('(max-width: 860px)');
  const onBreakpoint = (e) => { if (!e.matches) setDrawer(false); };
  mobileNav.addEventListener?.('change', onBreakpoint);
  drawerLinks.forEach((a) => a.addEventListener('click', () => setDrawer(false)));

  addEventListener('keydown', (e) => {
    if (!drawer?.classList.contains('open')) return;
    if (e.key === 'Escape') { setDrawer(false); return; }
    if (e.key !== 'Tab') return;
    // keep focus inside the drawer while it owns the screen
    const stops = [...drawerLinks, burger].filter(Boolean);
    const i = stops.indexOf(document.activeElement);
    const next = e.shiftKey
      ? stops[(i <= 0 ? stops.length : i) - 1]
      : stops[(i + 1) % stops.length];
    e.preventDefault();
    next?.focus();
  });

  // hide on scroll down, reveal on scroll up
  let lastY = scrollY;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (prog) prog.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      bar.classList.toggle('stuck', y > 40);
      syncActive(y, max);
      if (!drawer?.classList.contains('open')) {
        bar.classList.toggle('hidden', y > lastY + 6 && y > 260);
      }
      lastY = y;
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

}

/* ---------- active section ----------
   Computed from scroll position rather than an IntersectionObserver band:
   the final section never reaches the middle of the viewport, so a band-based
   observer leaves the nav stale for the whole last screen of the page. */
function makeSyncActive(links, movePill) {
  const secs = $$('section[id], header[id]');
  return (y, max) => {
    if (!secs.length || !links.length) return;
    const probe = y + innerHeight * 0.35;
    let current = secs[0];
    for (const sec of secs) if (sec.offsetTop <= probe) current = sec;
    if (max > 0 && y >= max - 4) current = secs[secs.length - 1];
    const link = links.find((l) => l.dataset.sec === current.id);
    if (link && !link.classList.contains('active')) {
      links.forEach((l) => {
        const on = l === link;
        l.classList.toggle('active', on);
        // the visual pill means nothing to a screen reader
        if (on) l.setAttribute('aria-current', 'true');
        else l.removeAttribute('aria-current');
      });
      movePill(link);
    }
  };
}

/* ---------- parallax ---------- */
export function parallax() {
  if (RM.matches) return;
  const items = $$('[data-parallax]').map((el) => ({
    el,
    speed: (() => {                       // `||` would turn an explicit 0 into 0.15
      const v = parseFloat(el.dataset.parallax);
      return Number.isFinite(v) ? v : 0.15;
    })(),
    axis: el.dataset.parallaxAxis || 'y',
    live: false,
  }));
  if (!items.length) return;

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      const it = items.find((i) => i.el === e.target);
      if (it) it.live = e.isIntersecting;
    }),
    { rootMargin: '20% 0px 20% 0px' }
  );
  items.forEach((i) => io.observe(i.el));

  let ticking = false;
  const apply = () => {
    ticking = false;
    const vh = innerHeight;
    for (const it of items) {
      if (!it.live) continue;
      const r = it.el.getBoundingClientRect();
      // -1 (below the fold) → 1 (above it)
      const p = 1 - (r.top + r.height / 2) / (vh / 2 + r.height / 2);
      const d = p * it.speed * 100;
      it.el.style.translate = it.axis === 'x' ? `${d.toFixed(2)}px 0` : `0 ${d.toFixed(2)}px`;
    }
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  apply();
}

/* ---------- misc ---------- */

export function chrome() {
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
}
