/* Sea of Dunes: a star dune over a buried court, barchans and transverse ridges marching downwind, a terraced sandstone
   jebel with a natural arch, an oasis whose blue hole breaks the front cut wall, half-buried colossi (a head, an obelisk,
   a colonnade, a gateway), a caravan and a Bedouin camp, vultures overhead and dust that never stops blowing.
   In the blue hole, a stair descends into the dark past a drowned stone face. EVENT: a magnitude-nine earthquake drains the
   great dune into a sunken court around a lost basilica, carved and time-worn, with sand pouring from every window;
   a few seconds later the sand flows back and buries it again. */
import { THREE, mergeGeometries, TAU, R, rnd, pick, clamp, lerp, sm, Q, LO, QN, makeNoise, GLSL_NOISE, TRI, createEngine, makeHeightfield, DZ, SLAB, makeWalls, wallMaterial, makeWater, crownGeometry, makeAudio, makeSnowfall, underwater, palmGeometry, sway, LEAF_RECTS } from './core.js';

export const META = { name: 'Sea of Dunes', line: 'A star dune, a sandstone jebel, an oasis and the broken giants of a forgotten city, half swallowed by the sand. Press Earthquake.', era: 'Great Sand Sea · the hour before dusk', ev: 'Earthquake', preset: { time: 2, clouds: 0, rain: 0, wind: 2, glow: 1, life: 2 }, birds: 'vulture' };

