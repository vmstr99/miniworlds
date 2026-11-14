/* Wonder Deck K-9 — miniature worlds floating above a nine-key isometric deck.
   Each press: a world rises from the key, bursts for ~3 s, settles, then sinks back. No continuity. */
(() => {
'use strict';
if (!window.THREE) { document.getElementById('title').textContent = 'The 3D engine failed to load'; return; }
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
  click() { noise(.03, { filter: 'highpass', ff: 2600, vol: .11 }); tone(150, .07, { type: 'square', vol: .045, filter: 'lowpass', ff: 600 }); },
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
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
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
const sun = new T.DirectionalLight(0xffffff, .9); sun.castShadow = true; const SM = renderer.capabilities.maxTextureSize >= 8192 ? 4096 : 2048; sun.shadow.mapSize.set(SM, SM);
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
const SKYF = 'uniform vec3 uTop, uMid, uHor; uniform float uA, uHy; varying vec2 vUv; void main(){ float y=vUv.y; vec3 c = y<uHy ? uHor : (y<uHy+.1 ? mix(uHor,uMid,(y-uHy)/.1) : mix(uMid,uTop,clamp((y-uHy-.1)/.38,0.,1.))); float a = uA*smoothstep(uHy-.2, uHy+.01, y)*smoothstep(1.0,.8,y)*(1.0-pow(abs(vUv.x-.5)*2.,3.)); gl_FragColor=vec4(c*a, a); }';
const backdrop = new T.Mesh(new T.PlaneGeometry(60, 40), new T.ShaderMaterial({ uniforms: { uTop: { value: new T.Color() }, uMid: { value: new T.Color() }, uHor: { value: new T.Color() }, uA: { value: 0 }, uHy: { value: .5 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: SKYF, transparent: true, depthWrite: false, blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor }));
backdrop.renderOrder = -2; backdrop.frustumCulled = false; scene.add(backdrop); let skyA = 0;
const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.ShadowMaterial({ opacity: .16 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.8; floor.receiveShadow = true; scene.add(floor);


/* ================= camera look: bloom, tilt-shift, filmic grade ================= */
let fxBoost = 0, LIN = 0, composer = null, bloomP = null, tiltH = null, tiltV = null, gradeP = null;
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const TILT = { uniforms: { tDiffuse: { value: null }, uDir: { value: new T.Vector2(1, 0) }, uRes: { value: new T.Vector2(1, 1) }, uMid: { value: .7 }, uHalf: { value: .18 }, uDeck: { value: .45 }, uMax: { value: 5 } }, vertexShader: QUAD_VS,
  fragmentShader: 'uniform sampler2D tDiffuse; uniform vec2 uDir,uRes; uniform float uMid,uHalf,uDeck,uMax; varying vec2 vUv; float amt(float y){ float k=abs(y-uMid)/uHalf; float b=smoothstep(.45,1.5,k); b*=smoothstep(uDeck-.02,uDeck+.03,y); return b*uMax; } void main(){ float a=amt(vUv.y); if(a<.05){ gl_FragColor=texture2D(tDiffuse,vUv); return; } vec2 st=uDir*a/uRes; vec4 c=texture2D(tDiffuse,vUv)*.2270; c+=(texture2D(tDiffuse,vUv+st*1.385)+texture2D(tDiffuse,vUv-st*1.385))*.3162; c+=(texture2D(tDiffuse,vUv+st*3.231)+texture2D(tDiffuse,vUv-st*3.231))*.0703; gl_FragColor=c; }' };
const GRADE = { uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uExp: { value: 1.08 }, uRes: { value: new T.Vector2(1, 1) } }, vertexShader: QUAD_VS,
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float uTime,uExp; uniform vec2 uRes; varying vec2 vUv;' +
  'vec3 fit(vec3 v){ vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b; }' +
  'vec3 aces(vec3 c){ const mat3 I=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777)); const mat3 O=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602)); c*=uExp/0.6; c=I*c; c=fit(c); c=O*c; return clamp(c,0.,1.); }' +
  'vec3 srgb(vec3 c){ return mix(pow(c,vec3(1./2.4))*1.055-0.055, c*12.92, step(c,vec3(0.0031308))); }' +
  'void main(){ vec2 d=vUv-.5; float r2=dot(d,d); vec2 off=d*r2*.006; vec3 c=vec3(texture2D(tDiffuse,vUv+off).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-off).b); c=srgb(aces(c)); c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,1.06); c*=1.0-r2*.5; float n=fract(sin(dot(floor(vUv*uRes)+uTime*61.0,vec2(12.9898,78.233)))*43758.5453); c+=(n-.5)*.03; gl_FragColor=vec4(c,1.0); }' };
function setupFX() {
  if (!T.EffectComposer || !T.RenderPass || !T.ShaderPass || !T.UnrealBloomPass) return;
  try {
    const sz = renderer.getDrawingBufferSize(new T.Vector2()), opts = { type: T.HalfFloatType, format: T.RGBAFormat };
    const rt = renderer.capabilities.isWebGL2 && T.WebGLMultisampleRenderTarget ? new T.WebGLMultisampleRenderTarget(sz.x, sz.y, opts) : new T.WebGLRenderTarget(sz.x, sz.y, opts); if ('samples' in rt) rt.samples = 4;
    composer = new T.EffectComposer(renderer, rt); composer.addPass(new T.RenderPass(scene, cam));
    bloomP = new T.UnrealBloomPass(new T.Vector2(sz.x / 2, sz.y / 2), .42, .22, 2.1); composer.addPass(bloomP);
    tiltH = new T.ShaderPass(TILT); tiltV = new T.ShaderPass(TILT); tiltV.uniforms.uDir.value.set(0, 1); composer.addPass(tiltH); composer.addPass(tiltV);
    gradeP = new T.ShaderPass(GRADE); composer.addPass(gradeP);
    renderer.toneMapping = T.NoToneMapping; LIN = 1; document.body.classList.add('fx');
  } catch (e) { console.error('fx', e); composer = null; }
}
const _pv = new T.Vector3(); const projY = (x, y, z) => (_pv.set(x, y, z).project(cam).y + 1) / 2;
function updateFX() {
  const w = renderer.domElement.width, h = renderer.domElement.height, sc = WS;
  [tiltH, tiltV, gradeP].forEach(p => p.uniforms.uRes.value.set(w, h));
  const mid = projY(WX, HOVER + .25, WZ), top = projY(WX - 2.6 * sc, HOVER + 1.2 * sc, WZ - 2.6 * sc), deck = projY(-SP - .8, .6, -SP - .8);
  [tiltH, tiltV].forEach(p => { p.uniforms.uMid.value = mid; p.uniforms.uHalf.value = Math.max(.05, top - mid); p.uniforms.uDeck.value = deck + .015; p.uniforms.uMax.value = 2.3 * renderer.getPixelRatio(); });
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
const base = new T.Mesh(baseGeo, baseMat); base.receiveShadow = true; base.castShadow = true; scene.add(base);
['#6e4429', '#b4502a', '#e8842c'].forEach((h, i) => { const m = new T.MeshStandardMaterial({ color: col(h), roughness: .6 }); const a = new T.Mesh(new T.BoxGeometry(4.4, .08, .03), m); a.position.set(0, -.2 - i * .12, 3.1); const b = a.clone(); b.rotation.y = Math.PI / 2; b.position.set(3.1, -.2 - i * .12, 0); scene.add(a, b); });
const NK = 9, keys = [], keyMeshes = [], ledMats = [], kp = new Float32Array(NK), ledT = new Float32Array(NK).fill(-99), kDist = [];
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
const keyTop = i => new T.Vector3((i % 3 - 1) * SP, .58, (Math.floor(i / 3) - 1) * SP);

/* ================= particles ================= */
const PVS = 'attribute vec4 pcolor; attribute float psize; uniform float uScale; varying vec4 vC; void main(){ vC=pcolor; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize=clamp(psize*uScale,1.0,300.0); }';
const PFS = 'uniform float uSoft; uniform float uFade; uniform float uLin; uniform vec3 uTint; varying vec4 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d)*2.0; if(r>1.0) discard; float a=uSoft>1.5?smoothstep(1.0,.62,r):uSoft>0.5?(1.0-r*r)*(1.0-r*r):pow(1.0-r,1.5); vec3 c=uLin>0.5?pow(vC.rgb,vec3(2.2)):vC.rgb; if(uSoft>1.5) c*=.74+.4*(1.0-gl_PointCoord.y)-.12*r; gl_FragColor=vec4(c*uTint, vC.a*a*uFade); }';
class PSys {
  constructor(max, add) {
    this.max = max; this.n = 0; this.sc = [0, 0]; this.sv = [0, 0]; this.wx = 0; this.wz = 0;
    this.p = new Float32Array(max * 3); this.cl = new Float32Array(max * 4); this.sz = new Float32Array(max); this.v = new Float32Array(max * 3);
    this.age = new Float32Array(max); this.ttl = new Float32Array(max); this.c = new Float32Array(max * 8); this.s = new Float32Array(max * 2); this.f = new Float32Array(max * 4);
    const g = this.g = new T.BufferGeometry();
    this.aP = new T.BufferAttribute(this.p, 3).setUsage(T.DynamicDrawUsage); this.aC = new T.BufferAttribute(this.cl, 4).setUsage(T.DynamicDrawUsage); this.aS = new T.BufferAttribute(this.sz, 1).setUsage(T.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('pcolor', this.aC); g.setAttribute('psize', this.aS); g.setDrawRange(0, 0);
    this.mat = new T.ShaderMaterial({ uniforms: { uScale: { value: 50 }, uSoft: { value: add ? 0 : 1 }, uFade: { value: 1 }, uLin: { value: LIN }, uTint: { value: new T.Color(1, 1, 1) } }, vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending });
    this.pts = new T.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = add ? 4 : 3;
  }
  emit(x, y, z, vx, vy, vz, ttl, c0, c1, s0, s1, g = 0, drag = 0, sw = 0, pw = 1) {
    if (this.n >= this.max) return; const i = this.n++, i3 = i * 3, i4 = i * 4, i8 = i * 8;
    this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z; this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    this.age[i] = 0; this.ttl[i] = ttl; for (let k = 0; k < 4; k++) { this.c[i8 + k] = c0[k]; this.c[i8 + 4 + k] = c1[k]; }
    this.s[i * 2] = s0; this.s[i * 2 + 1] = s1; this.f[i4] = g; this.f[i4 + 1] = drag; this.f[i4 + 2] = sw; this.f[i4 + 3] = pw; this.sz[i] = 0; this.cl[i4 + 3] = 0;
  }
  kill(i) { const j = --this.n; if (i === j) return; const cp = (a, st) => a.copyWithin(i * st, j * st, j * st + st); cp(this.p, 3); cp(this.v, 3); cp(this.cl, 4); cp(this.c, 8); cp(this.s, 2); cp(this.f, 4); this.sz[i] = this.sz[j]; this.age[i] = this.age[j]; this.ttl[i] = this.ttl[j]; }
  update(dt) {
    const { p, v, f, c, cl, sz, s } = this, scx = this.sc[0], scz = this.sc[1], svx = this.sv[0] * dt, svz = this.sv[1] * dt;
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

/* ================= world building ================= */
const S = 6.4, NSEG = 100, DEPTH = 1.05, HOVER = 4.4, WX = -3.2, WZ = -3.2, WS = .8, B0 = .75, B1 = 3.9, E = 8.9, END = 10.4;
const _M = new T.Matrix4(), _Q = new T.Quaternion(), _S = new T.Vector3(), _P = new T.Vector3(), ZERO = new T.Matrix4().makeScale(0, 0, 0);
function inst(geo, mat, n, shadow = true) { const m = new T.InstancedMesh(geo, mat, Math.max(1, n)); m.count = n; m.castShadow = shadow; m.receiveShadow = true; return m; }
function scatter(c, n, test, tries = n * 14) {
  const out = [], m = S / 2 - .14;
  for (let k = 0; k < tries && out.length < n; k++) { const x = rnd(-m, m), z = rnd(-m, m), h = c.hAt(x, z), s = c.slopeAt(x, z); if (c.water != null && h < c.water + .02) continue; if (test(h, s, x, z)) out.push([x, h, z]); }
  return out;
}
function addTrees(c, pts, o = {}) {
  const kind = o.kind || 'cone'; let cg, tg;
  if (kind === 'cone') { cg = new T.ConeGeometry(.075, .28, 7); cg.translate(0, .22, 0); tg = new T.CylinderGeometry(.013, .018, .1, 5); tg.translate(0, .05, 0); }
  else if (kind === 'round') { cg = new T.IcosahedronGeometry(.09, 1); cg.translate(0, .19, 0); tg = new T.CylinderGeometry(.012, .018, .13, 5); tg.translate(0, .065, 0); }
  else { cg = new T.SphereGeometry(.1, 8, 4); cg.scale(1, .3, 1); cg.translate(0, .3, 0); tg = new T.CylinderGeometry(.008, .014, .3, 5); tg.translate(0, .15, 0); }
  const n = pts.length, crown = inst(cg, new T.MeshStandardMaterial({ roughness: .85 }), n), trunk = inst(tg, new T.MeshStandardMaterial({ color: col('#4a3324'), roughness: .9 }), n), tc = new T.Color(); addSway(crown.material, '1.0'); addSway(trunk.material, '0.45');
  pts.forEach(([x, h, z], i) => { const s = rnd(.7, 1.35) * (o.scale || 1); _Q.setFromAxisAngle(UP, rnd(TAU)); _P.set(x, h - .01, z); _S.set(s, s * rnd(.85, 1.3), s); _M.compose(_P, _Q, _S); crown.setMatrixAt(i, _M); trunk.setMatrixAt(i, _M); tc.copy(col(pick(o.colors || ['#2f5a2c', '#3d6b35']))).multiplyScalar(rnd(.8, 1.15)); crown.setColorAt(i, tc); });
  c.group.add(crown, trunk); pts.forEach(p => c.stamp(p[0], p[2], .08, .72));
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
  const V = NSEG + 1, cell = S / NSEG, H = new Float32Array(V * V), n = c.noise;
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) H[j * V + i] = st.height(i / NSEG * 2 - 1, j / NSEG * 2 - 1, n, c);
  c.H = H;
  c.hAt = (x, z) => { const fx = clamp((x / S + .5) * NSEG, 0, NSEG - .001), fz = clamp((z / S + .5) * NSEG, 0, NSEG - .001), i = fx | 0, j = fz | 0, a = fx - i, b = fz - j; return lerp(lerp(H[j * V + i], H[j * V + i + 1], a), lerp(H[(j + 1) * V + i], H[(j + 1) * V + i + 1], a), b); };
  c.slopeAt = (x, z) => { const e = .06; return Math.hypot(c.hAt(x + e, z) - c.hAt(x - e, z), c.hAt(x, z + e) - c.hAt(x, z - e)) / (2 * e); };
  const geo = new T.PlaneGeometry(S, S, NSEG, NSEG); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = new Float32Array(V * V * 3), tmp = new T.Color();
  for (let k = 0; k < V * V; k++) {
    const i = k % V, j = (k / V) | 0, h = H[k]; pos.setY(k, h);
    const hl = H[j * V + Math.max(0, i - 1)], hr = H[j * V + Math.min(NSEG, i + 1)], hu = H[Math.max(0, j - 1) * V + i], hd = H[Math.min(NSEG, j + 1) * V + i];
    const slope = Math.hypot(hr - hl, hd - hu) / (2 * cell), lap = (hl + hr + hu + hd) / 4 - h, u = i / NSEG * 2 - 1, v = j / NSEG * 2 - 1;
    tmp.copy(col(st.color(h, slope, u, v, n, c))); if (c.water != null && Math.abs(h - c.water) < .011) tmp.lerp(col('#f2f3ee'), .7 * (1 - Math.abs(h - c.water) / .011)); tmp.multiplyScalar((.88 + .24 * (n.vn(u * 38, v * 38) * .5 + .5)) * clamp(1 - lap * 7, .7, 1.12));
    colors[k * 3] = tmp.r; colors[k * 3 + 1] = tmp.g; colors[k * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new T.BufferAttribute(colors, 3)); geo.computeVertexNormals(); c.geo = geo; c.baseCol = colors.slice(); c.treeSets = []; c.skyG = new T.Group(); scene.add(c.skyG); c.flyG = new T.Group(); c.skyG.add(c.flyG); c.Cn = new PSys(2600, false); c.Cn.mat.uniforms.uSoft.value = 2; c.skyG.add(c.Cn.pts);
  c.stamp = (x, z, r, f) => { const ca = geo.attributes.color, a = ca.array, bc = c.baseCol, i0 = Math.max(0, Math.floor(((x - r) / S + .5) * NSEG)), i1 = Math.min(NSEG, Math.ceil(((x + r) / S + .5) * NSEG)), j0 = Math.max(0, Math.floor(((z - r) / S + .5) * NSEG)), j1 = Math.min(NSEG, Math.ceil(((z + r) / S + .5) * NSEG));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot(-S / 2 + i * cell - x, -S / 2 + j * cell - z) / r; if (d > 1) continue; const k = (j * V + i) * 3, m = 1 - (1 - f) * (1 - d * d); for (let q = 0; q < 3; q++) a[k + q] = Math.max(bc[k + q] * .5, a[k + q] * m); }
    ca.needsUpdate = true; };
  const tm = new T.MeshStandardMaterial({ vertexColors: true, roughness: .93, shadowSide: T.DoubleSide }); addCloudShadow(tm); const terr = new T.Mesh(geo, tm); terr.castShadow = terr.receiveShadow = true; c.group.add(terr);
  // cut-away sides with strata
  const RW = 40, sp = [], sc = [], sn = [], si = []; let bs = 0;
  const edges = [[a => [a, 0], [0, 0, -1]], [a => [a, NSEG], [0, 0, 1]], [a => [0, a], [-1, 0, 0]], [a => [NSEG, a], [1, 0, 0]]];
  const strata = (st.strata || ['#5a4a3a', '#6a5644', '#4a3c30', '#7a6450']).map(col), soil = col(st.soil || '#3a2a1c'), wTop = col(st.waterTop || '#3a8aa8'), wDeep = col(st.waterDeep || '#0c3040');
  edges.forEach(([get, nr], e) => {
    for (let a = 0; a <= NSEG; a++) {
      const [i, j] = get(a), k = j * V + i, x = -S / 2 + i * cell, z = -S / 2 + j * cell, h = H[k], top = c.water != null ? Math.max(h, c.water) : h;
      for (let r = 0; r <= RW; r++) {
        const y = top - (top + DEPTH) * Math.pow(r / RW, 1.15); sp.push(x, y, z); sn.push(nr[0], nr[1], nr[2]);
        if (y > h + .001) tmp.copy(wTop).lerp(wDeep, clamp((c.water - y) / .9, 0, 1));
        else { const d = h - y; if (d < .035) tmp.setRGB(colors[k * 3], colors[k * 3 + 1], colors[k * 3 + 2]); else if (d < .12) tmp.copy(soil); else tmp.copy(strata[((Math.floor((y + 4 + n.vn(x * 2 + z * 2 + e * 7, y * 3) * .08) / .14) % strata.length) + strata.length) % strata.length]); tmp.multiplyScalar(1 - .38 * (r / RW)); }
        sc.push(tmp.r, tmp.g, tmp.b);
        if (a < NSEG && r < RW) { const p0 = bs + a * (RW + 1) + r, p1 = p0 + RW + 1; si.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1); }
      }
    }
    bs += (NSEG + 1) * (RW + 1);
  });
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); sg.setAttribute('normal', new T.Float32BufferAttribute(sn, 3)); sg.setAttribute('color', new T.Float32BufferAttribute(sc, 3)); sg.setIndex(si);
  const sides = new T.Mesh(sg, new T.MeshStandardMaterial({ vertexColors: true, roughness: .95, side: T.DoubleSide })); sides.castShadow = sides.receiveShadow = true; c.group.add(sides);
  if (c.water != null) {
    const wg = new T.PlaneGeometry(S, S, 64, 64); wg.rotateX(-Math.PI / 2);
    const wm = new T.MeshStandardMaterial({ color: col(st.waterCol || '#2a7a9a'), transparent: true, opacity: .84, roughness: .14, metalness: .02, envMapIntensity: .9 });
    addCloudShadow(wm);
    if (st.waterGlow) { wm.emissive = col(st.waterGlow); wm.emissiveIntensity = .6; }
    c.wmesh = new T.Mesh(wg, wm); c.wmesh.position.y = c.water; c.wmesh.receiveShadow = true; c.wmesh.userData.op = .8; c.group.add(c.wmesh);
  }
  c.P = new PSys(11000, true); c.Sm = new PSys(7000, false); c.G = new PSys(2500, true); c.group.add(c.P.pts, c.Sm.pts, c.G.pts); c.winMats = []; c.spin = c.spinT = 0; c.et = -1;
  c.pl = new T.PointLight(0xff8833, 0, 7, 2); c.group.add(c.pl);
  c.deform = (cx, cz, rad, hf, cf) => {
    const ca = geo.attributes.color, tc = new T.Color();
    for (let k = 0; k < V * V; k++) { const x = pos.getX(k), z = pos.getZ(k), d = Math.hypot(x - cx, z - cz) / rad; if (d > 1.7) continue; H[k] = hf(H[k], d); pos.setY(k, H[k]); const r = cf(d); if (r) { tc.copy(col(r[0])); ca.setXYZ(k, lerp(ca.getX(k), tc.r, r[1]), lerp(ca.getY(k), tc.g, r[1]), lerp(ca.getZ(k), tc.b, r[1])); } }
    pos.needsUpdate = ca.needsUpdate = true; geo.computeVertexNormals();
  };
  st.build(c);
  c.group.position.copy(c.keyPos); c.group.scale.setScalar(.04);
  scene.add(c.group);
  return c;
}
function setFade(c, a) {
  [c.group, c.skyG].forEach(G => G && G.traverse(o => { if (!o.isMesh) return; const m = o.material; if (o.userData.op === undefined) o.userData.op = m.opacity; if (!m.transparent) { m.transparent = true; m.needsUpdate = true; } m.opacity = o.userData.op * a; }));
  c.P.mat.uniforms.uFade.value = a; c.Sm.mat.uniforms.uFade.value = a; if (c.Cn) c.Cn.mat.uniforms.uFade.value = a; if (c.aur) c.aur.forEach(m => m.material.uniforms.uF.value = a); c.G.mat.uniforms.uFade.value = (c.glowGain ?? 0) * a;
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

story({ id: 'eruption', avoid: (c, x, z) => Math.hypot(x, z) < 1.55 || (c.riv || []).some(r => Math.hypot(r.x - x, r.z - z) < .4), preset: { time: 2, clouds: 1, rain: 0, wind: 1, glow: 1, life: 1 }, mood: ['minor', 146.83],
  caption: () => ({ era: pick(['Holocene · 1883 · 10:02', 'Pliocene · 3.2 million years ago', 'Hadean sea · 4.1 billion years ago']), name: pick(['Fire Island', 'The Ember Atoll', 'A Mountain Wakes']), line: pick(['The mountain clears its throat. By nightfall the island is a little larger.', 'Lava meets the sea, and for once the sea steps back.']) }),
  water: .1, waterCol: '#1d5868', waterTop: '#2c7a8a', waterDeep: '#0a2430', strata: ['#3a302b', '#4b3c33', '#2d2623', '#5b473a', '#3f3530'], soil: '#2a2220', waves: true,
  pal: { sky: '#ffae88', ground: '#3a2626', hemiI: .5, sun: '#ff8f5a', sunI: .65, dir: [-6, 5, -4], dim: .5, tint: '#6a3a30' },
  calm: { sky: '#a9bede', ground: '#4a4444', hemiI: .65, sun: '#ffd9b8', sunI: .8, dir: [6, 8, -3], dim: .85 },
  height(u, v, n) { const r = Math.hypot(u, v); let cone = Math.pow(Math.max(0, 1 - r / .8), 1.45) * 1.8; if (r < .11) cone -= (.11 - r) * 5.5; const isl = .45 - r * .55 + n.fbm(u * 2.2 + 3, v * 2.2) * .3; return Math.max(isl - .05, cone + n.fbm(u * 4, v * 4) * .1); },
  color(h, s, u, v, n) { const r = Math.hypot(u, v); if (h < .14) return '#cdb88e'; if (h < .55 && s < .85 && r > .36) return n.vn(u * 9, v * 9) > 0 ? '#4d6a31' : '#5e7b3b'; if (r < .15) return '#5e3022'; return h > 1.15 ? '#2d2725' : (n.vn(u * 14, v * 14) > .3 ? '#4a3e38' : '#3b3431'); },
  build(c) { addTrees(c, scatter(c, 110, (h, s, x, z) => h > .16 && h < .55 && s < .85 && Math.hypot(x, z) > 1.25), { colors: ['#2f5a26', '#3e6b2e', '#4a7a35'] }); c.cy = c.hAt(0, 0) + .04; c.riv = []; c.pl.color.set('#ff7a2a'); c.pl.position.set(0, c.cy + .4, 0); },
  update(c, t, dt) {
    const { P, Sm } = c, on = t > B0 && t < B1 + .5, k = t < B1 ? 1 : clamp(1 - (t - B1) / .5, 0, 1); c.threat = { x: 0, z: 0, r: 3.2, on: t > B0 && t < B1 + 2.5 };
    if (t > B0 && once(c, 'boom')) { sfx.boom(1.2); flash('#ffb070', .45); }
    if (on) {
      for (let i = 0; i < nOf(2700 * k, dt); i++) P.emit(rnd(-.07, .07), c.cy, rnd(-.07, .07), rnd(-.95, .95), rnd(2.4, 4.4), rnd(-.95, .95), rnd(1.2, 2), [1, .93, .65, 1], [.75, .1, .02, 0], .085, .03, -5.4, .25);
      for (let i = 0; i < nOf(300 * k, dt); i++) Sm.emit(rnd(-.1, .1), c.cy + .15, rnd(-.1, .1), rnd(-.18, .18) + .2, rnd(.9, 1.5), rnd(-.18, .18), rnd(4, 6.5), [.22, .19, .19, .8], [.5, .47, .46, 0], .3, 1.25, .04, .35);
      c.shake = Math.max(c.shake, .05 * k); if (R() < dt * 2.5) sfx.thump(); if (R() < dt * 5) sfx.crackle(.7);
    }
    if (!c.userEvent && R() < dt * 6) Sm.emit(rnd(-.06, .06), c.cy + .05, rnd(-.06, .06), rnd(-.03, .03), rnd(.12, .22), rnd(-.03, .03), rnd(5, 8), [.55, .52, .5, .35], [.7, .68, .66, 0], .1, .5, 0, .2);
    if (t > B0 + .25 && once(c, 'rivers')) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + rnd(-.2, .2); c.riv.push({ x: Math.cos(a) * .42, z: Math.sin(a) * .42, live: true }); }
    if (t < B1 + 2) c.riv.forEach(r => { if (!r.live) return; const e = .06, h = c.hAt(r.x, r.z), gx = c.hAt(r.x + e, r.z) - c.hAt(r.x - e, r.z), gz = c.hAt(r.x, r.z + e) - c.hAt(r.x, r.z - e), gl = Math.hypot(gx, gz) || 1; r.x -= (gx / gl + rnd(-.6, .6)) * .5 * dt; r.z -= (gz / gl + rnd(-.6, .6)) * .5 * dt; if (h < c.water + .02) { r.live = false; for (let q = 0; q < 40; q++) Sm.emit(r.x, c.water, r.z, rnd(-.1, .1), rnd(.3, .7), rnd(-.1, .1), rnd(2.5, 4), [.95, .95, .95, .6], [1, 1, 1, 0], .1, .5, 0, .4); } for (let q = 0; q < 2; q++) P.emit(r.x, h + .02, r.z, 0, 0, 0, rnd(4.5, 6.5), [1, .62, .16, 1], [.32, .03, 0, 0], .075, .05, 0, 0, 0, 1.8); });
    c.pl.intensity = on ? 2.6 * k + rnd(0, 1.2) * k : Math.max(0, c.pl.intensity - dt * .8);
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

story({ id: 'festival', preset: { time: 3, clouds: 1, rain: 0, wind: 0, glow: 3, life: 1 }, mood: ['major', 174.61],
  caption: () => ({ era: pick(['Midsummer · 23:58', '31 December · 23:59:59', 'Festival of Lights · night three']), name: pick(['Midsummer Night', 'The Harbour Festival', 'New Year, in Miniature']), line: pick(['The whole village came out for this. Even the cat.', 'Somebody over-ordered the fireworks. Nobody minds.']) }),
  water: .17, waves: true, waterCol: '#1a2a4a', waterTop: '#2a3a5a', waterDeep: '#0a1020', strata: ['#4a3a2c', '#5a4636', '#3a2e24', '#6a5440'], soil: '#2a2018',
  pal: { sky: '#5a6aa8', ground: '#141824', hemiI: .42, sun: '#a8b8ff', sunI: .4, dir: [5, 9, -4], dim: .32, tint: '#2a2a4a' },
  calm: { sky: '#6a7ab0', ground: '#1a1e2a', hemiI: .45, sun: '#c8d0ff', sunI: .45, dir: [4, 9, -5], dim: .38, tint: '#2a2a4a' },
  height(u, v, n) { let h = .32 + n.fbm(u * 1.6 + 9, v * 1.6) * .42 + Math.max(0, -v) * .3; const rv = u - .2 * Math.sin(v * 2.5); return h - Math.exp(-rv * rv / .012) * .3; },
  color(h, s, u, v, n) { if (h < .2) return '#5a5a48'; if (s > .8) return '#3a4030'; return n.vn(u * 7, v * 7) > 0 ? '#2f4a2a' : '#3a5530'; },
  build(c) {
    c.hs = addHouses(c, scatter(c, 55, (h, s, x, z) => h > .22 && h < .75 && s < .4 && Math.abs(x) < 2.6), {});
    c.hs.pts.forEach(([x, h, z]) => c.G.emit(x, h + .06, z, 0, 0, 0, 1e6, [1, .72, .35, .55], [1, .72, .35, .55], .16, .16));
    for (let k = 0; k < 26; k++) { const z = -3 + k * .24, x = .2 * Math.sin(z / 3.2 * 2.5) * 3.2 + (k % 2 ? .34 : -.34), h = c.hAt(x, z); if (h > c.water + .02) c.G.emit(x, h + .12, z, 0, 0, 0, 1e6, [1, .66, .28, .9], [1, .66, .28, .9], .07, .07); }
    addTrees(c, scatter(c, 90, (h, s) => h > .25 && s < .9), { kind: 'cone', colors: ['#1f3a22', '#284a2a'] });
    const m = new T.Mesh(new T.SphereGeometry(.28, 24, 16), new T.MeshBasicMaterial({ color: col('#f4eed8') })); m.position.set(-2.4, 2.8, -2.6); c.group.add(m); c.shells = []; c.next = 0;
  },
  update(c, t, dt) {
    const { P, Sm } = c;
    if (t > B0 && t < B1) { c.next -= dt; if (c.next <= 0) { c.next = rnd(.12, .3); const x = rnd(-1.6, 1.6), z = rnd(-1.6, 1.6); c.shells.push({ x, y: c.hAt(x, z) + .05, z, vx: rnd(-.25, .25), vy: rnd(4, 5), vz: rnd(-.25, .25), h: rnd(360) }); sfx.launch(); } }
    c.shells.forEach(s => {
      s.vy -= 4.2 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; P.emit(s.x, s.y, s.z, rnd(-.05, .05), -.2, rnd(-.05, .05), .4, [1, .85, .6, .9], [1, .5, .2, 0], .035, .01);
      if (s.vy < .35) { s.dead = 1; const [r, g, b] = hsl(s.h / 360, 1, .6), [r2, g2, b2] = hsl(((s.h + rnd(30, 90)) % 360) / 360, 1, .65), kind = pick([0, 1, 2]), n = kind === 1 ? 120 : 200;
        for (let i = 0; i < n; i++) { const th = rnd(TAU), ph = Math.acos(rnd(-1, 1)), sp = kind === 1 ? 1.7 : rnd(.8, 1.9), alt = R() < .3; P.emit(s.x, s.y, s.z, Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp * (kind === 1 ? .25 : 1), Math.sin(ph) * Math.sin(th) * sp, rnd(1.4, 2.3), alt ? [r2, g2, b2, 1] : [r, g, b, 1], [r * .6, g * .4, b * .4, 0], .11, .035, kind === 2 ? -.5 : -1.1, 1, 0, 1.3); }
        for (let i = 0; i < 10; i++) Sm.emit(s.x + rnd(-.2, .2), s.y + rnd(-.2, .2), s.z + rnd(-.2, .2), rnd(-.05, .05) + .06, rnd(-.02, .05), rnd(-.05, .05), rnd(5, 7), [.45, .45, .5, .32], [.5, .5, .55, 0], .25, .9, 0, .4);
        c.pl.position.set(s.x, s.y, s.z); c.pl.color.setRGB(r, g, b); c.pl.intensity = 3.5; flash(`hsl(${s.h | 0},100%,60%)`, .14); sfx.boom(.5); sfx.crackle(.6); }
    });
    c.shells = c.shells.filter(s => !s.dead); c.pl.intensity = Math.max(0, c.pl.intensity - dt * 5);
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

story({ id: 'supercell', preset: { time: 1, clouds: 3, rain: 2, wind: 3, glow: 0, life: 1 }, mood: ['major', 146.83],
  caption: () => ({ era: pick(['Great Plains · June · 17:40', 'Late spring · the warm sector', 'Somewhere flat · 4:52 pm']), name: pick(['Tornado Alley', 'The Afternoon Storm', 'Supercell']), line: pick(['The barn has seen worse. Probably.', 'The wheat bends, the sky growls, and then everything turns gold.']) }),
  water: null, strata: ['#6a5038', '#7d6044', '#5a4430', '#8a6c4c'], soil: '#3a2a1a',
  pal: { sky: '#8a96a2', ground: '#3a3a30', hemiI: .55, sun: '#c8d0d8', sunI: .35, dir: [-4, 10, 3], dim: .55, tint: '#3a4048' },
  calm: { sky: '#ffdcae', ground: '#5a4a30', hemiI: .75, sun: '#ffc489', sunI: 1, dir: [7, 5, 2], dim: .92 },
  height(u, v, n) { return .22 + n.fbm(u * 1.4, v * 1.4) * .14; },
  color(h, s, u, v) { const fu = (u + 1) * 4.5, fv = (v + 1) * 4.5, eu = fu - Math.floor(fu), ev = fv - Math.floor(fv); if (eu < .04 || ev < .04) return '#7a6a4a'; return ['#c9a64a', '#b8963c', '#7a8f3c', '#9aa04a', '#d4b45a'][(Math.floor(fu) * 7 + Math.floor(fv) * 13) % 5]; },
  build(c) {
    addHouses(c, [[.9, c.hAt(.9, .6), .6], [1.12, c.hAt(1.12, .78), .78], [1.3, c.hAt(1.3, .55), .55]], { colors: ['#b4402a', '#e0d6c4'], lit: false });
    addTrees(c, scatter(c, 50, () => R() < .3), { kind: 'round', colors: ['#3a5a2a', '#4a6a30'] });
    c.tw = { x: -2.2, z: -1.4 };
    c.rb = ['#ff4040', '#ff9a30', '#ffe040', '#50d050', '#40a0ff', '#5050e0', '#a050e0'].map((h, i) => { const m = new T.Mesh(new T.TorusGeometry(2.3 - i * .055, .028, 6, 64, Math.PI), new T.MeshBasicMaterial({ color: col(h), transparent: true, opacity: 0, depthWrite: false })); m.position.set(-.7, .25, -.7); m.rotation.y = Math.PI / 4; c.group.add(m); return m; });
  },
  update(c, t, dt) {
    const { P, Sm } = c, inB = t > B0 && t < B1;
    if (once(c, 'bolts')) c.bolts = [B0 + .15, B0 + .9, B0 + 1.5, B0 + 2.4, B1 + .3].map(t => ({ t }));
    if (t > B0 && once(c, 'wind')) { sfx.wind(4); sfx.rain(4); }
    if (inB) {
      const k = (t - B0) / (B1 - B0); c.tw.x = lerp(-2.2, 2.2, k); c.tw.z = lerp(-1.4, 1, k) + Math.sin(t * 2) * .2; Sm.sc[0] = c.tw.x; Sm.sc[1] = c.tw.z; Sm.sv[0] = 4.4 / (B1 - B0); Sm.sv[1] = 2.4 / (B1 - B0);
      const gh = c.hAt(c.tw.x, c.tw.z); c.threat = { x: c.tw.x, z: c.tw.z, r: 1.8, on: true };
      for (let i = 0; i < nOf(650, dt); i++) { const y = rnd(0, 1.9), rr = .05 + .42 * Math.pow(y / 1.9, 1.6), a = rnd(TAU); Sm.emit(c.tw.x + Math.cos(a) * rr, gh + y, c.tw.z + Math.sin(a) * rr, 0, rnd(.3, .7), 0, rnd(.8, 1.3), [.42, .4, .38, .55], [.5, .48, .45, 0], .06 + y * .05, .14 + y * .06, 0, 0, 7, 1.5); }
      for (let i = 0; i < nOf(60, dt); i++) { const a = rnd(TAU), rr = rnd(.1, .4); Sm.emit(c.tw.x + Math.cos(a) * rr, gh + .05, c.tw.z + Math.sin(a) * rr, 0, rnd(.6, 1.4), 0, rnd(.6, 1), [.3, .24, .18, .9], [.3, .24, .18, 0], .03, .03, -1, 0, 9); }
    } else { Sm.sv[0] = Sm.sv[1] = 0; c.threat = null; }
    c.bolts.forEach(b => { if (t >= b.t && !b.done) { b.done = 1; let x = rnd(-2, 2), z = rnd(-2, 2), y = 2.1; const gy = c.hAt(x, z); while (y > gy) { const ny = y - rnd(.08, .2), nx = x + rnd(-.15, .15), nz = z + rnd(-.15, .15); for (let q = 0; q < 6; q++) { const f = q / 6; P.emit(lerp(x, nx, f), lerp(y, ny, f), lerp(z, nz, f), 0, 0, 0, .22, [.9, .95, 1, 1], [.6, .7, 1, 0], .07, .04); } x = nx; y = ny; z = nz; } c.pl.color.set('#c8d8ff'); c.pl.position.set(x, 1.2, z); c.pl.intensity = 6; flash('#e8eeff', .55); sfx.thunder(); c.shake = .1; } });
    c.pl.intensity = Math.max(0, c.pl.intensity - dt * 18);
    if (t > B1 + .4) c.rb.forEach(m => m.material.opacity = Math.min(.42, (t - B1 - .4) * .22) * (c.fadeA ?? 1));
    if (t > B1 + 1 && MOD.life && R() < dt * 2) sfx.chirp();
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
story({ id: 'breach', manualEvent: true, preset: { time: 1, clouds: 1, rain: 0, wind: 1, glow: 2, life: 1 }, mood: ['lydian', 146.83],
  caption: () => ({ era: pick(['Andaman Sea · late afternoon', 'Krabi province · dry season', 'Holocene · 4 m above old sea level']), name: pick(['Phi Phi Lagoon', 'The Limestone Sea', 'Long-tail Hour']), line: pick(['Limestone towers, warm water, and one long-tail boat that will not slow down.', 'Rain dissolved these islands into towers. The sea did the rest.']) }),
  water: .1, waves: true, waterCol: '#1798a0', waterTop: '#4fd3c9', waterDeep: '#0c5a62', strata: ['#d8ccb4', '#c4b498', '#e2d6be', '#b3a284', '#cfc2a8'], soil: '#a89878',
  calm: { sky: '#e8f6ff', ground: '#4a7a70', sun: '#fff1d8' },
  pre(c) { c.karst = [];
    for (let k = 0; k < 2; k++) c.karst.push({ x: rnd(-.55, .55), z: rnd(-.55, .55), r: rnd(.26, .38), H: rnd(1.3, 1.8), big: 1 });
    for (let k = 0; k < 9; k++) c.karst.push({ x: rnd(-.85, .85), z: rnd(-.85, .85), r: rnd(.05, .12), H: rnd(.7, 1.7), big: 0 }); },
  height(u, v, n, c) { let h = -.2 + n.fbm(u * 1.4, v * 1.4) * .14;
    c.karst.forEach((k, q) => { const d = Math.hypot(u - k.x, v - k.z) / k.r + n.vn(u * 7 + q * 3, v * 7) * .28;
      if (k.big && d < 1.35) h = Math.max(h, .17 - (d - 1) * .55);
      if (d < 1) h = Math.max(h, k.H * (1 - Math.pow(d, 9)) * (.85 + .25 * n.fbm(u * 6 + q, v * 6)) + (d < .9 ? n.fbm(u * 10, v * 10) * .12 : 0)); });
    return h; },
  color(h, s, u, v, n) {
    if (s > 1.1) { if (h < .31) return n.vn(u * 30, v * 30) > .3 ? '#2f2c29' : '#45403a';
      const streak = n.vn(u * 46 + v * 21, h * 1.1), stain = n.vn(u * 8 + 3, v * 8 + h * 1.5);
      if (streak > .45) return '#34312e'; if (streak > .28) return '#6f6b65';
      if (stain > .3) return stain > .55 ? '#a86a3c' : '#c4925e';
      return n.vn(u * 14, v * 14 + h) > 0 ? '#d2ccbf' : '#bdb6a8'; }
    if (s > .75 && h > .4) return n.vn(u * 20, v * 20) > 0 ? '#4d6b33' : '#8a8676';
    if (h > .45) return n.vn(u * 9, v * 9) > .2 ? '#22421d' : (n.vn(u * 17, v * 17) > 0 ? '#2d5325' : '#3a6230');
    if (h > .08) return '#efe1bf'; return h > -.06 ? '#d8ccae' : '#6fa8a0'; },
  build(c) {
    addTrees(c, scatter(c, 220, (h, s) => h > .5 && s < 1.15), { kind: 'round', colors: ['#2a5226', '#356030', '#2f5a2a'] });
    addTrees(c, scatter(c, 40, (h, s) => h > .33 && h < .5 && s < .7), { kind: 'palm', colors: ['#3a6a2a', '#4a7a30'] });
    c.baseWater = c.water;
    const sm = new T.MeshStandardMaterial({ color: col('#2fb5b0'), transparent: true, opacity: .55, roughness: .1, side: T.DoubleSide, depthWrite: false });
    c.skirt = [0, 1, 2, 3].map(q => { const m = new T.Mesh(new T.PlaneGeometry(S + .01, 1), sm), r = q * Math.PI / 2; m.rotation.y = r; m.position.set(Math.sin(r) * (S / 2 + .005), 0, Math.cos(r) * (S / 2 + .005)); m.visible = false; c.group.add(m); return m; });
    c.sun = mesh(new T.SphereGeometry(.42, 28, 18), new T.MeshBasicMaterial({ color: new T.Color(4, 2.2, 1) }), c.skyG, -3.9, 2.4, -3.1); c.sun.castShadow = false;
    const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: new T.Color(2.2, 1.3, .6), transparent: true, depthWrite: false, blending: T.AdditiveBlending })); halo.scale.set(3.4, 3.4, 1); c.sun.add(halo); c.halo = halo;
    c.moon = mesh(new T.SphereGeometry(.24, 24, 16), new T.MeshBasicMaterial({ color: new T.Color(2.2, 2.2, 2.5) }), c.skyG, -2.2, 2.4, -4.6); c.moon.castShadow = false;
  },
  update(c, t, dt) {
    if (c.userEvent && t > B0 - .1 && once(c, 'phi')) { c.evT = 0; c.envT = 0; c.water = c.baseWater; MOD.time = 1; drawDecal(0); noise(9, { filter: 'lowpass', ff: 420, vol: .025, attack: 3 }); }
    if (c.evT !== undefined && c.evT < 16) { c.evT += dt; const e = c.evT, ks = clamp(e / 8, 0, 1), km = clamp((e - 7.5) / 6, 0, 1), P = duskPal(e);
      palT = resolvePal(P); palRate = 3; c.envT -= dt; if (c.envT <= 0) { c.envT = .5; setEnv(P); }
      c.skyOn = true; const BU = backdrop.material.uniforms; BU.uTop.value.copy(col(P.top)); BU.uMid.value.copy(col(P.mid)).multiplyScalar(.7 + .3 * P.horI); BU.uHor.value.copy(col(P.hor)).multiplyScalar(P.horI);
      fxBoost = Math.max(fxBoost, clamp(1 - Math.abs(e - 6.5) / 4.5, 0, 1)); c.halo.material.color.setRGB(2.2 + fxBoost, lerp(1.4, .55, ks), lerp(.7, .2, ks));
      if (e > 3 && once(c, 'dusk')) { MOD.time = 2; drawDecal(0); pad(220, 'lydian'); }
      if (e > 9.5 && once(c, 'night')) { MOD.time = 3; drawDecal(0); sfx.shimmer(); }
      c.sun.visible = ks < 1; c.sun.position.y = 2.6 - 3 * Math.pow(ks, 1.6); c.halo.visible = true; c.sun.material.color.setRGB(4, lerp(2.6, .7, ks), lerp(1.2, .2, ks));
      c.moon.visible = km > 0; c.moon.position.y = lerp(-.9, 2.5, easeOut(km));
      c.water = lerp(c.baseWater, c.baseWater + .2, easeInOut(clamp(e / 13, 0, 1)));
      if (ks > .1 && ks < .97) for (let i = 0; i < nOf(70, dt); i++) { const f = R(); c.P.emit(lerp(-3, 1.2, f) + rnd(-.3, .3), c.water + .012, lerp(-2.6, 1.6, f) + rnd(-.3, .3), 0, 0, 0, rnd(.25, .55), [2.2, lerp(1.6, .8, ks), lerp(.8, .3, ks), 1], [1.5, .6, .2, 0], .035, .02); }
      if (km > .3) for (let i = 0; i < nOf(30, dt); i++) { const f = R(); c.P.emit(lerp(-1.4, 2.4, f) + rnd(-.2, .2), c.water + .01, lerp(-3, .8, f) + rnd(-.2, .2), 0, 0, 0, rnd(.3, .6), [.8, .85, 1, .7], [.7, .8, 1, 0], .025, .02); }
    } else if (c.evT === undefined) { c.skyOn = false; c.halo.visible = false; c.sun.material.color.setRGB(2.2, 2, 1.7); c.sun.visible = MOD.time !== 3; c.sun.position.y = MOD.time === 1 ? 2.4 : .9; c.moon.visible = MOD.time === 3; c.moon.position.y = 2.4; }
    c.wmesh.position.y = c.water; const hg = Math.max(.001, c.water - c.baseWater); c.skirt.forEach(m => { m.scale.y = hg; m.position.y = c.baseWater + hg / 2; m.visible = hg > .003; });
  } });

const AVS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const AFS = 'varying vec2 vUv; uniform float uTime,uA,uF,uSeed; void main(){ float y=vUv.y; float rays=0.55+0.45*sin(vUv.x*60.0+uTime*2.0+uSeed)*sin(vUv.x*23.0-uTime*1.3+uSeed); float a=pow(1.0-y,1.8)*smoothstep(0.0,0.06,y)*rays*uA*uF; vec3 c=mix(vec3(0.25,1.0,0.6),vec3(0.85,0.3,0.9),smoothstep(0.35,1.0,y)); gl_FragColor=vec4(c,a); }';
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

story({ id: 'neon', preset: { time: 3, clouds: 2, rain: 1, wind: 1, glow: 3, life: 1 }, mood: ['minor', 110],
  caption: () => ({ era: pick(['2187 · 03:00 · rain later', 'Sector 9 · shift change', 'Year 2311 · power restored']), name: pick(['Megacity, 2187', 'Night Shift', 'Grid Wake']), line: pick(['At three in the morning the city flips every switch it owns.', 'Ten million windows, one blackout ending.']) }),
  water: .1, waterCol: '#14102a', waterTop: '#1a1430', waterDeep: '#06040e', strata: ['#3a3a40', '#2a2a30', '#4a4a52', '#202026'], soil: '#2a2a2e',
  pal: { sky: '#5a4a9a', ground: '#100c18', hemiI: .32, sun: '#8a7aff', sunI: .25, dir: [5, 9, -4], dim: .26, tint: '#2a1a44' },
  calm: { sky: '#ffc8a8', ground: '#3a3040', hemiI: .62, sun: '#ffb282', sunI: .85, dir: [7, 4, -2], dim: .78 },
  height(u, v, n) { return Math.abs(v - .12) < .06 ? .02 : .2 + n.fbm(u * 3, v * 3) * .01; },
  color(h, s, u, v) { if (h < .1) return '#202028'; const fu = (u + 1) * 5.5, fv = (v + 1) * 5.5; return (fu - Math.floor(fu) < .16 || fv - Math.floor(fv) < .16) ? '#24252b' : '#3a3b42'; },
  build(c) {
    const bl = [];
    for (let a = 0; a < 11; a++) for (let b = 0; b < 11; b++) { const uc = (a + .58) / 5.5 - 1, vc = (b + .58) / 5.5 - 1; if (Math.abs(vc - .12) < .16) continue; const d = Math.hypot(uc, vc), cx = uc * 3.2, cz = vc * 3.2, sub = R() < .4 ? 2 : 1, w = .46 / sub;
      for (let i = 0; i < sub; i++) for (let j = 0; j < sub; j++) bl.push({ x: cx + (i - (sub - 1) / 2) * w, z: cz + (j - (sub - 1) / 2) * w, w: w * .86, h: clamp(rnd(.12, .45) + (1.2 - d) * rnd(.3, 1.5), .1, 2.1), d }); }
    const bg = new T.BoxGeometry(1, 1, 1); bg.translate(0, .5, 0);
    const bm = inst(bg, new T.MeshStandardMaterial({ roughness: .55, metalness: .3 }), bl.length), cap = inst(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), bl.length, false), strip = inst(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), bl.length, false), tc = new T.Color();
    c.lit = bl.map((o, i) => { _Q.identity(); _P.set(o.x, .2, o.z); _S.set(o.w, o.h, o.w); _M.compose(_P, _Q, _S); bm.setMatrixAt(i, _M); bm.setColorAt(i, tc.copy(col(pick(['#3a3e48', '#2e323a', '#454a56'])))); _P.set(o.x, .2 + o.h + .012, o.z); _S.set(o.w * .92, .024, o.w * .92); _M.compose(_P, _Q, _S); cap.setMatrixAt(i, _M); const hasStrip = R() < .45; _P.set(o.x + o.w / 2, .2 + o.h / 2, o.z + o.w / 2); _S.set(.018, hasStrip ? o.h * .9 : 0, .018); _M.compose(_P, _Q, _S); strip.setMatrixAt(i, _M); const base = col(pick(['#ff3aa8', '#3af0ff', '#ffb02a', '#9a5aff', '#3aff9a'])).clone(); cap.setColorAt(i, tc.setRGB(0, 0, 0)); strip.setColorAt(i, tc); return { base, on: B0 + o.d * .35 + rnd(0, .25) }; });
    c.group.add(bm, cap, strip); c.cap = cap; c.strip = strip;
    c.cars = Array.from({ length: 46 }, () => { const ax = R() < .5, line = (Math.floor(rnd(0, 11)) + .08) / 5.5 - 1; return { ax, line: line * 3.2, p: rnd(-3.2, 3.2), v: rnd(1.4, 2.6) * (R() < .5 ? 1 : -1), c: R() < .5 ? [1, .25, .2, 1] : [1, .95, .85, 1] }; }).filter(o => o.ax || Math.abs(o.line / 3.2 - .12) > .1);
    c.sl = [0, 1, 2].map(i => { const g = new T.ConeGeometry(.25, 2.6, 24, 1, true); g.translate(0, -1.3, 0); g.rotateX(Math.PI); const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: col('#bfd8ff'), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); m.position.set(rnd(-2, 2), .25, rnd(-2, 2)); c.group.add(m); return m; });
    const cg = new T.BoxGeometry(.1, .03, .05); cg.translate(0, .03, 0); const kg = new T.BoxGeometry(.05, .025, .044); kg.translate(-.005, .057, 0); 
    c.carB = inst(cg, new T.MeshStandardMaterial({ roughness: .25, metalness: .6 }), c.cars.length); c.carK = inst(kg, new T.MeshStandardMaterial({ color: col('#1a1c22'), roughness: .1, metalness: .3 }), c.cars.length);
    const ctc = new T.Color(); c.cars.forEach((o, i) => { c.carB.setColorAt(i, ctc.copy(col(pick(['#c8ccd2', '#2a2d33', '#b4302a', '#e8e4dc', '#2a4a8a', '#d9a02a'])))); }); c.group.add(c.carB, c.carK);
    for (let a = 0; a < 11; a++) for (let b = 0; b < 11; b++) { if (R() < .55) continue; const x = ((a + .08) / 5.5 - 1) * 3.2 + .06, z = ((b + .58) / 5.5 - 1) * 3.2; if (Math.abs(z / 3.2 - .12) < .1) continue; c.G.emit(x, .3, z, 0, 0, 0, 1e6, [1, .62, .25, .85], [1, .62, .25, .85], .06, .06); }
    c.na = 0; c.ai = 0;
  },
  update(c, t, dt) {
    const tc = new T.Color(), fade = .08 + .92 * (c.glowGain ?? 1);
    if (t > B0 - .1) { c.lit.forEach((l, i) => { const e = t - l.on; let b = !c.userEvent ? 1 : e < 0 ? 0 : e < .25 ? (R() < .5 ? 1 : .15) : 1; b *= fade; tc.copy(l.base).multiplyScalar(b * 2.6); c.cap.setColorAt(i, tc); c.strip.setColorAt(i, tc); }); c.cap.instanceColor.needsUpdate = c.strip.instanceColor.needsUpdate = true; }
    const sp = [0, .3, .55, .85][MOD.life], nAct = Math.floor(c.cars.length * [0, .3, .65, 1][MOD.life]);
    c.cars.forEach((o, i) => { if (i >= nAct) { c.carB.setMatrixAt(i, ZERO); c.carK.setMatrixAt(i, ZERO); return; } o.p += o.v * dt * sp; if (o.p > 3.15) o.p = -3.15; if (o.p < -3.15) o.p = 3.15; const lane = o.v > 0 ? .022 : -.022, x = o.ax ? o.p : o.line + lane, z = o.ax ? o.line + lane : o.p, dir = Math.sign(o.v), yaw = o.ax ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      _Q.setFromAxisAngle(UP, yaw); _P.set(x, .2, z); _S.set(1, 1, 1); _M.compose(_P, _Q, _S); c.carB.setMatrixAt(i, _M); c.carK.setMatrixAt(i, _M);
      const fx = (o.ax ? dir : 0) * .055, fz = (o.ax ? 0 : dir) * .055, la = .3 + .7 * fade;
      c.P.emit(x + fx, .235, z + fz, fx * 3, 0, fz * 3, .12, [1, .97, .88, la], [1, .95, .85, 0], .07, .1); c.P.emit(x - fx, .235, z - fz, 0, 0, 0, .25, [1, .15, .1, la * .9], [1, .1, .1, 0], .045, .03); });
    c.carB.instanceMatrix.needsUpdate = c.carK.instanceMatrix.needsUpdate = true;
    c.sl.forEach((m, i) => { m.material.opacity = (t > B0 && t < B1 + 1 ? .12 : 0) * (c.fadeA ?? 1); m.rotation.x = Math.sin(t * .9 + i * 2) * .5; m.rotation.z = Math.cos(t * .7 + i) * .5; });
    if (t > B0 && t < B1) { c.na -= dt; if (c.na <= 0) { c.na = .115; const sc = [0, 3, 7, 10, 12, 15, 19, 22]; tone(110 * Math.pow(2, (sc[c.ai % 8] + 12) / 12), .18, { type: 'sawtooth', vol: .03, filter: 'lowpass', ff: 1200 + 800 * Math.sin(t * 3) }); if (c.ai % 4 === 0) sfx.kick(); c.ai++; } }
    if (t > B0 && once(c, 'fl')) flash('#c070ff', .3);
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
  if (c.cl !== lvl) { if (!gale && (lvl > Math.max(0, c.cl ?? 0) || c.cl === -1)) for (let k = 0; k < [0, 3, 6, 9][lvl]; k++) cumulus(c.Sm, rnd(-2.9, 2.9), rnd(1.9, 2.2), rnd(-2.9, 2.9), rnd(.45, .75), cshade, rnd(8, 12)); c.cl = lvl; }
  c.ca = (c.ca || 0) + [0, .25, .6, 1][lvl] * (gale ? .08 : 1) * dt;
  while (c.ca >= 1) { c.ca--; cumulus(c.Sm, rnd(-2.9, 2.9) - Wv * 5, rnd(1.9, 2.2), rnd(-2.9, 2.9), rnd(.45, .75), cshade, 11); }
  const cv = [.02, .06, .2, 1.1][MOD.wind]; c.Cn.wx = cv * .707; c.Cn.wz = -cv * .707;
  const nearN = gale ? 0 : [0, 2, 3, 4][lvl], spawnNear = s0 => { const d = rnd(1.6, 3), y = rnd(3.1, 3.9); cumulus(c.Cn, d + .707 * s0, y, d - .707 * s0, rnd(1.1, 1.6), cshade, 34); };
  if (c.cnl !== lvl) { if (nearN && lvl > Math.max(0, c.cnl ?? 0)) for (let k = 0; k < nearN; k++) spawnNear(rnd(-4, 4)); c.cnl = lvl; }
  c.cna = (c.cna || 0) + nearN / 34 * dt; while (c.cna >= 1) { c.cna--; spawnNear(-5.5 + rnd(0, 1.5)); }
  c.Cn.mat.uniforms.uTint.value.copy(c.Sm.mat.uniforms.uTint.value);
  for (let i = 0; i < nOf([0, 300, 1000, 2200][MOD.rain], dt); i++) c.Sm.emit(rnd(-3.1, 3.1) - Wv * .5, 2.05, rnd(-3.1, 3.1), Wv * 1.4, -5.5, 0, .42, [.74, .8, .92, .5], [.74, .8, .92, .35], .022, .022);
  const nb = [0, 3, 7, 12][MOD.life], bx = 1.6 * Math.sin(clock * .23), bz = 1.4 * Math.cos(clock * .31), by = 1.35 + .2 * Math.sin(clock * .5);
  for (let b = 0; b < nb; b++) { const ph = b * 2.39, r = .25 + .18 * Math.sin(b * 1.7); c.Sm.emit(bx + Math.cos(clock * 1.3 + ph) * r, by + Math.sin(clock * 2.1 + ph) * .08, bz + Math.sin(clock * 1.1 + ph) * r * .8, 0, 0, 0, .05, [.14, .12, .12, .9], [.14, .12, .12, .9], .028, .028); }
  c.Sm.mat.uniforms.uTint.value.setRGB(1, 1, 1).lerp(pal.sky, .5).multiplyScalar(.12 + .88 * Math.pow(pal.dimv ?? 1, 1.4));
  c.glowGain = MOD.glow / 3 * (.3 + .7 * NIGHT[MOD.time]); if (c.wmesh) { c.nightK = lerp(c.nightK ?? NIGHT[MOD.time], NIGHT[MOD.time], 1 - Math.exp(-dt * .8)); c.wmesh.material.color.copy(col(c.st.waterCol || '#2a7a9a')).lerp(col('#0b1620'), Math.min(1, c.nightK * 1.15) * .88); c.wmesh.material.envMapIntensity = .9 - .55 * c.nightK; if (c.skirt) c.skirt[0].material.color.copy(c.wmesh.material.color); }
  c.G.mat.uniforms.uFade.value = c.glowGain * (c.fadeA ?? 1);
  c.winMats.forEach(m => m.color.copy(col('#22252c')).lerp(col('#ffcc77'), c.glowGain));
  c.waveAmp = [.35, 1, 1.9, 3][MOD.wind]; c.waveA = lerp(c.waveA ?? WAMP[MOD.wind], WAMP[MOD.wind], 1 - Math.exp(-dt * 1.2)); c.Sm.wx = [0, .06, .2, .9][MOD.wind];
  TREE_U.uTime.value = clock; TREE_U.uWind.value = lerp(TREE_U.uWind.value, [.03, .1, .24, .46][MOD.wind], 1 - Math.exp(-dt * 2));
  CLOUD_U.uCT.value = clock; CLOUD_U.uCov.value = lerp(CLOUD_U.uCov.value, [0, .3, .55, .78][MOD.clouds] * (MOD.wind === 3 ? .15 : 1), 1 - Math.exp(-dt * .8)); CLOUD_U.uCWind.value = .08 + Wv * .9;
  for (let i = 0; i < nOf([0, 0, 3, 8][MOD.wind], dt); i++) { const x = rnd(-3.4, 1.4), y = rnd(.35, 1.9), z = rnd(-3, 3), v = Wv * 3 + .3; for (let q = 0; q < 7; q++) c.Sm.emit(x - q * .05, y + Math.sin(q * .7) * .012, z, v, 0, 0, rnd(.7, 1.1), [1, 1, 1, .26], [1, 1, 1, .26], .018, .012, 0, 0, 0, -1); }
  if (c.wmesh) for (let i = 0; i < nOf([0, 0, 22, 60][MOD.wind], dt); i++) { const x = rnd(-3.1, 3.1), z = rnd(-3.1, 3.1); if (c.hAt(x, z) > c.water - .03) continue; const wy = waveY(c, x, z); if (wy < (c.waveA ?? .03) * .25) continue; c.Sm.emit(x, c.water + wy + .008, z, Wv * .6 + rnd(-.05, .05), rnd(.02, .12), rnd(-.05, .05), rnd(.4, .9), [1, 1, 1, .9], [1, 1, 1, 0], .02, .05, -.3, .4); }
  life(c, dt);
}
function ambientSound(dt) {
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
const LAND = c => (h, s) => h > (c.water ?? -9) + .04 && s < 1.1;
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
  sauropod(c, n) {
    for (let k = 0; k < n; k++) {
      const g = new T.Group(), top = pick(['#5d6a44', '#6a5e44', '#566650']);
      const bg = lathe([[0, -.21], [.06, -.19], [.1, -.11], [.118, -.02], [.112, .08], [.085, .16], [.05, .2], [0, .215]], 22); bg.scale(1, .92, .8);
      const skin = new T.MeshStandardMaterial({ color: col(top), roughness: .9 });
      mesh(bg, shadeMat(bg, top, '#b8a882', .9), g, 0, .33, 0);
      const nb = [.85, .08, .05, .03, .02, 0, -.05, -.1, -.15], neck = chain(g, skin, 9, .055, .05, .022, .17, .36, 0); neck.forEach((j, i) => { j.rotation.z = nb[i]; });
      const hg = lathe([[0, -.035], [.02, -.03], [.026, -.005], [.02, .025], [.008, .04], [0, .045]], 12), head = new T.Group(); head.position.x = .055; head.rotation.z = -.62; neck[8].add(head); mesh(hg, skin, head, .03, 0, 0);
      [-1, 1].forEach(sd => mesh(new T.SphereGeometry(.0045, 6, 4), mat('#111', .3), head, .035, .012, sd * .017));
      const tail = chain(g, skin, 12, .05, .055, .008, -.19, .34, 0); tail[0].rotation.set(0, Math.PI, -.35); tail.forEach((j, i) => { if (i) j.rotation.z = .025; });
      const L = [[.11, .06], [.11, -.06], [-.11, .06], [-.11, -.06]].map(([x, z]) => leg2(g, skin, x, z, .27, .14, .115, .036));
      blob(g, .62, .34, .45); const sc = rnd(1.1, 1.5); g.scale.setScalar(sc); g.rotation.order = 'YZX'; c.lifeG.add(g);
      const p = spawnPt(c, LAND(c)), a = walker(p[0], p[1], .09, LAND(c));
      a.update = dt => { steer(c, a, dt); const pp = a.ph; a.ph += dt * 2.1 * (a.fleeing ? 2.1 : 1); gait(L, a.ph, a.fleeing ? .42 : .28);
        g.position.set(a.x, c.hAt(a.x, a.z) + Math.abs(Math.sin(a.ph)) * .006, a.z); g.rotation.set(Math.sin(a.ph) * .015, -a.dir, slopePitch(c, a.x, a.z, a.dir, .16 * sc));
        if (Math.floor(pp / Math.PI) !== Math.floor(a.ph / Math.PI)) { const sd = Math.floor(a.ph / Math.PI) % 2 ? 1 : -1; footfall(c, a.x, a.z, a.dir, sd, .11 * sc, .06 * sc, .035 * sc, a.fleeing ? 14 : 7); footfall(c, a.x, a.z, a.dir, -sd, -.11 * sc, .06 * sc, .035 * sc, 4); }
        c.treeSets.forEach(ts => ts.pts.forEach((p, i) => { if (Math.abs(p[0] - a.x) < .2 * sc && Math.abs(p[2] - a.z) < .2 * sc && Math.hypot(p[0] - a.x, p[2] - a.z) < .17 * sc) ts.knock(i, a.dir); }));
        neck.forEach((j, i) => { j.rotation.z = nb[i] + Math.sin(a.ph * .5 - i * .35) * .025; }); neck[0].rotation.y = Math.sin(a.ph * .2 + a.seed) * .25;
        tail.forEach((j, i) => { j.rotation.y = (i ? 0 : Math.PI) + Math.sin(a.ph * .5 - i * .45) * .07; });
        if (k === 0 && Math.floor(pp / Math.PI) !== Math.floor(a.ph / Math.PI)) tone(46, .3, { vol: .025 }); };
      c.actors.push(a);
    }
  },
  elephants(c, n) {
    const p = spawnPt(c, LAND(c)), lead = walker(p[0], p[1], .13, LAND(c)), mem = [];
    const skin = new T.MeshStandardMaterial({ color: col('#7f7a75'), roughness: .95 }), ivory = mat('#efe6d2', .45), eye = mat('#111', .3), tuft = mat('#2a2622', .9);
    const earM = new T.MeshStandardMaterial({ color: col('#77716b'), roughness: .95, side: T.DoubleSide });
    const es = new T.Shape(); es.moveTo(0, .01); es.bezierCurveTo(-.03, .065, -.1, .07, -.11, .0); es.bezierCurveTo(-.1, -.075, -.04, -.095, 0, -.04); es.lineTo(0, .01);
    for (let k = 0; k < n; k++) {
      const g = new T.Group(), bg = lathe([[0, -.13], [.055, -.125], [.08, -.095], [.088, -.03], [.087, .04], [.078, .09], [.05, .115], [0, .125]], 20); bg.scale(1, .95, .82);
      mesh(bg, shadeMat(bg, '#8d8984', '#635e59', .95), g, 0, .21, 0);
      const hg = new T.SphereGeometry(.058, 16, 12); hg.scale(1, 1.1, .9); mesh(hg, skin, g, .135, .25, 0); mesh(new T.SphereGeometry(.04, 12, 8), skin, g, .15, .29, 0);
      [-1, 1].forEach(sd => mesh(new T.SphereGeometry(.006, 6, 4), eye, g, .178, .262, sd * .041));
      const ears = [-1, 1].map(sd => { const e = new T.Group(); e.position.set(.12, .27, sd * .05); g.add(e); mesh(new T.ShapeGeometry(es, 10), earM, e); return e; });
      const trunk = chain(g, skin, 6, .028, .02, .008, .17, .24, 0); trunk[0].rotation.z = -1.35; trunk.forEach((j, i) => { if (i) j.rotation.z = .1; });
      [-1, 1].forEach(sd => mesh(tube([[0, 0, 0], [.02, -.02, 0], [.045, -.015, 0], [.06, .006, 0]], .005), ivory, g, .16, .225, sd * .026));
      const L = [[.065, .045], [.065, -.045], [-.065, .045], [-.065, -.045]].map(([x, z]) => leg2(g, skin, x, z, .17, .085, .074, .025));
      const tail = chain(g, skin, 3, .025, .006, .004, -.125, .22, 0); tail[0].rotation.set(0, Math.PI, -1.1); mesh(new T.SphereGeometry(.008, 6, 4), tuft, tail[2], .025, 0, 0);
      blob(g, .36, .24, .45); const sc = (k === 0 ? 1.15 : rnd(.7, 1)) * 1.6; g.scale.setScalar(sc); g.rotation.order = 'YZX'; c.lifeG.add(g);
      mem.push({ g, sc, ears, trunk, L, tail, ph: rnd(TAU), off: k === 0 ? [0, 0] : [-(.36 + Math.floor((k - 1) / 2) * .34), (k % 2 ? .21 : -.21) * rnd(.7, 1.3)] });
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
    const PALS = [['#d92b2b', '#f2c230'], ['#1f5fb4', '#f4f1ea'], ['#e8742c', '#f4e3b0', '#2f8a5a'], ['#7a2a8a', '#f2c230'], ['#c23b4a', '#f4f1ea', '#1f5fb4'], ['#2f9a8a', '#f2e06a']];
    for (let k = 0; k < n; k++) {
      const g = new T.Group(), sg = lathe(prof, 32, true), ps = sg.attributes.position, cols = [], t = new T.Color(), pal = pick(PALS), style = pick(['gores', 'gores', 'bands', 'mix', 'rainbow']);
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
      const p = spawnPt(c, ok), a = walker(p[0], p[1], .2, ok); a.putt = 0;
      a.update = dt => { a.sp = .07 + .05 * (Math.sin(clock * .15 + a.seed) * .5 + .5); steer(c, a, dt); const w = c.waveAmp ?? 1, y = c.water + .004 + waveY(c, a.x, a.z), cs = Math.cos(a.dir), sn = Math.sin(a.dir);
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
    for (let i = 0; i < n; i++) { body.setColorAt(i, tc.copy(col(pick(['#b4302a', '#2a4a8a', '#e8c040', '#2a2d33', '#efe9dc', '#3a7a4a', '#8a3a8a', '#d9784a'])))); const lc = col(pick(['#23262c', '#2a3a5a', '#5a4a3a', '#1a1a1a'])); legA.setColorAt(i, lc); legB.setColorAt(i, lc); head.setColorAt(i, tc.copy(col(pick(['#e8c0a0', '#c89070', '#8a5a3a', '#5a3a2a'])))); }
    c.lifeG.add(body, head, legA, legB);
    const city = c.st.id === 'neon', ok = LAND(c), Q = [], loc = new T.Matrix4(), rz = new T.Matrix4(), base = new T.Matrix4();
    for (let i = 0; i < n; i++) { if (city) { const ax = R() < .5, line = ((Math.floor(rnd(0, 11)) + .08) / 5.5 - 1) * 3.2 + (R() < .5 ? .075 : -.075); Q.push({ ax, line, p: rnd(-3.1, 3.1), v: rnd(.12, .25) * (R() < .5 ? 1 : -1), ph: rnd(TAU) }); } else { const p = spawnPt(c, ok); Q.push({ x: p[0], z: p[1], dir: rnd(TAU), v: rnd(.06, .12), ph: rnd(TAU) }); } }
    c.actors.push({ update(dt) { const rush = [0, .6, .85, 1.3][MOD.life];
      Q.forEach((q, i) => { q.ph += dt * 13 * rush; let x, z, yaw, hide = false;
        if (city) { q.p += q.v * dt * rush; if (q.p > 3.1) q.p = -3.1; if (q.p < -3.1) q.p = 3.1; x = q.ax ? q.p : q.line; z = q.ax ? q.line : q.p; yaw = q.ax ? (q.v > 0 ? 0 : Math.PI) : (q.v > 0 ? -Math.PI / 2 : Math.PI / 2); hide = Math.abs(z / 3.2 - .12) < .08; }
        else { q.dir += rnd(-1.5, 1.5) * dt; const nx = q.x + Math.cos(q.dir) * q.v * dt, nz = q.z + Math.sin(q.dir) * q.v * dt; if (Math.abs(nx) < 3 && Math.abs(nz) < 3 && ok(c.hAt(nx, nz), c.slopeAt(nx, nz))) { q.x = nx; q.z = nz; } else q.dir += Math.PI * .5; x = q.x; z = q.z; yaw = -q.dir; }
        if (hide) { body.setMatrixAt(i, ZERO); head.setMatrixAt(i, ZERO); legA.setMatrixAt(i, ZERO); legB.setMatrixAt(i, ZERO); return; }
        _P.set(x, (city ? .2 : c.hAt(x, z)) + Math.abs(Math.sin(q.ph)) * .004, z); _Q.setFromAxisAngle(UP, yaw); _S.set(1, 1, 1); base.compose(_P, _Q, _S); body.setMatrixAt(i, base); head.setMatrixAt(i, base);
        const sw = Math.sin(q.ph) * .55; loc.makeTranslation(0, .027, .0042); rz.makeRotationZ(sw); legA.setMatrixAt(i, _M.copy(base).multiply(loc).multiply(rz)); loc.makeTranslation(0, .027, -.0042); rz.makeRotationZ(-sw); legB.setMatrixAt(i, _M.copy(base).multiply(loc).multiply(rz)); });
      body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = legA.instanceMatrix.needsUpdate = legB.instanceMatrix.needsUpdate = true; } });
  }
};

const LIFE_SPEC = {
  eruption: [['sauropod', [0, 1, 2, 4]], ['ship', [0, 0, 1, 1]], ['balloon', [0, 1, 2, 4]]],
  festival: [['people', [0, 15, 35, 70]], ['balloon', [0, 2, 4, 7]]],
  supercell: [['elephants', [0, 3, 5, 9]], ['plane', [0, 1, 1, 2]], ['balloon', [0, 0, 1, 2]]],
  breach: [['longtail', [0, 2, 3, 5]], ['ship', [0, 0, 1, 1]], ['balloon', [0, 1, 3, 5]], ['plane', [0, 0, 1, 1]]],
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
const KEEP = ['eruption', 'festival', 'supercell', 'breach', 'neon'];
for (let i = STORIES.length - 1; i >= 0; i--) if (!KEEP.includes(STORIES[i].id)) STORIES.splice(i, 1);
let world = null; const dying = []; let lastIds = [];
let count = store.get('k81-worlds', 0);
const plaque = $('#plaque');
function showPlaque(cap) { $('#era').textContent = cap.era; $('#title').textContent = cap.name; $('#line').textContent = cap.line; plaque.classList.add('show'); }
function updCount() { $('#count').textContent = String(count % 10000).padStart(4, '0'); }
function pickStory() { const pool = STORIES.filter(s => !lastIds.includes(s.id)); if (!pool.length) pool.push(pick(STORIES)); const s = pick(pool); lastIds.push(s.id); if (lastIds.length > 2) lastIds.shift(); return s; }
function newWorld() {
  for (let j = 0; j < NK; j++) ledT[j] = clock + kDist[j] * .09;
  if (world) { world.dieT = 0; world.p0 = world.group.position.clone(); world.s0 = world.s; dying.push(world); }
  const st = pickStory();
  Object.assign(MOD, st.preset || {}); redrawDecals();
  try { world = createWorld(st, 4); } catch (e) { console.error(e); world = null; return; }
  world.caption = st.caption(); plaque.classList.remove('show');
  setPal(computePal(), 2.2); sfx.arrive(); count++; store.set('k81-worlds', count); updCount(); say(world.caption.name.toUpperCase());
}
function press(i) {
  audio(); sfx.click(); kp[i] = 1; ledT[i] = clock;
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
  else { c.group.position.copy(hov); c.spin = lerp(c.spin, c.spinT, 1 - Math.exp(-dt * 4)); c.group.rotation.y = c.spin + Math.sin((t - B0) * .22) * .05; }
  c.s = s; c.group.scale.setScalar(Math.max(.002, s * WS)); if (c.skyG) { c.skyG.position.copy(c.group.position); c.skyG.scale.copy(c.group.scale); }
  if (c.dieT === undefined) {
    if (t > .45 && once(c, '_cap')) showPlaque(c.caption);
    if (t >= B1 && once(c, '_calm')) pad(st.mood[1], st.mood[0]);
    if (t >= 7 && once(c, '_hide')) plaque.classList.remove('show');
    if (c.userEvent) c.et += dt; ambient(c, dt);
    try { st.update(c, c.et, dt); } catch (e) { console.error(st.id, e); }
  }
  if (c.wmesh && st.waves) { const p = c.wmesh.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k); p.setY(k, waveY(c, x, z)); } p.needsUpdate = true; c.wmesh.geometry.computeVertexNormals(); }
  const ppu = renderer.domElement.height / viewH * s * WS * 1.5; c.P.mat.uniforms.uScale.value = ppu; c.Sm.mat.uniforms.uScale.value = ppu; c.G.mat.uniforms.uScale.value = ppu; c.Cn.mat.uniforms.uScale.value = ppu;
  c.P.update(dt); c.Sm.update(dt); c.G.update(dt); c.Cn.update(dt);
  c.shake *= Math.exp(-dt * 4);
}

/* ================= input ================= */
const ray = new T.Raycaster(), ndc = new T.Vector2(); let hoverCheck = false, ptr = { x: 0, y: 0 };
function hitKey(e) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(keyMeshes, false)[0]; return h ? h.object.userData.i : -1; }
canvas.addEventListener('pointerdown', e => { const i = hitKey(e); if (i >= 0) press(i); });
canvas.addEventListener('pointermove', e => { ptr.x = e.clientX / innerWidth * 2 - 1; ptr.y = e.clientY / innerHeight * 2 - 1; if (hoverCheck) return; hoverCheck = true; requestAnimationFrame(() => { hoverCheck = false; canvas.style.cursor = hitKey(e) >= 0 ? 'pointer' : 'default'; }); });
addEventListener('keydown', e => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest && e.target.closest('button')) return;
  const k = e.key.toUpperCase(); let i = -1; if (k === ' ' || k === 'ENTER') i = 4; else if (k >= '1' && k <= '9') i = +k - 1; else i = KEYDEF.findIndex(d => d.key === k); if (i >= 0) { e.preventDefault(); press(i); }
});
const muteBtn = $('#mute');
function syncMute() { muteBtn.setAttribute('aria-pressed', String(!AU.muted)); $('#muteLbl').textContent = AU.muted ? 'Sound off' : 'Sound on'; }
muteBtn.addEventListener('click', () => { AU.muted = !AU.muted; store.set('k81-muted', AU.muted); if (AU.ctx) AU.ctx[AU.muted ? 'suspend' : 'resume'](); syncMute(); });
DARK.addEventListener && DARK.addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ================= loop ================= */
let clock = 0, last = performance.now();
const camOff = new T.Vector3();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
  flashLight = Math.max(0, flashLight - dt * 3);
  if (world) { updateWorld(world, dt); if (world.dead) { disposeWorld(world); world = null; } }
  for (let i = dying.length - 1; i >= 0; i--) { updateWorld(dying[i], dt); if (dying[i].dead) { disposeWorld(dying[i]); dying.splice(i, 1); } }
  updatePal(dt); ambientSound(dt);
  for (let j = 0; j < NK; j++) {
    kp[j] = Math.max(0, kp[j] - dt * 4); keys[j].position.y = -.24 * Math.min(1, kp[j] * 1.6);
    const e = clock - ledT[j]; let I = e >= 0 ? Math.max(0, 1 - e / .55) * 2.4 : 0;
    if (!world) I += .3 * (.5 + .5 * Math.sin(clock * 1.8 - kDist[j] * .8));
    else { const d = KEYDEF[j]; if (d.levels) I = Math.max(I, d.id === 'time' ? .5 : MOD[d.id] / 3 * 1.5); else if (d.id === 'world') I = Math.max(I, .9 + .4 * Math.sin(clock * 2.5)); else if (d.id === 'event' && world.et < B1) I = Math.max(I, 1.4); }
    ledMats[j].emissiveIntensity = I;
  }
  camOff.copy(CDIR).multiplyScalar(40).applyAxisAngle(UP, REDUCE ? 0 : ptr.x * .07); camOff.y += REDUCE ? 0 : -ptr.y * 1.2;
  cam.position.copy(TARGET).add(camOff); cam.lookAt(TARGET);
  const sh = REDUCE ? 0 : Math.max(world ? world.shake : 0, 0); if (sh > .002) cam.position.add(new T.Vector3(rnd(-sh, sh), rnd(-sh, sh), rnd(-sh, sh)));
  backdrop.position.copy(TARGET).addScaledVector(CDIR, -30); backdrop.lookAt(cam.position); skyA = lerp(skyA, world && world.skyOn ? 1 : 0, 1 - Math.exp(-dt * .9)); backdrop.material.uniforms.uA.value = skyA; backdrop.visible = skyA > .01; fxBoost = Math.max(0, fxBoost - dt * .5);
  backdrop.material.uniforms.uHy.value = .5 + (projY(WX, HOVER + .05, WZ) - .5) * viewH / 40;
  if (composer) { updateFX(); composer.render(); } else renderer.render(scene, cam);
  requestAnimationFrame(frame);
}
setupFX(); if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); }
applyTheme(); Object.assign(pal, resolvePal(NEUTRAL())); syncMute(); updCount();
canvas.focus({ preventScroll: true });
requestAnimationFrame(frame);
window.__wonder = { press, stories: STORIES.map(s => s.id) };
const q = new URLSearchParams(location.search).get('world');
if (q) { const s = STORIES.find(x => x.id === q); if (s) { lastIds = STORIES.filter(x => x !== s).map(x => x.id); setTimeout(() => { press(4); if (new URLSearchParams(location.search).get('ev')) world.userEvent = true; const ff = +new URLSearchParams(location.search).get('ff') || 0; for (let k = 0; k < ff / .033; k++) { clock += .033; updateWorld(world, .033); updatePal(.033); } }, 200); } }
})();
