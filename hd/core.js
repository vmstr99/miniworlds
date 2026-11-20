/* Wonder Deck HD: the shared engine. three.js r160, physically based: a real HDRI sky lights each world, a sun or moon
   casts soft shadows, terrain and rock use photo-scanned CC0 textures (Poly Haven) sampled triplanar, water refracts and
   absorbs light by its true depth. Post: bloom, AgX tone mapping, film grade. Each world module (palau.js, alps.js) builds
   its scene on top of this and supplies its own looks, event and update. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE, mergeGeometries };

export const $ = s => document.querySelector(s), TAU = Math.PI * 2, R = Math.random;
export const rnd = (a = 1, b) => b === undefined ? R() * a : a + R() * (b - a), pick = a => a[Math.floor(R() * a.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, sm = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches, Q = new URLSearchParams(location.search);

/* seeded simplex noise */
export function makeNoise(seed = 1) {
  let s = seed >>> 0; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const p = new Uint8Array(512), g = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]], perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const F = .5 * (Math.sqrt(3) - 1), G = (3 - Math.sqrt(3)) / 6;
  const n2 = (x, y) => { const k = (x + y) * F, i = Math.floor(x + k), j = Math.floor(y + k), t = (i + j) * G, x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G, y1 = y0 - j1 + G, x2 = x0 - 1 + 2 * G, y2 = y0 - 1 + 2 * G, ii = i & 255, jj = j & 255; let n = 0;
    const c = (gx, gy, a, b) => { let q = .5 - a * a - b * b; if (q < 0) return 0; q *= q; return q * q * (gx * a + gy * b); };
    let gi = g[p[ii + p[jj]] & 7]; n += c(gi[0], gi[1], x0, y0); gi = g[p[ii + i1 + p[jj + j1]] & 7]; n += c(gi[0], gi[1], x1, y1); gi = g[p[ii + 1 + p[jj + 1]] & 7]; n += c(gi[0], gi[1], x2, y2); return 70 * n; };
  const fbm = (x, y, o = 5) => { let a = .5, f = 1, t = 0, w = 0; for (let i = 0; i < o; i++) { t += a * n2(x * f, y * f); w += a; a *= .5; f *= 2.03; } return t / w; };
  const ridge = (x, y, o = 5) => { let a = .5, f = 1, t = 0, w = 0; for (let i = 0; i < o; i++) { const q = 1 - Math.abs(n2(x * f, y * f)); t += a * q * q; w += a; a *= .5; f *= 2.03; } return t / w; };
  return { n2, fbm, ridge };
}

export const GLSL_NOISE = `float hh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1., 0.)), f.x), mix(hh(i + vec2(0., 1.)), hh(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
float caustic(vec2 p, float t){ vec2 q = p * 1.9; float c = 0.; for (int i = 0; i < 3; i++) { float fi = float(i); q += vec2(sin(q.y * 1.3 + t * .7 + fi), cos(q.x * 1.1 - t * .6 + fi * 1.7)) * .5; c += abs(sin(q.x) + sin(q.y)) * .5; } c /= 3.; return pow(clamp(1. - c, 0., 1.), 5.) * 3.; }
float cloudShade(vec2 p, float t, float k){ return 1. - k * smoothstep(.48, .78, fbm(p * .11 + vec2(t * .018, t * .007))); }
`;
export const TRI = `vec3 triW(vec3 n){ vec3 w = pow(abs(n), vec3(5.)); return w / (w.x + w.y + w.z); }
vec3 tri(sampler2D t, vec3 p, vec3 w, float s){ return texture2D(t, p.zy * s).rgb * w.x + texture2D(t, p.xz * s).rgb * w.y + texture2D(t, p.xy * s).rgb * w.z; }
vec3 tri2(sampler2D t, vec3 p, vec3 w, float s){ return mix(tri(t, p, w, s), tri(t, p + 17.3, w, s * .31), .35); }
vec3 triN(sampler2D t, vec3 p, vec3 n, vec3 w, float s){ vec3 a = texture2D(t, p.zy * s).xyz * 2. - 1., b = texture2D(t, p.xz * s).xyz * 2. - 1., c = texture2D(t, p.xy * s).xyz * 2. - 1.;
  a = vec3(a.xy + n.zy, abs(a.z) * n.x); b = vec3(b.xy + n.xz, abs(b.z) * n.y); c = vec3(c.xy + n.xy, abs(c.z) * n.z); return normalize(a.zyx * w.x + b.xzy * w.y + c.xyz * w.z); }
`;

/* ---------------- quality tier ----------------
   Phones and tablets (coarse pointer or a small screen) get the light tier: 1K textures and skies, fewer pixels, no MSAA,
   a smaller shadow map, coarser terrain and fewer trees. ?q=lo or ?q=hi forces either. */
export const LO = Q.get('q') ? Q.get('q') === 'lo' : (matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700);
export const QN = LO ? .55 : 1, ASSET = LO ? 'assets/lo/' : 'assets/';
const SKYFILE = { noon: 'sky_noon.rgbe.png', gold: 'sky_gold.rgbe.png', storm: 'sky_storm.rgbe.png', night: 'sky_night.rgbe.png' };
const DEFAULT_LOOKS = { noon: { sky: 'noon', dir: [-.55, 1, .55], col: '#fff2e2', I: 3.2, env: 1, exp: 1.05 }, dusk: { sky: 'gold', dir: [-.95, .3, .12], col: '#ffa860', I: 3.4, env: .7, exp: 1.0, warm: 1 },
  night: { sky: 'night', dir: [-.3, .9, -.75], col: '#a8b8ff', I: .95, env: .34, exp: 1.3, skyI: .3, stars: 1 } };
export const TIMES = ['dawn', 'noon', 'dusk', 'night'];

