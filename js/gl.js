/* ============================================================
   Atmosphere — hand-written WebGL2. No libraries.
   A domain-warped smoke field + additive embers, reactive to
   pointer, scroll and (during the Ivy intro) live audio.
   ============================================================ */

const VERT_QUAD = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main(){ gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }`;

const FRAG_SMOKE = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;   // -1..1
uniform float uScroll;  // 0..1 page progress
uniform float uAudio;   // 0..1 live level
uniform float uIvy;     // 0 ambient  →  1 orb
uniform float uOct;     // fbm octaves budget

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.86, 0.5, -0.5, 0.86);
  for (int i = 0; i < 5; i++){
    if (float(i) >= uOct) break;
    v += a * vnoise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p  = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);

  float t   = uTime * 0.045;
  float aud = uAudio;

  // pointer parallax + gentle rise
  vec2 q = p + uMouse * 0.22;
  q.y += t * 0.55 + uScroll * 1.15;

  // domain warp
  vec2 w = vec2(
    fbm(q * 1.15 + vec2(0.0, t)),
    fbm(q * 1.15 + vec2(4.7, 2.1) - t * 0.8)
  );
  float n = fbm(q * 1.45 + w * (1.55 + aud * 0.55));

  float r = length(p * vec2(1.0, 1.12));

  // ambient: dark centre, energy pushed to the frame — and weighted low,
  // so the nav and the wordmark always sit on something close to black.
  float amb = smoothstep(0.30, 1.55, r) * 0.74 + 0.04;
  amb *= mix(1.2, 0.38, uv.y);
  // The atmosphere is a hero moment. Once you're reading, it steps back.
  amb *= mix(1.0, 0.5, smoothstep(0.02, 0.20, uScroll));
  // ivy: a breathing orb, hollowed out — the lyric has to land on black,
  // so the energy lives in the annulus, not the core.
  float orbR = 0.62 + aud * 0.16;
  float orb  = smoothstep(orbR + 0.45, orbR - 0.45, r) * (1.25 + aud * 1.5);
  orb *= smoothstep(0.05, 0.66, r);

  float mask = mix(amb, orb, uIvy);
  float e = pow(max(n, 0.0), 1.45) * mask * (0.85 + aud * 0.75) * mix(1.0, 1.5, uIvy);

  const vec3 cInk    = vec3(0.022, 0.021, 0.026);
  const vec3 cBlood  = vec3(0.42, 0.032, 0.086);
  const vec3 cEmber  = vec3(1.0, 0.34, 0.16);

  vec3 col = mix(cInk, cBlood, smoothstep(0.03, 0.42, e));
  col = mix(col, cEmber, smoothstep(0.40, 0.95, e));

  // ivy rim
  float rim = smoothstep(0.05, 0.0, abs(r - orbR)) * uIvy;
  col += vec3(0.95, 0.09, 0.16) * rim * (0.26 + aud * 0.7);

  // faint horizon glow anchored to the bottom of the viewport
  col += vec3(0.30, 0.02, 0.06) * pow(1.0 - uv.y, 6.5) * (1.0 - uIvy) * 0.22;

  // The site has to stay readable on top of this. Ivy gets the full burn.
  col *= mix(0.60, 1.0, uIvy);

  // dither — kills banding on deep gradients
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.012;

  fragColor = vec4(max(col, 0.0), 1.0);
}`;

const VERT_EMBER = `#version 300 es
precision highp float;
in float aSeed;
uniform float uTime;
uniform float uAudio;
uniform float uPx;
uniform float uScroll;
out float vA;

float h(float n){ return fract(sin(n * 78.233) * 43758.5453); }

void main(){
  float s = aSeed;
  float speed = 0.012 + h(s) * 0.030;
  float x = h(s * 1.73);
  float y = fract(h(s * 3.11) + uTime * speed + uScroll * 0.35);

  x += sin(uTime * 0.28 + s * 6.2831) * 0.035;
  x += cos(uTime * 0.11 + s * 2.7) * 0.02;

  gl_Position = vec4(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = (1.1 + h(s * 5.31) * 2.4) * (1.0 + uAudio * 1.6) * uPx;

  vA = (0.12 + h(s * 7.77) * 0.42)
     * smoothstep(0.0, 0.12, y)
     * smoothstep(1.0, 0.78, y)
     * (0.6 + uAudio * 0.8);
}`;

