/* Sea of Dunes: the Namib's scale and stillness. Knife-edged linear dunes, apricot on the lit side and violet-shadowed on the
   other, sweep in sinuous ridges toward a terraced sandstone jebel. A cathedral is cut into its sheer face, guarded by colossal
   elephants and lions. Between the dunes a long valley leads the eye to it: a white clay pan with dead camelthorn trees, and
   nearer the viewer an oasis pool fed by groundwater, with palms, a camp and a caravan walking a crest for scale. The wind
   shaves the crests: sand streams off every ridge and away past the edges of the slice into the sky, gusts sweep sheets of it
   across the valley and out of the world, and now and then a dune spills over the cut wall and falls away into nothing.
   EVENT: a magnitude-nine earthquake drains the drifted sand from the cathedral's forecourt, sand pouring from every window;
   a few seconds later the sand flows back and buries it again. */
import { THREE, mergeGeometries, TAU, R, rnd, pick, clamp, lerp, sm, Q, LO, QN, makeNoise, GLSL_NOISE, TRI, createEngine, makeHeightfield, DZ, SLAB, makeWalls, wallMaterial, makeWater, crownGeometry, makeAudio, underwater, palmGeometry, sway, LEAF_RECTS } from './core.js';

export const META = { name: 'Sea of Dunes', line: 'Knife-edged dunes, a valley of dead trees and an oasis pool, and a cathedral cut into the rock at its end. The wind carries the crests away. Press Earthquake.', era: 'Namib Sand Sea · the hour before dusk', ev: 'Earthquake', preset: { time: 2, clouds: 0, rain: 0, wind: 2, glow: 1, life: 2 }, birds: 'vulture' };