/* ---------------- engine: created once, worlds mount into it and are swapped without reloading ---------------- */
let E = null;
export const engine = () => E;
export function createEngine(o) { if (!E) initEngine(); return E.mount(o); }
export function initEngine(opts = {}) {
  if (E) return E;
  const canvas = $('#gl');
  if (opts.pointerFilter) canvas.addEventListener('pointerdown', opts.pointerFilter); // the deck claims its presses before the orbit controls see them
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  const PRMAX = Math.min(LO ? 1.5 : 1.75, devicePixelRatio || 1), PRMIN = LO ? .8 : 1; let PR = PRMAX; renderer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, .1, 500);
  const controls = new OrbitControls(camera, canvas);
  controls.userData = {};
  controls.enableDamping = true; controls.dampingFactor = .06; controls.maxPolarAngle = Math.PI * .47; controls.minPolarAngle = Math.PI * .06; controls.enablePan = false; controls.rotateSpeed = .6; controls.zoomSpeed = .8;
  controls.addEventListener('start', () => { controls.userData.touched = 1; });

  let pending = 0; const manager = new THREE.LoadingManager();
  manager.onStart = (u, a, b) => { pending = b - a; }; manager.onProgress = (u, a, b) => { pending = b - a; const el = $('#ldb'); if (el) el.style.width = (a / b * 100).toFixed(0) + '%'; if (Q.has('dbg')) console.warn('load', a, b, u); }; manager.onLoad = () => { pending = 0; };
  const tl = new THREE.TextureLoader(manager), aniso = Math.min(LO ? 4 : 8, renderer.capabilities.getMaxAnisotropy()), cache = {};
  const tex = (f, srgb = true, rep = true) => { const k = f + srgb + rep; if (cache[k]) return cache[k]; const t = tl.load(ASSET + f); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.userData.shared = 1; return cache[k] = t; };
  // HDR skies ship as lossless RGBE-in-PNG (artifacts don't serve .hdr): decode the shared exponent back to half floats
  const loadRGBE = (url, cb) => { manager.itemStart(url);
    fetch(url).then(r => r.blob()).then(b => createImageBitmap(b, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })).then(img => {
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, img.height).data, n = img.width * img.height, f = new Uint16Array(n * 4), H = THREE.DataUtils.toHalfFloat, one = H(1);
      for (let i = 0; i < n; i++) { const e = d[i * 4 + 3], sc = e ? Math.pow(2, e - 136) : 0; f[i * 4] = H(Math.min(65000, d[i * 4] * sc)); f[i * 4 + 1] = H(Math.min(65000, d[i * 4 + 1] * sc)); f[i * 4 + 2] = H(Math.min(65000, d[i * 4 + 2] * sc)); f[i * 4 + 3] = one; }
      const t = new THREE.DataTexture(f, img.width, img.height, THREE.RGBAFormat, THREE.HalfFloatType); t.flipY = true; t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.LinearSRGBColorSpace;
      t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; cb(t); manager.itemEnd(url); }).catch(e => { console.error('sky', url, e); manager.itemError(url); manager.itemEnd(url); }); };

  const U = { uTime: { value: 0 }, uSun: { value: 1 }, uCloud: { value: .35 }, uWet: { value: 0 }, uWind: { value: 1 }, uGlow: { value: 1 } };
  const MOD = { time: 1, clouds: 1, rain: 0, wind: 1, glow: 1, life: 1 };

  /* sky: a big sphere crossfading two equirect HDRIs (rotatable, so dawn can put the sun on the other side), with a procedural
     night of stars and Milky Way blended in; below the horizon it mirrors the upper sky so the diorama floats */
  const skyU = { tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uI: { value: 1 }, uFlash: { value: 0 }, uStar: { value: 0 }, uT: { value: 0 }, uGrey: { value: 0 }, uRotA: { value: 0 }, uRotB: { value: 0 }, uEmber: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(220, LO ? 40 : 64, LO ? 20 : 32), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: `uniform sampler2D tA, tB; uniform float uMix, uI, uFlash, uStar, uT, uGrey, uRotA, uRotB, uEmber; varying vec3 vD;
      float hs(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
      float vns(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hs(i), hs(i + vec2(1., 0.)), f.x), mix(hs(i + vec2(0., 1.)), hs(i + vec2(1., 1.)), f.x), f.y); }
      vec2 eq(vec3 d, float r){ return vec2(fract(atan(d.z, d.x) / 6.2831853 + .5 + r), asin(clamp(d.y, -1., 1.)) / 3.14159265 + .5); }
      void main(){ vec3 d = normalize(vD); float below = step(d.y, 0.); d.y = abs(d.y) * mix(1., .7, below) + .015; d = normalize(d);
        vec3 c = mix(texture2D(tA, eq(d, uRotA)).rgb, texture2D(tB, eq(d, uRotB)).rgb, uMix) * uI;
        if (uStar > .01) { vec2 uv = eq(d, 0.); vec3 n = normalize(vec3(.35, .55, .76)); float band = exp(-pow(dot(d, n), 2.) * 22.);
          vec3 s = mix(vec3(.004, .007, .018), vec3(.012, .02, .045), smoothstep(.0, .6, d.y)) + vec3(.03, .035, .05) * band * (.4 + vns(uv * vec2(90., 45.)) * .6 + vns(uv * vec2(260., 130.)) * .4);
          vec2 g = uv * vec2(2400., 1200.); vec2 id = floor(g); float h = hs(id), r = length(fract(g) - .5); float st = step(.9965 - band * .006, h) * smoothstep(.42, .05, r) * (.55 + .45 * sin(uT * (1. + h * 4.) + h * 60.));
          s += mix(vec3(1., .86, .7), vec3(.7, .82, 1.), hs(id + 7.)) * st * (.35 + .9 * pow(hs(id + 3.), 6.)) * (1. - uGrey); c = mix(c, s, uStar); }
        float l = dot(c, vec3(.2126, .7152, .0722)); c = mix(c, vec3(l) * vec3(.92, .95, 1.), uGrey * .85) * (1. - uGrey * .45);
        { float hz = smoothstep(.45, -.05, d.y); c = mix(c, mix(vec3(.012, .006, .005), vec3(.28, .06, .015), hz) * (.6 + .5 * vns(eq(d, uT * .004) * vec2(14., 7.))), uEmber); }
        c *= mix(1., .82, below); c += vec3(.6, .7, 1.) * uFlash * smoothstep(-.1, .5, d.y); gl_FragColor = vec4(c, 1.); }` }));
  sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  const sun = new THREE.DirectionalLight('#fff6e8', 3); sun.castShadow = true; sun.shadow.mapSize.set(LO ? 2048 : 4096, LO ? 2048 : 4096);
  const SHADOW0 = { left: -7.5, right: 7.5, top: 7.5, bottom: -7.5, near: 1, far: 70 };
  Object.assign(sun.shadow.camera, SHADOW0); sun.shadow.bias = -.00025; sun.shadow.normalBias = .035; scene.add(sun, sun.target);
  const pmrem = new THREE.PMREMGenerator(renderer), SKY = {}, ENV = {}, skyWait = {};
  const needSky = k => { if (SKY[k] || skyWait[k] || !SKYFILE[k]) return; skyWait[k] = 1; loadRGBE(ASSET + SKYFILE[k], t => { SKY[k] = t; ENV[k] = pmrem.fromEquirectangular(t).texture; }); };

  /* post */
  const rt = new THREE.WebGLRenderTarget(innerWidth * PR, innerHeight * PR, { type: THREE.HalfFloatType, samples: LO ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(PR); composer.setSize(innerWidth, innerHeight); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .16, .5, 1.6); composer.addPass(bloom); composer.addPass(new OutputPass());
  const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) }, uStorm: { value: 0 }, uWarm: { value: 0 }, uSat: { value: 1.06 }, uFlash: { value: 0 }, uFlashC: { value: new THREE.Color(1, .95, .86) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uStorm, uWarm, uSat, uFlash; uniform vec3 uFlashC; uniform vec2 uRes; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec2 d = vUv - .5; vec3 c = texture2D(tDiffuse, vUv).rgb;
        c = mix(c, c * c * (3. - 2. * c), .26); float l = dot(c, vec3(.2126, .7152, .0722));
        c += vec3(-.012, .002, .018) * (1. - l) + vec3(.018, .008, -.014) * l; c = mix(vec3(l), c, uSat - uStorm * .25 + uWarm * .06);
        c *= mix(vec3(1.), vec3(1.1, .98, .82), uWarm); c += vec3(.03, .012, 0.) * uWarm * (1. - l);
        c *= 1. - dot(d, d) * .55; c = mix(c, uFlashC, clamp(uFlash, 0., 1.)); c += (h(floor(vUv * uRes) + fract(uTime) * 91.) - .5) * .022; gl_FragColor = vec4(c, 1.); }` });
  composer.addPass(grade);
  let deckH = 0; const frameCam = () => { camera.aspect = innerWidth / innerHeight; const off = deckH * (innerWidth < innerHeight ? .42 : .5); if (off > 0) camera.setViewOffset(innerWidth, innerHeight, 0, off, innerWidth, innerHeight); else camera.clearViewOffset(); camera.updateProjectionMatrix(); };
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); frameCam(); grade.uniforms.uRes.value.set(innerWidth, innerHeight); E.onResize.forEach(f => f()); };
  addEventListener('resize', resize);

  /* audio: one context for everything; each world gets its own bus that is faded out and torn down when it leaves */
  const AUD = { ctx: null, master: null, muted: false };
  AUD.get = () => { if (AUD.ctx) { if (AUD.ctx.state === 'suspended' && !AUD.muted) AUD.ctx.resume(); return AUD.ctx; } try { const C = window.AudioContext || window.webkitAudioContext, c = AUD.ctx = new C(); AUD.master = c.createGain(); AUD.master.gain.value = .9; const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .25; AUD.master.connect(comp); comp.connect(c.destination);
    const b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AUD.noise = b; AUD.onStart.forEach(f => f(c)); return c; } catch (e) { return null; } };
  AUD.onStart = [];

  E = { THREE, renderer, scene, camera, controls, composer, grade, bloom, manager, tex, loadRGBE, U, MOD, sun, sky, skyU, SKY, ENV, needSky, pmrem, AUD, LO, QN, onResize: [], overlays: [], fx: [], clock: 0, world: null, get pending() { return pending; },
    setDeckH(h) { deckH = h; frameCam(); } };

  /* world mounting */
  const cur = { dir: new THREE.Vector3(-.5, 1, .5).normalize(), col: new THREE.Color('#fff2e2'), I: 3, env: 1, exp: 1.05, warm: 0, skyI: 1, star: 0, rot: 0, ember: 0 }; let snapLook = true;
  let LOOK = {}, lookT = 'noon', skyFrom = 'noon', skyTo = 'noon', skyK = 1, rotFrom = 0, rotTo = 0;
  const baseLook = () => TIMES[MOD.time];
  const setLook = k => { if (!LOOK[k]) k = 'noon'; if (k === lookT && !snapLook) return; const L = LOOK[k]; needSky(L.sky);
    if (snapLook) { skyFrom = skyTo = L.sky; rotFrom = rotTo = L.rot || 0; skyK = 1; lookT = k; Object.assign(cur, { I: L.I, env: L.env, exp: L.exp, warm: L.warm || 0, skyI: L.skyI ?? 1, star: L.stars ? 1 : 0 }); cur.dir.set(...L.dir).normalize(); cur.col.set(L.col); snapLook = false; return; }
    if (skyK > .5) { skyFrom = skyTo; rotFrom = rotTo; } skyTo = L.sky; rotTo = L.rot || 0; skyK = 0; lookT = k; };
  E.setLook = k => setLook(k); E.baseLook = baseLook; E.looks = () => LOOK;
  E.applyCam = k => { const P = E.camPlan; if (!P) return; const e = k * k * (3 - 2 * k); controls.target.lerpVectors(P.t0, P.t1, e);
    const a = P.p0.clone().sub(P.t0), b = P.p1.clone().sub(P.t1), sa = new THREE.Spherical().setFromVector3(a), sb = new THREE.Spherical().setFromVector3(b); let dth = sb.theta - sa.theta; while (dth > Math.PI) dth -= TAU; while (dth < -Math.PI) dth += TAU;
    const sp = new THREE.Spherical(lerp(sa.radius, sb.radius, e), lerp(sa.phi, sb.phi, e), sa.theta + dth * e); camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sp));
    if (k >= 1) { controls.minDistance = P.min; controls.maxDistance = P.max; E.camPlan = null; } };
  const disposeObj = root => root.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    ms.forEach(m => { Object.values(m).forEach(v => { if (v && v.isTexture && !v.userData.shared) v.dispose(); }); if (m.uniforms) Object.values(m.uniforms).forEach(u => { const v = u && u.value; if (v && v.isTexture && !v.userData.shared && !Object.values(ENV).includes(v) && !Object.values(SKY).includes(v)) v.dispose(); }); m.dispose(); }); });
  E.unmount = () => { const w = E.world; if (!w) return; scene.remove(w.island); disposeObj(w.island); (w.disposers || []).forEach(f => { try { f(); } catch (e) {} }); E.world = null; };
  E.mount = o => {
    E.unmount(); controls.userData.touched = 0;
    const island = new THREE.Group(); island.scale.setScalar(.001); scene.add(island);
    LOOK = Object.assign({}, DEFAULT_LOOKS, o.looks || {}); if (o.looks && o.looks.gold) LOOK.dusk = o.looks.gold; if (o.looks && o.looks.night) LOOK.night = Object.assign({ stars: o.stars ? 1 : 0 }, o.looks.night);
    { const D = LOOK.dusk; LOOK.dawn = Object.assign({}, D, { dir: [-D.dir[0], D.dir[1] * .85, -D.dir[2]], col: '#ffb898', I: D.I * .8, warm: (D.warm || 0) * .55, exp: (D.exp || 1) * 1.04, rot: (D.rot || 0) + .5 }); }
    Object.assign(sun.shadow.camera, SHADOW0); sun.shadow.camera.updateProjectionMatrix();
    const B = o.bloom || [.16, .5, 1.6]; bloom.strength = B[0]; bloom.radius = B[1]; bloom.threshold = B[2]; grade.uniforms.uSat.value = o.sat ?? 1.06;
    const C = o.cam, tT = new THREE.Vector3(C.target[0], C.target[1] + .55, C.target[2]), d = (innerWidth / innerHeight < .8 ? C.dist * 1.3 : C.dist) * .9 * (1 + deckH / innerHeight * (innerWidth < innerHeight ? .45 : .55));
    const tP = new THREE.Vector3(Math.sin(C.pol) * Math.sin(C.az) * d, Math.cos(C.pol) * d, Math.sin(C.pol) * Math.cos(C.az) * d).add(tT);
    if (!E.camInit) { E.camInit = 1; controls.target.copy(tT); camera.position.copy(tP); controls.minDistance = C.min; controls.maxDistance = C.max; E.camPlan = null; }
    else { E.camPlan = { t0: controls.target.clone(), p0: camera.position.clone(), t1: tT, p1: tP, min: C.min, max: C.max }; controls.minDistance = Math.min(controls.minDistance, C.min); controls.maxDistance = Math.max(controls.maxDistance, C.max, camera.position.distanceTo(controls.target)); }
    controls.update();
    const ctx = { THREE, renderer, scene, camera, controls, composer, grade, bloom, manager, tex, loadRGBE, U, MOD, sun, skyU, SKY, ENV, cur, island, steps: [], MATS: [], GLOW: [], LIFE: [], disposers: [], clock: E.clock, api: null, o,
      setLook, baseLook, get look() { return lookT; }, shake(k) { E.shakeK = Math.max(E.shakeK || 0, k); }, flash(k = 1, c) { grade.uniforms.uFlash.value = REDUCE ? k * .3 : k; grade.uniforms.uFlashC.value.set(c || '#fff2dc'); }, glowMat(m, base = 1) { ctx.GLOW.push([m, base]); return m; }, life(obj, lv = 1) { ctx.LIFE.push([obj, lv]); return obj; } };
    Object.defineProperty(ctx, 'clock', { get: () => E.clock });
    E.world = ctx; setLook(baseLook()); return ctx; };

  /* the controls the deck drives */
  E.setMod = (k, v) => { MOD[k] = v; const w = E.world; if (k === 'time' && w && !(w.api && w.api.evOn)) setLook(baseLook()); if (w && w.api && w.api[k]) w.api[k](v); E.fx.forEach(f => f.mod && f.mod(k, v)); };
  let spin = null, spinQ = 0; E.spinDeg = 0; E.spin = (dir = 1) => { E.spinDeg = (E.spinDeg + dir * 90 + 360) % 360; if (spin) spinQ += dir; else spin = { t: 0, a0: 0, da: dir * Math.PI / 2 }; return E.spinDeg; };

  /* loop */
  let last = performance.now(), frames = 0, perfN = 0, perfT = 0; E.ready = false;
  const tmp = new THREE.Vector3(), CL = { I: [1, .82, .5, .3], env: [1, .95, .8, .62], grey: [0, .1, .45, .72], cloud: [.12, .35, .62, .85], exp: [1, 1, 1.06, 1.1] }, WIND = [.35, 1, 1.9, 3], GLOWL = [0, .4, 1, 1.8];
  const step = dt => { E.clock += dt; U.uTime.value = E.clock; grade.uniforms.uTime.value = E.clock; const w = E.world; if (!w) return;
    const L = LOOK[lookT], f = 1 - Math.exp(-dt * 1.2), cl = MOD.clouds, wet = MOD.rain;
    cur.dir.lerp(tmp.set(...L.dir).normalize(), f).normalize(); cur.col.lerp(new THREE.Color(L.col), f); cur.I = lerp(cur.I, L.I * CL.I[cl] * [1, .9, .75, .6][wet], f); cur.env = lerp(cur.env, L.env * CL.env[cl], f); cur.exp = lerp(cur.exp, L.exp * CL.exp[cl], f); cur.warm = lerp(cur.warm, (L.warm || 0) * (1 - cl * .25), f);
    cur.skyI = lerp(cur.skyI, (L.skyI ?? 1), f); cur.ember = lerp(cur.ember, L.ember || 0, f * .6); skyU.uEmber.value = cur.ember; cur.star = lerp(cur.star, L.stars ? 1 : 0, f); skyU.uGrey.value = lerp(skyU.uGrey.value, Math.min(1, CL.grey[cl] + wet * .08) * (L.stars ? .4 : 1), f);
    U.uCloud.value = lerp(U.uCloud.value, CL.cloud[cl], f); U.uWind.value = lerp(U.uWind.value, WIND[MOD.wind], f); U.uWet.value = lerp(U.uWet.value, wet / 3, f * .5);
    const dark = clamp(1 - cur.I / 2.2, 0, 1); U.uGlow.value = lerp(U.uGlow.value, GLOWL[MOD.glow] * (.4 + .6 * dark), f); w.GLOW.forEach(([m, b]) => { m.emissiveIntensity = b * U.uGlow.value; });
    w.LIFE.forEach(([o, lv]) => { o.visible = MOD.life >= lv; });
    skyU.uT.value = E.clock; if (SKY[skyTo]) skyK = Math.min(1, skyK + dt / 3); skyU.tA.value = SKY[skyFrom] || SKY[skyTo]; skyU.tB.value = SKY[skyTo] || SKY[skyFrom]; skyU.uMix.value = sm(skyK); skyU.uRotA.value = rotFrom; skyU.uRotB.value = rotTo; skyU.uI.value = cur.skyI; skyU.uStar.value = cur.star;
    const envT = ENV[skyTo] || ENV[skyFrom]; /* switch the environment at once, before a world rises, never mid-fade */ if (envT && scene.environment !== envT) scene.environment = envT; if (skyK >= 1) { skyFrom = skyTo; rotFrom = rotTo; }
    sun.position.copy(cur.dir).multiplyScalar(30); sun.color.copy(cur.col); sun.intensity = cur.I; renderer.toneMappingExposure = cur.exp * .96; grade.uniforms.uWarm.value = cur.warm; grade.uniforms.uStorm.value = cl / 3; U.uSun.value = clamp(cur.I / (w.o.sunRef || 3), .14, 1);
    w.MATS.forEach(m => { m.envMapIntensity = cur.env * .72 * (m.userData.env ?? 1); }); skyU.uFlash.value = Math.max(0, skyU.uFlash.value - dt * 7); grade.uniforms.uFlash.value = Math.max(0, grade.uniforms.uFlash.value - dt * 1.6);
    if (spin) { spin.t += dt; const k = sm(spin.t / .9), a = spin.da * k - spin.a0; spin.a0 = spin.da * k; tmp.copy(camera.position).sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), a); camera.position.copy(controls.target).add(tmp); if (spin.t >= .9) { spin = null; if (spinQ) { const d = Math.sign(spinQ); spinQ -= d; spin = { t: 0, a0: 0, da: d * Math.PI / 2 }; } } }
    w.steps.forEach(fn => fn(dt)); E.fx.forEach(fx => fx.step && fx.step(dt)); };
  E.step = step;
  E.waitReady = () => new Promise(res => { const t0 = performance.now(); const chk = () => { const w = E.world, L = w && LOOK[lookT]; if ((w && SKY[L.sky] && pending === 0) || performance.now() - t0 > 20000) res(); else setTimeout(chk, 60); }; chk(); }); // never hang on one failed request
  const tick = now => { requestAnimationFrame(tick); const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; if (!E.ready) return;
    if (E.busy || E.clock < (E.calmAt || 0)) { perfN = perfT = 0; } else if (raw < .25 && !document.hidden) { perfT += raw; if (++perfN >= 90) { const ms = perfT / perfN; if (ms > 1 / 38 && PR > PRMIN) { PR = Math.max(PRMIN, PR - .25); renderer.setPixelRatio(PR); composer.setPixelRatio(PR); composer.setSize(innerWidth, innerHeight); } perfN = perfT = 0; } }
    window.__frames = frames; step(dt); controls.autoRotateSpeed = .2; controls.autoRotate = !REDUCE && !Q.get('still') && !controls.userData.touched && !spin; controls.update(); const sk = REDUCE ? 0 : (E.shakeK || 0); E.shakeK = sk * Math.exp(-dt * 2.6); let sv = null; if (sk > .002) { sv = camera.position.clone(); const d = camera.position.distanceTo(controls.target) * .012 * sk; camera.position.x += rnd(-d, d); camera.position.y += rnd(-d, d) * .7; camera.position.z += rnd(-d, d); camera.updateMatrixWorld(); }
    composer.render(); if (sv) { camera.position.copy(sv); camera.updateMatrixWorld(); }
    if (E.overlays.length) { renderer.autoClear = false; E.overlays.forEach(f => f(dt)); renderer.autoClear = true; }
    if (++frames === 3) { const ld = $('#loader'); if (ld) { if (Q.has('shot')) ld.remove(); else { ld.classList.add('done'); setTimeout(() => ld.remove(), 900); } } } };
  requestAnimationFrame(tick);
  return E;
}

/* ---------------- heightfield, cut walls, water ---------------- */
/* the classic decks' proportions: slabs about a quarter as deep as they are wide. Everything more than .6 below the surface is
   compressed so abysses, blue holes and reservoirs fit a thin profile and still fall away into the dark */
export const DZ = y => y > -.6 ? y : -.6 + (y + .6) * .44, SLAB = 2.6;
export function makeHeightfield(S, NG, height) {
  NG = Math.round(NG * (LO ? .62 : 1)); const V = NG + 1, HM = new Float32Array(V * V), H5 = S / 2;
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) HM[j * V + i] = DZ(height(i / NG * 2 - 1, j / NG * 2 - 1));
  const hAt = (x, z) => { const fx = clamp((x / S + .5) * NG, 0, NG - .001), fz = clamp((z / S + .5) * NG, 0, NG - .001), i = fx | 0, j = fz | 0, a = fx - i, b = fz - j; return lerp(lerp(HM[j * V + i], HM[j * V + i + 1], a), lerp(HM[(j + 1) * V + i], HM[(j + 1) * V + i + 1], a), b); };
  const normAt = (x, z, e = .03) => new THREE.Vector3(hAt(x - e, z) - hAt(x + e, z), 2 * e, hAt(x, z - e) - hAt(x, z + e)).normalize();
  const geo = new THREE.PlaneGeometry(S, S, NG, NG); geo.rotateX(-Math.PI / 2); { const p = geo.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, HM[k]); geo.computeVertexNormals(); }
  return { S, NG, V, H5, HM, hAt, normAt, geo };
}
export function makeWalls(hf, depth, water, norm = 2.6) {
  const { S, NG, V, H5, HM } = hf, cell = S / NG, land = [], wat = [];
  [[a => [a, 0], [0, 0, -1], 0], [a => [a, NG], [0, 0, 1], 1], [a => [0, a], [-1, 0, 0], 1], [a => [NG, a], [1, 0, 0], 0]].forEach(([get, nr, flip]) => {
    const lp = [], ln = [], luv = [], wp = [], wuv = [], idx = [];
    for (let a = 0; a <= NG; a++) { const [i, j] = get(a), x = -H5 + i * cell, z = -H5 + j * cell, h = HM[j * V + i], al = a * cell;
      lp.push(x, h, z, x, -depth, z); ln.push(...nr, ...nr); luv.push(al * .22, h * .22, al * .22, -depth * .22);
      if (water != null) { wp.push(x, water, z, x, Math.min(h, water), z); wuv.push(al / S, 0, al / S, clamp((water - Math.min(h, water)) / norm, 0, 1)); }
      if (a < NG) { const t0 = a * 2, t1 = t0 + 2; idx.push(...(flip ? [t0, t0 + 1, t1, t1, t0 + 1, t1 + 1] : [t0, t1, t0 + 1, t1, t1 + 1, t0 + 1])); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(luv, 2)); g.setIndex(idx); land.push(g);
    if (water != null) { const w = new THREE.BufferGeometry(); w.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); w.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3)); w.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2)); w.setIndex(idx.slice()); wat.push(w); } });
  return { land: mergeGeometries(land), water: water != null ? mergeGeometries(wat) : null };
}
export function wallMaterial(ctx, map, nor, tint = [.93, .9, .84]) {
  const m = new THREE.MeshStandardMaterial({ map, normalMap: nor, roughness: .9 }); ctx.MATS.push(m);
  m.onBeforeCompile = sh => { sh.vertexShader = 'varying float vY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvY = position.y;');
    sh.fragmentShader = 'varying float vY;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { float b = fract((vY + 9.) * 2.6 + sin(vY * 7.) * .08), band = smoothstep(.0, .06, b) * smoothstep(1., .9, b); diffuseColor.rgb *= mix(.7, 1., band) * mix(vec3(${tint.join(',')}), vec3(1.05, 1.02, .97), step(.5, fract((vY + 9.) * 1.3))) * mix(.62, 1., smoothstep(-3.4, 0., vY)); }`); };
  return m;
}
/* water: transmission with Beer–Lambert absorption from a baked depth map, light in-scatter, three moving normal layers,
   sun glitter, drifting cloud shade, shoreline foam, and edges that slosh against the glass */
