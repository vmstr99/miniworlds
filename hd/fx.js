/* Weather and life shared by every world, driven by the deck: rain streaks held inside the diorama's invisible glass case,
   lightning in a storm, birds wheeling overhead, and the wind and rain beds. Worlds can take over a control themselves
   (the Alps turn RAIN into snow) by defining api.rain, api.life and so on. */
import { THREE, TAU, R, rnd, clamp, lerp, LO } from './core.js';

export function createFX(E) {
  const { scene, U, MOD } = E;
  /* rain: GPU line streaks; the draw range sets the density */
  const N = LO ? 5000 : 11000, pos = new Float32Array(N * 6), ee = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { const x = rnd(-4.95, 4.95), y = rnd(0, 10), z = rnd(-4.95, 4.95); pos.set([x, y, z, x, y, z], i * 6); ee[i * 2] = 0; ee[i * 2 + 1] = 1; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); rg.setAttribute('e', new THREE.BufferAttribute(ee, 1)); rg.setDrawRange(0, 0);
  const RU = { uT: U.uTime, uWind: U.uWind, uSun: U.uSun, uFloor: { value: 0 }, uTop: { value: 8 } };
  const rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: RU,
    vertexShader: `attribute float e; uniform float uT, uWind, uFloor, uTop; varying float vA;
      void main(){ vec3 p = position; float sd = fract(p.x * 13.17 + p.z * 7.31), sp = 7. + sd * 3., H = uTop - uFloor;
        float y = uTop - mod(p.y * H * .1 + uT * sp, H); float sl = .12 + uWind * .16; p.x = mod(p.x + 4.95 + (uTop - y) * sl, 9.9) - 4.95;
        p.y = y + e * .22; p.x += e * sl * .22; vA = (1. - e * .85) * step(uFloor, y); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
    fragmentShader: `uniform float uSun; varying float vA; void main(){ gl_FragColor = vec4(vec3(.72, .78, .86) * (.35 + .5 * uSun), vA * .22); }` }));
  rain.frustumCulled = false; rain.renderOrder = 3; scene.add(rain);

  /* birds: a body and two wing panels per bird; the wings flap (or glide, for vultures) in the vertex shader */
  const NB = 28, bg = (() => { const p = [], w = [];
    const tri = (a, b, c, wa, wb, wc) => { p.push(...a, ...b, ...c); w.push(wa, wb, wc); };
    [-1, 1].forEach(s => { tri([0, 0, -.05], [0, 0, .06], [s * .5, .02, -.02], 0, 0, 1); tri([0, 0, .06], [s * .5, .02, -.02], [s * .26, .01, .07], 0, 1, .55); });
    tri([0, .015, -.16], [-.04, 0, .1], [.04, 0, .1], 0, 0, 0); tri([0, -.012, -.16], [.04, 0, .1], [-.04, 0, .1], 0, 0, 0); tri([0, 0, .1], [-.07, 0, .2], [.07, 0, .2], 0, 0, 0);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('wing', new THREE.Float32BufferAttribute(w, 1)); g.computeVertexNormals(); return g; })();
  const BU = { uT: U.uTime, uGlide: { value: 0 } };
  const bm = new THREE.MeshStandardMaterial({ color: '#e8e6e0', roughness: .8, side: THREE.DoubleSide });
  bm.onBeforeCompile = sh => { Object.assign(sh.uniforms, BU); sh.vertexShader = 'attribute float wing; uniform float uT, uGlide;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    { float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7; float f = sin(uT * mix(9., 2.2, uGlide) + ph) * mix(1., .18, uGlide); transformed.y += wing * f * .32; transformed.x *= 1. - wing * abs(f) * .12; }`); };
  const birds = new THREE.InstancedMesh(bg, bm, NB); birds.count = 0; birds.frustumCulled = false; birds.castShadow = true; scene.add(birds);
  const BS = Array.from({ length: NB }, (_, i) => ({ cx: rnd(-2, 2), cz: rnd(-2, 2), r: rnd(1.6, 4.2), y: rnd(4.2, 7.5), a: rnd(TAU), sp: rnd(.25, .45) * (R() < .5 ? -1 : 1), bob: rnd(TAU) }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), eu = new THREE.Euler();

  /* sound beds */
  let bed = null; const startBed = c => { if (bed) return; const A = E.AUD, out = c.createGain(); out.gain.value = .6; out.connect(A.master);
    const loop = (type, ff, qq) => { const s = c.createBufferSource(); s.buffer = A.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = ff; f.Q.value = qq; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(out); s.start(); return g; };
    bed = { c, out, rain: loop('bandpass', 1700, .5), wind: loop('bandpass', 420, 1.6) }; };
  E.AUD.onStart.push(startBed); if (E.AUD.ctx) startBed(E.AUD.ctx);
  const thunder = () => { const c = E.AUD.ctx; if (!c || !bed) return; const t = c.currentTime + rnd(.2, .9), s = c.createBufferSource(); s.buffer = E.AUD.noise; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(45, t + 3); const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.55, t + .08); g.gain.exponentialRampToValueAtTime(.0001, t + 3.2); s.connect(f); f.connect(g); g.connect(bed.out); s.start(t, Math.random()); s.stop(t + 3.4); };

  let rainK = 0, nextBolt = 3;
  const fx = {
    step(dt) { const w = E.world; if (!w) return; const meta = w.meta || {}, own = w.api && w.api.rain;
      // rain fills the case down to the water (or ground) line
      rainK = lerp(rainK, own ? 0 : MOD.rain / 3, 1 - Math.exp(-dt * 1.5)); rg.setDrawRange(0, Math.round(N * rainK * rainK) * 2); rain.visible = rainK > .01;
      RU.uFloor.value = (w.waterLevel ?? 0) - .02; RU.uTop.value = 8;
      if (MOD.rain === 3 && MOD.clouds >= 2 && !own) { nextBolt -= dt; if (nextBolt < 0) { nextBolt = rnd(3.5, 9); E.skyU.uFlash.value = rnd(.5, .9); thunder(); } }
      // birds circle, rising and falling; vultures glide in long slow rings; hidden at night
      const vult = meta.birds === 'vulture', dark = E.sun.intensity < .9, want = (meta.birds === 'none' || dark) ? 0 : [0, 5, 12, 24][MOD.life], gust = U.uWind.value;
      BU.uGlide.value = vult ? 1 : 0; bm.color.set(vult ? '#2a221e' : '#ecebe6'); birds.count = want;
      for (let i = 0; i < want; i++) { const b = BS[i]; b.a += b.sp * dt * (vult ? .55 : 1) * (1 + gust * .15); const r = b.r * (vult ? 1.1 : 1), x = b.cx + Math.cos(b.a) * r, z = b.cz + Math.sin(b.a) * r, y = b.y + Math.sin(E.clock * .4 + b.bob) * .25 + (vult ? .6 : 0);
        const sg = Math.sign(b.sp), dir = Math.atan2(Math.sin(b.a) * sg, -Math.cos(b.a) * sg); q.setFromEuler(eu.set(0, dir, -Math.sign(b.sp) * (vult ? .3 : .2)));
        m4.compose(v.set(x, y, z), q, sc.setScalar(vult ? .95 : .55)); birds.setMatrixAt(i, m4); }
      birds.instanceMatrix.needsUpdate = true;
      if (bed) { const t = bed.c.currentTime; bed.rain.gain.setTargetAtTime(own ? 0 : [0, .05, .11, .2][MOD.rain], t, .4); bed.wind.gain.setTargetAtTime([0, .025, .07, .14][MOD.wind], t, .5); } },
    mod() {} };
  E.fx.push(fx); return fx;
}
