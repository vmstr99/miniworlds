/* Wonder Deck K-9 — miniature worlds floating above a nine-key isometric deck.
   Each press: a world rises from the key, bursts for ~3 s, settles, then sinks back. No continuity. */
(() => {
'use strict';
if (!window.THREE) { document.getElementById('title').textContent = 'The 3D engine failed to load'; const ld = document.getElementById('loader'); if (ld) { ld.classList.add('fail'); ld.querySelector('span').textContent = 'The 3D engine failed to load. Check your connection and reload.'; } return; }
const T = THREE;
const $ = s => document.querySelector(s);
const TAU = Math.PI * 2, R = Math.random;
const rnd = (a = 1, b) => b === undefined ? R() * a : a + R() * (b - a);
const pick = a => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smooth01 = t => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const easeOutBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const nOf = (perSec, dt) => Math.floor(perSec * dt + R());
const once = (c, k) => c.f[k] ? false : (c.f[k] = 1, true);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DARK = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : DARK.matches; };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
function hsl(h, s, l) { const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; }
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function makeNoise(seed) {
  const r = mulberry32(seed), P = new Uint16Array(512), G = new Float32Array(256), p = [];
  for (let i = 0; i < 256; i++) { p.push(i); G[i] = r() * 2 - 1; }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const hs = (i, j) => G[P[P[i & 255] + (j & 255)]];
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hs(xi, yi), hs(xi + 1, yi), u), lerp(hs(xi, yi + 1), hs(xi + 1, yi + 1), u), v); };
  const fbm = (x, y, o = 5) => { let a = .5, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); n += a; a *= .5; f *= 2.03; } return s / n; };
  const ridge = (x, y, o = 5) => { let a = .5, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { const q = 1 - Math.abs(vn(x * f, y * f)); s += a * q * q; n += a; a *= .5; f *= 2.03; } return s / n; };
  return { vn, fbm, ridge };
}
const colCache = new Map();
function col(hex) { let c = colCache.get(hex); if (!c) { c = new T.Color(hex).convertSRGBToLinear(); colCache.set(hex, c); } return c; }

/* ================= audio ================= */
const AU = { ctx: null, out: null, muted: store.get('k81-muted', false) };
let nbuf = null;
function audio() {
  if (AU.muted) return null;
  try {
    if (!AU.ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      const c = AU.ctx = new C();
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(c.destination);
      AU.out = c.createGain(); AU.out.gain.value = .62; AU.out.connect(comp);
      const len = c.sampleRate * 3, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
      const conv = c.createConvolver(); conv.buffer = ir; const send = c.createGain(); send.gain.value = .34; AU.out.connect(send); send.connect(conv); conv.connect(comp);
    }
    if (AU.ctx.state === 'suspended') AU.ctx.resume();
    return AU.ctx;
  } catch (e) { return null; }
}
function noiseBuf(c) { if (!nbuf) { nbuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return nbuf; }
function tone(f, dur, o = {}) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + (o.when || 0), osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || dur));
  if (o.detune) osc.detune.value = o.detune;
  if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = f * .02; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + .05); }
  const v = o.vol ?? .1, a = o.attack ?? .005;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  osc.connect(g); let last = g;
  if (o.filter) { const fl = c.createBiquadFilter(); fl.type = o.filter; fl.frequency.value = o.ff || 1000; fl.Q.value = o.q || 1; g.connect(fl); last = fl; }
  last.connect(AU.out); osc.start(t); osc.stop(t + dur + .05);
}
function noise(dur, o = {}) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + (o.when || 0), src = c.createBufferSource(); src.buffer = noiseBuf(c); src.loop = true;
  const fl = c.createBiquadFilter(); fl.type = o.filter || 'lowpass'; fl.frequency.setValueAtTime(o.ff || 1000, t);
  if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + dur); fl.Q.value = o.q || .7;
  const g = c.createGain(), v = o.vol ?? .12, a = o.attack ?? .004;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(fl); fl.connect(g); g.connect(AU.out); src.start(t, Math.random()); src.stop(t + dur + .05);
}
const PENTA = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
const CHORDS = { major: [0, 4, 7, 11, 14], minor: [0, 3, 7, 10, 14], sus: [0, 5, 7, 12, 14], lydian: [0, 4, 6, 11, 14] };
function pad(root, kind) { (CHORDS[kind] || CHORDS.major).forEach((s, i) => { const f = root * Math.pow(2, s / 12); tone(f, 6.5, { vol: .018, attack: 1.6, when: i * .08 }); tone(f * 2, 5, { type: 'triangle', vol: .008, attack: 1.6, detune: 7, when: i * .08 }); }); }
const sfx = {
  click() { noise(.016, { filter: 'highpass', ff: 3400, vol: .13 }); tone(190, .07, { to: 68, vol: .16, filter: 'lowpass', ff: 900 }); noise(.08, { filter: 'bandpass', ff: 480, q: 1.3, vol: .1, when: .01 }); tone(2600, .02, { type: 'triangle', vol: .018 }); },
  clack() { noise(.012, { filter: 'highpass', ff: 4400, vol: .07 }); tone(340, .045, { to: 190, vol: .06, filter: 'lowpass', ff: 1500 }); },
  arrive() { noise(.9, { filter: 'bandpass', ff: 300, to: 1800, q: 1.2, vol: .025, attack: .4 }); tone(pick(PENTA) * 2, 1.6, { vol: .022, when: .6 }); },
  depart() { tone(659.25, 1.6, { vol: .025 }); tone(493.88, 2, { vol: .025, when: .3 }); },
  boom(s = 1) { noise(2.2 * s, { ff: 420, to: 50, vol: .45 * Math.min(1, s) }); tone(55, 1.2 * s, { vol: .32, to: 30 }); },
  thump() { noise(.45, { ff: 260, to: 60, vol: .22 }); },
  crackle(s = 1) { for (let i = 0; i < 8; i++) noise(.025, { filter: 'highpass', ff: 3500, vol: .05 * s, when: rnd(.05, .7) }); },
  whistle(f0, f1, d) { tone(f0, d, { to: f1, vol: .07 }); noise(d, { filter: 'bandpass', ff: f0, to: f1, q: 4, vol: .05 }); },
  launch() { tone(rnd(500, 700), .6, { to: rnd(1600, 2200), vol: .022 }); },
  beep(hi) { tone(hi ? 1320 : 880, .12, { type: 'square', vol: .035 }); },
  rumble(d) { noise(d, { ff: 210, to: 60, vol: .5, attack: .3 }); noise(d * .6, { filter: 'highpass', ff: 2500, vol: .05, attack: .2 }); },
  thunder() { noise(.3, { filter: 'highpass', ff: 1200, vol: .14 }); noise(3, { ff: 180, to: 45, vol: .45, attack: .08, when: rnd(.15, .5) }); },
  rain(d) { noise(d, { filter: 'bandpass', ff: 1600, q: .5, vol: .08, attack: .4 }); },
  wind(d) { noise(d, { filter: 'bandpass', ff: 380, to: 1500, q: 2, vol: .13, attack: .7 }); },
  chirp() { const f = rnd(2600, 4200); tone(f, .08, { to: f * 1.3, vol: .009 }); tone(f * 1.1, .06, { to: f * .9, vol: .007, when: .1 }); },
  cascade() { for (let i = 0; i < 18; i++) tone(PENTA[i % 13] * (i >= 13 ? 2 : 1), .8, { type: 'triangle', vol: .045, when: i * .07 }); },
  whale() { tone(170, 2.6, { to: 410, slide: 1.3, vol: .12, attack: .3, filter: 'lowpass', ff: 900 }); tone(330, 2, { to: 170, vol: .08, attack: .3, when: 1.6, filter: 'lowpass', ff: 900 }); },
  splash(s = 1) { noise(.9 * s, { filter: 'lowpass', ff: 2400, to: 400, vol: .28 * Math.min(1, s) }); noise(.3, { filter: 'highpass', ff: 3000, vol: .07 }); },
  shimmer() { [261.63, 329.63, 392, 493.88, 587.33].forEach((f, i) => { tone(f, 5.5, { vol: .032, attack: 1.2, when: i * .12 }); tone(f * 2, 4.5, { vol: .011, attack: 1.5, detune: 8, when: i * .12 }); }); },
  ping() { tone(rnd(1800, 2600), 1, { vol: .03 }); },
  ufo() { tone(420, 3, { to: 900, slide: 1.5, vol: .05, vib: 6 }); tone(70, 3, { type: 'sawtooth', vol: .04, filter: 'lowpass', ff: 300 }); },
  zap() { tone(300, .5, { to: 2400, vol: .05, type: 'sawtooth', filter: 'lowpass', ff: 3000 }); },
  geyser() { noise(2.4, { filter: 'highpass', ff: 900, vol: .15, attack: .25 }); noise(2, { ff: 150, vol: .17, attack: .2 }); },
  gong() { [98, 197.9, 291.1, 399.8].forEach((f, i) => tone(f, 5.5, { vol: .13 / (i + 1) })); },
  bell() { const f = pick(PENTA) * 2; tone(f, 1.8, { vol: .035 }); tone(f * 2.76, .6, { vol: .01 }); },
  kick() { tone(150, .25, { to: 40, vol: .28 }); },
  pluck(f, w = 0) { tone(f, 1.3, { type: 'triangle', vol: .06, when: w }); tone(f * 2, .45, { vol: .018, when: w }); }
};

/* ================= renderer / scene ================= */
const canvas = $('#gl');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const PR_MAX = Math.min(1.5, window.devicePixelRatio || 1); let PR = PR_MAX; renderer.setPixelRatio(PR); // MSAA covers the rest; drops further if frames run slow
renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene(); scene.background = new T.Color('#d9d5cd');
const cam = new T.OrthographicCamera(-1, 1, 1, -1, .1, 200);
const TARGET = new T.Vector3(0, 3.02, 0), CDIR = new T.Vector3(1, .9, 1).normalize(), UP = new T.Vector3(0, 1, 0);
let viewH = 15;
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h; renderer.setSize(w, h, false);
  viewH = Math.max(15.4, 9.8 / a);
  cam.left = -viewH * a / 2; cam.right = viewH * a / 2; cam.top = viewH / 2; cam.bottom = -viewH / 2; cam.updateProjectionMatrix();
}
addEventListener('resize', () => { resize(); if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); } }); resize();
const hemi = new T.HemisphereLight(0xffffff, 0x888888, .8); scene.add(hemi);
const sun = new T.DirectionalLight(0xffffff, .9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 80 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .025; sun.shadow.radius = 6; sun.target.position.set(-1.5, 1, -1.5); scene.add(sun, sun.target);
const pmrem = new T.PMREMGenerator(renderer); let envTex = null;
function setEnv(p) {
  const sc = new T.Scene(), g = new T.SphereGeometry(10, 32, 16), pos = g.attributes.position, cols = [];
  const top = new T.Color(p.sky).multiplyScalar(.42 * (p.dim ?? 1)), bot = new T.Color(p.ground).multiplyScalar(.22 * (p.dim ?? 1));
  for (let i = 0; i < pos.count; i++) { const k = clamp(pos.getY(i) / 10 * .5 + .5, 0, 1), c = bot.clone().lerp(top, Math.pow(k, .7)); cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); sc.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  const sunM = new T.Mesh(new T.SphereGeometry(1.3, 16, 8), new T.MeshBasicMaterial({ color: new T.Color(p.sun).multiplyScalar(1.6 * p.sunI) })); sunM.position.copy(KEYDIR).multiplyScalar(8.5); sc.add(sunM);
  if (p.hor) { const hor = new T.Color(p.hor).multiplyScalar((p.horI || 1) * .55 * (p.dim ?? 1)), cc = []; for (let i = 0; i < pos.count; i++) { const k = clamp(pos.getY(i) / 10 * .5 + .5, 0, 1), cl = k < .5 ? bot.clone().lerp(hor, k / .5) : hor.clone().lerp(top, Math.pow((k - .5) / .5, .6)); cc.push(cl.r, cl.g, cl.b); } g.setAttribute('color', new T.Float32BufferAttribute(cc, 3)); }
  const t = pmrem.fromScene(sc, .03).texture; if (envTex) envTex.dispose(); envTex = t; scene.environment = t; g.dispose();
}
/* sky: a full-screen painted atmosphere behind everything. Gradient by time of day, drifting cloud banks,
   stars, a sun glow, and a glassy sea below the horizon that mirrors the sky (the world floats over it). */
const SKY_FS = 'uniform vec3 uTop,uMid,uHor,uLow,uRoom,uSunC,uGlowC,uFlashC; uniform float uA,uHy,uTime,uStars,uCov,uWind,uAsp,uSunI,uGlowI,uFlashI; uniform vec2 uSun,uGlowP; varying vec2 vUv;' +
  'float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }' +
  'float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y); }' +
  'float fbm(vec2 p){ float s=0.,a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }' +
  'vec3 grad(float y){ vec3 c=mix(uHor,uMid,smoothstep(0.,.32,y)); return mix(c,uTop,smoothstep(.22,1.,y)); }' +
  'void main(){ vec2 uv=vUv; float y=(uv.y-uHy)/max(.05,1.-uHy); vec2 p=vec2(uv.x*uAsp,uv.y);' +
  ' vec3 up=grad(max(y,0.)); float sd=length((uv-uSun)*vec2(uAsp,1.)); up+=uSunC*uSunI*(exp(-sd*sd*30.)*.9+exp(-sd*3.2)*.28);' +
  ' if(uStars>0.){ vec2 g=p*170.; vec2 id=floor(g); float s=h21(id); float tw=.55+.45*sin(uTime*(1.+s*3.)+s*40.); up+=vec3(step(.986,s)*smoothstep(.45,.0,length(fract(g)-.5))*tw)*uStars*smoothstep(0.,.2,y); }' +
  ' vec2 q=vec2(p.x*1.3-uTime*uWind,p.y*4.2); float n=fbm(q+vec2(0.,fbm(q*.55+uTime*.01)*1.6)); float band=smoothstep(.02,.16,y)*smoothstep(1.05,.45,y);' +
  ' float cl=smoothstep(.6-uCov*.3,.86-uCov*.18,n)*band; vec3 cc=mix(uHor,uMid,.35)*1.08+uSunC*uSunI*.25; up=mix(up,cc,cl*.78); up=mix(up,mix(uTop,uHor,.25)*.62,smoothstep(.55,.95,n)*band*cl*uCov*.7);' +
  ' float yr=clamp(-y*(1.-uHy)/max(uHy,.05),0.,1.); float wob=sin(uv.y*260.-uTime*1.1+sin(uv.x*uAsp*9.+uTime*.6)*2.)*.012*(1.-yr);' +
  ' vec3 dn=grad(clamp(yr*.9+wob,0.,1.))*mix(1.,.9,smoothstep(0.,.35,yr)); vec2 ms=vec2(uv.x,2.*uHy-uv.y); float md=length((ms-uSun)*vec2(uAsp*3.,1.)); dn+=uSunC*uSunI*exp(-md*md*14.)*.35*(1.-yr);' +
  ' dn+=uHor*smoothstep(.72,1.,vn(vec2(uv.x*2.5*uAsp,uv.y*120.-uTime*.25)))*.07*(1.-yr); dn=mix(dn,uLow,smoothstep(.05,1.,yr));' +
  ' vec3 c=mix(dn,up,smoothstep(-.22,.14,y));' +
  ' float gd=length((uv-uGlowP)*vec2(uAsp,1.)); c+=uGlowC*uGlowI*(exp(-gd*gd*7.)*.7+exp(-gd*1.8)*.35); c+=uFlashC*uFlashI*(1.-.5*yr);' +
  ' gl_FragColor=vec4(mix(uRoom,c,uA),1.); }';
const SKYU = { uTop: { value: new T.Color() }, uMid: { value: new T.Color() }, uHor: { value: new T.Color() }, uLow: { value: new T.Color() }, uRoom: { value: new T.Color() }, uSunC: { value: new T.Color() }, uGlowC: { value: new T.Color() }, uFlashC: { value: new T.Color(1, 1, 1) },
  uA: { value: 0 }, uHy: { value: .45 }, uTime: { value: 0 }, uStars: { value: 0 }, uCov: { value: 0 }, uWind: { value: .01 }, uAsp: { value: 1 }, uSunI: { value: 0 }, uGlowI: { value: 0 }, uFlashI: { value: 0 }, uSun: { value: new T.Vector2(.2, .7) }, uGlowP: { value: new T.Vector2(.5, .6) } };
const backdrop = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: SKYU, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0); }', fragmentShader: SKY_FS, depthTest: false, depthWrite: false }));
backdrop.renderOrder = -10; backdrop.frustumCulled = false; scene.add(backdrop); let skyA = 0;
scene.fog = new T.Fog(0xffffff, 1e4, 2e4); const _fd = new T.Vector3();
const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.ShadowMaterial({ opacity: .16 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.8; floor.receiveShadow = true; scene.add(floor);


/* ================= camera look: bloom and filmic grade ================= */
let fxBoost = 0, LIN = 0, composer = null, bloomP = null, gradeP = null;
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const GRADE = { uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uExp: { value: 1.16 }, uRes: { value: new T.Vector2(1, 1) } }, vertexShader: QUAD_VS,
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float uTime,uExp; uniform vec2 uRes; varying vec2 vUv;' +
  'vec3 fit(vec3 v){ vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b; }' +
  'vec3 aces(vec3 c){ const mat3 I=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777)); const mat3 O=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602)); c*=uExp/0.6; c=I*c; c=fit(c); c=O*c; return clamp(c,0.,1.); }' +
  'vec3 srgb(vec3 c){ return mix(pow(c,vec3(1./2.4))*1.055-0.055, c*12.92, step(c,vec3(0.0031308))); }' +
  'void main(){ vec2 d=vUv-.5; float r2=dot(d,d); vec2 off=d*r2*.006; vec3 c=vec3(texture2D(tDiffuse,vUv+off).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-off).b); c=srgb(aces(c)); c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,.97); c*=1.0-r2*.5; float n=fract(sin(dot(floor(vUv*uRes)+uTime*61.0,vec2(12.9898,78.233)))*43758.5453); c+=(n-.5)*.03; gl_FragColor=vec4(c,1.0); }' };
function setupFX() {
  if (!T.EffectComposer || !T.RenderPass || !T.ShaderPass || !T.UnrealBloomPass) return;
  try {
    const sz = renderer.getDrawingBufferSize(new T.Vector2()), opts = { type: T.HalfFloatType, format: T.RGBAFormat };
    const rt = renderer.capabilities.isWebGL2 && T.WebGLMultisampleRenderTarget ? new T.WebGLMultisampleRenderTarget(sz.x, sz.y, opts) : new T.WebGLRenderTarget(sz.x, sz.y, opts); if ('samples' in rt) rt.samples = 4;
    composer = new T.EffectComposer(renderer, rt); composer.addPass(new T.RenderPass(scene, cam));
    bloomP = new T.UnrealBloomPass(new T.Vector2(sz.x / 2, sz.y / 2), .42, .22, 2.1); composer.addPass(bloomP);
    gradeP = new T.ShaderPass(GRADE); composer.addPass(gradeP);
    renderer.toneMapping = T.NoToneMapping; LIN = 1; document.body.classList.add('fx');
  } catch (e) { console.error('fx', e); composer = null; }
}
const _pv = new T.Vector3(); const projY = (x, y, z) => (_pv.set(x, y, z).project(cam).y + 1) / 2;
function updateFX() {
  gradeP.uniforms.uRes.value.set(renderer.domElement.width, renderer.domElement.height);
  gradeP.uniforms.uTime.value = REDUCE ? 0 : clock % 10; bloomP.strength = .42 + fxBoost * .7;
}

/* ================= palette / lighting moods ================= */
const NEUTRAL = () => isDark()
  ? { sky: '#c9d2e0', ground: '#2a2522', hemiI: .62, sun: '#ffe9d0', sunI: .78, dir: [-5, 12, -1], dim: 1 }
  : { sky: '#fff6ea', ground: '#8f877a', hemiI: .66, sun: '#fff0dc', sunI: .78, dir: [-5, 12, -1], dim: 1 };
const roomHex = () => isDark() ? '#1c1e21' : '#d9d5cd';
function resolvePal(p) { const room = new T.Color(roomHex()); if (p.tint === 'room') p = { ...p, tint: roomHex() }; if (p.tint) room.lerp(new T.Color(p.tint), .4); room.multiplyScalar(p.dim ?? 1); return { sky: col(p.sky).clone(), ground: col(p.ground).clone(), hi: p.hemiI, sun: col(p.sun).clone(), si: p.sunI, dir: p.dirv ? new T.Vector3(...p.dirv).normalize() : KEYDIR.clone(), room, dimv: p.dim ?? 1 }; }
const KEYDIR = new T.Vector3(-2, 10, 5).normalize();
const pal = resolvePal(NEUTRAL()); let palT = resolvePal(NEUTRAL()), palRate = 2;
function setPal(p, rate) { palT = resolvePal(p); palRate = rate; setEnv(p); }
function updatePal(dt) {
  const f = 1 - Math.exp(-dt * palRate);
  pal.sky.lerp(palT.sky, f); pal.ground.lerp(palT.ground, f); pal.sun.lerp(palT.sun, f); pal.room.lerp(palT.room, f); pal.dir.lerp(palT.dir, f).normalize();
  pal.hi = lerp(pal.hi, palT.hi, f); pal.si = lerp(pal.si, palT.si, f); pal.dimv = lerp(pal.dimv ?? 1, palT.dimv ?? 1, f);
  hemi.color.copy(pal.sky); hemi.groundColor.copy(pal.ground); hemi.intensity = pal.hi * LK + flashLight;
  sun.color.copy(pal.sun); sun.intensity = pal.si * LK; sun.position.copy(pal.dir).multiplyScalar(34).add(sun.target.position);
  scene.background.copy(pal.room); if (LIN) scene.background.convertSRGBToLinear();
}
let flashLight = 0; const LK = .62;
const flashEl = $('#flash');
function flash(color, strength = .5) {
  flashLight = Math.max(flashLight, strength * 1.4);
  if (REDUCE) return;
  flashEl.style.background = `radial-gradient(circle at 50% 38%, ${color}, transparent 72%)`;
  flashEl.animate([{ opacity: strength }, { opacity: 0 }], { duration: 700, easing: 'ease-out' });
}

/* ================= atmosphere: sky palettes per time of day ================= */
const SKYP = [ // top, mid, horizon, low (the mirrored sea under the world), sun glow, sun intensity, stars, sun position [x, height above horizon]
  { top: '#56508f', mid: '#b98fbe', hor: '#f3c2ae', low: '#a9a8d6', sun: '#ffb592', si: .55, stars: 0, sp: [.2, .16] },
  { top: '#3f7cc4', mid: '#95bfe8', hor: '#e6eeee', low: '#aecbe6', sun: '#fff1d6', si: .4, stars: 0, sp: [.74, .62] },
  { top: '#2c2768', mid: '#b4527e', hor: '#ff9a5e', low: '#6f5a98', sun: '#ff8448', si: .8, stars: 0, sp: [.82, .1] },
  { top: '#050817', mid: '#121a3e', hor: '#2e3158', low: '#10152c', sun: '#c8d4ff', si: .22, stars: 1, sp: [.78, .5] }];
const SKY_K = 1.45, skyCur = { top: new T.Color(), mid: new T.Color(), hor: new T.Color(), low: new T.Color(), sun: new T.Color(), si: 0, stars: 0, sx: .2, sy: .2, cov: 0, gi: 0 };
let skyInit = false; const _sc = new T.Color(), _sg = new T.Color();
function skyTarget() {
  const b = SKYP[MOD.time], cl = MOD.clouds, g = [0, .06, .38, .6][cl], dim = [1, .97, .82, .66][cl] * [1, .96, .86, .74][MOD.rain] * SKY_K;
  const grey = col(MOD.time === 3 ? '#191d2a' : '#8d939e'), ov = world && world.dieT === undefined && world.skyOv, out = {};
  ['top', 'mid', 'hor', 'low'].forEach(k => { const c = col(b[k]).clone().lerp(grey, g); if (ov && ov.k > 0) c.lerp(col(ov[k]), ov.k); out[k] = c.multiplyScalar(dim * (ov && ov.k > 0 && ov.lum ? lerp(1, ov.lum, ov.k) : 1)); });
  out.sun = col(b.sun).clone(); out.si = b.si * [1, .8, .3, .12][cl] * (ov && ov.k > 0 ? 1 - ov.k * .8 : 1); out.stars = b.stars * [1, .7, .15, 0][cl]; out.sp = b.sp; out.cov = [.05, .3, .65, .9][cl];
  return out;
}
function updateSky(dt) {
  const tg = skyTarget(), f = skyInit ? 1 - Math.exp(-dt * 1.4) : 1; skyInit = true;
  ['top', 'mid', 'hor', 'low', 'sun'].forEach(k => skyCur[k].lerp(tg[k], f));
  skyCur.si = lerp(skyCur.si, tg.si, f); skyCur.stars = lerp(skyCur.stars, tg.stars, f); skyCur.cov = lerp(skyCur.cov, tg.cov, f);
  const U = SKYU, w = world && world.dieT === undefined ? world : null;
  U.uTop.value.copy(skyCur.top); U.uMid.value.copy(skyCur.mid); U.uHor.value.copy(skyCur.hor); U.uLow.value.copy(skyCur.low); U.uSunC.value.copy(skyCur.sun).multiplyScalar(SKY_K);
  const hy = clamp(projY(WX, HOVER - (w && w.st.depth || DEPTH) * WS * .9, WZ), .12, .8); U.uHy.value = lerp(U.uHy.value, hy, f);
  // aerial perspective: the far side of the island softens into the horizon colour, the near side stays crisp
  if (w) { const cd = _fd.copy(cam.position).sub(tgtV).normalize(), dep = (x, y, z) => { _pv.set(x, y, z); w.group.localToWorld(_pv); return _pv.sub(cam.position).dot(cd) * -1; };
    let n0 = 1e9, n1 = -1e9; for (let q = 0; q < 4; q++) { const d = dep(q & 1 ? 3 : -3, w.water ?? .2, q & 2 ? 3 : -3); n0 = Math.min(n0, d); n1 = Math.max(n1, d); } const hz = w.st.haze ?? .42; scene.fog.near = n0 + (n1 - n0) * .15; scene.fog.far = scene.fog.near + (n1 - n0) * .85 / hz;
    scene.fog.color.copy(skyCur.hor).lerp(skyCur.mid, .25).lerp(scene.background, 1 - skyA); }
  else { scene.fog.near = 1e4; scene.fog.far = 2e4; }
  skyCur.sx = lerp(skyCur.sx, tg.sp[0], f * .5); skyCur.sy = lerp(skyCur.sy, tg.sp[1], f * .5); U.uSun.value.set(skyCur.sx, U.uHy.value + skyCur.sy * (1 - U.uHy.value));
  U.uSunI.value = skyCur.si; U.uStars.value = skyCur.stars; U.uCov.value = skyCur.cov; U.uTime.value = REDUCE ? 0 : clock; U.uWind.value = .004 + [.03, .08, .17, .32][MOD.wind] * .05; U.uAsp.value = innerWidth / innerHeight;
  const gl = w && w.glow; skyCur.gi = lerp(skyCur.gi, gl ? gl.i : 0, 1 - Math.exp(-dt * 6));
  if (gl) { _pv.set(gl.x, gl.y, gl.z); w.group.localToWorld(_pv); _pv.project(cam); U.uGlowP.value.set(_pv.x * .5 + .5, _pv.y * .5 + .5); U.uGlowC.value.copy(col(gl.col || '#ff6a20')); }
  U.uGlowI.value = skyCur.gi; U.uFlashI.value = Math.min(1, flashLight * .22);
  skyA = lerp(skyA, world ? 1 : 0, 1 - Math.exp(-dt * 1.2)); U.uA.value = skyA; U.uRoom.value.copy(scene.background);
}

/* ================= framing: each world has its own composition (zoom, focus, camera elevation) ================= */
const frameCur = { zoom: 1, el: .9 }, tgtV = new T.Vector3(0, 3.02, 0);
let viewHe = 15; const SNAP = new URLSearchParams(location.search).has('snap');
const FR_OV = (() => { const q = new URLSearchParams(location.search).get('fr'); if (!q) return {}; const o = {}; q.split(',').forEach(kv => { const [k, v] = kv.split(':'); o[k] = +v; }); return o; })(); // ?fr=zoom:2.4,el:.5 for tuning
/* Each world is centred on screen from its real silhouette: sampled terrain heights, the slab's base corners and any tall
   objects (c.fpts), turned to the current spin and projected onto the camera's right and up axes. The world sits a little
   above centre so the deck has room below it, at 80% of its hand-tuned zoom, and never larger than the screen allows. */
const VIEW = { zoom: 1, el: 0, drag: false, spinV: 0 }; // touch / mouse: pinch or wheel to zoom, drag to turn and tilt
const FIT_H = .66, FIT_W = .86, RAISE = .075, SIZE_K = .8;
const _rt = new T.Vector3(), _cu2 = new T.Vector3(), _goal = new T.Vector3(), _fw = new T.Vector3();
function updateFraming(dt) {
  const w = world && world.dieT === undefined ? world : null, fr = w ? { ...(w.st.frame || {}), ...FR_OV } : {};
  const nar = clamp((innerWidth / innerHeight - .55) / .75, .3, 1), a = innerWidth / innerHeight;
  const k = SNAP ? 1 : 1 - Math.exp(-dt * (w && w.camRate || 1.3));
  frameCur.el = lerp(frameCur.el, w ? clamp((w.camEl ?? fr.el ?? .9) + VIEW.el, .16, 1.6) : .9, k); CDIR.set(1, frameCur.el, 1).normalize();
  let tz = 1; _goal.copy(TARGET);
  if (w && w.fpts) {
    _rt.set(1, 0, -1).normalize(); _cu2.crossVectors(_rt, _fw.copy(CDIR).negate()).normalize();
    const P = w.fpts, ca = Math.cos(w.spinT), sa = Math.sin(w.spinT); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < P.length; i += 3) { const lx = P[i], lz = P[i + 2], px = WX + WS * (lx * ca + lz * sa), py = HOVER + WS * P[i + 1], pz = WZ + WS * (lz * ca - lx * sa);
      const sx = px * _rt.x + pz * _rt.z, sy = px * _cu2.x + py * _cu2.y + pz * _cu2.z; if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy; }
    const fit = Math.min(FIT_H * viewH / (y1 - y0), FIT_W * viewH * a / (x1 - x0)), hand = (1 + ((fr.zoom ?? 1.8) - 1) * nar) * SIZE_K;
    tz = Math.min(hand, fit) * (w.camZoom ? w.camZoom / (fr.zoom || 1.8) : 1) * VIEW.zoom;
    _goal.copy(_rt).multiplyScalar((x0 + x1) / 2).addScaledVector(_cu2, (y0 + y1) / 2 - RAISE * viewH / tz).addScaledVector(CDIR, WX * CDIR.x + HOVER * CDIR.y + WZ * CDIR.z);
    if (w.camLift !== undefined) _goal.y += w.camLift - (fr.lift ?? 0);
  }
  frameCur.zoom = lerp(frameCur.zoom, tz, k); tgtV.lerp(_goal, k);
  viewHe = viewH / frameCur.zoom;
  cam.left = -viewHe * a / 2; cam.right = viewHe * a / 2; cam.top = viewHe / 2; cam.bottom = -viewHe / 2; cam.updateProjectionMatrix();
  frameCur.deck = lerp(frameCur.deck ?? 1, w ? (w.camDeck ?? fr.deck ?? 1) : 1, k); frameCur.drop = lerp(frameCur.drop ?? 0, w ? (w.camDrop ?? fr.drop ?? 0) * lerp(.5, 1, (nar - .3) / .7) : 0, k);
  document.body.classList.toggle('zoomed', !!w);
}
const _cu = new T.Vector3(), _tq = new T.Vector3();
const DECK_Q = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, -1).normalize(), .25); // the pad leans ~14° toward the viewer
function dockDeck() { // the deck keeps its on-screen size and sits in front of a zoomed world: foreground, diorama, sky
  const z = frameCur.zoom, s = frameCur.deck / z; deckG.scale.setScalar(s); deckG.quaternion.copy(DECK_Q);
  _cu.setFromMatrixColumn(cam.matrixWorld, 1); _tq.copy(TARGET).applyQuaternion(DECK_Q);
  deckG.position.copy(tgtV).addScaledVector(_tq, -s).addScaledVector(CDIR, Math.max(0, 1 - 1 / z) * 9).addScaledVector(_cu, -frameCur.drop / z);
  deckG.position.addScaledVector(UP, deckB.y * .025 * s); deckG.updateMatrixWorld(true);
}

/* ================= the deck ================= */
function rrShape(w, h, r) { const s = new T.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.2, 'rgba(255,255,255,.45)'); g.addColorStop(.5, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(cv); })();
const blobTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(.45, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(cv); })();
function blob(parent, sx, sz, op = .5) { const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: op, polygonOffset: true, polygonOffsetFactor: -4 })); m.rotation.x = -Math.PI / 2; m.scale.set(sx, sz, 1); m.position.y = .004; m.renderOrder = 1; parent.add(m); return m; }
const SP = 1.85;
const keyGeo = new T.ExtrudeGeometry(rrShape(1.4, 1.4, .3), { depth: .34, bevelEnabled: true, bevelThickness: .1, bevelSize: .09, bevelSegments: 6, curveSegments: 10 });
keyGeo.rotateX(-Math.PI / 2); keyGeo.translate(0, .1, 0);
const baseGeo = new T.ExtrudeGeometry(rrShape(5.9, 5.9, .75), { depth: .5, bevelEnabled: true, bevelThickness: .14, bevelSize: .14, bevelSegments: 6, curveSegments: 12 });
baseGeo.rotateX(-Math.PI / 2); baseGeo.translate(0, -.64, 0);
const KEYCOL = { putty: ['#bdb6aa', '#43464c'], brown: ['#6e4429', '#5e3a23'], rust: ['#b4502a', '#a3482a'], amber: ['#e8842c', '#d9782a'], teal: ['#23968f', '#1f8780'] };
const keyMats = {}; Object.keys(KEYCOL).forEach(k => keyMats[k] = new T.MeshStandardMaterial({ roughness: .55, metalness: 0, envMapIntensity: .3 }));
const baseMat = new T.MeshStandardMaterial({ roughness: .8, envMapIntensity: .3 });
function applyTheme() { if (typeof redrawDecals === 'function') redrawDecals(); const d = isDark() ? 1 : 0; Object.keys(KEYCOL).forEach(k => keyMats[k].color.copy(col(KEYCOL[k][d]))); baseMat.color.copy(col(d ? '#303236' : '#b1aa9e')); setPal(world ? computePal() : NEUTRAL(), 3); }
const _preDeck = new Set(scene.children);
const base = new T.Mesh(baseGeo, baseMat); base.receiveShadow = true; base.castShadow = true; scene.add(base);
['#6e4429', '#b4502a', '#e8842c'].forEach((h, i) => { const m = new T.MeshStandardMaterial({ color: col(h), roughness: .6 }); const a = new T.Mesh(new T.BoxGeometry(4.4, .08, .03), m); a.position.set(0, -.2 - i * .12, 3.1); const b = a.clone(); b.rotation.y = Math.PI / 2; b.position.set(3.1, -.2 - i * .12, 0); scene.add(a, b); });
const NK = 9, keys = [], keyMeshes = [], ledMats = [], kp = new Float32Array(NK), ky = new Float32Array(NK), kv = new Float32Array(NK), kHeld = new Uint8Array(NK), kDownT = new Float32Array(NK).fill(-9), ripT = new Float32Array(NK).fill(-9), deckB = { y: 0, v: 0 }, ledT = new Float32Array(NK).fill(-99), kDist = [];
const ledGeo = new T.CylinderGeometry(.08, .08, .03, 20);
for (let i = 0; i < NK; i++) {
  const r = Math.floor(i / 3), c = i % 3;
  const kind = ({ 2: 'brown', 4: 'amber', 6: 'rust', 8: 'teal' })[i] || 'putty';
  const g = new T.Group(); g.position.set((c - 1) * SP, 0, (r - 1) * SP);
  const m = new T.Mesh(keyGeo, keyMats[kind]); m.castShadow = m.receiveShadow = true; m.userData.i = i; g.add(m);
  const lm = new T.MeshStandardMaterial({ color: col('#4a3c30'), emissive: col('#ff9a3a'), emissiveIntensity: 0, roughness: .3 });
  const led = new T.Mesh(ledGeo, lm); led.position.set(-.48, .555, -.48); g.add(led);
  scene.add(g); keys.push(g); keyMeshes.push(m); ledMats.push(lm); const kb = blob(scene, 1.95, 1.95, .38); kb.position.set(g.position.x + .05, .003, g.position.z + .05); kDist.push(Math.hypot(r - 1, c - 1));
}
const deckG = new T.Group(); scene.children.filter(o => !_preDeck.has(o)).forEach(o => deckG.add(o)); scene.add(deckG);
const keyTop = i => deckG.localToWorld(new T.Vector3((i % 3 - 1) * SP, .58, (Math.floor(i / 3) - 1) * SP));

/* ================= particles ================= */
const PVS = 'attribute vec4 pcolor; attribute float psize; uniform float uScale; varying vec4 vC; void main(){ vC=pcolor; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize=clamp(psize*uScale,1.0,520.0); }';
const PFS = 'uniform float uSoft; uniform float uFade; uniform float uLin; uniform vec3 uTint; varying vec4 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d)*2.0; if(r>1.0) discard; float a=uSoft>1.5?smoothstep(1.0,.62,r):uSoft>0.5?(1.0-r*r)*(1.0-r*r):pow(1.0-r,1.5); vec3 c=uLin>0.5?pow(vC.rgb,vec3(2.2)):vC.rgb; if(uSoft>1.5) c*=.74+.4*(1.0-gl_PointCoord.y)-.12*r; gl_FragColor=vec4(c*uTint, vC.a*a*uFade); }';
class PSys {
  constructor(max, add) {
    this.max = max; this.n = 0; this.jit = 0; this.sc = [0, 0]; this.sv = [0, 0]; this.wx = 0; this.wz = 0;
    this.p = new Float32Array(max * 3); this.cl = new Float32Array(max * 4); this.sz = new Float32Array(max); this.v = new Float32Array(max * 3);
    this.age = new Float32Array(max); this.ttl = new Float32Array(max); this.c = new Float32Array(max * 8); this.s = new Float32Array(max * 2); this.f = new Float32Array(max * 4);
    const g = this.g = new T.BufferGeometry();
    this.aP = new T.BufferAttribute(this.p, 3).setUsage(T.DynamicDrawUsage); this.aC = new T.BufferAttribute(this.cl, 4).setUsage(T.DynamicDrawUsage); this.aS = new T.BufferAttribute(this.sz, 1).setUsage(T.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('pcolor', this.aC); g.setAttribute('psize', this.aS); g.setDrawRange(0, 0);
    this.mat = new T.ShaderMaterial({ uniforms: { uScale: { value: 50 }, uSoft: { value: add ? 0 : 1 }, uFade: { value: 1 }, uLin: { value: LIN }, uTint: { value: new T.Color(1, 1, 1) } }, vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending });
    this.pts = new T.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = add ? 4 : 3;
  }
  emit(x, y, z, vx, vy, vz, ttl, c0, c1, s0, s1, g = 0, drag = 0, sw = 0, pw = 1) {
    if (this.n >= this.max) return; const i = this.n++, i3 = i * 3, i4 = i * 4, i8 = i * 8, jt = R() * this.jit; x += vx * jt; y += vy * jt; z += vz * jt; // spread spawns across the frame
    this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z; this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    this.age[i] = 0; this.ttl[i] = ttl; for (let k = 0; k < 4; k++) { this.c[i8 + k] = c0[k]; this.c[i8 + 4 + k] = c1[k]; }
    this.s[i * 2] = s0; this.s[i * 2 + 1] = s1; this.f[i4] = g; this.f[i4 + 1] = drag; this.f[i4 + 2] = sw; this.f[i4 + 3] = pw; this.sz[i] = 0; this.cl[i4 + 3] = 0;
  }
  kill(i) { const j = --this.n; if (i === j) return; const cp = (a, st) => a.copyWithin(i * st, j * st, j * st + st); cp(this.p, 3); cp(this.v, 3); cp(this.cl, 4); cp(this.c, 8); cp(this.s, 2); cp(this.f, 4); this.sz[i] = this.sz[j]; this.age[i] = this.age[j]; this.ttl[i] = this.ttl[j]; }
  update(dt) {
    this.jit = dt; const { p, v, f, c, cl, sz, s } = this, scx = this.sc[0], scz = this.sc[1], svx = this.sv[0] * dt, svz = this.sv[1] * dt;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt; if (this.age[i] >= this.ttl[i]) { this.kill(i); i--; continue; }
      const i3 = i * 3, i4 = i * 4, i8 = i * 8, dr = Math.max(0, 1 - f[i4 + 1] * dt);
      v[i3] *= dr; v[i3 + 1] = v[i3 + 1] * dr + f[i4] * dt; v[i3 + 2] *= dr;
      p[i3] += (v[i3] + this.wx) * dt; p[i3 + 1] += v[i3 + 1] * dt; p[i3 + 2] += (v[i3 + 2] + this.wz) * dt;
      const sw = f[i4 + 2];
      if (sw) { p[i3] += svx; p[i3 + 2] += svz; const dx = p[i3] - scx, dz = p[i3 + 2] - scz, a = sw * dt, ca = Math.cos(a), sa = Math.sin(a); p[i3] = scx + dx * ca - dz * sa; p[i3 + 2] = scz + dx * sa + dz * ca; }
      const lt = this.age[i] / this.ttl[i], pw = f[i4 + 3], k = pw < 0 ? lt : Math.pow(lt, pw);
      for (let q = 0; q < 4; q++) cl[i4 + q] = c[i8 + q] + (c[i8 + 4 + q] - c[i8 + q]) * k;
      if (pw < 0) cl[i4 + 3] = c[i8 + 3] * Math.min(1, lt * 5, (1 - lt) * 4); else cl[i4 + 3] *= Math.min(1, this.age[i] * 12); sz[i] = s[i * 2] + (s[i * 2 + 1] - s[i * 2]) * lt;
    }
    this.g.setDrawRange(0, this.n); this.aP.needsUpdate = this.aC.needsUpdate = this.aS.needsUpdate = true;
  }
}

/* ================= weather shaders ================= */
const TREE_U = { uTime: { value: 0 }, uWind: { value: .02 } }, CLOUD_U = { uCT: { value: 0 }, uCov: { value: 0 }, uCWind: { value: .1 } };
function addSway(m, k) { m.onBeforeCompile = sh => { sh.uniforms.uTime = TREE_U.uTime; sh.uniforms.uWind = TREE_U.uWind;
  sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n{ float ph = instanceMatrix[3].x*3.1 + instanceMatrix[3].z*2.3; float hgt = max(0.0, position.y); float gust = .55 + .45*sin(uTime*.55 + ph*.4); vec3 wd = vec3((sin(uTime*1.6 + ph)*.3 + gust) * uWind * hgt * ' + k + ', 0.0, cos(uTime*1.2 + ph)*.22 * uWind * hgt * ' + k + '); mat3 im = mat3(instanceMatrix); transformed += vec3(dot(im[0], wd), dot(im[1], wd), dot(im[2], wd)); }\n#endif'); }; }
function addCloudShadow(m) { m.onBeforeCompile = sh => { Object.assign(sh.uniforms, CLOUD_U);
  sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = 'varying vec3 vWP; uniform float uCT, uCov, uCWind;\nfloat ch2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); } float cvn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(ch2(i),ch2(i+vec2(1.,0.)),f.x), mix(ch2(i+vec2(0.,1.)),ch2(i+vec2(1.,1.)),f.x), f.y); }\n' +
    sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n{ vec2 q = vWP.xz*.5 - vec2(uCT*uCWind, uCT*uCWind*.25); float n = cvn(q)*.55 + cvn(q*2.1+7.)*.3 + cvn(q*4.4+3.)*.15; float sh = smoothstep(1.0-uCov, 1.0-uCov+.16, n); reflectedLight.directDiffuse *= 1.0 - sh*.72; reflectedLight.directSpecular *= 1.0 - sh*.85; }'); }; }
const WAMP = [.012, .03, .06, .1];
function waveY(c, x, z) { const A = c.waveA ?? .03, tt = clock * .55; return A * (.55 * Math.sin(x * 2.2 - tt * 1.7) + .3 * Math.sin((x * .8 + z * .6) * 3.4 - tt * 2.3) + .15 * Math.sin((x - z) * 6.5 - tt * 3.4) + .1 * Math.sin(z * 9 + tt * 2.6)); }

/* surface shaders. All detail is computed from object-space position, so it turns with the world on SPIN instead of
   sliding over it. GN: value noise. WAVE: the same swell as waveY(), so boats, walls and the sea surface agree. */
const GN = 'float gh(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }\n' +
  'float gn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(gh(i),gh(i+vec2(1.,0.)),f.x),mix(gh(i+vec2(0.,1.)),gh(i+vec2(1.,1.)),f.x),f.y); }\n';
const WAVE = 'uniform float uWater, uWT, uWA, uWE;\n' +
  'float slosh(float a, float sg, float t){ return .55*sin(a*2.6-t*2.1+sg*1.3)+.35*sin(a*5.9+t*2.7+sg)+.2*sin(a*10.3-t*3.9); }\n' +
  'float wav(vec2 p){ float t=uWT; float w=uWA*(.55*sin(p.x*2.2-t*1.7)+.3*sin((p.x*.8+p.y*.6)*3.4-t*2.3)+.15*sin((p.x-p.y)*6.5-t*3.4)+.1*sin(p.y*9.+t*2.6));\n' +
  ' w += uWE*(smoothstep(2.3,3.2,abs(p.x))*slosh(p.y,sign(p.x),t) + smoothstep(2.3,3.2,abs(p.y))*slosh(p.x,sign(p.y)+2.,t)); return w; }\n';
/* terrain surface detail, from object-space position so it turns with the world. Default: ground mottling, bedding on
   cliffs and a touch of desaturation. A world may ask for a lush tropical surface instead (st.surface = 'tropic'): a
   rainforest canopy of individual crowns on every green surface and pale karst limestone with vertical grooves and rain
   stains on bare cliffs, both bump-lit. UW: submerged ground takes the water's colour and caustics. */
function addTerrainDetail(m, WU, surf) {
  const prev = m.onBeforeCompile, trop = surf === 'tropic'; if (trop) m.extensions = { derivatives: true };
  m.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r);
    sh.vertexShader = 'varying vec3 vLP; varying vec3 vLN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position; vLN = normal;');
    sh.fragmentShader = (trop ? '#define TROPIC\n' : '') + 'varying vec3 vLP; varying vec3 vLN; float tH = 0.;\n' + GN + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ float cliff = 1. - smoothstep(.42, .8, clamp(vLN.y, 0., 1.)); vec2 p = vLP.xz;
#ifdef TROPIC
  float veg = smoothstep(.006, .03, diffuseColor.g - max(diffuseColor.r, diffuseColor.b) * 1.05) * step(.12, vLP.y);
  if (veg > 0.) { vec2 q = vec2(vLP.x + vLP.y * .6, vLP.z - vLP.y * .6) * 10.; vec2 ip = floor(q), fp = fract(q); float md = 9., id = 0.;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 o = vec2(float(i), float(j)), rr = o + vec2(gh(ip + o), gh(ip + o + 7.3)) * .9 - fp; float d = dot(rr, rr); if (d < md) { md = d; id = gh(ip + o + 3.1); } }
    float crown = 1. - smoothstep(.05, .5, md), sub = gn(q * 3.1) * .5 + gn(q * 6.3) * .25;
    vec3 c1 = vec3(.035, .11, .02), c2 = vec3(.06, .19, .03), c3 = vec3(.13, .27, .04), c4 = vec3(.2, .25, .05), cc = mix(c1, c2, smoothstep(.2, .6, id)); cc = mix(cc, c3, step(.72, id)); cc = mix(cc, c4, step(.93, id));
    cc *= (.45 + .75 * crown) * (.85 + .3 * sub); diffuseColor.rgb = mix(diffuseColor.rgb, cc, veg * .92); tH = (crown * .8 + sub * .3) * veg; }
  float rock = (1. - veg) * cliff * step(.18, vLP.y);
  if (rock > 0.) { float al = vLP.x - vLP.z, gr = gn(vec2(al * 30., vLP.y * 1.1)), gr2 = gn(vec2(al * 75., vLP.y * 2.6)), stn = smoothstep(.55, .82, gn(vec2(al * 9., vLP.y * .5)));
    vec3 lime = vec3(.62, .58, .5), orng = vec3(.45, .25, .11), blk = vec3(.06, .055, .05), rc = mix(lime, orng, smoothstep(.55, .78, gn(vec2(al * 5., vLP.y * 1.6 + 3.))) * .85);
    rc = mix(rc, blk, stn * .65); rc *= .72 + .36 * gr + .12 * gr2; diffuseColor.rgb = mix(diffuseColor.rgb, rc, rock * .85); tH += rock * (gr * .7 + gr2 * .3); }
  diffuseColor.rgb *= .92 + .16 * gn(p * 9.1 + 7.);
#else
  float g = gn(p * 4.3) * .45 + gn(p * 9.1 + 7.) * .35 + gn(p * 17. + 3.) * .2;
  float al = vLP.x + vLP.z, bed = gn(vec2(al * 3., vLP.y * 13.)) * .55 + gn(vec2((vLP.x - vLP.z) * 6., vLP.y * 24.)) * .3 + gn(p * 11.) * .15;
  diffuseColor.rgb *= mix(.84 + .32 * g, .7 + .56 * bed, cliff);
  float l = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)); diffuseColor.rgb = mix(vec3(l), diffuseColor.rgb, .9);
#endif
#ifdef UW
  float uw = uWater - vLP.y; if (uw > 0.) { float f = 1. - exp(-uw * 2.6); vec2 cp = vLP.xz * 4.2; float cv = gn(cp + vec2(uWT * .5, uWT * .3)) + gn(cp * 1.7 - vec2(uWT * .35, -uWT * .45)); float ca = pow(clamp(1. - abs(cv - 1.) * 2.4, 0., 1.), 4.);
    diffuseColor.rgb = mix(diffuseColor.rgb * mix(vec3(1.), uShal * 2., .45), uDeep, f * .9); diffuseColor.rgb += uShal * ca * 1.1 * exp(-uw * 3.) * (1. - uDark); }
#endif
}`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef TROPIC
  { vec2 dH = vec2(dFdx(tH), dFdy(tH)) * 1.4; vec3 csx = dFdx(-vViewPosition), csy = dFdy(-vViewPosition), cr1 = cross(csy, normal), cr2 = cross(normal, csx); float cdet = dot(csx, cr1);
    vec3 cgrad = sign(cdet) * (dH.x * cr1 + dH.y * cr2); normal = normalize(abs(cdet) * normal - cgrad); }
#endif`);
    if (WU) { Object.assign(sh.uniforms, WU); sh.fragmentShader = '#define UW\nuniform float uWater, uWT, uDark; uniform vec3 uShal, uDeep;\n' + sh.fragmentShader; } };
  m.customProgramCacheKey = () => 'terrain-detail' + (WU ? '-w' : '') + (trop ? '-t' : ''); return m; }
function addCarving(m) {
  m.extensions = { derivatives: true };
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vLP; varying vec3 vLN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position; vLN = normal;');
    sh.fragmentShader = 'varying vec3 vLP; varying vec3 vLN; float cH; float cAO;\n' + GN +
      'float carve(vec3 p, vec3 n){ vec3 an = abs(n); float vert = 1. - smoothstep(.55, .85, an.y); float u = an.x > an.z ? p.z : p.x, v = p.y;\n' +
      ' vec2 cu = vec2(u * 15., v * 12.), cf = fract(cu) - .5; vec2 ci = floor(cu); float row = mod(ci.y, 4.);\n' +
      ' float panel = smoothstep(.44, .38, max(abs(cf.x), abs(cf.y))); float fig = smoothstep(.24, .15, length(cf * vec2(1.7, .85) - vec2(0., .04))) + smoothstep(.1, .05, length(cf - vec2(0., .3)));\n' +
      ' float fret = (.5 + .5 * sin(u * 70.) * sin(v * 60.)) * .25; float mould = smoothstep(.2, .45, abs(fract(v * 24.) - .5));\n' +
      ' float h = row < .5 ? mould * .6 : (panel * (-.35 + fig * .75 + fret));\n' +
      ' return vert * h + (1. - vert) * (gn(p.xz * 30.) * .15); }\n' +
      sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  cH = carve(vLP, vLN); cAO = 1. - smoothstep(.0, -.35, cH) * .45;
  { float lich = smoothstep(.55, .8, gn(vLP.xz * 3.1 + vLP.y * 1.7) * .6 + gn(vLP.xz * 11. - vLP.y * 4.) * .4) * (.5 + .5 * smoothstep(.4, 1., vLN.y) + .4 * smoothstep(.8, .0, vLP.y));
    vec3 an = abs(vLN); float u = an.x > an.z ? vLP.z : vLP.x; float streak = smoothstep(.6, .85, gn(vec2(u * 22., vLP.y * 1.3))) * (1. - smoothstep(.5, .9, an.y));
    diffuseColor.rgb *= cAO * (.86 + .28 * gn(vLP.xz * 7. + vLP.y * 5.)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.07, .075, .05), lich * .55); diffuseColor.rgb *= 1. - streak * .3; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { vec2 dH = vec2(dFdx(cH), dFdy(cH)) * .9; vec3 csx = dFdx(-vViewPosition), csy = dFdy(-vViewPosition), cr1 = cross(csy, normal), cr2 = cross(normal, csx); float cdet = dot(csx, cr1);
    vec3 cgrad = sign(cdet) * (dH.x * cr1 + dH.y * cr2); normal = normalize(abs(cdet) * normal - cgrad); }`); };
  m.customProgramCacheKey = () => 'carved-stone'; return m; }
function sideMaterial(strata, soil, DP) { // cut walls: one quad strip per edge; the soil band, strata beds and grain are drawn per pixel
  const st8 = []; for (let i = 0; i < 8; i++) st8.push(strata[i % strata.length].clone());
  const U = { uStr: { value: st8 }, uN: { value: strata.length }, uSoil: { value: soil.clone() }, uDP: { value: DP } };
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: .95 });
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute float aTop; varying vec3 vLP; varying float vTop;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position; vTop = aTop;');
    sh.fragmentShader = 'uniform vec3 uStr[8]; uniform vec3 uSoil; uniform float uN, uDP; varying vec3 vLP; varying float vTop;\n' + GN + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ float d = vTop - vLP.y, al = vLP.x + vLP.z;
  float w = (gn(vec2(al * .8, vLP.y * .6)) - .5) * .18 + (gn(vec2(al * 3.2, vLP.y * 2.)) - .5) * .045;
  float yy = (vLP.y + 6. + w) / .13, bi = floor(yy), fb = fract(yy), ix = mod(bi, uN);
  vec3 sc = uStr[0]; for (int q = 1; q < 8; q++) { if (abs(float(q) - ix) < .5) sc = uStr[q]; }
  sc *= 1. - .22 * smoothstep(.86, .98, fb) * step(.45, gh(vec2(bi, 5.)));
  sc *= .86 + .28 * gn(vec2(al * 11., vLP.y * 13.));
  sc *= 1. - .3 * step(.82, gn(vec2(al * 16. + 3., vLP.y * 16.))) * step(.5, gh(vec2(bi, 9.)));
  float sw = (gn(vec2(al * 5., 1.)) - .5) * .03;
  vec3 soil = uSoil * (.82 + .36 * gn(vec2(al * 9., vLP.y * 9.)));
  vec3 cc = mix(diffuseColor.rgb, soil, smoothstep(.024, .036, d + sw * .3));
  cc = mix(cc, sc, smoothstep(.1, .118, d + sw));
  diffuseColor.rgb = cc * (1. - .38 * clamp(d / (vTop + uDP), 0., 1.)); }`); };
  m.customProgramCacheKey = () => 'side-strata'; return m; }
function waterMaterials(c, st) { // the sea surface and the clear water walls share one set of uniforms per world
  const U = c.wU = { uWater: { value: c.water }, uWT: { value: 0 }, uWA: { value: 0 }, uWE: { value: .02 }, uRip: { value: 1 }, uShal: { value: col(st.waterTop || '#4a9aa0').clone() }, uMid: { value: col(st.waterCol || '#1f6f80').clone() }, uDeep: { value: col(st.waterDeep || '#0a2a36').clone() }, uDark: { value: 0 } };
  const head = 'uniform vec3 uShal, uMid, uDeep; uniform float uDark;\n';
  const surf = new T.MeshStandardMaterial({ transparent: true, roughness: .12, metalness: .02, envMapIntensity: .9, depthWrite: false });
  surf.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, CLOUD_U);
    sh.vertexShader = 'attribute float aH; varying float vDep; varying vec3 vLP;\n' + WAVE + sh.vertexShader
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(vec3(-(wav(position.xz + vec2(.03, 0.)) - wav(position.xz - vec2(.03, 0.))) / .06, 1., -(wav(position.xz + vec2(0., .03)) - wav(position.xz - vec2(0., .03))) / .06));')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += wav(position.xz); vLP = transformed; vDep = uWater - aH;');
    sh.fragmentShader = 'varying float vDep; varying vec3 vLP; uniform float uWT, uRip;\n' + head + GN + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec2 p = vLP.xz, g = vec2(0.); float t = uWT; vec2 d1 = vec2(.8, .6), d2 = vec2(-.5, .866), d3 = vec2(.2, -.98), d4 = vec2(-.94, -.33);
  g += d1 * cos(dot(p, d1) * 19. - t * 3.1) * .076; g += d2 * cos(dot(p, d2) * 27. - t * 3.7) * .081; g += d3 * cos(dot(p, d3) * 37. - t * 4.6) * .074; g += d4 * cos(dot(p, d4) * 53. + t * 5.3) * .074;
  g += vec2(gn(p * 9. + t * .4) - .5, gn(p * 9. - t * .35 + 4.) - .5) * .18; normal = normalize(normal + mat3(viewMatrix) * vec3(-g.x, 0., -g.y) * uRip); }`).replace('#include <color_fragment>', `#include <color_fragment>
{ float d = max(vDep, 0.), f = 1. - exp(-d * 2.4);
  vec3 wc = mix(uShal, uMid, smoothstep(0., .55, f)); wc = mix(wc, uDeep, smoothstep(.55, 1., f));
  wc *= 1. + f * (gn(vLP.xz * 1.3 + vec2(uWT * .04, -uWT * .03)) - .5) * .45;
  float foam = (1. - smoothstep(0., .018 + .012 * gn(vLP.xz * 9. + uWT * .3), d)) * (.45 + .55 * gn(vLP.xz * 13. - uWT * .5));
  wc = mix(wc, wc * .18 + vec3(.01, .02, .03), uDark);
  diffuseColor.rgb = mix(wc, vec3(.92, .95, .96) * (1. - uDark * .7), foam * .5);
  diffuseColor.a *= clamp(mix(.28, .86, f) + foam * .55, 0., 1.); }`); };
  surf.customProgramCacheKey = () => 'water-surface';
  const wall = new T.MeshStandardMaterial({ transparent: true, roughness: .25, metalness: 0, depthWrite: false });
  wall.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute float aH; attribute float aTopF; varying vec3 vLP;\n' + WAVE + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y = aTopF > .5 ? max(aH, uWater + wav(position.xz)) : aH; vLP = transformed;');
    sh.fragmentShader = 'varying vec3 vLP;\n' + WAVE + head + GN + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  float wd = uWater + wav(vLP.xz) - vLP.y; if (wd < -.002) discard;
  float d = max(wd, 0.), f = 1. - exp(-d * 2.3), al = vLP.x + vLP.z;
  vec3 wc = mix(uShal, uMid, smoothstep(0., .45, f)); wc = mix(wc, uDeep, smoothstep(.45, 1., f));
  float shaft = smoothstep(.55, .9, gn(vec2((al + d * .75) * 2.4 + uWT * .08, 1.7))) * smoothstep(.55, .9, gn(vec2((al + d * .75) * 5.1 - uWT * .05, 4.2)) + .3);
  wc += uShal * shaft * (1. - f) * .55 * (1. - uDark); wc *= mix(1., .5, smoothstep(.5, 1.5, d));
  float lip = 1. - smoothstep(0., .03, d); wc = mix(wc, uShal * 1.5 + .06, lip * .55);
  wc = mix(wc, wc * .15 + vec3(.005, .01, .02), uDark);
  diffuseColor.rgb = wc; diffuseColor.a *= clamp(mix(.14, .82, f) + lip * .25, 0., 1.);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * .22 * (1. - uDark);'); };
  wall.customProgramCacheKey = () => 'water-wall';
  return { surf, wall };
}

/* ================= world building ================= */
const S = 6.4, NSEG = 100, DEPTH = 1.05, HOVER = 4.4, WX = -3.2, WZ = -3.2, WS = .8, B0 = .75, B1 = 3.9, E = 8.9, END = 10.4;
const _M = new T.Matrix4(), _Q = new T.Quaternion(), _S = new T.Vector3(), _P = new T.Vector3(), ZERO = new T.Matrix4().makeScale(0, 0, 0);
function inst(geo, mat, n, shadow = true) { const m = new T.InstancedMesh(geo, mat, Math.max(1, n)); m.count = n; m.castShadow = shadow; m.receiveShadow = true; return m; }
/* geometry helpers: merge several geometries into one draw call, paint vertex colours, roughen shapes */
function mergeGeo(list) {
  const parts = list.map(g => { const q = g.index ? g.toNonIndexed() : g; if (!q.attributes.normal) q.computeVertexNormals(); return q; });
  let n = 0; parts.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), hasC = parts.every(g => g.attributes.color), cl = hasC ? new Float32Array(n * 3) : null; let o = 0;
  parts.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (hasC) cl.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; });
  const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); if (hasC) out.setAttribute('color', new T.BufferAttribute(cl, 3)); return out;
}
function paint(g, fn) { // fn(x, y, z, nx, ny, nz) -> hex or THREE.Color
  if (g.index) g = g.toNonIndexed(); if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, nr = g.attributes.normal, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i), nr.getX(i), nr.getY(i), nr.getZ(i)), c = typeof v === 'string' ? col(v) : v; a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new T.BufferAttribute(a, 3)); return g;
}
const hash3 = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return v - Math.floor(v); };
function lumpy(g, amt, freq = 40) { // displace vertices radially by a position hash so shared corners stay welded
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (hash3(Math.round(x * freq), Math.round(y * freq), Math.round(z * freq)) - .5) * amt; p.setXYZ(i, x * k, y * k, z * k); }
  g.computeVertexNormals(); return g;
}
function scatter(c, n, test, tries = n * 14) {
  const out = [], m = S / 2 - .14;
  for (let k = 0; k < tries && out.length < n; k++) { const x = rnd(-m, m), z = rnd(-m, m), h = c.hAt(x, z), s = c.slopeAt(x, z); if (c.water != null && h < c.water + .02) continue; if (test(h, s, x, z)) out.push([x, h, z]); }
  return out;
}
/* lit windows on the vertical faces of instanced towers, in the world's own space so they turn with it. Each instance
   carries aWin = (columns per unit, floors per unit, share of warm light, share of lit windows). Some towers light whole
   office floors at a time, a few windows flicker like screens, and the pattern drifts slowly through the night.
   ROUNDWIN wraps the grid around round and octagonal towers. */
function addWindows(m, gain, round, cas) {
  if (round) m.defines = { ROUNDWIN: '' };
  m.onBeforeCompile = sh => { sh.uniforms.uWin = gain; sh.uniforms.uTime = TREE_U.uTime; sh.uniforms.uCas = cas || { value: 99 };
    sh.vertexShader = 'attribute vec4 aWin; varying vec3 vWw; varying vec3 vNw; varying vec4 vWa; varying vec3 vCen;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec4 wp = instanceMatrix * vec4(transformed, 1.0); vWw = wp.xyz; vNw = normalize(mat3(instanceMatrix) * normal); vWa = aWin; vCen = vec3(instanceMatrix[3].x, instanceMatrix[3].z, length(instanceMatrix[0].xyz)); }');
    sh.fragmentShader = 'varying vec3 vWw; varying vec3 vNw; varying vec4 vWa; varying vec3 vCen; uniform float uWin, uTime, uCas;\nfloat wh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 if (abs(vNw.y) < .5) {
   float seed = vCen.x * 13.1 + vCen.y * 7.7;
#ifdef ROUNDWIN
   float u = atan(vWw.z - vCen.y, vWw.x - vCen.x) * vCen.z * .5 * vWa.x;
#else
   float u = dot(vWw, normalize(cross(vec3(0., 1., 0.), vNw))) * vWa.x;
#endif
   float v = vWw.y * vWa.y; vec2 cell = floor(vec2(u, v));
   float g = step(.28, fract(u)) * step(.36, fract(v)) * step(.21, vWw.y);
   float on = step(1. - vWa.w, wh(cell + floor(uTime * .05 + wh(cell) * 7.) * .37 + seed));
   float floors = step(.5, wh(vec2(floor(v), seed) + floor(uTime * .03 + wh(vec2(floor(v), 2.)) * 5.))) * step(.12, wh(cell + seed));
   on = mix(on, floors, step(.62, wh(vec2(seed, 1.7))));
   vec3 wc = mix(vec3(.62, .8, 1.), vec3(1., .72, .4), step(1. - vWa.z, wh(cell + 3.1 + seed)));
   wc *= .65 + .7 * wh(cell + 9.2);
   float tv = step(.985, wh(cell + 5.3)); wc = mix(wc, vec3(.5, .7, 1.) * (.6 + .4 * sin(uTime * 11. + wh(cell) * 40.)), tv);
   float cd = length(vCen.xy + vec2(1.34)), cas = step(cd, uCas) * (1. - step(uCas - .3, cd) * step(.5, wh(cell + floor(uTime * 22.))));
   totalEmissiveRadiance += wc * g * max(on, tv) * cas * uWin * 1.6; }`); }; }
function addTrees(c, pts, o = {}) {
  const kind = o.kind || 'cone'; let cg, tg;
  if (kind === 'cone') { cg = new T.ConeGeometry(.075, .28, 7); cg.translate(0, .22, 0); tg = new T.CylinderGeometry(.013, .018, .1, 5); tg.translate(0, .05, 0); }
  else if (kind === 'round') { cg = new T.IcosahedronGeometry(.09, 1); cg.translate(0, .19, 0); tg = new T.CylinderGeometry(.012, .018, .13, 5); tg.translate(0, .065, 0); }
  else if (kind === 'pine') { // umbrella pine: tall bare trunk, a flat parasol of clustered foliage
    cg = mergeGeo([0, 1, 2, 3, 4, 5, 6].map(k => { const g = lumpy(new T.IcosahedronGeometry(.062, 1), .35, 60); g.scale(1, .36, 1); const a = k / 6 * TAU + .4, r = k ? .066 : 0; g.translate(Math.cos(a) * r, .375 + (k ? -.004 + (k % 2) * .01 : .02), Math.sin(a) * r); return g; }));
    tg = mergeGeo([(() => { const g = new T.CylinderGeometry(.007, .013, .38, 6); g.translate(0, .19, 0); return g; })(), (() => { const g = new T.CylinderGeometry(.004, .006, .09, 5); g.rotateZ(.8); g.translate(.03, .33, 0); return g; })(), (() => { const g = new T.CylinderGeometry(.004, .006, .08, 5); g.rotateZ(-.9); g.translate(-.028, .34, .01); return g; })()]); }
  else if (kind === 'cypress') { cg = lumpy(lathe([[0, 0], [.024, .015], [.036, .08], [.035, .17], [.026, .27], [.012, .35], [0, .39]], 10, true), .18, 70); cg.translate(0, .02, 0); tg = new T.CylinderGeometry(.006, .008, .04, 5); tg.translate(0, .02, 0); }
  else if (kind === 'bush') { cg = lumpy(new T.IcosahedronGeometry(.045, 1), .4, 80); cg.scale(1, .72, 1); cg.translate(0, .026, 0); tg = new T.CylinderGeometry(.003, .005, .02, 4); tg.translate(0, .01, 0); }
  else if (kind === 'palm') { cg = mergeGeo([0, 1, 2, 3, 4, 5, 6, 7].map(k => { const g = new T.ConeGeometry(.016, .16, 3); g.scale(1, 1, .35); g.translate(0, .08, 0); g.rotateZ(-1.9 - (k % 2) * .3); g.rotateY(k / 8 * TAU); g.translate(0, .34, 0); return g; })); tg = new T.CylinderGeometry(.005, .009, .35, 5); tg.translate(0, .175, 0); tg.rotateZ(.06); }
  else { cg = new T.SphereGeometry(.1, 8, 4); cg.scale(1, .3, 1); cg.translate(0, .3, 0); tg = new T.CylinderGeometry(.008, .014, .3, 5); tg.translate(0, .15, 0); }
  const n = pts.length, crown = inst(cg, new T.MeshStandardMaterial({ roughness: .85 }), n), trunk = inst(tg, new T.MeshStandardMaterial({ color: col('#4a3324'), roughness: .9 }), n), tc = new T.Color(); addSway(crown.material, '1.0'); addSway(trunk.material, '0.45');
  pts.forEach(([x, h, z], i) => { const s = rnd(.7, 1.35) * (o.scale || 1); _Q.setFromAxisAngle(UP, rnd(TAU)); _P.set(x, h - .01, z); _S.set(s, s * rnd(.85, 1.3), s); _M.compose(_P, _Q, _S); crown.setMatrixAt(i, _M); trunk.setMatrixAt(i, _M); tc.copy(col(pick(o.colors || ['#2f5a2c', '#3d6b35']))).multiplyScalar(rnd(.8, 1.15)); crown.setColorAt(i, tc); });
  c.group.add(crown, trunk); if (o.stamp !== false) pts.forEach(p => c.stamp(p[0], p[2], .08 * (o.scale || 1), .72));
  const base = pts.map(([x, h, z]) => ({ p: new T.Vector3(x, h - .01, z), s: new T.Vector3(), q: new T.Quaternion() })); for (let i = 0; i < n; i++) { crown.getMatrixAt(i, _M); _M.decompose(base[i].p, base[i].q, base[i].s); }
  const tl = new Float32Array(n), kd = new Float32Array(n), qt = new T.Quaternion(), ax = new T.Vector3(); let act = [];
  const set = { pts, knock(i, d) { if (tl[i]) return; tl[i] = .001; kd[i] = d; act.push(i); noise(.25, { filter: 'bandpass', ff: 700, vol: .02 }); },
    tick(dt) { if (!act.length) return; act = act.filter(i => { tl[i] = Math.min(1, tl[i] + dt * 2.2); ax.set(Math.sin(kd[i]), 0, -Math.cos(kd[i])); qt.setFromAxisAngle(ax, -easeOut(tl[i]) * 1.3).multiply(base[i].q); _M.compose(base[i].p, qt, base[i].s); crown.setMatrixAt(i, _M); trunk.setMatrixAt(i, _M); return tl[i] < 1; }); crown.instanceMatrix.needsUpdate = trunk.instanceMatrix.needsUpdate = true; } };
  c.treeSets.push(set);
  return { crown, trunk, pts, set,
    hide(i) { crown.setMatrixAt(i, ZERO); trunk.setMatrixAt(i, ZERO); crown.instanceMatrix.needsUpdate = trunk.instanceMatrix.needsUpdate = true; },
    tint(hexes) { if (!n) return; pts.forEach((_, i) => { tc.copy(col(pick(hexes))).multiplyScalar(rnd(.85, 1.1)); crown.setColorAt(i, tc); }); crown.instanceColor.needsUpdate = true; } };
}
function addHouses(c, pts, o = {}) {
  const n = pts.length, bg = new T.BoxGeometry(.13, .09, .11); bg.translate(0, .045, 0);
  const rg = new T.ConeGeometry(.105, .075, 4); rg.rotateY(Math.PI / 4); rg.translate(0, .127, 0);
  const body = inst(bg, new T.MeshStandardMaterial({ roughness: .8 }), n), roof = inst(rg, new T.MeshStandardMaterial({ roughness: .75 }), n);
  const win = inst(new T.BoxGeometry(.03, .026, .03), new T.MeshBasicMaterial({ color: col('#ffcc77') }), n * 2, false);
  const tc = new T.Color(), loc = new T.Matrix4();
  pts.forEach(([x, h, z], i) => {
    _Q.setFromAxisAngle(UP, rnd(TAU)); _P.set(x, h - .005, z); _S.set(1, 1, 1); _M.compose(_P, _Q, _S); body.setMatrixAt(i, _M); roof.setMatrixAt(i, _M);
    tc.copy(col(pick(o.colors || ['#d9cbb0', '#c9b8a0', '#e0d6c4']))); body.setColorAt(i, tc); tc.copy(col(pick(o.roofs || ['#7a3a2a', '#5a4a3a', '#3a3a40']))); roof.setColorAt(i, tc);
    [[.02, .045, .055], [.065, .045, -.01]].forEach((off, k) => { loc.makeTranslation(off[0], off[1], off[2]); win.setMatrixAt(i * 2 + k, o.lit === false ? ZERO : _M.clone().multiply(loc)); });
  });
  c.winMats.push(win.material); c.group.add(body, roof, win); pts.forEach(p => c.stamp(p[0], p[2], .12, .62));
  const order = [...Array(n * 2).keys()].sort(() => R() - .5); let offN = 0;
  return { pts, off(fr) { const tgt = Math.floor(clamp(fr, 0, 1) * n * 2); while (offN < tgt) { win.setMatrixAt(order[offN++], ZERO); win.instanceMatrix.needsUpdate = true; } } };
}
function createWorld(st, key) {
  const c = { st, key, t: 0, f: {}, shake: 0, group: new T.Group(), noise: makeNoise((R() * 1e9) | 0), water: st.water ?? null, s: .04 };
  c.keyPos = keyTop(key);
  if (st.pre) st.pre(c);
  const NS = st.nseg || NSEG, DP = st.depth || DEPTH; c.NS = NS;
  const V = NS + 1, cell = S / NS, H = new Float32Array(V * V), n = c.noise;
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) H[j * V + i] = st.height(i / NS * 2 - 1, j / NS * 2 - 1, n, c);
  c.H = H;
  c.hAt = (x, z) => { const fx = clamp((x / S + .5) * NS, 0, NS - .001), fz = clamp((z / S + .5) * NS, 0, NS - .001), i = fx | 0, j = fz | 0, a = fx - i, b = fz - j; return lerp(lerp(H[j * V + i], H[j * V + i + 1], a), lerp(H[(j + 1) * V + i], H[(j + 1) * V + i + 1], a), b); };
  c.slopeAt = (x, z) => { const e = .06; return Math.hypot(c.hAt(x + e, z) - c.hAt(x - e, z), c.hAt(x, z + e) - c.hAt(x, z - e)) / (2 * e); };
  const geo = new T.PlaneGeometry(S, S, NS, NS); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = new Float32Array(V * V * 3), tmp = new T.Color();
  for (let k = 0; k < V * V; k++) {
    const i = k % V, j = (k / V) | 0, h = H[k]; pos.setY(k, h);
    const hl = H[j * V + Math.max(0, i - 1)], hr = H[j * V + Math.min(NS, i + 1)], hu = H[Math.max(0, j - 1) * V + i], hd = H[Math.min(NS, j + 1) * V + i];
    const slope = Math.hypot(hr - hl, hd - hu) / (2 * cell), lap = (hl + hr + hu + hd) / 4 - h, u = i / NS * 2 - 1, v = j / NS * 2 - 1;
    tmp.copy(col(st.color(h, slope, u, v, n, c))); if (c.water != null && h > c.water - .01 && h < c.water + .03) tmp.multiplyScalar(lerp(.78, 1, clamp((h - c.water) / .03, 0, 1))); tmp.multiplyScalar((.88 + .24 * (n.vn(u * 38, v * 38) * .5 + .5)) * clamp(1 - lap * 7, .7, 1.12));
    colors[k * 3] = tmp.r; colors[k * 3 + 1] = tmp.g; colors[k * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new T.BufferAttribute(colors, 3)); geo.computeVertexNormals(); c.geo = geo; c.baseCol = colors.slice(); c.treeSets = []; c.skyG = new T.Group(); scene.add(c.skyG); c.flyG = new T.Group(); c.skyG.add(c.flyG); c.Cn = new PSys(2600, false); c.Cn.mat.uniforms.uSoft.value = 2; c.skyG.add(c.Cn.pts);
  c.stamp = (x, z, r, f) => { const ca = geo.attributes.color, a = ca.array, bc = c.baseCol, i0 = Math.max(0, Math.floor(((x - r) / S + .5) * NS)), i1 = Math.min(NS, Math.ceil(((x + r) / S + .5) * NS)), j0 = Math.max(0, Math.floor(((z - r) / S + .5) * NS)), j1 = Math.min(NS, Math.ceil(((z + r) / S + .5) * NS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot(-S / 2 + i * cell - x, -S / 2 + j * cell - z) / r; if (d > 1) continue; const k = (j * V + i) * 3, m = 1 - (1 - f) * (1 - d * d); for (let q = 0; q < 3; q++) a[k + q] = Math.max(bc[k + q] * .5, a[k + q] * m); }
    ca.needsUpdate = true; };
  const tm = new T.MeshStandardMaterial({ vertexColors: true, roughness: .93, shadowSide: T.DoubleSide }); addCloudShadow(tm); const WM = c.water != null ? waterMaterials(c, st) : null; addTerrainDetail(tm, c.wU, st.surface); nightLift(tm, .5); const terr = new T.Mesh(geo, tm); terr.castShadow = terr.receiveShadow = true; c.group.add(terr);
  // cut-away sides: a two-row strip per edge from the terrain line to the base (strata drawn in the shader), and above any
  // submerged stretch a clear water wall whose lower edge is the exact seabed profile, so land and water meet cleanly
  const lp = [], ln = [], lc = [], lt = [], li = [], wp = [], wh = [], wf = [], wn = [], wi = [];
  [[a => [a, 0], [0, 0, -1], 0], [a => [a, NS], [0, 0, 1], 1], [a => [0, a], [-1, 0, 0], 1], [a => [NS, a], [1, 0, 0], 0]].forEach(([get, nr, flip]) => {
    const b0 = lp.length / 3, w0 = wp.length / 3;
    for (let a = 0; a <= NS; a++) {
      const [i, j] = get(a), k = j * V + i, x = -S / 2 + i * cell, z = -S / 2 + j * cell, h = H[k];
      lp.push(x, h, z, x, -DP, z); ln.push(...nr, ...nr); lt.push(h, h); for (let q = 0; q < 2; q++) lc.push(colors[k * 3], colors[k * 3 + 1], colors[k * 3 + 2]);
      wp.push(x, h, z, x, h, z); wn.push(...nr, ...nr); wh.push(h, h); wf.push(1, 0);
      if (a < NS) { const quad = o => { const t0 = o + a * 2, t1 = t0 + 2; return flip ? [t0, t0 + 1, t1, t1, t0 + 1, t1 + 1] : [t0, t1, t0 + 1, t1, t1 + 1, t0 + 1]; }; li.push(...quad(b0)); wi.push(...quad(w0)); }
    }
  });
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(lp, 3)); sg.setAttribute('normal', new T.Float32BufferAttribute(ln, 3)); sg.setAttribute('color', new T.Float32BufferAttribute(lc, 3)); sg.setAttribute('aTop', new T.Float32BufferAttribute(lt, 1)); sg.setIndex(li);
  const sides = new T.Mesh(sg, nightLift(sideMaterial((st.strata || ['#5a4a3a', '#6a5644', '#4a3c30', '#7a6450']).map(col), col(st.soil || '#3a2a1c'), DP), 1)); sides.castShadow = sides.receiveShadow = true; c.group.add(sides);
  if (c.water != null) {
    const wwg = new T.BufferGeometry(); wwg.setAttribute('position', new T.Float32BufferAttribute(wp, 3)); wwg.setAttribute('normal', new T.Float32BufferAttribute(wn, 3)); wwg.setAttribute('aH', new T.Float32BufferAttribute(wh, 1)); wwg.setAttribute('aTopF', new T.Float32BufferAttribute(wf, 1)); wwg.setIndex(wi);
    c.wwall = new T.Mesh(wwg, WM.wall); c.wwall.renderOrder = 2; c.wwall.frustumCulled = false; c.group.add(c.wwall);
    const wg = new T.PlaneGeometry(S, S, 64, 64); wg.rotateX(-Math.PI / 2); const wpos = wg.attributes.position, ah = new Float32Array(wpos.count);
    for (let q = 0; q < wpos.count; q++) ah[q] = c.hAt(wpos.getX(q), wpos.getZ(q)); wg.setAttribute('aH', new T.BufferAttribute(ah, 1));
    if (st.waterGlow) { WM.surf.emissive = col(st.waterGlow); WM.surf.emissiveIntensity = .6; }
    c.wmesh = new T.Mesh(wg, WM.surf); c.wmesh.position.y = c.water; c.wmesh.receiveShadow = true; c.wmesh.renderOrder = 2; c.wmesh.frustumCulled = false; c.group.add(c.wmesh);
  }
  c.P = new PSys((st.pmax && st.pmax[0]) || 11000, true); c.Sm = new PSys((st.pmax && st.pmax[1]) || 7000, false); c.rings = []; c.G = new PSys(2500, true); c.group.add(c.P.pts, c.Sm.pts, c.G.pts); c.winMats = []; c.spin = c.spinT = 0; c.et = -1;
  c.pl = new T.PointLight(0xff8833, 0, 7, 2); c.group.add(c.pl);
  c.deform = (cx, cz, rad, hf, cf) => {
    const ca = geo.attributes.color, tc = new T.Color();
    for (let k = 0; k < V * V; k++) { const x = pos.getX(k), z = pos.getZ(k), d = Math.hypot(x - cx, z - cz) / rad; if (d > 1.7) continue; H[k] = hf(H[k], d); pos.setY(k, H[k]); const r = cf(d); if (r) { tc.copy(col(r[0])); ca.setXYZ(k, lerp(ca.getX(k), tc.r, r[1]), lerp(ca.getY(k), tc.g, r[1]), lerp(ca.getZ(k), tc.b, r[1])); } }
    pos.needsUpdate = ca.needsUpdate = true; geo.computeVertexNormals();
  };
  // shoreline: land cells touching water, with the seaward direction, for breaking waves
  c.shore = [];
  if (c.water != null) { const stp = Math.max(1, Math.round(NS / 70)), o = stp * 2;
    for (let j = o; j <= NS - o; j += stp) for (let i = o; i <= NS - o; i += stp) { const h = H[j * V + i]; if (h < c.water - .004 || h > c.water + .07) continue;
      const hl = H[j * V + i - o], hr = H[j * V + i + o], hu = H[(j - o) * V + i], hd = H[(j + o) * V + i]; if (Math.min(hl, hr, hu, hd) > c.water - .01) continue;
      const gx = hr - hl, gz = hd - hu, gl = Math.hypot(gx, gz) || 1; c.shore.push({ x: -S / 2 + i * cell, z: -S / 2 + j * cell, nx: -gx / gl, nz: -gz / gl, j: R() * .25, cliff: gl / (2 * o * cell) > 1.2 }); } }
  st.build(c); addAquatic(c);
  { const fp = [], stp = Math.max(1, Math.round(NS / 36)); // silhouette samples for framing: terrain, base corners, tall objects
    for (let j = 0; j <= NS; j += stp) for (let i = 0; i <= NS; i += stp) fp.push(-S / 2 + i * cell, H[j * V + i], -S / 2 + j * cell);
    for (let q = 0; q < 4; q++) fp.push(q & 1 ? S / 2 : -S / 2, -DP, q & 2 ? S / 2 : -S / 2);
    (c.tall || []).forEach(t => fp.push(t[0], t[1], t[2])); c.fpts = new Float32Array(fp); }
  c.group.position.copy(c.keyPos); c.group.scale.setScalar(.04);
  scene.add(c.group);
  return c;
}
/* moonlight: at night the terrain and the cut walls keep a faint cool self-light so the slice still reads in the dark */
const NIGHT_U = { value: 0 };
function nightLift(m, k) { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.uniforms.uNightL = NIGHT_U;
  sh.fragmentShader = 'uniform float uNightL;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(.55, .65, 1.0) * uNightL * ' + k.toFixed(2) + ';'); }; return m; }
function setFade(c, a) {
  [c.group, c.skyG].forEach(G => G && G.traverse(o => { if (!o.isMesh) return; const m = o.material; if (o.userData.op === undefined) o.userData.op = m.opacity; if (!m.transparent) { m.transparent = true; m.needsUpdate = true; } m.opacity = o.userData.op * a; }));
  c.P.mat.uniforms.uFade.value = a; c.Sm.mat.uniforms.uFade.value = a; if (c.Cn) c.Cn.mat.uniforms.uFade.value = a; if (c.aur) c.aur.forEach(m => m.material.uniforms.uF.value = a); c.G.mat.uniforms.uFade.value = (c.glowGain ?? 0) * a;
}
/* underwater life: drifting plankton (points animated on the GPU, faintly bioluminescent at night) and schools of fish
   circling over deep water, biased toward the cut walls where the clear water shows them */
const FISH_GEO = (() => {
  const body = new T.SphereGeometry(.5, 9, 6); body.scale(1, .3, .17);
  const tail = new T.ConeGeometry(.2, .34, 4); tail.rotateZ(-Math.PI / 2); tail.scale(1, 1, .22); tail.translate(-.63, 0, 0);
  const fin = new T.ConeGeometry(.09, .22, 3); fin.scale(1, 1, .2); fin.translate(.02, .2, 0);
  return paint(mergeGeo([body, tail, fin]), (x, y) => { const k = clamp(.5 - y * 3.2, 0, 1); return new T.Color(1, 1, 1).multiplyScalar(lerp(.42, 1.05, k)); });
})();
function addAquatic(c) {
  if (c.water == null) return; const aq = c.st.aquatic || {}, W = c.water, m = S / 2 - .03, deep = (x, z) => W - c.hAt(x, z);
  // plankton
  const NP = aq.plankton ?? 450, pp = [], ps = [];
  for (let t = 0; t < NP * 8 && pp.length < NP * 3; t++) { let x = rnd(-m, m), z = rnd(-m, m); if (R() < .65) { const o = rnd(.01, .4), e = Math.floor(rnd(4)); if (e === 0) x = m - o; else if (e === 1) x = o - m; else if (e === 2) z = m - o; else z = o - m; }
    const d = deep(x, z); if (d < .07) continue; pp.push(x, W - rnd(.03, d - .02), z); ps.push(R()); }
  if (pp.length) {
    const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.Float32BufferAttribute(pp, 3)); pg.setAttribute('aS', new T.Float32BufferAttribute(ps, 1));
    const pu = { uT: TREE_U.uTime, uPx: { value: 1.7 * renderer.getPixelRatio() }, uCol: { value: col(aq.plCol || '#d6ead2').clone() }, uA: { value: .32 } };
    const pm = new T.ShaderMaterial({ uniforms: pu, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: 'attribute float aS; uniform float uT, uPx; varying float vS; void main(){ vec3 p = position; p.x += sin(uT * .31 + aS * 40.) * .02; p.y += sin(uT * .47 + aS * 17.) * .012; p.z += cos(uT * .27 + aS * 29.) * .02; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); gl_PointSize = uPx * (.55 + aS * .9); }',
      fragmentShader: 'uniform vec3 uCol; uniform float uA, uT; varying float vS; void main(){ float r = length(gl_PointCoord - .5) * 2.; if (r > 1.) discard; float tw = .55 + .45 * sin(uT * (.8 + vS * 2.) + vS * 50.); gl_FragColor = vec4(uCol, uA * (1. - r * r) * tw); }' });
    const pts = new T.Points(pg, pm); pts.renderOrder = 1; pts.frustumCulled = false; c.group.add(pts); c.plk = pu;
  }
  // fish
  const cand = []; for (let t = 0; t < 700; t++) { const x = rnd(.2 - m, m - .2), z = rnd(.2 - m, m - .2); if (deep(x, z) > .17) cand.push([x, z, Math.max(Math.abs(x), Math.abs(z))]); }
  cand.sort((a, b) => b[2] - a[2]);
  const schools = [], fish = [], cols = (aq.cols || ['#9aa6ae', '#7d8a94', '#c2c6c4']).map(h => col(h)), L0 = (aq.size ?? .09) * 1.6;
  for (let tries = 0; tries < 60 && schools.length < (aq.schools ?? 5) + (aq.big ?? 1) && cand.length; tries++) {
    const big = schools.length >= (aq.schools ?? 5), [x, z] = cand[Math.floor(R() * Math.max(1, cand.length * .45))]; let r = rnd(.14, .36) * (big ? 1.5 : 1), ok = false, dmin = 9;
    for (let s2 = 0; s2 < 4 && !ok; s2++, r *= .7) { dmin = 9; for (let q = 0; q < 14; q++) { const a = q / 14 * TAU, px = x + Math.cos(a) * (r + .05), pz = z + Math.sin(a) * (r + .05); dmin = Math.min(dmin, Math.abs(px) < m && Math.abs(pz) < m ? deep(px, pz) : -1); } ok = dmin > .13; }
    if (!ok) continue;
    const sc = { x, z, r, y: W - rnd(.06, Math.min(dmin - .06, .32)), a0: rnd(TAU), w: rnd(.25, .5) * (R() < .5 ? -1 : 1) * (big ? .5 : 1) };
    schools.push(sc); const n = big ? 1 : Math.floor(rnd(5, 11)), cc = pick(cols);
    for (let i = 0; i < n; i++) fish.push({ s: sc, dr: big ? 0 : rnd(-.035, .035), dy: big ? 0 : rnd(-.022, .022), dp: big ? 0 : rnd(-.32, .32), L: L0 * (big ? rnd(2, 2.6) : rnd(.8, 1.15)), c: big ? col(aq.bigCol || '#55606a') : cc });
  }
  // jellyfish: a few translucent bells pulsing slowly over the deepest water, faintly lit at night
  const jel = []; for (let t = 0; t < 500 && jel.length < (aq.jelly ?? 4); t++) { const x = rnd(.3 - m, m - .3), z = rnd(.3 - m, m - .3), d = deep(x, z); if (d < .34) continue; jel.push({ x, z, y: W - rnd(.13, Math.min(d - .12, .5)), ph: rnd(TAU), r: rnd(.06, .18), w: rnd(.05, .12) * (R() < .5 ? -1 : 1), s: rnd(.8, 1.35) }); }
  let jmesh = null;
  if (jel.length) { const parts = [new T.SphereGeometry(.05, 14, 7, 0, TAU, 0, Math.PI * .55)]; for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, g = new T.CylinderGeometry(.0022, .0008, rnd(.08, .13), 3); g.translate(Math.cos(a) * .03, -.06 + .02, Math.sin(a) * .03); parts.push(g); }
    const oral = new T.ConeGeometry(.013, .08, 5); oral.rotateX(Math.PI); oral.translate(0, -.03, 0); parts.push(oral);
    c.jel = new T.MeshStandardMaterial({ color: col(aq.jelCol || '#c4d4e4'), emissive: col(aq.jelGlow || '#9ec0dc'), emissiveIntensity: .12, transparent: true, opacity: .4, roughness: .3, depthWrite: false, side: T.DoubleSide });
    jmesh = inst(mergeGeo(parts), c.jel, jel.length, false); jmesh.receiveShadow = false; jmesh.frustumCulled = false; jmesh.renderOrder = 1; c.group.add(jmesh); }
  const jup = t => { if (!jmesh) return; jel.forEach((j, i) => { const p = Math.sin(t * 1.5 + j.ph), a = j.ph + j.w * t; _P.set(j.x + Math.cos(a) * j.r, j.y + Math.sin(t * .35 + j.ph) * .03 + Math.max(0, p) * .006, j.z + Math.sin(a) * j.r); _Q.identity(); _S.set(j.s * (1 + .13 * p), j.s * (1 - .1 * p), j.s * (1 + .13 * p)); _M.compose(_P, _Q, _S); jmesh.setMatrixAt(i, _M); }); jmesh.instanceMatrix.needsUpdate = true; };
  const night = k => { if (c.jel) c.jel.emissiveIntensity = lerp(.12, .55, k); if (!c.plk) return; c.plk.uA.value = lerp(.26, .3, k); c.plk.uCol.value.copy(col(aq.plCol || '#d6ead2')).lerp(col('#8fd2dc'), k * .45); };
  if (!fish.length) { c.aq = { update: jup, night }; return; }
  const fm = new T.MeshStandardMaterial({ vertexColors: true, roughness: .4, metalness: .25 });
  fm.onBeforeCompile = sh => { sh.uniforms.uTime = TREE_U.uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n{ float ph = instanceMatrix[3].x * 7.1 + instanceMatrix[3].z * 5.3; transformed.z += sin(uTime * 13. + ph + position.x * 4.) * .16 * pow(max(0., .2 - position.x), 1.4); }\n#endif'); };
  fm.customProgramCacheKey = () => 'fish';
  const mesh = inst(FISH_GEO, fm, fish.length, false); mesh.receiveShadow = false; mesh.frustumCulled = false; fish.forEach((f, i) => mesh.setColorAt(i, f.c)); c.group.add(mesh);
  c.aq = { night, update(t) { jup(t); fish.forEach((f, i) => { const s = f.s, a = s.a0 + s.w * t + f.dp, r = s.r + f.dr, ca = Math.cos(a), sa = Math.sin(a), sg = Math.sign(s.w);
      _P.set(s.x + ca * r, s.y + f.dy + Math.sin(t * 1.1 + f.dp * 9) * .006, s.z + sa * r); _Q.setFromAxisAngle(UP, Math.atan2(-ca * sg, -sa * sg)); _S.setScalar(f.L); _M.compose(_P, _Q, _S); mesh.setMatrixAt(i, _M); });
      mesh.instanceMatrix.needsUpdate = true; } };
}
function disposeWorld(c) { if (c.skyG) { scene.remove(c.skyG); c.skyG.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); } scene.remove(c.group); c.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }); }
function splash(c, x, z, s = 1) {
  const y = c.water;
  for (let i = 0; i < 260 * s; i++) { const a = rnd(TAU), sp = rnd(.3, 1.2) * s; c.Sm.emit(x + rnd(-.1, .1), y, z + rnd(-.1, .1), Math.cos(a) * sp, rnd(1, 3.2) * s, Math.sin(a) * sp, rnd(.9, 1.6), [.97, .99, 1, .95], [.9, .95, 1, 0], .035, .07, -5, .2); }
  for (let i = 0; i < 40; i++) c.Sm.emit(x + rnd(-.3, .3), y + rnd(.05, .4), z + rnd(-.3, .3), rnd(-.2, .2), rnd(.1, .4), rnd(-.2, .2), rnd(2, 3.5), [1, 1, 1, .45], [1, 1, 1, 0], .2, .8, 0, .6);
  c.rings.push({ m: ringMesh(c, x, y + .01, z), t: 0 }); sfx.splash(s);
}
function cloud(c, x, y, z, n, size, shade, ttl, drift = .05, tall = .5) {
  for (let i = 0; i < n; i++) { const dx = rnd(-1, 1) * size, dz = rnd(-1, 1) * size * .8, dy = Math.pow(R(), .8) * size * tall * (1 - Math.abs(dx) / size * .6), k = clamp(dy / (size * tall), 0, 1), lt = lerp(shade[0], shade[1], k);
    c.Sm.emit(x + dx, y + dy, z + dz, drift, 0, 0, ttl * rnd(.9, 1.1), [lt * .97, lt, lt * 1.03, .82], [lt, lt, lt, .82], size * rnd(.45, .7), size * rnd(.55, .85), 0, 0, 0, -1); }
}
function cumulus(sys, x, y, z, S, shade, ttl) {
  const P = [];
  for (let i = 0; i < 14; i++) P.push([rnd(-1.3, 1.3) * S, rnd(0, .1) * S, rnd(-.5, .5) * S, rnd(.32, .45) * S]);
  for (let i = 0; i < 12; i++) P.push([rnd(-.9, .9) * S, rnd(.2, .5) * S, rnd(-.4, .4) * S, rnd(.38, .55) * S]);
  for (let i = 0; i < 8; i++) P.push([rnd(-.5, .5) * S, rnd(.55, .95) * S, rnd(-.3, .3) * S, rnd(.42, .62) * S]);
  P.forEach(([dx, dy, dz, r]) => { const lt = lerp(shade[0], shade[1], Math.pow(clamp(dy / (.95 * S), 0, 1), .6)); sys.emit(x + dx, y + dy, z + dz, 0, 0, 0, ttl * rnd(.95, 1.05), [lt * .97, lt, lt * 1.03, .93], [lt, lt, lt, .93], r, r * 1.1, 0, 0, 0, -1); });
}
function ringMesh(c, x, y, z) { const m = new T.Mesh(new T.RingGeometry(.9, 1, 48), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7, depthWrite: false, side: T.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.scale.setScalar(.1); c.group.add(m); return m; }
function updRings(c, dt, speed = 1.4) { (c.rings || []).forEach(r => { r.t += dt; r.m.scale.setScalar(.1 + r.t * speed); r.m.material.opacity = Math.max(0, .7 - r.t * .35) * (c.fadeA ?? 1); }); }

/* ================= stories ================= */
const STORIES = [];
const story = o => STORIES.push(o);

/* ---------- Vesuvius, 79 AD: a close-up world. The Gran Cono inside Monte Somma's caldera rim, a Roman villa
   in fragments on a tuff cliff over the bay, vineyards on the lower slopes. EVENT runs a Plinian eruption. ---------- */
const VC = [-1.45, -1.45], VX = .62, VZ = .74, VS = 1.5, VH = .6, VP0 = .02, BACKA = Math.atan2(-.35, -1); // Somma wraps the cone's far-left flank; the right falls in one long slope to the bay
const vLocal = (x, z) => [(x - VX) / VS, (z - VZ) / VS];
const inVilla = (x, z, m = 0) => Math.abs(x - (VX + .26)) < 1.46 + m && Math.abs(z - VZ) < .9 + m;
function mosaicTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
  x.fillStyle = '#ece4d2'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#22201e';
  x.fillRect(8, 8, 240, 10); x.fillRect(8, 238, 240, 10); x.fillRect(8, 8, 10, 240); x.fillRect(238, 8, 10, 240);
  for (let k = 0; k < 10; k++) { const o = 26 + k * 21; [[o, 26, 12, 4], [o, 30, 4, 10], [o + 4, 36, 10, 4], [o, 222, 12, 4], [o, 212, 4, 10], [o + 4, 212, 10, 4]].forEach(r => x.fillRect(...r)); }
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) { x.save(); x.translate(64 + i * 16, 64 + j * 16); x.rotate(Math.PI / 4); x.fillRect(-4, -4, 8, 8); x.restore(); }
  x.fillStyle = '#ece4d2'; x.beginPath(); x.arc(128, 128, 30, 0, TAU); x.fill(); x.strokeStyle = '#22201e'; x.lineWidth = 4; x.stroke();
  x.fillStyle = '#a3311f'; for (let k = 0; k < 8; k++) { x.save(); x.translate(128, 128); x.rotate(k / 8 * TAU); x.beginPath(); x.ellipse(0, -14, 5, 12, 0, 0, TAU); x.fill(); x.restore(); }
  x.fillStyle = '#c88a3a'; x.beginPath(); x.arc(128, 128, 6, 0, TAU); x.fill();
  const im = x.getImageData(0, 0, 256, 256), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(im, 0, 0);
  const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
}
function buildVilla(c) {
  const V = new T.Group(); V.position.set(VX, VH, VZ); V.scale.setScalar(VS); c.group.add(V); c.villa = V;
  const nz = c.noise, P0 = VP0, CL = { plaster: '#eadfc6', plaster2: '#dfd2b5', red: '#a3311f', ochre: '#c98b3b', black: '#2a2220', rubble: '#b3a58a', socle: '#9a3b27', stone: '#c9bb9d' };
  const vm = new T.MeshStandardMaterial({ vertexColors: true, roughness: .88 }), W = [];
  const toTile = (x, y, z) => [VX + x * VS, VH + y * VS, VZ + z * VS];
  // podium and steps
  W.push(paint(new T.BoxGeometry(1.58, .08, 1.2).translate(0, P0 - .04, 0), (x, y, z, nx, ny) => ny > .5 ? CL.stone : '#a8987a'));
  [[.0, .3], [.012, .26]].forEach(([dy, w], k) => W.push(paint(new T.BoxGeometry(w, P0 - dy, .05).translate(.1, (P0 - dy) / 2, .62 + k * .04), () => CL.stone)));
  // ruined fresco walls: each run is sliced, every slice a stack of dado / panel / upper zone boxes
  function run(x0, z0, x1, z1, o) {
    const L = Math.hypot(x1 - x0, z1 - z0), N = Math.max(1, Math.round(L / .03)), sl = L / N, dx = (x1 - x0) / L, dz = (z1 - z0) / L, ang = Math.atan2(dz, dx), fx = -dz * o.side, fz = dx * o.side, seed = x0 * 13.7 + z0 * 7.1;
    for (let i = 0; i < N; i++) { const t = (i + .5) / N; if ((o.doors || []).some(([a, b]) => t > a && t < b)) { if (!o.ruin) { const g = new T.BoxGeometry(sl * 1.02, .05, .036); g.rotateY(-ang); g.translate(lerp(x0, x1, t), P0 + o.h - .025, lerp(z0, z1, t)); W.push(paint(g, () => CL.plaster)); } continue; }
      let h = o.h; if (o.ruin) { const q = nz.fbm(seed + i * .08, seed * .3, 4); h = o.h * clamp(1.05 - o.ruin * .8 + q * 1.5, .1, 1); h = Math.max(.03, Math.round(h / .015) * .015); }
      const band = ((i * sl) % .16) < .022, panel = band ? CL.black : (o.panel || CL.red);
      [[0, .05, CL.black, CL.socle], [.05, .2, panel, CL.plaster], [.2, 9, CL.plaster, CL.plaster2]].forEach(([a, b, inC, outC]) => { const y0 = a, y1 = Math.min(b, h); if (y1 <= y0) return;
        const g = new T.BoxGeometry(sl * 1.03, y1 - y0, .036); g.rotateY(-ang); g.translate(lerp(x0, x1, t), P0 + (y0 + y1) / 2, lerp(z0, z1, t));
        const top = y1 === h, jit = .9 + hash3(i, a * 10, seed) * .14;
        W.push(paint(g, (x, y, z, nx, ny, nz2) => { if (ny > .5) return top ? (o.ruin ? CL.rubble : CL.plaster2) : inC; const d = nx * fx + nz2 * fz; return _sg.copy(col(d > .5 ? inC : outC)).multiplyScalar(jit).clone(); })); }); }
  }
  // back wing (roofed)
  run(-.75, -.55, .3, -.55, { h: .3, side: 1 }); run(-.75, -.22, .3, -.22, { h: .3, side: -1, doors: [[.16, .27], [.55, .67]] });
  run(-.75, -.55, -.75, -.22, { h: .3, side: -1 }); run(.3, -.55, .3, -.22, { h: .3, side: 1 }); run(-.3, -.55, -.3, -.22, { h: .3, side: 1, doors: [[.4, .7]] });
  // east room, roofless
  run(.3, -.55, .75, -.55, { h: .28, side: 1, ruin: .45, panel: CL.ochre }); run(.75, -.55, .75, -.22, { h: .28, side: 1, ruin: .55, panel: CL.ochre }); run(.3, -.22, .75, -.22, { h: .26, side: -1, ruin: .75, doors: [[.3, .72]] });
  // west wing, ruined
  run(-.75, -.22, -.75, .55, { h: .28, side: -1, ruin: .4 }); run(-.45, -.22, -.45, .55, { h: .26, side: 1, ruin: .85, doors: [[.12, .27], [.6, .74]] });
  run(-.75, .15, -.45, .15, { h: .26, side: 1, ruin: .6 }); run(-.75, .55, -.45, .55, { h: .22, side: -1, ruin: .95 });
  // low fragments along the front and the pergola side
  run(-.45, .55, .75, .55, { h: .2, side: -1, ruin: 1, doors: [[.42, .56]] }); run(.75, -.22, .75, .55, { h: .2, side: 1, ruin: .95, doors: [[.32, .62]] });
  // floors: mosaics in the open rooms, garden in the peristyle
  const mt = mosaicTex(), floor = (x0, z0, x1, z1, rep) => { const g = new T.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); const t = mt.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); const m = mesh(g, new T.MeshStandardMaterial({ map: t, roughness: .7 }), V, (x0 + x1) / 2, P0 + .002, (z0 + z1) / 2); m.castShadow = false; };
  floor(-.73, -.2, -.47, .14, [1, 1.3]); floor(-.73, .17, -.47, .53, [1, 1.4]); floor(.32, -.53, .73, -.24, [1.4, 1]); floor(-.28, -.53, .28, -.24, [2, 1]);
  W.push(paint(new T.BoxGeometry(.9, .014, .5).translate(.15, P0 + .007, .17), (x, y, z, nx, ny) => ny > .5 ? (hash3(Math.round(x * 90), 0, Math.round(z * 90)) > .5 ? '#5d7a33' : '#6a8a3a') : '#5a4a36'));
  [[.15, -.075, .9, .02], [.15, .415, .9, .02], [-.29, .17, .02, .5], [.59, .17, .02, .5], [.15, .17, .9, .018], [.15, .17, .018, .5]].forEach(([x, z, w, d]) => W.push(paint(new T.BoxGeometry(w, .03, d).translate(x, P0 + .028, z), (X, Y, Z, nx, ny) => ny > .5 ? '#3a5a26' : '#2c4620')));
  // impluvium / fountain basin with a statue
  W.push(paint(new T.BoxGeometry(.22, .035, .15).translate(.15, P0 + .018, .17), () => '#f0ebe0'));
  const pool = mesh(new T.PlaneGeometry(.19, .12).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: col('#2f8aa0'), roughness: .08, metalness: .1, envMapIntensity: 1.4 }), V, .15, P0 + .033, .17); pool.castShadow = false;
  W.push(paint(new T.BoxGeometry(.035, .06, .035).translate(.15, P0 + .06, .17), () => '#e8e2d4'));
  const marble = mat('#f4f0e8', .45), stat = new T.Group(); stat.position.set(.15, P0 + .09, .17); V.add(stat);
  mesh(lathe([[.016, 0], [.018, .02], [.013, .05], [.011, .07], [.008, .078], [0, .08]], 12, true), marble, stat); mesh(new T.SphereGeometry(.0075, 10, 8), marble, stat, 0, .087, 0);
  const arm = mesh(new T.CylinderGeometry(.0028, .0032, .04, 6), marble, stat, .012, .085, 0); arm.rotation.z = -.6; c.fountain = toTile(.15, P0 + .06, .17);
  // columns of the peristyle: red lower third, fluted upper shaft, Tuscan capitals; many broken
  const flute = (r0, r1, h) => { const g = new T.CylinderGeometry(r1, r0, h, 32, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 - .07 * Math.max(0, Math.cos(a * 16)); if (Math.abs(p.getY(i)) < h / 2 + 1e-4 && Math.hypot(p.getX(i), p.getZ(i)) > 1e-3) { p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } } g.computeVertexNormals(); return g; };
  const colGeo = f => { const parts = [paint(new T.BoxGeometry(.064, .016, .064).translate(0, .008, 0), () => CL.stone), paint(new T.CylinderGeometry(.034, .036, .012, 20).translate(0, .022, 0), () => CL.plaster)];
    const H = .29 * f, lo = Math.min(H, .1); if (lo > .02) parts.push(paint(new T.CylinderGeometry(.027, .029, lo - .028, 20).translate(0, .028 + (lo - .028) / 2, 0), () => CL.red));
    if (H > .1) { const hh = H - .1 - (f >= 1 ? .03 : 0); if (hh > .005) parts.push(paint(flute(.028, f >= 1 ? .024 : lerp(.028, .024, f), hh).translate(0, .1 + hh / 2, 0), () => '#efe7d4')); }
    if (f >= 1) { parts.push(paint(new T.CylinderGeometry(.036, .025, .016, 20).translate(0, .268, 0), () => '#efe7d4'), paint(new T.BoxGeometry(.078, .014, .078).translate(0, .283, 0), () => '#efe7d4')); }
    else parts.push(paint(lumpy(new T.CylinderGeometry(.026, .028, .02, 9, 1), .5, 200).translate(0, Math.max(.03, H), 0), () => '#cdbf9f'));
    return mergeGeo(parts); };
  const full = colGeo(1), xs = [-.37, -.16, .05, .26, .47, .68], spots = [];
  xs.forEach(x => spots.push([x, -.15], [x, .5])); [.07, .29].forEach(z => spots.push([-.37, z], [.68, z]));
  const state = spots.map(() => R() < .52 ? 1 : R() < .12 ? 0 : rnd(.2, .75));
  spots.forEach(([x, z], i) => { const f = state[i]; if (f === 0) { W.push(paint(new T.BoxGeometry(.064, .016, .064).translate(x, P0 + .008, z), () => CL.stone)); return; } const m = mesh(f === 1 ? full : colGeo(f), vm, V, x, P0, z); m.castShadow = true; });
  for (let i = 0; i < xs.length - 1; i++) [-.15, .5].forEach(z => { if (state[i * 2 + (z > 0 ? 1 : 0)] === 1 && state[(i + 1) * 2 + (z > 0 ? 1 : 0)] === 1) { const x0 = xs[i], x1 = xs[i + 1];
    W.push(paint(new T.BoxGeometry(x1 - x0 + .07, .03, .06).translate((x0 + x1) / 2, P0 + .305, z), () => '#ebe2cc'), paint(new T.BoxGeometry(x1 - x0 + .07, .014, .062).translate((x0 + x1) / 2, P0 + .327, z), () => CL.red)); } });
  // fallen drums, a capital, rubble and amphorae
  for (let k = 0; k < 6; k++) { const L = rnd(.05, .11), g = new T.CylinderGeometry(.028, .028, L, 16); g.rotateZ(Math.PI / 2); g.rotateY(rnd(TAU)); const x = rnd(-.3, .7), z = pick([rnd(-.12, -.06), rnd(.44, .6), rnd(.58, .7)]); W.push(paint(g.translate(x, P0 + .028, z), (X, Y) => Y < P0 + .02 ? '#b8ab90' : (k % 2 ? CL.red : '#ece4d2'))); }
  W.push(paint(new T.BoxGeometry(.078, .016, .078).rotateY(.5).rotateZ(.3).translate(.62, P0 + .016, .63), () => '#e9e0cb'));
  const rb = []; for (let k = 0; k < 160; k++) { const run2 = pick([[-.75, -.22, -.75, .55], [-.45, -.22, -.45, .55], [.3, -.22, .75, -.22], [.75, -.55, .75, -.22], [-.45, .55, .75, .55], [.75, -.22, .75, .55]]), t = R(), s = rnd(.008, .02);
    const g = lumpy(new T.BoxGeometry(s, s * .8, s * 1.1), .4, 400); g.rotateY(rnd(TAU)); g.translate(lerp(run2[0], run2[2], t) + rnd(-.06, .06), P0 + s * .35, lerp(run2[1], run2[3], t) + rnd(-.06, .06)); rb.push(paint(g, () => pick([CL.rubble, CL.plaster, CL.red, '#8f8270']))); }
  W.push(...rb);
  const amph = lathe([[0, 0], [.006, .004], [.014, .03], [.02, .06], [.017, .085], [.007, .1], [.007, .115], [.011, .118], [0, .12]], 12, true);
  [[-.08, -.17], [-.04, -.18], [-.06, -.14], [.86, .42], [.9, .44], [-.62, .6]].forEach(([x, z], k) => { const m = mesh(amph, mat(pick(['#b0603a', '#a5552f', '#bb6c42']), .75), V, x, k === 5 ? P0 - .01 : (x > .8 ? 0 : P0), z); m.rotation.set(k % 3 === 2 ? .5 : rnd(-.08, .08), rnd(TAU), k % 3 === 2 ? .3 : 0); });
  // roof over the west part of the back wing, bare rafters over the east part (the roof is half gone)
  const ry = P0 + .3, rz0 = -.58, rz1 = -.19, rzm = (rz0 + rz1) / 2, rise = .088, half = (rz1 - rz0) / 2, sa = Math.atan2(rise, half), slen = Math.hypot(half, rise) + .02, rx0 = -.79, rx1 = .04;
  [1, -1].forEach(sd => { const g = new T.BoxGeometry(rx1 - rx0, .008, slen); g.rotateX(sd * sa); g.translate((rx0 + rx1) / 2, ry + rise / 2, rzm + sd * half / 2); W.push(paint(g, () => '#8e3c22')); });
  const ig = new T.CylinderGeometry(.0095, .0095, slen, 6, 1, true, -Math.PI / 2, Math.PI); ig.rotateX(-Math.PI / 2);
  const nI = Math.floor((rx1 - rx0) / .025), imb = inst(ig, new T.MeshStandardMaterial({ roughness: .7, side: T.DoubleSide }), nI * 2), tc = new T.Color(), eu = new T.Euler();
  for (let i = 0; i < nI; i++) [1, -1].forEach((sd, q) => { eu.set(sd * sa, 0, 0); _Q.setFromEuler(eu); _P.set(rx0 + .0125 + i * .025, ry + rise / 2 + .006, rzm + sd * half / 2); _S.set(1, 1, 1); _M.compose(_P, _Q, _S); imb.setMatrixAt(i * 2 + q, _M); imb.setColorAt(i * 2 + q, tc.copy(col(pick(['#b4532c', '#a8482a', '#c0623a', '#9c4228', '#bd5d36']))).multiplyScalar(rnd(.85, 1.1))); });
  V.add(imb); W.push(paint(new T.CylinderGeometry(.013, .013, rx1 - rx0 + .02, 8).rotateZ(Math.PI / 2).translate((rx0 + rx1) / 2, ry + rise + .006, rzm), () => '#8a3a22'));
  const gs = new T.Shape(); gs.moveTo(rz0 + .02, 0); gs.lineTo(rz1 - .02, 0); gs.lineTo(rzm, rise - .004); gs.lineTo(rz0 + .02, 0);
  const gg = new T.ExtrudeGeometry(gs, { depth: .03, bevelEnabled: false }); gg.rotateY(-Math.PI / 2); W.push(paint(gg.clone().translate(-.735, ry, 0), () => CL.plaster), paint(gg.clone().translate(.03, ry, 0), () => CL.plaster2));
  for (let x = .08; x < .31; x += .055) [1, -1].forEach(sd => { const g = new T.BoxGeometry(.012, .012, slen * (x > .25 && sd < 0 ? .55 : 1)); g.rotateX(sd * sa); g.translate(x, ry + rise / 2, rzm + sd * half / 2); W.push(paint(g, () => '#4e3420')); });
  W.push(paint(new T.BoxGeometry(.3, .016, .016).translate(.18, ry + rise, rzm), () => '#4e3420'));
  for (let k = 0; k < 14; k++) { const g = new T.BoxGeometry(.03, .006, .05); g.rotateX(rnd(-.5, .5)); g.rotateY(rnd(TAU)); g.translate(rnd(-.25, .25), P0 + .01, rnd(-.5, -.27)); W.push(paint(g, () => pick(['#b4532c', '#a8482a', '#9c4228']))); }
  // glowing doorways for night
  const dm = new T.MeshBasicMaterial({ color: col('#22252c') }); c.winMats.push(dm);
  [[-.75 + 1.05 * .215, -.235], [-.75 + 1.05 * .61, -.235]].forEach(([x, z]) => { const m = mesh(new T.PlaneGeometry(.1, .24), dm, V, x, P0 + .12, z); m.castShadow = false; });
  // pergola on the terrace: stucco posts, timber beams, a mat of vine and flowering creeper; a triclinium below
  const px = [.84, 1.12], pz = [-.4, -.13, .12, .34];
  px.forEach(x => pz.forEach(z => W.push(paint(new T.CylinderGeometry(.011, .013, .27, 10).translate(x, .135, z), (X, Y) => Y < .06 ? CL.red : '#efe7d4'))));
  px.forEach(x => W.push(paint(new T.BoxGeometry(.02, .02, .82).translate(x, .28, -.03), () => '#5a3a22')));
  for (let z = -.42; z <= .37; z += .065) W.push(paint(new T.BoxGeometry(.36, .01, .012).translate(.98, .295, z), () => '#6a4a2c'));
  const leaf = lumpy(new T.IcosahedronGeometry(.03, 0), .5, 300), leafM = inst(leaf, new T.MeshStandardMaterial({ roughness: .85 }), 90), fl = lumpy(new T.IcosahedronGeometry(.013, 0), .4, 600), flM = inst(fl, new T.MeshStandardMaterial({ roughness: .6 }), 260);
  for (let i = 0; i < 90; i++) { const edge = R() < .35; _P.set(edge ? pick(px) + rnd(-.02, .02) : rnd(.82, 1.14), edge ? rnd(.16, .3) : .3 + rnd(0, .03), rnd(-.43, .37)); _Q.setFromAxisAngle(UP, rnd(TAU)); _S.setScalar(rnd(.7, 1.4)); _M.compose(_P, _Q, _S); leafM.setMatrixAt(i, _M); leafM.setColorAt(i, tc.copy(col(pick(['#3e6a2a', '#4f7a32', '#36602a']))).multiplyScalar(rnd(.85, 1.1))); }
  for (let i = 0; i < 260; i++) { const hang = R() < .45, x = hang ? pick(px) + rnd(-.03, .03) : rnd(.82, 1.15); _P.set(x, hang ? rnd(.1, .31) : .32 + rnd(-.01, .03), rnd(-.44, .38)); _S.setScalar(rnd(.7, 1.3)); _M.compose(_P, _Q, _S); flM.setMatrixAt(i, _M); flM.setColorAt(i, tc.copy(col(pick(['#d6407a', '#e86aa0', '#b8306a', '#f0a0c0', '#c2286a'])))); }
  leafM.castShadow = flM.castShadow = true; V.add(leafM, flM);
  [[.9, -.12, 0], [1.06, -.12, 0], [.98, -.25, Math.PI / 2]].forEach(([x, z, r]) => { W.push(paint(new T.BoxGeometry(.06, .03, .22).rotateY(r).translate(x, .015, z + (r ? 0 : -.02)), () => '#6a4a2c'), paint(new T.BoxGeometry(.055, .012, .21).rotateY(r).translate(x, .036, z + (r ? 0 : -.02)), () => pick([CL.red, '#c98b3b', '#2f5a7a']))); });
  W.push(paint(new T.CylinderGeometry(.04, .03, .035, 16).translate(.98, .018, -.1), (X, Y, Z, nx, ny) => ny > .5 ? '#f0ebe0' : '#d8d0c0'));
  [[.97, -.1], [.995, -.09], [.98, -.115]].forEach(([x, z]) => mesh(new T.SphereGeometry(.008, 8, 6), mat(pick(['#c0392b', '#e0b040', '#7a3a8a']), .5), V, x, .04, z));
  c.lamps = [[.84, -.27], [1.12, -.27], [.84, .23], [1.12, .23], [-.1, .52], [.4, .52]].map(([x, z], k) => toTile(x, k < 4 ? .24 : P0 + .03, z));
  c.lamps.forEach(p => c.G.emit(p[0], p[1], p[2], 0, 0, 0, 1e6, [1, .7, .32, .9], [1, .7, .32, .9], .11, .11));
  const vmesh = new T.Mesh(mergeGeo(W), vm); vmesh.castShadow = vmesh.receiveShadow = true; V.add(vmesh);
  V.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  // people stay in the courtyard, the pergola and the terrace
  const rects = [[-.4, .72, -.17, .52], [.78, 1.16, -.44, .38], [-.7, 1.1, .64, .82], [-.32, .28, -.52, -.25]];
  c.peopleZone = { x0: VX - 1.2 * VS, x1: VX + 1.2 * VS, z0: VZ - .6 * VS, z1: VZ + .85 * VS, ok(x, z) { const [lx, lz] = vLocal(x, z); if (lx > .03 && lx < .27 && lz > .08 && lz < .26) return false; return rects.some(r => lx > r[0] && lx < r[1] && lz > r[2] && lz < r[3]); } };
  c.groundAt = (x, z) => { const [lx, lz] = vLocal(x, z); return Math.abs(lx) < .79 && Math.abs(lz) < .6 ? VH + P0 * VS : c.hAt(x, z); };
}
function buildPier(c) { // stone stair down the cliff, a timber jetty, a moored boat
  const x = VX + 1.0 * VS, z0 = VZ + .62 * VS; let zW = null;
  for (let z = z0; z < 3.05; z += .03) if (c.hAt(x, z) < c.water + .02) { zW = z; break; }
  if (zW === null) return; const stone = mat('#b9ab8e', .9), wood = mat('#7a5634', .85), dark = mat('#4a3424', .9), top = c.water + .05;
  const n = Math.max(2, Math.ceil((VH - top) / .04)), dz = (zW - z0) / n;
  for (let i = 0; i < n; i++) { const y = lerp(VH, top, (i + 1) / n), zz = z0 + dz * (i + .5), bot = Math.min(c.hAt(x, zz), y) - .08; mesh(new T.BoxGeometry(.2, y - bot, dz * 1.02), stone, c.group, x, (y + bot) / 2, zz); }
  const zE = Math.min(zW + .95, 3.0), L = zE - zW, pg = new T.BoxGeometry(.24, .012, .028), np = Math.floor(L / .036), planks = inst(pg, new T.MeshStandardMaterial({ roughness: .85 }), np), tc = new T.Color();
  for (let i = 0; i < np; i++) { _P.set(x + rnd(-.004, .004), top, zW + .02 + i * .036); _Q.setFromAxisAngle(UP, rnd(-.03, .03)); _S.set(1, 1, 1); _M.compose(_P, _Q, _S); planks.setMatrixAt(i, _M); planks.setColorAt(i, tc.copy(col(pick(['#8a6a44', '#7a5a38', '#946f48']))).multiplyScalar(rnd(.85, 1.1))); }
  c.group.add(planks); planks.castShadow = planks.receiveShadow = true;
  [-1, 1].forEach(sd => { mesh(new T.BoxGeometry(.016, .02, L), dark, c.group, x + sd * .1, top - .016, zW + L / 2); for (let zz = zW + .05; zz < zE; zz += .22) { const b = c.hAt(x + sd * .1, zz) - .03; mesh(new T.CylinderGeometry(.012, .014, top + .05 - b, 7), dark, c.group, x + sd * .1, (top + .05 + b) / 2, zz); } });
  [-1, 1].forEach(sd => mesh(new T.BoxGeometry(.006, .2, .006), mat('#8a8e94', .3, .7), c.group, x + sd * .04, top - .09, zE - .01));
  for (let k = 0; k < 5; k++) mesh(new T.BoxGeometry(.08, .005, .006), mat('#8a8e94', .3, .7), c.group, x, top - .03 - k * .04, zE - .01);
  const bg = lathe([[0, -.13], [.02, -.12], [.034, -.07], [.038, 0], [.034, .07], [.02, .12], [0, .13]], 14); bg.scale(1, .45, 1);
  c.boat = new T.Group(); mesh(bg, shadeMat(bg, '#8a5a34', '#3a2616', .7), c.boat); mesh(new T.BoxGeometry(.2, .004, .05), mat('#a07a4c', .8), c.boat, 0, .012, 0);
  c.boat.position.set(x + .22, c.water + .01, zW + L * .55); c.boat.rotation.y = Math.PI / 2 + .1; c.boat.scale.setScalar(1.6); c.group.add(c.boat);
  c.lamps.push([x - .12, top + .1, zE - .04], [x + .12, top + .1, zE - .04]); [[x - .12, zE - .04], [x + .12, zE - .04]].forEach(([px, pz]) => { mesh(new T.CylinderGeometry(.006, .006, .1, 6), dark, c.group, px, top + .05, pz); c.G.emit(px, top + .11, pz, 0, 0, 0, 1e6, [1, .7, .32, .9], [1, .7, .32, .9], .1, .1); });
}
const ERUPT_PAL = { sky: '#ff7a48', ground: '#2a1814', hemiI: .5, sun: '#ff6030', sunI: .42, dim: .58, tint: '#5a2216' };
const mixPal = (a, b, k) => ({ sky: mixHex(a.sky, b.sky, k), ground: mixHex(a.ground, b.ground, k), sun: mixHex(a.sun, b.sun, k), hemiI: lerp(a.hemiI, b.hemiI, k), sunI: lerp(a.sunI, b.sunI, k), dim: lerp(a.dim ?? 1, b.dim, k), tint: mixHex(a.tint || roomHex(), b.tint, k) });
story({ id: 'vesuvius', frame: { zoom: 2.1, el: .5, lift: 1.3, deck: .9, drop: 3.6 }, nseg: 170, depth: 1.6, cloudY: 3.9, cloudN: .5, pmax: [22000, 24000], glints: 90, surf: 1.2,
  preset: { time: 0, clouds: 1, rain: 0, wind: 1, glow: 1, life: 2 }, mood: ['minor', 146.83],
  caption: () => ({ era: pick(['24 August, 79 AD · 12:55', 'Campania · the last summer of Pompeii', 'Bay of Naples · 79 AD']), name: pick(['Vesuvius, 79 AD', 'The Villa Under the Mountain', 'Umbrella Pine']), line: pick(['Pliny watched from across the bay: a cloud rising like an umbrella pine.', 'The villa has stood a hundred years. The mountain has been patient far longer.', 'Vines on the slopes, fish in the bay, and a mountain nobody thinks is a volcano.']) }),
  water: .1, waves: true, waterCol: '#1b4f86', waterTop: '#4f98b4', waterDeep: '#06142e', aquatic: { jelly: 5, schools: 7, big: 2, size: .09, cols: ['#a9b2b6', '#8a96a0', '#c8c4b8', '#6f7c86'], bigCol: '#4e5a66' }, strata: ['#6a5c50', '#cfc09a', '#4a3e36', '#a8916e', '#3a302a', '#8a7a62', '#bfae86'], soil: '#4a3a28',
  calm: { sky: '#e6c4dc', ground: '#5a4a50', sun: '#ffcfb0' },
  peopleCols: ['#efe9dc', '#e6dcc2', '#a3311f', '#c98b3b', '#8a6a4a', '#4a6a8a', '#f2efe6'], peopleScale: 2.4, birdScale: 2.3, boatScale: 2.6,
  birdZone: { x: VX - .6, z: VZ - .7, r: 1.6, alt: [1.1, 2.3] },
  height(u, v, n) {
    const x = u * 3.2, z = v * 3.2, dx = x - VC[0], dz = z - VC[1], r = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
    let h = .3 + n.fbm(u * 3, v * 3) * .1;
    const mass = 1.45 * Math.pow(Math.max(0, 1 - r / 3.3), 1.35), CR = .3, CH = 3.55, CW = 1.6, rim = CH * Math.pow(1 - CR / CW, 1.15);
    const cone = r < CR ? rim - .85 * (1 - Math.pow(r / CR, 2)) : CH * Math.pow(Math.max(0, 1 - r / CW), 1.15);
    const back = Math.cos(ang - BACKA), mask = clamp((back + .05) / .7, 0, 1), sm = mask * mask * (3 - 2 * mask), SR = 1.95;
    let som = r < SR ? 2.55 * Math.pow(clamp((r - 1.5) / (SR - 1.5), 0, 1), 1.2) : 2.55 * Math.pow(Math.max(0, 1 - (r - SR) / 1.5), 1.5); som *= sm * (.78 + .44 * n.fbm(ang * 1.9 + 2, r * .6));
    const gul = (n.ridge(ang * 5 + 3, r * 1.8, 4) - .55) * .2 * clamp(mass + .3, 0, 1) * clamp(r / .6, 0, 1);
    const ero = (n.ridge(ang * 11 + n.fbm(r * 2.2, ang * 1.3) * 1.6, r * .9, 3) - .5) * .2 * clamp((r - .38) / .3, 0, 1) * clamp((1.75 - r) / .6, 0, 1); // radial gullies down the cone
    h += mass + Math.max(cone, som) + gul + ero;
    const e = Math.hypot(u + .22, v + .22) + n.fbm(u * 2.2 + 5, v * 2.2) * .24 - .1, cm = clamp((e - 1.04) / .26, 0, 1);
    h = lerp(h, -.7 - .45 * clamp((e - 1.25) / .35, 0, 1) + n.fbm(u * 5, v * 5) * .12, cm * cm * (3 - 2 * cm));
    const lx = x - VX, lz = z - VZ, dd = Math.hypot(Math.max(0, Math.abs(lx - .26) - 1.46), Math.max(0, Math.abs(lz) - .9)), fm = 1 - clamp(dd / .42, 0, 1);
    return lerp(h, VH, fm * fm * (3 - 2 * fm));
  },
  color(h, s, u, v, n) {
    const x = u * 3.2, z = v * 3.2, dx = x - VC[0], dz = z - VC[1], r = Math.hypot(dx, dz), ang = Math.atan2(dz, dx), back = Math.cos(ang - BACKA);
    if (h < .06) return n.vn(u * 30, v * 30) > 0 ? '#b9a67c' : '#a8956c';
    if (h < .16 && s < 1.2) return n.vn(u * 40, v * 40) > .2 ? '#d9c69e' : '#cbb68e';
    if (inVilla(x, z, .05)) return n.vn(u * 50, v * 50) > .25 ? '#7d8a4a' : '#8f9656';
    if (h < VH + .2 && s > 1.25) return n.vn(u * 18, v * 30 + h * 9) > .1 ? '#b8a47c' : (n.vn(u * 9, h * 14) > 0 ? '#9c8862' : '#c4b28a');
    if (r < .36) return h < 2.3 ? '#3e2620' : '#4e3428';
    if (r < .5 && h > 2.6) return '#5a4238';
    if (h > 1.45 && back < .35) { const st = n.ridge(ang * 7, r * 1.4), lv = n.ridge(ang * 11 + n.fbm(r * 2.2, ang * 1.3) * 1.6, r * .9, 3); if (st > .86 || lv > .9) return '#2a2422'; if (lv < .32) return h > 2.4 ? '#8a7466' : '#7a6656'; if (s > 1.6) return '#4a3a32'; return n.vn(u * 24, v * 24) > .2 ? '#6a5a50' : '#594b43'; }
    if (back > .35 && h > .85) return n.vn(u * 12, v * 12) > .1 ? '#3c5228' : '#4a5e30';
    if (h > 1.15) return n.vn(u * 14, v * 14) > 0 ? '#5e5a3c' : '#6f6a46';
    if (r > 1.95 && r < 3.05 && h > .4 && h < 1.1 && s < 1) return (r * 9 - Math.floor(r * 9)) < .42 ? '#58762c' : '#8c7652';
    return n.vn(u * 8, v * 8) > .15 ? '#5e7c34' : (n.vn(u * 15, v * 15) > 0 ? '#6d8a3c' : '#7a9444');
  },
  build(c) {
    c.cx = VC[0]; c.cz = VC[1]; c.cy = c.hAt(c.cx, c.cz) + .03; c.lamps = [];
    buildVilla(c); buildPier(c);
    const land = (h, s, x, z) => h > c.water + .12 && !inVilla(x, z, .12), rb = (x, z) => { const a = Math.atan2(z - VC[1], x - VC[0]); return Math.cos(a - BACKA); }, rr = (x, z) => Math.hypot(x - VC[0], z - VC[1]);
    const framing = [[VX - 1.25, VZ + 1.05], [VX + 2.15, VZ - 1.15], [VX - 1.55, VZ - .2], [VX + 2.25, VZ + .05]].filter(([x, z]) => Math.abs(x) < 3 && Math.abs(z) < 3 && c.hAt(x, z) > c.water + .1).map(([x, z]) => [x, c.hAt(x, z), z]);
    addTrees(c, framing.concat(scatter(c, 18, (h, s, x, z) => land(h, s, x, z) && h < 1 && s < .7 && rr(x, z) > 2)), { kind: 'pine', scale: 1.9, colors: ['#3a5a2a', '#466a30', '#33522a'] });
    const cyp = []; for (let k = 0; k < 9; k++) [-1, 1].forEach(sd => { const f = .12 + k * .085, x = lerp(VX - 1.0, VC[0], f) + sd * .16, z = lerp(VZ - .95, VC[1], f) - sd * .16, h = c.hAt(x, z); if (land(h, 0, x, z) && h < 1.2) cyp.push([x, h, z]); });
    addTrees(c, cyp.concat(scatter(c, 10, (h, s, x, z) => land(h, s, x, z) && h < .9 && s < .8)), { kind: 'cypress', scale: 1.55, colors: ['#22381f', '#2b4426', '#1f3420'] });
    addTrees(c, scatter(c, 90, (h, s, x, z) => land(h, s, x, z) && h < 1.3 && s < 1 && rb(x, z) < .4), { kind: 'round', scale: 1.05, colors: ['#6f7a4a', '#7d8a5a', '#5f6a40'] });
    addTrees(c, scatter(c, 170, (h, s, x, z) => land(h, s, x, z) && rb(x, z) > .3 && h > .85 && h < 2.2 && s < 1.7), { kind: pick(['round', 'cone']), scale: 1.1, colors: ['#2f4a24', '#3a5428', '#2a4020'] });
    addTrees(c, scatter(c, 150, (h, s, x, z) => land(h, s, x, z) && rb(x, z) < .3 && h > .8 && h < 1.7 && s < 1.5), { kind: 'bush', scale: 1.1, colors: ['#d9b62a', '#c8a628', '#e2c440', '#7a8a3a'] });
    const vines = []; for (let k = 0; k < 10; k++) { const R0 = 1.98 + k / 9; for (let a = -Math.PI; a < Math.PI; a += .075 / R0) { const x = VC[0] + Math.cos(a) * R0, z = VC[1] + Math.sin(a) * R0; if (Math.abs(x) > 3.05 || Math.abs(z) > 3.05) continue; const h = c.hAt(x, z); if (h > .4 && h < 1.1 && c.slopeAt(x, z) < 1 && land(h, 0, x, z)) vines.push([x, h, z]); } }
    addTrees(c, vines, { kind: 'bush', scale: .62, colors: ['#4a6a24', '#557a2a', '#3e5e20'], stamp: false });
    const gpts = [[.0, .02], [.3, .02], [.0, .33], [.3, .33], [-.2, .4], [.5, -.02], [.52, .38], [-.22, -.04]].map(([lx, lz]) => [VX + lx * VS, VH + VP0 * VS, VZ + lz * VS]);
    addTrees(c, gpts.slice(0, 4), { kind: 'cypress', scale: .8, colors: ['#22381f', '#2b4426'], stamp: false });
    addTrees(c, gpts.slice(4), { kind: 'bush', scale: 1.5, colors: ['#d2557f', '#e07aa0', '#c84a78'], stamp: false });
    // shore boulders and old volcanic bombs
    const rp = scatter(c, 110, (h, s, x, z) => h < c.water + .14 && h > c.water - .1).concat(scatter(c, 40, (h, s, x, z) => land(h, s, x, z) && h > .5)), rg = lumpy(new T.DodecahedronGeometry(1, 1), .45, 6), rk = inst(rg, new T.MeshStandardMaterial({ roughness: .95 }), rp.length), tc = new T.Color();
    rp.forEach(([x, h, z], i) => { const s = rnd(.04, .13); _P.set(x, h + s * .2, z); _Q.setFromEuler(new T.Euler(rnd(TAU), rnd(TAU), rnd(TAU))); _S.set(s, s * rnd(.55, .9), s * rnd(.8, 1.2)); _M.compose(_P, _Q, _S); rk.setMatrixAt(i, _M); rk.setColorAt(i, tc.copy(col(pick(['#5a5048', '#6a5e52', '#7a6c5c', '#4a423c']))).multiplyScalar(rnd(.85, 1.1))); });
    c.group.add(rk);
    // wildflowers: poppies, broom, chamomile
    const fp = scatter(c, 1100, (h, s, x, z) => land(h, s, x, z) && h < 1.1 && s < .8), fm = inst(new T.IcosahedronGeometry(.012, 0), new T.MeshStandardMaterial({ roughness: .6 }), fp.length, false);
    fp.forEach(([x, h, z], i) => { _P.set(x, h + .008, z); _Q.identity(); _S.setScalar(rnd(.6, 1.3)); _M.compose(_P, _Q, _S); fm.setMatrixAt(i, _M); fm.setColorAt(i, tc.copy(col(pick(['#d8322a', '#d8322a', '#e8c22a', '#f2efe6', '#9a7ac8'])))); });
    c.group.add(fm);
    c.lava = mesh(new T.CircleGeometry(.24, 28).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: new T.Color(3, 1, .25), transparent: true, opacity: .3, blending: T.AdditiveBlending, depthWrite: false }), c.group, c.cx, c.cy - .01, c.cz); c.lava.castShadow = false;
    c.vents = [0, 1, 2].map(() => { const a = rnd(-1.2, 1.6) + Math.PI / 4, rr2 = rnd(.45, .8); return [c.cx + Math.cos(a) * rr2, 0, c.cz + Math.sin(a) * rr2]; }); c.vents.forEach(p => p[1] = c.hAt(p[0], p[2]));
    c.pl.color.set('#ff6a20'); c.pl.position.set(c.cx, c.cy + .6, c.cz); c.pl.distance = 10; c.glow = { x: c.cx, y: c.cy + .2, z: c.cz, i: 0, col: '#ff5a18' };
  },
  update(c, t, dt) {
    const { P, Sm } = c, cx = c.cx, cz = c.cz, night = NIGHT[MOD.time], e = c.userEvent ? t - B0 : -1;
    const BL = 1.1, CE = 12.5, PF = 4.6, CH = 6.4;
    // always-on: fountain, lamps, calm fumarole and flank vents
    if (c.fountain && R() < dt * 30) { const [fx, fy, fz] = c.fountain; Sm.emit(fx + rnd(-.01, .01), fy + .07, fz + rnd(-.01, .01), rnd(-.06, .06), rnd(.3, .45), rnd(-.06, .06), .6, [.9, .96, 1, .7], [.9, .96, 1, 0], .012, .02, -1.6, 0); }
    const late = e > CE + 4 ? clamp(1 - (e - CE - 4) / 14, 0, 1) : 0;
    if (e < 0 || e > CE + 4) { if (R() < dt * (9 + late * 50)) { const k = late; Sm.emit(cx + rnd(-.14, .14), c.cy + .05, cz + rnd(-.14, .14), rnd(-.03, .03), rnd(.2, .34) + k * .4, rnd(-.03, .03), rnd(6, 9), [lerp(.93, .36, k), lerp(.92, .33, k), lerp(.92, .31, k), .45], [.95, .95, .95, 0], .12 + k * .1, .8 + k * .6, 0, .15); }
      if (R() < dt * 3) { const v = pick(c.vents); Sm.emit(v[0], v[1] + .02, v[2], 0, rnd(.08, .16), 0, rnd(3, 5), [.95, .95, .92, .3], [1, 1, 1, 0], .04, .22, 0, .2); } }
    const calmGlow = .1 + .4 * night;
    if (e < 0) { c.lava.material.opacity = .22 + .5 * night; c.glow.i = calmGlow; c.pl.intensity = .4 * night; return; }
    if (once(c, 'v0')) { c.vz = { bombs: [], flows: [], lava: [], fires: [], nb: 0, nl: .5, thT: 0, tpT: 0, back: false }; c.scare = clock; c.panic = 1; c.threat = { x: cx, z: cz, r: 40, on: true }; sfx.rumble(2.4); tone(36, 2.2, { vol: .25, to: 30 }); }
    const vz = c.vz;
    if (e < BL) { c.shake = Math.max(c.shake, .015 + e * .05); for (let i = 0; i < nOf(160, dt); i++) Sm.emit(cx + rnd(-.15, .15), c.cy, cz + rnd(-.15, .15), rnd(-.1, .1), rnd(1, 2.2), rnd(-.1, .1), rnd(1.5, 2.5), [.95, .95, .93, .7], [.8, .8, .8, 0], .08, .4, 0, .4);
      c.vents.forEach(v => { if (R() < dt * 25) Sm.emit(v[0], v[1], v[2], 0, rnd(.4, .8), 0, rnd(1.5, 2.5), [.9, .9, .88, .6], [.9, .9, .9, 0], .05, .3, 0, .3); }); }
    if (e >= BL && once(c, 'blast')) {
      flash('#fff2dc', .95); fxBoost = 1; c.shake = .75; sfx.boom(2.4); sfx.boom(1.3); sfx.crackle(2); noise(11, { ff: 170, to: 55, vol: .5, attack: .04 }); noise(9, { filter: 'bandpass', ff: 420, to: 140, q: .7, vol: .2, attack: .5 });
      if (!c.f._blown) { c.f._blown = 1; c.deform(cx, cz, .62, (h, d) => d < 1 ? h - .5 * (1 - d * d) : h, d => d < .8 ? ['#4a2018', .9] : d < 1.4 ? ['#3a302c', (1.4 - d) / .6 * .7] : null); c.cy = c.hAt(cx, cz) + .03; c.lava.position.y = c.cy - .01; c.lava.scale.setScalar(1.7); c.pl.position.y = c.cy + .6; c.glow.y = c.cy + .2; }
      c.dome = mesh(new T.SphereGeometry(1, 40, 18, 0, TAU, 0, Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, depthWrite: false, side: T.DoubleSide }), c.group, cx, c.cy - .2, cz); c.dome.castShadow = false; c.domeT = 0;
      c.rings.push({ m: ringMesh(c, cx, c.cy - .15, cz), t: 0 }); c.rings.push({ m: ringMesh(c, cx, c.water + .02, cz), t: -.25 });
      for (let i = 0; i < 3200; i++) { const a = rnd(TAU), el = rnd(.15, 1.45), v = rnd(1.4, 6.5); P.emit(cx, c.cy + .1, cz, Math.cos(a) * Math.cos(el) * v, Math.sin(el) * v, Math.sin(a) * Math.cos(el) * v, rnd(1.2, 2.8), [1, .9, .6, 1], [.7, .12, .02, 0], .1, .03, -5, .25); }
      for (let i = 0; i < 700; i++) { const a = rnd(TAU), el = rnd(.3, 1.4), v = rnd(1, 4.5); Sm.emit(cx, c.cy + .1, cz, Math.cos(a) * Math.cos(el) * v, Math.sin(el) * v, Math.sin(a) * Math.cos(el) * v, rnd(1.5, 3), [.14, .11, .1, 1], [.2, .18, .16, 0], .05, .04, -6, .2); }
      c.pl.intensity = 14;
    }
    if (c.dome) { c.domeT += dt; c.dome.scale.setScalar(.3 + c.domeT * 6.5); c.dome.material.opacity = Math.max(0, .5 - c.domeT * .5) * (c.fadeA ?? 1); if (c.domeT > 1.1) { c.group.remove(c.dome); c.dome.geometry.dispose(); c.dome.material.dispose(); c.dome = null; } }
    updRings(c, dt, 4.5);
    const colK = e < BL ? 0 : e < CE ? Math.min(1, (e - BL) / .4) : Math.max(0, 1 - (e - CE) / 3), canK = e < BL + .9 ? 0 : e < CE + 1 ? Math.min(1, (e - BL - .9) / 1.2) : Math.max(0, 1 - (e - CE - 1) / 4);
    if (colK > 0) { const cy = c.cy;
      for (let i = 0; i < nOf(1700 * colK, dt); i++) { const a = rnd(TAU), r0 = rnd(0, .26), sp = rnd(.1, .75); Sm.emit(cx + Math.cos(a) * r0, cy + rnd(0, .3), cz + Math.sin(a) * r0, Math.cos(a) * sp, rnd(4.8, 7.4), Math.sin(a) * sp, rnd(2.6, 3.8), [.26, .22, .2, .96], [.62, .57, .53, .1], .38, 1.7, 0, .66, 0, .7); }
      for (let i = 0; i < nOf(500 * colK, dt); i++) P.emit(cx + rnd(-.22, .22), cy + Math.pow(R(), 2) * 3, cz + rnd(-.22, .22), 0, rnd(1.5, 3), 0, rnd(.4, .7), [1, .45, .12, .3], [.6, .12, .02, 0], .28, .12);
      for (let i = 0; i < nOf(1700 * colK, dt); i++) P.emit(cx + rnd(-.09, .09), cy, cz + rnd(-.09, .09), rnd(-.9, .9), rnd(2.6, 6.6), rnd(-.9, .9), rnd(1.2, 2.2), [1, .95, .65, 1], [.8, .14, .02, 0], .075, .03, -6, .2);
      c.shake = Math.max(c.shake, .06 * colK); if (R() < dt * 6) sfx.crackle(.8); if (R() < dt * 1.5) sfx.thump();
      vz.nb -= dt; while (vz.nb <= 0 && colK > .3) { vz.nb += rnd(.04, .12); const a = rnd(TAU), sp = rnd(.5, 2.7); vz.bombs.push({ x: cx, y: cy + .1, z: cz, vx: Math.cos(a) * sp, vy: rnd(4, 7.2), vz: Math.sin(a) * sp }); } }
    if (canK > 0) for (let i = 0; i < nOf(480 * canK, dt); i++) { const a = rnd(TAU), sp = rnd(.5, 2), w = .4; Sm.emit(cx + rnd(-.5, .5), c.cy + CH + rnd(-.5, .7), cz + rnd(-.5, .5), Math.cos(a) * sp + w, rnd(-.12, .28), Math.sin(a) * sp - w * .3, rnd(6, 10), [.46, .41, .38, .92], [.64, .6, .56, 0], .9, 1.9, 0, .3, 0, -1); }
    // volcanic bombs: ballistic, smoking, setting fires where they land
    vz.bombs = vz.bombs.filter(b => { const ox = b.x, oy = b.y, oz = b.z; b.vy -= 6 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      P.emit(b.x, b.y, b.z, 0, 0, 0, .05, [1, .85, .5, 1], [1, .6, .2, 1], .15, .13);
      for (let q = 0; q < 5; q++) { const f = R(); P.emit(lerp(ox, b.x, f), lerp(oy, b.y, f), lerp(oz, b.z, f), rnd(-.04, .04), rnd(-.04, .04), rnd(-.04, .04), rnd(.35, .6), [1, .6, .2, .8], [.6, .1, 0, 0], .07, .02); }
      for (let q = 0; q < 2; q++) { const f = R(); Sm.emit(lerp(ox, b.x, f), lerp(oy, b.y, f), lerp(oz, b.z, f), 0, .05, 0, rnd(1.5, 2.5), [.24, .21, .19, .7], [.4, .38, .36, 0], .05, .26, 0, .3); }
      if (Math.abs(b.x) > 3.18 || Math.abs(b.z) > 3.18) return b.y > -3;
      const g = c.hAt(b.x, b.z), wet = g < c.water; if (b.y > (wet ? c.water : g)) return true;
      if (wet) { for (let i = 0; i < 30; i++) Sm.emit(b.x, c.water, b.z, rnd(-.3, .3), rnd(.6, 1.6), rnd(-.3, .3), rnd(.8, 1.6), [1, 1, 1, .85], [1, 1, 1, 0], .03, .1, -2.5, .3); return false; }
      for (let i = 0; i < 40; i++) P.emit(b.x, g + .02, b.z, rnd(-.6, .6), rnd(.3, 1.4), rnd(-.6, .6), rnd(.3, .8), [1, .8, .4, 1], [.8, .2, 0, 0], .05, .02, -4);
      for (let i = 0; i < 16; i++) Sm.emit(b.x, g + .02, b.z, rnd(-.3, .3), rnd(.2, .6), rnd(-.3, .3), rnd(1.5, 2.5), [.42, .36, .3, .8], [.5, .45, .4, 0], .06, .3, 0, 1);
      if (vz.fires.length < 45) vz.fires.push({ x: b.x, y: g, z: b.z, t: rnd(5, 10) }); c.stamp(b.x, b.z, .09, .4);
      c.treeSets.forEach(ts => ts.pts.forEach((p, i) => { if (Math.abs(p[0] - b.x) < .3 && Math.abs(p[2] - b.z) < .3) ts.knock(i, Math.atan2(p[2] - b.z, p[0] - b.x)); }));
      if (clock - vz.tpT > .12) { vz.tpT = clock; noise(.4, { ff: 300, to: 70, vol: .12 }); } return false; });
    vz.fires = vz.fires.filter(f => { f.t -= dt; const k = Math.min(1, f.t / 2);
      for (let i = 0; i < nOf(34 * k, dt); i++) P.emit(f.x + rnd(-.035, .035), f.y + .01, f.z + rnd(-.035, .035), rnd(-.04, .04), rnd(.3, .7), rnd(-.04, .04), rnd(.3, .6), [1, .75, .3, .9], [.9, .2, .02, 0], .055, .02);
      if (R() < dt * 7 * k) Sm.emit(f.x, f.y + .06, f.z, rnd(-.03, .03), rnd(.3, .5), rnd(-.03, .03), rnd(2.5, 3.5), [.2, .18, .17, .6], [.35, .33, .32, 0], .06, .38, 0, .2); return f.t > 0; });
    // volcanic lightning in the ash column
    if (e > BL + .4 && e < CE) { vz.nl -= dt; if (vz.nl <= 0) { vz.nl = rnd(.1, .45); let x = cx + rnd(-1, 1), y = c.cy + rnd(2.6, CH + .4), z = cz + rnd(-1, 1);
      const seg = (n, br) => { for (let s = 0; s < n; s++) { const nx = x + rnd(-.28, .28), ny = y - rnd(.15, .38), nzz = z + rnd(-.28, .28); for (let q = 0; q < 6; q++) { const f = q / 6; P.emit(lerp(x, nx, f), lerp(y, ny, f), lerp(z, nzz, f), 0, 0, 0, .2, [.85, .9, 1, 1], [.5, .6, 1, 0], .09, .05); } x = nx; y = ny; z = nzz; if (br && R() < .3) { const sv = [x, y, z]; seg(4, false); [x, y, z] = sv; } } };
      seg(Math.floor(rnd(7, 13)), true); flashLight = Math.max(flashLight, .9); SKYU.uFlashC.value.setRGB(.55, .6, 1); if (clock - vz.thT > .45) { vz.thT = clock; sfx.thunder(); } } }
    // pyroclastic flows: the column collapses and glowing avalanches race downhill and out over the sea
    const spawnFlows = n2 => { for (let k = 0; k < n2; k++) { const a = k / n2 * TAU + rnd(-.18, .18); if (Math.cos(a - BACKA) > .5) continue; vz.flows.push({ x: cx + Math.cos(a) * .42, z: cz + Math.sin(a) * .42, dx: Math.cos(a), dz: Math.sin(a), sp: rnd(.5, .9), t: 0, st: 0, sea: 0 }); } };
    if (e >= PF && once(c, 'pf1')) { spawnFlows(16); sfx.rumble(6); } if (e >= PF + 3.6 && once(c, 'pf2')) spawnFlows(12);
    vz.flows = vz.flows.filter(f => { f.t += dt; const ee = .07, gx = c.hAt(f.x + ee, f.z) - c.hAt(f.x - ee, f.z), gz = c.hAt(f.x, f.z + ee) - c.hAt(f.x, f.z - ee), gl = Math.hypot(gx, gz) + 1e-5;
      f.dx = lerp(f.dx, -gx / gl, .07); f.dz = lerp(f.dz, -gz / gl, .07); const dl = Math.hypot(f.dx, f.dz) || 1; f.dx /= dl; f.dz /= dl;
      const h = c.hAt(f.x, f.z), wet = h < c.water; f.sp = wet ? f.sp * Math.exp(-dt * .9) : Math.min(2.6, f.sp + (gl / (2 * ee)) * 1.6 * dt - .15 * dt); f.x += f.dx * f.sp * dt; f.z += f.dz * f.sp * dt; const y = wet ? c.water : h;
      for (let i = 0; i < nOf(85, dt); i++) Sm.emit(f.x + rnd(-.13, .13), y + rnd(0, .1), f.z + rnd(-.13, .13), f.dx * f.sp * .45 + rnd(-.1, .1), rnd(.15, .55), f.dz * f.sp * .45 + rnd(-.1, .1), rnd(2.4, 4.4), [.36, .31, .28, .92], [.62, .58, .54, 0], .17, .78, 0, .8);
      for (let i = 0; i < nOf(24, dt); i++) P.emit(f.x + rnd(-.08, .08), y + .04, f.z + rnd(-.08, .08), f.dx * f.sp * .4, rnd(.1, .3), f.dz * f.sp * .4, rnd(.3, .6), [1, .45, .12, .55], [.6, .12, .02, 0], .07, .03);
      if (wet) for (let i = 0; i < nOf(50, dt); i++) Sm.emit(f.x + rnd(-.15, .15), c.water, f.z + rnd(-.15, .15), rnd(-.1, .1), rnd(.5, 1.1), rnd(-.1, .1), rnd(1.4, 2.4), [.97, .97, .96, .7], [.95, .95, .95, 0], .06, .32, 0, .4);
      f.st -= dt; if (f.st <= 0 && !wet) { f.st = .08; c.stamp(f.x, f.z, .14, .55); c.treeSets.forEach(ts => ts.pts.forEach((p, i) => { if (Math.abs(p[0] - f.x) < .22 && Math.abs(p[2] - f.z) < .22) ts.knock(i, Math.atan2(f.dz, f.dx)); })); }
      return f.sp > .12 && f.t < 10 && Math.abs(f.x) < 3.15 && Math.abs(f.z) < 3.15; });
    // lava rivers down the cone
    if (e >= BL + .8 && once(c, 'lava')) for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + rnd(-.25, .25); if (Math.cos(a - BACKA) > .6) continue; vz.lava.push({ x: cx + Math.cos(a) * .36, z: cz + Math.sin(a) * .36, live: 1 }); }
    if (e < 30) vz.lava.forEach(r => { if (r.live) { const ee = .06, h = c.hAt(r.x, r.z), gx = c.hAt(r.x + ee, r.z) - c.hAt(r.x - ee, r.z), gz = c.hAt(r.x, r.z + ee) - c.hAt(r.x, r.z - ee), gl = Math.hypot(gx, gz) || 1; r.x -= (gx / gl + rnd(-.5, .5)) * .26 * dt; r.z -= (gz / gl + rnd(-.5, .5)) * .26 * dt; if (h < c.water + .02 || Math.abs(r.x) > 3.1 || Math.abs(r.z) > 3.1) r.live = 0;
        for (let q = 0; q < 2; q++) P.emit(r.x + rnd(-.02, .02), h + .02, r.z + rnd(-.02, .02), 0, 0, 0, rnd(5, 7), [1, .62, .16, 1], [.32, .03, 0, 0], .085, .05, 0, 0, 0, 1.8); }
      else if (R() < dt * 30 && e < 26) Sm.emit(r.x, c.water + .02, r.z, rnd(-.05, .05), rnd(.4, .8), rnd(-.05, .05), rnd(2, 3), [.96, .96, .95, .6], [1, 1, 1, 0], .07, .35, 0, .3); });
    // ash fall across the whole world
    const ashK = e < 3 ? 0 : e < 18 ? Math.min(1, (e - 3) / 3) : Math.max(0, 1 - (e - 18) / 8);
    for (let i = 0; i < nOf(650 * ashK, dt); i++) Sm.emit(rnd(-3.1, 3.1), rnd(2.4, 3.6), rnd(-3.1, 3.1), .1 + rnd(-.05, .05), rnd(-.7, -.4), rnd(-.05, .05), rnd(4, 6), [.4, .38, .36, .55], [.42, .4, .38, 0], .028, .028, 0, 0, 0, -1);
    // sky, light and camera follow the eruption
    const sk = e < BL ? 0 : e < 17 ? Math.min(1, (e - BL) / 2) : Math.max(0, 1 - (e - 17) / 14);
    c.skyOv = { top: '#0e0605', mid: '#5a1a0c', hor: '#ff6420', low: '#2c1610', k: sk, lum: 1 };
    if (sk > 0) { palT = resolvePal(mixPal(computePal(), ERUPT_PAL, sk)); palRate = 2; vz.back = true; } else if (vz.back) { vz.back = false; setPal(computePal(), 1); }
    const lavaK = Math.max(colK, (e < 30 ? .55 : 0)); c.lava.material.opacity = Math.max(.22 + .5 * night, lavaK * (.8 + R() * .2));
    c.glow.i = Math.max(calmGlow, (colK * 1.5 + lavaK * .4) * (1 + .3 * Math.sin(clock * 13) * R()));
    c.pl.intensity = Math.max(.4 * night, lerp(c.pl.intensity, colK * (6 + R() * 3) + lavaK * 2, 1 - Math.exp(-dt * 6)));
    if (e >= BL - .5 && e < 17) { c.camZoom = 1.55; c.camLift = 4.2; c.camEl = .6; c.camDeck = .8; c.camDrop = 3.6; c.camRate = 1; } else if (c.camZoom) { c.camZoom = c.camLift = c.camEl = c.camDeck = c.camDrop = undefined; c.camRate = .7; }
    if (e > 22) { c.panic = 0; c.threat = null; }
  } });

story({ id: 'impact', mood: ['sus', 130.81],
  caption: () => ({ era: 'Late Cretaceous · 66 million years ago', name: pick(['The Last Afternoon', 'Chicxulub, Briefly', 'A Very Bad Tuesday']), line: pick(['Something bright crosses the sky. The ferns do not look up.', 'Ten kilometres of rock arrives at twenty kilometres a second.']) }),
  water: .12, waterCol: '#3a6a5a', waterTop: '#4a8a70', waterDeep: '#18352c', strata: ['#6a5440', '#7d6248', '#5a4634', '#8a7052', '#4a3a2c'], soil: '#3a2a1c',
  pal: { sky: '#fff2d8', ground: '#4a5a3a', hemiI: .8, sun: '#fff0d0', sunI: 1, dir: [-5, 10, -3], dim: 1 },
  calm: { sky: '#ffb080', ground: '#3a2a20', hemiI: .55, sun: '#ff8a4a', sunI: .8, dir: [8, 3, -2], dim: .7, tint: '#6a3a20' },
  height(u, v, n) { let h = .35 + n.fbm(u * 1.8, v * 1.8) * .45; const rv = v - .25 * Math.sin(u * 3.2) - .15; return h - Math.exp(-rv * rv / .006) * .32; },
  color(h, s, u, v, n) { if (h < .16) return '#7a6a48'; if (s > .9) return '#6a5a40'; return n.vn(u * 6, v * 6) > .1 ? '#3f6a2a' : (n.vn(u * 11 + 4, v * 11) > 0 ? '#4d7a30' : '#5d8a38'); },
  build(c) {
    c.tr = addTrees(c, scatter(c, 260, (h, s) => h > .18 && s < .9), { kind: pick(['cone', 'round']), colors: ['#2c5a24', '#3a6a2a', '#4a7a30', '#5a7a2a'] });
    const ix = rnd(-1.1, 1.1), iz = rnd(-1.1, 1.1); c.ip = [ix, c.hAt(ix, iz), iz];
    c.met = new T.Mesh(new T.SphereGeometry(.09, 12, 8), new T.MeshBasicMaterial({ color: 0xfff2d0 })); c.met.visible = false; c.group.add(c.met);
    c.ring = new T.Mesh(new T.RingGeometry(.85, 1, 64), new T.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    c.ring.rotation.x = -Math.PI / 2; c.ring.position.set(ix, c.ip[1] + .06, iz); c.group.add(c.ring); c.pl.color.set('#ffb060'); c.pl.position.set(ix, c.ip[1] + .5, iz);
  },
  update(c, t, dt) {
    const { P, Sm } = c, [ix, iy, iz] = c.ip, T1 = B0 + .75;
    if (t >= B0 && t < T1) { const k = Math.pow((t - B0) / .75, 2), m = c.met; m.visible = true; m.position.set(lerp(ix - 5, ix, k), lerp(iy + 6.5, iy, k), lerp(iz - 3.6, iz, k)); for (let i = 0; i < nOf(900, dt); i++) P.emit(m.position.x + rnd(-.04, .04), m.position.y + rnd(-.04, .04), m.position.z + rnd(-.04, .04), rnd(-.2, .2), rnd(-.2, .2), rnd(-.2, .2), rnd(.35, .7), [1, 1, .9, 1], [1, .4, .1, 0], .1, .03); if (once(c, 'wh')) sfx.whistle(1600, 180, .75); }
    if (t >= T1 && once(c, 'hit')) {
      c.met.visible = false; flash('#fff3d6', .9); c.shake = .35; sfx.boom(1.6); sfx.crackle(1.2);
      c.deform(ix, iz, .75, (h, d) => d < 1 ? h - .42 * (1 - d * d) + .14 * Math.exp(-Math.pow(d - .95, 2) / .008) : h + .1 * Math.exp(-Math.pow(d - 1, 2) / .02), d => d < 1 ? ['#2a2420', 1] : d < 1.7 ? ['#6a5a48', (1.7 - d) / .7] : null);
      c.tr.pts.forEach((p, i) => { if (Math.hypot(p[0] - ix, p[2] - iz) < 1.9) c.tr.hide(i); });
      for (let i = 0; i < 900; i++) { const a = rnd(TAU), el = rnd(.3, 1.3), v = rnd(1.2, 4); P.emit(ix, iy + .05, iz, Math.cos(a) * Math.cos(el) * v, Math.sin(el) * v + 1, Math.sin(a) * Math.cos(el) * v, rnd(1, 2.4), [1, .85, .5, 1], [.5, .12, .02, 0], .06, .02, -5, .3); }
      for (let i = 0; i < 420; i++) { const a = rnd(TAU), sp = rnd(.8, 2.4); Sm.emit(ix + rnd(-.2, .2), iy + .05, iz + rnd(-.2, .2), Math.cos(a) * sp, rnd(.1, .6), Math.sin(a) * sp, rnd(4, 7), [.45, .36, .28, .85], [.55, .47, .4, 0], .2, 1, 0, 1.1, 0, 1.5); }
      c.pl.intensity = 6;
    }
    if (t > T1) { const e = t - T1; c.ring.scale.setScalar(.1 + e * 3.6); c.ring.material.opacity = Math.max(0, .9 - e * .75); c.pl.intensity = Math.max(.5, c.pl.intensity - dt * 3.5); if (t > B1 && t < E) for (let i = 0; i < nOf(16, dt); i++) P.emit(ix + rnd(-.4, .4), iy - .2, iz + rnd(-.4, .4), 0, rnd(.05, .25), 0, rnd(1.5, 3), [1, .55, .15, .9], [.4, .05, 0, 0], .05, .02); }
  } });

story({ id: 'festival', frame: { zoom: 1.9, el: .55, pull: .8, lift: 1.7, side: .1, deck: .9, drop: 3.7, focus: 1.6 }, depth: 1.5, nseg: 150, cloudY: 2.6, cloudN: .8, preset: { time: 3, clouds: 1, rain: 0, wind: 0, glow: 3, life: 1 }, mood: ['major', 174.61],
  caption: () => ({ era: pick(['Midsummer · 23:58', '31 December · 23:59:59', 'Festival of Lights · night three']), name: pick(['Midsummer Night', 'The Harbour Festival', 'New Year, in Miniature']), line: pick(['The whole village came out for this. Even the cat.', 'Somebody over-ordered the fireworks. Nobody minds.']) }),
  water: .17, waves: true, waterCol: '#24728a', waterTop: '#62b0b8', waterDeep: '#08263a', aquatic: { schools: 4, big: 1, size: .075, cols: ['#7a7458', '#8a7f62', '#5e6450'], bigCol: '#5a5040' }, strata: ['#4a3a2c', '#5a4636', '#3a2e24', '#6a5440'], soil: '#2a2018',
  pal: { sky: '#5a6aa8', ground: '#141824', hemiI: .42, sun: '#a8b8ff', sunI: .4, dir: [5, 9, -4], dim: .32, tint: '#2a2a4a' },
  calm: { sky: '#6a7ab0', ground: '#1a1e2a', hemiI: .45, sun: '#c8d0ff', sunI: .45, dir: [4, 9, -5], dim: .38, tint: '#2a2a4a' },
  // an alpine valley: a wall of peaks massed in the far corner, a river gorge sawn through them, the village on the
  // middle terraces, and a lake at the near corner that breaks through both cut walls
  height(u, v, n) { const b = -(u + v) * .5, pk = Math.max(0, b + .02);
    let h = .36 + n.fbm(u * 1.6 + 9, v * 1.6) * .22 + Math.max(0, b + .3) * .32;
    h += Math.min(3.6, Math.pow(pk, 1.3) * (2.7 + n.ridge(u * 2.7 + 1, v * 2.3, 5) * 1.7) * (.9 + .3 * n.fbm(u * 1.3 + 4, v * 1.3 - 2)));
    const rv = u - .2 * Math.sin(v * 2.5) + .05, gw = .012 + pk * .05; h -= Math.exp(-rv * rv / gw) * (.3 + pk * 1.6);
    const lk = clamp((-b - .42) / .3, 0, 1); h = lerp(h, -.25 + n.fbm(u * 4, v * 4) * .06, lk * lk * (3 - 2 * lk));
    return h; },
  color(h, s, u, v, n) { const sl = 1.75 + n.fbm(u * 5, v * 5) * .35; if (h < .2) return h < .1 ? '#3e4a40' : '#5a5a48'; if (h > sl) return s > 1.9 ? '#8a8e98' : (n.vn(u * 20, v * 20) > -.2 ? '#eef1f6' : '#cfd4dc'); if (h > sl - .3) return s > 1.2 ? '#5a5a60' : '#9aa0a8'; if (s > 1.15) return h > .9 ? '#4a4a50' : (n.vn(u * 9, h * 8) > 0 ? '#4a4438' : '#3a3a30'); if (h > 1.15) return n.vn(u * 9, v * 9) > 0 ? '#4a5a3a' : '#56603e'; return n.vn(u * 7, v * 7) > 0 ? '#2f4a2a' : '#3a5530'; },
  build(c) {
    c.hs = addHouses(c, scatter(c, 55, (h, s, x, z) => h > .22 && h < .75 && s < .4 && Math.abs(x) < 2.6), {});
    c.hs.pts.forEach(([x, h, z]) => c.G.emit(x, h + .06, z, 0, 0, 0, 1e6, [1, .72, .35, .55], [1, .72, .35, .55], .16, .16));
    for (let k = 0; k < 26; k++) { const z = -3 + k * .24, x = .2 * Math.sin(z / 3.2 * 2.5) * 3.2 + (k % 2 ? .34 : -.34), h = c.hAt(x, z); if (h > c.water + .02) c.G.emit(x, h + .12, z, 0, 0, 0, 1e6, [1, .66, .28, .9], [1, .66, .28, .9], .07, .07); }
    addTrees(c, scatter(c, 260, (h, s) => h > .25 && h < 1.5 && s < 1.25), { kind: 'cone', colors: ['#1f3a22', '#284a2a', '#1a3320'] });
    addTrees(c, scatter(c, 70, (h, s) => h > 1.3 && h < 1.8 && s < 1), { kind: 'cone', scale: .6, colors: ['#2a3a2a', '#324030'] });
    const m = new T.Mesh(new T.SphereGeometry(.3, 24, 16), new T.MeshBasicMaterial({ color: col('#f4eed8') })); m.position.set(-1.2, 4.6, -3.0); c.group.add(m); c.shells = []; c.sparks = []; c.next = 0;
    c.FW = new PSys(26000, true); c.FW.mat.uniforms.uSoft.value = 2; c.FW.pts.renderOrder = 4; c.group.add(c.FW.pts);
  },
  update(c, t, dt) {
    // fireworks: every spark is tracked, so it falls under gravity and drag, fades through its colour and leaves a crisp trail
    const FW = c.FW, s = c.userEvent ? t - B0 : -1, SPK = c.sparks;
    FW.mat.uniforms.uScale.value = c.P.mat.uniforms.uScale.value; FW.mat.uniforms.uFade.value = c.fadeA ?? 1;
    const FCOL = { red: [1, .16, .1], gold: [1, .64, .22], green: [.3, 1, .35], blue: [.25, .42, 1], purple: [.72, .3, 1], white: [1, .96, .9], orange: [1, .42, .1], silver: [.85, .88, 1] };
    const spark = (x, y, z, vx, vy, vz, o) => SPK.push(Object.assign({ x, y, z, vx, vy, vz, age: 0, life: rnd(1.3, 1.9), col: FCOL.white, end: [1, .3, .1], drag: 1.3, g: 1.1, trail: .18, size: .02, ph: rnd(TAU) }, o));
    const sphere = (sp) => { const th = rnd(TAU), ph = Math.acos(rnd(-1, 1)); sp *= 1.5; return [Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp]; }; c.flyG.visible = !(s >= 0 && s < 17);
    const burst = sh => { const { x, y, z, kind } = sh, A = FCOL[sh.c1], B = FCOL[sh.c2];
      if (kind === 'peony' || kind === 'double') { for (let i = 0; i < 160; i++) { const v = sphere(rnd(1.35, 1.6)); spark(x, y, z, ...v, { col: R() < .5 ? A : B, trail: .12 }); }
        if (kind === 'double') for (let i = 0; i < 70; i++) { const v = sphere(rnd(.6, .75)); spark(x, y, z, ...v, { col: FCOL.white, end: B, life: rnd(1, 1.3), trail: .1 }); } }
      else if (kind === 'chrys') for (let i = 0; i < 140; i++) { const v = sphere(rnd(1.4, 1.65)); spark(x, y, z, ...v, { col: A, trail: .55, life: rnd(1.5, 2) }); }
      else if (kind === 'willow') for (let i = 0; i < 80; i++) { const v = sphere(rnd(.95, 1.15)); spark(x, y, z, ...v, { col: FCOL.gold, end: [.9, .35, .05], drag: 2.2, g: .55, life: rnd(2.8, 3.6), trail: 1.5, size: .018 }); }
      else if (kind === 'ring') { const ax = new T.Vector3(rnd(-1, 1), rnd(.4, 1), rnd(-1, 1)).normalize(), e1 = new T.Vector3(1, 0, 0).cross(ax).normalize(), e2 = ax.clone().cross(e1); for (let i = 0; i < 110; i++) { const a = i / 110 * TAU, sp = 2.2; spark(x, y, z, (e1.x * Math.cos(a) + e2.x * Math.sin(a)) * sp, (e1.y * Math.cos(a) + e2.y * Math.sin(a)) * sp, (e1.z * Math.cos(a) + e2.z * Math.sin(a)) * sp, { col: A, trail: .2 }); }
        for (let i = 0; i < 30; i++) { const v = sphere(.35); spark(x, y, z, ...v, { col: B, life: 1, trail: .1 }); } }
      else if (kind === 'palm') for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, v = [Math.cos(a) * 1.75, rnd(1.2, 1.7), Math.sin(a) * 1.75]; spark(x, y, z, ...v, { col: FCOL.gold, end: [.9, .3, .05], drag: 1, g: 1, life: 2.2, trail: .9, size: .032, comet: 1 }); }
      else if (kind === 'crossette') for (let i = 0; i < 16; i++) { const v = sphere(1.45); spark(x, y, z, ...v, { col: A, trail: .3, life: .75, split: 1 }); }
      else if (kind === 'strobe') for (let i = 0; i < 130; i++) { const v = sphere(rnd(1.1, 1.5)); spark(x, y, z, ...v, { col: FCOL.white, end: FCOL.silver, trail: .04, life: rnd(2, 2.8), strobe: 1, g: .8 }); }
      else if (kind === 'crackle') for (let i = 0; i < 110; i++) { const v = sphere(rnd(1.2, 1.5)); spark(x, y, z, ...v, { col: FCOL.gold, trail: .35, life: rnd(1.2, 1.6), crackle: 1 }); }
      for (let i = 0; i < 12; i++) c.Sm.emit(x + rnd(-.25, .25), y + rnd(-.25, .25), z + rnd(-.25, .25), rnd(-.05, .05) + .05, rnd(-.02, .04), rnd(-.05, .05), rnd(6, 9), [.42, .42, .48, .26], [.5, .5, .55, 0], .3, 1.1, 0, .4);
      c.pl.position.set(x, y, z); c.pl.color.setRGB(...A); c.pl.intensity = 4; c.pl.distance = 7; flash(`rgb(${A.map(v => v * 255 | 0).join(',')})`, .1);
      sfx.boom(rnd(.35, .7)); if (kind === 'crackle' || kind === 'strobe') sfx.crackle(1.2); };
    // the show: single shells, then salvos, then a finale; about fifteen seconds
    if (s >= 0 && s < 15) { c.next -= dt; if (c.next <= 0) { const fin = s > 11.2; c.next = fin ? rnd(.07, .15) : s < 2.5 ? rnd(.45, .7) : rnd(.18, .42); const n = fin ? 1 : R() < .3 ? 3 : 1;
      for (let k = 0; k < n; k++) { const x = rnd(-1.7, 1.5), z = rnd(-1.5, 1.7), y0 = Math.max(c.hAt(x, z), c.water) + .03, H = rnd(2, 3.3) + (fin ? rnd(-.2, .4) : 0), g = 2.4;
        const kind = fin ? pick(['peony', 'chrys', 'crackle', 'strobe', 'willow', 'peony']) : pick(['peony', 'chrys', 'willow', 'ring', 'palm', 'crossette', 'strobe', 'crackle', 'double']), cs = Object.keys(FCOL);
        c.shells.push({ x, y: y0, z, vx: rnd(-.12, .12), vy: Math.sqrt(2 * g * (H - y0)), vz: rnd(-.12, .12), g, kind, c1: pick(cs), c2: pick(cs) }); if (R() < .35) sfx.whistle(rnd(700, 900), rnd(1800, 2400), .9); else sfx.launch(); } } }
    c.shells.forEach(sh => { sh.vy -= sh.g * dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.z += sh.vz * dt;
      for (let q = 0; q < 2; q++) FW.emit(sh.x + rnd(-.005, .005), sh.y - q * .01, sh.z + rnd(-.005, .005), rnd(-.06, .06), rnd(-.25, -.05), rnd(-.06, .06), rnd(.25, .5), [1, .72, .38, 1], [.8, .3, .08, 0], .016, .006, -.6, .6);
      if (sh.vy < .15) { sh.dead = 1; burst(sh); } });
    c.shells = c.shells.filter(sh => !sh.dead);
    for (let i = SPK.length - 1; i >= 0; i--) { const p = SPK[i]; p.age += dt; const k = p.age / p.life;
      if (p.split && p.age > p.life) { const ax = new T.Vector3(p.vx, p.vy, p.vz).normalize(), e1 = new T.Vector3(0, 1, 0).cross(ax).normalize(), e2 = ax.clone().cross(e1);
        [e1, e2, e1.clone().negate(), e2.clone().negate()].forEach(e => spark(p.x, p.y, p.z, p.vx * .3 + e.x * .9, p.vy * .3 + e.y * .9, p.vz * .3 + e.z * .9, { col: FCOL[pick(['white', 'gold', 'silver'])], life: rnd(.8, 1.1), trail: .25 })); if (R() < .3) sfx.crackle(.4); SPK.splice(i, 1); continue; }
      if (k >= 1) { if (p.crackle) { for (let q = 0; q < 3; q++) FW.emit(p.x + rnd(-.03, .03), p.y + rnd(-.03, .03), p.z + rnd(-.03, .03), 0, 0, 0, .06, [1, 1, .9, 1], [1, 1, .9, 0], .03, .02); if (R() < .02) sfx.crackle(.5); } SPK.splice(i, 1); continue; }
      const dr = Math.max(0, 1 - p.drag * dt); p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      let b = 1 - k * k * k; if (p.strobe) b *= Math.sin(p.age * 38 + p.ph) > .35 ? 1.5 : .04; if (p.crackle && k > .7) b *= R() < .5 ? 1.6 : .2;
      const cc = p.col, e = p.end, m = Math.pow(k, 1.6), r = lerp(cc[0], e[0], m), g = lerp(cc[1], e[1], m), bl = lerp(cc[2], e[2], m);
      FW.emit(p.x, p.y, p.z, 0, 0, 0, dt * 1.6, [r * 1.5, g * 1.5, bl * 1.5, b], [r, g, bl, b], p.size, p.size);
      if (p.trail > .05) FW.emit(p.x, p.y, p.z, rnd(-.02, .02), -.04, rnd(-.02, .02), p.trail * (p.comet ? 1 : rnd(.6, 1)), [r, g * .85, bl * .7, b * .8], [r * .7, g * .3, bl * .15, 0], p.size * (p.comet ? .8 : .6), p.size * .25, -.15, .4);
      if (p.comet && R() < .5) FW.emit(p.x, p.y, p.z, rnd(-.15, .15), rnd(-.2, .05), rnd(-.15, .15), rnd(.3, .6), [1, .85, .5, 1], [1, .5, .1, 0], .01, .004, -.8, .5); }
    FW.update(dt); c.pl.intensity = Math.max(0, c.pl.intensity - dt * 5);
  } });

story({ id: 'launch', mood: ['lydian', 196],
  caption: () => ({ era: pick(['16 July 1969 · 09:32', 'Year 2031 · T−0', 'Spaceport Nine · morning']), name: pick(['Launch Window', 'Ignition Sequence', 'Up and Away']), line: pick(['Seven and a half million pounds of thrust, and one very small pad.', 'The countdown ends. The sky gets a new line.']) }),
  water: .06, waves: true, waterCol: '#2a7a9a', waterTop: '#3a9ab8', waterDeep: '#0c3448', strata: ['#c9b48a', '#b8a078', '#a08a68', '#d4c098'], soil: '#8a7a5a',
  pal: { sky: '#dfeeff', ground: '#8a8060', hemiI: .85, sun: '#fff4e0', sunI: 1.05, dir: [-5, 10, -2], dim: 1 },
  calm: { sky: '#cfe0f8', ground: '#8a8060', hemiI: .8, sun: '#ffe8c8', sunI: .95, dir: [5, 9, -3], dim: .95 },
  height(u, v, n) { const pd = Math.hypot(u - .15, v - .05); const h = .12 + u * .22 + n.fbm(u * 2.5, v * 2.5) * .1; return pd < .16 ? .24 : pd < .26 ? lerp(.24, h, (pd - .16) / .1) : h; },
  color(h, s, u, v, n) { const pd = Math.hypot(u - .15, v - .05); if (pd < .16) return '#b9b4aa'; if (h < .1) return '#dccb9e'; if (Math.abs(v - .05) < .014 && u > .15) return '#8a8680'; return n.vn(u * 8, v * 8) > .15 ? '#7a8448' : '#8f9458'; },
  build(c) {
    addTrees(c, scatter(c, 70, (h, s, x, z) => h > .12 && Math.hypot(x / 3.2 - .15, z / 3.2 - .05) > .32), { kind: 'palm', colors: ['#3a5a2a', '#4a6a30'] });
    const px = .48, pz = .16; c.py = .24; c.vy = 0;
    const rk = c.rk = new T.Group(), white = new T.MeshStandardMaterial({ color: col('#f2f0ec'), roughness: .4 }), dark = new T.MeshStandardMaterial({ color: col('#24262a'), roughness: .5 });
    const part = (g, m, y, rx = 0) => { const o = new T.Mesh(g, m); o.position.y = y; o.rotation.x = rx; o.castShadow = true; rk.add(o); return o; };
    part(new T.CylinderGeometry(.065, .065, .5, 20), white, .32); part(new T.CylinderGeometry(.067, .067, .05, 20), dark, .59); part(new T.CylinderGeometry(.055, .065, .3, 20), white, .77); part(new T.ConeGeometry(.055, .16, 20), white, 1); part(new T.ConeGeometry(.05, .07, 14, 1, true), dark, .04, Math.PI);
    for (let i = 0; i < 4; i++) { const f = new T.Mesh(new T.BoxGeometry(.008, .12, .07), dark); f.position.set(Math.cos(i * Math.PI / 2) * .07, .12, Math.sin(i * Math.PI / 2) * .07); f.rotation.y = -i * Math.PI / 2; rk.add(f); }
    rk.position.set(px, c.py, pz); c.group.add(rk);
    const tw = new T.Mesh(new T.BoxGeometry(.07, 1.15, .07), new T.MeshStandardMaterial({ color: col('#b4502a'), roughness: .6 })); tw.position.set(px - .2, c.py + .575, pz); tw.castShadow = true; c.group.add(tw);
    const arm = new T.Mesh(new T.BoxGeometry(.14, .025, .03), tw.material); arm.position.set(px - .12, c.py + .85, pz); c.group.add(arm);
    c.pl.color.set('#ffa040');
  },
  update(c, t, dt) {
    const { P, Sm } = c, rk = c.rk;
    if (t < B0) { if (R() < dt * 20) Sm.emit(rk.position.x + .08, c.py + .6, rk.position.z, .1, .05, 0, 1.5, [1, 1, 1, .5], [1, 1, 1, 0], .05, .2, 0, .5); if (t > .05 && once(c, 'b1')) sfx.beep(); if (t > .3 && once(c, 'b2')) sfx.beep(); if (t > .55 && once(c, 'b3')) sfx.beep(1); }
    if (t > B0 && once(c, 'ign')) { sfx.rumble(5.5); flash('#ffd8a0', .35); }
    if (t > B0 + .7) { c.vy += 1.7 * dt; rk.position.y += c.vy * dt; }
    if (t > B0 && t < B1 + 1.2) {
      const x = rk.position.x, y = rk.position.y, z = rk.position.z, ground = y - c.py < .6; c.shake = Math.max(c.shake, ground ? .06 : .02);
      for (let i = 0; i < nOf(700, dt); i++) P.emit(x + rnd(-.03, .03), y - .02, z + rnd(-.03, .03), rnd(-.15, .15), rnd(-3, -1.8), rnd(-.15, .15), rnd(.25, .45), [1, .95, .8, 1], [1, .35, .05, 0], .09, .03);
      for (let i = 0; i < nOf(ground ? 90 : 40, dt); i++) { if (ground) { const a = rnd(TAU), sp = rnd(1.2, 2.6); Sm.emit(x, c.py + .05, z, Math.cos(a) * sp, rnd(.05, .4), Math.sin(a) * sp, rnd(3, 5.5), [.95, .93, .9, .85], [.9, .88, .86, 0], .18, .75, 0, 1.6, 0, 1.4); } else Sm.emit(x + rnd(-.03, .03), y - .1, z + rnd(-.03, .03), rnd(-.06, .06), rnd(-.3, 0), rnd(-.06, .06), rnd(5, 7), [.98, .97, .95, .8], [.9, .9, .9, 0], .1, .55, 0, .3, 0, 1.5); }
      c.pl.position.set(x, y - .1, z); c.pl.intensity = 3 + rnd(0, 1);
    } else c.pl.intensity = Math.max(0, c.pl.intensity - dt * 4);
  } });

/* The Buried Temple: a sea of dunes under a low sun. Long ridges with soft windward backs and steep slip faces grow
   toward the far corner into a star dune, a banded sandstone jebel stands to the right, and a spring-fed oasis breaks
   through the near wall. Sand streams off every crest, ruins lie half swallowed (a colossal head, an obelisk, a broken
   colonnade, the tops of a gateway), and vultures circle. EVENT: a magnitude-nine earthquake drains the great dune in
   the middle into a sunken court and a lost Roman cathedral stands revealed, sand pouring from its carved windows, unlit
   and silent, until the sand returns. */
const DTC = [-.12, -.2], DOA = [.36, .8], DJB = [.55, -.72], PLZ = .06; // temple, oasis, jebel (u, v); the sunken court's floor // temple, oasis, jebel (u, v)
const dJebel = (u, v, n) => Math.hypot((u - DJB[0]) * 1.1, (v - DJB[1]) * .9) / .22 + n.fbm(u * 6 + 3, v * 6) * .35;
story({ id: 'dunes', frame: { zoom: 1.9, el: .5, deck: .9, drop: 3.5 }, depth: 1.5, nseg: 150, surf: 0, glints: 12, cloudN: .3, cloudY: 3.2, pmax: [9000, 16000], preset: { time: 2, clouds: 0, rain: 0, wind: 2, glow: 1, life: 1 }, mood: ['sus', 130.81],
  caption: () => ({ era: pick(['Empty Quarter · 17:50', 'Erg of the Western Wind', 'Year unknown · the sand remembers']), name: pick(['The Buried Temple', 'Sea of Sand', 'Where the Dunes Walk']), line: pick(['The dunes move a few metres a year. What lies under them has waited far longer.', 'Sand off every crest, vultures overhead, and one green spring keeping a secret.']) }),
  water: .02, waterCol: '#1f6a8a', waterTop: '#5aaab0', waterDeep: '#08243a', strata: ['#b8885a', '#c89a68', '#a07048', '#d8b080', '#8a6040', '#c08858'], soil: '#c8965e',
  aquatic: { jelly: 0, schools: 2, big: 0, size: .055, plankton: 110, cols: ['#8a8a6a', '#a89a70'] },
  calm: { sky: '#ffd8a8', ground: '#7a5a38', sun: '#ffc080' },
  height(u, v, n) {
    const b = -(u + v) / 2, wx = u * .8 - v * .6, wz = u * .6 + v * .8;
    let h = .28 + b * .15;
    // transverse dunes: a gentle climb up the windward back, a sharp crest, a steep slip face
    const ph = wx * 2.3 + n.fbm(u * .9, v * .9) * 1.1 + Math.sin(wz * 1.7 + n.fbm(u * .7 + 4, v * .7) * 1.5) * .35, f = ph - Math.floor(ph), r = f < .74 ? f / .74 : 1 - (f - .74) / .26, prof = f < .74 ? r * r * (3 - 2 * r) : Math.pow(r, 1.6);
    h += (.18 + Math.max(0, b + .25) * 1.05) * prof * (.78 + .44 * n.fbm(u * 1.4 + 5, v * 1.4)) + n.fbm(u * 6, v * 6) * .012;
    // a star dune massed in the far corner
    const sx = u + .72, sz = v + .7, sd = Math.hypot(sx, sz), sa = Math.atan2(sz, sx); if (sd < .66) { const arms = .78 + .22 * Math.cos(sa * 4 + n.fbm(sd * 2, sa * .5) * 1.4); h = Math.max(h, .3 + 2.1 * Math.pow(Math.max(0, 1 - Math.pow(sd / (.66 * (.82 + .18 * arms)), 2)), 1.7) * (.85 + .15 * arms)); }
    // a banded sandstone jebel
    const jd = dJebel(u, v, n); if (jd < 1.15) h = Math.max(h, jd < 1 ? .4 + 1.75 * (1 - Math.pow(jd, 7)) * (.88 + .24 * n.ridge(u * 5, v * 5, 4)) : lerp(.4 + .25, h, (jd - 1) / .15));
    // the great mound over the temple
    const td = Math.hypot(u - DTC[0], v - DTC[1]) / .65; if (td < 1) h = Math.max(h, -.1 + 3.0 * Math.pow(1 - td * td, .55));
    // the oasis: a green hollow with a spring-fed pool that breaks the near wall
    const od = Math.hypot(u - DOA[0], v - DOA[1]); if (od < .44) { const k = clamp((.44 - od) / .2, 0, 1); h = lerp(h, .09, k * k * (3 - 2 * k)); if (od < .25) { const q = clamp((.25 - od) / .2, 0, 1); h = lerp(.09, -.34 + n.fbm(u * 7, v * 7) * .03, q * q * (3 - 2 * q)); } }
    return h; },
  color(h, s, u, v, n) {
    const jd = dJebel(u, v, n), od = Math.hypot(u - DOA[0], v - DOA[1]);
    if (jd < 1.02 && h > .45) { const band = Math.floor((h + n.vn(u * 5, v * 5) * .04) / .09); return ['#a8643c', '#c07a4a', '#8a4e30', '#d09060', '#9a5a38', '#b8724a'][((band % 6) + 6) % 6]; }
    if (od < .27 && h < .05) return h < -.1 ? '#5a5240' : '#7a6a4c';
    if (od < .36 && h < .17) return n.vn(u * 30, v * 30) > 0 ? '#5a6a2e' : '#6a7836';
    if (od < .42 && h < .2) return '#a88a5a';
    if (s > .55) return n.vn(u * 20, v * 20) > .2 ? '#b8804c' : '#c48a54';
    return n.vn(u * 14, v * 14) > .35 ? '#e2b47c' : (n.vn(u * 40, v * 40) > 0 ? '#d6a66a' : '#dcac70'); },
  build(c) {
    const W = (u, v) => [u * 3.2, v * 3.2], tc = new T.Color();
    const stone = new T.MeshStandardMaterial({ vertexColors: true, roughness: .92 });
    const weather = (g, a = '#b89060', b = '#9a7448') => paint(g, (x, y, z) => { const k = hash3(Math.round(x * 40), Math.round(y * 40), Math.round(z * 40)); return tc.copy(col(a)).lerp(col(b), k * .7).clone(); });
    const place = (parts, x, y, z, ry = 0, rz = 0, rx = 0, sc = 1) => { const m = new T.Mesh(mergeGeo(parts), stone); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.setScalar(sc); m.castShadow = m.receiveShadow = true; c.group.add(m); return m; };
    // ---- the oasis: palms, reeds, two tents and a well
    const palms = [], reeds = []; for (let k = 0; k < 400 && palms.length < 18; k++) { const a = rnd(TAU), r = rnd(.2, .34), [x, z] = W(DOA[0] + Math.cos(a) * r, DOA[1] + Math.sin(a) * r), h = c.hAt(x, z); if (h > .04 && h < .2 && Math.abs(x) < 3.1 && Math.abs(z) < 3.1) palms.push([x, h, z]); }
    for (let k = 0; k < 400 && reeds.length < 36; k++) { const a = rnd(TAU), r = rnd(.2, .26), [x, z] = W(DOA[0] + Math.cos(a) * r, DOA[1] + Math.sin(a) * r), h = c.hAt(x, z); if (h > c.water && h < .08 && Math.abs(x) < 3.1 && Math.abs(z) < 3.1) reeds.push([x, h, z]); }
    addTrees(c, palms, { kind: 'palm', scale: 1.15, colors: ['#4a6a30', '#5a7a36', '#3e5c2a'] }); addTrees(c, reeds, { kind: 'bush', scale: .8, colors: ['#6a7a3a', '#7a8a44'], stamp: false });
    [[.6, .62], [.18, .52]].forEach(([u, v], i) => { const [x, z] = W(u, v), h = c.hAt(x, z), g = new T.ConeGeometry(.11, .1, 4); g.translate(0, .05, 0); const tent = new T.Mesh(paint(g, (px, py) => py > .07 ? '#3a2c24' : '#5a4232'), new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); tent.position.set(x, h, z); tent.rotation.y = .3 + i; tent.scale.set(1.3, 1, .9); tent.castShadow = tent.receiveShadow = true; c.group.add(tent); });
    { const [x, z] = W(.18, .7), h = c.hAt(x, z), g = new T.CylinderGeometry(.04, .045, .05, 12, 1, true); place([weather(g)], x, h + .02, z); }
    // ---- half-buried ruins
    { const [x, z] = W(.56, .1), h = c.hAt(x, z), face = lumpy(new T.SphereGeometry(.2, 18, 14), .06, 26); face.scale(.85, 1.1, .9);
      const crown = new T.CylinderGeometry(.12, .17, .16, 16); crown.translate(0, .24, -.03); const nose = new T.BoxGeometry(.05, .09, .06); nose.translate(0, .0, .18); const brow = new T.BoxGeometry(.22, .028, .05); brow.translate(0, .075, .16); const lips = new T.BoxGeometry(.09, .02, .03); lips.translate(0, -.1, .17); const chin = new T.BoxGeometry(.07, .05, .05); chin.translate(0, -.17, .13); const band = new T.CylinderGeometry(.185, .185, .03, 16); band.translate(0, .16, -.02);
      c.head = place([weather(face), weather(crown, '#a88050', '#8a6440'), weather(nose), weather(brow), weather(lips), weather(chin), weather(band, '#9a7444', '#7a5a38')], x, h - .06, z, Math.PI / 4 + .2, .22, -.62, 1.9); c.tall = [[x, h + .5, z]]; c.vc = [x, z]; }
    { const [x, z] = W(-.55, .38), h = c.hAt(x, z), sh = new T.CylinderGeometry(.034, .05, .9, 4); sh.rotateY(Math.PI / 4); sh.translate(0, .45, 0); const tip = new T.ConeGeometry(.036, .075, 4); tip.rotateY(Math.PI / 4); tip.translate(0, .935, 0); c.obel = place([weather(sh, '#a8865a', '#8a6a44'), weather(tip, '#b8964a', '#a07e3a')], x, h - .38, z, .4, .2, .05); c.obel.userData.r0 = c.obel.rotation.clone(); c.obel.userData.y0 = h - .38; }
    for (let k = 0; k < 5; k++) { const f = k / 4, [x, z] = W(lerp(.5, .7, f), lerp(.06, .36, f)), h = c.hAt(x, z), sink = rnd(.12, .34), col_ = new T.CylinderGeometry(.034, .038, .46, 12); col_.translate(0, .23, 0); const cap = new T.BoxGeometry(.085, .035, .085); cap.translate(0, .475, 0);
      if (k === 2) { const g = new T.CylinderGeometry(.038, .038, .14, 12); place([weather(g)], x + .06, h + .01, z + .04, .7, Math.PI / 2); continue; } place([weather(col_), weather(cap, '#a88050', '#8a6440')], x, h - sink, z, rnd(TAU), rnd(-.12, .12)); }
    { const [x, z] = W(-.78, .12), h = c.hAt(x, z), parts = []; [-1, 1].forEach(sd => { const g = new T.CylinderGeometry(.12, .2, .6, 4); g.rotateY(Math.PI / 4); g.translate(sd * .26, .3, 0); parts.push(weather(g)); }); const lin = new T.BoxGeometry(.66, .07, .14); lin.translate(0, .62, 0); parts.push(weather(lin, '#a88050', '#8a6440'));
      place(parts, x, h - .36, z, Math.PI / 4 + .15, .04); }
    // ---- the temple-mountain under the great dune: three stepped terraces of laterite and sandstone ringed by roofed,
    // colonnaded galleries, gate towers and steep stairways on all four sides, and a quincunx of tiered lotus-bud towers
    // whose every tier is edged with carved antefixes. The stone is worn: blocks sit slightly askew, finials and roof bays
    // are missing, fallen blocks lie about, and a carving shader covers every face with relief, mouldings and lichen.
    { const parts = [], wins = [], SS = ['#a49886', '#9a8e7c', '#b0a28a', '#928874'], LAT = ['#8a5e44', '#7a5240', '#946a4e'], DK = '#1e1812';
      const jit = g => { g.rotateY(rnd(-.012, .012)); g.rotateZ(rnd(-.008, .008)); return g; };
      const add = (g, x, y, z, a, b, wear = true) => { if (wear) jit(g); g.translate(x, y, z); parts.push(weather(g, a || pick(SS), b || '#6e6656')); return g; };
      const box = (w, h, d, x, y, z, a, b) => add(new T.BoxGeometry(w, h, d), x, y + h / 2, z, a, b);
      const ring4 = (r, f) => [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(([dx, dz], k) => f(dx * r, dz * r, dx, dz, k));
      // a tiered lotus-bud tower (prang) standing at (x, y, z), base width w, height H
      const prang = (x, y, z, w, H, tiers = 7) => {
        box(w * 1.25, H * .05, w * 1.25, x, y, z); box(w * 1.12, H * .04, w * 1.12, x, y + H * .05, z);
        const by = y + H * .09, bh = H * .27; box(w, bh, w, x, by, z); ring4(w * .5, (ox, oz, dx, dz) => { box(dx ? w * .14 : w * .46, bh * .86, dz ? w * .14 : w * .46, x + ox + dx * w * .06, by, z + oz + dz * w * .06);
          add(new T.BoxGeometry(dx ? .012 : w * .18, bh * .5, dz ? .012 : w * .18), x + ox + dx * w * .14, by + bh * .3, z + oz + dz * w * .14, DK, '#2a2018', false); wins.push({ x: x + ox + dx * w * .15, y: by + .02, z: z + oz + dz * w * .15, ry: Math.atan2(dx, dz), w: w * .18 }); });
        box(w * 1.1, H * .03, w * 1.1, x, by + bh, z);
        let ty = by + bh + H * .03; const th = H * .55 / tiers;
        for (let k = 0; k < tiers; k++) { const t = k / tiers, wk = w * (1 - .8 * Math.pow(t, 1.6)) * (1 + .12 * Math.sin(t * Math.PI));
          box(wk, th * .72, wk, x, ty, z); box(wk * 1.07, th * .28, wk * 1.07, x, ty + th * .72, z);
          for (let q = 0; q < 8; q++) { if (R() < .14) continue; const a = q / 8 * TAU + Math.PI / 4, rr = wk * (q % 2 ? .5 : .68), cone = new T.ConeGeometry(wk * .085, th * .95, 5); add(cone, x + Math.sin(a) * rr, ty + th * 1.25, z + Math.cos(a) * rr); }
          ty += th; }
        const bud = lathe([[0, 0], [w * .16, .02], [w * .2, H * .05], [w * .14, H * .1], [w * .05, H * .14], [0, H * .17]], 10, true); add(bud, x, ty, z); add(new T.CylinderGeometry(.004, .008, H * .08, 5), x, ty + H * .2, z);
        return ty + H * .24; };
      // a terrace: laterite platform, sandstone cornice, a roofed gallery of pillars around the rim, stairs and a gate on each side
      const terrace = (half, y, h, gal) => {
        box(half * 2, h, half * 2, 0, y, 0, pick(LAT), '#5a3a2a'); box(half * 2 + .04, .025, half * 2 + .04, 0, y + h - .02, 0); box(half * 2 + .02, .02, half * 2 + .02, 0, y, 0);
        const top = y + h;
        ring4(half, (ox, oz, dx, dz, k) => { // stairs climb the middle of each face
          const nS = Math.max(6, Math.round(h / .03)); for (let q = 0; q < nS; q++) { const f = q / nS; box(dx ? .07 + .26 * (1 - f) : .2, h / nS * 1.02, dz ? .07 + .26 * (1 - f) : .2, ox + dx * (.035 + .26 * (1 - f) / 2), y + q * h / nS, oz + dz * (.035 + .26 * (1 - f) / 2)); }
          [-1, 1].forEach(sd => box(dx ? .3 : .025, h * .55, dz ? .3 : .025, ox + dx * .15 + (dx ? 0 : sd * .12), y, oz + dz * .15 + (dz ? 0 : sd * .12)));
          if (gal) { const n = Math.round(half * 2 / .085); for (let q = 0; q <= n; q++) { const f = -half + .06 + q * (half * 2 - .12) / n; if (Math.abs(f) < .12) continue; if (R() < .06) continue;
              const px = dx ? ox - dx * .06 : f, pz = dz ? oz - dz * .06 : f; box(.026, gal, .026, px, top, pz); box(.034, .012, .034, px, top + gal - .012, pz);
              if (q % 3 === 0) wins.push({ x: dx ? ox - dx * .03 : f, y: top + .01, z: dz ? oz - dz * .03 : f, ry: Math.atan2(dx, dz), w: .06 }); }
            const L = half * 2 - .08; [.04, .03].forEach((rh, j) => { const rw = j ? .02 : .14; if (R() < .8) { const g = new T.BoxGeometry(dx ? rw : L, rh, dz ? rw : L); add(g, ox - dx * .06, top + gal + rh / 2 + j * .02, oz - dz * .06); } });
            box(dx ? .03 : L, gal, dz ? .03 : L, ox - dx * .12, top, oz - dz * .12, pick(SS)); }
          // a gate pavilion over the stair head
          if (gal) { const gx = ox - dx * .06, gz = oz - dz * .06; box(.26, gal * 1.4, .26, gx, top, gz); prang(gx, top + gal * 1.4, gz, .16, .38, 4); } });
        return top; };
      const t1 = terrace(1.02, 0, .22, .15), t2 = terrace(.74, t1, .26, .14), t3 = terrace(.48, t2, .3, 0);
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => { prang(a * .95, t1, b * .95, .15, .5, 5); prang(a * .68, t2, b * .68, .15, .55, 5); prang(a * .36, t3, b * .36, .2, .95, 7); });
      prang(0, t3, 0, .36, 1.62, 9);
      for (let k = 0; k < 26; k++) { const a = rnd(TAU), r = rnd(1.08, 1.32), g = new T.BoxGeometry(rnd(.04, .1), rnd(.03, .06), rnd(.04, .09)); g.rotateY(rnd(TAU)); g.rotateX(rnd(-.4, .4)); add(g, Math.cos(a) * r, .02, Math.sin(a) * r); }
      const [x, z] = W(DTC[0], DTC[1]), m = new T.MeshStandardMaterial({ vertexColors: true, roughness: .95 }); addCarving(m);
      c.temple = new T.Mesh(mergeGeo(parts), m); c.temple.castShadow = c.temple.receiveShadow = true;
      c.tg = new T.Group(); c.tg.add(c.temple); c.tg.position.set(x, PLZ - .3, z); c.tg.rotation.y = Math.PI / 4; c.group.add(c.tg); c.tpos = [x, z];
      const ca = Math.cos(Math.PI / 4), sa = Math.sin(Math.PI / 4); c.wins = wins.map(o => { const nx = Math.sin(o.ry), nz = Math.cos(o.ry); return { x: x + o.x * ca + o.z * sa, z: z - o.x * sa + o.z * ca, y: o.y, nx: nx * ca + nz * sa, nz: -nx * sa + nz * ca, w: o.w }; });
      const NS = c.NS, V = NS + 1, idx = [], h0 = [], tg = []; for (let j = 0; j <= NS; j++) for (let i = 0; i <= NS; i++) { const u = i / NS * 2 - 1, v = j / NS * 2 - 1, d = Math.hypot(u - DTC[0], v - DTC[1]); if (d > .65) continue; const k = j * V + i;
        idx.push(k); h0.push(c.H[k]); tg.push(lerp(PLZ, c.H[k], smooth01((d - .45) / .2))); }
      c.rev = { idx, h0, tg, k: 0 }; }
    // ---- vultures circling over the colossal head
    c.vult = Array.from({ length: 5 }, (_, i) => { const g = new T.Group(), dark = new T.MeshStandardMaterial({ color: col('#2a2018'), roughness: .9 }), pale = new T.MeshStandardMaterial({ color: col('#c8b8a4'), roughness: .9 });
      const body = new T.Mesh(new T.SphereGeometry(.02, 8, 6), dark); body.scale.set(2.3, .8, .9); const head = new T.Mesh(new T.SphereGeometry(.009, 6, 5), pale); head.position.set(.05, .004, 0); const tail = new T.Mesh(new T.BoxGeometry(.03, .003, .03), dark); tail.position.set(-.055, 0, 0); g.add(body, head, tail);
      const wings = [-1, 1].map(sd => { const pv = new T.Group(), wg = new T.BoxGeometry(.05, .003, .13); wg.translate(0, 0, sd * .067); const w = new T.Mesh(wg, dark); const tip = new T.Mesh(new T.BoxGeometry(.03, .002, .04), dark); tip.position.set(-.008, 0, sd * .15); pv.add(w, tip); g.add(pv); return pv; });
      g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.scale.setScalar(1.5); c.group.add(g);
      return { g, wings, r: rnd(.45, .95), y: rnd(1.6, 2.3), a: rnd(TAU), w: rnd(.25, .42) * (i % 2 ? 1 : -1), ph: rnd(TAU) }; });
    c.dd = { t: rnd(2, 6), on: 0 };
  },
  update(c, t, dt) {
    const Sm = c.Sm, wv = [.25, .45, .8, 1.3][MOD.wind], DX = .8, DZ = -.6;
    // sand streaming off the crests, a low haze, and now and then a dust devil
    for (let i = 0; i < nOf(150 * wv, dt); i++) { const x = rnd(-3.1, 3.1), z = rnd(-3.1, 3.1), h = c.hAt(x, z); if (h < .32 || c.hAt(x + DX * .08, z + DZ * .08) > h + .005) continue; const sp = rnd(.3, .7) * wv; Sm.emit(x, h + .006, z, DX * sp, rnd(.03, .14), DZ * sp, rnd(1.1, 2.3), [.92, .76, .55, .45], [.92, .76, .55, 0], .03, .13, 0, .3); }
    for (let i = 0; i < nOf(5 * wv, dt); i++) { const x = rnd(-3, 2), z = rnd(-2, 3); Sm.emit(x, c.hAt(x, z) + rnd(.1, .4), z, DX * .3 * wv, .01, DZ * .3 * wv, rnd(3, 5), [.92, .78, .6, .08], [.92, .78, .6, 0], .35, .7, 0, .1); }
    const D = c.dd; D.t -= dt; if (D.t <= 0 && !D.on) { D.on = 4.5; D.x = rnd(-2.4, 1.6); D.z = rnd(-1.6, 2.2); D.t = rnd(7, 12); } if (D.on > 0) { D.on -= dt; D.x += DX * .25 * dt; D.z += DZ * .25 * dt; Sm.sc[0] = D.x; Sm.sc[1] = D.z; const gh = c.hAt(D.x, D.z), fade = Math.min(1, D.on, 4.5 - D.on);
      for (let i = 0; i < nOf(120 * fade, dt); i++) { const y = rnd(0, .9), rr = .02 + .16 * Math.pow(y / .9, 1.4), a = rnd(TAU); Sm.emit(D.x + Math.cos(a) * rr, gh + y, D.z + Math.sin(a) * rr, 0, rnd(.15, .35), 0, rnd(.8, 1.3), [.86, .7, .5, .35], [.86, .7, .5, 0], .03 + y * .04, .07 + y * .05, 0, 0, 6, 1.5); } }
    // vultures: slow thermals, the odd lazy wingbeat; they climb away when the ground shakes
    const scare = c.qT !== undefined && c.qT < 7 ? 1 : 0; c.vult.forEach(o => { o.a += o.w * dt * (1 + scare * .8); const r = o.r * (1 + scare * .6), y = o.y + scare * .5 + Math.sin(clock * .3 + o.ph) * .08;
      o.g.position.set(c.vc[0] + Math.cos(o.a) * r, y, c.vc[1] + Math.sin(o.a) * r); o.g.rotation.set(-Math.sign(o.w) * .32, -o.a - Math.sign(o.w) * Math.PI / 2, 0, 'YXZ');
      const flap = Math.sin(clock * .5 + o.ph) > .85 || scare ? Math.sin(clock * 9 + o.ph) * .45 : 0; o.wings.forEach((w, k) => w.rotation.x = (k ? -1 : 1) * (.14 + flap)); });
    // EVENT, magnitude nine: a foreshock, then the main shock throws the whole slab about, the obelisk falls, the great dune
    // drains away into a sunken court, and the facade stands in silence. Then the wind returns and buries it again.
    if (c.userEvent && t > B0 - .1 && once(c, 'quake')) { c.qT = 0; c.rev.k = -1; const o = c.obel; o.rotation.copy(o.userData.r0); o.position.y = o.userData.y0; sfx.rumble(3); }
    c.group.rotation.x = c.group.rotation.z = 0;
    if (c.qT !== undefined && c.qT >= 17) c.flyG.visible = true;
    if (c.qT !== undefined && c.qT < 17) { c.qT += dt; const q = c.qT, R_ = c.rev, [tx, tz] = c.tpos;
      const main = q > 1.2 && q < 8 ? Math.pow(1 - (q - 1.2) / 6.8, 1.4) : 0, fore = q < 1.2 ? q / 1.2 * .25 : 0, quake = Math.max(main, fore);
      if (q > 1.2 && once(c, 'main')) { sfx.boom(2.2); sfx.rumble(9); sfx.thunder(); flash('#d8a878', .25); }
      if (q > 3 && once(c, 'boom2')) sfx.boom(1.2);
      if (quake > 0) { c.shake = Math.max(c.shake, .22 * quake); const j = .045 * quake; c.group.position.x += rnd(-j, j); c.group.position.y += rnd(-j, j) * .6; c.group.position.z += rnd(-j, j); c.group.rotation.x = rnd(-1, 1) * .025 * quake; c.group.rotation.z = rnd(-1, 1) * .025 * quake;
        for (let i = 0; i < NK; i++) kv[i] += rnd(-1, 1) * 40 * quake * dt * 60 * .05; deckB.v += rnd(-1, 1) * 6 * quake;
        for (let i = 0; i < nOf(500 * quake, dt); i++) { const x = rnd(-3.1, 3.1), z = rnd(-3.1, 3.1), h = c.hAt(x, z); c.Sm.emit(x, h + .01, z, rnd(-.1, .1), rnd(.1, .5), rnd(-.1, .1), rnd(.5, 1), [.9, .74, .54, .6], [.9, .74, .54, 0], .025, .07, -1.2, .4); } }
      // the dune drains (by 5.8 s), holds, then the sand flows back in (11 to 16.5 s)
      const kin = easeInOut(clamp((q - 1.5) / 4.3, 0, 1)), kout = easeInOut(clamp((q - 11) / 5.5, 0, 1)), k = kin * (1 - kout);
      if (Math.abs(k - R_.k) > 1e-4) { R_.k = k; const pos = c.geo.attributes.position; R_.idx.forEach((ix, n) => { const h = lerp(R_.h0[n], R_.tg[n], k); c.H[ix] = h; pos.setY(ix, h); }); pos.needsUpdate = true; c.geo.computeVertexNormals(); }
      c.tg.position.y = PLZ - .3 * (1 - kin) - .3 * kout;
      c.flyG.visible = !(q > 1 && q < 13); const cine = q > 4.4 && q < 11.8; plaque.classList.toggle('show', !cine); if (cine) { c.camZoom = 1.9 * 2.4; c.camEl = .44; c.camLift = 1.45; c.camDrop = 6.6; c.camDeck = .78; c.camRate = .7; } else if (c.camZoom) { c.camZoom = c.camEl = c.camLift = c.camDrop = c.camDeck = undefined; c.camRate = .6; }
      if (kin > 0 && kin < 1) for (let i = 0; i < nOf(420, dt); i++) { const a = rnd(TAU), r = rnd(.9, 2.1), x = tx + Math.cos(a) * r, z = tz + Math.sin(a) * r, h = c.hAt(x, z); c.Sm.emit(x, h + .01, z, Math.cos(a) * rnd(.2, .6), rnd(.2, .8), Math.sin(a) * rnd(.2, .6), rnd(.7, 1.3), [.88, .7, .48, .85], [.88, .7, .48, 0], .02, .06, -1.6, .5);
        if (i % 6 === 0) c.Sm.emit(x, h + .1, z, Math.cos(a) * .2, rnd(.3, .7), Math.sin(a) * .2, rnd(2.5, 4), [.86, .7, .5, .5], [.86, .7, .5, 0], .25, .8, 0, .35); }
      const pour = kin > .15 ? clamp((kin - .15) / .3, 0, 1) * (1 - smooth01((q - 8.5) / 3)) : 0, tgy = c.tg.position.y;
      if (pour > 0) { for (let i = 0; i < nOf(900 * pour, dt); i++) { const w_ = pick(c.wins), sp = rnd(.12, .34); c.Sm.emit(w_.x + w_.nx * .02 + rnd(-.3, .3) * w_.w * w_.nz, tgy + w_.y + .01, w_.z + w_.nz * .02 - rnd(-.3, .3) * w_.w * w_.nx, w_.nx * sp, rnd(-.05, .08), w_.nz * sp, rnd(.8, 1.5), [.92, .76, .54, .95], [.88, .72, .5, 0], .022, .06, -2.6, .1); }
        for (let i = 0; i < nOf(220 * pour, dt); i++) { const a = rnd(TAU), e = rnd(.15, 1.3), [ox, oz] = [tx - .38 * Math.sin(Math.PI / 4), tz - .38 * Math.cos(Math.PI / 4)]; c.Sm.emit(ox + Math.cos(a) * Math.cos(e) * .45, tgy + 1.71 + Math.sin(e) * .45, oz + Math.sin(a) * Math.cos(e) * .45, Math.cos(a) * .25, -.1, Math.sin(a) * .25, rnd(.6, 1.2), [.9, .76, .54, .75], [.9, .76, .54, 0], .018, .05, -2, .2); } }
      if (kout > 0 && kout < 1) for (let i = 0; i < nOf(300, dt); i++) { const a = rnd(TAU), r = rnd(1.3, 2.0), x = tx + Math.cos(a) * r, z = tz + Math.sin(a) * r, h = c.hAt(x, z); c.Sm.emit(x, h + .02, z, -Math.cos(a) * rnd(.3, .7), rnd(-.05, .1), -Math.sin(a) * rnd(.3, .7), rnd(.8, 1.4), [.9, .74, .52, .7], [.9, .74, .52, 0], .02, .05, -.8, .2); }
      if (q > 11 && once(c, 'rebury')) { sfx.wind(6); noise(5.5, { filter: 'bandpass', ff: 900, to: 300, q: .6, vol: .1, attack: 1.2 }); }
      // the obelisk goes over in the main shock
      const fo = clamp((q - 1.7) / 1.6, 0, 1), o = c.obel; if (fo > 0 && fo <= 1) { o.rotation.z = o.userData.r0.z + 1.3 * fo * fo + (fo >= 1 ? 0 : 0); o.position.y = o.userData.y0 - .1 * fo; }
      if (q > 3.3 && once(c, 'thud')) { sfx.thump(); const p = o.position; for (let i = 0; i < 120; i++) { const a = rnd(TAU); c.Sm.emit(p.x + rnd(-.3, .3), c.hAt(p.x, p.z) + .02, p.z + rnd(-.3, .3), Math.cos(a) * rnd(.2, .6), rnd(.2, .6), Math.sin(a) * rnd(.2, .6), rnd(.8, 1.6), [.88, .72, .5, .7], [.88, .72, .5, 0], .05, .2, -.6, .5); } }
    }
  } });

story({ id: 'bloom', mood: ['major', 196],
  caption: () => ({ era: pick(['20 March · 11:00', 'Alpine spring · 1,900 m', 'Holocene · any April']), name: pick(['Spring Equinox', 'The Meadow Wakes', 'First Warm Day']), line: pick(['Overnight the hillside decides, all at once, to be colourful.', 'The bees will hear about this by lunchtime.']) }),
  water: .13, waterCol: '#3a8aa8', waterTop: '#4aa0b8', waterDeep: '#123a4a', strata: ['#6a5a4a', '#7a6a58', '#5a4c40', '#8a7a66'], soil: '#3a2e22',
  pal: { sky: '#eaf4ff', ground: '#6a7a50', hemiI: .85, sun: '#fff3dc', sunI: 1.05, dir: [-5, 10, -2], dim: 1 },
  calm: { sky: '#ffcaa8', ground: '#5a4a40', hemiI: .65, sun: '#ff9e6a', sunI: .85, dir: [8, 4, -1], dim: .82, tint: '#6a4a40' },
  height(u, v, n) { const d = Math.hypot(u - .35, v - .4); return .24 + n.fbm(u * 1.5, v * 1.5) * .18 + n.ridge(u * 1.8 + 4, v * 1.8) * Math.max(0, -v - .05) * 1.9 - Math.exp(-d * d / .04) * .35; },
  color(h, s, u, v, n) { if (h > 1.15) return '#f2f5f8'; if (h > .85 || s > 1.1) return n.vn(u * 12, v * 12) > 0 ? '#6a6862' : '#7a7670'; if (h < .15) return '#9a9070'; return n.vn(u * 7, v * 7) > .2 ? '#7a9a3a' : (n.vn(u * 13, v * 13) > 0 ? '#8aa848' : '#6a8a32'); },
  build(c) {
    addTrees(c, scatter(c, 80, (h, s) => h > .55 && h < .95 && s < 1.1), { kind: 'cone', colors: ['#2a4a2a', '#335a30'] });
    c.ch = addTrees(c, scatter(c, 22, (h, s) => h > .18 && h < .5 && s < .5), { kind: 'round', colors: ['#6a8a4a'] });
    const pts = scatter(c, 1400, (h, s) => h > .15 && h < .62 && s < .7), fm = inst(new T.SphereGeometry(.026, 6, 4), new T.MeshStandardMaterial({ roughness: .6 }), pts.length, false), tc = new T.Color();
    c.fl = { m: fm, pts, st: pts.map(p => B0 + Math.hypot(p[0], p[2]) * .25 + rnd(0, .35)), sz: pts.map(() => rnd(.7, 1.4)) };
    pts.forEach((p, i) => { fm.setMatrixAt(i, ZERO); tc.copy(col(pick(['#ff7aa8', '#ffd84a', '#ffffff', '#b07aff', '#ff9a4a', '#ff5a7a']))); fm.setColorAt(i, tc); }); c.group.add(fm);
  },
  update(c, t, dt) {
    const fl = c.fl;
    if (t > B0 && once(c, 'arp')) sfx.cascade();
    if (t > B0 && t < B1 && R() < dt * 5) sfx.chirp();
    if (t > B0 && t < B1 + 1) { fl.pts.forEach((p, i) => { const k = clamp((t - fl.st[i]) / .45, 0, 1); if (k <= 0) return; const s = easeOutBack(k) * fl.sz[i]; _P.set(p[0], p[1] + .015, p[2]); _S.set(s, s, s); _Q.identity(); _M.compose(_P, _Q, _S); fl.m.setMatrixAt(i, _M); }); fl.m.instanceMatrix.needsUpdate = true; }
    if (t > B0 + .3 && once(c, 'cherry')) c.ch.tint(['#ffb7c9', '#ffc8d6', '#f7a8be']);
    if (t > B0 && t < B1) { c.Sm.sc[0] = 0; c.Sm.sc[1] = 0; for (let i = 0; i < nOf(170, dt); i++) { const p = pick(fl.pts); if (!p) break; c.Sm.emit(p[0], p[1] + .05, p[2], rnd(-.2, .2), rnd(.4, 1.2), rnd(-.2, .2), rnd(3, 5), R() < .5 ? [1, .72, .82, .95] : [1, 1, 1, .9], [1, .8, .9, 0], .035, .03, -.15, .4, 1.1, 2); } }
  } });

const DUSK = [
  [0, { sky: '#d8eaf6', ground: '#5a7a70', hemiI: .68, sun: '#fff0d6', sunI: .95, dim: 1, tint: 'room', dirv: [-2, 10, 5], top: '#6fa6da', mid: '#b8d6ee', hor: '#f6eed8', horI: 1 }],
  [3.5, { sky: '#ffd49a', ground: '#6a5038', hemiI: .58, sun: '#ffb060', sunI: 1, dim: .92, tint: '#9a6a38', dirv: [-4, 6, 4], top: '#7a9ccc', mid: '#f8cf98', hor: '#ffd06a', horI: 1.8 }],
  [7, { sky: '#f08a74', ground: '#4a2c40', hemiI: .5, sun: '#ff5a24', sunI: .75, dim: .72, tint: '#9a3a48', dirv: [-6, 2.6, 2.5], top: '#4a3c86', mid: '#f0708a', hor: '#ff9440', horI: 2.6 }],
  [10, { sky: '#5a64a8', ground: '#262444', hemiI: .48, sun: '#c07aa0', sunI: .2, dim: .46, tint: '#3a3a78', dirv: [-6, 2.6, 2.5], top: '#18204c', mid: '#5c4c92', hor: '#e8746a', horI: 1.3 }],
  [13.5, { sky: '#34467a', ground: '#0e1422', hemiI: .36, sun: '#a8bcff', sunI: .32, dim: .3, tint: '#1a2444', dirv: [3, 9, 5], top: '#060a1a', mid: '#121a38', hor: '#2c3458', horI: .8 }]];
function duskPal(e) { let i = 0; while (i < DUSK.length - 2 && e > DUSK[i + 1][0]) i++; const [t0, a] = DUSK[i], [t1, b] = DUSK[i + 1], k = easeInOut(clamp((e - t0) / (t1 - t0), 0, 1)), ta = a.tint === 'room' ? roomHex() : a.tint;
  return { sky: mixHex(a.sky, b.sky, k), ground: mixHex(a.ground, b.ground, k), sun: mixHex(a.sun, b.sun, k), tint: mixHex(ta, b.tint, k), hemiI: lerp(a.hemiI, b.hemiI, k), sunI: lerp(a.sunI, b.sunI, k), dim: lerp(a.dim, b.dim, k), dirv: a.dirv.map((v, q) => lerp(v, b.dirv[q], k)), top: mixHex(a.top, b.top, k), mid: mixHex(a.mid, b.mid, k), hor: mixHex(a.hor, b.hor, k), horI: lerp(a.horI, b.horI, k) }; }
/* Koh Phi Phi: a bay walled by sheer limestone headlands under jungle. A white beach lies at its head, and the water runs
   from glassy aqua over sand, through turquoise, to deep sapphire at the mouth, where a tall sea stack and a low dark reef
   stand. Long-tails ride at anchor off the beach. EVENT: a squall rolls in with rain and lightning; a humpback breaches at
   the mouth, twists and crashes back in a burst of spray, later spouts, then raises its flukes and slides under.
   s = (u - v) / 2 runs across the bay, b = (u + v) / 2 from the beach (far corner) to the open sea (near corner). */
const PHILLS = [[-.5, -.58, .32, 2.9], [-.56, -.2, .29, 2.55], [-.5, .16, .24, 2.1], [-.4, .44, .15, 1.5], [.52, -.55, .31, 2.7], [.56, -.13, .27, 2.35], [.5, .22, .21, 1.9], [.0, -.9, .26, 1.7], [-.26, -.86, .2, 1.95], [.28, -.84, .2, 1.8]];
const PBW = b => .25 + Math.max(0, b + .6) * .19, PSTK = [[.2, .72, .07, 1.9], [-.32, .68, .045, 1.25], [.42, .52, .04, .9]], PSPIT = [-.16, .82];
const pbs = (u, v) => [(u + v) / 2, (u - v) / 2];
story({ id: 'breach', manualEvent: true, surface: 'tropic', frame: { zoom: 1.95, el: .5, deck: .9, drop: 3.5 }, depth: 1.5, nseg: 200, cloudY: 3.8, cloudN: .6, glints: 150, preset: { time: 1, clouds: 1, rain: 0, wind: 1, glow: 2, life: 1 }, mood: ['lydian', 146.83],
  caption: () => ({ era: pick(['Andaman Sea · late morning', 'Krabi province · dry season', 'Holocene · 4 m above old sea level']), name: pick(['Phi Phi Lagoon', 'The Limestone Bay', 'Long-tail Hour']), line: pick(['Limestone walls, jungle on top, and water every shade between glass and sapphire.', 'Rain dissolved these islands into towers. The sea did the rest.']) }),
  water: .1, waves: true, waterCol: '#0fb0c4', waterTop: '#8af0dc', waterDeep: '#05366e', aquatic: { jelly: 3, schools: 9, big: 2, size: .085, cols: ['#e8c25a', '#4a86c0', '#e08848', '#e6e2d6', '#58b8b0', '#d0d4d0'], bigCol: '#6a705a' },
  strata: ['#dcd4c2', '#c8bea8', '#e6dfcf', '#b8ad94', '#d2c8b2'], soil: '#5a5a34',
  calm: { sky: '#e8f6ff', ground: '#4a7a70', sun: '#fff1d8' },
  height(u, v, n) {
    const [b, s] = pbs(u, v), bw = PBW(b) + (n.fbm(b * 7, s * 3 + 2) - .5) * .05, inBay = smooth01((bw + .04 - Math.abs(s)) / .09);
    // sea floor: sand shoaling to the beach inside the bay, sapphire depths outside it
    let h = lerp(-.9 + n.fbm(u * 2, v * 2) * .2, lerp(0, -.95, smooth01((b + .55) / 1.3)) + n.fbm(u * 3, v * 3) * .06, inBay);
    if (b < -.52 && Math.abs(s) < bw + .08) { const k = smooth01((-.52 - b) / .12); h = lerp(h, .16 + n.fbm(u * 9, v * 9) * .01, k); }
    // karst hills: domes with sheer flanks and jungle-rounded summits, stepping down toward the mouth
    PHILLS.forEach(([hs, hb, r, H], q) => { const d = Math.max(0, Math.hypot((s - hs) * 1.05, b - hb) / r + (n.fbm(u * 5 + q * 3, v * 5) - .5) * .35); if (d < 1) h = Math.max(h, H * Math.pow(1 - Math.pow(d, 2.6), .42) * (.86 + .28 * n.fbm(u * 2.4 + q, v * 2.4)) + n.fbm(u * 12, v * 12) * .07); });
    // the bay is cut clean between them, leaving cliffs straight down to the water
    if (Math.abs(s) < bw && b > -.6) h = Math.min(h, lerp(0, -.95, smooth01((b + .55) / 1.3)) + n.fbm(u * 3, v * 3) * .06 + (1 - smooth01((bw - Math.abs(s)) / .012)) * 3);
    PSTK.forEach(([ss, bb, r, H], q) => { const d = Math.max(0, Math.hypot(s - ss, b - bb) / r + n.vn(u * 9 + q, v * 9) * .25); if (d < 1) h = Math.max(h, H * Math.pow(1 - Math.pow(d, 8), .5) * (.85 + .25 * n.fbm(u * 6 + q, v * 6))); });
    const sp = Math.hypot((s - PSPIT[0]) / .16, (b - PSPIT[1]) / .035) + n.fbm(u * 8, v * 8) * .4; if (sp < 1) h = Math.max(h, .1 + .22 * (1 - sp * sp) + n.vn(u * 30, v * 30) * .03);
    return h; },
  color(h, sl, u, v, n) {
    const [b, s] = pbs(u, v);
    if (Math.hypot((s - PSPIT[0]) / .17, (b - PSPIT[1]) / .04) < 1.1 && h > .06) return n.vn(u * 40, v * 40) > 0 ? '#4e4a44' : '#5e5850';
    if (h < .08) { if (sl > 1.2) return n.vn(u * 20, v * 20) > 0 ? '#5a5a52' : '#4a4c46'; const pt = n.fbm(u * 6 + 3, v * 6, 4) + n.vn(u * 22, v * 22) * .25; if (h > -.45) return pt > .32 ? '#2e4a40' : pt > .2 ? '#4a6a52' : pt > .08 ? '#b8bc9e' : (n.vn(u * 60, v * 60) > 0 ? '#f6f2e2' : '#ece6d0'); return pt > .2 ? '#22383a' : pt > 0 ? '#5a7472' : '#a8b0a0'; }
    if (h < .21 && sl < .9) return n.vn(u * 50, v * 50) > .2 ? '#f6efdf' : '#ece2ca';
    if (sl > 1.9 || (sl > 1.3 && n.vn(u * 11, v * 11 + h * 2) > .15)) { const edge = Math.max(Math.abs(u), Math.abs(v)) > .975; if (h < .3) return edge ? '#8a847a' : n.vn(u * 30, v * 30) > .2 ? '#4a4640' : '#5a554e';
      const streak = edge ? 0 : n.vn(u * 52 + v * 23, h * 1.2), stain = n.vn(u * 7 + 3, v * 7 + h * 1.4);
      if (streak > .48) return '#5e5952'; if (streak > .3) return '#8a857c'; if (stain > .32) return stain > .58 ? '#a87a52' : '#c4a07c';
      return n.vn(u * 15, v * 15 + h) > 0 ? '#d6d0c2' : '#c2baab'; }
    if (sl > 1.1 && h > .4) return n.vn(u * 22, v * 22) > -.2 ? (n.vn(u * 40, v * 40) > 0 ? '#3e6a2c' : '#557e34') : '#8a8676';
    const g = n.vn(u * 9, v * 9), g2 = n.vn(u * 23, v * 23); return g > .3 ? '#2a5222' : g > -.1 ? (g2 > 0 ? '#3c6c2a' : '#4c7c32') : (g2 > .2 ? '#5e8e38' : '#355f26'); },
  build(c) {
    const W2 = (s, b) => [(b + s) * 3.2, (b - s) * 3.2];
    // jungle: a dense canopy over every top, scrub clinging to the ledges, palms along the back of the beach
    addTrees(c, scatter(c, 26, (h, s, x, z) => h > .16 && h < .45 && s < .9 && pbs(x / 3.2, z / 3.2)[0] < -.6), { kind: 'palm', scale: 1.1, colors: ['#3a6a2a', '#4a7a30'] });
    // boulders fallen at the cliff feet
    const rp = scatter(c, 60, (h, s) => h > c.water - .06 && h < c.water + .12 && s > .6), rg = lumpy(new T.DodecahedronGeometry(1, 1), .45, 6), rk = inst(rg, new T.MeshStandardMaterial({ roughness: .95 }), rp.length), tc = new T.Color();
    rp.forEach(([x, h, z], i) => { const s = rnd(.025, .07); _Q.setFromEuler(new T.Euler(rnd(TAU), rnd(TAU), 0)); _M.compose(_P.set(x, h + s * .3, z), _Q, _S.set(s, s * .8, s)); rk.setMatrixAt(i, _M); rk.setColorAt(i, tc.copy(col(pick(['#8a857a', '#6e6a62', '#a49e90'])))); }); c.group.add(rk);
    // long-tails at anchor off the beach, bows to the sand
    c.anchors = [-.12, -.06, 0, .05, .1, -.02].map((s, i) => { const [x, z] = W2(s + rnd(-.015, .015), -.47 + (i % 3) * .07 + rnd(-.02, .02)); return [x, z, -2.356 + rnd(-.35, .35)]; });
    // the humpback
    { const g = new T.Group(), body = lathe([[.008, -.5], [.03, -.44], [.06, -.34], [.1, -.2], [.13, -.05], [.14, .08], [.132, .2], [.112, .32], [.085, .41], [.05, .47], [0, .5]], 26); body.scale(1, .82, 1);
      const bodyC = paint(body, (x, y, z) => y > -.02 ? (hash3(Math.round(x * 30), Math.round(y * 30), Math.round(z * 30)) > .93 ? '#5a6266' : '#2a3034') : (Math.floor(z * 70) % 2 && x > .05 ? '#a6aaa6' : '#c6cac6'));
      const skin = new T.MeshStandardMaterial({ vertexColors: true, roughness: .32, metalness: .08 }); const bm = new T.Mesh(bodyC, skin); bm.castShadow = true; g.add(bm);
      const finG = new T.ConeGeometry(.034, .38, 6); finG.scale(1, 1, .22); const finC = paint(finG, (x, y, z) => z > .002 ? '#3a4044' : '#dfe3df');
      c.pecs = [-1, 1].map(sd => { const pv = new T.Group(); pv.position.set(.2, -.07, sd * .12); const f = new T.Mesh(finC, skin); f.position.y = -.19; pv.add(f); pv.rotation.set(sd * (Math.PI / 2 + .35), 0, .5); g.add(pv); return pv; });
      const dor = new T.Mesh(new T.ConeGeometry(.02, .05, 6), new T.MeshStandardMaterial({ color: col('#2a3034'), roughness: .35 })); dor.position.set(-.2, .115, 0); g.add(dor);
      const fs = new T.Shape(); fs.moveTo(0, 0); fs.quadraticCurveTo(-.04, .05, -.09, .16); fs.lineTo(-.135, .175); fs.quadraticCurveTo(-.1, .08, -.11, .012); fs.lineTo(-.095, 0); fs.lineTo(-.11, -.012); fs.quadraticCurveTo(-.1, -.08, -.135, -.175); fs.lineTo(-.09, -.16); fs.quadraticCurveTo(-.04, -.05, 0, 0);
      const fl = new T.ShapeGeometry(fs, 10); fl.rotateX(-Math.PI / 2); const flC = paint(fl, (x, y, z) => Math.abs(z) > .14 || x < -.125 ? '#2a3034' : (hash3(Math.round(x * 50), 0, Math.round(z * 50)) > .7 ? '#8a8e8a' : '#e6e8e4'));
      const fm = new T.Mesh(flC, new T.MeshStandardMaterial({ vertexColors: true, roughness: .35, side: T.DoubleSide })); fm.position.x = -.49; fm.castShadow = true; g.add(fm); c.fluke = fm;
      g.rotation.order = 'YZX'; g.visible = false; c.group.add(g); c.whale = g; }
    c.wh = null;
  },
  update(c, t, dt) {
    const W = c.water;
    c.pl.intensity = Math.max(0, c.pl.intensity - dt * 22);
    if (c.userEvent && t > B0 - .1 && once(c, 'storm')) { c.evT = 0; c.saveMod = c.saveMod || { clouds: MOD.clouds, rain: MOD.rain, wind: MOD.wind }; Object.assign(MOD, { clouds: 3, rain: 2, wind: 2 }); redrawDecals(); setPal(computePal(), 1.2); sfx.wind(6); sfx.rain(14); c.wh = null; }
    if (c.evT !== undefined && c.evT < 25) { c.evT += dt; const e = c.evT;
      c.skyOv = { top: '#161c28', mid: '#334050', hor: '#66727e', low: '#24303c', k: clamp(e / 2.5, 0, 1) * clamp((24 - e) / 3, 0, 1), lum: .85 };
      if (e > 1.5 && e < 19 && R() < dt * .75) { let x = rnd(-2.6, 2.6), z = rnd(-2.6, 2.6), y = 3.6; const gy = Math.max(c.hAt(x, z), W);
        while (y > gy) { const ny = Math.max(gy, y - rnd(.1, .25)), nx = x + rnd(-.18, .18), nz = z + rnd(-.18, .18); for (let q = 0; q < 6; q++) { const f = q / 6; c.P.emit(lerp(x, nx, f), lerp(y, ny, f), lerp(z, nz, f), 0, 0, 0, rnd(.12, .25), [2.2, 2.3, 3, 1], [1.2, 1.4, 2.4, 0], .05, .03); } x = nx; y = ny; z = nz; }
        flash('#cfe0ff', .55); c.pl.position.set(x, 1.6, z); c.pl.color.set('#cfe0ff'); c.pl.intensity = 7; c.pl.distance = 9; sfx.thunder(); }
      if (e > 4.5 && !c.wh && once(c, 'breach')) { const [x, z] = [(.74 + .05) * 3.2, (.74 - .05) * 3.2]; c.wh = { k: 'breach', t: 0, x, z, hd: Math.atan2(-1, -.6) }; sfx.whale(); }
      if (e > 11.5 && once(c, 'spout')) { const x = 1.6, z = 1.95; for (let i = 0; i < 160; i++) c.Sm.emit(x + rnd(-.02, .02), W + .03, z + rnd(-.02, .02), rnd(-.05, .05), rnd(.9, 1.6), rnd(-.05, .05), rnd(1.2, 2), [1, 1, 1, .7], [1, 1, 1, 0], .03, .14, -.4, .5); noise(1.2, { filter: 'bandpass', ff: 700, q: .8, vol: .12 }); }
      if (e > 13 && once(c, 'flukes')) c.wh = { k: 'fluke', t: 0, x: 1.6, z: 1.95, hd: Math.atan2(-1, -.4) };
      if (e >= 23 && once(c, 'clear')) { Object.assign(MOD, c.saveMod); c.saveMod = null; redrawDecals(); setPal(computePal(), .8); }
    } else if (c.evT === undefined || c.evT >= 25) c.skyOv = null;
    // the whale
    const H = c.wh, g = c.whale;
    if (H) { H.t += dt; const q = H.t; g.visible = true; g.rotation.y = H.hd; const cs = Math.cos(H.hd), sn = -Math.sin(H.hd);
      if (H.k === 'breach') { const v0 = 1.85, gr = 2.1, y = W - .52 + v0 * q - .5 * gr * q * q, fwd = .28 * q; g.position.set(H.x + cs * fwd, y, H.z + sn * fwd);
        g.rotation.z = lerp(1.25, -.35, smooth01(q / 1.7)); g.rotation.x = lerp(0, 2.1, smooth01((q - .2) / 1.4)); c.pecs.forEach((p, i) => p.rotation.z = .5 + Math.sin(q * 3) * .25);
        if (q > .12 && once(c, 'up')) { splash(c, H.x, H.z, 1.1); sfx.splash(1.2); }
        if (q < .9) for (let i = 0; i < nOf(260, dt); i++) c.Sm.emit(H.x + cs * fwd + rnd(-.08, .08), W + .01, H.z + sn * fwd + rnd(-.08, .08), rnd(-.3, .3), rnd(.6, 1.6), rnd(-.3, .3), rnd(.6, 1.1), [.97, .99, 1, .9], [.9, .95, 1, 0], .02, .05, -3.4, .2);
        if (y < W - .05 && q > 1 && once(c, 'down')) { const px = g.position.x, pz = g.position.z; splash(c, px, pz, 2.6); splash(c, px + cs * .25, pz + sn * .25, 1.6); sfx.splash(2.6); sfx.boom(.7); c.shake = Math.max(c.shake, .03);
          for (let i = 0; i < 260; i++) { const a = rnd(TAU), r = rnd(.05, .4); c.Sm.emit(px + Math.cos(a) * r, W + .05, pz + Math.sin(a) * r, Math.cos(a) * rnd(.1, .4), rnd(.2, .9), Math.sin(a) * rnd(.1, .4), rnd(1.6, 3), [1, 1, 1, .45], [1, 1, 1, 0], .08, .35, -.15, .3); } }
        if (q > 2.8) { g.visible = false; c.wh = null; } }
      else { const rise = smooth01(q / 1.3), sink = smooth01((q - 2.4) / 1.8), y = lerp(W - .8, W - .38, rise) - .55 * sink; g.position.set(H.x, y, H.z);
        g.rotation.z = lerp(-.95, -1.38, rise) - .1 * sink; g.rotation.x = 0; g.updateMatrix();
        if (q > .5 && q < 3.6) for (let i = 0; i < nOf(140, dt); i++) { const p = _P.set(-rnd(0, .13), 0, rnd(-.17, .17)).applyMatrix4(c.fluke.matrix).applyMatrix4(g.matrix); if (p.y > W + .01) c.Sm.emit(p.x, p.y, p.z, rnd(-.02, .02), rnd(-.1, 0), rnd(-.02, .02), rnd(.4, .8), [.95, .98, 1, .85], [.9, .95, 1, 0], .012, .02, -3, .1); }
        if (q > 3.2 && once(c, 'tailin')) { splash(c, H.x, H.z, .9); sfx.splash(1); }
        if (q > 4.4) { g.visible = false; c.wh = null; } } }
  } });

story({ id: 'aurora', mood: ['lydian', 130.81],
  caption: () => ({ era: pick(['Svalbard · January · 02:14', 'Kp 7 · solar maximum', 'Arctic winter · day 61 of night']), name: pick(['Polar Night', 'Northern Lights', 'The Quiet Fjord']), line: pick(['The Sun is two months away, but it sent its regards.', 'Solar wind meets oxygen a hundred kilometres up. Down here, the dogs stop barking.']) }),
  water: .12, waterCol: '#1a2a3a', waterTop: '#24384a', waterDeep: '#081420', strata: ['#4a4e56', '#5a5e66', '#3a3e46', '#6a6e76'], soil: '#3a3a3e',
  pal: { sky: '#5a8aa0', ground: '#141c28', hemiI: .42, sun: '#a8c8ff', sunI: .32, dir: [4, 9, -5], dim: .3, tint: '#163a3a' },
  calm: { sky: '#4a6a90', ground: '#141c28', hemiI: .4, sun: '#b8c8ff', sunI: .35, dir: [4, 9, -5], dim: .32, tint: '#1a2a40' },
  height(u, v, n) { const fj = u + .15 * Math.sin(v * 3); return Math.max(-.1, .3 + n.ridge(u * 1.6, v * 1.6) * (.4 + .6 * Math.abs(u)) - Math.exp(-fj * fj / .025)); },
  color(h, s, u, v, n) { if (h < .16) return '#3a3e44'; if (s > 1.3) return n.vn(u * 10, v * 10) > 0 ? '#4a4e56' : '#3a3e46'; return n.vn(u * 15, v * 15) > .4 ? '#d8e2ec' : '#eef3f8'; },
  build(c) {
    addHouses(c, scatter(c, 9, (h, s) => h > .16 && h < .45 && s < .45), { colors: ['#b4402a', '#3a3a40'], roofs: ['#f0f4f8'] });
    addTrees(c, scatter(c, 40, (h, s) => h > .16 && h < .5 && s < .9), { kind: 'cone', colors: ['#1a2a22', '#22332a'] });
    c.aur = [0, 1, 2].map(k => { const g = new T.BufferGeometry(), N = 80, pos = new Float32Array((N + 1) * 6), uv = new Float32Array((N + 1) * 4), idx = []; for (let i = 0; i <= N; i++) { uv.set([i / N, 0, i / N, 1], i * 4); if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } } g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx);
      const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uA: { value: 0 }, uF: { value: 1 }, uSeed: { value: k * 3.1 } }, vertexShader: AVS, fragmentShader: AFS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); m.frustumCulled = false; m.userData.k = k; c.group.add(m); return m; });
    for (let i = 0; i < 220; i++) c.P.emit(rnd(-3.4, 3.4), rnd(2.9, 3.9), rnd(-3.4, 3.4), 0, 0, 0, 12, [1, 1, 1, .9], [1, 1, 1, .9], rnd(.012, .03), rnd(.012, .03));
    c.uA = 0; c.at = 0; c.pl.color.set('#5aff9a'); c.pl.position.set(0, 2.2, 0); c.pl.distance = 9;
  },
  update(c, t, dt) {
    const tgt = t < B0 ? 0 : t < B1 ? 1.8 : .15 + .5 * Math.max(0, 1 - (t - B1) / 5);
    c.uA = lerp(c.uA, tgt, 1 - Math.exp(-dt * (t < B1 ? 3 : .6))); c.at += dt * (t < B1 ? 3 : .8);
    if (t > B0 && once(c, 'sh')) sfx.shimmer();
    c.aur.forEach(m => { const k = m.userData.k, p = m.geometry.attributes.position.array; for (let i = 0; i <= 80; i++) { const x = -3 + 6 * i / 80, z = -1.4 + k * .9 + .5 * Math.sin(x * 1.1 + c.at * .5 + k * 2) + .2 * Math.sin(x * 2.7 - c.at * .8), yb = 1.75 + .15 * Math.sin(x * 1.7 + c.at + k), ht = .9 + .5 * Math.sin(x * .9 + c.at * .4 + k); p.set([x, yb, z, x, yb + ht, z], i * 6); } m.geometry.attributes.position.needsUpdate = true; m.material.uniforms.uTime.value = c.at; m.material.uniforms.uA.value = c.uA; });
    c.pl.intensity = c.uA * 1.3;
    if (t > B0 && t < B1 + 1 && R() < dt * 4) { const x0 = rnd(-3, 1), z0 = rnd(-3, 1), y0 = rnd(3, 3.8), vx = rnd(1.5, 2.5), vz = rnd(.5, 1.5); for (let q = 0; q < 24; q++) c.P.emit(x0 + vx * q * .015, y0 - q * .01, z0 + vz * q * .015, vx * .1, -.1, vz * .1, .3 + q * .02, [1, 1, .95, 1], [.6, .9, 1, 0], .03, .01); sfx.ping(); }
  } });

story({ id: 'contact', mood: ['lydian', 110],
  caption: () => ({ era: pick(['Kepler-442b · local dusk', 'Year 3 of the survey', 'Somewhere past Andromeda']), name: pick(['First Contact', 'Visitors', 'The Crystal Moon']), line: pick(['They came a very long way to borrow one rock.', 'The crystals have hummed for a million years. Tonight something answered.']) }),
  water: .2, waterCol: '#3affc0', waterGlow: '#1a8a70', waterTop: '#2ad0a0', waterDeep: '#0a3a3a', strata: ['#3a2a4a', '#4a3060', '#2a2040', '#5a3a70', '#3a2050'], soil: '#2a1a3a',
  pal: { sky: '#c8a2ff', ground: '#2a1a3a', hemiI: .55, sun: '#ffb4e4', sunI: .6, dir: [4, 8, -5], dim: .48, tint: '#3a2a5a' },
  calm: { sky: '#9a8ad0', ground: '#1a1428', hemiI: .5, sun: '#c8b0ff', sunI: .45, dir: [-4, 8, 4], dim: .45, tint: '#2a2a50' },
  height(u, v, n) { return .1 + n.ridge(u * 2.2 + 11, v * 2.2) * .6 + Math.pow(Math.max(0, n.fbm(u * 2 + 3, v * 2)), 2) * 1.4; },
  color(h, s, u, v, n) { if (h < .24) return '#2a6a6a'; if (h > .95) return '#c060a0'; if (s > 1) return '#3a2a5a'; return n.vn(u * 9, v * 9) > 0 ? '#5a3a7a' : '#4a3070'; },
  build(c) {
    const pts = scatter(c, 130, h => h > .24), cm = inst(new T.OctahedronGeometry(.07, 0), new T.MeshBasicMaterial(), pts.length, false), base = [];
    pts.forEach((p, i) => { _Q.setFromEuler(new T.Euler(rnd(-.3, .3), rnd(TAU), rnd(-.3, .3))); _P.set(p[0], p[1] + .08, p[2]); _S.set(1, rnd(2, 5), 1); _M.compose(_P, _Q, _S); cm.setMatrixAt(i, _M); const b = col(pick(['#5affe0', '#ff6ad0', '#8a7aff'])).clone(); base.push(b); cm.setColorAt(i, b.clone().multiplyScalar(.35)); });
    c.group.add(cm); c.cr = { m: cm, pts, base };
    [[-2.5, 3, -2.3, .32, '#f0e0ff'], [2.2, 3.4, -2.8, .18, '#ffd0a0']].forEach(([x, y, z, r, h]) => { const m = new T.Mesh(new T.SphereGeometry(r, 24, 16), new T.MeshBasicMaterial({ color: col(h) })); m.position.set(x, y, z); c.group.add(m); });
    const u = c.ufo = new T.Group(), metal = new T.MeshStandardMaterial({ color: col('#b8c0c8'), metalness: .85, roughness: .25 });
    const disc = new T.Mesh(new T.SphereGeometry(1, 32, 12), metal); disc.scale.set(.42, .085, .42); const dome = new T.Mesh(new T.SphereGeometry(.14, 20, 10, 0, TAU, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: col('#9ff6ff'), transparent: true, opacity: .75, roughness: .1 })); dome.position.y = .04;
    u.add(disc, dome); c.lights = []; for (let i = 0; i < 10; i++) { const l = new T.Mesh(new T.SphereGeometry(.022, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff })); l.position.set(Math.cos(i / 10 * TAU) * .4, -.01, Math.sin(i / 10 * TAU) * .4); u.add(l); c.lights.push(l); }
    u.traverse(o => { if (o.isMesh) o.castShadow = true; }); u.position.set(-4.5, 3.4, -3.5); c.group.add(u);
    const bg = new T.ConeGeometry(.5, 1.8, 32, 1, true); bg.translate(0, -.9, 0);
    c.beam = new T.Mesh(bg, new T.MeshBasicMaterial({ color: col('#9affe0'), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); c.group.add(c.beam);
    c.gy = c.hAt(0, 0); c.rock = new T.Mesh(new T.DodecahedronGeometry(.07, 0), new T.MeshStandardMaterial({ color: col('#8a7a9a'), roughness: .8 })); c.rock.position.set(0, c.gy + .05, 0); c.rock.castShadow = true; c.group.add(c.rock);
    c.pl.color.set('#7affe0'); c.pl.position.set(0, c.gy + .4, 0);
  },
  update(c, t, dt) {
    const u = c.ufo, hov = new T.Vector3(0, c.gy + 1.85, 0), TI = B0 - .2, TH = B0 + .5;
    if (t > TI && once(c, 'ufo')) sfx.ufo();
    if (t < TH) u.position.lerpVectors(new T.Vector3(-4.5, 3.4, -3.5), hov, easeOut(clamp((t - TI) / (TH - TI), 0, 1)));
    else if (t < B1) { u.position.copy(hov); u.position.y += Math.sin(t * 3) * .04; }
    else { const k = easeIn(clamp((t - B1) / .7, 0, 1)); u.position.lerpVectors(hov, new T.Vector3(6, 4.5, 4), k); if (k > 0 && k < 1) for (let i = 0; i < nOf(300, dt); i++) c.P.emit(u.position.x, u.position.y, u.position.z, 0, 0, 0, .5, [.6, 1, .95, .9], [.3, .5, 1, 0], .06, .02); if (t > B1 && once(c, 'zap')) sfx.zap(); }
    u.rotation.y += dt * 4; c.lights.forEach((l, i) => l.material.color.setHSL(((t * .6 + i / 10) % 1), 1, .65));
    const beamOn = t > TH && t < B1; c.beam.position.copy(u.position); c.beam.material.opacity = beamOn ? .2 + .08 * Math.sin(t * 30) : Math.max(0, c.beam.material.opacity - dt);
    if (beamOn) { const k = (t - TH) / (B1 - TH); c.rock.position.y = lerp(c.gy + .05, u.position.y - .12, easeInOut(k)); c.rock.rotation.x += dt * 2; for (let i = 0; i < nOf(260, dt); i++) { const a = rnd(TAU), r = rnd(0, .38); c.P.emit(Math.cos(a) * r, c.gy + .05, Math.sin(a) * r, 0, rnd(.9, 1.4), 0, 1.4, [.5, 1, .9, .9], [.4, .8, 1, 0], .04, .02); } }
    else if (t > B1) c.rock.visible = false;
    const cr = c.cr, tc = new T.Color();
    if (t > B0) { cr.pts.forEach((p, i) => { const d = Math.hypot(p[0], p[2]); let b = t < B1 ? .35 + 1.3 * Math.pow(Math.max(0, Math.sin((t - B0) * 6 - d * 3)), 2) : lerp(.9, .3, clamp((t - B1) / 3, 0, 1)); tc.copy(cr.base[i]).multiplyScalar(b); cr.m.setColorAt(i, tc); }); cr.m.instanceColor.needsUpdate = true; }
    c.pl.intensity = beamOn ? 2.2 : Math.max(0, c.pl.intensity - dt);
  } });

story({ id: 'geysers', mood: ['sus', 146.83],
  caption: () => ({ era: pick(['Yellowstone Plateau · dawn', 'Iceland · −4 °C · 07:10', 'Pleistocene · an ordinary Tuesday']), name: pick(['Hot Spring Basin', 'The Steam Field', 'Old Reliable']), line: pick(['Underground, the water has been heating for a while. It would like to leave.', 'The ground takes a deep breath, and then another.']) }),
  water: null, strata: ['#b8a890', '#a89878', '#c8b8a0', '#8a7a68', '#d8c8b0'], soil: '#7a6a58',
  pal: { sky: '#e2ecf6', ground: '#7a7060', hemiI: .8, sun: '#fff0dc', sunI: .9, dir: [-6, 8, -3], dim: .97 },
  calm: { sky: '#ffe2c8', ground: '#7a6a58', hemiI: .75, sun: '#ffcfa0', sunI: .9, dir: [6, 7, -2], dim: .9 },
  pre(c) { c.pools = Array.from({ length: 6 }, () => [rnd(-.6, .6), rnd(-.6, .6), rnd(.1, .2)]); },
  height(u, v, n, c) { let h = .42 + n.fbm(u * 1.4, v * 1.4) * .22; for (const [px, pz, r] of c.pools) { const d = Math.hypot(u - px, v - pz) / r; if (d < 1) h = lerp(.36, h, Math.pow(d, 4)); } return h; },
  color(h, s, u, v, n, c) { for (const [px, pz, r] of c.pools) { const d = Math.hypot(u - px, v - pz) / r; if (d < .45) return '#1a7fa6'; if (d < .62) return '#3fbdd0'; if (d < .75) return '#e8cc4a'; if (d < .9) return '#e08a2a'; if (d < 1.15) return '#a85a2a'; if (d < 1.6) return '#ddd8c8'; } return n.vn(u * 8, v * 8) > .2 ? '#9a9468' : '#a8a274'; },
  build(c) { addTrees(c, scatter(c, 120, (h, s, x, z) => Math.hypot(x, z) > 2.3 && s < 1), { kind: 'cone', colors: ['#2a4a30', '#33553a'] }); c.gy = c.pools.slice(0, 4).map((p, i) => { const x = p[0] * 3.2, z = p[1] * 3.2; return { x, z, y: c.hAt(x, z), t0: B0 + i * .45, i }; }); },
  update(c, t, dt) {
    const Sm = c.Sm;
    c.gy.forEach(g => { const e = t - g.t0; if (e > 0 && e < 2.3) { if (once(c, 'g' + g.i)) { sfx.geyser(); c.shake = .04; } const k = e < .3 ? e / .3 : e > 1.9 ? (2.3 - e) / .4 : 1;
      for (let i = 0; i < nOf(700 * k, dt); i++) Sm.emit(g.x + rnd(-.03, .03), g.y + .02, g.z + rnd(-.03, .03), rnd(-.22, .22), rnd(3.2, 5) * (.7 + .3 * k), rnd(-.22, .22), rnd(.9, 1.4), [.95, .98, 1, .95], [.85, .9, 1, 0], .035, .07, -5.5, .2);
      for (let i = 0; i < nOf(30 * k, dt); i++) Sm.emit(g.x + rnd(-.2, .2), g.y + rnd(.5, 1.6), g.z + rnd(-.2, .2), rnd(-.1, .1) + .08, rnd(.2, .5), rnd(-.1, .1), rnd(3, 5), [1, 1, 1, .5], [1, 1, 1, 0], .2, 1, .05, .6); }
      if (t > B1 && t < E) for (let i = 0; i < nOf(5, dt); i++) Sm.emit(g.x + rnd(-.15, .15), g.y + .05, g.z + rnd(-.15, .15), .05, rnd(.15, .3), 0, rnd(3, 4), [1, 1, 1, .35], [1, 1, 1, 0], .12, .6, 0, .3); });
  } });

story({ id: 'lanterns', mood: ['major', 164.81],
  caption: () => ({ era: pick(['Full moon · twelfth month', 'Night of the festival · 21:00', 'Year of the Rabbit · late evening']), name: pick(['Lantern Festival', 'A Thousand Wishes', 'River of Lights']), line: pick(['Everyone lets go at once. The sky takes it from there.', 'Each lantern carries one wish. A few carry two.']) }),
  water: .16, waves: true, waterCol: '#1a2440', waterTop: '#24304e', waterDeep: '#0a0e1c', strata: ['#4a3828', '#5a4634', '#3a2c20', '#6a523c'], soil: '#2a1e14',
  pal: { sky: '#5a4a8a', ground: '#1a1520', hemiI: .38, sun: '#b0b0ff', sunI: .3, dir: [5, 9, -4], dim: .3, tint: '#2a1a3a' },
  calm: { sky: '#4a4a80', ground: '#1a1520', hemiI: .4, sun: '#c0c0ff', sunI: .32, dir: [5, 9, -4], dim: .33, tint: '#2a1a3a' },
  height(u, v, n) { let h = .3 + n.fbm(u * 1.5 + 2, v * 1.5) * .5 + Math.abs(u) * .35; const rv = u - .25 * Math.sin(v * 2.2); h -= Math.exp(-rv * rv / .02) * .4; if (h > .24) h = lerp(Math.floor(h * 13) / 13, h, .15); return h; },
  color(h, s, u, v, n) { if (h < .19) return '#4a4a3a'; if (s > .9) return '#3a2c20'; return n.vn(u * 5, v * 5) > 0 ? '#3a5a40' : '#4a6a48'; },
  build(c) { c.hs = addHouses(c, scatter(c, 40, (h, s) => h > .2 && h < .55 && s < .55), { colors: ['#7a3a2a', '#5a4a3a', '#e0d0b0'], roofs: ['#2a2a2e', '#3a2a2a'] }); addTrees(c, scatter(c, 50, (h, s) => h > .3 && s < 1), { kind: 'round', colors: ['#1f3324', '#28402c'] }); c.pl.color.set('#ffb060'); c.pl.position.set(0, 1, 0); c.pl.distance = 8; },
  update(c, t, dt) {
    const P = c.P, inB = t > B0 && t < B1;
    if (t > B0 && once(c, 'gong')) { sfx.gong(); flash('#ffc070', .2); }
    if (t > B0 && t < B0 + .6) for (let i = 0; i < nOf(600, dt); i++) P.emit(rnd(-.1, .1), .5, rnd(-.1, .1), rnd(-.5, .5), rnd(2, 3.4), rnd(-.5, .5), rnd(.6, 1), [1, .9, .6, 1], [1, .6, .2, 0], .05, .02, -2);
    if (inB) { for (let i = 0; i < nOf(240, dt); i++) { const src = R() < .7 && c.hs.pts.length ? pick(c.hs.pts) : [rnd(-2.5, 2.5), 0, rnd(-2.5, 2.5)], x = src[0] + rnd(-.1, .1), z = src[2] + rnd(-.1, .1); P.emit(x, c.hAt(x, z) + .1, z, rnd(-.05, .05) + .06, rnd(.32, .6), rnd(-.05, .05), rnd(6, 9), [1, .78, .38, 1], [1, .42, .12, 0], .065, .045, .015, 0, 0, 2.4); } if (R() < dt * 3) sfx.bell(); }
    c.pl.intensity = inB ? 1.6 : Math.max(0, c.pl.intensity - dt * .3);
  } });

/* Night Shift: a beach city. The towers climb to the far corner; the near side opens onto a promenade, a sand beach and
   the sea. A river estuary cuts through the left with a great suspension bridge across its mouth, and on the right a
   marina is closed by a breakwater whose tip carries a colossal bronze figure holding up a ring of light.
   s = (u - v) / 2 runs along the shore (screen left to right), b = (u + v) / 2 runs from the far corner to the sea. */
const NS0 = -.4, NBB = .1; // estuary centre (s) and the bridge line (b)
const nShore = s => .26 + .05 * Math.sin(s * 4.5 + 1);
const nEstW = b => .075 + clamp(b + .3, 0, 1) * .07;
const nMarina = (u, v) => u > .47 && u < .9 && v > -.4;
const NBW = [[.94, -.44], [.84, .6]]; // breakwater (u, v); the statue stands on its tip
const segD = (u, v, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((u - a[0]) * dx + (v - a[1]) * dz) / (dx * dx + dz * dz), 0, 1); return Math.hypot(u - a[0] - dx * t, v - a[1] - dz * t); };
const nCity = (x, z) => { const u = x / 3.2, v = z / 3.2, b = (u + v) / 2, s = (u - v) / 2;
  return !(b > nShore(s) - .14 || (b > -.62 && Math.abs(s - NS0) < nEstW(b) + .045) || (Math.abs(b - NBB) < .065 && Math.abs(s - NS0) < .3) || (u > .43 && u < .95 && v > -.45)); };
story({ id: 'neon', frame: { zoom: 1.7, el: .46, deck: .9, drop: 3.5 }, depth: 1.5, nseg: 150, waves: true, surf: .7, glints: 30, preset: { time: 3, clouds: 1, rain: 0, wind: 1, glow: 3, life: 1 }, mood: ['minor', 110],
  caption: () => ({ era: pick(['2187 · 03:00 · low tide', 'Sector 9 · shift change', 'Year 2311 · power restored']), name: pick(['Megacity, 2187', 'Night Shift', 'Grid Wake']), line: pick(['At three in the morning the city flips every switch it owns.', 'Ten million windows, one beach, and a bronze giant keeping the harbour light.', 'The bridge never sleeps. Neither does the marina.']) }),
  water: .1, waterCol: '#1a3a66', waterTop: '#3c6a92', waterDeep: '#050c26', strata: ['#4a4640', '#3a3732', '#55504a', '#302d29', '#46423b'], soil: '#2a2724', aquatic: { schools: 6, big: 1, size: .08, plankton: 260, cols: ['#8a8a84', '#a8b0b4', '#e6ded0'], bigCol: '#5a6670' },
  pal: { sky: '#5a6888', ground: '#14161a', hemiI: .38, sun: '#a8b4d8', sunI: .32, dir: [5, 9, -4], dim: .32, tint: '#1e2634' },
  calm: { sky: '#ffc8a8', ground: '#3a3040', hemiI: .62, sun: '#ffb282', sunI: .85, dir: [7, 4, -2], dim: .78 },
  height(u, v, n) {
    const b = (u + v) / 2, s = (u - v) / 2, bs = b - nShore(s);
    let h = .2 + n.fbm(u * 3, v * 3) * .01;
    if (bs > 0) { h = lerp(.19, .055, clamp(bs / .13, 0, 1)); if (bs > .13) { const k = clamp((bs - .13) / .24, 0, 1); h = lerp(.055, -.62, k * k * (3 - 2 * k)) + n.fbm(u * 5, v * 5) * .04; } }
    if (b > -.55) { const d = Math.abs(s - NS0 + .03 * Math.sin(b * 6)), hw = nEstW(b) * clamp((b + .55) / .12, 0, 1); if (d < hw + .012) { const fl = -.46 + n.fbm(u * 6, v * 6) * .03; h = Math.min(h, d < hw ? fl : lerp(fl, .2, (d - hw) / .012)); } }
    if (nMarina(u, v)) { const e = Math.min(u - .47, .9 - u, v + .4), fl = -.4 + n.fbm(u * 6, v * 6) * .02; h = Math.min(h, e > .012 ? fl : lerp(.2, fl, e / .012)); }
    const bw = segD(u, v, NBW[0], NBW[1]); if (bw < .04) h = Math.max(h, lerp(.23, .02, Math.pow(bw / .04, 2)) + n.vn(u * 40, v * 40) * .012);
    const sd = Math.hypot(u - NBW[1][0], v - NBW[1][1]); if (sd < .1) h = Math.max(h, sd < .075 ? .25 : lerp(.25, -.1, (sd - .075) / .025));
    return h; },
  color(h, sl, u, v, n) {
    const b = (u + v) / 2, s = (u - v) / 2, bs = b - nShore(s);
    if (Math.hypot(u - NBW[1][0], v - NBW[1][1]) < .077 && h > .2) return '#8a8478';
    if (segD(u, v, NBW[0], NBW[1]) < .04 && h > .08) return n.vn(u * 60, v * 60) > 0 ? '#6a665e' : '#56524b';
    if (h < .1) return h < -.25 ? '#34362f' : (n.vn(u * 30, v * 30) > 0 ? '#7a6e56' : '#86795e');
    if (bs > -.012 && h < .196) return n.vn(u * 40, v * 40) > .2 ? '#c4b08c' : '#d0bd98';
    if (bs > -.045) return n.vn(u * 50, v * 50) > .3 ? '#7a7266' : '#857c6e';
    const fu = (u + 1) * 5.5, fv = (v + 1) * 5.5; return (fu - Math.floor(fu) < .16 || fv - Math.floor(fv) < .16) ? '#24252b' : '#3a3b42'; },
  build(c) {
    const G = c.G, uv = (s, b) => [(b + s) * 3.2, (b - s) * 3.2], glow = (x, y, z, cl, sz) => G.emit(x, y, z, 0, 0, 0, 1e6, cl, cl, sz, sz);
    const WARM = [1, .68, .3, .9], WHITE = [1, .9, .72, .9];
    c.shore = c.shore.filter(p => { const u = p.x / 3.2, v = p.z / 3.2, b = (u + v) / 2, s = (u - v) / 2; return !nMarina(u, v) && Math.abs(s - NS0) > nEstW(b) + .03 && segD(u, v, NBW[0], NBW[1]) > .06 && Math.hypot(u - NBW[1][0], v - NBW[1][1]) > .1; });
    // ---- towers. Plain plots become one of several types (slab, podium tower, setback, round, octagonal, twin slabs),
    // concrete or glass, with rooftop plant: water tanks, cooling units, helipads, masts with aircraft beacons. Larger
    // plots may become art-deco setback towers with gold bands, fins, spires and lit crowns. Neon blade signs hang off
    // mid-rise facades, and searchlights on the tallest roofs sweep the sky.
    const bl = [];
    for (let a = 0; a < 11; a++) for (let b = 0; b < 11; b++) { const uc = (a + .58) / 5.5 - 1, vc = (b + .58) / 5.5 - 1, d = Math.hypot(uc + .42, vc + .42) * .78, cx = uc * 3.2, cz = vc * 3.2, sub = R() < .4 ? 2 : 1, w = .46 / sub;
      for (let i = 0; i < sub; i++) for (let j = 0; j < sub; j++) { const x = cx + (i - (sub - 1) / 2) * w, z = cz + (j - (sub - 1) / 2) * w, hw = w * .43;
        if (![[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([p, q]) => nCity(x + p * hw, z + q * hw))) continue;
        bl.push({ x, z, w: w * .86, h: clamp(rnd(.1, .35) + Math.pow(Math.max(0, 1.3 - d), 2.2) * rnd(1, 3.4) + (d < .3 && R() < .5 ? rnd(.5, 1.1) : 0), .08, 4.5), d }); } }
    let nDeco = 0; bl.forEach(o => { o.deco = nDeco < 14 && o.w > .3 && ((o.h > 1 && R() < .55) || (o.h > .45 && R() < .18)); if (o.deco) { nDeco++; o.h = Math.max(o.h, .7); } });
    const conc = [], glas = [], rnd8 = [], rnd20 = [], trims = [], fins = [], spires = [], lamps = [], plant = [], tanks = [], masts = [], pads = [], signs = [], beacons = [], gardens = [], pyrs = [];
    const STONE = ['#8a7e6c', '#9a8e78', '#76705f', '#a89a82'], TIERS = [[0, .58, 1], [.58, .2, .8], [.78, .12, .6], [.9, .1, .42]], GLASS = ['#3e5a6a', '#4a5e66', '#5a5448', '#36505e', '#4c4a40'];
    const winA = (warm = R()) => [rnd(11, 20), rnd(13, 22), warm, rnd(.3, .8)], box = (list, x, z, y, w, h, cl, wa, dd = w, ry = 0) => list.push({ x, z, y, w, h, d: dd, c: cl, wa, ry });
    bl.forEach(o => {
      const x = o.x, z = o.z, H = o.h, W = o.w, dist = o.dist = Math.hypot(x + 1.34, z + 1.34);
      if (o.deco) { const st = pick(STONE), wa = winA(.92);
        TIERS.forEach(([f0, fh, fw], k) => { const y = .2 + H * f0; box(conc, x, z, y, W * fw, H * fh, st, wa); if (k < 3) trims.push({ x, z, y: y + H * fh, w: W * fw * 1.05, h: .014 }); });
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => [-.22, 0, .22].forEach(off => { const fw = W / 2 + .008; fins.push({ x: x + dx * fw + dz * off * W, z: z + dz * fw + dx * off * W, y: .2, h: H * .55, sx: dx ? .03 : .022, sz: dx ? .022 : .03 }); }));
        spires.push({ x, z, y: .2 + H, h: H * .24, r: W * .07 }); lamps.push({ x, z, y: .2 + H * .935, w: W * .44, h: H * .03, dist });
        glow(x, .2 + H * .97, z, [1, .78, .45, .7], W * .9); o.top = .2 + H * 1.24; if (H > 1.4) beacons.push({ x, y: o.top + .01, z, ph: R() });
        o.topY = .2 + H; o.tw = 0; return; }
      const isG = H > .7 && R() < .45, L = isG ? glas : conc, cl = isG ? pick(GLASS) : pick(['#5e6268', '#4e545c', '#6a665e', '#58524a', '#727068', '#64584c']), wa = winA(), r = R();
      o.kind = H > 1.5 && r < .11 ? 'twist' : H > 1.2 && r < .22 ? 'spire' : H > .55 && r < .3 ? 'round' : H > .55 && r < .37 ? 'octa' : W > .3 && r < .49 ? 'twin' : H > .65 && W > .3 && r < .59 ? 'stack' : H > .5 && r < .71 ? 'step' : H > .6 && r < .82 ? 'podium' : 'box';
      o.topY = .2 + H; o.tw = W;
      if (o.kind === 'round') { rnd20.push({ x, z, y: .2, w: W * .96, h: H, d: W * .96, c: cl, wa }); o.tw = W * .7; }
      else if (o.kind === 'octa') { rnd8.push({ x, z, y: .2, w: W, h: H, d: W, c: cl, wa }); o.tw = W * .7; }
      else if (o.kind === 'twist') { // floor plates turning a few degrees each storey around a dark core
        const n = Math.max(10, Math.round(H / .07)), sh = H / n, tw0 = rnd(.045, .08) * (R() < .5 ? 1 : -1), gc = pick(GLASS); box(conc, x, z, .2, W * .4, H, '#2e3034', [14, 18, .6, .15]);
        for (let k = 0; k < n; k++) box(glas, x, z, .2 + k * sh, W * .8, sh * .8, gc, wa, W * .8, k * tw0);
        lamps.push({ x, z, y: .2 + H + .01, w: W * .42, h: .02, dist }); o.tw = W * .4; o.noRoof = 1; o.top = .2 + H + .02; }
      else if (o.kind === 'spire') { // a tiered pinnacle, each setback edged with light, a needle and a beacon on top
        let y = .2; [[1, .42], [.8, .2], [.63, .15], [.47, .11], [.33, .08]].forEach(([fw, fh]) => { box(L, x, z, y, W * fw, H * fh, cl, wa); y += H * fh; lamps.push({ x, z, y: y + .004, w: W * fw * 1.01, h: .01, dist }); });
        masts.push({ x, z, y, h: H * .24 }); beacons.push({ x, y: y + H * .24, z, ph: R() }); o.topY = y; o.tw = W * .33; o.noRoof = 1; o.top = y + H * .24; }
      else if (o.kind === 'stack') { // offset blocks stacked crosswise
        const n = 3 + Math.floor(rnd(3)), bh = H / n; let y = .2; for (let k = 0; k < n; k++) { box(L, x + rnd(-.12, .12) * W, z + rnd(-.12, .12) * W, y, W * rnd(.62, .86), bh * .97, k % 2 ? cl : pick([cl, '#6a665e', pick(GLASS)]), wa, W * rnd(.5, .78), (k % 2) * Math.PI / 2 + rnd(-.22, .22)); y += bh; } o.tw = W * .45; }
      else if (o.kind === 'twin') { // two slabs joined by glazed sky bridges
        const h2 = H * rnd(.55, .85), ax = R() < .5, sw = W * .38, ex = ax ? W * .3 : 0, ez = ax ? 0 : W * .3;
        box(L, x - ex, z - ez, .2, ax ? sw : W, H, cl, wa, ax ? W : sw); box(L, x + ex, z + ez, .2, ax ? sw : W, h2, cl, wa, ax ? W : sw);
        [.42, .7].forEach(f => box(glas, x, z, .2 + Math.min(H, h2) * f, ax ? W * .3 : W * .42, .045, '#5a7480', [30, 26, .5, .95], ax ? W * .42 : W * .3));
        if (ax) o.x2 = x - ex; else o.z2 = z - ez; o.tw = sw; }
      else if (o.kind === 'step') { box(L, x, z, .2, W, H * .62, cl, wa); box(L, x, z, .2 + H * .62, W * .66, H * .38, cl, wa); o.tw = W * .66; trims.push({ x, z, y: .2 + H * .62, w: W * 1.01, h: .008, plain: 1 }); gardens.push({ x, z, y: .2 + H * .62, w: W * .97 }); }
      else if (o.kind === 'podium') { box(conc, x, z, .2, W, .13, pick(STONE), winA(.9)); box(L, x, z, .33, W * .72, H - .13, cl, wa); o.tw = W * .72; gardens.push({ x, z, y: .33, w: W * .96 }); }
      else { box(L, x, z, .2, W, H, cl, wa); if (isG && H > 1.05 && R() < .45) { pyrs.push({ x, z, y: .2 + H, w: W * .96, h: W * .55 }); o.noRoof = 1; o.top = .2 + H + W * .55; } }
      const tx = o.x2 ?? x, tz = o.z2 ?? z, tw = o.tw;
      if (!o.noRoof) {
        if (H < 1.15 && R() < .6) { if (R() < .55) tanks.push({ x: tx + rnd(-.25, .25) * tw, z: tz + rnd(-.25, .25) * tw, y: o.topY }); else for (let k = 0; k < 2; k++) plant.push({ x: tx + rnd(-.28, .28) * tw, z: tz + rnd(-.28, .28) * tw, y: o.topY, s: rnd(.04, .07) }); }
        if (H > 1.3 && R() < .6) { const mh = rnd(.14, .34); masts.push({ x: tx, z: tz, y: o.topY, h: mh }); beacons.push({ x: tx, y: o.topY + mh, z: tz, ph: R() }); }
        else if (H > 1 && o.kind !== 'round' && o.kind !== 'stack' && R() < .35) { pads.push({ x: tx, z: tz, y: o.topY, r: tw * .36 }); glow(tx, o.topY + .01, tz, [.55, 1, .6, .5], tw * .5); } }
      if (H > .35 && H < 1.7 && signs.length < 24 && R() < .35) { const f = pick([[1, 0], [0, 1], [-1, 0], [0, -1]]), sh = rnd(.12, .26), sy = .2 + rnd(.12, Math.max(.13, H - sh - .05)) + sh / 2, half = (o.kind === 'podium' ? W * .72 : W) / 2;
        if (o.kind === 'box' || o.kind === 'podium' || o.kind === 'step') signs.push({ x: x + f[0] * (half + .03), z: z + f[1] * (half + .03), y: sy, h: sh, sx: f[0] ? .05 : .012, sz: f[0] ? .012 : .05, c: col(pick(['#ff6a4a', '#ffb050', '#5ad0c0', '#efe2c4', '#ff4a6a', '#9ad06a'])).clone(), c2: col(pick(['#ffb050', '#ff6a4a', '#efe2c4'])).clone(), ph: R(), mode: Math.floor(rnd(3)), dist }); }
    });
    const tc = new T.Color(), MAT = (o = {}) => new T.MeshStandardMaterial(o);
    const towerMesh = (list, geo, mat, round) => { const g = geo.clone(), wa = new Float32Array(Math.max(1, list.length) * 4); list.forEach((o, i) => wa.set(o.wa, i * 4)); g.setAttribute('aWin', new T.InstancedBufferAttribute(wa, 4)); addWindows(mat, c.winU, round, c.casU);
      const m = inst(g, mat, list.length); list.forEach((o, i) => { _Q.setFromAxisAngle(UP, o.ry || 0); _P.set(o.x, o.y, o.z); _S.set(o.w, o.h, o.d); _M.compose(_P, _Q, _S); m.setMatrixAt(i, _M); m.setColorAt(i, tc.copy(col(o.c))); }); c.group.add(m); return m; };
    const bg = new T.BoxGeometry(1, 1, 1); bg.translate(0, .5, 0); c.winU = { value: 1 }; c.casU = { value: 99 };
    const cyl20 = new T.CylinderGeometry(.5, .5, 1, 20); cyl20.translate(0, .5, 0); let cyl8 = new T.CylinderGeometry(.5, .5, 1, 8).toNonIndexed(); cyl8.rotateY(Math.PI / 8); cyl8.translate(0, .5, 0); cyl8.computeVertexNormals();
    towerMesh(conc, bg, MAT({ roughness: .72, metalness: .08 })); towerMesh(glas, bg, MAT({ roughness: .16, metalness: .72, envMapIntensity: 1.1 }));
    towerMesh(rnd20, cyl20, MAT({ roughness: .2, metalness: .65, envMapIntensity: 1.1 }), true); towerMesh(rnd8, cyl8, MAT({ roughness: .5, metalness: .3 }), true);
    const cap = inst(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), bl.length, false), strip = inst(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), bl.length, false);
    c.lit = bl.map((o, i) => { _Q.identity(); const plain = !o.deco && !o.noRoof && o.kind !== 'round' && o.kind !== 'octa' && o.kind !== 'stack'; _P.set(o.x2 ?? o.x, o.topY + .012, o.z2 ?? o.z); _S.set(plain ? o.tw * .92 : 0, .02, plain ? (o.kind === 'twin' ? (o.x2 !== undefined ? o.w : o.tw) : o.tw) * .92 : 0); _M.compose(_P, _Q, _S); cap.setMatrixAt(i, _M);
      const hasStrip = (o.kind === 'box' || o.kind === 'step') && R() < .45; _P.set(o.x + o.w / 2, .2 + o.h * .31, o.z + o.w / 2); _S.set(.016, hasStrip ? o.h * .6 : 0, .016); _M.compose(_P, _Q, _S); strip.setMatrixAt(i, _M);
      cap.setColorAt(i, tc.setRGB(0, 0, 0)); strip.setColorAt(i, tc); return { base: col(pick(['#ffb050', '#ffe2b0', '#cfe4ff', '#ff6a4a', '#5ad0c0', '#ffb050'])).clone(), dist: o.dist }; });
    const gold = c.goldM = MAT({ color: col('#b8904a'), metalness: .85, roughness: .32, emissive: col('#ffb860'), emissiveIntensity: 0 });
    const simple = (list, geo, mat, f, shadow = true) => { const m = inst(geo, mat, list.length, shadow); list.forEach((o, i) => { _Q.identity(); f(o); _M.compose(_P, _Q, _S); m.setMatrixAt(i, _M); }); c.group.add(m); return m; };
    simple(trims, new T.BoxGeometry(1, 1, 1), gold, o => { _P.set(o.x, o.y, o.z); _S.set(o.w, o.h, o.w); });
    simple(fins, bg, MAT({ color: col('#6a6254'), roughness: .7 }), o => { _P.set(o.x, o.y, o.z); _S.set(o.sx, o.h, o.sz); });
    const spg = new T.ConeGeometry(1, 1, 8); spg.translate(0, .5, 0); simple(spires, spg, gold, o => { _P.set(o.x, o.y, o.z); _S.set(o.r, o.h, o.r); });
    const tg = mergeGeo([(() => { const g = new T.CylinderGeometry(.03, .03, .05, 10); g.translate(0, .045, 0); return g; })(), (() => { const g = new T.ConeGeometry(.034, .025, 10); g.translate(0, .082, 0); return g; })(), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => { const g = new T.CylinderGeometry(.003, .003, .02, 3); g.translate(a * .02, .01, b * .02); return g; })]);
    simple(tanks, tg, MAT({ color: col('#6a5444'), roughness: .9 }), o => { _P.set(o.x, o.y, o.z); _S.set(1, 1, 1); });
    simple(plant, bg, MAT({ color: col('#8a8c88'), roughness: .5, metalness: .4 }), o => { _P.set(o.x, o.y, o.z); _S.set(o.s, o.s * .55, o.s * 1.3); });
    simple(gardens, bg, MAT({ color: col('#4a6236'), roughness: .95 }), o => { _P.set(o.x, o.y, o.z); _S.set(o.w, .014, o.w); });
    const pg = new T.ConeGeometry(.7071, 1, 4); pg.rotateY(Math.PI / 4); pg.translate(0, .5, 0); c.pyrM = MAT({ color: col('#7a94a4'), metalness: .6, roughness: .18, emissive: col('#ffd9a8'), emissiveIntensity: 0 }); simple(pyrs, pg, c.pyrM, o => { _P.set(o.x, o.y, o.z); _S.set(o.w, o.h, o.w); });
    const mg = new T.CylinderGeometry(.004, .007, 1, 4); mg.translate(0, .5, 0); simple(masts, mg, MAT({ color: col('#9a9690'), roughness: .4, metalness: .6 }), o => { _P.set(o.x, o.y, o.z); _S.set(1, o.h, 1); });
    simple(pads, new T.CylinderGeometry(1, 1, .01, 20), MAT({ color: col('#3a3c3e'), roughness: .8 }), o => { _P.set(o.x, o.y + .005, o.z); _S.set(o.r, 1, o.r); });
    const lm = c.lampM = simple(lamps, new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), o => { _P.set(o.x, o.y, o.z); _S.set(o.w * 1.02, o.h, o.w * 1.02); }, false); lamps.forEach((o, i) => lm.setColorAt(i, tc.setRGB(0, 0, 0))); c.lamps = lamps;
    const sgm = c.signM = simple(signs, new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), o => { _P.set(o.x, o.y, o.z); _S.set(o.sx, o.h, o.sz); }, false); signs.forEach((o, i) => sgm.setColorAt(i, tc.setRGB(0, 0, 0))); c.signs = signs;
    c.beacons = beacons; c.group.add(cap, strip); c.cap = cap; c.strip = strip;
    c.beamSrc = bl.filter(o => o.top || o.h > 1).sort((a, b) => (b.top || b.topY) - (a.top || a.topY)).slice(0, 8).map(o => [o.x2 ?? o.x, (o.top || o.topY) + .01, o.z2 ?? o.z]);
    // ---- streamline beach hotels along the promenade: rounded ends, eyebrow bands, ribbon windows, a neon fin sign
    const hb = [], hg = [], hn = [], HCOL = ['#e6dcc6', '#dccbb0', '#d6ad94', '#c4c8ac', '#e8d6c0'], HQ = new T.Quaternion().setFromAxisAngle(UP, Math.PI / 4), tf = new T.Matrix4();
    const put = (list, g, x, y, z, color) => { g.translate(x, y, z); if (color) g = paint(g, () => color); list.push(g); return g; };
    for (let k = 0; k < 5; k++) { const s = lerp(-.2, .12, k / 4) + rnd(-.015, .015), b = nShore(s) - .085, [x, z] = uv(s, b); if (c.hAt(x, z) < .19) continue;
      const L = rnd(.26, .34), D = rnd(.16, .2), Hh = rnd(.3, .5), body = pick(HCOL), fl = Math.max(3, Math.round(Hh / .07)), parts = [], glass = [], neon = [];
      put(parts, new T.BoxGeometry(L, Hh, D), 0, Hh / 2, 0, body); put(parts, new T.CylinderGeometry(D / 2, D / 2, Hh, 16), L / 2, Hh / 2, 0, body);
      put(parts, new T.BoxGeometry(L * .32, .06, D * .55), -L * .18, Hh + .03, 0, body); put(parts, new T.BoxGeometry(L * .14, .05, D * .35), -L * .18, Hh + .085, 0, body);
      for (let f = 1; f < fl; f++) { const y = f * Hh / fl; put(parts, new T.BoxGeometry(L + .02, .007, D + .03), 0, y, 0, '#f0eadc'); put(parts, new T.CylinderGeometry(D / 2 + .015, D / 2 + .015, .007, 16), L / 2, y, 0, '#f0eadc');
        put(glass, new T.BoxGeometry(L * .97, .026, D + .004), 0, y - Hh / fl * .5, 0); put(glass, new T.CylinderGeometry(D / 2 + .002, D / 2 + .002, .026, 16), L / 2, y - Hh / fl * .5, 0); }
      put(neon, new T.BoxGeometry(.014, Hh * .7, .07), -L * .36, Hh * .55, D / 2 + .035);
      tf.compose(_P.set(x, .2, z), HQ, _S.set(1, 1, 1)); [parts, glass, neon].forEach(a => a.forEach(g => g.applyMatrix4(tf))); hb.push(...parts); hg.push(...glass); hn.push(...neon);
      c.stamp(x, z, .25, .8); }
    if (hb.length) { const m1 = new T.Mesh(mergeGeo(hb), new T.MeshStandardMaterial({ vertexColors: true, roughness: .7 })); m1.castShadow = m1.receiveShadow = true;
      const gm = new T.MeshBasicMaterial({ color: col('#22252c') }); c.winMats.push(gm); const m2 = new T.Mesh(mergeGeo(hg), gm);
      c.neonM = new T.MeshBasicMaterial({ color: col('#ff6a4a') }); const m3 = new T.Mesh(mergeGeo(hn), c.neonM); c.group.add(m1, m2, m3); }
    // promenade palms and lamps
    const palms = []; for (let s = -.26; s <= .17; s += .065) { const [x, z] = uv(s + rnd(-.01, .01), nShore(s) - .025); if (c.hAt(x, z) > .19) palms.push([x, c.hAt(x, z), z]); }
    addTrees(c, palms, { kind: 'palm', scale: 1.05, colors: ['#3a5a30', '#4a6a36'], stamp: false });
    for (let s = -.28; s <= .2; s += .03) { const [x, z] = uv(s, nShore(s) - .04); if (c.hAt(x, z) > .19) glow(x, .27, z, WARM, .05); }
    for (let s = -.24; s <= .12; s += rnd(.05, .09)) { const [x, z] = uv(s, nShore(s) + .045), h = c.hAt(x, z); if (h > c.water + .01) glow(x, h + .02, z, [1, .55, .22, .8], .04); }
    // ---- the estuary quays
    for (let b = -.5; b <= .24; b += .035) [-1, 1].forEach(sd => { const [x, z] = uv(NS0 + sd * (nEstW(b) + .018), b); if (c.hAt(x, z) > .18) glow(x, .23, z, WARM, .04); });
    // ---- the great bridge across the estuary mouth: deco towers on footings, catenary main cables, hangers, a lit deck
    { const [cx, cz] = uv(NS0, NBB), D = new T.Vector3(1, 0, -1).normalize(), P = new T.Vector3(1, 0, 1).normalize(), LH = 1.15, TW = .41, TT = 1.5, DY = .5;
      const at = (t, lat, y) => new T.Vector3(cx + D.x * t + P.x * lat, y, cz + D.z * t + P.z * lat), deckY = t => .2 + (DY - .2) * (1 - clamp((Math.abs(t) - .62) / (LH - .62), 0, 1) ** 2 * (3 - 2 * clamp((Math.abs(t) - .62) / (LH - .62), 0, 1)));
      c.br = { at, deckY, LH };
      const N = 56, dk = inst(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: col('#4e4b46'), roughness: .8 }), N), gd = inst(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: col('#6a6458'), roughness: .6, metalness: .3 }), N * 2), eu = new T.Euler();
      for (let i = 0; i < N; i++) { const t0 = -LH + i / N * 2 * LH, t1 = t0 + 2 * LH / N, y0 = deckY(t0), y1 = deckY(t1), a = Math.atan2(y1 - y0, t1 - t0), len = Math.hypot(t1 - t0, y1 - y0) * 1.03, m = at((t0 + t1) / 2, 0, (y0 + y1) / 2);
        _Q.setFromEuler(eu.set(0, Math.PI / 4, a, 'YXZ')); _M.compose(m, _Q, _S.set(len, .022, .1)); dk.setMatrixAt(i, _M);
        [-1, 1].forEach((sd, q) => { const g = at((t0 + t1) / 2, sd * .052, (y0 + y1) / 2 - .012); _M.compose(g, _Q, _S.set(len, .034, .008)); gd.setMatrixAt(i * 2 + q, _M); }); }
      c.group.add(dk, gd);
      const stoneM = new T.MeshStandardMaterial({ color: col('#7a7266'), roughness: .65 }), tw = [];
      [-TW, TW].forEach(t => { tw.push([at(t, 0, .02), [.1, .2, .2]]);
        [-1, 1].forEach(sd => { [[.042, .1, .6], [.035, .6, 1.08], [.028, 1.08, TT]].forEach(([w, y0, y1]) => tw.push([at(t, sd * .055, (y0 + y1) / 2), [w, y1 - y0, w]])); });
        [[.46, .03], [1.06, .035], [TT - .02, .05]].forEach(([y, h]) => tw.push([at(t, 0, y), [.03, h, .14]]));
        tw.push([at(t, 0, TT + .035), [.026, .05, .09]]); tw.push([at(t, 0, TT + .07), [.016, .03, .05]]); });
      const twm = inst(new T.BoxGeometry(1, 1, 1), stoneM, tw.length); tw.forEach(([p, s], i) => { _Q.setFromAxisAngle(UP, Math.PI / 4); _M.compose(p, _Q, _S.set(s[0], s[1], s[2])); twm.setMatrixAt(i, _M); }); c.group.add(twm);
      const cableY = t => { const a = Math.abs(t); if (a <= TW) return DY + .06 + (TT - .02 - DY - .06) * (a / TW) ** 2; const k = (a - TW) / (LH * .88 - TW); return lerp(TT - .02, deckY(LH * .88) + .02, k) - Math.sin(Math.PI * clamp(k, 0, 1)) * .06; };
      const cm = new T.MeshStandardMaterial({ color: col('#8a8070'), roughness: .5, metalness: .5 }), hang = [];
      [-1, 1].forEach(sd => { const pts = []; for (let i = 0; i <= 80; i++) { const t = -LH * .88 + i / 80 * LH * 1.76; pts.push(at(t, sd * .055, cableY(t))); }
        const tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 160, .0055, 4, false), cm); tube.castShadow = true; c.group.add(tube);
        for (let t = -LH * .86; t <= LH * .86; t += .045) { if (Math.abs(Math.abs(t) - TW) < .03) continue; const top = at(t, sd * .055, cableY(t)), bot = at(t, sd * .055, deckY(t)); if (top.y - bot.y > .02) hang.push(top.x, top.y, top.z, bot.x, bot.y, bot.z); }
        for (let t = -LH * .88; t <= LH * .88; t += .055) { const p = at(t, sd * .055, cableY(t)); glow(p.x, p.y + .006, p.z, WHITE, .04); }
        for (let t = -LH; t <= LH; t += .07) { const p = at(t, sd * .056, deckY(t) + .02); glow(p.x, p.y, p.z, WARM, .035); if (c.hAt(p.x, p.z) < c.water - .02) for (let r = 1; r <= 3; r++) glow(p.x + r * .05, c.water + .006, p.z + r * .05, [1, .66, .3, .22 / r], .05); } });
      const hgm = new T.BufferGeometry(); hgm.setAttribute('position', new T.Float32BufferAttribute(hang, 3)); c.group.add(new T.LineSegments(hgm, new T.LineBasicMaterial({ color: col('#8a8070'), transparent: true, opacity: .7 })));
      [-TW, TW].forEach(t => { const p = at(t, 0, TT + .1); c.beacons.push({ x: p.x, y: p.y, z: p.z, ph: R() }); c.beamSrc.push([p.x, TT + .06, p.z]); });
      c.tall = [[at(-TW, 0, TT).x, TT + .1, at(-TW, 0, TT).z], [at(TW, 0, TT).x, TT + .1, at(TW, 0, TT).z]]; }
    // ---- the marina: three finger piers off the back quay, yachts moored both sides
    { const wood = new T.MeshStandardMaterial({ color: col('#6a5a48'), roughness: .85 }), piers = [], boats = [];
      [.58, .7, .82].forEach(u => { const x = u * 3.2, z0 = -1.24, z1 = .12; piers.push([x, (z0 + z1) / 2, .04, z1 - z0]);
        for (let z = z0 + .04; z <= z1; z += .12) glow(x, .15, z, WARM, .03);
        [-1, 1].forEach(sd => { for (let z = z0 + .1; z < z1 - .02; z += rnd(.085, .11)) if (R() < .88) boats.push({ x: x + sd * rnd(.05, .06), z, L: rnd(.11, .19), yaw: R() < .5 ? -Math.PI / 2 : Math.PI / 2, mast: R() < .4, ph: rnd(TAU), c: pick(['#eeeae0', '#eeeae0', '#e4ddcc', '#3a4a5a', '#6a3a30']) }); }); });
      piers.push([.685 * 3.2, -1.24, .43 * 3.2 - .04, .05]);
      const pm = inst(new T.BoxGeometry(1, 1, 1), wood, piers.length); piers.forEach(([x, z, w, l], i) => { _Q.identity(); _P.set(x, c.water + .025, z); _S.set(w, .012, l); _M.compose(_P, _Q, _S); pm.setMatrixAt(i, _M); }); c.group.add(pm);
      const sh = new T.Shape(); sh.moveTo(-.5, -.15); sh.lineTo(.22, -.15); sh.quadraticCurveTo(.46, -.1, .5, 0); sh.quadraticCurveTo(.46, .1, .22, .15); sh.lineTo(-.5, .15); sh.lineTo(-.5, -.15);
      const hull = new T.ExtrudeGeometry(sh, { depth: .12, bevelEnabled: false }); hull.rotateX(-Math.PI / 2); const cab = new T.BoxGeometry(.36, .07, .2); cab.translate(-.08, .155, 0); const fly = new T.BoxGeometry(.2, .04, .16); fly.translate(-.12, .21, 0);
      const bgeo = paint(mergeGeo([hull, cab, fly]), (x, y) => y < .025 ? '#2a3440' : y > .125 && y < .175 && x > -.24 ? '#3a4650' : '#ffffff');
      const bmesh = inst(bgeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: .45 }), boats.length), mg = new T.CylinderGeometry(.003, .003, 1, 4); mg.translate(0, .5, 0);
      const masts = boats.filter(o => o.mast), mm = inst(mg, new T.MeshStandardMaterial({ color: col('#c8c4ba'), roughness: .4, metalness: .5 }), masts.length);
      boats.forEach((o, i) => bmesh.setColorAt(i, tc.copy(col(o.c)))); c.group.add(bmesh, mm); masts.forEach(o => glow(o.x, c.water + o.L * 2.3, o.z, [1, .3, .25, .8], .022)); boats.forEach(o => { if (R() < .7) glow(o.x, c.water + o.L * .17, o.z, [1, .78, .45, .55], .035); });
      c.marina = { boats, masts, bmesh, mm }; }
    // ---- the colossus: an art-deco bronze figure on a stepped pedestal, both arms raised, holding a ring of light
    { const [u, v] = NBW[1], g = new T.Group(), bronze = new T.MeshStandardMaterial({ color: col('#7a5a3a'), roughness: .42, metalness: .65 }), stone = new T.MeshStandardMaterial({ color: col('#8a8274'), roughness: .75 });
      const add = (geo, m, x, y, z, rz = 0, rx = 0) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
      add(new T.BoxGeometry(.22, .08, .22), stone, 0, .04, 0); add(new T.BoxGeometry(.17, .03, .17), gold, 0, .095, 0); add(new T.BoxGeometry(.15, .17, .15), stone, 0, .195, 0); add(new T.BoxGeometry(.16, .014, .16), gold, 0, .285, 0); add(new T.BoxGeometry(.12, .05, .12), stone, 0, .315, 0);
      const robe = new T.CylinderGeometry(.052, .088, .6, 18, 1), rp = robe.attributes.position; for (let i = 0; i < rp.count; i++) { const a = Math.atan2(rp.getZ(i), rp.getX(i)), k = 1 - .08 * Math.max(0, Math.cos(a * 9)); rp.setX(i, rp.getX(i) * k); rp.setZ(i, rp.getZ(i) * k); } robe.computeVertexNormals();
      add(robe, bronze, 0, .64, 0); add(new T.CylinderGeometry(.07, .054, .1, 14), bronze, 0, .99, 0); add(new T.CylinderGeometry(.018, .022, .04, 8), bronze, 0, 1.06, 0);
      add(new T.SphereGeometry(.036, 14, 10), bronze, 0, 1.1, 0); add(new T.CylinderGeometry(.028, .038, .03, 10), bronze, 0, 1.135, 0); add(new T.CylinderGeometry(.016, .026, .03, 10), bronze, 0, 1.162, 0);
      [-1, 1].forEach(sd => { const arm = new T.CylinderGeometry(.013, .017, .36, 8); add(arm, bronze, sd * .085, 1.17, 0, -sd * .32); add(new T.SphereGeometry(.02, 8, 6), bronze, sd * .03, 1.005, 0); });
      add(new T.BoxGeometry(.12, .012, .05), gold, 0, .94, .038); add(new T.BoxGeometry(.09, .01, .052), gold, 0, .5, .062);
      c.ringM = new T.MeshBasicMaterial({ color: new T.Color(2.4, 1.7, .9) }); const ring = add(new T.TorusGeometry(.12, .009, 8, 48), c.ringM, 0, 1.38, 0); ring.castShadow = false;
      const x = u * 3.2, z = v * 3.2, y = .25, SC = 1.6; g.position.set(x, y, z); g.rotation.y = Math.PI / 4; g.scale.setScalar(SC); c.group.add(g); c.statue = g;
      glow(x, y + 1.38 * SC, z, [1, .8, .5, .9], .5); glow(x, y + .06, z, [1, .75, .45, .6], .4); for (let r = 1; r <= 7; r++) glow(x + .1 + r * .07, c.water + .006, z + .1 + r * .07, [1, .75, .4, .3 * (1 - r / 8)], .08 - r * .005); c.tall.push([x, y + 1.55 * SC, z]); }
    bl.forEach(o => { if (o.top) c.tall.push([o.x, o.top, o.z]); else if (o.h > 1.2) c.tall.push([o.x, o.topY, o.z]); });
    // ---- traffic on the grid and over the bridge
    c.cars = Array.from({ length: 46 }, () => { const ax = R() < .5, line = (Math.floor(rnd(0, 11)) + .08) / 5.5 - 1; return { ax, line: line * 3.2, p: rnd(-3.2, 3.2), v: rnd(1.4, 2.6) * (R() < .5 ? 1 : -1), c: R() < .5 ? [1, .25, .2, 1] : [1, .95, .85, 1] }; });
    for (let i = 0; i < 8; i++) c.cars.push({ br: true, p: rnd(-c.br.LH, c.br.LH), v: rnd(.5, .8) * (i % 2 ? 1 : -1) });
    const cg = new T.BoxGeometry(.1, .03, .05); cg.translate(0, .03, 0); const kg = new T.BoxGeometry(.05, .025, .044); kg.translate(-.005, .057, 0);
    c.carB = inst(cg, new T.MeshStandardMaterial({ roughness: .25, metalness: .6 }), c.cars.length); c.carK = inst(kg, new T.MeshStandardMaterial({ color: col('#1a1c22'), roughness: .1, metalness: .3 }), c.cars.length);
    c.cars.forEach((o, i) => c.carB.setColorAt(i, tc.copy(col(pick(['#c8ccd2', '#2a2d33', '#8a3a2a', '#e8e4dc', '#3a4a6a', '#b08a3a']))))); c.group.add(c.carB, c.carK);
    for (let a = 0; a < 11; a++) for (let b = 0; b < 11; b++) { if (R() < .5) continue; const x = ((a + .08) / 5.5 - 1) * 3.2 + .06, z = ((b + .58) / 5.5 - 1) * 3.2; if (c.hAt(x, z) < .192 || !nCity(x, z)) continue; glow(x, .3, z, R() < .65 ? [1, .62, .25, .85] : [.8, .9, 1, .8], .06); }
    // searchlights for the EVENT: soft additive beams long enough to reach into the sky
    { const LEN = 12, bgeo = new T.ConeGeometry(.55, LEN, 28, 1, true); bgeo.translate(0, -LEN / 2, 0); bgeo.rotateX(Math.PI);
      c.beams = c.beamSrc.map(([x, y, z], i) => { const u = { uA: { value: 0 }, uCol: { value: col(i % 3 ? '#fff0d8' : '#dce8ff').clone() } };
        const m = new T.Mesh(bgeo, new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
          vertexShader: 'varying float vY; varying vec3 vN, vV; void main(){ vY = uv.y; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
          fragmentShader: 'uniform float uA; uniform vec3 uCol; varying float vY; varying vec3 vN, vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float a = uA * pow(vY, 1.8) * f; gl_FragColor = vec4(uCol * a, a); }' }));
        m.position.set(x, y, z); m.frustumCulled = false; m.renderOrder = 5; m.visible = false; c.group.add(m); return { m, u, az: i / c.beamSrc.length * TAU + rnd(-.2, .2) }; }); }
    c.beaconM = inst(new T.SphereGeometry(.013, 8, 6), new T.MeshBasicMaterial(), c.beacons.length, false); c.beacons.forEach((o, i) => { _Q.identity(); _M.compose(_P.set(o.x, o.y, o.z), _Q, _S.set(1, 1, 1)); c.beaconM.setMatrixAt(i, _M); c.beaconM.setColorAt(i, tc.setRGB(0, 0, 0)); }); c.group.add(c.beaconM);
    c.na = 0; c.ai = 0;
  },
  update(c, t, dt) {
    const tc = new T.Color(), fade = .08 + .92 * (c.glowGain ?? 1), s = c.userEvent ? t - B0 : -1, show = s >= 0 && s < 17;
    const RAD = !show ? 99 : s < .8 ? -1 : (s - .8) * 2.3, lit = d => RAD >= 99 ? 1 : d > RAD ? 0 : d > RAD - .3 ? (R() < .5 ? 1 : .1) : 1;
    const beat = show && s > 3.4 && s < 15.5 ? Math.exp(-((s - 3.4) * 2.17 % 1) * 5) : 0;
    c.winU.value = fade; c.casU.value = RAD; if (RAD < 99) c.G.mat.uniforms.uFade.value *= clamp(RAD / 5.5, 0, 1); c.pyrM.emissiveIntensity = .9 * fade * (RAD < 99 ? clamp((RAD - 2) / 2, 0, 1) : 1) * (1 + beat * .6);
    if (show && once(c, 'down')) { tone(240, .9, { to: 38, vol: .12, type: 'sawtooth', filter: 'lowpass', ff: 700 }); noise(.5, { ff: 300, to: 60, vol: .1 }); }
    if (s > 3.4 && once(c, 'beams')) { sfx.shimmer(); pad(110, 'minor'); c.kb = 3.4; }
    if (beat && s >= c.kb) { c.kb += 1 / 2.17; sfx.kick(); if (Math.floor((s - 3.4) * 2.17) % 4 === 0) noise(.3, { filter: 'highpass', ff: 5000, vol: .03 }); }
    c.lit.forEach((l, i) => { const b = lit(l.dist) * fade * 2.6 * (1 + beat * .5); c.cap.setColorAt(i, tc.copy(l.base).multiplyScalar(b)); c.strip.setColorAt(i, tc.multiplyScalar(.55 + .45 * Math.sin(clock * (show ? 6 : 2.4) - i * .9))); }); c.cap.instanceColor.needsUpdate = c.strip.instanceColor.needsUpdate = true;
    c.lamps.forEach((l, i) => { const k = .5 + .5 * Math.sin(clock * 1.3 + i * 1.7); c.lampM.setColorAt(i, tc.setRGB(2.2, lerp(1.4, 1.9, k), lerp(.6, 1.5, k)).multiplyScalar(lit(l.dist) * fade * (.8 + .2 * Math.sin(clock * 7 + i)) * (1 + beat))); }); if (c.lamps.length) c.lampM.instanceColor.needsUpdate = true;
    c.beacons.forEach((o, i) => { const ph = (clock * .75 + o.ph) % 1; c.beaconM.setColorAt(i, tc.setRGB(3, .35, .2).multiplyScalar(ph < .1 ? 1 : .07 + .05 * fade)); }); if (c.beacons.length) c.beaconM.instanceColor.needsUpdate = true;
    c.signs.forEach((o, i) => { let b = lit(o.dist), k = beat > .5 ? 1 : 0; if (o.mode === 0) b *= Math.sin(clock * 23 + o.ph * 50) > -.85 || ((clock + o.ph * 9) % 7) > .4 ? 1 : .15; else if (o.mode === 1) k = (Math.floor(clock * .8 + o.ph * 4) % 2); else b *= .6 + .4 * Math.sin(clock * 3 + o.ph * 9);
      c.signM.setColorAt(i, tc.copy(o.c).lerp(o.c2, k).multiplyScalar(b * fade * 2.4)); }); if (c.signs.length) c.signM.instanceColor.needsUpdate = true;
    c.goldM.emissiveIntensity = .35 * fade; if (c.neonM) c.neonM.color.setRGB(2.4, .5, .3).multiplyScalar(fade * (Math.sin(t * 9) > -.9 ? 1 : .3)); c.ringM.color.setRGB(2.4, 1.7, .9).multiplyScalar((.35 + .65 * fade) * (1 + beat * 1.2));
    const M = c.marina, E = c._eu || (c._eu = new T.Euler()); M.boats.forEach((o, i) => { _Q.setFromEuler(E.set(Math.sin(clock * 1.1 + o.ph) * .05, o.yaw, 0, 'YXZ')); _M.compose(_P.set(o.x, c.water - .012 + Math.sin(clock * 1.4 + o.ph) * .004, o.z), _Q, _S.setScalar(o.L)); M.bmesh.setMatrixAt(i, _M); });
    M.masts.forEach((o, i) => { _Q.setFromEuler(E.set(Math.sin(clock * 1.1 + o.ph) * .05, 0, 0, 'XYZ')); _M.compose(_P.set(o.x, c.water + .03, o.z), _Q, _S.set(1, o.L * 2.2, 1)); M.mm.setMatrixAt(i, _M); }); M.bmesh.instanceMatrix.needsUpdate = M.mm.instanceMatrix.needsUpdate = true;
    const sp = [0, .3, .55, .85][MOD.life], nAct = Math.floor(c.cars.length * [0, .3, .65, 1][MOD.life]), B = c.br;
    c.cars.forEach((o, i) => { if (i >= nAct && !o.br || MOD.life === 0) { c.carB.setMatrixAt(i, ZERO); c.carK.setMatrixAt(i, ZERO); return; }
      let x, z, y = .2, yaw, fx, fz;
      if (o.br) { o.p += o.v * dt * Math.max(sp, .3); if (o.p > B.LH) o.p = -B.LH; if (o.p < -B.LH) o.p = B.LH; const lane = o.v > 0 ? -.024 : .024, q = B.at(o.p, lane, B.deckY(o.p) + .011); x = q.x; z = q.z; y = q.y; const d = Math.sign(o.v); yaw = Math.PI / 4 + (d > 0 ? 0 : Math.PI); fx = .039 * d; fz = -.039 * d; }
      else { o.p += o.v * dt * sp; if (o.p > 3.15) o.p = -3.15; if (o.p < -3.15) o.p = 3.15; const lane = o.v > 0 ? .022 : -.022, dir = Math.sign(o.v); x = o.ax ? o.p : o.line + lane; z = o.ax ? o.line + lane : o.p; yaw = o.ax ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2); fx = (o.ax ? dir : 0) * .055; fz = (o.ax ? 0 : dir) * .055;
        if (c.hAt(x, z) < .19 || !nCity(x, z)) { c.carB.setMatrixAt(i, ZERO); c.carK.setMatrixAt(i, ZERO); return; } }
      _Q.setFromAxisAngle(UP, yaw); _P.set(x, y, z); _S.set(1, 1, 1); _M.compose(_P, _Q, _S); c.carB.setMatrixAt(i, _M); c.carK.setMatrixAt(i, _M);
      const la = .3 + .7 * fade; c.P.emit(x + fx, y + .035, z + fz, fx * 3, 0, fz * 3, .12, [1, .97, .88, la], [1, .95, .85, 0], .07, .1); c.P.emit(x - fx, y + .035, z - fz, 0, 0, 0, .25, [1, .15, .1, la * .9], [1, .1, .1, 0], .045, .03); });
    c.carB.instanceMatrix.needsUpdate = c.carK.instanceMatrix.needsUpdate = true;
    // the beams: rise one by one, fan out, circle together, then criss-cross, and sink away
    c.beams.forEach((b, i) => { const N = c.beams.length, on = smooth01((s - 3.4 - i * .15) / .6) * (1 - smooth01((s - 14.6) / 1.4)), m = b.m; m.visible = on > .002 && show;
      if (!m.visible) { m.rotation.set(0, 0, 0); return; } b.u.uA.value = (.38 + beat * .16) * on * (.35 + .65 * fade) * (c.fadeA ?? 1);
      let tilt, az; if (s < 7) { tilt = .5 * smooth01((s - 4) / 2.5); az = b.az; } else if (s < 10.5) { tilt = .42; az = b.az + (s - 7) * 1.7; } else { tilt = .52 * Math.sin((s - 10.5) * 2.1 + (i % 2) * Math.PI); az = Math.PI / 4 + (i % 2 ? .25 : -.25); }
      const k = 1 - Math.exp(-dt * 6); m.rotation.x = lerp(m.rotation.x, Math.cos(az) * tilt, k); m.rotation.z = lerp(m.rotation.z, Math.sin(az) * tilt, k); });
    if (t > B0 && t < B1) { c.na -= dt; if (c.na <= 0) { c.na = .115; const sc = [0, 3, 7, 10, 12, 15, 19, 22]; tone(110 * Math.pow(2, (sc[c.ai % 8] + 12) / 12), .18, { type: 'sawtooth', vol: .03, filter: 'lowpass', ff: 1200 + 800 * Math.sin(t * 3) }); if (c.ai % 4 === 0) sfx.kick(); c.ai++; } }
    if (t > B0 && once(c, 'fl')) flash('#ffc080ff', .3);
  } });

story({ id: 'giza', mood: ['minor', 146.83],
  caption: () => ({ era: '2560 BC · the casing stones still shine', name: pick(['Giza, Brand New', 'The Plateau at Dawn']), line: pick(['The storm passes. Three perfect mountains, freshly polished, catch the dawn.', 'Forty years of work, one very windy morning.']) }),
  water: .1, waves: true, waterCol: '#2a6a7a', waterTop: '#3a8a9a', waterDeep: '#0c2a34', strata: ['#c9a870', '#b8955e', '#d8b880', '#a8844e', '#e0c48c'], soil: '#a8844e',
  pal: { sky: '#ffcf9a', ground: '#6a4a2a', hemiI: .5, sun: '#ff9a5a', sunI: .45, dir: [-6, 5, -3], dim: .6, tint: '#8a5a30' },
  calm: { sky: '#ffe6c4', ground: '#8a6a40', hemiI: .75, sun: '#ffcf98', sunI: 1.05, dir: [7, 6, -2], dim: .95 },
  height(u, v, n) { if (u > .62) return lerp(.28, .02, Math.min(1, (u - .62) / .38 * 1.6)) + n.fbm(u * 4, v * 4) * .03; const pd = Math.hypot(u + .15, v + .05), dunes = .3 + .11 * Math.sin(u * 8 + v * 3 + n.fbm(u * 2, v * 2) * 4) + n.fbm(u * 2.5, v * 2.5) * .1; return pd < .55 ? lerp(.3, dunes, Math.pow(pd / .55, 6)) : dunes; },
  color(h, s, u, v, n) { if (u > .62 && h < .14) return '#7a7a50'; if (u > .66 && h < .22) return '#4a7a32'; return n.vn(u * 14, v * 14) > .3 ? '#d4ae70' : '#e0bc7e'; },
  build(c) {
    [[-1.1, -.75, .62, .82], [-.25, -.05, .56, .76], [.45, .6, .3, .4]].forEach(([x, z, r, h]) => { const g = new T.ConeGeometry(r, h, 4); g.rotateY(Math.PI / 4); const m = new T.Mesh(g, new T.MeshStandardMaterial({ color: col('#ece0c4'), roughness: .5, flatShading: true })); m.position.set(x, c.hAt(x, z) + h / 2 - .02, z); m.castShadow = m.receiveShadow = true; c.group.add(m); });
    addTrees(c, scatter(c, 45, (h, s, x) => x > 2.1 && h < .3), { kind: 'palm', colors: ['#3a5a2a', '#4a6a30'] });
  },
  update(c, t, dt) {
    const Sm = c.Sm;
    if (t > B0 && once(c, 'w')) { sfx.wind(3.8); noise(3.5, { ff: 160, vol: .2, attack: .5 }); }
    if (t > B0 && t < B1) { const k = (t - B0) / (B1 - B0), fx = lerp(-4.5, 4.5, k); c.shake = Math.max(c.shake, .025);
      for (let i = 0; i < nOf(900, dt); i++) Sm.emit(fx + rnd(-.6, .2), rnd(.2, 1.4), rnd(-3.4, 3.4), rnd(2.4, 3.2), rnd(-.2, .3), rnd(-.3, .3), rnd(1.2, 2), [.85, .66, .4, .7], [.9, .75, .5, 0], .2, .45, 0, .2);
      for (let i = 0; i < nOf(500, dt); i++) Sm.emit(fx + rnd(-1, .2), rnd(.25, .8), rnd(-3.2, 3.2), rnd(3, 4), rnd(-.1, .2), 0, rnd(.6, 1), [.75, .55, .3, .9], [.75, .55, .3, 0], .025, .025); }
    if (t > B1) { const notes = [293.66, 311.13, 369.99, 392, 440, 466.16, 523.25]; [[.3, 0], [.7, 2], [1.1, 4], [1.6, 3], [2.4, 1], [3.1, 0]].forEach(([w, n], i) => { if (t > B1 + w && once(c, 'p' + i)) sfx.pluck(notes[n]); }); }
  } });

/* ================= controls ================= */
const KEYDEF = [
  { id: 'time', label: 'TIME', key: 'T', levels: ['Dawn', 'Noon', 'Dusk', 'Night'] },
  { id: 'clouds', label: 'CLOUDS', key: 'C', levels: ['Clear', 'Fair', 'Overcast', 'Storm'] },
  { id: 'rain', label: 'RAIN', key: 'R', levels: ['Dry', 'Drizzle', 'Rain', 'Downpour'] },
  { id: 'wind', label: 'WIND', key: 'W', levels: ['Calm', 'Breeze', 'Windy', 'Gale'] },
  { id: 'world', label: 'WORLD', key: '␣' },
  { id: 'glow', label: 'GLOW', key: 'G', levels: ['Off', 'Dim', 'Warm', 'Bright'] },
  { id: 'event', label: 'EVENT', key: 'E' },
  { id: 'life', label: 'LIFE', key: 'L', levels: ['Empty', 'Few', 'Busy', 'Teeming'] },
  { id: 'spin', label: 'SPIN', key: 'S' }
];
const MOD = { time: 1, clouds: 1, rain: 0, wind: 1, glow: 1, life: 1 };
const NIGHT = [.45, 0, .6, 1];
const TIMES = [
  { sky: '#f7c6a8', ground: '#5a4a50', hemiI: .6, sun: '#ffb88a', sunI: .78, dim: .84, tint: '#6a4a50' },
  { sky: '#e2eefa', ground: '#7a7260', hemiI: .7, sun: '#fff4e2', sunI: .98, dim: 1 },
  { sky: '#ffb48a', ground: '#4a3440', hemiI: .55, sun: '#ff8a50', sunI: .72, dim: .66, tint: '#6a3a40' },
  { sky: '#4a5a8a', ground: '#141824', hemiI: .38, sun: '#a8b8ff', sunI: .32, dim: .3, tint: '#2a2a4a' }
];
const mixHex = (a, b, k) => '#' + new T.Color(a).lerp(new T.Color(b), k).getHexString();
function computePal() {
  const base = TIMES[MOD.time], st = world && world.st, cl = MOD.clouds, k = .25;
  const p = { ...base, dir: [0, 1, 0] };
  if (st && st.calm) { p.sky = mixHex(base.sky, st.calm.sky, k); p.ground = mixHex(base.ground, st.calm.ground, k); p.sun = mixHex(base.sun, st.calm.sun, k); }
  p.sunI *= [1, .85, .5, .3][cl]; p.hemiI *= [1, 1, .92, .8][cl]; p.sky = mixHex(p.sky, '#9aa0a8', [0, .1, .45, .65][cl]);
  p.dim = (p.dim ?? 1) * [1, .97, .86, .72][cl] * [1, .97, .9, .82][MOD.rain];
  return p;
}
const decals = [];
function drawIcon(x, id, lv, ink, ghost) {
  x.save(); x.translate(128, 112); x.scale(1.45, 1.45); x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = 9; x.lineCap = 'round'; x.lineJoin = 'round';
  const line = (a, b, c2, d) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); };
  const rays = (r0, r1, n, a0, a1) => { for (let k = 0; k < n; k++) { const a = a0 + (a1 - a0) * (k + .5) / n; line(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1); } };
  const cloud = (cx, cy, sc, fill) => { x.beginPath(); x.moveTo(cx - 36 * sc, cy + 20 * sc); x.arc(cx - 22 * sc, cy + 4 * sc, 16 * sc, Math.PI * .5, Math.PI * 1.45); x.arc(cx + 2 * sc, cy - 10 * sc, 23 * sc, Math.PI * 1.05, Math.PI * 1.95); x.arc(cx + 25 * sc, cy + 6 * sc, 14 * sc, -Math.PI * .55, Math.PI * .5); x.closePath(); fill ? x.fill() : x.stroke(); };
  const cut = fn => { x.save(); x.globalCompositeOperation = 'destination-out'; fn(); x.restore(); };
  if (id === 'time') {
    if (lv === 1) { x.beginPath(); x.arc(0, 0, 21, 0, TAU); x.fill(); rays(33, 47, 8, 0, TAU); }
    else if (lv === 3) { x.beginPath(); x.arc(-4, 2, 32, 0, TAU); x.fill(); cut(() => { x.beginPath(); x.arc(14, -10, 28, 0, TAU); x.fill(); }); x.beginPath(); x.arc(30, 26, 5, 0, TAU); x.fill(); }
    else { const y0 = lv === 0 ? 14 : 22; x.beginPath(); x.arc(0, y0, 23, Math.PI, TAU); x.fill(); line(-52, y0 + 4, 52, y0 + 4); if (lv === 0) rays(34, 48, 5, Math.PI, TAU); else { line(-36, y0 + 20, 36, y0 + 20); line(-18, y0 + 34, 18, y0 + 34); } }
  } else if (id === 'clouds') {
    if (lv === 0) { x.beginPath(); x.arc(0, 0, 18, 0, TAU); x.stroke(); rays(30, 42, 8, 0, TAU); }
    else { cloud(0, 4, 1.15, lv >= 2); if (lv === 3) cut(() => { x.beginPath(); x.moveTo(6, -14); x.lineTo(-10, 12); x.lineTo(4, 12); x.lineTo(-6, 34); x.lineTo(16, 4); x.lineTo(2, 4); x.lineTo(12, -14); x.closePath(); x.fill(); }); }
  } else if (id === 'rain') {
    cloud(0, -16, .9, false); const n = [0, 2, 3, 5][lv];
    for (let k = 0; k < n; k++) { const dx = (k - (n - 1) / 2) * 20, dy = 30 + (k % 2) * 12; x.beginPath(); x.moveTo(dx, dy - 12); x.quadraticCurveTo(dx + 8, dy + 2, dx, dy + 6); x.quadraticCurveTo(dx - 8, dy + 2, dx, dy - 12); x.fill(); }
  } else if (id === 'wind') {
    const n = lv + 1; for (let k = 0; k < n; k++) { const y = (k - (n - 1) / 2) * 22, L = 34 + (k % 2 ? 6 : 18) + lv * 2; x.beginPath(); x.moveTo(-L, y); x.lineTo(L - 12, y); x.arc(L - 12, y - 10, 10, Math.PI * .5, -Math.PI * .6, true); x.stroke(); }
  } else if (id === 'world') {
    x.beginPath(); x.moveTo(0, -46); x.lineTo(42, -23); x.lineTo(42, 23); x.lineTo(0, 46); x.lineTo(-42, 23); x.lineTo(-42, -23); x.closePath(); x.stroke();
    x.globalAlpha = .35; x.beginPath(); x.moveTo(0, -46); x.lineTo(42, -23); x.lineTo(0, 0); x.lineTo(-42, -23); x.closePath(); x.fill(); x.globalAlpha = 1;
    line(0, 0, 0, 46); line(0, 0, 42, -23); line(0, 0, -42, -23); x.lineWidth = 6; line(-20, -18, -6, -30); line(-6, -30, 10, -14);
  } else if (id === 'glow') {
    x.beginPath(); x.arc(0, -8, 22, Math.PI * .8, Math.PI * 2.2); x.lineTo(10, 18); x.lineTo(-10, 18); x.closePath(); lv > 0 ? x.fill() : x.stroke(); line(-11, 28, 11, 28); line(-7, 37, 7, 37);
    rays(34, 46, [0, 3, 5, 7][lv], Math.PI * 1.05, Math.PI * 1.95);
  } else if (id === 'event') {
    x.beginPath(); for (let k = 0; k < 16; k++) { const r = k % 2 ? 19 : (k % 4 ? 38 : 48), a = k / 16 * TAU - Math.PI / 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill();
  } else if (id === 'life') {
    x.beginPath(); x.ellipse(0, 16, 22, 18, 0, 0, TAU); x.fill(); [[-30, -10], [-11, -28], [11, -28], [30, -10]].forEach(([px, py]) => { x.beginPath(); x.ellipse(px, py, 9, 11, px * .012, 0, TAU); x.fill(); });
  } else if (id === 'spin') {
    x.beginPath(); x.arc(0, 0, 34, -Math.PI * .35, Math.PI * 1.35); x.stroke(); const a = Math.PI * 1.35, ex = Math.cos(a) * 34, ey = Math.sin(a) * 34; x.beginPath(); x.moveTo(ex - 14, ey - 4); x.lineTo(ex + 6, ey - 10); x.lineTo(ex + 2, ey + 12); x.closePath(); x.fill();
  }
  x.restore();
}
function drawDecal(i) {
  const d = KEYDEF[i], cv = decals[i].canvas, x = cv.getContext('2d'), kind = ({ 2: 'brown', 4: 'amber', 6: 'rust', 8: 'teal' })[i] || 'putty';
  const light = kind === 'rust' || kind === 'brown' || kind === 'teal' || (kind === 'putty' && isDark());
  const ink = light ? 'rgba(255,246,234,.95)' : 'rgba(40,32,24,.9)', ghost = light ? 'rgba(255,246,234,.28)' : 'rgba(40,32,24,.22)';
  x.clearRect(0, 0, 256, 256);
  x.save(); x.translate(0, 2); x.globalAlpha = .5; drawIcon(x, d.id, MOD[d.id] ?? 0, light ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.6)', ghost); x.restore();
  drawIcon(x, d.id, MOD[d.id] ?? 0, ink, ghost);
  if (d.levels) { const lv = MOD[d.id]; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(92 + k * 24, 222, 8, 0, TAU); x.fillStyle = (d.id === 'time' ? k === lv : k <= lv && lv > 0) ? ink : ghost; x.fill(); } }
  decals[i].tex.needsUpdate = true;
}
const decalGeo = new T.PlaneGeometry(1.3, 1.3); decalGeo.rotateX(-Math.PI / 2);
for (let i = 0; i < NK; i++) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
  const m = new T.Mesh(decalGeo, new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, envMapIntensity: .3 }));
  m.position.y = .545; m.rotation.y = Math.PI / 4; m.receiveShadow = true; keys[i].add(m); decals.push({ canvas: cv, tex });
}
const redrawDecals = () => { for (let i = 0; i < NK; i++) drawDecal(i); };
redrawDecals(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawDecals);
const readout = $('#readout');
function say(txt) { readout.textContent = txt; readout.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 250 }); }
let ambT = 0;
function ambient(c, dt) {
  const Wv = [.03, .08, .17, .32][MOD.wind], lvl = MOD.clouds, lf = 1, shade = [[.78, 1], [.78, 1], [.46, .84], [.22, .56]][lvl].map(v => v * lf);
  if (c.lf !== undefined && c.lf !== lf) c.cl = -1; c.lf = lf;
  c.Sm.mat.uniforms.uTint.value.setRGB(1, 1, 1).lerp(pal.sky, .5).multiplyScalar((.12 + .88 * Math.pow(pal.dimv ?? 1, 1.4)) * (1 + fxBoost * .35));
  const gale = MOD.wind === 3, cshade = [[.72, 1.05], [.72, 1.05], [.5, .86], [.28, .6]][lvl];
  if (c.cl !== lvl) { if (!gale && (lvl > Math.max(0, c.cl ?? 0) || c.cl === -1)) for (let k = 0; k < Math.round([0, 3, 6, 9][lvl] * (c.st.cloudN ?? 1)); k++) cumulus(c.Sm, rnd(-2.9, 2.9), (c.st.cloudY ?? 2) + rnd(-.1, .2), rnd(-2.9, 2.9), rnd(.45, .75), cshade, rnd(8, 12)); c.cl = lvl; }
  c.ca = (c.ca || 0) + [0, .25, .6, 1][lvl] * (gale ? .08 : 1) * (c.st.cloudN ?? 1) * dt;
  while (c.ca >= 1) { c.ca--; cumulus(c.Sm, rnd(-2.9, 2.9) - Wv * 5, (c.st.cloudY ?? 2) + rnd(-.1, .2), rnd(-2.9, 2.9), rnd(.45, .75), cshade, 11); }
  const cv = [.02, .06, .2, 1.1][MOD.wind]; c.Cn.wx = cv * .707; c.Cn.wz = -cv * .707;
  const nearN = gale ? 0 : Math.round([0, 2, 3, 4][lvl] * (c.st.cloudN ?? 1)), spawnNear = s0 => { const d = rnd(1.6, 3), y = rnd(3.1, 3.9) + (c.st.cloudY ? c.st.cloudY - 2 : 0); cumulus(c.Cn, d + .707 * s0, y, d - .707 * s0, rnd(1.1, 1.6), cshade, 34); };
  if (c.cnl !== lvl) { if (nearN && lvl > Math.max(0, c.cnl ?? 0)) for (let k = 0; k < nearN; k++) spawnNear(rnd(-4, 4)); c.cnl = lvl; }
  c.cna = (c.cna || 0) + nearN / 34 * dt; while (c.cna >= 1) { c.cna--; spawnNear(-5.5 + rnd(0, 1.5)); }
  c.Cn.mat.uniforms.uTint.value.copy(c.Sm.mat.uniforms.uTint.value);
  for (let i = 0; i < nOf([0, 300, 1000, 2200][MOD.rain], dt); i++) c.Sm.emit(rnd(-3.1, 3.1) - Wv * .5, 2.05, rnd(-3.1, 3.1), Wv * 1.4, -5.5, 0, .42, [.74, .8, .92, .5], [.74, .8, .92, .35], .022, .022);
  // breaking surf: each shore point crashes once per swell, the swell sweeping along the coast from the open sea
  if (c.shore && c.shore.length && c.st.surf !== 0) { const per = [4.6, 3.6, 2.9, 2.3][MOD.wind], amp = [.55, .85, 1.3, 1.9][MOD.wind] * (c.st.surf || 1), y0 = c.water + .006;
    for (const s of c.shore) { const k = Math.floor(clock / per - (s.x + s.z) * .07 + s.j); if (s.k === undefined) { s.k = k; continue; } if (k === s.k) continue; s.k = k;
      const nN = Math.round(rnd(3, 7) * amp * (s.cliff ? 1.8 : 1)), up = s.cliff ? 1.7 : 1;
      for (let i = 0; i < nN; i++) c.Sm.emit(s.x + s.nx * rnd(-.02, .05), y0, s.z + s.nz * rnd(-.02, .05), -s.nx * rnd(.04, .22) + rnd(-.07, .07), rnd(.25, .65) * amp * up, -s.nz * rnd(.04, .22) + rnd(-.07, .07), rnd(.5, .95), [1, 1, 1, .92], [.94, .97, 1, 0], .022, .055, -2.4, .7);
      for (let i = 0; i < 2; i++) c.Sm.emit(s.x + rnd(-.05, .05), y0, s.z + rnd(-.05, .05), s.nx * .05, .004, s.nz * .05, rnd(1.4, 2.4), [1, 1, 1, .75], [1, 1, 1, 0], .05, .17, 0, .9, 0, 1.3); } }
  // sun glints dancing on open water
  if (c.wmesh && MOD.time !== 3 && MOD.clouds < 3) { const gc = MOD.time === 1 ? [1, .97, .9, .95] : [1, .8, .6, .95];
    for (let i = 0; i < nOf((c.st.glints ?? 50) * (MOD.clouds === 2 ? .3 : 1), dt); i++) { const x = rnd(-3.1, 3.1), z = rnd(-3.1, 3.1); if (c.hAt(x, z) > c.water - .02) continue; c.P.emit(x, c.water + waveY(c, x, z) + .012, z, 0, 0, 0, rnd(.15, .45), gc, [gc[0], gc[1], gc[2], 0], .022, .006, 0, 0, 0, -1); } }
  c.Sm.mat.uniforms.uTint.value.setRGB(1, 1, 1).lerp(pal.sky, .5).multiplyScalar(.12 + .88 * Math.pow(pal.dimv ?? 1, 1.4));
  c.glowGain = MOD.glow / 3 * (.3 + .7 * NIGHT[MOD.time]); if (c.wmesh) { c.nightK = lerp(c.nightK ?? NIGHT[MOD.time], NIGHT[MOD.time], 1 - Math.exp(-dt * .8)); c.wU.uDark.value = Math.min(1, c.nightK * 1.15) * .8; c.wmesh.material.envMapIntensity = .9 - .55 * c.nightK; if (c.aq) c.aq.night(c.nightK); }
  c.G.mat.uniforms.uFade.value = c.glowGain * (c.fadeA ?? 1); NIGHT_U.value = Math.max(0, (c.nightK ?? NIGHT[MOD.time]) - .5) * .9;
  c.winMats.forEach(m => m.color.copy(col('#22252c')).lerp(col('#ffcc77'), c.glowGain));
  c.waveAmp = [.35, 1, 1.9, 3][MOD.wind]; c.waveA = lerp(c.waveA ?? WAMP[MOD.wind], WAMP[MOD.wind], 1 - Math.exp(-dt * 1.2)); c.Sm.wx = [0, .06, .2, .9][MOD.wind];
  TREE_U.uTime.value = clock; TREE_U.uWind.value = lerp(TREE_U.uWind.value, [.055, .14, .27, .48][MOD.wind], 1 - Math.exp(-dt * 2));
  CLOUD_U.uCT.value = clock; CLOUD_U.uCov.value = lerp(CLOUD_U.uCov.value, [0, .3, .55, .78][MOD.clouds] * (MOD.wind === 3 ? .15 : 1), 1 - Math.exp(-dt * .8)); CLOUD_U.uCWind.value = .08 + Wv * .9;
  for (let i = 0; i < nOf([0, 0, 3, 8][MOD.wind], dt); i++) { const x = rnd(-3.4, 1.4), y = rnd(.35, 1.9), z = rnd(-3, 3), v = Wv * 3 + .3; for (let q = 0; q < 7; q++) c.Sm.emit(x - q * .05, y + Math.sin(q * .7) * .012, z, v, 0, 0, rnd(.7, 1.1), [1, 1, 1, .26], [1, 1, 1, .26], .018, .012, 0, 0, 0, -1); }
  if (c.wmesh) for (let i = 0; i < nOf([0, 0, 22, 60][MOD.wind], dt); i++) { const x = rnd(-3.1, 3.1), z = rnd(-3.1, 3.1); if (c.hAt(x, z) > c.water - .03) continue; const wy = waveY(c, x, z); if (wy < (c.waveA ?? .03) * .25) continue; c.Sm.emit(x, c.water + wy + .008, z, Wv * .6 + rnd(-.05, .05), rnd(.02, .12), rnd(-.05, .05), rnd(.4, .9), [1, 1, 1, .9], [1, 1, 1, 0], .02, .05, -.3, .4); }
  life(c, dt);
}
let surfT = 0;
function ambientSound(dt) {
  surfT -= dt; if (surfT <= 0 && world && world.shore && world.shore.length > 8) { surfT = [4.6, 3.6, 2.9, 2.3][MOD.wind] * rnd(.85, 1.1); noise(2.4, { filter: 'lowpass', ff: 1400, to: 320, q: .4, vol: [.012, .02, .03, .045][MOD.wind], attack: .5 }); noise(1.2, { filter: 'highpass', ff: 2600, vol: .006, attack: .3, when: .25 }); }
  ambT -= dt; if (ambT > 0 || !world) return; ambT = 2.2;
  if (MOD.rain) noise(3, { filter: 'bandpass', ff: 1300, q: .5, vol: [0, .01, .022, .042][MOD.rain], attack: 1.2 });
  if (MOD.wind) noise(3, { filter: 'bandpass', ff: 240 + MOD.wind * 110, q: 1.2, vol: [0, .007, .016, .032][MOD.wind], attack: 1.4 });
}

/* ================= life: characters that roam the worlds ================= */
function mat(hex, r = .8, m = 0) { return new T.MeshStandardMaterial({ color: col(hex), roughness: r, metalness: m }); }
function mesh(g, m, parent, x = 0, y = 0, z = 0) { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; }
function ellip(rx, ry, rz) { const g = new T.SphereGeometry(1, 16, 12); g.scale(rx, ry, rz); return g; }
const tube = (pts, r) => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), 12, r, 6);
function skyPos(a, dt, sp) { a.s += sp * dt; if (a.s > 5.5) { a.s = -5.5; a.depth = rnd(a.dmin ?? .8, a.dmax ?? 2); } const d = 1.3 + a.depth; return [d + .707 * a.s, a.alt + Math.sin(clock * .4 + a.seed) * .08, d - .707 * a.s]; }
const LAND = c => (h, s) => h > (c.water ?? -9) + .04 && s < 1.1 && h < (c.st.landMax ?? 99);
function spawnPt(c, ok) { for (let k = 0; k < 300; k++) { const x = rnd(-2.7, 2.7), z = rnd(-2.7, 2.7); if (ok(c.hAt(x, z), c.slopeAt(x, z))) return [x, z]; } return [0, 0]; }
function walker(x, z, sp, ok) { return { x, z, sp, ok, dir: rnd(TAU), ph: rnd(TAU), seed: rnd(100), ts: R() < .5 ? 1 : -1 }; }
function steer(c, a, dt) {
  const th = c.threat; a.fleeing = false;
  if (th && th.on) { const dx = a.x - th.x, dz = a.z - th.z; if (Math.hypot(dx, dz) < (th.r || 3)) { a.fleeing = true; const dd = ((Math.atan2(dz, dx) - a.dir + Math.PI) % TAU + TAU) % TAU - Math.PI; a.dir += clamp(dd, -3 * dt, 3 * dt); } }
  const ax = a.x + Math.cos(a.dir) * .4, az = a.z + Math.sin(a.dir) * .4, bad = Math.abs(ax) > 2.85 || Math.abs(az) > 2.85 || !a.ok(c.hAt(ax, az), c.slopeAt(ax, az)) || (c.st.avoid ? c.st.avoid(c, ax, az) : false);
  a.dir += bad ? 1.8 * a.ts * dt : a.fleeing ? 0 : Math.sin(clock * .4 + a.seed) * .25 * dt;
  const v = a.sp * (a.fleeing ? 2.4 : 1) * (bad ? .15 : 1); a.x += Math.cos(a.dir) * v * dt; a.z += Math.sin(a.dir) * v * dt;
}
const slopePitch = (c, x, z, dir, d) => Math.atan2(c.hAt(x + Math.cos(dir) * d, z + Math.sin(dir) * d) - c.hAt(x - Math.cos(dir) * d, z - Math.sin(dir) * d), 2 * d) * .85;
function footfall(c, x, z, dir, side, fwd, lat, r, dust) { const fx = x + Math.cos(dir) * fwd - Math.sin(dir) * lat * side, fz = z + Math.sin(dir) * fwd + Math.cos(dir) * lat * side, h = c.hAt(fx, fz); c.stamp(fx, fz, r, .8);
  for (let i = 0; i < dust; i++) c.Sm.emit(fx + rnd(-r, r), h + .01, fz + rnd(-r, r), rnd(-.12, .12), rnd(.05, .2), rnd(-.12, .12), rnd(.8, 1.5), [.62, .54, .42, .55], [.7, .63, .52, 0], .03, .09, -.05, 1.5); }
function legs(parent, m, pos, len, r) { return pos.map(([x, z]) => { const p = new T.Group(); p.position.set(x, len, z); mesh(new T.CylinderGeometry(r, r * 1.15, len, 7), m, p, 0, -len / 2, 0); parent.add(p); return p; }); }
const swing = (lg, ph, amp) => lg.forEach((l, i) => { l.rotation.z = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * amp; });
function lathe(profile, seg = 20, vertical = false) { const g = new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(Math.max(.0004, r), y)), seg); if (!vertical) g.rotateZ(-Math.PI / 2); return g; }
function shadeMat(geo, top, bot, rough = .85) {
  geo.computeVertexNormals(); const n = geo.attributes.normal, cols = [], a = col(top), b = col(bot), t = new T.Color();
  for (let i = 0; i < n.count; i++) { const k = clamp(n.getY(i) * .5 + .5, 0, 1); t.copy(b).lerp(a, k * k * (3 - 2 * k)); cols.push(t.r, t.g, t.b); }
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); return new T.MeshStandardMaterial({ vertexColors: true, roughness: rough });
}
function chain(parent, m, n, len, r0, r1, x, y, z) {
  const joints = []; let p = parent;
  for (let i = 0; i < n; i++) {
    const j = new T.Group(); if (i === 0) j.position.set(x, y, z); else j.position.x = len;
    const r = lerp(r0, r1, i / (n - 1)), rn = lerp(r0, r1, Math.min(1, (i + 1) / (n - 1))), g = new T.CylinderGeometry(rn, r, len * 1.15, 9); g.rotateZ(-Math.PI / 2); g.translate(len / 2, 0, 0);
    mesh(g, m, j); mesh(new T.SphereGeometry(r, 9, 7), m, j); p.add(j); joints.push(j); p = j;
  }
  return joints;
}
function leg2(parent, m, x, z, hip, l1, l2, r) {
  const hipG = new T.Group(); hipG.position.set(x, hip, z); parent.add(hipG);
  const ug = new T.CylinderGeometry(r, r * .82, l1, 9); ug.translate(0, -l1 / 2, 0); mesh(ug, m, hipG);
  const knee = new T.Group(); knee.position.y = -l1; hipG.add(knee); mesh(new T.SphereGeometry(r * .84, 8, 6), m, knee);
  const lg = new T.CylinderGeometry(r * .82, r * .92, l2, 9); lg.translate(0, -l2 / 2, 0); mesh(lg, m, knee);
  mesh(new T.CylinderGeometry(r * 1.02, r * 1.12, r * .55, 12), m, knee, 0, -l2, 0);
  return { hipG, knee };
}
function gait(L, ph, amp) { L.forEach((l, i) => { const p = ph + (i === 0 || i === 3 ? 0 : Math.PI); l.hipG.rotation.z = Math.sin(p) * amp; l.knee.rotation.z = -Math.max(0, Math.cos(p)) * amp * 1.1; }); }
const MAKERS = {
  birds(c, n) { // gulls (or swifts) wheeling on thermals; wings flap in the vertex shader, glide now and then
    const sc = c.st.birdScale || 1, dark = c.st.birdCol === 'dark', P = [], A = [], C = [], body = col(dark ? '#2a2a30' : '#f1f0ec'), tip = col(dark ? '#1a1a1e' : '#34363a');
    const tri = (a, b, d, wa, wb, wd) => { P.push(...a, ...b, ...d); A.push(wa, wb, wd); [wa, wb, wd].forEach(w => { const q = w > .8 ? tip : body; C.push(q.r, q.g, q.b); }); };
    [-1, 1].forEach(s2 => { tri([.014, 0, 0], [-.014, 0, 0], [-.004, .002, s2 * .03], 0, 0, .45); tri([.014, 0, 0], [-.004, .002, s2 * .03], [.008, .002, s2 * .028], 0, .45, .45); tri([.008, .002, s2 * .028], [-.004, .002, s2 * .03], [-.018, -.002, s2 * .066], .45, .45, 1); });
    tri([.026, 0, 0], [-.02, .004, 0], [-.02, -.004, 0], 0, 0, 0); tri([-.016, 0, 0], [-.034, 0, .012], [-.034, 0, -.012], 0, 0, 0);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('aw', new T.Float32BufferAttribute(A, 1)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.computeVertexNormals();
    const ph = new Float32Array(n); for (let i = 0; i < n; i++) ph[i] = R(); g.setAttribute('aph', new T.InstancedBufferAttribute(ph, 1));
    const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: T.DoubleSide });
    m.onBeforeCompile = sh => { sh.uniforms.uTime = TREE_U.uTime; sh.vertexShader = 'attribute float aw; attribute float aph; uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float gl = smoothstep(-.35, .45, sin(uTime * .5 + aph * 23.0)); float fl = sin(uTime * 10.5 + aph * 6.2832); transformed.y += (fl * .75 * gl + .22 * (1.0 - gl)) * aw * .03;'); };
    const im = inst(g, m, n, false); c.lifeG.add(im);
    const zone = c.st.birdZone || { x: 0, z: 0, r: 2.2, alt: [1.2, 2.2] }, B = [];
    for (let i = 0; i < n; i++) { const grp = i % 3; B.push({ cx: zone.x + rnd(-.8, .8), cz: zone.z + rnd(-.8, .8), r: rnd(.4, 1) * zone.r, alt: rnd(zone.alt[0], zone.alt[1]), w: rnd(.25, .5) * (grp ? 1 : -1), ph: rnd(TAU), s: sc * rnd(.8, 1.2), out: 0 }); }
    const e = new T.Euler(0, 0, 0, 'YXZ');
    c.actors.push({ update(dt) { const scared = c.scare && clock - c.scare < 16;
      B.forEach((b, i) => { b.out = lerp(b.out, scared ? 1 : 0, 1 - Math.exp(-dt * (scared ? 1.2 : .25))); const ang = b.ph + b.w * clock, x0 = b.cx + Math.cos(ang) * b.r, z0 = b.cz + Math.sin(ang) * b.r * .8;
        const ox = x0 - (c.cx ?? 0), oz = z0 - (c.cz ?? 0), ol = Math.hypot(ox, oz) || 1, d = b.out * 7;
        const x = x0 + ox / ol * d, z = z0 + oz / ol * d, y = b.alt + Math.sin(clock * .7 + b.ph) * .12 + d * .35;
        const hd = b.out > .5 ? Math.atan2(oz, ox) : ang + Math.sign(b.w) * Math.PI / 2; e.set(-Math.sign(b.w) * .35 * (1 - b.out), -hd, 0);
        _Q.setFromEuler(e); _P.set(x, y, z); _S.setScalar(b.s); _M.compose(_P, _Q, _S); im.setMatrixAt(i, _M); });
      im.instanceMatrix.needsUpdate = true; } });
  },
  galley(c, n) { // a Roman bireme: curled stern, bronze ram, striped square sail, two banks of oars rowing
    const ok = h => h < c.water - .06, sc = c.st.boatScale || 1.4;
    for (let k = 0; k < n; k++) {
      const g = new T.Group(), hb = lathe([[0, -.2], [.022, -.19], [.036, -.15], [.044, -.07], [.045, .05], [.04, .12], [.025, .175], [.004, .2]], 18); hb.scale(1, .6, 1);
      mesh(hb, shadeMat(hb, '#7a5434', '#2c1d12', .7), g, 0, -.004, 0);
      mesh(new T.BoxGeometry(.33, .006, .052), mat('#a07a4c', .8), g, 0, .016, 0);
      mesh(new T.BoxGeometry(.3, .01, .056), mat(pick(['#a3311f', '#c88a3a', '#2f5a7a']), .6), g, 0, .006, 0);
      mesh(tube([[-.19, .005, 0], [-.225, .03, 0], [-.235, .07, 0], [-.22, .1, 0], [-.2, .095, 0]], .007), mat('#5a3c24', .7), g);
      const ram = mesh(new T.ConeGeometry(.009, .05, 8), mat('#a9843a', .35, .7), g, .215, -.012, 0); ram.rotation.z = -Math.PI / 2;
      [-1, 1].forEach(sd => { mesh(new T.SphereGeometry(.006, 8, 6), mat('#f2eee6', .4), g, .175, .012, sd * .02); mesh(new T.SphereGeometry(.0032, 6, 4), mat('#111', .3), g, .179, .012, sd * .024); });
      mesh(new T.CylinderGeometry(.0035, .0045, .22, 6), mat('#4a3420', .7), g, .015, .12, 0);
      const yard = mesh(new T.CylinderGeometry(.0025, .0025, .19, 5), mat('#4a3420', .7), g, .02, .215, 0); yard.rotation.x = Math.PI / 2;
      const sg = new T.PlaneGeometry(.17, .14, 6, 7), sp = sg.attributes.position; for (let i = 0; i < sp.count; i++) { const u = sp.getX(i) / .085; sp.setZ(i, (1 - u * u) * .018); } sg.rotateY(Math.PI / 2); sg.computeVertexNormals();
      const sgc = paint(sg, (x, y) => (Math.floor((y + .07) / .02) % 2) ? '#a3311f' : '#efe6d2'); mesh(sgc, new T.MeshStandardMaterial({ vertexColors: true, roughness: .85, side: T.DoubleSide }), g, .028, .14, 0);
      const oarM = mat('#c9a878', .7), oars = [];
      [-1, 1].forEach(sd => { for (let q = 0; q < 9; q++) { const pv = new T.Group(); pv.position.set(-.12 + q * .03, .012, sd * .044); g.add(pv); const o = mesh(new T.CylinderGeometry(.0018, .0018, .12, 4), oarM, pv, 0, 0, sd * .055); o.rotation.x = Math.PI / 2; o.castShadow = false; oars.push({ pv, sd }); } });
      g.scale.setScalar(sc); c.lifeG.add(g); const p = spawnPt(c, ok), a = walker(p[0], p[1], .12, ok);
      a.update = dt => { steer(c, a, dt); a.ph += dt * (a.fleeing ? 7 : 3.4); const w = c.waveAmp ?? 1, y = c.water + .01 * sc + waveY(c, a.x, a.z), cs = Math.cos(a.dir), sn = Math.sin(a.dir);
        g.position.set(a.x, y, a.z); g.rotation.set(Math.sin(clock * 1.2 + a.seed) * .04 * w, -a.dir, Math.sin(clock * 1.05) * .025 * w);
        oars.forEach(o => { o.pv.rotation.y = Math.sin(a.ph) * .4 * o.sd; o.pv.rotation.x = o.sd * (.35 + Math.cos(a.ph) * .22); });
        if (Math.sin(a.ph) > .9 && R() < dt * 30) [-1, 1].forEach(sd => c.Sm.emit(a.x - sn * sd * .1 * sc, c.water + .006, a.z + cs * sd * .1 * sc, 0, .05, 0, rnd(.8, 1.4), [1, 1, 1, .7], [1, 1, 1, 0], .02, .07, 0, .5));
        if (R() < dt * 18) c.Sm.emit(a.x - cs * .22 * sc, c.water + .008, a.z - sn * .22 * sc, -cs * .03, 0, -sn * .03, rnd(1.6, 2.6), [1, 1, 1, .55], [1, 1, 1, 0], .025, .09); };
      c.actors.push(a);
    }
  },
  elephants(c, n) {
    const p = spawnPt(c, LAND(c)), lead = walker(p[0], p[1], .13, LAND(c)), mem = [];
    const bis = c.st.herd === 'bison', skin = new T.MeshStandardMaterial({ color: col(bis ? '#4a3424' : '#7f7a75'), roughness: .95 }), ivory = mat(bis ? '#2a2420' : '#efe6d2', .45), eye = mat('#111', .3), tuft = mat('#2a2622', .9), fur = mat('#3a2818', 1);
    const earM = new T.MeshStandardMaterial({ color: col('#77716b'), roughness: .95, side: T.DoubleSide });
    const es = new T.Shape(); es.moveTo(0, .01); es.bezierCurveTo(-.03, .065, -.1, .07, -.11, .0); es.bezierCurveTo(-.1, -.075, -.04, -.095, 0, -.04); es.lineTo(0, .01);
    for (let k = 0; k < n; k++) {
      const g = new T.Group(), bg = lathe([[0, -.13], [.055, -.125], [.08, -.095], [.088, -.03], [.087, .04], [.078, .09], [.05, .115], [0, .125]], 20); bg.scale(1, .95, .82);
      mesh(bg, bis ? shadeMat(bg, '#5a4030', '#2e2018', .95) : shadeMat(bg, '#8d8984', '#635e59', .95), g, 0, .21, 0);
      let ears = [], trunk = [];
      if (bis) { // bison: a shaggy hump over the shoulders, a low heavy head, short hooked horns
        const hp = lumpy(new T.IcosahedronGeometry(.085, 1), .3, 40); hp.scale(1.1, .95, .9); mesh(hp, fur, g, .06, .27, 0);
        const hg = lumpy(new T.IcosahedronGeometry(.055, 1), .25, 50); hg.scale(1.15, 1, .95); mesh(hg, fur, g, .145, .19, 0); mesh(new T.SphereGeometry(.03, 10, 8), skin, g, .19, .165, 0);
        [-1, 1].forEach(sd => { mesh(new T.SphereGeometry(.005, 6, 4), eye, g, .19, .2, sd * .036); mesh(tube([[0, 0, 0], [0, .012, sd * .02], [-.008, .028, sd * .024]], .005), ivory, g, .15, .22, sd * .04); });
      } else {
      const hg = new T.SphereGeometry(.058, 16, 12); hg.scale(1, 1.1, .9); mesh(hg, skin, g, .135, .25, 0); mesh(new T.SphereGeometry(.04, 12, 8), skin, g, .15, .29, 0);
      [-1, 1].forEach(sd => mesh(new T.SphereGeometry(.006, 6, 4), eye, g, .178, .262, sd * .041));
      ears = [-1, 1].map(sd => { const e = new T.Group(); e.position.set(.12, .27, sd * .05); g.add(e); mesh(new T.ShapeGeometry(es, 10), earM, e); return e; });
      trunk = chain(g, skin, 6, .028, .02, .008, .17, .24, 0); trunk[0].rotation.z = -1.35; trunk.forEach((j, i) => { if (i) j.rotation.z = .1; });
      [-1, 1].forEach(sd => mesh(tube([[0, 0, 0], [.02, -.02, 0], [.045, -.015, 0], [.06, .006, 0]], .005), ivory, g, .16, .225, sd * .026)); }
      const L = [[.065, .045], [.065, -.045], [-.065, .045], [-.065, -.045]].map(([x, z]) => leg2(g, skin, x, z, .17, .085, .074, .025));
      const tail = chain(g, skin, 3, .025, .006, .004, -.125, .22, 0); tail[0].rotation.set(0, Math.PI, -1.1); mesh(new T.SphereGeometry(.008, 6, 4), tuft, tail[2], .025, 0, 0);
      blob(g, .36, .24, .45); const sc = (k === 0 ? 1.15 : rnd(.7, 1)) * 1.6 * (bis ? .5 : 1); g.scale.setScalar(sc); g.rotation.order = 'YZX'; c.lifeG.add(g);
      mem.push({ g, sc, ears, trunk, L, tail, ph: rnd(TAU), off: k === 0 ? [0, 0] : [-(.36 + Math.floor((k - 1) / 2) * .34) * (bis ? .5 : 1) + (bis ? rnd(-.06, .06) : 0), (k % 2 ? .21 : -.21) * rnd(.7, 1.3) * (bis ? .6 : 1)] });
    }
    lead.update = dt => { steer(c, lead, dt); const cd = Math.cos(lead.dir), sd = Math.sin(lead.dir);
      mem.forEach(m => { const pp = m.ph; m.ph += dt * 2.8 * (lead.fleeing ? 2 : 1); const x = lead.x + cd * m.off[0] - sd * m.off[1], z = lead.z + sd * m.off[0] + cd * m.off[1];
        m.g.position.set(x, c.hAt(x, z) + Math.abs(Math.sin(m.ph)) * .004, z); m.g.rotation.set(0, -lead.dir, slopePitch(c, x, z, lead.dir, .09 * m.sc)); gait(m.L, m.ph, lead.fleeing ? .5 : .36);
        if (Math.floor(pp / Math.PI) !== Math.floor(m.ph / Math.PI)) footfall(c, x, z, lead.dir, Math.floor(m.ph / Math.PI) % 2 ? 1 : -1, .065 * m.sc, .045 * m.sc, .02 * m.sc, lead.fleeing ? 6 : 3);
        m.ears.forEach((e, i) => { e.rotation.y = (i ? -1 : 1) * (.15 + (Math.sin(m.ph * .6) * .5 + .5) * .4); });
        m.trunk.forEach((j, i) => { j.rotation.z = i ? .1 + Math.sin(m.ph * .5 - i * .6) * .13 : -1.35 + Math.sin(m.ph * .5) * .12; }); m.tail[0].rotation.y = Math.PI + Math.sin(m.ph) * .3; }); };
    c.actors.push(lead);
  },
  whale(c, n) {
    const ok = h => h < c.water - .12;
    const fs = new T.Shape(); fs.moveTo(0, 0); fs.quadraticCurveTo(-.05, .03, -.2, .012); fs.quadraticCurveTo(-.21, 0, -.19, -.008); fs.quadraticCurveTo(-.08, -.012, 0, -.02);
    const ks = new T.Shape(); ks.moveTo(0, 0); ks.quadraticCurveTo(-.02, .07, -.08, .12); ks.quadraticCurveTo(-.06, .05, -.075, 0); ks.quadraticCurveTo(-.06, -.05, -.08, -.12); ks.quadraticCurveTo(-.02, -.07, 0, 0);
    for (let k = 0; k < n; k++) {
      const g = new T.Group(), bg = lathe([[.012, -.36], [.02, -.32], [.034, -.26], [.052, -.18], [.072, -.08], [.085, .02], [.088, .1], [.082, .18], [.066, .26], [.042, .32], [.015, .355], [0, .36]], 26); bg.scale(1, .8, 1);
      mesh(bg, shadeMat(bg, '#25323b', '#d3dadd', .4), g);
      const finM = new T.MeshStandardMaterial({ color: col('#d9dfe1'), roughness: .5, side: T.DoubleSide }), dark = new T.MeshStandardMaterial({ color: col('#25323b'), roughness: .45, side: T.DoubleSide });
      const fins = [-1, 1].map(sd => { const f = new T.Group(); f.position.set(.14, -.045, sd * .062); f.rotation.set(sd * .35, sd * .65, 0); g.add(f); const fm = mesh(new T.ShapeGeometry(fs, 10), finM, f); fm.rotation.x = -Math.PI / 2; return f; });
      const fl = new T.Group(); fl.position.x = -.355; g.add(fl); const km = mesh(new T.ShapeGeometry(ks, 12), dark, fl); km.rotation.x = -Math.PI / 2;
      const hump = mesh(new T.ConeGeometry(.012, .025, 8), dark, g, -.15, .066, 0); hump.rotation.z = .5;
      c.lifeG.add(g); const p = spawnPt(c, ok), a = walker(p[0], p[1], .22, ok);
      a.update = dt => { steer(c, a, dt); a.ph += dt * 1.6; const surf = Math.sin(clock * .35 + a.seed);
        g.position.set(a.x, c.water - .1 + Math.max(0, surf) * .08, a.z); g.rotation.set(0, -a.dir, Math.sin(a.ph) * .05 + Math.max(0, surf) * .05); fl.rotation.z = Math.sin(a.ph) * .4; fins.forEach((f, i) => { f.rotation.x = (i ? 1 : -1) * (.35 + Math.sin(a.ph * .7) * .12); });
        if (surf > .95 && R() < dt * 1.4) for (let i = 0; i < 45; i++) c.Sm.emit(a.x + Math.cos(a.dir) * .22, c.water + .02, a.z + Math.sin(a.dir) * .22, rnd(-.04, .04), rnd(.5, .9), rnd(-.04, .04), rnd(.8, 1.2), [1, 1, 1, .7], [1, 1, 1, 0], .025, .08, -.6, .3); };
      c.actors.push(a);
    }
  },
  ship(c, n) {
    const ok = h => h < c.water - .06;
    const hs = new T.Shape(); hs.moveTo(-.17, -.045); hs.lineTo(.11, -.045); hs.quadraticCurveTo(.19, -.03, .215, 0); hs.quadraticCurveTo(.19, .03, .11, .045); hs.lineTo(-.17, .045); hs.lineTo(-.17, -.045);
    for (let k = 0; k < n; k++) {
      const g = new T.Group(), hg = new T.ExtrudeGeometry(hs, { depth: .065, bevelEnabled: false, curveSegments: 10 }); hg.rotateX(-Math.PI / 2); hg.translate(0, -.03, 0);
      const pos = hg.attributes.position, cols = []; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), cc = col(y < -.01 ? '#8a2a22' : y < .03 ? '#1f2328' : '#efebe2'); cols.push(cc.r, cc.g, cc.b); }
      hg.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); mesh(hg, new T.MeshStandardMaterial({ vertexColors: true, roughness: .55 }), g);
      const dg = new T.ShapeGeometry(hs, 10); dg.rotateX(-Math.PI / 2); mesh(dg, mat('#b89a6a', .8), g, 0, .036, 0);
      const wht = mat('#efebe2', .5), win = mat('#1f2a36', .2);
      mesh(new T.BoxGeometry(.13, .04, .07), wht, g, -.05, .057, 0); mesh(new T.BoxGeometry(.131, .008, .071), win, g, -.05, .064, 0);
      mesh(new T.BoxGeometry(.06, .03, .062), wht, g, -.02, .092, 0); mesh(new T.BoxGeometry(.061, .007, .063), win, g, -.02, .098, 0);
      mesh(new T.CylinderGeometry(.015, .018, .065, 14), mat('#c8a040', .45), g, -.085, .125, 0); mesh(new T.CylinderGeometry(.0155, .0155, .012, 14), mat('#1a1a1a', .5), g, -.085, .153, 0);
      mesh(new T.CylinderGeometry(.002, .003, .13, 6), mat('#3a3a3a', .5), g, .09, .1, 0);
      [-1, 1].forEach(sd => { const lb = new T.SphereGeometry(1, 10, 6); lb.scale(.022, .007, .008); mesh(lb, mat('#e8742c', .6), g, -.04, .083, sd * .039); });
      g.scale.setScalar(1.2); c.lifeG.add(g); const p = spawnPt(c, ok), a = walker(p[0], p[1], .07, ok);
      a.update = dt => { steer(c, a, dt); const w = c.waveAmp ?? 1, y = c.water + .018 + waveY(c, a.x, a.z), cs = Math.cos(a.dir), sn = Math.sin(a.dir); g.position.set(a.x, y, a.z); g.rotation.set(Math.sin(clock * 1.3 + a.seed) * .045 * w, -a.dir, Math.sin(clock * 1.1) * .03 * w);
        if (R() < dt * 12) c.Sm.emit(a.x - cs * .1, y + .2, a.z - sn * .1, rnd(-.02, .02) + .03, rnd(.08, .15), rnd(-.02, .02), rnd(2, 3.5), [.3, .29, .29, .6], [.6, .6, .6, 0], .02, .09, 0, .3);
        if (R() < dt * 26) c.Sm.emit(a.x - cs * .22 + rnd(-.02, .02), c.water + .012, a.z - sn * .22 + rnd(-.02, .02), -cs * .03, 0, -sn * .03, rnd(1.5, 2.5), [1, 1, 1, .6], [1, 1, 1, 0], .022, .07);
        if (R() < dt * 10) [-1, 1].forEach(sd => c.Sm.emit(a.x + cs * .24 - sn * sd * .03, c.water + .012, a.z + sn * .24 + cs * sd * .03, -sn * sd * .05, 0, cs * sd * .05, 1.6, [1, 1, 1, .5], [1, 1, 1, 0], .018, .05)); };
      c.actors.push(a);
    }
  },
  balloon(c, n) {
    const prof = [[.034, -.13], [.036, -.115], [.05, -.08], [.066, -.05], [.083, -.02], [.098, .01], [.11, .04], [.121, .075], [.128, .11], [.127, .145], [.12, .175], [.106, .203], [.085, .226], [.058, .242], [.028, .251], [0, .254]].map(([r, y]) => [r * 1.22, y]);
    const PALS = [['#a8432e', '#d8b464'], ['#3a5a7a', '#ece6d8'], ['#b8683a', '#e8dcc0', '#4a6a4a'], ['#6a3e3a', '#d4a860'], ['#9a3c38', '#ece6d8', '#3a5a7a'], ['#4a7a6e', '#ddc98a']];
    for (let k = 0; k < n; k++) {
      const g = new T.Group(), sg = lathe(prof, 32, true), ps = sg.attributes.position, cols = [], t = new T.Color(), pal = pick(PALS), style = pick(['gores', 'gores', 'bands', 'mix']);
      for (let i = 0; i < ps.count; i++) { const y = ps.getY(i), a = (Math.atan2(ps.getZ(i), ps.getX(i)) + Math.PI) / (TAU / 16), gi = Math.floor(a) % 16, fr = a - Math.floor(a);
        if (y < -.1) t.copy(col('#2a2622')); else if (y > .246) t.copy(col(pal[0])).multiplyScalar(.6);
        else if (style === 'rainbow') t.setHSL(gi / 16, .72, .55).convertSRGBToLinear();
        else if (style === 'bands') t.copy(col(pal[Math.floor((y + .13) / .384 * 7) % pal.length]));
        else if (style === 'mix') t.copy(col(y > .03 && y < .1 ? pal[pal.length - 1] : pal[gi % 2]));
        else t.copy(col(pal[gi % pal.length]));
        if (fr < .05 || fr > .95) t.multiplyScalar(.75); cols.push(t.r, t.g, t.b); }
      sg.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); mesh(sg, new T.MeshStandardMaterial({ vertexColors: true, roughness: .6, side: T.DoubleSide }), g, 0, .22, 0);
      const rp = []; [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => rp.push(sx * .03, .085, sz * .03, sx * .022, .036, sz * .022)); const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(rp, 3)); g.add(new T.LineSegments(rg, new T.LineBasicMaterial({ color: col('#2a2018') })));
      mesh(new T.BoxGeometry(.05, .032, .05), mat('#8a6038', .95), g, 0, .016, 0); mesh(new T.BoxGeometry(.054, .006, .054), mat('#4a3420', .9), g, 0, .034, 0); mesh(new T.BoxGeometry(.02, .01, .02), mat('#5a5e64', .4, .6), g, 0, .062, 0);
      const flame = mesh(new T.ConeGeometry(.008, .034, 8), new T.MeshBasicMaterial({ color: new T.Color(3, 1.6, .5) }), g, 0, .085, 0); flame.castShadow = false;
      c.flyG.add(g); const a = { s: rnd(-4.5, 3.5), seed: rnd(100), dmin: -2.6, dmax: 1.8 }; a.depth = rnd(a.dmin, a.dmax);
      a.update = dt => { const [x, , z] = skyPos(a, dt, .04 + [.03, .08, .17, .32][MOD.wind] * .25), dn = (a.depth - a.dmin) / (a.dmax - a.dmin), sc = lerp(2.2, 7.5, dn * dn);
        g.position.set(x, lerp(2.5, 1.35, dn) + Math.sin(clock * .3 + a.seed) * .06, z); g.scale.setScalar(sc); g.rotation.set(0, a.seed, -[0, .02, .06, .12][MOD.wind] + Math.sin(clock * .5 + a.seed) * .015);
        const on = Math.sin(clock * .6 + a.seed) > .72; flame.visible = on; if (on) flame.scale.setScalar(.8 + R() * .5); };
      c.actors.push(a);
    }
  },
  longtail(c, n) {
    const ok = h => h < c.water - .03;
    const pf = new T.Shape(); pf.moveTo(-.16, .036); pf.lineTo(-.152, .004); pf.quadraticCurveTo(0, -.022, .12, 0); pf.quadraticCurveTo(.16, .02, .192, .09); pf.lineTo(.178, .093); pf.quadraticCurveTo(.135, .048, .1, .041); pf.lineTo(-.16, .036);
    for (let k = 0; k < n; k++) {
      const g = new T.Group(), hg = new T.ExtrudeGeometry(pf, { depth: .036, bevelEnabled: true, bevelThickness: .004, bevelSize: .003, bevelSegments: 2, curveSegments: 10 }); hg.translate(0, 0, -.018);
      const pos = hg.attributes.position, cols = [], wood = pick(['#6b4a2c', '#5a3c24', '#7a5634']); for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), cc = col(y > .031 && pos.getX(i) < .12 ? '#dcc79a' : y < .003 ? '#2e2218' : wood); cols.push(cc.r, cc.g, cc.b); }
      hg.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); mesh(hg, new T.MeshStandardMaterial({ vertexColors: true, roughness: .7 }), g);
      mesh(new T.BoxGeometry(.25, .004, .03), mat('#4a3420', .9), g, -.02, .03, 0);
      ['#e23a3a', '#f2c230', '#3aa84a', '#3a6ae2', '#f27ab0'].forEach((h, q) => { const r = mesh(new T.BoxGeometry(.004, .03 - q * .003, .012), mat(h, .6), g, .183 - q * .004, .072 - q * .004, (q % 2 ? 1 : -1) * .012); r.rotation.z = .3; });
      if (R() < .55) { const roof = mat(pick(['#2f6fb4', '#e8742c', '#c23b4a', '#3a9a8a']), .7); [[-.06, .013], [-.06, -.013], [.06, .013], [.06, -.013]].forEach(([px, pz]) => mesh(new T.CylinderGeometry(.0018, .0018, .055, 5), mat('#5a4a3a', .8), g, px, .06, pz)); mesh(new T.BoxGeometry(.15, .004, .05), roof, g, 0, .088, 0); }
      mesh(new T.BoxGeometry(.03, .02, .022), mat('#2a2d33', .4, .4), g, -.148, .058, 0);
      const vx = -.92, vy = -.39, sh = mesh(new T.CylinderGeometry(.002, .002, .16, 5), mat('#8a8e94', .3, .6), g, -.225, .028, 0); sh.rotation.z = Math.atan2(-vx, vy);
      mesh(new T.CylinderGeometry(.006, .007, .028, 6), mat(pick(['#e8e4dc', '#3a6aa8', '#c23b4a']), .8), g, -.125, .05, 0); mesh(new T.SphereGeometry(.006, 8, 6), mat('#a8784a', .7), g, -.125, .07, 0); mesh(new T.ConeGeometry(.012, .008, 10), mat('#d9c08a', .9), g, -.125, .078, 0);
      const lampM = new T.MeshBasicMaterial({ color: new T.Color(0, 0, 0) }); const lamp = mesh(new T.SphereGeometry(.006, 8, 6), lampM, g, .165, .07, 0); lamp.castShadow = false;
      g.scale.setScalar(1.45); g.rotation.order = 'YZX'; c.lifeG.add(g);
      const p = spawnPt(c, ok), a = walker(p[0], p[1], .2, ok), an = c.anchors && c.anchors[k]; a.putt = 0; if (an) { a.x = an[0]; a.z = an[1]; a.dir = an[2]; }
      a.update = dt => { if (an) { g.position.set(a.x, c.water + .004 + waveY(c, a.x, a.z), a.z); g.rotation.set(Math.sin(clock * 1.2 + a.seed) * .045 * (c.waveAmp ?? 1), -a.dir, .03 + Math.sin(clock * .9 + a.seed) * .02); const gl = c.glowGain ?? 0; lampM.color.setRGB(3 * gl, 2 * gl, .9 * gl); return; } a.sp = .07 + .05 * (Math.sin(clock * .15 + a.seed) * .5 + .5); steer(c, a, dt); const w = c.waveAmp ?? 1, y = c.water + .004 + waveY(c, a.x, a.z), cs = Math.cos(a.dir), sn = Math.sin(a.dir);
        g.position.set(a.x, y, a.z); g.rotation.set(Math.sin(clock * 1.7 + a.seed) * .05 * w, -a.dir, .05 + a.sp * .15 + Math.sin(clock * 1.3 + a.seed) * .02 * w);
        const gl = c.glowGain ?? 0; lampM.color.setRGB(3 * gl, 2 * gl, .9 * gl);
        const sx = a.x - cs * .42, sz = a.z - sn * .42; if (R() < dt * 40) c.Sm.emit(sx + rnd(-.02, .02), c.water + .01, sz + rnd(-.02, .02), -cs * .15 + rnd(-.08, .08), rnd(.15, .4), -sn * .15 + rnd(-.08, .08), rnd(.4, .8), [1, 1, 1, .8], [1, 1, 1, 0], .015, .04, -1.5, .5);
        if (R() < dt * 22) [-1, 1].forEach(sd => c.Sm.emit(a.x - cs * .1 - sn * sd * .03, c.water + .008, a.z - sn * .1 + cs * sd * .03, -sn * sd * .05 - cs * .02, 0, cs * sd * .05 - sn * .02, 2.2, [1, 1, 1, .55], [1, 1, 1, 0], .016, .05));
        };
      c.actors.push(a);
    }
  },
  blimp(c, n) {
    for (let k = 0; k < n; k++) {
      const g = new T.Group(), eg = lathe([[0, -.3], [.035, -.285], [.064, -.22], [.082, -.1], [.085, .04], [.075, .16], [.05, .25], [.02, .29], [0, .3]], 24);
      mesh(eg, shadeMat(eg, '#d9dde2', '#8f969e', .45), g);
      const band = lathe([[.0858, -.05], [.0862, .05]], 24); mesh(band, mat(pick(['#b4502a', '#23968f', '#e8842c']), .5), g);
      const fs = new T.Shape(); fs.moveTo(0, 0); fs.lineTo(-.07, 0); fs.lineTo(-.085, .065); fs.lineTo(-.04, .06); fs.lineTo(0, 0);
      for (let q = 0; q < 4; q++) { const fg = new T.ExtrudeGeometry(fs, { depth: .004, bevelEnabled: false }); fg.translate(0, .03, -.002); const f = mesh(fg, mat('#b4502a', .5), g, -.2, 0, 0); f.rotation.x = q * Math.PI / 2; }
      mesh(new T.BoxGeometry(.08, .02, .025), mat('#2a2d33', .4), g, .03, -.09, 0); mesh(new T.BoxGeometry(.081, .006, .026), mat('#9fd8ff', .1), g, .03, -.087, 0);
      const nav = mesh(new T.SphereGeometry(.006, 8, 6), new T.MeshBasicMaterial({ color: new T.Color(3, .4, .3) }), g, -.03, -.1, 0); nav.castShadow = false;
      g.scale.setScalar(rnd(5.5, 6.5)); c.flyG.add(g); const a = { s: rnd(-4, 2), alt: rnd(2.7, 3.2), depth: rnd(.8, 1.8), seed: rnd(100) };
      a.update = dt => { const [x, y, z] = skyPos(a, dt, .08); g.position.set(x, y, z); g.rotation.set(Math.sin(clock * .5 + a.seed) * .02, Math.PI / 4, Math.sin(clock * .3) * .03); nav.visible = Math.sin(clock * 5) > .5; };
      c.actors.push(a);
    }
  },
  plane(c, n) {
    const ws = (side) => { const s = new T.Shape(); s.moveTo(.04, 0); s.lineTo(-.012, side * .2); s.lineTo(-.04, side * .2); s.lineTo(-.045, 0); s.lineTo(.04, 0); const g = new T.ExtrudeGeometry(s, { depth: .004, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; };
    const fs = new T.Shape(); fs.moveTo(0, 0); fs.lineTo(-.06, 0); fs.lineTo(-.078, .062); fs.lineTo(-.056, .062); fs.lineTo(0, 0);
    for (let k = 0; k < n; k++) {
      const g = new T.Group(), wm = mat('#eceef2', .3, .35), liv = mat(pick(['#b4502a', '#23968f', '#3d5f8a']), .4);
      mesh(lathe([[0, -.2], [.006, -.195], [.012, -.17], [.017, -.12], [.02, -.05], [.02, .12], [.017, .16], [.01, .188], [0, .2]], 16), wm, g);
      mesh(new T.BoxGeometry(.26, .004, .0405), mat('#2a3a50', .2), g, .01, .006, 0);
      [1, -1].forEach(sd => { mesh(ws(sd), wm, g, .01, -.009, 0); mesh(new T.CylinderGeometry(.009, .008, .04, 12).rotateZ(Math.PI / 2), mat('#c8ccd2', .3, .5), g, .035, -.02, sd * .075); const st = ws(sd).scale(.4, 1, .4); mesh(st, wm, g, -.165, .006, 0); });
      mesh(new T.ExtrudeGeometry(fs, { depth: .003, bevelEnabled: false }), liv, g, -.13, .012, -.0015);
      c.lifeG.add(g); const a = { wait: rnd(.5, 3) + k * 4 };
      const reset = () => { a.dir = rnd(TAU); a.off = rnd(-1.8, 1.8); a.s = -5; a.y = rnd(2.7, 3.1); a.snd = 1; }; reset();
      a.update = dt => { if (a.wait > 0) { a.wait -= dt; g.visible = false; return; } g.visible = true; if (a.snd) { a.snd = 0; noise(6, { ff: 320, vol: .01, attack: 2.5 }); }
        a.s += dt * .6; const cd = Math.cos(a.dir), sd = Math.sin(a.dir), x = cd * a.s - sd * a.off, z = sd * a.s + cd * a.off; g.position.set(x, a.y, z); g.rotation.set(0, -a.dir, 0);
        if (MOD.time !== 3 && R() < dt * 40) [-1, 1].forEach(w => c.Sm.emit(x - cd * .02 - sd * w * .075, a.y - .02, z - sd * .02 + cd * w * .075, 0, 0, 0, rnd(3, 5), [1, 1, 1, .5], [1, 1, 1, 0], .012, .05, 0, .1));
        if (Math.sin(clock * 6) > .6) { c.P.emit(x - sd * .2, a.y, z + cd * .2, 0, 0, 0, .06, [1, .2, .2, 1], [1, .2, .2, 1], .045, .045); c.P.emit(x + sd * .2, a.y, z - cd * .2, 0, 0, 0, .06, [.2, 1, .4, 1], [.2, 1, .4, 1], .045, .045); }
        if (a.s > 5) { reset(); a.wait = rnd(4, 10); } };
      c.actors.push(a);
    }
  },
  people(c, n) {
    const tg = new T.CylinderGeometry(.0075, .009, .024, 7); tg.translate(0, .038, 0); const hg = new T.SphereGeometry(.0068, 8, 6); hg.translate(0, .057, 0); const lgG = new T.CylinderGeometry(.0032, .0028, .027, 5); lgG.translate(0, -.0135, 0);
    const body = inst(tg, new T.MeshStandardMaterial({ roughness: .8 }), n, false), head = inst(hg, mat('#d9a882', .7), n, false), legA = inst(lgG, new T.MeshStandardMaterial({ roughness: .85 }), n, false), legB = inst(lgG, legA.material, n, false), tc = new T.Color();
    const PC = c.st.peopleCols || ['#b4302a', '#2a4a8a', '#e8c040', '#2a2d33', '#efe9dc', '#3a7a4a', '#8a3a8a', '#d9784a'], psc = c.st.peopleScale || 1, zone = c.peopleZone, ground = c.groundAt || c.hAt;
    for (let i = 0; i < n; i++) { body.setColorAt(i, tc.copy(col(pick(PC)))); const lc = col(pick(['#23262c', '#2a3a5a', '#5a4a3a', '#1a1a1a'])); legA.setColorAt(i, lc); legB.setColorAt(i, lc); head.setColorAt(i, tc.copy(col(pick(['#e8c0a0', '#c89070', '#8a5a3a', '#5a3a2a'])))); }
    c.lifeG.add(body, head, legA, legB);
    const city = c.st.id === 'neon', ok = LAND(c), Q = [], loc = new T.Matrix4(), rz = new T.Matrix4(), base = new T.Matrix4();
    for (let i = 0; i < n; i++) { if (city) { const ax = R() < .5, line = ((Math.floor(rnd(0, 11)) + .08) / 5.5 - 1) * 3.2 + (R() < .5 ? .075 : -.075); Q.push({ ax, line, p: rnd(-3.1, 3.1), v: rnd(.12, .25) * (R() < .5 ? 1 : -1), ph: rnd(TAU) }); } else { let p = null; if (zone) for (let t = 0; t < 400 && !p; t++) { const x = rnd(zone.x0, zone.x1), z = rnd(zone.z0, zone.z1); if (zone.ok(x, z)) p = [x, z]; } if (!p) p = spawnPt(c, ok); Q.push({ x: p[0], z: p[1], dir: rnd(TAU), v: rnd(.06, .12) * psc * .6, ph: rnd(TAU) }); } }
    c.actors.push({ update(dt) { const rush = [0, .6, .85, 1.3][MOD.life] * (c.panic ? 3.2 : 1);
      Q.forEach((q, i) => { q.ph += dt * 13 * rush; let x, z, yaw, hide = false;
        if (city) { q.p += q.v * dt * rush; if (q.p > 3.1) q.p = -3.1; if (q.p < -3.1) q.p = 3.1; x = q.ax ? q.p : q.line; z = q.ax ? q.line : q.p; yaw = q.ax ? (q.v > 0 ? 0 : Math.PI) : (q.v > 0 ? -Math.PI / 2 : Math.PI / 2); hide = Math.abs(z / 3.2 - .12) < .08; }
        else { q.dir += rnd(-1.5, 1.5) * dt; const nx = q.x + Math.cos(q.dir) * q.v * dt, nz = q.z + Math.sin(q.dir) * q.v * dt; if (zone ? zone.ok(nx, nz) : (Math.abs(nx) < 3 && Math.abs(nz) < 3 && ok(c.hAt(nx, nz), c.slopeAt(nx, nz)))) { q.x = nx; q.z = nz; } else q.dir += Math.PI * .5; x = q.x; z = q.z; yaw = -q.dir; }
        if (hide) { body.setMatrixAt(i, ZERO); head.setMatrixAt(i, ZERO); legA.setMatrixAt(i, ZERO); legB.setMatrixAt(i, ZERO); return; }
        _P.set(x, (city ? .2 : ground(x, z)) + Math.abs(Math.sin(q.ph)) * .004 * psc, z); _Q.setFromAxisAngle(UP, yaw); _S.setScalar(psc); base.compose(_P, _Q, _S); body.setMatrixAt(i, base); head.setMatrixAt(i, base);
        const sw = Math.sin(q.ph) * .55; loc.makeTranslation(0, .027, .0042); rz.makeRotationZ(sw); legA.setMatrixAt(i, _M.copy(base).multiply(loc).multiply(rz)); loc.makeTranslation(0, .027, -.0042); rz.makeRotationZ(-sw); legB.setMatrixAt(i, _M.copy(base).multiply(loc).multiply(rz)); });
      body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = legA.instanceMatrix.needsUpdate = legB.instanceMatrix.needsUpdate = true; } });
  }
};

const LIFE_SPEC = {
  vesuvius: [['people', [0, 10, 20, 34]], ['galley', [0, 1, 2, 3]], ['birds', [0, 8, 14, 22]]],
  festival: [['people', [0, 15, 35, 70]], ['balloon', [0, 2, 4, 7]], ['birds', [0, 4, 8, 12]]],
  dunes: [['balloon', [0, 1, 1, 2]]],
  breach: [['longtail', [0, 8, 10, 12]], ['birds', [0, 6, 11, 18]], ['balloon', [0, 0, 1, 2]], ['plane', [0, 0, 1, 1]]],
  neon: [['people', [0, 40, 100, 190]], ['plane', [0, 1, 1, 2]]]
};
function buildLife(c) {
  if (c.lifeG) { c.group.remove(c.lifeG); c.lifeG.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  [...c.flyG.children].forEach(o => { c.flyG.remove(o); o.traverse(q => { if (q.geometry) q.geometry.dispose(); if (q.material) q.material.dispose(); }); });
  c.lifeG = new T.Group(); c.group.add(c.lifeG); c.actors = [];
  (LIFE_SPEC[c.st.id] || []).forEach(([kind, counts]) => { const n = counts[MOD.life]; if (n) MAKERS[kind](c, n); });
}
function life(c, dt) { if (c.lifeLvl !== MOD.life) { buildLife(c); c.lifeLvl = MOD.life; } c.actors.forEach(a => a.update(dt)); c.treeSets.forEach(t => t.tick(dt)); }

/* ================= flow ================= */
const KEEP = ['vesuvius', 'festival', 'dunes', 'breach', 'neon'];
for (let i = STORIES.length - 1; i >= 0; i--) if (!KEEP.includes(STORIES[i].id)) STORIES.splice(i, 1);
let world = null; const dying = []; let lastIds = [];
let count = store.get('k81-worlds', 0);
const plaque = $('#plaque');
function showPlaque(cap) { $('#era').textContent = cap.era; $('#title').textContent = cap.name; $('#line').textContent = cap.line; plaque.classList.add('show'); }
function updCount() { $('#count').textContent = String(count % 10000).padStart(4, '0'); }
function pickStory() { const pool = STORIES.filter(s => !lastIds.includes(s.id)); if (!pool.length) pool.push(pick(STORIES)); const s = pick(pool); lastIds.push(s.id); if (lastIds.length > 2) lastIds.shift(); return s; }
function newWorld() {
  VIEW.zoom = 1; VIEW.el = 0; VIEW.spinV = 0;
  for (let j = 0; j < NK; j++) ledT[j] = clock + kDist[j] * .09;
  if (world) { world.dieT = 0; world.p0 = world.group.position.clone(); world.s0 = world.s; dying.push(world); }
  const st = pickStory();
  Object.assign(MOD, st.preset || {}); redrawDecals();
  try { world = createWorld(st, 4); } catch (e) { console.error(e); world = null; return; }
  world.caption = st.caption(); plaque.classList.remove('show');
  setPal(computePal(), 2.2); sfx.arrive(); count++; store.set('k81-worlds', count); updCount(); say(world.caption.name.toUpperCase());
}
function press(i) {
  audio(); sfx.click(); kDownT[i] = clock; ledT[i] = clock; deckB.v -= .9; try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
  for (let j = 0; j < NK; j++) if (j !== i) ripT[j] = clock + Math.hypot(j % 3 - i % 3, Math.floor(j / 3) - Math.floor(i / 3)) * .07;
  const d = KEYDEF[i];
  if (d.id === 'world' || !world || world.dieT !== undefined) { newWorld(); return; }
  if (d.levels) { MOD[d.id] = (MOD[d.id] + 1) % 4; drawDecal(i); setPal(computePal(), 1.3); say(d.label + ' · ' + d.levels[MOD[d.id]].toUpperCase()); tone(PENTA[3 + MOD[d.id] * 2], .25, { type: 'triangle', vol: .05 }); return; }
  if (d.id === 'event') { world.userEvent = true; world.et = B0 - .05; Object.keys(world.f).forEach(k => { if (k[0] !== '_') delete world.f[k]; }); say('EVENT · ' + world.caption.name.toUpperCase()); return; }
  if (d.id === 'spin') { world.spinT += Math.PI / 2; say('SPIN · ' + (Math.round(world.spinT / (Math.PI / 2)) % 4 * 90) + '°'); noise(.5, { filter: 'bandpass', ff: 600, to: 1400, vol: .05 }); }
}
function updateWorld(c, dt) {
  c.t += dt; const t = c.t, st = c.st, hov = new T.Vector3(WX, HOVER + Math.sin(clock * 1.1) * .06, WZ);
  let s = 1;
  if (c.dieT !== undefined) { c.dieT += dt; const k = clamp(c.dieT / .45, 0, 1); s = c.s0 * (1 - easeIn(k)); c.group.position.lerpVectors(c.p0, c.keyPos, k); c.fadeA = 1 - k; setFade(c, c.fadeA); if (k >= 1) c.dead = true; }
  else if (t < B0) { const k = clamp(t / B0, 0, 1); s = lerp(.04, 1, easeOutBack(k)); c.group.position.lerpVectors(c.keyPos, hov, easeOut(k)); c.group.rotation.y = (1 - easeOut(k)) * -1.2; }
  else { c.group.position.copy(hov); if (c === world && !VIEW.drag && Math.abs(VIEW.spinV) > .01) { c.spinT += VIEW.spinV * dt; VIEW.spinV *= Math.exp(-dt * 2.6); } c.spin = lerp(c.spin, c.spinT, 1 - Math.exp(-dt * (VIEW.drag ? 16 : 4))); c.group.rotation.y = c.spin + Math.sin((t - B0) * .22) * .05; }
  c.s = s; c.group.scale.setScalar(Math.max(.002, s * WS)); if (c.skyG) { c.skyG.position.copy(c.group.position); c.skyG.scale.copy(c.group.scale); }
  if (c.dieT === undefined) {
    if (t > .45 && once(c, '_cap')) showPlaque(c.caption);
    if (t >= B1 && once(c, '_calm')) pad(st.mood[1], st.mood[0]);
    if (c.userEvent) c.et += dt; ambient(c, dt);
    try { st.update(c, c.et, dt); } catch (e) { console.error(st.id, e); }
  }
  if (c.wU) { c.wU.uWater.value = c.water; c.wU.uWT.value = clock * .55; c.wU.uWA.value = st.waves ? (c.waveA ?? .03) : 0; c.wU.uWE.value = .018 + (c.waveA ?? .03) * .45; c.wU.uRip.value = .55 + (c.waveA ?? .03) * 9; }
  if (c.aq && c.dieT === undefined) c.aq.update(clock);
  const ppu = renderer.domElement.height / viewHe * s * WS * 1.5; c.P.mat.uniforms.uScale.value = ppu; c.Sm.mat.uniforms.uScale.value = ppu; c.G.mat.uniforms.uScale.value = ppu; c.Cn.mat.uniforms.uScale.value = ppu;
  c.P.update(dt); c.Sm.update(dt); c.G.update(dt); c.Cn.update(dt);
  c.shake *= Math.exp(-dt * 4);
}

/* ================= input ================= */
const ray = new T.Raycaster(), ndc = new T.Vector2(); let hoverCheck = false, ptr = { x: 0, y: 0 };
function hitKey(e) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(keyMeshes, false)[0]; return h ? h.object.userData.i : -1; }
const ptrs = new Map(); let pinch = null, lastTap = 0;
function keyDown(i) { kHeld[i] = 1; press(i); }
function keyUp(i) { if (!kHeld[i]) return; kHeld[i] = 0; sfx.clack(); }
const dragPtrs = () => [...ptrs.values()].filter(p => p.key < 0);
canvas.addEventListener('pointerdown', e => {
  const i = hitKey(e); try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
  if (i >= 0 && !dragPtrs().length) { ptrs.set(e.pointerId, { key: i }); keyDown(i); return; }
  ptrs.set(e.pointerId, { key: -1, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() }); VIEW.spinV = 0; pinch = null; VIEW.drag = true; canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if (!p) { ptr.x = e.clientX / innerWidth * 2 - 1; ptr.y = e.clientY / innerHeight * 2 - 1; if (hoverCheck) return; hoverCheck = true; requestAnimationFrame(() => { hoverCheck = false; canvas.style.cursor = hitKey(e) >= 0 ? 'pointer' : world ? 'grab' : 'default'; }); return; }
  if (p.key >= 0) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  const w = world && world.dieT === undefined ? world : null, dp = dragPtrs();
  if (dp.length >= 2) { const [a, b] = dp, d = Math.hypot(a.x - b.x, a.y - b.y), an = Math.atan2(b.y - a.y, b.x - a.x);
    if (pinch) { VIEW.zoom = clamp(VIEW.zoom * d / pinch.d, .55, 3.2); let da = an - pinch.a; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU; if (w) w.spinT -= da; }
    pinch = { d, a: an }; return; }
  if (!w) return; const k = 6 / Math.min(innerWidth, innerHeight);
  w.spinT += dx * k; VIEW.spinV = lerp(VIEW.spinV, dx * k * 60, .5); VIEW.el = clamp(VIEW.el + dy * k * .5, -.32, .75);
});
function endPtr(e) {
  const p = ptrs.get(e.pointerId); if (!p) return; ptrs.delete(e.pointerId); pinch = null;
  if (p.key >= 0) { keyUp(p.key); return; }
  if (!dragPtrs().length) { VIEW.drag = false; canvas.style.cursor = world ? 'grab' : 'default';
    if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 8 && performance.now() - p.t0 < 300) { VIEW.spinV = 0; const now = performance.now(); if (now - lastTap < 350) { VIEW.zoom = 1; VIEW.el = 0; } lastTap = now; } }
}
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { e.preventDefault(); VIEW.zoom = clamp(VIEW.zoom * Math.exp(-e.deltaY * .0015), .55, 3.2); }, { passive: false });
const keyIdx = e => { const k = e.key.toUpperCase(); return k === ' ' || k === 'ENTER' ? 4 : k >= '1' && k <= '9' ? +k - 1 : KEYDEF.findIndex(d => d.key === k); };
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest && e.target.closest('button')) return;
  const w = world && world.dieT === undefined ? world : null;
  if (w && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); w.spinT += (e.key === 'ArrowLeft' ? -1 : 1) * Math.PI / 12; return; }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); VIEW.el = clamp(VIEW.el + (e.key === 'ArrowDown' ? .08 : -.08), -.32, .75); return; }
  if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') { VIEW.zoom = clamp(VIEW.zoom * (e.key === '-' || e.key === '_' ? .88 : 1.14), .55, 3.2); return; }
  if (e.repeat) return; const i = keyIdx(e); if (i >= 0) { e.preventDefault(); keyDown(i); }
});
addEventListener('keyup', e => { const i = keyIdx(e); if (i >= 0) keyUp(i); });
addEventListener('blur', () => { for (let i = 0; i < NK; i++) kHeld[i] = 0; ptrs.clear(); VIEW.drag = false; });
const muteBtn = $('#mute');
function syncMute() { muteBtn.setAttribute('aria-pressed', String(!AU.muted)); $('#muteLbl').textContent = AU.muted ? 'Sound off' : 'Sound on'; }
muteBtn.addEventListener('click', () => { AU.muted = !AU.muted; store.set('k81-muted', AU.muted); if (AU.ctx) AU.ctx[AU.muted ? 'suspend' : 'resume'](); syncMute(); });
DARK.addEventListener && DARK.addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ================= loop ================= */
let clock = 0, last = performance.now(), frames = 0, perfN = 0, perfT = 0;
function setPR(v) { PR = v; renderer.setPixelRatio(PR); resize(); if (composer) { composer.setPixelRatio(PR); composer.setSize(innerWidth, innerHeight); } }
const camOff = new T.Vector3();
function frame(now) {
  const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; clock += dt;
  if (raw < .25) { perfT += raw; if (++perfN >= 90) { if (perfT / perfN > 1 / 40 && PR > 1) setPR(Math.max(1, PR - .25)); perfN = perfT = 0; } } // slow GPU: render fewer pixels
  if (++frames === 3) { const ld = $('#loader'); if (ld) { ld.classList.add('done'); setTimeout(() => ld.remove(), 700); } }
  flashLight = Math.max(0, flashLight - dt * 3);
  if (world) { updateWorld(world, dt); if (world.dead) { disposeWorld(world); world = null; } }
  for (let i = dying.length - 1; i >= 0; i--) { updateWorld(dying[i], dt); if (dying[i].dead) { disposeWorld(dying[i]); dying.splice(i, 1); } }
  updatePal(dt); ambientSound(dt);
  for (let j = 0; j < NK; j++) {
    { const down = kHeld[j] || clock - kDownT[j] < .085, tgt = down ? -.25 : 0, K = down ? 2800 : 560, D = down ? 85 : 15, h = Math.min(dt, 1 / 60), n = Math.ceil(dt / h);
      for (let q = 0; q < n; q++) { kv[j] += ((tgt - ky[j]) * K - kv[j] * D) * (dt / n); ky[j] += kv[j] * (dt / n); if (ky[j] < -.27) { ky[j] = -.27; kv[j] = 0; } }
      keys[j].position.y = ky[j]; keys[j].rotation.x = clamp(kv[j] * .004, -.04, .04) * (j % 3 - 1 || .5); keys[j].rotation.z = clamp(kv[j] * .004, -.04, .04) * (Math.floor(j / 3) - 1); }
    const e = clock - ledT[j], er = clock - ripT[j]; let I = e >= 0 ? Math.max(0, 1 - e / .55) * 2.4 : 0; if (er >= 0 && er < .4) I = Math.max(I, (1 - er / .4) * .9);
    if (!world) I += .3 * (.5 + .5 * Math.sin(clock * 1.8 - kDist[j] * .8));
    else { const d = KEYDEF[j]; if (d.levels) I = Math.max(I, d.id === 'time' ? .5 : MOD[d.id] / 3 * 1.5); else if (d.id === 'world') I = Math.max(I, .9 + .4 * Math.sin(clock * 2.5)); else if (d.id === 'event' && world.et < B1) I = Math.max(I, 1.4); }
    ledMats[j].emissiveIntensity = I;
  }
  deckB.v += (-deckB.y * 320 - deckB.v * 13) * dt; deckB.y += deckB.v * dt;
  updateFraming(dt);
  const px = REDUCE || VIEW.drag ? 0 : ptr.x, py = REDUCE || VIEW.drag ? 0 : ptr.y; camOff.copy(CDIR).multiplyScalar(40).applyAxisAngle(UP, px * .07); camOff.y += -py * 1.2;
  cam.position.copy(tgtV).add(camOff); cam.lookAt(tgtV); cam.updateMatrixWorld(); dockDeck();
  const sh = REDUCE ? 0 : Math.max(world ? world.shake : 0, 0); if (sh > .002) cam.position.add(new T.Vector3(rnd(-sh, sh), rnd(-sh, sh), rnd(-sh, sh)));
  fxBoost = Math.max(0, fxBoost - dt * .5); updateSky(dt);
  if (composer) { updateFX(); composer.render(); } else renderer.render(scene, cam);
  requestAnimationFrame(frame);
}
setupFX(); if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); }
applyTheme(); Object.assign(pal, resolvePal(NEUTRAL())); syncMute(); updCount();
deckG.traverse(o => { if (o.material) o.material.fog = false; }); // aerial haze is for the diorama, never the pad in front of it
canvas.focus({ preventScroll: true });
requestAnimationFrame(frame);
window.__wonder = { press, stories: STORIES.map(s => s.id) };
const q = new URLSearchParams(location.search).get('world');
if (q) { const s = STORIES.find(x => x.id === q); if (s) { lastIds = STORIES.filter(x => x !== s).map(x => x.id); setTimeout(() => { press(4); const sq = new URLSearchParams(location.search); if (sq.get('ev')) world.userEvent = true; if (sq.get('spin')) world.spin = world.spinT = +sq.get('spin') * Math.PI / 2; if (sq.get('time')) { MOD.time = +sq.get('time'); redrawDecals(); setPal(computePal(), 99); } const ff = +new URLSearchParams(location.search).get('ff') || 0; for (let k = 0; k < ff / .033; k++) { clock += .033; updateWorld(world, .033); updatePal(.033); } }, 200); } }
})();