export function makeWater(ctx, hf, o) {
  const { S, H5, hAt } = hf, n = 256, d = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = (i + .5) / n * S - H5, z = (j + .5) / n * S - H5, raw = Math.max(0, o.level - (o.depthAt ? o.depthAt(x, z) : hAt(x, z))), dep = clamp(raw / (o.norm ?? 3), 0, 1), dn = 1 - Math.exp(-raw * 1.35 / (o.norm ?? 3)), k = ((n - 1 - j) * n + i) * 4; d[k] = dep * 255; d[k + 1] = dn * 255; d[k + 2] = dep * 255; d[k + 3] = 255; }
  const depthTex = new THREE.DataTexture(d, n, n); depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter; depthTex.needsUpdate = true;
  const tr = new Uint8Array(n * n * 4); for (let k = 0; k < n * n; k++) { const t = 1 - .48 * sm((d[k * 4 + 1] / 255 - .28) / .68); tr[k * 4] = tr[k * 4 + 1] = tr[k * 4 + 2] = t * 255; tr[k * 4 + 3] = 255; }
  const transTex = new THREE.DataTexture(tr, n, n); transTex.magFilter = transTex.minFilter = THREE.LinearFilter; transTex.needsUpdate = true;
  const WU = { uTime: ctx.U.uTime, uWave: { value: o.wave ?? .03 }, uWind: ctx.U.uWind, uSun: ctx.U.uSun, uCloud: ctx.U.uCloud, uDeep: { value: new THREE.Color(o.deep) }, uShal: { value: new THREE.Color(o.shallow) }, uFoam: { value: 1 }, uSunV: { value: new THREE.Vector3(0, 1, 0) }, uGlint: { value: o.glint ?? 1 } };
  const WAVE = `float wav(vec2 p, float t){ float uW = uWave * (.65 + .35 * uWind); float w = uW * (.55 * sin(p.x * 1.1 - t * 1.2) + .3 * sin((p.x * .6 + p.y * .8) * 1.9 - t * 1.6) + .15 * sin((p.x - p.y) * 3.3 - t * 2.4));
  float ex = smoothstep(${(H5 * .74).toFixed(2)}, ${H5.toFixed(2)}, abs(p.x)), ez = smoothstep(${(H5 * .74).toFixed(2)}, ${H5.toFixed(2)}, abs(p.y)); w += (uW * .8 + .012) * (ex * sin(p.y * 1.6 - t * 1.9 + sign(p.x)) + ez * sin(p.x * 1.4 + t * 1.7 + sign(p.y) * 2.)); return w; }\n`;
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: .04, transmission: 1, ior: 1.333, thickness: o.norm ?? 3, thicknessMap: depthTex, transmissionMap: transTex, attenuationColor: new THREE.Color(o.att), attenuationDistance: o.attDist ?? 1.6, normalMap: ctx.tex('water_nor.jpg', false), normalScale: new THREE.Vector2(.3, .3) });
  ctx.MATS.push(mat);
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, WU);
    sh.vertexShader = 'uniform float uTime, uWave, uWind;\n' + WAVE + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 wpw = modelMatrix * vec4(position, 1.); transformed.y += wav(wpw.xz, uTime);');
    sh.fragmentShader = 'uniform float uTime, uWave, uWind, uSun, uFoam, uCloud, uGlint; uniform vec3 uDeep, uShal, uSunV;\n' + GLSL_NOISE + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
 { float dd = texture2D(thicknessMap, vThicknessMapUv).g; vec3 mid = mix(uShal, uDeep, .5) * 1.5 + .02;
   vec3 tn = mix(vec3(1.), mid, smoothstep(.12, .5, dd)); tn = mix(tn, uDeep * 1.25 + .012, smoothstep(.45, .97, dd)); diffuseColor.rgb *= tn; }`)
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `vec2 nuv = vNormalMapUv * 6.; float tt = uTime * .028 * uWind;
	vec3 mapN = normalize((texture2D(normalMap, nuv + vec2(tt, tt * .6)).xyz * 2. - 1.) + (texture2D(normalMap, nuv * 1.9 + vec2(-tt * 1.3, tt * .8)).xyz * 2. - 1.) + (texture2D(normalMap, nuv * .37 + vec2(tt * .4, -tt * .5)).xyz * 2. - 1.) * .6);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{ vec4 dt4 = texture2D(thicknessMap, vThicknessMapUv); float th = dt4.r * ${(o.norm ?? 3).toFixed(2)}, dn = dt4.g, cs = cloudShade(vThicknessMapUv * ${S.toFixed(1)}, uTime, uCloud);
	  // in-scatter: turquoise over sand, teal over the slope, sapphire over the abyss, eased so every step down still shows
	  vec3 sc = mix(uShal, mix(uShal, uDeep, .55) * 1.18, smoothstep(.06, .42, dn)); sc = mix(sc, uDeep * 1.08, smoothstep(.42, .96, dn));
	  float vv = .78 + .44 * vn(vThicknessMapUv * 7. + uTime * .015) * vn(vThicknessMapUv * 3.1 - uTime * .01), mott = .9 + .2 * fbm(vThicknessMapUv * 5.5 + vec2(uTime * .004, -uTime * .003));
	  float fv = 1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), fr = fv * fv * fv;
	  totalEmissiveRadiance += sc * (.18 + .82 * (1. - exp(-th * 1.25))) * mix(1., .8, smoothstep(.8, 1., dn)) * mix(1., vv * mott, smoothstep(.2, .7, dn)) * uSun * cs;
	  totalEmissiveRadiance += mix(uShal, uDeep, .4) * fr * smoothstep(.15, .6, dn) * .35 * uSun * cs;
	  float fo = smoothstep(.07, .0, th) * smoothstep(.25, .75, vn(vThicknessMapUv * 260. + uTime * .3) * .6 + vn(vThicknessMapUv * 90. - uTime * .2) * .4) * uFoam; totalEmissiveRadiance += vec3(.9) * fo * uSun * cs;
	  vec3 rv = reflect(-normalize(vViewPosition), normal); float gl = pow(max(dot(rv, uSunV), 0.), 1400.) * step(.82, vn(vThicknessMapUv * 900. + uTime * 2.3)); totalEmissiveRadiance += vec3(1., .96, .88) * gl * 60. * uSun * uGlint * cs; }`); };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(S, S, LO ? 120 : 220, LO ? 120 : 220).rotateX(-Math.PI / 2), mat); mesh.position.y = o.level; mesh.receiveShadow = true; ctx.island.add(mesh);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .45, metalness: 0, transparent: true, depthWrite: false, }); wallMat.userData.env = .3; ctx.MATS.push(wallMat);
  wallMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, WU);
    sh.vertexShader = 'uniform float uTime, uWave, uWind; varying float vDp; varying vec3 vWp;\n' + WAVE + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDp = uv.y; vWp = position; if (uv.y < .001) { vec4 wpw = modelMatrix * vec4(position, 1.); transformed.y += wav(wpw.xz, uTime); }');
    sh.fragmentShader = 'uniform vec3 uDeep, uShal; uniform float uSun, uTime; varying float vDp; varying vec3 vWp;\n' + GLSL_NOISE + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n float f = 1. - exp(-vDp * ' + (o.wallK ?? 2.6).toFixed(2) + '), ab = smoothstep(.45, 1., vDp); diffuseColor.rgb = mix(mix(uShal * .95, uDeep * .6, f), vec3(.002, .006, .014), ab); diffuseColor.a = mix(.42, .9, f) + ab * .08 + smoothstep(.01, .0, vDp) * .15;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 { float al = vWp.x + vWp.z, shaft = smoothstep(.55, .9, vn(vec2((al + vDp * 2.) * 1.6 + uTime * .05, 1.7))) * smoothstep(.5, .85, vn(vec2((al + vDp * 2.) * 3.7 - uTime * .04, 4.2)) + .25);
   totalEmissiveRadiance += mix(mix(uShal * .45, uDeep * .5, f), vec3(0.), ab) * .6 * uSun + uShal * shaft * (1. - f) * .9 * uSun + vec3(.7, .95, .95) * smoothstep(.01, .0, vDp) * .3 * uSun + uShal * smoothstep(.12, .0, vDp) * .12 * uSun; }`); };
  ctx.steps.push(() => { WU.uSunV.value.copy(ctx.cur.dir).transformDirection(ctx.camera.matrixWorldInverse); });
  return { mesh, mat, WU, wallMat, depthTex };
}