const FRAG_EMBER = `#version 300 es
precision highp float;
in float vA;
out vec4 fragColor;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.02, d);
  vec3 col = mix(vec3(1.0, 0.30, 0.18), vec3(1.0, 0.82, 0.62), a * a);
  fragColor = vec4(col * a, a * vA);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[gl] shader:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function program(gl, vs, fs) {
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn('[gl] link:', gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

const uni = (gl, p, names) =>
  Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));

export function createAtmosphere(canvas, { reducedMotion = false } = {}) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    desynchronized: true,
  });

  if (!gl) {
    document.body.classList.add('no-gl');
    return { setIvy() {}, setAudio() {}, destroy() {}, ok: false };
  }

  // ── embers ────────────────────────────────────────────────
  const coarse = matchMedia('(pointer: coarse)').matches;
  const EMBERS = coarse ? 70 : 150;
  const seeds = new Float32Array(EMBERS);
  for (let i = 0; i < EMBERS; i++) seeds[i] = (i + 1) * 0.6180339887;

  // Everything below is thrown away by a context loss, so it lives in one
  // rebuildable place. Mobile GPUs drop contexts under memory pressure; without
  // this the atmosphere would go black permanently and never come back.
  let smoke, ember, uS, uE, vao, buf, emptyVao;

  function buildResources() {
    smoke = program(gl, VERT_QUAD, FRAG_SMOKE);
    ember = program(gl, VERT_EMBER, FRAG_EMBER);
    if (!smoke || !ember) return false;

    uS = uni(gl, smoke, ['uRes', 'uTime', 'uMouse', 'uScroll', 'uAudio', 'uIvy', 'uOct']);
    uE = uni(gl, ember, ['uTime', 'uAudio', 'uPx', 'uScroll']);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    const locSeed = gl.getAttribLocation(ember, 'aSeed');
    gl.enableVertexAttribArray(locSeed);
    gl.vertexAttribPointer(locSeed, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    emptyVao = gl.createVertexArray();
    return true;
  }

  if (!buildResources()) {
    document.body.classList.add('no-gl');
    return { setIvy() {}, setAudio() {}, destroy() {}, ok: false };
  }

  // ── state ─────────────────────────────────────────────────
  const state = {
    px: 1,
    w: 0,
    h: 0,
    mx: 0, my: 0,          // eased pointer
    tmx: 0, tmy: 0,        // target pointer
    scroll: 0,
    ivy: 0, ivyT: 0,
    audio: 0, audioT: 0,
    running: true,
    lost: false,
    raf: 0,
    t0: performance.now(),
  };

  // Render below native resolution — the field is low-frequency,
  // so nobody can tell, and it buys a stable 60fps on laptops.
  const SCALE = coarse ? 0.5 : 0.62;
  const OCT = coarse ? 3 : 5;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.px = dpr * SCALE;
    const w = Math.max(1, Math.round(window.innerWidth * state.px));
    const h = Math.max(1, Math.round(window.innerHeight * state.px));
    if (w === state.w && h === state.h) return;
    state.w = canvas.width = w;
    state.h = canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  // pointer
  if (!coarse) {
    addEventListener('pointermove', (e) => {
      state.tmx = (e.clientX / window.innerWidth) * 2 - 1;
      state.tmy = 1 - (e.clientY / window.innerHeight) * 2;
    }, { passive: true });
  }

  // scroll progress
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    state.scroll = max > 0 ? window.scrollY / max : 0;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function paint(t) {
    gl.disable(gl.BLEND);
    gl.useProgram(smoke);
    gl.bindVertexArray(emptyVao);
    gl.uniform2f(uS.uRes, state.w, state.h);
    gl.uniform1f(uS.uTime, t);
    gl.uniform2f(uS.uMouse, state.mx, state.my);
    gl.uniform1f(uS.uScroll, state.scroll);
    gl.uniform1f(uS.uAudio, state.audio);
    gl.uniform1f(uS.uIvy, state.ivy);
    gl.uniform1f(uS.uOct, OCT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(ember);
    gl.bindVertexArray(vao);
    gl.uniform1f(uE.uTime, t);
    gl.uniform1f(uE.uAudio, state.audio);
    gl.uniform1f(uE.uPx, state.px * 2.2);
    gl.uniform1f(uE.uScroll, state.scroll);
    gl.drawArrays(gl.POINTS, 0, EMBERS);
    gl.bindVertexArray(null);
  }

  // Cap the atmosphere to ~60fps. The field drifts at uTime*0.045 — slow enough
  // that 60fps is indistinguishable from 120 — so on a high-refresh display this
  // halves a full-screen fbm draw for no visible change, which is real battery
  // and heat on a phone. The 13.5ms gate is chosen NOT to disturb 60Hz: a 16.7ms
  // frame always clears it, so 60Hz stays 60fps untouched; only 8.3ms (120Hz)
  // frames get halved. The easing coefficients were tuned at 60fps, so pinning
  // the cadence here also keeps parallax/audio easing consistent across refresh
  // rates instead of running faster on 120Hz panels.
  let lastPaint = 0;
  const MIN_FRAME = 13.5;
  function draw(now) {
    state.raf = requestAnimationFrame(draw);
    if (!state.running) return;
    if (now - lastPaint < MIN_FRAME) return;
    lastPaint = now;

    // easing
    state.mx += (state.tmx - state.mx) * 0.045;
    state.my += (state.tmy - state.my) * 0.045;
    state.ivy += (state.ivyT - state.ivy) * 0.06;
    state.audio += (state.audioT - state.audio) * 0.18;

    paint((now - state.t0) / 1000);

    if (reducedMotion) state.running = false; // one frame is enough
  }

  // Reduced motion still deserves the composition — just not the animation.
  // Snap to the target and repaint exactly once.
  function repaintStatic() {
    if (!reducedMotion) return;
    state.ivy = state.ivyT;
    state.audio = state.audioT;
    paint(12.0); // a fixed, pleasant point in the noise field
  }

  state.raf = requestAnimationFrame(draw);

  // preventDefault() is what tells the browser a restore is worth attempting.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    state.running = false;
    state.lost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (!buildResources()) { document.body.classList.add('no-gl'); return; }
    state.lost = false;
    state.w = state.h = 0;              // force resize() to re-apply the viewport
    resize();
    state.running = !document.hidden;
    state.t0 = performance.now();
    if (reducedMotion) { state.running = false; repaintStatic(); }
  });

  document.addEventListener('visibilitychange', () => {
    state.running = !document.hidden && !reducedMotion && !state.lost;
    if (state.running) state.t0 = performance.now() - 1000; // avoid a time jump
  });

  requestAnimationFrame(() => canvas.classList.add('ready'));

  return {
    ok: true,
    setIvy: (v) => { state.ivyT = v; repaintStatic(); },
    setAudio: (v) => { state.audioT = Math.min(1, Math.max(0, v)); },
    destroy() {
      cancelAnimationFrame(state.raf);
      state.running = false;
    },
  };
}