export function build() {
  const N = makeNoise(+(Q.get('seed') || 31)), S = 10, H5 = 5, DEPTH = SLAB, NORM = 2.2, WL = .12;
  const ctx = createEngine({ cam: { target: [-.2, 1.0, -.2], dist: 46, pol: 1.02, az: Math.PI / 4, min: 9, max: 70 }, sunRef: 3.4, bloom: [.12, .5, 1.7], sat: 1.05,
    looks: { noon: { sky: 'noon', dir: [-.42, 1, .6], col: '#fff0dc', I: 3.6, env: .9, exp: 1.0 }, gold: { sky: 'gold', dir: [-.95, .24, .22], col: '#ff9a52', I: 3.8, env: .62, exp: 1.0, warm: 1 },
      quake: { sky: 'storm', dir: [-.8, .38, .3], col: '#ffb070', I: 1.9, env: .45, exp: 1.12, warm: .7, skyI: .55 } } });
  const { island, tex, U, MATS } = ctx; ctx.waterLevel = WL;
  Object.assign(ctx.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, far: 90 }); ctx.sun.shadow.camera.updateProjectionMatrix();
  const T = { sand: tex('sand_diff.jpg'), sandN: tex('sand_nor.jpg', false), rock: tex('rock_diff.jpg'), rockN: tex('rock_nor.jpg', false), lime: tex('lime_diff.jpg'), limeN: tex('lime_nor.jpg', false), grass: tex('mtn_diff.jpg'), grassN: tex('mtn_nor.jpg', false),
    leaf: tex('leaf_diff.jpg', true, false), leafA: tex('leaf_alpha.jpg', false, false), leafN: tex('leaf_nor.jpg', false, false), bark: tex('bark_diff.jpg'), barkN: tex('bark_nor.jpg', false), plaster: tex('plaster_diff.jpg') };

  /* the land */
  const C = [-.5, -.35], FLOOR = .02, R0 = 1.8, R1 = 2.7, O = [3.85, 3.7], J = [-3.4, -3.3], WD = [.7071, .7071];
  const BAR = [[2.3, -1.5, .95], [.9, -3.5, .75], [3.5, .5, .62], [-3.7, 2.4, .6], [-1.6, 3.6, .55]];
  const sandH = (x, z) => { const u = x / H5, v = z / H5; let h = .48 + N.fbm(u * 1.6 + 3, v * 1.6) * .2 + N.fbm(u * 4, v * 4) * .05;
    const al = x * WD[0] + z * WD[1], ac = -x * WD[1] + z * WD[0], s = ((al * .45 + .3 * N.fbm(ac * .35, al * .15) + 10) % 1 + 1) % 1, pr = s < .78 ? s / .78 : (1 - s) / .22;
    h += .42 * Math.pow(pr, 1.5) * sm(N.fbm(ac * .4 + 7, al * .3) * 1.4 + .6);
    const dx = x - C[0], dz = z - C[1], r = Math.hypot(dx, dz), a = Math.atan2(dz, dx) + .45 * Math.sin(r * 1.4), Ra = .95 + 2.1 * Math.pow(Math.abs(Math.cos(a * 2.5 + .7)), 3) + .3 * N.fbm(a * 2, 3);
    const hs = 2.6 * Math.pow(Math.max(0, 1 - r / Ra), 1.55) + .5 * Math.exp(-r * r / .35); h = h * (1 - .5 * sm(hs)) + hs;
    BAR.forEach(([bx, bz, s]) => { const ex = x - bx, ez = z - bz, la = ex * WD[0] + ez * WD[1], lc = -ex * WD[1] + ez * WD[0], la2 = la - .55 * lc * lc / s, e1 = (la2 / s) ** 2 + (lc / (1.15 * s)) ** 2;
      let hb = .72 * s * Math.pow(Math.max(0, 1 - e1), 1.3); const e2 = ((la2 - .5 * s) / (.62 * s)) ** 2 + (lc / (.72 * s)) ** 2; hb -= .8 * s * Math.max(0, 1 - e2); h += Math.max(0, hb); });
    return h; };
  const jebelH = (x, z) => { let best = 0;
    [[J[0], J[1], 1.75, 3.1], [-1.25, -4.25, .55, 2.2], [-4.35, -1.35, .32, 2.6]].forEach(([jx, jz, jr, jh], q) => { const rj = Math.hypot(x - jx, z - jz) + N.fbm(x * 1.4 + q * 5, z * 1.4) * .4 * jr;
      let hj = jh * sm((jr - rj) / (.18 + jr * .08)); const st = .42, qq = hj / st; hj = (Math.floor(qq) + sm((qq - Math.floor(qq) - .72) / .28)) * st; hj += N.ridge(x * 3, z * 3) * .14 * sm(hj); best = Math.max(best, hj); });
    return best; };
  const oasisE = (x, z) => Math.hypot((x - O[0]) / 1.65, (z - O[1]) / 1.4) + N.fbm(x * 1.2, z * 1.2) * .22;
  function height(u, v) { const x = u * H5, z = v * H5; let h = Math.max(sandH(x, z), jebelH(x, z));
    const e = oasisE(x, z); h = lerp(h, WL + .04 + N.fbm(x * 3, z * 3) * .05, sm((1.45 - e) / .55)); h = lerp(h, -3.2 + N.fbm(x * 2 + 4, z * 2) * .3, sm((.95 - e) / .4));
    return h; }
  const hf = makeHeightfield(S, 320, height), { hAt, normAt } = hf;
  { const p = hf.geo.attributes.position, zn = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), h = p.getY(i), jh = jebelH(x, z); zn[i * 2] = jh > .25 && jh >= sandH(x, z) - .08 ? sm((jh - .2) / .3) : 0; const e = oasisE(x, z); zn[i * 2 + 1] = sm((1.95 - e) / .45) * (h > WL + .015 ? 1 : 0); }
    hf.geo.setAttribute('zn', new THREE.BufferAttribute(zn, 2)); }
  const RU = { uRev: { value: 0 } };
  const hR = (x, z) => { const m = RU.uRev.value * (1 - sm((Math.hypot(x - C[0], z - C[1]) - R0) / (R1 - R0))); return lerp(hAt(x, z), FLOOR, m); };
  const terrMat = new THREE.MeshStandardMaterial({ roughness: .95 }); MATS.push(terrMat);
  terrMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, RU, { tSand: { value: T.sand }, tSandN: { value: T.sandN }, tRock: { value: T.rock }, tRockN: { value: T.rockN }, tLime: { value: T.lime }, tLimeN: { value: T.limeN }, tGrass: { value: T.grass }, tGrassN: { value: T.grassN } });
    sh.vertexShader = 'uniform float uRev; attribute vec2 zn; varying vec2 vZn; varying vec3 vWP; varying vec3 vWN; varying float vRv;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float rd = length(transformed.xz - vec2(${C[0]}, ${C[1]})); float rm = uRev * (1. - smoothstep(${R0.toFixed(2)}, ${R1.toFixed(2)}, rd)); transformed.y = mix(transformed.y, ${FLOOR.toFixed(3)}, rm); vRv = rm; }
      vZn = zn; vWP = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = `uniform sampler2D tSand, tSandN, tRock, tRockN, tLime, tLimeN, tGrass, tGrassN; uniform float uTime, uSun, uCloud, uWind, uRev; varying vec2 vZn; varying vec3 vWP; varying vec3 vWN; varying float vRv; float mR, mG, mW, flag; float ripP;\n` + GLSL_NOISE + TRI + sh.fragmentShader
      .replace('#include <map_fragment>', `
  vec3 P = vWP, Nn = normalize(vWN); if (vRv > .002) { vec3 fn = normalize(cross(dFdx(vWP), dFdy(vWP))); if (fn.y < 0.) fn = -fn; Nn = normalize(mix(Nn, fn, smoothstep(.0, .3, vRv) * (1. - smoothstep(.97, 1., vRv)))); }
  vec3 w = triW(Nn); float slope = 1. - Nn.y;
  float al = dot(P.xz, vec2(.7071)); ripP = al * 44. + fbm(P.xz * 2.6) * 7. + fbm(P.xz * .7) * 4.;
  vec3 sand = tri2(tSand, P, w, .3) * vec3(1.2, .8, .52); sand *= .93 + .07 * sin(ripP) * (1. - smoothstep(.12, .4, slope)); sand *= mix(1., .86, smoothstep(.3, .6, fbm(P.xz * .35 + 3.)));
  vec3 stone = mix(tri2(tLime, P, w, .22), tri2(tRock, P, w, .3), .4) * vec3(1.15, .72, .46); stone *= .8 + .2 * sin(P.y * 9. + fbm(P.xz * .8) * 2.5) ; stone = mix(stone, stone * vec3(1.1, .8, .62), smoothstep(.4, .7, fbm(vec2(P.x + P.z, P.y) * 1.5)));
  vec3 grass = tri2(tGrass, P, w, .4) * vec3(.6, .8, .4);
  mR = vZn.x * smoothstep(.08, .3, slope + vZn.x * .15); mG = vZn.y * (1. - smoothstep(.35, .6, slope)) * smoothstep(.3, .7, fbm(P.xz * 2.2) + .3); mW = smoothstep(${(WL + .1).toFixed(3)}, ${(WL - .01).toFixed(3)}, P.y);
  vec3 col = sand; col = mix(col, mix(stone, sand * .95, smoothstep(.2, .04, slope) * .55), mR); col = mix(col, grass, mG); col = mix(col, sand * vec3(.62, .55, .45), mW);
  float dep = ${WL.toFixed(3)} - P.y; if (dep > 0.) { col = mix(col, col * vec3(.5, .62, .6), smoothstep(0., 1.5, dep)); col += vec3(.75, .95, .9) * caustic(P.xz * 1.3, uTime) * exp(-dep * 1.2) * .45 * uSun; }
  { vec2 cq = (P.xz - vec2(${C[0]}, ${C[1]})); vec2 rq = mat2(.7071, -.7071, .7071, .7071) * cq * 4.2; vec2 fr = abs(fract(rq + vec2(step(.5, fract(rq.y * .5)) * .5, 0.)) - .5); float jt = smoothstep(.43, .47, max(fr.x, fr.y));
    vec3 fl = tri2(tLime, P, w, .5) * vec3(1.1, .9, .7) * (.85 + .3 * hh(floor(rq + vec2(step(.5, fract(rq.y * .5)) * .5, 0.)))); fl *= 1. - jt * .55; flag = smoothstep(.85, 1., vRv) * smoothstep(.2, .02, P.y - ${FLOOR.toFixed(3)}); col = mix(col, mix(fl, sand, smoothstep(.55, .8, fbm(P.xz * 3.)) * .6), flag); }
  col *= cloudShade(P.xz, uTime, uCloud);
  diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(.95, .6, mW);')
      .replace('#include <normal_fragment_maps>', `{ vec3 nS = triN(tSandN, vWP, Nn, w, .3); vec2 rg = vec2(.7071) * cos(ripP) * .22 * (1. - smoothstep(.12, .4, slope)) * (1. - mR) * (1. - flag); nS = normalize(nS + vec3(rg.x, 0., rg.y));
        vec3 nT = normalize(mix(mix(nS, triN(tRockN, vWP, Nn, w, .3), mR), triN(tGrassN, vWP, Nn, w, .4), mG * .7)); normal = normalize((viewMatrix * vec4(nT, 0.)).xyz); }`); };
  const terr = new THREE.Mesh(hf.geo, terrMat); terr.castShadow = terr.receiveShadow = true; island.add(terr);
  const walls = makeWalls(hf, DEPTH, WL, NORM); const wl = new THREE.Mesh(walls.land, wallMaterial(ctx, T.rock, T.rockN, [.9, .7, .54])); wl.castShadow = wl.receiveShadow = true; island.add(wl);
  const water = makeWater(ctx, hf, { level: WL, att: '#1aa0a8', attDist: 1.0, deep: '#063a5c', shallow: '#1c8c8c', glint: 1.1, norm: NORM, wallK: 4.2, wave: .012 });
  island.add(new THREE.Mesh(walls.water, water.wallMat));

  /* carved sandstone: triplanar stone with moldings, flutes and lattice relief cut into it, weathered, sand-dusted on every ledge */
  const ORG = { value: new THREE.Vector3() };
  const carved = (tint, org = { value: new THREE.Vector3() }, fine = 1) => { const m = new THREE.MeshStandardMaterial({ roughness: .9, color: tint }); MATS.push(m);
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { tLime: { value: T.lime }, tLimeN: { value: T.limeN }, uOrg: org });
      sh.vertexShader = 'uniform vec3 uOrg; varying vec3 vCP; varying vec3 vCN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCP = (modelMatrix * vec4(transformed, 1.)).xyz - uOrg; vCN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = 'uniform sampler2D tLime, tLimeN; varying vec3 vCP; varying vec3 vCN;\n' + GLSL_NOISE + TRI + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 P = vCP, Nc = normalize(vCN), w = triW(Nc); vec3 st = tri2(tLime, P, w, .9) * vec3(1.18, .82, .56);
    vec2 hz = abs(Nc.x) > abs(Nc.z) ? P.zy : P.xy; float vert = 1. - abs(Nc.y);
    float yb = P.y * ${(12.5 * fine).toFixed(2)}, g = smoothstep(.36, .44, abs(fract(yb) - .5)), G = smoothstep(.44, .49, abs(fract(P.y * ${(3.1 * fine).toFixed(2)}) - .5));
    float fl = smoothstep(.40, .47, abs(fract(hz.x * ${(16. * fine).toFixed(1)}) - .5)) * step(.5, fract(P.y * ${(1.55 * fine).toFixed(2)} + .25));
    float lat = smoothstep(.55, .9, abs(sin(hz.x * ${(70. * fine).toFixed(0)}.) * sin(hz.y * ${(70. * fine).toFixed(0)}.))) * (1. - step(.5, fract(P.y * ${(1.55 * fine).toFixed(2)} + .25)));
    float wear = fbm(P.xz * 3. + P.y * 2.3), grime = smoothstep(.5, .9, fbm(vec2(hz.x * 14., P.y * 1.4)));
    st *= mix(1., .5, (g * .7 + G) * vert) * mix(1., .72, (fl + lat * .6) * vert) * (.82 + .32 * wear) * (1. - .28 * grime * vert);
    st = mix(st, st * vec3(.78, .74, .7), smoothstep(.55, .85, fbm(P.xz * 1.3 + P.y)));
    st = mix(st, vec3(.82, .6, .38), smoothstep(.55, .92, Nc.y) * (.55 + .45 * wear));
    diffuseColor.rgb *= st; }`)
        .replace('#include <normal_fragment_maps>', `{ vec3 Nc = normalize(vCN); vec3 nT = triN(tLimeN, vCP, Nc, triW(Nc), .9); float e = .004, yb = vCP.y * ${(12.5 * fine).toFixed(2)};
          float d0 = smoothstep(.36, .44, abs(fract(yb) - .5)), d1 = smoothstep(.36, .44, abs(fract(yb + e * ${(12.5 * fine).toFixed(2)}) - .5)); nT = normalize(nT + vec3(0., (d1 - d0) / e * .004, 0.) * (1. - abs(Nc.y)));
          normal = normalize((viewMatrix * vec4(nT, 0.)).xyz); }`); };
    m.customProgramCacheKey = () => 'carved' + fine; return m; };
  const ruinM = carved('#f2e2cc'), dark = new THREE.MeshStandardMaterial({ color: '#0a0705', roughness: 1 }); MATS.push(dark);
  const add = (g, m, x, y, z, par = island, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; par.add(o); return o; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s).translate(0, h / 2, 0);

  /* half-buried giants */
  { const g = new THREE.Group(), head = new THREE.SphereGeometry(.42, 40, 30); head.scale(.82, 1.05, .95); add(head, ruinM, 0, 0, 0, g);
    add(new THREE.BoxGeometry(.1, .22, .14), ruinM, 0, -.02, .38, g, -.25); add(new THREE.BoxGeometry(.36, .05, .1), ruinM, 0, .14, .33, g); add(new THREE.BoxGeometry(.2, .045, .07), ruinM, 0, -.2, .35, g);
    [-.12, .12].forEach(x => add(new THREE.BoxGeometry(.1, .04, .04), dark, x, .07, .36, g));
    const nem = new THREE.CylinderGeometry(.5, .62, .95, 28, 1, true, Math.PI * .62, Math.PI * 1.76); add(nem, ruinM, 0, -.1, -.04, g).material.side = THREE.DoubleSide;
    add(new THREE.CylinderGeometry(.05, .06, .3, 10), ruinM, 0, .55, .12, g, .3); const x = 1.75, z = -1.05; g.position.set(x, hAt(x, z) + .02, z); g.rotation.set(.18, -.55, .32); g.scale.setScalar(1.15); island.add(g); }
  { const x = 2.65, z = .95, g = new THREE.Group(); add(new THREE.CylinderGeometry(.075, .115, 1.7, 4).rotateY(Math.PI / 4).translate(0, .85, 0), ruinM, 0, 0, 0, g); add(new THREE.ConeGeometry(.085, .16, 4).rotateY(Math.PI / 4).translate(0, 1.78, 0), ruinM, 0, 0, 0, g);
    g.position.set(x, hAt(x, z) - .45, z); g.rotation.set(.12, .3, -.22); island.add(g); }
  { const d = new THREE.Vector3(1, 0, .3).normalize(), x0 = -3.25, z0 = 1.25; for (let k = 0; k < 8; k++) { const x = x0 + d.x * k * .34, z = z0 + d.z * k * .34, h = hAt(x, z);
      if (k === 2 || k === 6) { add(cyl(.06, .068, .8, 14), ruinM, x, h + .05, z, island, Math.PI / 2 - .05, rnd(TAU)); continue; }
      const H = rnd(.75, 1.15), dep = rnd(.15, .5); add(cyl(.06, .068, H, 14), ruinM, x, h - dep, z); add(box(.16, .06, .16), ruinM, x, h - dep + H, z);
      if (k % 3 === 0 && k < 7) add(box(.42, .1, .14).rotateY(-Math.atan2(d.z, d.x)).translate(d.x * .17, 0, d.z * .17), ruinM, x, h - dep + H + .06, z); } }
  { const x = .75, z = 3.05, h = hAt(x, z), g = new THREE.Group(), py = new THREE.CylinderGeometry(.24, .36, 1.3, 4).rotateY(Math.PI / 4).translate(0, .65, 0); py.scale(1.3, 1, .7);
    [-.42, .42].forEach(px => add(py, ruinM, px, 0, 0, g)); add(box(1.25, .14, .3), ruinM, 0, 1.12, 0, g); add(box(.5, .9, .08), dark, 0, 0, -.02, g); g.position.set(x, h - .55, z); g.rotation.set(.04, -Math.PI / 4 + .15, -.05); island.add(g); }
  { const stoneR = new THREE.MeshStandardMaterial({ roughness: .9 }); const tob = terrMat.onBeforeCompile; stoneR.onBeforeCompile = sh => { tob(sh); sh.uniforms.uRev = { value: 0 }; }; // the natural arch shares the jebel's rock, never the quake's bowl
    const g = new THREE.TorusGeometry(.62, .17, 12, 32, Math.PI); { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + N.fbm(p.getX(i) * 4, p.getY(i) * 4) * .35; p.setXYZ(i, p.getX(i), p.getY(i), p.getZ(i) * k); } g.computeVertexNormals(); }
    const zz = new Float32Array(g.attributes.position.count * 2); for (let i = 0; i < zz.length; i += 2) zz[i] = 1; g.setAttribute('zn', new THREE.BufferAttribute(zz, 2));
    const m = new THREE.Mesh(g, stoneR); MATS.push(stoneR); const x = -1.75, z = -2.35; m.position.set(x, hAt(x, z) - .12, z); m.rotation.y = .7; m.scale.set(1.1, 1.25, 1); m.castShadow = m.receiveShadow = true; island.add(m); }

  /* the oasis: date palms, shrubs, a Bedouin camp with a fire */
  const leafMat = sway(new THREE.MeshStandardMaterial({ map: T.leaf, alphaMap: T.leafA, alphaTest: .45, normalMap: T.leafN, side: THREE.DoubleSide, roughness: .65, color: '#c8d8a0' }), U, .015); MATS.push(leafMat);
  const barkM = new THREE.MeshStandardMaterial({ map: T.bark, normalMap: T.barkN, roughness: .9, color: '#b09a80' }); MATS.push(barkM);
  { const spots = []; for (let t = 0; t < 6000 && spots.length < 24 * QN + 4; t++) { const x = rnd(1.6, 4.9), z = rnd(1.4, 4.9), h = hAt(x, z), e = oasisE(x, z); if (e < 1.0 || e > 1.95 || h < WL + .03 || normAt(x, z).y < .8 || spots.some(s => Math.hypot(s[0] - x, s[2] - z) < .22)) continue; spots.push([x, h - .02, z, rnd(.85, 1.25)]); }
    const [tr, fr] = palmGeometry(spots); if (tr) { const a = new THREE.Mesh(tr, barkM), b = new THREE.Mesh(fr, leafMat); a.castShadow = b.castShadow = true; b.receiveShadow = true; island.add(a, b); }
    const bush = []; for (let t = 0; t < 4000 && bush.length < 70 * QN; t++) { const x = rnd(1.4, 4.9), z = rnd(1.2, 4.9), h = hAt(x, z), e = oasisE(x, z); if (e < 1.0 || e > 2.05 || h < WL + .02) continue; bush.push([x, h, z, rnd(.06, .12)]); }
    const im = new THREE.InstancedMesh(crownGeometry(LEAF_RECTS, 50), leafMat, bush.length), m = new THREE.Matrix4(), c = new THREE.Color(); bush.forEach(([x, h, z, s], i) => { m.compose(new THREE.Vector3(x, h + s * .4, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd(TAU), 0)), new THREE.Vector3(s, s * .7, s)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(pick(['#6a7a3a', '#7a8848', '#5a6a32']))); });
    im.castShadow = im.receiveShadow = true; island.add(im); }
  const fireL = new THREE.PointLight('#ff8a3a', 0, 5, 1.6);
  { const cx = 2.0, cz = 2.45, h = hAt(cx, cz), cloth = [['#5a3a2a', 0], ['#7a2e22', 1.3]];
    cloth.forEach(([col, k]) => { const tm = new THREE.MeshStandardMaterial({ color: col, roughness: .95, side: THREE.DoubleSide }); MATS.push(tm); const x = cx + Math.cos(k) * .38, z = cz + Math.sin(k) * .38, s = new THREE.Shape(); s.moveTo(-.22, 0); s.lineTo(-.12, .16); s.lineTo(.12, .16); s.lineTo(.22, 0);
      add(new THREE.ExtrudeGeometry(s, { depth: .3, bevelEnabled: false }).translate(0, 0, -.15), tm, x, hAt(x, z) - .01, z, island, 0, k + .4); });
    const fm = ctx.glowMat(new THREE.MeshStandardMaterial({ color: '#201008', emissive: '#ff7a28', emissiveIntensity: 4 }), 8); const fire = add(new THREE.ConeGeometry(.035, .09, 8).translate(0, .045, 0), fm, cx, h, cz); fire.castShadow = false;
    fireL.position.set(cx, h + .25, cz); island.add(fireL); }

  /* the caravan: camels plodding across the erg */
  const camelM = new THREE.MeshStandardMaterial({ color: '#a8835a', roughness: .9 }); MATS.push(camelM);
  const camelG = (() => { const parts = [], E = (rx, ry, rz, x, y, z) => { const g = new THREE.SphereGeometry(1, 12, 8); g.scale(rx, ry, rz); g.translate(x, y, z); return g.toNonIndexed(); };
    parts.push(E(.16, .08, .07, 0, .26, 0), E(.07, .07, .055, -.01, .34, 0), E(.03, .1, .03, .17, .33, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(-.5)), E(.055, .03, .03, .25, .44, 0));
    [[-.1, -.04], [-.1, .04], [.1, -.04], [.1, .04]].forEach(([x, z]) => { const l = new THREE.CylinderGeometry(.012, .01, .22, 5); l.translate(x, .11, z); parts.push(l.toNonIndexed()); }); return mergeGeometries(parts); })();
  const caravan = new THREE.InstancedMesh(camelG, camelM, 5); caravan.castShadow = true; island.add(caravan); ctx.life(caravan, 1);
  const path = new THREE.CatmullRomCurve3([[-4.6, 0, 3.2], [-3, 0, .2], [-1.2, 0, -1.9], [.6, 0, -3.2], [2.8, 0, -3.6], [4.6, 0, -2.4]].map(p => new THREE.Vector3(...p)));

  /* the lost basilica, waiting under the star dune */
  const catM = carved('#f6e6d0', ORG), cat = new THREE.Group(), EM = []; cat.visible = false;
  const B = (w, h, d, x, y, z, m = catM) => add(box(w, h, d), m, x, y, z, cat), Cy = (rt, rb, h, x, y, z, s = 16, m = catM) => add(cyl(rt, rb, h, s), m, x, y, z, cat);
  const archG = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0); return new THREE.ShapeGeometry(s, 10); };
  const win = (w, h, x, y, z, ry, emit = true) => { const m = new THREE.Mesh(archG(w, h), dark); m.position.set(x, y, z); m.rotation.y = ry; cat.add(m); if (emit) EM.push([new THREE.Vector3(x, y + h * .3, z), new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), w]); return m; };
  B(2.35, .1, 3.15, 0, 0, 0); B(2.15, .1, 2.95, 0, .1, 0); B(1.98, .1, 2.78, 0, .2, 0);
  for (let k = 0; k < 6; k++) B(1.1 - k * .02, .05, .08, 0, k * .05, 1.66 - k * .07);
  B(.95, 1.0, 2.0, 0, .3, -.15); { const s = new THREE.Shape(); s.moveTo(-.51, 0); s.lineTo(.51, 0); s.lineTo(0, .34); s.lineTo(-.51, 0); add(new THREE.ExtrudeGeometry(s, { depth: 2.0, bevelEnabled: false }).translate(0, 0, -1.0), catM, 0, 1.3, -.15, cat); }
  B(1.0, .045, 2.04, 0, 1.26, -.15); B(1.0, .03, 2.04, 0, .95, -.15);
  [-1, 1].forEach(sd => { B(.36, .62, 1.9, sd * .66, .3, -.15); add(new THREE.BoxGeometry(.42, .04, 1.95), catM, sd * .62, .97, -.15, cat, 0, 0, -sd * .32);
    for (let k = 0; k < 6; k++) { const z = -1.0 + k * .34; B(.1, .55, .1, sd * .87, .3, z); add(new THREE.ConeGeometry(.075, .16, 4).rotateY(Math.PI / 4).translate(0, .08, 0), catM, sd * .87, .85, z, cat); if (k < 5) { win(.1, .22, sd * .846, .5, z + .17, sd * Math.PI / 2); win(.12, .25, sd * .477, 1.0, z + .17, sd * Math.PI / 2); } } });
  B(1.92, .86, .56, 0, .3, -.6); B(1.98, .04, .6, 0, 1.12, -.6); [-1, 1].forEach(sd => { win(.22, .42, sd * .962, .62, -.6, sd * Math.PI / 2); const s = new THREE.Shape(); s.moveTo(-.3, 0); s.lineTo(.3, 0); s.lineTo(0, .26); s.lineTo(-.3, 0); add(new THREE.ExtrudeGeometry(s, { depth: .02, bevelEnabled: false }), catM, sd * .95, 1.16, -.6, cat, 0, sd * Math.PI / 2); });
  Cy(.4, .42, .38, 0, 1.3, -.6, 32); add(new THREE.TorusGeometry(.43, .028, 8, 40).rotateX(Math.PI / 2), catM, 0, 1.68, -.6, cat); add(new THREE.TorusGeometry(.43, .02, 8, 40).rotateX(Math.PI / 2), catM, 0, 1.31, -.6, cat);
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; win(.07, .17, Math.sin(a) * .421, 1.38, -.6 + Math.cos(a) * .421, a); }
  { const dome = new THREE.SphereGeometry(.42, 36, 18, 0, TAU, 0, Math.PI / 2); dome.scale(1, 1.15, 1); add(dome, catM, 0, 1.68, -.6, cat);
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, pts = []; for (let q = 0; q <= 12; q++) { const th = q / 12 * Math.PI / 2; pts.push(new THREE.Vector3(Math.sin(a) * Math.cos(th) * .43, Math.sin(th) * .485, Math.cos(a) * Math.cos(th) * .43)); }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, .016, 5), catM, 0, 1.68, -.6, cat); }
    Cy(.075, .085, .16, 0, 2.15, -.6, 12); add(new THREE.ConeGeometry(.09, .2, 12).translate(0, .1, 0), catM, 0, 2.31, -.6, cat); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; win(.03, .08, Math.sin(a) * .081, 2.18, -.6 + Math.cos(a) * .081, a, false); } }
  { const ap = new THREE.CylinderGeometry(.47, .47, .9, 24, 1, false, Math.PI / 2, Math.PI).translate(0, .45, 0); add(ap, catM, 0, .3, -1.15, cat); const hd = new THREE.SphereGeometry(.47, 24, 12, Math.PI / 2, Math.PI, 0, Math.PI / 2); add(hd, catM, 0, 1.2, -1.15, cat);
    for (let k = 0; k < 5; k++) { const a = Math.PI / 2 + (k + .5) / 5 * Math.PI; win(.1, .26, Math.sin(a) * .472, .62, -1.15 + Math.cos(a) * .472, a); } }
  B(1.16, 1.25, .12, 0, .3, .95); win(.32, .55, 0, .3, 1.012, 0); add(new THREE.CircleGeometry(.2, 32), dark, 0, 1.13, 1.013, cat); EM.push([new THREE.Vector3(0, 1.08, 1.02), new THREE.Vector3(0, 0, 1), .3]);
  add(new THREE.TorusGeometry(.205, .03, 8, 40), catM, 0, 1.13, 1.02, cat); add(new THREE.TorusGeometry(.065, .02, 8, 24), catM, 0, 1.13, 1.022, cat); for (let k = 0; k < 12; k++) add(new THREE.BoxGeometry(.016, .14, .02), catM, Math.sin(k / 12 * TAU) * .135, 1.13 + Math.cos(k / 12 * TAU) * .135, 1.022, cat, 0, 0, -k / 12 * TAU);
  for (let k = 0; k < 6; k++) { const x = -.55 + k * .22; Cy(.042, .05, .72, x, .3, 1.25, 16); B(.12, .05, .12, x, 1.02, 1.25); B(.11, .04, .11, x, .3, 1.25); }
  B(1.34, .12, .32, 0, 1.07, 1.14); B(1.38, .03, .34, 0, 1.19, 1.14); { const s = new THREE.Shape(); s.moveTo(-.69, 0); s.lineTo(.69, 0); s.lineTo(0, .3); s.lineTo(-.69, 0); add(new THREE.ExtrudeGeometry(s, { depth: .32, bevelEnabled: false }).translate(0, 0, -.16), catM, 0, 1.22, 1.14, cat); }
  [-1, 1].forEach(sd => { const x = sd * .8, z = 1.0; B(.42, 1.05, .42, x, .3, z); win(.12, .3, x, .72, z + .212, 0); win(.12, .3, x + sd * .212, .72, z, sd * Math.PI / 2); B(.48, .05, .48, x, 1.35, z);
    B(.36, .42, .36, x, 1.4, z); [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(a => win(.1, .27, x + Math.sin(a) * .182, 1.47, z + Math.cos(a) * .182, a)); B(.4, .04, .4, x, 1.82, z);
    [[.17, .19, .12], [.135, .16, .12], [.1, .125, .11], [.065, .09, .1]].reduce((y, [rt, rb, hh]) => { Cy(rt, rb, hh, x, y, z, 8); add(new THREE.TorusGeometry(rb, .012, 4, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8), catM, x, y + .005, z, cat); return y + hh; }, 1.86);
    add(new THREE.ConeGeometry(.05, .2, 8).translate(0, .1, 0), catM, x, 2.31, z, cat); });
  cat.rotation.y = Math.PI / 4; cat.position.set(C[0], FLOOR - 1.6, C[1]); island.add(cat);

  /* the blue hole: a stair descending into the dark, a drowned face, broken columns on the ledges */
  { const g = new THREE.Group(), x0 = 4.55, z0 = 3.0; for (let k = 0; k < 14; k++) add(new THREE.BoxGeometry(.5, .12, .22), ruinM, 0, DZ(-.25 - k * .2), -k * .17, g); g.position.set(x0, WL, z0); g.rotation.y = .15; island.add(g);
    const f = new THREE.Group(), hd = new THREE.SphereGeometry(.5, 32, 24); hd.scale(.8, 1.0, .9); add(hd, ruinM, 0, 0, 0, f); add(new THREE.BoxGeometry(.12, .26, .16), ruinM, 0, 0, .44, f); add(new THREE.BoxGeometry(.42, .06, .1), ruinM, 0, .17, .4, f); [-.14, .14].forEach(x => add(new THREE.BoxGeometry(.12, .05, .04), dark, x, .08, .43, f));
    f.position.set(4.35, DZ(-2.35), 4.25); f.rotation.set(-1.1, .4, .3); f.scale.setScalar(1.15); island.add(f);
    for (let k = 0; k < 4; k++) { const x = 4.1 + k * .2, z = 2.7 + k * .35, h = hAt(x, z); add(cyl(.06, .07, rnd(.5, 1.1), 12), ruinM, x, h - .05, z, island, rnd(-.6, .6), 0, rnd(-.6, .6)); } }
  makeSnowfall(ctx, 900, [2.9, 4.95, -2, -.1, 2.6, 4.95], [.75, .85, .8], .28);

  /* blowing sand: grains lifting off the crests and streaming downwind; the same system carries the sand that pours
     from the basilica's windows and slides into the court */
  const SU = { uPx: { value: 1 }, uLit: { value: 1 } };
  const softPts = (n, add2) => { const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 4), s = new Float32Array(n); g.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('pc', new THREE.BufferAttribute(c, 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('ps', new THREE.BufferAttribute(s, 1).setUsage(THREE.DynamicDrawUsage)); g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: SU, vertexShader: 'attribute vec4 pc; attribute float ps; uniform float uPx; varying vec4 vC; void main(){ vC = pc; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * ps / -mv.z, 1.5, 300.); }',
      fragmentShader: `uniform float uLit; varying vec4 vC; void main(){ vec2 d = gl_PointCoord - .5; float r2 = dot(d, d) * 4.; if (r2 > 1.) discard; float a = ${add2 ? 'smoothstep(1., .3, r2)' : 'exp(-r2 * 3.)'}; gl_FragColor = vec4(vC.rgb * uLit, a * vC.a); }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4; island.add(pts); return { g, p, c, s, n, list: [] }; };
  const DUST = softPts(LO ? 2400 : 5200), GRAIN = softPts(LO ? 3000 : 7000, true);
  const emitDust = (x, y, z, vx, vy, vz, life, size, a = .2) => { if (DUST.list.length < DUST.n) DUST.list.push({ x, y, z, vx, vy, vz, age: 0, life, size, a }); };
  const emitGrain = (x, y, z, vx, vy, vz, life, size = .03) => { if (GRAIN.list.length < GRAIN.n) GRAIN.list.push({ x, y, z, vx, vy, vz, age: 0, life, size }); };
  const flush = (S2, col, grow) => { let k = 0; for (const p of S2.list) { const f = p.age / p.life; S2.p[k * 3] = p.x; S2.p[k * 3 + 1] = p.y; S2.p[k * 3 + 2] = p.z; S2.c[k * 4] = col[0]; S2.c[k * 4 + 1] = col[1]; S2.c[k * 4 + 2] = col[2]; S2.c[k * 4 + 3] = (p.a ?? .9) * Math.min(1, p.age * 4) * (1 - f); S2.s[k] = p.size * (1 + f * grow); k++; }
    S2.g.setDrawRange(0, k); S2.g.attributes.position.needsUpdate = S2.g.attributes.pc.needsUpdate = S2.g.attributes.ps.needsUpdate = true; };

  /* the earthquake */
  const AU = makeAudio(); AU.onStart = A => { A.wind = A.loop('bandpass', 520, .8, .04); A.pour = A.loop('bandpass', 2400, .5, 0); A.rum = A.loop('lowpass', 70, .8, 0); };
  let ev = null; const api = { ev: () => { AU.get(); ev = { t: 0, f: {}, t0: ctx.controls.target.clone(), d0: ctx.camera.position.distanceTo(ctx.controls.target) }; }, get evOn() { return !!ev; } };
  const wv = new THREE.Vector3(), nv = new THREE.Vector3(), camT = new THREE.Vector3(), camD = new THREE.Vector3(), CATP = new THREE.Vector3(C[0], FLOOR + .9, C[1]);
  ctx.steps.push(dt => { const t = ctx.clock, wind = U.uWind.value; SU.uPx.value = ctx.renderer.domElement.height / (2 * Math.tan(ctx.camera.fov * Math.PI / 360)); SU.uLit.value = .35 + .75 * U.uSun.value;
    fireL.intensity = U.uGlow.value * (2.5 + Math.sin(t * 13) * .4 + Math.sin(t * 7.3) * .3);
    { const m = new THREE.Matrix4(), q = new THREE.Quaternion(); for (let i = 0; i < 5; i++) { const u = ((t * .006 + i * .018) % 1 + 1) % 1, p = path.getPointAt(u), tg = path.getTangentAt(u), y = hR(p.x, p.z), bob = Math.abs(Math.sin(t * 3.2 + i)) * .012;
      q.setFromEuler(new THREE.Euler(0, -Math.atan2(tg.z, tg.x), Math.sin(t * 3.2 + i) * .04)); m.compose(new THREE.Vector3(p.x, y + bob, p.z), q, new THREE.Vector3(1.6, 1.6, 1.6)); caravan.setMatrixAt(i, m); } caravan.instanceMatrix.needsUpdate = true; }
    if (AU.ctx) AU.wind.gain.setTargetAtTime(.02 + wind * .03, AU.ctx.currentTime, .4);
    let quake = 0, rev = RU.uRev.value;
    if (ev) { ev.t += dt; const e = ev.t, f = ev.f;
      if (!f.go) { f.go = 1; ctx.setLook('quake'); AU.burst(3, 90, .6); AU.tone(32, 26, 3, .35); }
      quake = e < .8 ? e / .8 * .5 : e < 8 ? 1 : Math.max(0, 1 - (e - 8) / 4) * .6 + (e > 16.5 && e < 22 ? .35 : 0); ctx.shake(quake * 2.2);
      if (e > .8 && !f.big) { f.big = 1; AU.burst(14, 80, .75); AU.burst(10, 300, .25, 'bandpass', .4); AU.tone(28, 22, 6, .4); ctx.flash(.18, '#ffd9a8'); }
      if (R() < dt * 4 * quake) AU.burst(.08, 2800, .12 * quake, 'highpass');
      rev = e < 1.5 ? 0 : e < 7.5 ? sm((e - 1.5) / 6) : e < 17 ? 1 : Math.max(0, 1 - sm((e - 17) / 5.5)); RU.uRev.value = rev;
      cat.visible = rev > .001; cat.position.y = FLOOR - 1.6 * (1 - sm(Math.min(1, rev * 1.15)));
      ORG.value.copy(cat.position);
      if (AU.ctx) { AU.rum.gain.setTargetAtTime(.5 * quake, AU.ctx.currentTime, .2); AU.pour.gain.setTargetAtTime((rev > .5 && e < 19 ? .12 : 0) + (e > 17 && e < 22 ? .1 : 0), AU.ctx.currentTime, .3); }
      // sand cascades into the court as it drains, and back over the rim as it refills
      if ((e > 1.5 && e < 8) || (e > 17 && e < 22.5)) for (let i = 0; i < Math.floor(600 * QN * dt + R()); i++) { const a = rnd(TAU), r = rnd(R0 * .9, R1 * 1.05), x = C[0] + Math.cos(a) * r, z = C[1] + Math.sin(a) * r, inn = e < 9 ? -1 : 1;
        emitGrain(x, hR(x, z) + .05, z, Math.cos(a) * inn * rnd(.3, .9), rnd(-.2, .3), Math.sin(a) * inn * rnd(.3, .9), rnd(.8, 1.6), .035); if (R() < .25) emitDust(x, hR(x, z) + .1, z, Math.cos(a) * inn * .3, rnd(.2, .6), Math.sin(a) * inn * .3, rnd(2, 4), rnd(.4, .9), .22); }
      // sand pours from every carved window as the basilica comes up
      if (rev > .45 && e < 19.5) { cat.updateMatrixWorld(); const k = (e < 17 ? 1 : (19.5 - e) / 2.5) * Math.min(1, (rev - .45) * 3);
        EM.forEach(([p, n, w]) => { if (R() > k * dt * 60 * QN) return; wv.copy(p); cat.localToWorld(wv); nv.copy(n).transformDirection(cat.matrixWorld);
          for (let q = 0; q < 3; q++) emitGrain(wv.x + rnd(-w, w) * .35, wv.y, wv.z + rnd(-w, w) * .35, nv.x * rnd(.15, .45), rnd(-.1, .15), nv.z * rnd(.15, .45), rnd(1.2, 2), rnd(.025, .045)); if (R() < .15) emitDust(wv.x, wv.y, wv.z, nv.x * .2, .05, nv.z * .2, rnd(1.5, 3), rnd(.15, .35), .2); }); }
      // the camera moves in on the court, then pulls back as the sand returns
      { const k = sm((e - 2) / 5) * (1 - sm((e - 17.5) / 5)); camT.copy(ev.t0).lerp(CATP, k * .85); camD.copy(ctx.camera.position).sub(ctx.controls.target).setLength(ev.d0 * (1 - .45 * k)); ctx.controls.target.copy(camT); ctx.camera.position.copy(camT).add(camD); }
      if (e > 23 && !f.back) { f.back = 1; ctx.setLook(ctx.baseLook()); }
      if (e > 25) { ev = null; RU.uRev.value = 0; cat.visible = false; if (AU.ctx) AU.rum.gain.setTargetAtTime(0, AU.ctx.currentTime, .3); } }
    // dust off the crests, more in a gale and a lot more in the quake
    const rate = (60 + wind * 170 + quake * 900) * QN;
    for (let i = 0; i < Math.floor(rate * dt + R()); i++) { const x = rnd(-4.9, 4.9), z = rnd(-4.9, 4.9), h = hR(x, z); if (h < WL + .05 || (R() > (h - .3) / 2.2 && R() > quake)) continue; const sp = (.35 + wind * .5) * rnd(.7, 1.3);
      emitDust(x, h + .02, z, WD[0] * sp, rnd(.05, .3) + quake * rnd(.2, .9), WD[1] * sp, rnd(2, 4.5), rnd(.2, .55) + quake * .5, .14 + quake * .1); }
    for (let i = DUST.list.length - 1; i >= 0; i--) { const p = DUST.list[i]; p.age += dt; if (p.age > p.life || Math.abs(p.x) > 5.4 || Math.abs(p.z) > 5.4) { DUST.list[i] = DUST.list[DUST.list.length - 1]; DUST.list.pop(); continue; }
      p.vy -= .12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const g = hR(p.x, p.z) + .01; if (p.y < g) { p.y = g; p.vy = Math.abs(p.vy) * .3; } }
    for (let i = GRAIN.list.length - 1; i >= 0; i--) { const p = GRAIN.list[i]; p.age += dt; if (p.age > p.life) { GRAIN.list[i] = GRAIN.list[GRAIN.list.length - 1]; GRAIN.list.pop(); continue; }
      p.vy -= 3.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const g = hR(p.x, p.z); if (p.y < g) { p.y = g + .005; p.vy = 0; p.vx *= .6; p.vz *= .6; if (R() < .03) emitDust(p.x, g + .02, p.z, rnd(-.1, .1), .1, rnd(-.1, .1), rnd(1, 2), .2, .16); } }
    flush(DUST, [.95, .74, .52], 1.6); flush(GRAIN, [.9, .7, .48], 0);
  });
  { const done = new Set(); island.traverse(o => { if (!o.isMesh || !o.material || done.has(o.material) || o.material === water.mat || o.material === water.wallMat || o.material.isShaderMaterial || o === wl || o.material === leafMat) return; done.add(o.material); underwater(o.material, WL, 1.2); }); }
  ctx.api = api; return ctx;
}