/* light dies with depth: anything below the surface fades toward abyssal blue-black the deeper it sits */
export function underwater(m, level = 0, k = .5, abyss = [.002, .009, .02]) {
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey() : (prev ? prev.toString() : ''); m.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r);
    sh.vertexShader = 'varying vec3 vUWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec4 uw = vec4(transformed, 1.);\n#ifdef USE_INSTANCING\n uw = instanceMatrix * uw;\n#endif\n vUWP = (modelMatrix * uw).xyz; }');
    sh.fragmentShader = 'varying vec3 vUWP;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
 { float d = max(0., ${level.toFixed(3)} - vUWP.y); gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(${abyss.join(',')}), 1. - exp(-d * ${k.toFixed(3)})); }`); };
  m.customProgramCacheKey = () => key + '|uw' + level + k; return m; }

/* marine snow: faint motes sinking slowly through deep water near the cut walls */
export function makeSnowfall(ctx, n, box, color = [.75, .85, .9], alpha = .35) {
  n = Math.round(n * QN);
  const p = new Float32Array(n * 3), sd = new Float32Array(n); for (let i = 0; i < n; i++) { p.set([rnd(box[0], box[1]), rnd(box[2], box[3]), rnd(box[4], box[5])], i * 3); sd[i] = R(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: ctx.U.uTime, uPx: { value: 1 }, uSun: ctx.U.uSun },
    vertexShader: `attribute float sd; uniform float uT, uPx; varying float vS; void main(){ vec3 q = position; float H = ${(box[3] - box[2]).toFixed(2)}; q.y = ${box[2].toFixed(2)} + mod(q.y - ${box[2].toFixed(2)} - uT * (.02 + sd * .03), H); q.x += sin(uT * .2 + sd * 30.) * .05; vS = sd; vec4 mv = modelViewMatrix * vec4(q, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = max(1., uPx * (.008 + sd * .01) / -mv.z); }`,
    fragmentShader: `varying float vS; uniform float uSun; void main(){ float r = length(gl_PointCoord - .5) * 2.; if (r > 1.) discard; gl_FragColor = vec4(vec3(${color.join(',')}) * (.4 + .6 * uSun), (1. - r) * ${alpha.toFixed(2)} * (.4 + vS * .6)); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 1; ctx.island.add(pts);
  ctx.steps.push(() => { m.uniforms.uPx.value = ctx.renderer.domElement.height / (2 * Math.tan(ctx.camera.fov * Math.PI / 360)); }); return pts;
}

/* ---------------- leaf crowns and cards ---------------- */
export function leafQuad(w, h, rect, m4) { const g = new THREE.PlaneGeometry(w, h); g.translate(0, h * .42, 0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, rect[0] + uv.getX(i) * rect[2], rect[1] + uv.getY(i) * rect[3]); g.applyMatrix4(m4); return g; }
export function crownGeometry(rects, n = 110, coreUV = [.075, .7], leaf = [.2, .46], flat = .8) {
  const parts = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < n; k++) { const th = rnd(TAU), y = rnd(-.25, 1), r = Math.sqrt(1 - y * y), dir = new THREE.Vector3(Math.cos(th) * r, y * flat, Math.sin(th) * r).normalize();
    p.copy(dir).multiplyScalar(rnd(.7, .98)); q.setFromUnitVectors(up, dir); q.multiply(new THREE.Quaternion().setFromEuler(e.set(rnd(-.6, .6), rnd(TAU), 0))); m.compose(p, q, sc.setScalar(rnd(.8, 1.2))); parts.push(leafQuad(leaf[0], leaf[1], pick(rects), m)); }
  const core = new THREE.IcosahedronGeometry(.74, 1); core.scale(1, .78, 1); const cu = core.attributes.uv; for (let i = 0; i < cu.count; i++) cu.setXY(i, coreUV[0] + R() * .02, coreUV[1] + R() * .06); parts.push(core);
  return mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
}