export function build() {
  const N = makeNoise(+(Q.get('seed') || 31)), S = 10, H5 = 5, DEPTH = SLAB, NORM = 2.2, WL = .12;
  const ctx = createEngine({ cam: { target: [-.2, 1.0, -.2], dist: 46, pol: 1.02, az: Math.PI / 4, min: 9, max: 70 }, sunRef: 3.4, bloom: [.12, .5, 1.7], sat: 1.05,
    looks: { noon: { sky: 'noon', dir: [-.42, 1, .6], col: '#fff0dc', I: 3.6, env: .9, exp: 1.0 }, gold: { sky: 'gold', dir: [-.42, .26, .9], col: '#ff9a52', I: 3.9, env: .62, exp: 1.0, warm: 1, rot: .145 },
      quake: { sky: 'storm', dir: [-.45, .4, .8], col: '#ffb070', I: 1.9, env: .45, exp: 1.12, warm: .7, skyI: .55 } } });
  const { island, tex, U, MATS } = ctx; ctx.waterLevel = WL;
  Object.assign(ctx.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, far: 90 }); ctx.sun.shadow.camera.updateProjectionMatrix();
  const T = { sand: tex('sand_diff.jpg'), sandN: tex('sand_nor.jpg', false), rock: tex('rock_diff.jpg'), rockN: tex('rock_nor.jpg', false), lime: tex('lime_diff.jpg'), limeN: tex('lime_nor.jpg', false), grass: tex('mtn_diff.jpg'), grassN: tex('mtn_nor.jpg', false),
    leaf: tex('leaf_diff.jpg', true, false), leafA: tex('leaf_alpha.jpg', false, false), leafN: tex('leaf_nor.jpg', false, false), bark: tex('bark_diff.jpg'), barkN: tex('bark_nor.jpg', false), plaster: tex('plaster_diff.jpg') };

  /* the land */
  const J = [-3.4, -3.3], WD = [.7071, -.7071]; // the wind blows across the crests, from the lit flanks to the shadowed ones
  const dOf = (x, z) => -(x + z) * .7071, tOf = (x, z) => (x - z) * .7071, XZ = (t, d) => [(t - d) * .7071, (-t - d) * .7071];
  // linear dunes running toward the jebel: a sinuous sharp crest, a long lit flank, a steep shadowed slip face; taller toward the back
  const CRESTS = [[-2.9, 2.5, .45, .55, 2.35, .8], [3.0, 3.1, .55, .5, -.58, 1.0], [-6.0, 2.4, .4, .6, 4.0, .9], [5.9, 2.3, .5, .45, 1.0, .9]];
  const crestT = (k, d) => { const [T, , A, f, ph] = CRESTS[k]; return T + A * Math.sin(d * f + ph) + .25 * N.fbm(d * .35, k * 7.1); };
  const crestH = (k, d) => CRESTS[k][1] * (.5 + .5 * sm((d + 6) / 10)) * (.82 + .3 * N.fbm(d * .25 + k * 3, 1.3));
  const OA = XZ(-.35, -2.6), DV = XZ(-.3, .7);
  const oasisT = (t, d) => Math.hypot((t + .35) / .95, (d + 2.6) / 1.25);
  const vleiE = (x, z) => Math.hypot((tOf(x, z) + .3) / .62, (dOf(x, z) - .7) / 1.35) + N.fbm(x * 1.5, z * 1.5) * .18;
  // the cliff: the jebel's face is cut sheer toward the viewer, with a deep niche where the cathedral is carved out of the living rock
  const NF = [.7071, .7071], TN = [-.7071, .7071], D0 = .95, ND = .5, NW = .9, FLOOR = .3, R0 = 1.25, R1 = 2.05;
  const FP = [J[0] + NF[0] * (D0 - ND), J[1] + NF[1] * (D0 - ND)], C = [FP[0] + NF[0] * .65, FP[1] + NF[1] * .65];
  const sLim = t => D0 - ND * sm((NW - Math.abs(t)) / .03), frontK = (x, z) => { const dx = x - J[0], dz = z - J[1]; return sm((dx * NF[0] + dz * NF[1] - sLim(dx * TN[0] + dz * TN[1])) / .05); };
  const sandH = (x, z) => { const u = x / H5, v = z / H5, d = dOf(x, z), t = tOf(x, z); let h = .34 + N.fbm(u * 1.6 + 3, v * 1.6) * .1 + N.fbm(u * 5, v * 5) * .025;
    h += .05 * Math.max(0, Math.sin(d * 2.6 + N.fbm(t * .6, d * .3) * 3)) * (1 - sm(Math.abs(t + .2) - .6)); // low wind ridges in the valley floor
    let best = 0; for (let k = 0; k < CRESTS.length; k++) { const H = crestH(k, d), u0 = t - crestT(k, d), u2 = Math.sign(u0) * (Math.sqrt(u0 * u0 + .0036) - .06);
      const f = u2 < 0 ? Math.max(0, 1 + u2 / (H * 1.15 * CRESTS[k][5])) : Math.max(0, 1 - u2 / (H * .8)), hk = H * Math.pow(f, u2 < 0 ? 1.7 : 1.2); if (hk > best) best = hk; }
    return h + best; };
  const jebelH = (x, z) => { let best = 0;
    [[J[0], J[1], 2.0, 3.25], [-1.25, -4.35, .55, 2.2], [-4.45, -1.35, .32, 2.6]].forEach(([jx, jz, jr, jh], q) => { const rj = Math.hypot(x - jx, z - jz) + N.fbm(x * 1.4 + q * 5, z * 1.4) * .4 * jr * (q ? 1 : .55);
      let hj = jh * sm((jr - rj) / (.18 + jr * .08)); if (!q) { const dx = x - jx, dz = z - jz; hj *= sm((sLim(dx * TN[0] + dz * TN[1]) - (dx * NF[0] + dz * NF[1])) / .035); } const st = .42, qq = hj / st; hj = (Math.floor(qq) + sm((qq - Math.floor(qq) - .72) / .28)) * st; hj += N.ridge(x * 3, z * 3) * .14 * sm(hj); best = Math.max(best, hj); });
    return best; };
  const oasisE = (x, z) => oasisT(tOf(x, z), dOf(x, z)) + N.fbm(x * 1.2, z * 1.2) * .22;
  function height(u, v) { const x = u * H5, z = v * H5; let h = Math.max(sandH(x, z), jebelH(x, z));
    { const fk = frontK(x, z), r = Math.hypot(x - FP[0], z - FP[1]), rc = Math.hypot(x - C[0], z - C[1]);
      h = lerp(h, FLOOR + .16 + N.fbm(x * 2.2, z * 2.2) * .1, (1 - sm((rc - R0 * .7) / (R1 + .4 - R0 * .7))) * fk);
      h = Math.max(h, FLOOR + (.42 + N.fbm(x * 2.5, z * 2.5) * .1) * (1 - sm((r - .25) / 1.1)) * fk); }
    const e = oasisE(x, z); h = lerp(h, WL + .05 + N.fbm(x * 3, z * 3) * .05, sm((1.6 - e) / .6)); h = lerp(h, WL - .5 + N.fbm(x * 2 + 4, z * 2) * .12, sm((.9 - e) / .4));
    h = lerp(h, .3 + N.fbm(x * 4, z * 4) * .015, sm((1.05 - vleiE(x, z)) / .3)); // the clay pan
    return h; }
  const hf = makeHeightfield(S, 320, height), { hAt, normAt } = hf;
  { const p = hf.geo.attributes.position, zn = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), h = p.getY(i), jh = jebelH(x, z); zn[i * 2] = jh > .25 && jh >= sandH(x, z) - .08 ? sm((jh - .2) / .3) : 0; const e = oasisE(x, z); zn[i * 2 + 1] = sm((1.95 - e) / .45) * (h > WL + .015 ? 1 : 0) - sm((1.0 - vleiE(x, z)) / .25); }
    hf.geo.setAttribute('zn', new THREE.BufferAttribute(zn, 2)); }
  const RU = { uRev: { value: 0 } };
  const hR = (x, z) => { const m = RU.uRev.value * (1 - sm((Math.hypot(x - C[0], z - C[1]) - R0) / (R1 - R0))) * frontK(x, z); return lerp(hAt(x, z), FLOOR, m); };
  const terrMat = new THREE.MeshStandardMaterial({ roughness: .95 }); MATS.push(terrMat);
  terrMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, RU, { tSand: { value: T.sand }, tSandN: { value: T.sandN }, tRock: { value: T.rock }, tRockN: { value: T.rockN }, tLime: { value: T.lime }, tLimeN: { value: T.limeN }, tGrass: { value: T.grass }, tGrassN: { value: T.grassN } });
    sh.vertexShader = 'uniform float uRev; attribute vec2 zn; varying vec2 vZn; varying vec3 vWP; varying vec3 vWN; varying float vRv;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float rd = length(transformed.xz - vec2(${C[0].toFixed(3)}, ${C[1].toFixed(3)})); vec2 jq = transformed.xz - vec2(${J[0]}, ${J[1]}); float ss = dot(jq, vec2(${NF[0]}, ${NF[1]})), tt = dot(jq, vec2(${TN[0]}, ${TN[1]}));
        float rm = uRev * (1. - smoothstep(${R0.toFixed(2)}, ${R1.toFixed(2)}, rd)) * smoothstep(0., 1., (ss - (${D0} - ${ND} * smoothstep(0., 1., (${NW} - abs(tt)) / .03))) / .05); transformed.y = mix(transformed.y, ${FLOOR.toFixed(3)}, rm); vRv = rm; }
      vZn = zn; vWP = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = `uniform sampler2D tSand, tSandN, tRock, tRockN, tLime, tLimeN, tGrass, tGrassN; uniform float uTime, uSun, uCloud, uWind, uRev; varying vec2 vZn; varying vec3 vWP; varying vec3 vWN; varying float vRv; float mR, mG, mW, flag; float ripP;\n` + GLSL_NOISE + TRI + sh.fragmentShader
      .replace('#include <map_fragment>', `
  vec3 P = vWP, Nn = normalize(vWN); if (vRv > .002) { vec3 fn = normalize(cross(dFdx(vWP), dFdy(vWP))); if (fn.y < 0.) fn = -fn; Nn = normalize(mix(Nn, fn, smoothstep(.0, .3, vRv) * (1. - smoothstep(.97, 1., vRv)))); }
  vec3 w = triW(Nn); float slope = 1. - Nn.y;
  float al = dot(P.xz, vec2(.7071, -.7071)); ripP = al * 44. + fbm(P.xz * 2.6) * 7. + fbm(P.xz * .7) * 4.;
  vec3 sand = tri2(tSand, P, w, .3) * mix(vec3(1.3, .64, .36), vec3(1.22, .74, .48), smoothstep(.4, 1.6, P.y) * .4); sand *= .93 + .07 * sin(ripP) * (1. - smoothstep(.12, .4, slope)); sand *= mix(1., .86, smoothstep(.3, .6, fbm(P.xz * .35 + 3.)));
  vec3 stone = mix(tri2(tLime, P, w, .22), tri2(tRock, P, w, .3), .4) * vec3(1.15, .72, .46); stone *= .8 + .2 * sin(P.y * 9. + fbm(P.xz * .8) * 2.5) ; stone = mix(stone, stone * vec3(1.1, .8, .62), smoothstep(.4, .7, fbm(vec2(P.x + P.z, P.y) * 1.5)));
  vec3 grass = tri2(tGrass, P, w, .4) * vec3(.6, .8, .4);
  float clay = max(-vZn.y, 0.); mR = vZn.x * smoothstep(.08, .3, slope + vZn.x * .15); mG = max(vZn.y, 0.) * (1. - smoothstep(.35, .6, slope)) * smoothstep(.3, .7, fbm(P.xz * 2.2) + .3); mW = smoothstep(${(WL + .1).toFixed(3)}, ${(WL - .01).toFixed(3)}, P.y);
  vec3 col = sand; col = mix(col, mix(stone, sand * .95, smoothstep(.2, .04, slope) * .55), mR); col = mix(col, grass, mG); col = mix(col, sand * vec3(.62, .55, .45), mW);
  { vec2 q = P.xz * 7.; vec2 i0 = floor(q), f0 = fract(q); float d1 = 8., d2 = 8.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)), o = vec2(hh(i0 + g), hh(i0 + g + 9.1)); float dd = length(g + o - f0); if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd; }
    vec3 cl = vec3(.92, .86, .76) * (.9 + .15 * fbm(P.xz * 3.)) * mix(.55, 1., smoothstep(.0, .06, d2 - d1)); col = mix(col, cl, clay * (1. - mR)); }
  float dep = ${WL.toFixed(3)} - P.y; if (dep > 0.) { col = mix(col, col * vec3(.5, .62, .6), smoothstep(0., 1.5, dep)); col += vec3(.75, .95, .9) * caustic(P.xz * 1.3, uTime) * exp(-dep * 1.2) * .45 * uSun; }
  { vec2 cq = (P.xz - vec2(${C[0].toFixed(3)}, ${C[1].toFixed(3)})); vec2 rq = mat2(.7071, -.7071, .7071, .7071) * cq * 4.2; vec2 fr = abs(fract(rq + vec2(step(.5, fract(rq.y * .5)) * .5, 0.)) - .5); float jt = smoothstep(.43, .47, max(fr.x, fr.y));
    vec3 fl = tri2(tLime, P, w, .5) * vec3(1.1, .9, .7) * (.85 + .3 * hh(floor(rq + vec2(step(.5, fract(rq.y * .5)) * .5, 0.)))); fl *= 1. - jt * .55; flag = smoothstep(.85, 1., vRv) * smoothstep(.2, .02, P.y - ${FLOOR.toFixed(3)}); col = mix(col, mix(fl, sand, smoothstep(.55, .8, fbm(P.xz * 3.)) * .6), flag); }
  col *= cloudShade(P.xz, uTime, uCloud);
  diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(.95, .6, mW);')
      .replace('#include <normal_fragment_maps>', `{ vec3 nS = triN(tSandN, vWP, Nn, w, .3); vec2 rg = vec2(.7071, -.7071) * cos(ripP) * .22 * (1. - smoothstep(.12, .4, slope)) * (1. - mR) * (1. - flag) * (1. - clay); nS = normalize(nS + vec3(rg.x, 0., rg.y));
        vec3 nT = normalize(mix(mix(nS, triN(tRockN, vWP, Nn, w, .3), mR), triN(tGrassN, vWP, Nn, w, .4), mG * .7)); normal = normalize((viewMatrix * vec4(nT, 0.)).xyz); }`); };
  const terr = new THREE.Mesh(hf.geo, terrMat); terr.castShadow = terr.receiveShadow = true; island.add(terr);
  const walls = makeWalls(hf, DEPTH, WL, NORM); const wl = new THREE.Mesh(walls.land, wallMaterial(ctx, T.rock, T.rockN, [.9, .7, .54])); wl.castShadow = wl.receiveShadow = true; island.add(wl);
  const water = makeWater(ctx, hf, { level: WL, att: '#1aa0a8', attDist: 1.0, deep: '#063a5c', shallow: '#1c8c8c', glint: 1.1, norm: NORM, wallK: 4.2, wave: .012 });
  island.add(new THREE.Mesh(walls.water, water.wallMat));

  /* carved sandstone: triplanar stone with moldings, flutes and lattice relief cut into it, weathered, sand-dusted on every ledge */
  const ORG = { value: new THREE.Vector3() };
  const carved = (tint, org = { value: new THREE.Vector3() }, fine = 1, plain = false) => { const m = new THREE.MeshStandardMaterial({ roughness: .9, color: tint }); MATS.push(m);
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { tLime: { value: T.lime }, tLimeN: { value: T.limeN }, uOrg: org });
      sh.vertexShader = 'uniform vec3 uOrg; varying vec3 vCP; varying vec3 vCN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCP = (modelMatrix * vec4(transformed, 1.)).xyz - uOrg; vCN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = 'uniform sampler2D tLime, tLimeN; varying vec3 vCP; varying vec3 vCN;\n' + GLSL_NOISE + TRI + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 P = vCP, Nc = normalize(vCN), w = triW(Nc); vec3 st = tri2(tLime, P, w, .9) * vec3(1.18, .82, .56);
    vec2 hz = abs(Nc.x) > abs(Nc.z) ? P.zy : P.xy; float vert = 1. - abs(Nc.y);
    float yb = P.y * ${(12.5 * fine).toFixed(2)}, g = smoothstep(.36, .44, abs(fract(yb) - .5)), G = smoothstep(.44, .49, abs(fract(P.y * ${(3.1 * fine).toFixed(2)}) - .5));
    float fl = smoothstep(.40, .47, abs(fract(hz.x * ${(16. * fine).toFixed(1)}) - .5)) * step(.5, fract(P.y * ${(1.55 * fine).toFixed(2)} + .25));
    float lat = smoothstep(.55, .9, abs(sin(hz.x * ${(70. * fine).toFixed(0)}.) * sin(hz.y * ${(70. * fine).toFixed(0)}.))) * (1. - step(.5, fract(P.y * ${(1.55 * fine).toFixed(2)} + .25)));
    ${plain ? 'g = 0.; G = 0.; fl = 0.; lat = 0.;' : ''}
    float wear = fbm(P.xz * 3. + P.y * 2.3), grime = smoothstep(.5, .9, fbm(vec2(hz.x * 14., P.y * 1.4)));
    st *= mix(1., .5, (g * .7 + G) * vert) * mix(1., .72, (fl + lat * .6) * vert) * (.82 + .32 * wear) * (1. - .28 * grime * vert);
    st = mix(st, st * vec3(.78, .74, .7), smoothstep(.55, .85, fbm(P.xz * 1.3 + P.y)));
    st = mix(st, vec3(.82, .6, .38), smoothstep(.55, .92, Nc.y) * (.55 + .45 * wear));
    diffuseColor.rgb *= st; }`)
        .replace('#include <normal_fragment_maps>', `{ vec3 Nc = normalize(vCN); vec3 nT = triN(tLimeN, vCP, Nc, triW(Nc), .9); float e = .004, yb = vCP.y * ${(12.5 * fine).toFixed(2)};
          float d0 = smoothstep(.36, .44, abs(fract(yb) - .5)), d1 = smoothstep(.36, .44, abs(fract(yb + e * ${(12.5 * fine).toFixed(2)}) - .5)); nT = normalize(nT + vec3(0., (d1 - d0) / e * .004, 0.) * (1. - abs(Nc.y)) * ${plain ? '0.' : '1.'});
          normal = normalize((viewMatrix * vec4(nT, 0.)).xyz); }`); };
    m.customProgramCacheKey = () => 'carved' + fine + plain; return m; };
  const ruinM = carved('#f2e2cc'), dark = new THREE.MeshStandardMaterial({ color: '#0a0705', roughness: 1 }); MATS.push(dark);
  const add = (g, m, x, y, z, par = island, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; par.add(o); return o; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s).translate(0, h / 2, 0);

  /* the oasis: date palms and reeds round a groundwater pool in the valley, a Bedouin camp with a fire */
  const leafMat = sway(new THREE.MeshStandardMaterial({ map: T.leaf, alphaMap: T.leafA, alphaTest: .45, normalMap: T.leafN, side: THREE.DoubleSide, roughness: .65, color: '#c8d8a0' }), U, .015); MATS.push(leafMat);
  const barkM = new THREE.MeshStandardMaterial({ map: T.bark, normalMap: T.barkN, roughness: .9, color: '#b09a80' }); MATS.push(barkM);
  { const spots = []; for (let t = 0; t < 6000 && spots.length < 16 * QN + 5; t++) { const x = OA[0] + rnd(-2.2, 2.2), z = OA[1] + rnd(-2.2, 2.2), h = hAt(x, z), e = oasisE(x, z); if (e < .95 || e > 1.5 || h < WL + .03 || normAt(x, z).y < .8 || spots.some(s => Math.hypot(s[0] - x, s[2] - z) < .18)) continue; spots.push([x, h - .02, z, rnd(.45, .7)]); }
    const [tr, fr] = palmGeometry(spots); if (tr) { const a = new THREE.Mesh(tr, barkM), b = new THREE.Mesh(fr, leafMat); a.castShadow = b.castShadow = true; b.receiveShadow = true; island.add(a, b); }
    const bush = []; for (let t = 0; t < 4000 && bush.length < 34 * QN; t++) { const x = OA[0] + rnd(-2.3, 2.3), z = OA[1] + rnd(-2.3, 2.3), h = hAt(x, z), e = oasisE(x, z); if (e < .92 || e > 1.6 || h < WL + .02) continue; bush.push([x, h, z, rnd(.04, .08)]); }
    const im = new THREE.InstancedMesh(crownGeometry(LEAF_RECTS, 50), leafMat, bush.length), m = new THREE.Matrix4(), c = new THREE.Color(); bush.forEach(([x, h, z, s], i) => { m.compose(new THREE.Vector3(x, h + s * .4, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd(TAU), 0)), new THREE.Vector3(s, s * .7, s)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(pick(['#6a7a3a', '#7a8848', '#5a6a32']))); });
    im.castShadow = im.receiveShadow = true; island.add(im); }
  const fireL = new THREE.PointLight('#ff8a3a', 0, 5, 1.6);
  { const [cx, cz] = XZ(-1.15, -3.55), h = hAt(cx, cz), cloth = [['#5a3a2a', 0], ['#7a2e22', 1.3]];
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
  const path = new THREE.CatmullRomCurve3(Array.from({ length: 15 }, (_, k) => { const d = -4.2 + k * .55, [x, z] = XZ(crestT(0, d) + .03, d); return new THREE.Vector3(x, 0, z); }).filter(v => Math.abs(v.x) < 4.9 && Math.abs(v.z) < 4.9));
  /* the dead vlei: camelthorn trees dead for centuries, black against the white clay */
  { const deadM = new THREE.MeshStandardMaterial({ color: '#1e1610', roughness: .95 }); MATS.push(deadM); const parts = [];
    const branch = (p0, dir, len, r, depth) => { const pts = [p0.clone()]; let p = p0.clone(), d = dir.clone(); for (let k = 0; k < 4; k++) { d.add(new THREE.Vector3(rnd(-.35, .35), rnd(-.1, .2), rnd(-.35, .35))).normalize(); p = p.clone().addScaledVector(d, len / 4); pts.push(p); }
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, r, 5, false)); if (depth < 2) for (let b = 0; b < 3; b++) branch(pts[2 + (b % 3 === 2 ? 1 : 0)], new THREE.Vector3(rnd(-1, 1), rnd(.2, .9), rnd(-1, 1)).normalize(), len * rnd(.45, .65), r * .55, depth + 1); };
    for (let t2 = 0, n = 0; t2 < 600 && n < 11; t2++) { const x = DV[0] + rnd(-1.2, 1.2), z = DV[1] + rnd(-1.2, 1.2); if (vleiE(x, z) > .85) continue; n++; branch(new THREE.Vector3(x, hAt(x, z) - .02, z), new THREE.Vector3(rnd(-.3, .3), 1, rnd(-.3, .3)).normalize(), rnd(.28, .45), .014, 0); }
    const dm = new THREE.Mesh(mergeGeometries(parts), deadM); dm.castShadow = dm.receiveShadow = true; island.add(dm); }

  /* the cathedral, cut out of the living rock of the jebel: a two-storey facade in a sheer niche, a portico of six columns,
     a pediment with a rose window, a tholos between broken pediments and spired towers, rock left standing above it.
     Colossal elephants step half out of the cliff on either side and a pair of recumbent lions guard the stair; the sand has
     drifted up to their shoulders. Tiny pilgrims on the clifftop give the scale. */
  const catM = carved('#f6e2c8', ORG), statM = carved('#ecd4b4', ORG, 1, true), cat = new THREE.Group(), EM = [];
  const B = (w, h, d, x, y, z, m = catM) => add(box(w, h, d), m, x, y, z, cat), Cy = (rt, rb, h, x, y, z, s = 16, m = catM) => add(cyl(rt, rb, h, s), m, x, y, z, cat);
  const archG = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0); return new THREE.ShapeGeometry(s, 10); };
  const win = (w, h, x, y, z, ry = 0, emit = true) => { const m = new THREE.Mesh(archG(w, h), dark); m.position.set(x, y, z); m.rotation.y = ry; cat.add(m); if (emit) EM.push([new THREE.Vector3(x, y + h * .3, z), new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), w]); return m; };
  const tri = (w, h, d, x, y, z, m = catM) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0); return add(new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }), m, x, y, z, cat); };
  const halfTri = (w, h, d, x, y, z, sd) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(sd * w, 0); s.lineTo(0, h); s.lineTo(0, 0); return add(new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }), catM, x, y, z, cat); };
  const column = (x, z, y0, H, r) => { B(r * 2.6, .05, r * 2.6, x, y0, z); Cy(r * .92, r, H - .12, x, y0 + .05, z, 14); B(r * 2.7, .07, r * 2.7, x, y0 + H - .07, z); add(new THREE.TorusGeometry(r * 1.05, r * .3, 6, 14).rotateX(Math.PI / 2), catM, x, y0 + H - .09, z, cat); };
  const NZ = ND - .02, W = NW * 2 - .06;
  B(W, 3.4, .06, 0, -.6, .03); // the dressed rock face at the back of the niche
  // podium and stair
  B(W, .26, .3, 0, -.6, NZ - .15 + .03); B(W - .2, .2, .12, 0, .06, NZ - .02);
  for (let k = 0; k < 6; k++) B(.92, .05, .1, 0, .2 - k * .05 - .05, NZ + .08 + k * .09);
  // lower storey: six columns, a tall portal and two side doors
  [-.72, -.43, -.15, .15, .43, .72].forEach(x => column(x, NZ - .14, .26, 1.0, .055));
  win(.32, .7, 0, .26, .066); add(new THREE.TorusGeometry(.16, .022, 6, 24, Math.PI), catM, 0, .26 + .7 - .16, .07, cat);
  [-.58, .58].forEach(x => { win(.17, .44, x, .26, .066); win(.11, .2, x, .8, .066); });
  B(W, .11, .34, 0, 1.26, .2); B(W + .04, .035, .38, 0, 1.37, .2); for (let k = 0; k < 18; k++) B(.03, .04, .03, -.82 + k * .0965, 1.22, .38);
  tri(.98, .3, .28, 0, 1.405, .08); B(1.02, .03, .3, 0, 1.4, .22);
  add(new THREE.CircleGeometry(.09, 28), dark, 0, 1.5, .365, cat); add(new THREE.TorusGeometry(.095, .016, 6, 28), catM, 0, 1.5, .366, cat);
  for (let k = 0; k < 8; k++) add(new THREE.BoxGeometry(.01, .17, .015), catM, 0, 1.5, .368, cat, 0, 0, k / 8 * Math.PI);
  EM.push([new THREE.Vector3(0, 1.5, .37), new THREE.Vector3(0, 0, 1), .12]);
  // upper storey: a tholos between broken pediments, flanked by spired towers
  B(.64, .06, .34, 0, 1.72, .19); Cy(.24, .24, .62, 0, 1.78, .17, 28); win(.1, .3, 0, 1.92, .413);
  for (let k = 0; k < 5; k++) { const a = (k - 2) * .5; column(Math.sin(a) * .27, .17 + Math.cos(a) * .27, 1.78, .62, .028); }
  add(new THREE.CylinderGeometry(.3, .3, .04, 28).translate(0, .02, 0), catM, 0, 2.4, .17, cat); add(new THREE.ConeGeometry(.27, .2, 28).translate(0, .1, 0), catM, 0, 2.44, .17, cat);
  add(new THREE.SphereGeometry(.05, 12, 8), catM, 0, 2.68, .17, cat); Cy(.02, .03, .05, 0, 2.63, .17, 8);
  [-1, 1].forEach(sd => { const x = sd * .52; B(.34, .62, .3, x, 1.72, .17); column(x - .1, .3, 1.72, .62, .03); column(x + .1, .3, 1.72, .62, .03); win(.09, .26, x, 1.86, .325);
    B(.38, .05, .34, x, 2.34, .18); halfTri(.2, .14, .3, sd * .35, 2.39, .03, -sd);
    const tx = sd * .8; B(.22, 1.72, .26, tx, .26, .16); win(.08, .3, tx, .5, .292); win(.08, .3, tx, 1.62, .292); B(.26, .04, .3, tx, 1.98, .16);
    B(.18, .36, .22, tx, 2.02, .15); win(.06, .2, tx, 2.08, .262); add(new THREE.ConeGeometry(.1, .36, 4).rotateY(Math.PI / 4).translate(0, .18, 0), catM, tx, 2.38, .15, cat);
    [-1, 1].forEach(q => add(new THREE.ConeGeometry(.025, .1, 4).translate(0, .05, 0), catM, tx + q * .085, 2.38, .15 + .08, cat)); });
  // the rock left standing over the niche, cut from the jebel's own stone so it reads as one mass with the cliff
  const rockM = new THREE.MeshStandardMaterial({ roughness: .92 }); MATS.push(rockM); { const tob = terrMat.onBeforeCompile; rockM.onBeforeCompile = sh => { tob(sh); sh.uniforms.uRev = { value: 0 }; }; rockM.customProgramCacheKey = () => 'jebelRock'; }
  const zn1 = g => { const z = new Float32Array(g.attributes.position.count * 2); for (let i = 0; i < z.length; i += 2) z[i] = 1; g.setAttribute('zn', new THREE.BufferAttribute(z, 2)); return g; };
  { let top = 0; for (let k = -4; k <= 4; k++) { const t = k / 4 * NW, x = J[0] + NF[0] * (D0 - ND - .08) + TN[0] * t, z = J[1] + NF[1] * (D0 - ND - .08) + TN[1] * t; top = Math.max(top, jebelH(x, z)); }
    const y0 = 2.78, hh = Math.max(.25, top - FLOOR - y0 + .04), g = zn1(new THREE.BoxGeometry(NW * 2 + .08, hh, ND + .05, 8, 4, 2).translate(0, y0 + hh / 2, ND / 2)); { const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > y0 + .01 && p.getZ(i) > ND * .6) p.setZ(i, p.getZ(i) + N.fbm(p.getX(i) * 3, p.getY(i) * 3) * .06); g.computeVertexNormals(); }
    const lin = add(g, rockM, 0, 0, 0, cat); lin.receiveShadow = true;
    const ar = zn1(new THREE.TorusGeometry(NW - .02, .07, 6, 24, Math.PI).translate(0, 2.0, ND - .02)); ar.scale(1, .9, 1); add(ar, catM, 0, 0, 0, cat); }
  // colossal elephants stepping half out of the cliff on either side of the niche
  const ellG = (rx, ry, rz) => new THREE.SphereGeometry(1, 24, 16).scale(rx, ry, rz);
  [-1, 1].forEach(sd => { const g = new THREE.Group(); g.position.set(sd * (NW + .42), 0, ND - .08); cat.add(g);
    add(ellG(.3, .3, .4), statM, 0, .66, -.18, g); add(ellG(.24, .25, .22), statM, 0, .9, .2, g); add(ellG(.12, .1, .1), statM, 0, 1.12, .24, g);
    [-1, 1].forEach(q => { add(ellG(.035, .22, .18), statM, q * .2, .88, .14, g, 0, q * .35, q * .12); add(cyl(.085, .1, .52, 14), statM, q * .14, 0, .12, g); add(cyl(.11, .11, .05, 14), statM, q * .14, 0, .12, g);
      const tk = new THREE.CatmullRomCurve3([[q * .09, .76, .32], [q * .13, .66, .48], [q * .1, .7, .62]].map(v => new THREE.Vector3(...v))); add(new THREE.TubeGeometry(tk, 10, .022, 8), statM, 0, 0, 0, g); });
    const tr = new THREE.CatmullRomCurve3([[0, .86, .4], [0, .68, .5], [0, .38, .5], [0, .14, .54], [0, .08, .64]].map(v => new THREE.Vector3(...v))); add(new THREE.TubeGeometry(tr, 20, .05, 10), statM, 0, 0, 0, g);
    add(new THREE.TorusGeometry(.24, .025, 6, 24, Math.PI).rotateZ(0), statM, 0, .98, .12, g); add(box(.5, .06, .3), statM, 0, 1.08, .08, g);
    for (let k = 0; k < 5; k++) add(new THREE.SphereGeometry(.03, 8, 6), statM, (k - 2) * .09, .78 - Math.abs(k - 2) * .03, .38, g); });
  // recumbent lions guarding the stair
  const lion = sd => { const g = new THREE.Group(); g.position.set(sd * .64, 0, 1.12); g.rotation.y = sd * .04; cat.add(g);
    add(box(.5, .12, 1.12).translate(0, 0, 0), statM, 0, 0, -.02, g); add(box(.54, .03, 1.16), statM, 0, .12, -.02, g);
    add(ellG(.17, .14, .34), statM, 0, .3, -.06, g); add(ellG(.18, .16, .17), statM, 0, .3, -.34, g); add(ellG(.17, .19, .16), statM, 0, .36, .2, g);
    add(ellG(.19, .2, .15), statM, 0, .54, .3, g); add(box(.13, .11, .14), statM, 0, .45, .4, g); add(ellG(.07, .06, .05), statM, 0, .45, .47, g);
    add(box(.17, .05, .05), statM, 0, .57, .4, g); [-1, 1].forEach(q => { add(new THREE.ConeGeometry(.03, .06, 6), statM, q * .1, .7, .3, g); add(box(.08, .07, .34), statM, q * .1, .15, .38, g); add(ellG(.06, .12, .15), statM, q * .15, .24, -.38, g); });
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[.12, .17, -.5], [.24, .16, -.32], [.26, .16, -.05], [.2, .16, .12]].map(v => new THREE.Vector3(v[0] * sd, v[1], v[2]))), 12, .022, 6), statM, 0, 0, 0, g);
    [-.1, .1].forEach(x => add(new THREE.BoxGeometry(.035, .02, .02), dark, x * .5, .5, .47, g)); };
  lion(-1); lion(1);
  cat.rotation.y = Math.atan2(NF[0], NF[1]); cat.position.set(FP[0], FLOOR, FP[1]); island.add(cat); cat.updateMatrixWorld(true); ORG.value.copy(cat.position);
  // pilgrims on the clifftop for scale
  { const robe = ['#e8dcc8', '#3a2a22', '#7a2e22', '#2a3a5a'], ms = robe.map(c => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: .9 }); MATS.push(m); return m; }), fig = mergeGeometries([new THREE.CylinderGeometry(.012, .024, .075, 6).translate(0, .0375, 0), new THREE.SphereGeometry(.013, 8, 6).translate(0, .088, 0)]);
    [[-.5, -.18], [-.42, -.22], [.3, -.15], [.62, -.3], [.1, -.55]].forEach(([t, s2], i) => { const x = FP[0] + TN[0] * t + NF[0] * (s2 - .1), z = FP[1] + TN[1] * t + NF[1] * (s2 - .1); add(fig, ms[i % 4], x, jebelH(x, z) - .005, z).scale.setScalar(1); }); }

  /* blowing sand: grains lifting off the crests and streaming downwind; the same system carries the sand that pours
     from the basilica's windows and slides into the court */
  const SU = { uPx: { value: 1 }, uLit: { value: 1 } };
  const softPts = (n, add2) => { const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 4), s = new Float32Array(n); g.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('pc', new THREE.BufferAttribute(c, 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('ps', new THREE.BufferAttribute(s, 1).setUsage(THREE.DynamicDrawUsage)); g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: SU, vertexShader: 'attribute vec4 pc; attribute float ps; uniform float uPx; varying vec4 vC; void main(){ vC = pc; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * ps / -mv.z, 1.5, 300.); }',
      fragmentShader: `uniform float uLit; varying vec4 vC; void main(){ vec2 d = gl_PointCoord - .5; float r2 = dot(d, d) * 4.; if (r2 > 1.) discard; float a = ${add2 ? 'smoothstep(1., .3, r2)' : 'exp(-r2 * 3.)'}; gl_FragColor = vec4(vC.rgb * uLit, a * vC.a); }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4; island.add(pts); return { g, p, c, s, n, list: [] }; };
  const DUST = softPts(LO ? 2600 : 5600), GRAIN = softPts(LO ? 2800 : 6500, true);
  const emitDust = (x, y, z, vx, vy, vz, life, size, a = .2, lift = 0) => { if (DUST.list.length < DUST.n) DUST.list.push({ x, y, z, vx, vy, vz, age: 0, life, size, a, lift }); };
  const G = { t: rnd(3, 6), on: 0, k0: 0 }, F = { t: rnd(1, 3), list: [] };
  const emitGrain = (x, y, z, vx, vy, vz, life, size = .03) => { if (GRAIN.list.length < GRAIN.n) GRAIN.list.push({ x, y, z, vx, vy, vz, age: 0, life, size }); };
  const flush = (S2, col, grow) => { let k = 0; for (const p of S2.list) { const f = p.age / p.life; S2.p[k * 3] = p.x; S2.p[k * 3 + 1] = p.y; S2.p[k * 3 + 2] = p.z; S2.c[k * 4] = col[0]; S2.c[k * 4 + 1] = col[1]; S2.c[k * 4 + 2] = col[2]; S2.c[k * 4 + 3] = (p.a ?? .9) * Math.min(1, p.age * 4) * (1 - f); S2.s[k] = p.size * (1 + f * grow); k++; }
    S2.g.setDrawRange(0, k); S2.g.attributes.position.needsUpdate = S2.g.attributes.pc.needsUpdate = S2.g.attributes.ps.needsUpdate = true; };

  /* the earthquake */
  const AU = makeAudio(); AU.onStart = A => { A.wind = A.loop('bandpass', 520, .8, .04); A.pour = A.loop('bandpass', 2400, .5, 0); A.rum = A.loop('lowpass', 70, .8, 0); };
  let ev = null; const api = { ev: () => { AU.get(); ev = { t: 0, f: {}, t0: ctx.controls.target.clone(), d0: ctx.camera.position.distanceTo(ctx.controls.target) }; }, get evOn() { return !!ev; } };
  const wv = new THREE.Vector3(), nv = new THREE.Vector3(), camT = new THREE.Vector3(), camD = new THREE.Vector3(), CATP = new THREE.Vector3(FP[0] + NF[0] * .5, FLOOR + 1.15, FP[1] + NF[1] * .5);
  ctx.steps.push(dt => { const t = ctx.clock, wind = U.uWind.value; SU.uPx.value = ctx.renderer.domElement.height / (2 * Math.tan(ctx.camera.fov * Math.PI / 360)); SU.uLit.value = .35 + .75 * U.uSun.value;
    fireL.intensity = U.uGlow.value * (2.5 + Math.sin(t * 13) * .4 + Math.sin(t * 7.3) * .3);
    { const m = new THREE.Matrix4(), q = new THREE.Quaternion(); for (let i = 0; i < 5; i++) { const u = ((t * .005 + i * .016) % 1 + 1) % 1, p = path.getPointAt(u), tg = path.getTangentAt(u), y = hR(p.x, p.z), bob = Math.abs(Math.sin(t * 3.2 + i)) * .012;
      q.setFromEuler(new THREE.Euler(0, -Math.atan2(tg.z, tg.x), Math.sin(t * 3.2 + i) * .04)); m.compose(new THREE.Vector3(p.x, y + bob, p.z), q, new THREE.Vector3(.95, .95, .95)); caravan.setMatrixAt(i, m); } caravan.instanceMatrix.needsUpdate = true; }
    if (AU.ctx) AU.wind.gain.setTargetAtTime(.02 + wind * .03, AU.ctx.currentTime, .4);
    let quake = 0, rev = RU.uRev.value;
    if (ev) { ev.t += dt; const e = ev.t, f = ev.f;
      if (!f.go) { f.go = 1; ctx.setLook('quake'); AU.burst(3, 90, .6); AU.tone(32, 26, 3, .35); }
      quake = e < .8 ? e / .8 * .5 : e < 8 ? 1 : Math.max(0, 1 - (e - 8) / 4) * .6 + (e > 16.5 && e < 22 ? .35 : 0); ctx.shake(quake * 2.2);
      if (e > .8 && !f.big) { f.big = 1; AU.burst(14, 80, .75); AU.burst(10, 300, .25, 'bandpass', .4); AU.tone(28, 22, 6, .4); ctx.flash(.18, '#ffd9a8'); }
      if (R() < dt * 4 * quake) AU.burst(.08, 2800, .12 * quake, 'highpass');
      rev = e < 1.5 ? 0 : e < 7.5 ? sm((e - 1.5) / 6) : e < 17 ? 1 : Math.max(0, 1 - sm((e - 17) / 5.5)); RU.uRev.value = rev;
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
      if (e > 25) { ev = null; RU.uRev.value = 0; if (AU.ctx) AU.rum.gain.setTargetAtTime(0, AU.ctx.currentTime, .3); } }
    // the wind shaves the crests: sand streams off every ridge across to the shadowed side, lifts, and is carried away past
    // the edges of the slice into the sky. Gusts every few seconds raise sheets of it off the whole valley.
    G.t -= dt; if (G.t < 0) { G.t = rnd(7, 15) / (.6 + wind * .4); G.on = rnd(2.5, 4); G.k0 = 0; if (AU.ctx) AU.burst(G.on + 1, 700, .09 + wind * .03, 'bandpass'); }
    if (G.on > 0) { G.on -= dt; G.k0 = Math.min(1, G.k0 + dt * 1.5); } else G.k0 = Math.max(0, G.k0 - dt * .8); const gust = sm(G.k0);
    const ins = (x, z) => Math.abs(x) < 4.98 && Math.abs(z) < 4.98, sp0 = .45 + wind * .45 + gust * 1.1;
    for (let i = 0; i < Math.floor((70 + wind * 110 + gust * 520 + quake * 300) * QN * dt + R()); i++) { const k = Math.floor(R() * CRESTS.length), d = rnd(-7, 7), [x, z] = XZ(crestT(k, d), d); if (!ins(x, z)) continue; const h = hR(x, z); if (h < .9) continue;
      const sp = sp0 * rnd(.7, 1.3); emitDust(x + rnd(-.04, .04), h + .02, z + rnd(-.04, .04), WD[0] * sp, rnd(.12, .35) + gust * rnd(.1, .5), WD[1] * sp, rnd(3, 6) * (1 + gust), rnd(.14, .36) + gust * .25, .1 + gust * .05, 1);
      if (R() < .5) emitGrain(x, h + .01, z, WD[0] * sp * 1.4, rnd(.4, 1.1), WD[1] * sp * 1.4, rnd(1, 2), .022); }
    for (let i = 0; i < Math.floor((5 + wind * 8 + gust * 300 + quake * 600) * QN * dt + R()); i++) { const x = rnd(-4.9, 4.9), z = rnd(-4.9, 4.9), h = hR(x, z); if (h < WL + .06) continue; const sp = sp0 * rnd(.8, 1.4);
      emitDust(x, h + .015, z, WD[0] * sp, rnd(.03, .15) + quake * rnd(.2, .9), WD[1] * sp, rnd(2, 4), rnd(.2, .45) + quake * .5, .06 + gust * .06 + quake * .1, gust > .3 ? 1 : 0); }
    // now and then a dune spills over the cut wall: a stream of sand falls off the edge of the world and away into nothing
    F.t -= dt; if (F.t < 0) { F.t = rnd(3, 8); const side = Math.floor(R() * 4), a = rnd(-4.6, 4.6), [x, z] = side === 0 ? [a, -4.99] : side === 1 ? [a, 4.99] : side === 2 ? [-4.99, a] : [4.99, a], h = hAt(x, z);
      if (h > .8) F.list.push({ x, z, nx: side === 2 ? -1 : side === 3 ? 1 : 0, nz: side === 0 ? -1 : side === 1 ? 1 : 0, h, life: rnd(2.5, 6), w: rnd(.15, .45) }); }
    for (let k = F.list.length - 1; k >= 0; k--) { const f = F.list[k]; f.life -= dt; if (f.life < 0) { F.list.splice(k, 1); continue; }
      for (let i = 0; i < Math.floor(160 * QN * dt * (1 + gust) + R()); i++) { const o = rnd(-f.w, f.w), x = f.x + Math.abs(f.nz) * o, z = f.z + Math.abs(f.nx) * o; emitGrain(x, hAt(x, z) + .01, z, f.nx * rnd(.15, .45), rnd(-.1, .2), f.nz * rnd(.15, .45), rnd(3, 4.5), rnd(.02, .035));
        if (R() < .12) emitDust(x + f.nx * .1, hAt(x, z) - rnd(0, 2.5), z + f.nz * .1, f.nx * .12, rnd(-.3, .05), f.nz * .12, rnd(2, 4), rnd(.25, .6), .12, 0); } }
    for (let i = DUST.list.length - 1; i >= 0; i--) { const p = DUST.list[i]; p.age += dt; if (p.age > p.life || Math.abs(p.x) > 16 || Math.abs(p.z) > 16 || p.y > 12 || p.y < -14) { DUST.list[i] = DUST.list[DUST.list.length - 1]; DUST.list.pop(); continue; }
      p.vy += (p.lift ? .05 : -.12) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (ins(p.x, p.z)) { const g = hR(p.x, p.z) + .01; if (p.y < g) { p.y = g; p.vy = Math.abs(p.vy) * .3; } } }
    for (let i = GRAIN.list.length - 1; i >= 0; i--) { const p = GRAIN.list[i]; p.age += dt; if (p.age > p.life || p.y < -14) { GRAIN.list[i] = GRAIN.list[GRAIN.list.length - 1]; GRAIN.list.pop(); continue; }
      p.vy -= 3.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (ins(p.x, p.z)) { const g = hR(p.x, p.z); if (p.y < g) { p.y = g + .005; p.vy = 0; p.vx *= .6; p.vz *= .6; if (R() < .03) emitDust(p.x, g + .02, p.z, rnd(-.1, .1), .1, rnd(-.1, .1), rnd(1, 2), .2, .16); } } }
    flush(DUST, [.95, .74, .52], 1.6); flush(GRAIN, [.9, .7, .48], 0);
  });
  { const done = new Set(); island.traverse(o => { if (!o.isMesh || !o.material || done.has(o.material) || o.material === water.mat || o.material === water.wallMat || o.material.isShaderMaterial || o === wl || o.material === leafMat) return; done.add(o.material); underwater(o.material, WL, 1.2); }); }
  ctx.api = api; return ctx;
}