/* ---------------- spray and mist ---------------- */
export function makeSpray(ctx, n = 9000) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), aa = new Float32Array(n * 2);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('aa', new THREE.BufferAttribute(aa, 2).setUsage(THREE.DynamicDrawUsage)); geo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPx: { value: 1 }, uSun: ctx.U.uSun },
    vertexShader: 'attribute vec2 aa; varying float vA; varying float vM; uniform float uPx; void main(){ vA = aa.x; vM = aa.y; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.5, uPx * (vM > .5 ? .35 : .018) / -mv.z); }',
    fragmentShader: 'varying float vA; varying float vM; uniform float uSun; void main(){ float r = length(gl_PointCoord - .5) * 2.; if (r > 1.) discard; float a = vM > .5 ? (1. - r * r) * (1. - r * r) * .5 : smoothstep(1., .6, r); gl_FragColor = vec4(vec3(.92, .96, 1.) * (.45 + .6 * uSun), a * vA); }' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; ctx.island.add(pts); const P = [], level = () => ctx.waterLevel ?? 0;
  const S = { emit(x, y, z, vx, vy, vz, life, mist = 0) { if (P.length < n) P.push({ x, y, z, vx, vy, vz, life, age: 0, mist }); },
    splash(x, z, s) { const L = level(); for (let i = 0; i < 700 * s; i++) { const a = rnd(TAU), r = rnd(.02, .25) * s, v = rnd(.4, 1.6) * s; S.emit(x + Math.cos(a) * r, L + .02, z + Math.sin(a) * r, Math.cos(a) * v * .6, rnd(1.5, 4.2) * Math.sqrt(s), Math.sin(a) * v * .6, rnd(.8, 1.6)); }
      for (let i = 0; i < 60 * s; i++) { const a = rnd(TAU), r = rnd(.05, .5) * s; S.emit(x + Math.cos(a) * r, L + rnd(.05, .4) * s, z + Math.sin(a) * r, Math.cos(a) * .15, rnd(.1, .4), Math.sin(a) * .15, rnd(2.5, 4), 1); } } };
  ctx.steps.push(dt => { const L = level(); let k = 0; for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.age += dt; if (p.age > p.life || (p.y < L - .02 && !p.mist)) { P.splice(i, 1); continue; } const dr = p.mist ? .6 : .2; p.vx *= 1 - dr * dt; p.vz *= 1 - dr * dt; p.vy -= (p.mist ? .15 : 4.9) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
    for (const p of P) { pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; aa[k * 2] = (1 - p.age / p.life) * (p.mist ? .5 : .95); aa[k * 2 + 1] = p.mist; k++; }
    geo.setDrawRange(0, k); geo.attributes.position.needsUpdate = geo.attributes.aa.needsUpdate = true; mat.uniforms.uPx.value = ctx.renderer.domElement.height / (2 * Math.tan(ctx.camera.fov * Math.PI / 360)); });
  return S;
}

/* ---------------- audio: each world gets a bus on the engine's shared context ---------------- */
export function makeAudio() {
  const AUD = E.AUD, w = E.world, A = { ctx: null, srcs: [] };
  const start = c => { if (A.ctx || !E.world || E.world !== w) return; A.ctx = c; A.out = c.createGain(); A.out.gain.value = .5; A.out.connect(AUD.master); A.noise = AUD.noise;
    A.loop = (type, ff, q, vol) => { const s = c.createBufferSource(); s.buffer = AUD.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = ff; f.Q.value = q; const g = c.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(A.out); s.start(); A.srcs.push(s); return g; };
    A.onStart && A.onStart(A); };
  A.get = () => { const c = AUD.get(); if (c && !A.ctx) start(c); return A.ctx; };
  if (AUD.ctx) setTimeout(() => A.get(), 0);
  AUD.onStart.push(start);
  w.disposers.push(() => { const i = AUD.onStart.indexOf(start); if (i >= 0) AUD.onStart.splice(i, 1); if (!A.ctx) return; const t = A.ctx.currentTime; A.out.gain.setTargetAtTime(0, t, .12); setTimeout(() => { A.srcs.forEach(s => { try { s.stop(); } catch (e) {} }); A.out.disconnect(); }, 700); });
  A.burst = (dur, ff, vol, type = 'lowpass', when = 0) => { const c = A.get(); if (!c) return; const t = c.currentTime + when, s = c.createBufferSource(); s.buffer = A.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(ff, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, ff * .2), t + dur); const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f); f.connect(g); g.connect(A.out); s.start(t, Math.random()); s.stop(t + dur + .1); };
  // thunder: a crack, then rolling low rumbles stacked with a pitch-falling sub, soft-clipped for weight
  const clip = c => { if (A.shaper) return A.shaper; const w = c.createWaveShaper(), k = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; k[i] = Math.tanh(x * 2.2); } w.curve = k; w.connect(A.out); return A.shaper = w; };
  const nz = (c, t, dur, type, f0, f1, q, vol, att = .01, out) => { const s = c.createBufferSource(); s.buffer = A.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); f.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + .1); };
  const sub = (c, t, f0, f1, dur, vol, out) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .05); };
  A.thunder = (g = 1, when = 0) => { const c = A.get(); if (!c) return; const t = c.currentTime + when, o = clip(c);
    nz(c, t, .14, 'bandpass', 3200, 900, .7, .55 * g, .003, A.out); nz(c, t + .02, .5, 'highpass', 1800, 600, .5, .2 * g, .005, A.out);
    for (let k = 0; k < 4; k++) nz(c, t + .05 + k * rnd(.12, .45), rnd(3.5, 6), 'lowpass', rnd(140, 220), 32, .8, rnd(.35, .55) * g, rnd(.04, .2), o);
    sub(c, t + .03, 52, 21, 3.2, .7 * g, o); };
  A.boom = (g = 1, when = 0) => { const c = A.get(); if (!c) return; const t = c.currentTime + when, o = clip(c);
    nz(c, t, .1, 'highpass', 6000, 2500, .5, .8 * g, .002, A.out); nz(c, t, .45, 'bandpass', 2400, 400, .6, .6 * g, .004, A.out);
    sub(c, t, 46, 16, 4.5, 1.0 * g, o); sub(c, t + .02, 92, 30, 1.6, .45 * g, o); nz(c, t, 9, 'lowpass', 260, 28, .9, .9 * g, .02, o); nz(c, t + .1, 12, 'lowpass', 120, 25, .7, .6 * g, .4, o);
    A.thunder(.7 * g, when + .55); A.thunder(.5 * g, when + 1.6); };
  A.tone = (f0, f1, dur, vol, when = 0, type = 'sine') => { const c = A.get(); if (!c) return; const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * .8); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(A.out); o.start(t); o.stop(t + dur + .05); };
  return A;
}

/* ---------------- palms: curved bark trunks and drooping fronds of leaf cards; returns [trunks, fronds] geometries ---------------- */
export const LEAF_RECTS = [[.01, .52, .15, .46], [.17, .52, .15, .46], [.34, .52, .15, .46], [.51, .52, .15, .46], [.68, .52, .15, .46], [.01, .02, .15, .46], [.17, .02, .15, .46], [.34, .02, .15, .46]];
export function palmGeometry(spots, o = {}) { // spots: [x, ground, z, scale]
  const trunks = [], fronds = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), nF = o.fronds || 11;
  spots.forEach(([x, h, z, s = 1]) => { const lean = new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1)).normalize().multiplyScalar(rnd(.12, .45)), Ht = rnd(.85, 1.3) * s, pts = [];
    for (let k = 0; k <= 8; k++) { const f = k / 8; pts.push(new THREE.Vector3(x + lean.x * f * f * Ht, h + f * Ht, z + lean.z * f * f * Ht)); }
    trunks.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, .024 * s, 6, false)); const top = pts[8];
    for (let fI = 0; fI < nF; fI++) { const az = fI / nF * TAU + rnd(-.2, .2), L = rnd(.5, .72) * s, droop = rnd(.55, .95);
      for (let k = 1; k <= 16; k++) { const f = k / 16, px = Math.cos(az) * L * f, pz = Math.sin(az) * L * f, py = Math.sin(f * Math.PI * .55) * .2 * s - f * f * droop * .5 * s;
        [-1, 1].forEach(sd => { const dir = new THREE.Vector3(Math.cos(az), -.2 - f * .6, Math.sin(az)).normalize(), side = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az)).multiplyScalar(sd), lf = side.clone().add(new THREE.Vector3(0, -.55, 0)).add(dir.clone().multiplyScalar(.4)).normalize();
          q.setFromUnitVectors(up, lf); m.compose(new THREE.Vector3(top.x + px, top.y + py, top.z + pz), q, new THREE.Vector3(s, s, s)); fronds.push(leafQuad(.034, .2 * (1 - f * .5), LEAF_RECTS[(k + fI) % 5], m)); }); } } });
  return [trunks.length ? mergeGeometries(trunks) : null, fronds.length ? mergeGeometries(fronds) : null];
}
/* swaying foliage: wind-driven sway for instanced or merged leaf materials */
export function sway(m, U, amp = .02) { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); Object.assign(sh.uniforms, { uTime: U.uTime, uWind: U.uWind });
  sh.vertexShader = 'uniform float uTime, uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  { vec3 wp0 = position; float ph = wp0.x * 1.7 + wp0.z * 2.3; transformed.x += sin(uTime * (1.1 + uWind * .5) + ph) * ${amp.toFixed(3)} * (.3 + uWind * .8); transformed.z += cos(uTime * 1.3 + ph * 1.3) * ${(amp * .6).toFixed(3)} * (.3 + uWind * .8); }`); };
  m.customProgramCacheKey = () => 'sway' + amp; return m; }
