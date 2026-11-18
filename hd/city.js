/* Neon Shore: a beach city massed toward its hill at the back. Glass towers, setback and art-deco spires with gold bands and
   lit crowns, a twisting tower, round and octagonal glass, streamline hotels on the promenade, neon blade signs, beacons
   blinking on the masts, a suspension bridge over the estuary with traffic streaming across, a marina of moored yachts
   inside the breakwater, and on its end a bronze colossus holding up a ring of light. Under the bay, where the cut walls
   fall away into indigo, a capsized freighter lies with its propeller turned to the surface.
   EVENT: a blackout, a power wave rolling out from the colossus, then a searchlight show. */
import { THREE, mergeGeometries, TAU, R, rnd, pick, clamp, lerp, sm, Q, LO, QN, makeNoise, GLSL_NOISE, TRI, createEngine, makeHeightfield, DZ, SLAB, makeWalls, wallMaterial, makeWater, makeAudio, makeSnowfall, underwater, palmGeometry, sway } from './core.js';

export const META = { name: 'Neon Shore', line: 'Glass towers and art-deco spires, a suspension bridge over the estuary, a marina, and a bronze colossus holding up a ring of light. Press Light show.', era: 'A beach city · one in the morning', ev: 'Light show', preset: { time: 3, clouds: 1, rain: 0, wind: 1, glow: 3, life: 2 }, birds: 'gull' };

export function build() {
  const N = makeNoise(+(Q.get('seed') || 7)), S = 10, H5 = 5, DEPTH = SLAB, NORM = 2.4, SEA = 0;
  const ctx = createEngine({ cam: { target: [-.4, 1.2, -.4], dist: 48, pol: 1.0, az: Math.PI / 4, min: 9, max: 70 }, sunRef: 3.2, bloom: [.32, .4, 1.0], sat: 1.08,
    looks: { night: { sky: 'night', dir: [-.4, .85, -.6], col: '#9fb2ff', I: .7, env: .26, exp: 1.25, skyI: .3 } }, stars: true });
  const { island, tex, U, MATS } = ctx; ctx.waterLevel = SEA;
  Object.assign(ctx.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, far: 90 }); ctx.sun.shadow.camera.updateProjectionMatrix();
  const T = { sand: tex('sand_diff.jpg'), sandN: tex('sand_nor.jpg', false), rock: tex('rock_diff.jpg'), rockN: tex('rock_nor.jpg', false), lime: tex('lime_diff.jpg'), limeN: tex('lime_nor.jpg', false), grass: tex('mtn_diff.jpg'), grassN: tex('mtn_nor.jpg', false),
    plaster: tex('plaster_diff.jpg'), plasterN: tex('plaster_nor.jpg', false), leaf: tex('leaf_diff.jpg', true, false), leafA: tex('leaf_alpha.jpg', false, false), leafN: tex('leaf_nor.jpg', false, false), bark: tex('bark_diff.jpg'), barkN: tex('bark_nor.jpg', false) };

  /* the land: a flat coastal plain rising to a hill at the back, a river cutting to the sea, a beach, a breakwater */
  const RIV = [[1.15, -5.3], [1.55, -3.7], [2.25, -2.3], [2.95, -1.05], [3.7, .2], [4.6, 1.3]].map(p => new THREE.Vector2(...p));
  const riverD = (x, z) => { let d = 9; const p = new THREE.Vector2(x, z); for (let i = 0; i < RIV.length - 1; i++) { const a = RIV[i], b = RIV[i + 1], ab = b.clone().sub(a), t = clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); d = Math.min(d, p.distanceTo(a.clone().addScaledVector(ab, t))); } return d; };
  const shoreD = (x, z) => (x + z) / 1.414 - 1.35 + N.fbm(x * .35 + 2, z * .35) * .45;
  const BW = [new THREE.Vector2(.85, 1.95), new THREE.Vector2(3.15, 3.35)], BE = [3.2, 3.38];
  const bwD = (x, z) => { const a = BW[0], b = BW[1], ab = b.clone().sub(a), p = new THREE.Vector2(x, z), t = clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
  function height(u, v) { const x = u * H5, z = v * H5; let h = .3 + N.fbm(u * 2, v * 2) * .04 + 1.5 * Math.exp(-((x + 4.1) ** 2 + (z + 4.0) ** 2) / 3.4) + .5 * Math.exp(-((x + 1.2) ** 2 + (z + 4.6) ** 2) / 1.2);
    const sd = shoreD(x, z); h = lerp(h, .12 - sd * .06, sm(sd / .45)); h = lerp(h, -.7 - sd * .25, sm((sd - .55) / .5)); h = lerp(h, -3.7 + N.fbm(u * 3, v * 3) * .25, sm((sd - 2.35) / .5));
    const rd = riverD(x, z); h = lerp(h, Math.min(h, -.85), sm((.36 - rd) / .14)); h = Math.min(h, lerp(h, .14, sm((.5 - rd) / .1)));
    const bd = bwD(x, z); if (sd > .2) h = Math.max(h, lerp(.2, h, sm((bd - .1) / .2)) + N.ridge(x * 9, z * 9, 3) * .04 * sm((.25 - bd) / .1));
    { const d = Math.hypot(x - BE[0], z - BE[1]); h = Math.max(h, lerp(.24, h, sm((d - .3) / .25))); }
    return h; }
  const hf = makeHeightfield(S, 300, height), { hAt, normAt } = hf;
  const GRID = .48, CITY = (x, z) => shoreD(x, z) < -.3 && riverD(x, z) > .55 && Math.abs(x) < 4.75 && Math.abs(z) < 4.75;
  const terrMat = new THREE.MeshStandardMaterial({ roughness: .9 }); MATS.push(terrMat);
  terrMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, { tSand: { value: T.sand }, tSandN: { value: T.sandN }, tRock: { value: T.rock }, tRockN: { value: T.rockN }, tGrass: { value: T.grass }, tGrassN: { value: T.grassN }, tLime: { value: T.lime } });
    sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform sampler2D tSand, tSandN, tRock, tRockN, tGrass, tGrassN, tLime; uniform float uTime, uSun, uCloud, uGlow, uWet; varying vec3 vWP; varying vec3 vWN; float mB, mS, mP, street; vec3 lampE;\n' + GLSL_NOISE + TRI + sh.fragmentShader
      .replace('#include <map_fragment>', `
  vec3 P = vWP, Nn = normalize(vWN), w = triW(Nn); float slope = 1. - Nn.y;
  vec3 sand = tri2(tSand, P, w, .35) * vec3(1.06, .94, .78), conc = tri2(tLime, P, w, .6) * vec3(.62, .62, .64), asph = tri2(tRock, P, w, .5) * vec3(.24, .24, .26), park = tri2(tGrass, P, w, .4) * vec3(.62, .8, .46);
  vec2 g = P.xz / ${GRID.toFixed(2)} + .5; vec2 gf = abs(fract(g) - .5); float road = smoothstep(.36, .38, max(gf.x, gf.y)), walk = smoothstep(.31, .33, max(gf.x, gf.y)) * (1. - road);
  float dash = road * step(.5, fract((gf.x > gf.y ? P.z : P.x) * 9.)) * step(max(gf.x, gf.y), .495) * step(.49, max(gf.x, gf.y));
  mB = smoothstep(.36, .22, P.y) * step(-.02, P.y); mS = smoothstep(.04, -.12, P.y); mP = smoothstep(.75, 1.0, P.y);
  vec3 city = mix(conc, asph, road); city = mix(city, conc * 1.25, walk); city += vec3(.5, .45, .3) * dash * .5; city = mix(city, park, mP * (1. - road) * smoothstep(.4, .6, fbm(P.xz * 2.)));
  city = mix(city, city * .55, uWet * .7);
  vec3 col = mix(city, sand, mB); col = mix(col, mix(sand * .8, tri2(tRock, P, w, .3) * .5, smoothstep(.45, .65, fbm(P.xz * .6))) * mix(1., .55, smoothstep(-.3, -2.5, P.y)), mS);
  col = mix(col, tri2(tRock, P, w, .35) * vec3(.55, .5, .46), smoothstep(.35, .6, slope) * (1. - mS));
  float dep = -P.y; if (dep > 0.) col += vec3(.6, .8, .95) * caustic(P.xz, uTime) * exp(-dep * 1.2) * .4 * uSun;
  col *= cloudShade(P.xz, uTime, uCloud);
  vec2 gi = abs(fract(g + .5) - .5); float lamp = smoothstep(.07, .0, length(gi)) * (1. - mB) * (1. - mS) * step(P.y, .7); lampE = vec3(1., .72, .4) * lamp * uGlow * 2.2 + vec3(1., .75, .45) * road * uGlow * .05 * (1. - mB);
  street = road; diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(mix(.92, .6, street), .2, uWet * (1. - mB) * (1. - mS));')
      .replace('#include <normal_fragment_maps>', '{ vec3 nT = normalize(mix(triN(tRockN, vWP, Nn, w, .4), triN(tSandN, vWP, Nn, w, .35), max(mB, mS))); normal = normalize((viewMatrix * vec4(mix(nT, Nn, .5 * (1. - mB - mS)), 0.)).xyz); }')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += lampE;'); };
  const terr = new THREE.Mesh(hf.geo, terrMat); terr.castShadow = terr.receiveShadow = true; island.add(terr);
  const walls = makeWalls(hf, DEPTH, SEA, NORM); const wl = new THREE.Mesh(walls.land, wallMaterial(ctx, T.rock, T.rockN, [.62, .6, .6])); wl.castShadow = wl.receiveShadow = true; island.add(wl);
  const water = makeWater(ctx, hf, { level: SEA, att: '#2a4aa8', attDist: 1.1, deep: '#081a5a', shallow: '#1a5a8e', glint: .9, norm: NORM, wallK: 4.2, wave: .02 });
  island.add(new THREE.Mesh(walls.water, water.wallMat));

  /* buildings: every facade shares one material whose shader gives each building its own window personality (grid, lit
     share, colour temperature, ribbon strips, slots, curtain wall or punched windows, floors burning late, TV flicker,
     shopfronts, floodlit bases and crowns); the power wave, the blackout and the show drive it from uniforms */
  const CU = { uPow: { value: 1 }, uWaveR: { value: 0 }, uWaveOn: { value: 0 }, uWO: { value: new THREE.Vector2(BE[0], BE[1]) }, uPump: { value: 0 }, uHue: { value: new THREE.Color('#ff3a9a') } };
  const facade = (m, glass) => { m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, CU);
      sh.vertexShader = 'attribute vec3 bi; varying vec3 vBi; varying vec3 vWPb; varying vec3 vWNb;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBi = bi; vWPb = (modelMatrix * vec4(transformed, 1.)).xyz; vWNb = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = 'uniform float uTime, uGlow, uPow, uWaveR, uWaveOn, uPump; uniform vec3 uHue; uniform vec2 uWO; varying vec3 vBi; varying vec3 vWPb; varying vec3 vWNb; float wWin; vec3 wE;\n' + GLSL_NOISE + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 P = vWPb, Nb = normalize(vWNb); float side = 1. - step(.55, abs(Nb.y)); float seed = mod(vBi.x, 100.), band = step(100., vBi.x), base = vBi.y, H = vBi.z - vBi.y, hy = P.y - base;
    float s1 = hh(vec2(seed, 1.7)), s2 = hh(vec2(seed, 2.3)), s3 = hh(vec2(seed, 3.1)), s4 = hh(vec2(seed, 4.9)), s5 = hh(vec2(seed, 5.3)), s6 = hh(vec2(seed, 6.1));
    float style = band > .5 ? 1. : floor(s4 * 4.);
    float cols = ${glass ? 'mix(26., 46., s1)' : 'mix(15., 32., s1)'}, rows = mix(13., 24., s2);
    float u = dot(P.xz, normalize(vec2(-Nb.z, Nb.x) + 1e-5)) * cols, v = hy * rows; vec2 cl = floor(vec2(u, v)), fr = fract(vec2(u, v));
    float win = style < .5 ? step(.18, fr.x) * step(fr.x, .82) * step(.26, fr.y) * step(fr.y, .82) : style < 1.5 ? step(.3, fr.y) * step(fr.y, .8) : style < 2.5 ? step(.36, fr.x) * step(fr.x, .64) * step(.12, fr.y) * step(fr.y, .9) : step(.05, fr.x) * step(fr.x, .95) * step(.08, fr.y) * step(fr.y, .95);
    win *= side * step(.075, hy) * step(hy, H - .03);
    vec2 wid = vec2(style > .5 && style < 1.5 ? floor(u * .25) : cl.x, cl.y);
    float on = step(1. - mix(.1, .78, s3), hh(wid + seed * 37.)); on = max(on, step(.94, hh(vec2(cl.y, seed * 3.1))));
    vec3 cw = s5 < .3 ? vec3(1., .58, .26) : s5 < .6 ? vec3(1., .78, .5) : s5 < .85 ? vec3(.78, .88, 1.) : vec3(.8, 1., .9);
    float wv = hh(wid + 9.1); vec3 lc = mix(cw, vec3(1., .66, .36), step(.82, wv) * .7) * (.4 + .85 * hh(wid + 2.3));
    float tv = step(.985, hh(wid + 5.)); lc = mix(lc, vec3(.35, .55, 1.) * (.6 + .4 * sin(uTime * 13. + wv * 50.) * sin(uTime * 3.7 + wv * 20.)), tv);
    float wave = mix(1., 1. - smoothstep(uWaveR - .5, uWaveR, length(P.xz - uWO)), uWaveOn) * uPow, pump = 1. + uPump * (.7 + .3 * sin(P.y * 7. - uTime * 9.));
    wWin = win; wE = lc * win * on * uGlow * ${glass ? '1.0' : '1.25'} * wave * pump;
    wE += vec3(1., .76, .48) * side * step(.012, hy) * step(hy, .055) * step(.4, s6) * uGlow * 1.3 * wave * (.6 + .4 * hh(vec2(floor(u * .3), seed)));
    vec3 wash = s2 < .45 ? vec3(1., .7, .38) : s2 < .75 ? vec3(.5, .7, 1.) : uHue;
    wE += wash * side * (1. - win) * (exp(-clamp(hy, 0., 9.) * 4.5) * step(.7, s6) * .4 + smoothstep(H - .2, H, hy) * step(s4, .32) * .55) * step(0., hy) * uGlow * wave * (1. + uPump * .8);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.05, .065, .08), win * ${glass ? '.4' : '.85'}); }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, .12, wWin);`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += wE;'); };
    m.customProgramCacheKey = () => 'facade2' + glass; return m; };
  const facM = facade(new THREE.MeshStandardMaterial({ map: T.plaster, normalMap: T.plasterN, vertexColors: true, roughness: .75 }), false), glassM = facade(new THREE.MeshPhysicalMaterial({ color: '#7f97ab', metalness: .85, roughness: .07, clearcoat: .6, vertexColors: true }), true);
  glassM.userData.env = 1.4; MATS.push(facM, glassM);
  const goldM = new THREE.MeshStandardMaterial({ color: '#d6a650', metalness: 1, roughness: .28 }); MATS.push(goldM);
  const crownM = ctx.glowMat(new THREE.MeshStandardMaterial({ color: '#30261a', emissive: '#ffd890', emissiveIntensity: 2 }), 2.2), beaconM = new THREE.MeshStandardMaterial({ color: '#300', emissive: '#ff2a1a', emissiveIntensity: 0 }), strobeM = new THREE.MeshStandardMaterial({ color: '#222', emissive: '#ffffff', emissiveIntensity: 0 }); MATS.push(crownM, beaconM, strobeM);
  const NEONC = ['#ff2e88', '#2ef2ff', '#ffb02e', '#9a5cff', '#3aff7a', '#ff4a2a'], NEON = NEONC.map(c => ctx.glowMat(new THREE.MeshStandardMaterial({ color: '#111', emissive: c, emissiveIntensity: 3 }), 3)); MATS.push(...NEON);
  const parts = { fac: [], glass: [], gold: [], crown: [], beacon: [], strobe: [], neon: NEONC.map(() => []) }, tall = [];
  const tag = (g, seed, base, col) => { g.computeBoundingBox(); const top = g.boundingBox.max.y, n = g.attributes.position.count, bi = new Float32Array(n * 3), c = new Float32Array(n * 3), cc = new THREE.Color(col);
    for (let i = 0; i < n; i++) { bi[i * 3] = seed; bi[i * 3 + 1] = base; bi[i * 3 + 2] = top; c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; }
    g.setAttribute('bi', new THREE.BufferAttribute(bi, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g.index ? g.toNonIndexed() : g; };
  const put = (list, g, x, y, z, ry = 0, seed = 0, base = 0, col = '#ffffff') => { g.rotateY(ry); g.translate(x, y, z); list.push(list === parts.fac || list === parts.glass ? tag(g, seed, base, col) : (g.index ? g.toNonIndexed() : g)); return g; };
  const BX = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), CY = (r, h, s = 24, r2 = r) => new THREE.CylinderGeometry(r, r2, h, s).translate(0, h / 2, 0);
  const FACC = ['#e8e0d0', '#d8d0c4', '#c8c0b4', '#ece4d8', '#bfb6a8', '#d9c9b0', '#a8a49c', '#e4d2bc'], GLC = ['#8fa6b8', '#7d96a8', '#9ab0c0', '#6f8a9e', '#a0a8b0', '#7a9a98'];
  const neonOn = (x, y, z, w, h, d) => parts.neon[Math.floor(R() * NEONC.length)].push(BX(w, h, d).translate(x, y, z).toNonIndexed());
  const beacon = (x, y, z, strobe) => (strobe ? parts.strobe : parts.beacon).push(new THREE.SphereGeometry(strobe ? .016 : .013, 8, 6).translate(x, y, z).toNonIndexed());
  let seed = 1;
  // landmarks: each one a different silhouette, massed toward the hill
  const hero = (x, z, kind, H) => { const y = hAt(x, z) - .02, s = ++seed, w = rnd(.34, .4), dd = rnd(.34, .4);
    if (kind === 'deco') { let yy = y, ww = w * 1.1, d2 = dd * 1.1; [.42, .22, .16, .1].forEach(f => { const hh = H * f; put(parts.fac, BX(ww, hh, d2), x, yy, z, 0, s, y, pick(['#e8dcc6', '#d8c8ac'])); put(parts.gold, BX(ww + .014, .02, d2 + .014), x, yy + hh - .02, z); yy += hh; ww *= .8; d2 *= .8; });
      for (let k = 0; k < 4; k++) put(parts.crown, BX(ww * (1 - k * .22), .055, d2 * (1 - k * .22)), x, yy + k * .055, z); put(parts.gold, CY(.006, .5, 6, .014), x, yy + .22, z); beacon(x, yy + .74, z); tall.push([x, yy + .7, z]); return; }
    if (kind === 'twist') { const n = 34, hh = H / n; for (let k = 0; k < n; k++) put(parts.glass, BX(w, hh * .94, dd), x, y + k * hh, z, k * .052, s, y, pick(GLC)); put(parts.gold, CY(.005, .3, 6, .01), x, y + H, z); beacon(x, y + H + .31, z, true); tall.push([x, y + H, z]); return; }
    if (kind === 'round') { const r = w * .58; put(parts.glass, CY(r, H, 32), x, y, z, 0, s, y, pick(GLC)); put(parts.gold, CY(r * 1.06, .03, 32), x, y + H * .5, z); put(parts.glass, new THREE.ConeGeometry(r, r * 1.6, 32).translate(0, r * .8, 0), x, y + H, z, 0, s, y + 99, pick(GLC)); put(parts.gold, CY(.004, .4, 6, .008), x, y + H + r * 1.5, z); beacon(x, y + H + r * 1.5 + .41, z); tall.push([x, y + H, z]); return; }
    if (kind === 'mast') { put(parts.fac, BX(w, H * .62, dd), x, y, z, 0, s, y, pick(FACC)); put(parts.glass, BX(w * .72, H * .38, dd * .72), x, y + H * .62, z, 0, s + 50, y + H * .62, pick(GLC)); put(parts.gold, CY(.006, .6, 5, .014), x, y + H, z); beacon(x, y + H + .61, z); tall.push([x, y + H, z]); return; }
    if (kind === 'octa') { const r = w * .6; put(parts.glass, CY(r, H, 8), x, y, z, Math.PI / 8, s, y, pick(GLC)); put(parts.fac, CY(r * 1.04, .04, 8), x, y + H, z, Math.PI / 8, s, y + 99, '#cfc8bc'); put(parts.fac, CY(r * .7, .015, 24), x, y + H + .04, z, 0, s, y + 99, '#55585c'); for (let k = 0; k < 8; k++) beacon(x + Math.cos(k / 8 * TAU) * r * .7, y + H + .06, z + Math.sin(k / 8 * TAU) * r * .7); tall.push([x, y + H, z]); return; }
    if (kind === 'pyramid') { put(parts.glass, BX(w, H, dd), x, y, z, 0, s, y, pick(GLC)); put(parts.crown, new THREE.ConeGeometry(w * .72, w * .9, 4).rotateY(Math.PI / 4).translate(0, w * .45, 0), x, y + H, z); tall.push([x, y + H, z]); return; }
    // spire: a slender stepped shaft and a long needle
    let yy = y, ww = w * .9; [.5, .25, .15].forEach((f, i) => { const hh = H * f; put(i === 1 ? parts.glass : parts.fac, BX(ww, hh, ww), x, yy, z, Math.PI / 4, s + i * 7, yy, i === 1 ? pick(GLC) : pick(FACC)); yy += hh; ww *= .72; });
    put(parts.gold, CY(.004, .9, 6, .02), x, yy, z); beacon(x, yy + .9, z, true); tall.push([x, yy + .4, z]); };
  // everything else: lower blocks with varied massing so the landmarks read
  const filler = (x, z, back) => { const y = hAt(x, z) - .02, s = ++seed, fw = rnd(.22, .34), fd = rnd(.22, .34), Hm = .22 + back * .95 + R() * (.25 + back * .5), k = R();
    if (k < .25) { put(parts.fac, BX(fw, Hm * .45, fd), x, y, z, 0, s, y, pick(FACC)); put(parts.fac, BX(fw * .55, Hm, fd * .55), x - fw * .2, y, z - fd * .2, 0, s + 3, y, pick(FACC)); }
    else if (k < .45) { put(parts.fac, BX(fw, Hm, fd * .45), x, y, z - fd * .27, 0, s, y, pick(FACC)); put(parts.fac, BX(fw * .45, Hm * .75, fd), x - fw * .27, y, z, 0, s + 5, y, pick(FACC)); }
    else if (k < .6) put(parts.glass, BX(fw, Hm, fd), x, y, z, 0, s, y, pick(GLC));
    else put(parts.fac, BX(fw, Hm, fd), x, y, z, 0, s, y, pick(FACC));
    if (R() < .45) put(parts.fac, CY(.03, .055, 10), x + rnd(-.05, .05), y + Hm, z + rnd(-.05, .05), 0, s, y + 99, '#8a8478');
    if (R() < .3) put(parts.fac, BX(.06, .03, .04), x + rnd(-.06, .06), y + Hm, z + rnd(-.06, .06), 0, s, y + 99, '#9a968e');
    if (R() < .28) { const sd = R() < .5; neonOn(sd ? x + fw / 2 + .008 : x, y + Hm * rnd(.25, .7), sd ? z : z + fd / 2 + .008, sd ? .012 : fw * .7, sd ? Math.min(.4, Hm * .4) : .028, sd ? .05 : .012); } };
  { const lots = []; for (let gx = -11; gx <= 11; gx++) for (let gz = -11; gz <= 11; gz++) { const x = gx * GRID, z = gz * GRID; if (CITY(x, z)) lots.push([x, z, sm((-(x + z) / 1.414 + 1.4) / 6.2)]); }
    lots.sort((a, b) => b[2] - a[2]); const heroes = [], KINDS = ['deco', 'twist', 'round', 'spire', 'mast', 'octa', 'pyramid', 'deco', 'round'];
    for (const L of lots) { if (heroes.length >= KINDS.length) break; if (heroes.some(h => Math.hypot(h[0] - L[0], h[1] - L[1]) < 1.15)) continue; heroes.push(L); }
    heroes.forEach((L, i) => hero(L[0], L[1], KINDS[i], 1.9 + L[2] * 2.0 + R() * .5));
    lots.forEach(L => { if (heroes.includes(L) || heroes.some(h => Math.hypot(h[0] - L[0], h[1] - L[1]) < .5)) return; if (R() < .44) return; filler(L[0] + rnd(-.03, .03), L[1] + rnd(-.03, .03), L[2]); }); }
  // streamline hotels along the promenade
  for (let k = 0; k < 9; k++) { const a = -3.2 + k * .62, x = a * .7071, z = -a * .7071; let px = x, pz = z; for (let q = 0; q < 20 && shoreD(px, pz) > -.42; q++) { px -= .05; pz -= .05; } if (!CITY(px, pz) && riverD(px, pz) < .6) continue; if (k % 3 === 2) continue;
    const y = hAt(px, pz) - .02, H = rnd(.45, .85), w = rnd(.42, .6), s = 100 + (++seed); put(parts.fac, BX(w, H, .2), px, y, pz, -Math.PI / 4, s, y, '#f2ece2'); [-1, 1].forEach(e => put(parts.fac, CY(.1, H, 18), px + Math.cos(Math.PI / 4) * e * w / 2, y, pz + Math.sin(Math.PI / 4) * e * w / 2, 0, s, y, '#f2ece2'));
    parts.neon[k % NEONC.length].push(BX(w * .6, .035, .012).rotateY(-Math.PI / 4).translate(px + .07, y + H + .02, pz + .07).toNonIndexed()); }
  const mergeTo = (list, m, shadow = true) => { if (!list.length) return null; const o = new THREE.Mesh(mergeGeometries(list), m); o.castShadow = shadow; o.receiveShadow = true; island.add(o); return o; };
  mergeTo(parts.fac, facM); mergeTo(parts.glass, glassM); mergeTo(parts.gold, goldM); mergeTo(parts.crown, crownM, false); mergeTo(parts.beacon, beaconM, false); mergeTo(parts.strobe, strobeM, false); parts.neon.forEach((l, i) => mergeTo(l, NEON[i], false));

  /* the suspension bridge over the river, with its lights strung along the cables */
  const steel = new THREE.MeshStandardMaterial({ color: '#b8bcc0', metalness: .6, roughness: .4 }); MATS.push(steel);
  const bulbs = []; { const c = new THREE.Vector3(2.28, 0, -2.25), ax = new THREE.Vector3(.89, 0, -.45).normalize(), DY = .5, TH = 1.75, L = 1.45, g = new THREE.Group(); g.position.copy(c); g.rotation.y = -Math.atan2(ax.z, ax.x); island.add(g);
    const P = (a, y, s = 0) => new THREE.Vector3(a, y, s); const deck = new THREE.Mesh(new THREE.BoxGeometry(L * 2 + .3, .05, .16), steel); deck.position.y = DY; deck.castShadow = deck.receiveShadow = true; g.add(deck);
    [-.6, .6].forEach(a => { [-.07, .07].forEach(s => { const leg = new THREE.Mesh(new THREE.BoxGeometry(.05, TH, .04).translate(0, TH / 2, 0), steel); leg.position.set(a, hAt(c.x + ax.x * a, c.z + ax.z * a) - .5 - .5, s); leg.scale.y = (TH + 1) / TH; leg.castShadow = true; g.add(leg); });
      [DY + .3, TH - .25, TH - .05].forEach(y => { const b = new THREE.Mesh(new THREE.BoxGeometry(.05, .04, .18), steel); b.position.set(a, y, 0); g.add(b); }); });
    [-.07, .07].forEach(s => { const pts = []; for (let k = 0; k <= 60; k++) { const a = -L + k / 60 * 2 * L, aa = Math.abs(a); let y; if (aa > .6) { const f = (aa - .6) / (L - .6); y = lerp(TH - .05, DY + .02, f * f * .2 + f * .8); } else { const f = aa / .6; y = DY + .06 + (TH - .05 - DY - .06) * f * f; } pts.push(P(a, y, s)); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, .008, 5), steel));
      const sus = []; pts.forEach((p, k) => { if (k % 2) return; if (Math.abs(p.x) > L - .05) return; sus.push(p.x, p.y, s, p.x, DY + .025, s); if (k % 4 === 0) bulbs.push(g.localToWorld(p.clone())); }); const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sus, 3)); g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: '#8a8e92' }))); });
    g.updateMatrixWorld(); bulbs.length = 0; g.children.filter(o => o.geometry && o.geometry.type === 'TubeGeometry').forEach(o => { const pa = o.geometry.parameters.path; for (let k = 0; k <= 40; k++) bulbs.push(g.localToWorld(pa.getPointAt(k / 40).clone())); });
    ctx.bridge = { c, ax, DY, L }; }
  { const bm = ctx.glowMat(new THREE.MeshStandardMaterial({ color: '#222', emissive: '#fff0c8', emissiveIntensity: 4 }), 4.5), im = new THREE.InstancedMesh(new THREE.SphereGeometry(.009, 6, 4), bm, bulbs.length), m = new THREE.Matrix4(); bulbs.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m); }); island.add(im); MATS.push(bm); }

  /* the marina and the breakwater, and the colossus at its end */
  const rockM = new THREE.MeshStandardMaterial({ map: T.rock, normalMap: T.rockN, color: '#8a8580', roughness: .9 }); MATS.push(rockM);
  { const ab = BW[1].clone().sub(BW[0]), n = Math.round(ab.length() / .07), im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.07, 0), rockM, n * 3), m = new THREE.Matrix4(), q = new THREE.Quaternion(); let k = 0;
    for (let i = 0; i < n; i++) for (let j = -1; j <= 1; j++) { const p = BW[0].clone().addScaledVector(ab, i / n), nx = -ab.y / ab.length(), nz = ab.x / ab.length(), x = p.x + nx * j * .09 + rnd(-.02, .02), z = p.y + nz * j * .09 + rnd(-.02, .02); q.setFromEuler(new THREE.Euler(rnd(TAU), rnd(TAU), 0)); m.compose(new THREE.Vector3(x, Math.max(hAt(x, z), -.1) + .03 - Math.abs(j) * .03, z), q, new THREE.Vector3(1, 1, 1).multiplyScalar(rnd(.7, 1.3))); im.setMatrixAt(k++, m); }
    im.castShadow = im.receiveShadow = true; island.add(im); }
  const hullM = new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: .3, metalness: .1 }), deckM = new THREE.MeshStandardMaterial({ color: '#b08a60', roughness: .7 }); MATS.push(hullM, deckM);
  const yachtG = (() => { const h = new THREE.SphereGeometry(.5, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2); h.scale(1, .5, .28); h.rotateX(Math.PI); const c = new THREE.BoxGeometry(.4, .14, .22).translate(-.08, .07, 0); return mergeGeometries([h.toNonIndexed().scale(1, -1, 1), c.toNonIndexed()]); })();
  const yachts = []; { const pierG = []; for (let p = 0; p < 3; p++) { const a = new THREE.Vector2(.75 + p * .42, 1.62 + p * .3), dir = new THREE.Vector2(.55, .83).normalize(); pierG.push(new THREE.BoxGeometry(.04, .03, .9).rotateY(Math.atan2(dir.x, dir.y)).translate(a.x + dir.x * .45, .05, a.y + dir.y * .45).toNonIndexed());
      for (let k = 0; k < 4; k++) [-1, 1].forEach(sd => { const f = .15 + k * .2, x = a.x + dir.x * .9 * f + dir.y * sd * .08, z = a.y + dir.y * .9 * f - dir.x * sd * .08; if (hAt(x, z) > -.05) return; yachts.push([x, z, Math.atan2(dir.x, dir.y) + Math.PI / 2, rnd(.24, .34)]); }); }
    const pm = new THREE.Mesh(mergeGeometries(pierG), deckM); pm.receiveShadow = pm.castShadow = true; island.add(pm);
    const im = new THREE.InstancedMesh(yachtG, hullM, yachts.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(); yachts.forEach(([x, z, a, s], i) => { q.setFromEuler(new THREE.Euler(0, a, 0)); m.compose(new THREE.Vector3(x, .01, z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(i, m); }); im.castShadow = true; island.add(im); ctx.yachtIM = im; }
  const cruisers = [0, 1].map(k => { const o = new THREE.Mesh(yachtG, hullM); o.scale.setScalar(.42); o.castShadow = true; island.add(o); ctx.life(o, 1); return { o, a: rnd(TAU), r: .7 + k * .45, sp: (k ? -1 : 1) * rnd(.05, .08) }; });
  const bronze = new THREE.MeshStandardMaterial({ color: '#8a6038', metalness: 1, roughness: .36 }); MATS.push(bronze);
  bronze.onBeforeCompile = sh => { sh.vertexShader = 'varying vec3 vBP; varying vec3 vBN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBP = (modelMatrix * vec4(transformed, 1.)).xyz; vBN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'varying vec3 vBP; varying vec3 vBN;\n' + GLSL_NOISE + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n { float pt = smoothstep(.45, .8, fbm(vBP.xz * 6. + vBP.y * 4.) + vBN.y * .25); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.24, .46, .4), pt * .7); }')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor *= 1. - .7 * smoothstep(.45, .8, fbm(vBP.xz * 6. + vBP.y * 4.) + vBN.y * .25);'); };
  const ringM = ctx.glowMat(new THREE.MeshStandardMaterial({ color: '#2a2010', emissive: '#ffe2a0', emissiveIntensity: 6 }), 7), ringL = new THREE.PointLight('#ffd890', 0, 7, 1.5); MATS.push(ringM);
  { const g = new THREE.Group(), y0 = hAt(BE[0], BE[1]);
    [[.5, .1], [.42, .1], [.34, .16]].reduce((y, [w, h]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w).translate(0, h / 2, 0), rockM); b.position.y = y; b.castShadow = b.receiveShadow = true; g.add(b); return y + h; }, 0);
    const P0 = .36, robe = new THREE.LatheGeometry([[0, 0], [.21, 0], [.23, .08], [.2, .5], [.165, 1.0], [.17, 1.28], [.205, 1.4], [.17, 1.48], [.075, 1.52], [.06, 1.58], [0, 1.6]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
    const add = (geo, m, x, y, z, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    add(robe, bronze, 0, P0, 0); add(new THREE.SphereGeometry(.085, 24, 16).scale(.9, 1.1, 1), bronze, 0, P0 + 1.67, 0); add(new THREE.ConeGeometry(.1, .06, 12, 1, true), bronze, 0, P0 + 1.76, 0);
    for (let k = 0; k < 7; k++) add(new THREE.ConeGeometry(.018, .12, 5), bronze, Math.sin((k - 3) * .45) * .09, P0 + 1.8, Math.cos((k - 3) * .45) * .05 - .02, (Math.cos((k - 3) * .45) - .5) * .5, -Math.sin((k - 3) * .45) * .6);
    [-1, 1].forEach(sd => { const up = new THREE.CapsuleGeometry(.04, .42, 4, 10); add(up, bronze, sd * .17, P0 + 1.66, 0, 0, -sd * .32); const fo = new THREE.CapsuleGeometry(.034, .36, 4, 10); add(fo, bronze, sd * .2, P0 + 2.02, 0, 0, sd * .18); add(new THREE.SphereGeometry(.045, 12, 8), bronze, sd * .17, P0 + 2.22, 0); });
    for (let k = 0; k < 10; k++) add(new THREE.BoxGeometry(.012, .9, .05).translate(0, .45, 0), bronze, Math.sin(k / 10 * TAU) * .19, P0 + .05, Math.cos(k / 10 * TAU) * .19 + .02, 0, Math.sin(k) * .03);
    const ring = add(new THREE.TorusGeometry(.32, .028, 12, 64), ringM, 0, P0 + 2.55, 0); ring.castShadow = false; add(new THREE.TorusGeometry(.35, .012, 8, 64), goldM, 0, P0 + 2.55, 0);
    ringL.position.set(0, P0 + 2.55, 0); g.add(ringL); g.position.set(BE[0], y0, BE[1]); g.rotation.y = Math.PI / 4 + .25; g.scale.setScalar(1.08); island.add(g); ctx.colossus = g; }

  /* the promenade palms */
  const leafMat = sway(new THREE.MeshStandardMaterial({ map: T.leaf, alphaMap: T.leafA, alphaTest: .45, normalMap: T.leafN, side: THREE.DoubleSide, roughness: .65 }), U, .016); MATS.push(leafMat);
  const barkM = new THREE.MeshStandardMaterial({ map: T.bark, normalMap: T.barkN, roughness: .9 }); MATS.push(barkM);
  { const spots = []; for (let k = 0; k < 26 * QN + 6; k++) { const a = -4.6 + k * (9.2 / (26 * QN + 6)), x0 = a * .7071, z0 = -a * .7071; let x = x0, z = z0; for (let q = 0; q < 40 && shoreD(x, z) > -.08; q++) { x -= .04; z -= .04; } for (let q = 0; q < 40 && shoreD(x, z) < -.08; q++) { x += .04; z += .04; }
      if (Math.abs(x) > 4.8 || Math.abs(z) > 4.8 || riverD(x, z) < .5 || hAt(x, z) < .05) continue; spots.push([x, hAt(x, z) - .01, z, rnd(.75, 1.0)]); }
    const [tr, fr] = palmGeometry(spots, { fronds: 10 }); if (tr) { const a = new THREE.Mesh(tr, barkM), b = new THREE.Mesh(fr, leafMat); a.castShadow = b.castShadow = true; island.add(a, b); } }

  /* under the bay: a capsized freighter, its propeller, and an anchor chain running up into the dark */
  { const steelR = new THREE.MeshStandardMaterial({ color: '#5a3a2a', roughness: .85, metalness: .3 }); MATS.push(steelR); const g = new THREE.Group();
    const hull = new THREE.BoxGeometry(2.2, .5, .55); { const p = hull.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); if (x > .8) p.setZ(i, p.getZ(i) * (1 - (x - .8) / 1.4 * 1.6)); } hull.computeVertexNormals(); } const hm = new THREE.Mesh(hull, steelR); g.add(hm);
    const prop = new THREE.Group(); for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.04, .34, .12).translate(0, .17, 0), new THREE.MeshStandardMaterial({ color: '#8a6a3a', metalness: .8, roughness: .45 })); b.rotation.x = k / 4 * TAU; b.rotation.y = .4; prop.add(b); MATS.push(b.material); } prop.add(new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), steelR)); prop.position.set(-1.16, .0, 0); g.add(prop);
    g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); const x = 4.0, z = 3.95; g.position.set(x, hAt(x, z) + .18, z); g.rotation.set(Math.PI * .85, -Math.PI / 4 + .3, .25); island.add(g);
    const links = new THREE.TorusGeometry(.035, .01, 5, 10), n = 46, im = new THREE.InstancedMesh(links, steelR, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), a = new THREE.Vector3(3.15, -.05, 3.45), b = new THREE.Vector3(4.3, DZ(-3.4), 4.5);
    for (let i = 0; i < n; i++) { const f = i / n, p = a.clone().lerp(b, f); p.y -= Math.sin(f * Math.PI) * .4; q.setFromEuler(new THREE.Euler(0, i % 2 ? Math.PI / 2 : 0, .3)); m.compose(p, q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m); } island.add(im); }
  makeSnowfall(ctx, 1400, [-1, 4.9, -2.4, -.3, -1, 4.9], [.7, .8, .95], .3);

  /* traffic: headlights and taillights streaming along the bridge and the avenues */
  const NC = LO ? 120 : 220, cg = new THREE.BufferGeometry(), cp = new Float32Array(NC * 3), cc = new Float32Array(NC * 3); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3).setUsage(THREE.DynamicDrawUsage)); cg.setAttribute('color', new THREE.BufferAttribute(cc, 3)); cg.setDrawRange(0, 0);
  const cm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 1 }, uG: { value: 1 } }, vertexColors: true,
    vertexShader: 'uniform float uPx; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * .03 / -mv.z, 1.5, 10.); }',
    fragmentShader: 'uniform float uG; varying vec3 vC; void main(){ float r = length(gl_PointCoord - .5) * 2.; if (r > 1.) discard; gl_FragColor = vec4(vC * exp(-r * r * 3.) * uG, 1.); }' });
  const cars = new THREE.Points(cg, cm); cars.frustumCulled = false; island.add(cars);
  const lanes = []; { const B2 = ctx.bridge; lanes.push({ a: B2.c.clone().addScaledVector(B2.ax, -B2.L - .4).setY(B2.DY + .05), b: B2.c.clone().addScaledVector(B2.ax, B2.L + .4).setY(B2.DY + .05), w: .035 });
    for (let k = -8; k <= 4; k++) { const x = k * GRID + GRID / 2; let z0 = -4.8, z1 = 4.8; const pts = []; for (let z = -4.8; z <= 4.8; z += .2) if (CITY(x, z) || CITY(x - .2, z)) pts.push(z); if (pts.length > 6) lanes.push({ a: new THREE.Vector3(x, 0, pts[0]), b: new THREE.Vector3(x, 0, pts[pts.length - 1]), w: .03, road: 1 }); }
    for (let k = -8; k <= 4; k++) { const z = k * GRID + GRID / 2; const pts = []; for (let x = -4.8; x <= 4.8; x += .2) if (CITY(x, z) || CITY(x, z - .2)) pts.push(x); if (pts.length > 6) lanes.push({ a: new THREE.Vector3(pts[0], 0, z), b: new THREE.Vector3(pts[pts.length - 1], 0, z), w: .03, road: 1 }); } }
  const CARS = Array.from({ length: NC }, () => ({ l: pick(lanes), f: R(), sp: rnd(.05, .12), dir: R() < .5 ? 1 : -1 })); CARS.forEach(c => { if (R() < .45) c.l = lanes[0]; });

  /* the show: a blackout, the power wave out of the colossus's ring, then a hard techno set at 128 bpm. Sixteen beats of
     build (kick, hats, a filtered bassline opening up, beams waking), eight beats of snare roll and riser with the city pulled
     down and the beams converging on the ring, then the drop: impact, every beam snaps open, colours change on the beat,
     windows and neon pump with the kick, and the last bars strobe. Audio is scheduled a little ahead, step by step. */
  const beamM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uA: { value: 0 } },
    vertexShader: 'varying float vV; varying vec3 vN; varying vec3 vVw; void main(){ vV = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vVw = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uA; uniform vec3 diffuse; varying float vV; varying vec3 vN; varying vec3 vVw; void main(){ float e = pow(abs(dot(normalize(vN), vVw)), 1.5); gl_FragColor = vec4(diffuse * uA * e * pow(clamp(1. - vV, 0., 1.), 1.6) * .55, 1.); }' });
  const beamG = new THREE.CylinderGeometry(.02, .45, 10, 24, 1, true).translate(0, -5, 0).rotateX(Math.PI);
  { const uv = beamG.attributes.uv, p = beamG.attributes.position; for (let i = 0; i < uv.count; i++) uv.setY(i, clamp(p.getY(i) / 10, 0, 1)); }
  const origins = tall.slice().sort((a, b) => b[1] - a[1]).slice(0, 9); origins.push([BE[0], hAt(BE[0], BE[1]) + 2.9, BE[1]]);
  const COLS = ['#ffffff', '#bfe0ff', '#ff3aa0', '#3af0ff', '#b070ff', '#ffb040', '#40ff90'];
  const beams = origins.map(([x, y, z], i) => { const m = beamM.clone(); m.uniforms = { uA: { value: 0 }, diffuse: { value: new THREE.Color(COLS[i % 2]) } }; const b = new THREE.Mesh(beamG, m); b.position.set(x, y, z); b.visible = false; b.renderOrder = 8; island.add(b); return { b, m, i, rx: 0, rz: 0 }; });
  const AU = makeAudio(); AU.onStart = A => { A.surf = A.loop('lowpass', 420, .7, .08); A.hum = A.loop('lowpass', 120, 1.2, .02); A.city = A.loop('bandpass', 700, .4, .02); };
  const BPM = 128, BEAT = 60 / BPM, T0 = 1.8, BUILD = T0 + 16 * BEAT, ROLL = BUILD + 8 * BEAT, END = ROLL + 32 * BEAT, OUT = END + 3.2;
  // the synth
  const SY = (() => { let c, o, t0; const nz = (t, dur, type, f, vol, q = .8, f1) => { const s = c.createBufferSource(); s.buffer = AU.noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(o); s.start(t, Math.random() * 2); s.stop(t + dur + .02); };
    const osc = (t, type, f0, f1, dur, vol, cut, q = 1, att = .004) => { const os = c.createOscillator(); os.type = type; os.frequency.setValueAtTime(f0, t); if (f1 !== f0) os.frequency.exponentialRampToValueAtTime(f1, t + dur * .9); const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dur); let n = os; if (cut) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut * 2.4, t); fl.frequency.exponentialRampToValueAtTime(cut, t + dur * .7); fl.Q.value = q; os.connect(fl); n = fl; } n.connect(g); g.connect(o); os.start(t); os.stop(t + dur + .03); };
    return { start(now) { c = AU.ctx; o = AU.out; t0 = c.currentTime - now; }, at: e => t0 + e, ok: () => !!c,
      kick(t, g = 1) { osc(t, 'sine', 165, 40, .42, .95 * g); nz(t, .02, 'highpass', 2500, .22 * g); },
      hat(t, open, g = 1) { nz(t, open ? .22 : .045, 'highpass', 7600, (open ? .11 : .08) * g); },
      clap(t) { for (let k = 0; k < 3; k++) nz(t + k * .011, .1 + k * .03, 'bandpass', 1350, .32, 1.1); },
      snare(t, g) { nz(t, .11, 'bandpass', 1900, .32 * g, .9); osc(t, 'triangle', 210, 160, .08, .1 * g); },
      bass(t, f, dur, cut, g = .42) { osc(t, 'sawtooth', f, f, dur, g, cut, 9); osc(t, 'square', f / 2, f / 2, dur, g * .5, cut * .6, 4); },
      stab(t, root, cut) { [0, 3, 7, 10].forEach(sv => [-8, 8].forEach(dt2 => { const os = c.createOscillator(); os.type = 'sawtooth'; os.frequency.value = root * Math.pow(2, sv / 12); os.detune.value = dt2; const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(320, t + .3); fl.Q.value = 5; const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.045, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + .32); os.connect(fl); fl.connect(g); g.connect(o); os.start(t); os.stop(t + .35); })); },
      riser(t, dur) { const s = c.createBufferSource(); s.buffer = AU.noise; s.loop = true; const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 2.5; fl.frequency.setValueAtTime(350, t); fl.frequency.exponentialRampToValueAtTime(8000, t + dur); const g = c.createGain(); g.gain.setValueAtTime(.01, t); g.gain.exponentialRampToValueAtTime(.38, t + dur); g.gain.setValueAtTime(.0001, t + dur + .01); s.connect(fl); fl.connect(g); g.connect(o); s.start(t); s.stop(t + dur + .05);
        const os = c.createOscillator(); os.type = 'sawtooth'; os.frequency.setValueAtTime(110, t); os.frequency.exponentialRampToValueAtTime(1100, t + dur); const g2 = c.createGain(); g2.gain.setValueAtTime(.002, t); g2.gain.exponentialRampToValueAtTime(.07, t + dur); g2.gain.setValueAtTime(.0001, t + dur + .01); os.connect(g2); g2.connect(o); os.start(t); os.stop(t + dur + .05); },
      impact(t, g = 1) { osc(t, 'sine', 72, 22, 2.6, 1.0 * g, 0, 1, .003); nz(t, 2.6, 'lowpass', 1200, .7 * g, .7, 50); nz(t, 3, 'highpass', 5200, .22 * g, .5); nz(t, .08, 'highpass', 3000, .5 * g); },
      down(t) { osc(t, 'sawtooth', 320, 28, 1.1, .22, 900, 2); nz(t + .9, .4, 'lowpass', 180, .5, .8, 40); } }; })();
  const ROOTS = [55, 43.65, 49, 41.2], score = [];
  { const B = (b, base) => base + b * BEAT; score.push([.6, t => SY.down(t)], [T0, t => SY.impact(t, .55)]);
    for (let b = 0; b < 16; b++) { score.push([B(b, T0), t => SY.kick(t, .7 + b / 40)]); if (b >= 4) score.push([B(b + .5, T0), t => SY.hat(t, false)]); if (b >= 8) score.push([B(b + .75, T0), t => SY.hat(t, false, .6)]);
      for (let q = 1; q < 4; q++) score.push([B(b + q / 4, T0), t => SY.bass(t, q === 2 ? 65.4 : 55, BEAT / 4 * .9, 160 + b * 38)]); }
    for (let b = 0; b < 8; b++) { if (b < 6) { score.push([B(b, BUILD), t => SY.kick(t, 1)]); for (let q = 1; q < 4; q++) score.push([B(b + q / 4, BUILD), t => SY.bass(t, 55, BEAT / 4 * .9, 800 + b * 260)]); }
      const sub = b < 4 ? 2 : b < 6 ? 4 : 8; for (let q = 0; q < sub; q++) score.push([B(b + q / sub, BUILD), t => SY.snare(t, .3 + (b * sub + q) / (8 * sub) * .9)]); }
    score.push([BUILD, t => SY.riser(t, 8 * BEAT)]);
    score.push([ROLL, t => SY.impact(t, 1)]);
    for (let b = 0; b < 32; b++) { const r = ROOTS[Math.floor(b / 8) % 4]; score.push([B(b, ROLL), t => SY.kick(t, 1.05)]); if (b % 2) score.push([B(b, ROLL), t => SY.clap(t)]); score.push([B(b + .5, ROLL), t => SY.hat(t, true)]);
      for (let q = 0; q < 4; q++) { if (q !== 2) score.push([B(b + q / 4 + .25, ROLL), t => SY.hat(t, false, .5)]); if (q) score.push([B(b + q / 4, ROLL), t => SY.bass(t, q === 3 ? r * 2 : r, BEAT / 4 * .85, 1400)]); }
      if (b % 2 === 0) score.push([B(b + .5, ROLL), t => SY.stab(t, r * 4, 2600)]); if (b % 8 === 0 && b) score.push([B(b, ROLL), t => SY.impact(t, .35)]); }
    score.push([END, t => SY.impact(t, .9)]); score.sort((a, b) => a[0] - b[0]); }
  let ev = null; const api = { ev: () => { AU.get(); ev = { t: 0, f: {}, si: 0 }; if (AU.ctx) SY.start(0); }, get evOn() { return !!ev; } };
  const NEONP = [(t) => .9 + .1 * Math.sin(t * 120), (t, dt) => R() < dt * 1.5 ? .1 : 1, t => .55 + .45 * Math.sin(t * 2.2), t => Math.sin(t * 3.4) > -.2 ? 1 : .08, (t) => (Math.sin(t * 37) > .3 && Math.sin(t * 5.1) > -.6) ? 1 : .25, () => 1];
  ctx.steps.push(dt => { const t = ctx.clock; cm.uniforms.uPx.value = ctx.renderer.domElement.height / (2 * Math.tan(ctx.camera.fov * Math.PI / 360));
    const P = CU.uPow.value, G = .4 + U.uGlow.value * .5;
    beaconM.emissiveIntensity = (Math.sin(t * 3.1) > .6 ? 7 : .2) * P * G; strobeM.emissiveIntensity = ((t % 1.6) < .05 || ((t % 1.6) > .18 && (t % 1.6) < .23) ? 14 : 0) * P * G;
    ringL.intensity = ringM.emissiveIntensity * 1.6 * P;
    NEON.forEach((m, i) => { m.emissiveIntensity *= P * NEONP[i](t + i, dt) * (1 + CU.uPump.value * 1.2); });
    cruisers.forEach(c => { c.a += c.sp * dt; c.o.position.set(2.85 + Math.cos(c.a) * c.r, .01, 3.0 + Math.sin(c.a) * c.r * .6); c.o.rotation.set(Math.sin(t * 1.3 + c.r) * .03, -c.a - Math.sign(c.sp) * Math.PI / 2, 0); });
    // traffic
    const want = [0, 60, 140, 220][ctx.MOD.life] * (LO ? .55 : 1); let n = 0;
    for (let i = 0; i < Math.min(NC, want); i++) { const c = CARS[i], L = c.l; c.f += c.sp * dt * c.dir / Math.max(.5, L.a.distanceTo(L.b)) * 3; if (c.f > 1) c.f -= 1; if (c.f < 0) c.f += 1;
      const p = L.a.clone().lerp(L.b, c.f), dx = L.b.x - L.a.x, dz = L.b.z - L.a.z, ln = Math.hypot(dx, dz), ox = -dz / ln * L.w * c.dir, oz = dx / ln * L.w * c.dir; const y = L.road ? hAt(p.x, p.z) + .015 : p.y;
      cp[n * 3] = p.x + ox; cp[n * 3 + 1] = y; cp[n * 3 + 2] = p.z + oz; const head = c.dir > 0; cc[n * 3] = 1; cc[n * 3 + 1] = head ? .9 : .12; cc[n * 3 + 2] = head ? .7 : .06; n++; }
    cg.setDrawRange(0, n); cg.attributes.position.needsUpdate = cg.attributes.color.needsUpdate = true; cm.uniforms.uG.value = (.35 + U.uGlow.value * .6) * P;
    if (!ev) return;
    ev.t += dt; const e = ev.t, f = ev.f;
    if (!SY.ok() && AU.ctx) SY.start(e);
    if (SY.ok()) while (ev.si < score.length && score[ev.si][0] < e + .25) { const [te, fn] = score[ev.si++]; if (te >= e - .05) fn(SY.at(te)); }
    const inBuild = e >= T0 && e < BUILD, inRoll = e >= BUILD && e < ROLL, inDrop = e >= ROLL && e < END;
    const bt = e >= T0 ? (e - T0) / BEAT : -1, bi = Math.floor(bt), ph = bt - bi, kickE = (e >= T0 && e < END && !(e > ROLL - 2 * BEAT && e < ROLL)) ? Math.exp(-ph * 5) : 0;
    // blackout
    if (e < .6) CU.uPow.value = R() < .5 ? 1 : .15; else if (e < T0) { CU.uPow.value = Math.max(0, CU.uPow.value - dt * 7); if (!f.out) { f.out = 1; if (AU.ctx) AU.city.gain.setTargetAtTime(0, AU.ctx.currentTime, .2); } }
    // the power wave rolls out of the ring
    if (e >= T0 && !f.wave) { f.wave = 1; CU.uWaveOn.value = 1; CU.uWaveR.value = 0; CU.uPow.value = 1; ringM.emissiveIntensity = 40; }
    if (f.wave && CU.uWaveOn.value) { CU.uWaveR.value += dt * 2.6; if (CU.uWaveR.value > 16) CU.uWaveOn.value = 0; }
    if (inBuild) { CU.uPow.value = 1; CU.uPump.value = kickE * .35; }
    if (inRoll) { const k = (e - BUILD) / (ROLL - BUILD); CU.uPow.value = lerp(1, .25, k) * (k > .5 && R() < .3 ? .4 : 1); CU.uPump.value = 0; ringM.emissiveIntensity = 8 + k * 40; }
    if (inDrop) { if (!f.drop) { f.drop = 1; ctx.flash(.28, '#ffffff'); ctx.shake(.6); } const strobe = e > END - 8 * BEAT; CU.uPow.value = (.65 + .35 * kickE) * (strobe ? (Math.floor(bt * 4) % 2 ? .35 : 1) : 1); CU.uPump.value = kickE; ringM.emissiveIntensity = 14 + kickE * 40; CU.uHue.value.set(COLS[2 + (bi % 5)]); }
    if (e >= END) { CU.uPump.value = Math.max(0, CU.uPump.value - dt * 2); CU.uPow.value = Math.min(1, CU.uPow.value + dt * .8); }
    // the beams
    const vis = e > T0 + 8 * BEAT && e < OUT, fade = sm((e - T0 - 8 * BEAT) / (4 * BEAT)) * (1 - sm((e - END) / 3));
    beams.forEach(B => { B.b.visible = vis; if (!vis) return; const nb = beams.length - 1, i = B.i, lead = i === nb; let tx = 0, tz = 0, I = fade, sp = 3;
      if (inBuild) { tx = Math.sin(e * .7 + i) * .45; tz = Math.cos(e * .5 + i * 1.3) * .45; I *= .5 + .3 * kickE; sp = 2; }
      else if (inRoll) { const k = (e - BUILD) / (ROLL - BUILD), dx = BE[0] - B.b.position.x, dz = BE[1] - B.b.position.z, dy = 8 - B.b.position.y; tz = -Math.atan2(dx, dy) * k + Math.sin(e * 1.5 + i) * .4 * (1 - k); tx = Math.atan2(dz, dy) * k + Math.cos(e * 1.2 + i) * .4 * (1 - k); const sub = k < .5 ? 2 : k < .75 ? 4 : 8; I *= .5 + .6 * k + .5 * (Math.floor(bt * sub) % 2); sp = 4; }
      else if (e >= ROLL) { const pat = Math.floor((bt - (ROLL - T0) / BEAT) / 4) % 4, b2 = bi; if (lead) { tx = 0; tz = 0; } else if (pat === 0) { tz = (i / (nb - 1) - .5) * 1.5; tx = (b2 % 2 ? .25 : -.25); } else if (pat === 1) { tz = i % 2 ? .65 : -.65; tx = (b2 % 2 ? 1 : -1) * .3; } else if (pat === 2) { const a = b2 * .9 + i * TAU / nb; tx = Math.cos(a) * .6; tz = Math.sin(a) * .6; } else { tx = Math.sin(b2 * 1.7 + i) * .15; tz = Math.cos(b2 * 1.3 + i) * .15; }
        I *= .55 + kickE * .9; if (e > END - 8 * BEAT && e < END) I *= Math.floor(bt * 4) % 2 ? .1 : 1.4; sp = 14; if (Math.floor(bt) !== B.lastB) { B.lastB = Math.floor(bt); B.m.uniforms.diffuse.value.set(lead ? '#fff4d8' : COLS[(B.lastB + i) % COLS.length]); } }
      B.rx += (tx - B.rx) * (1 - Math.exp(-dt * sp)); B.rz += (tz - B.rz) * (1 - Math.exp(-dt * sp)); B.b.rotation.set(B.rx, 0, B.rz); B.m.uniforms.uA.value = I * (lead ? 1.5 : 1); });
    if (e > OUT) { ev = null; CU.uPow.value = 1; CU.uPump.value = 0; CU.uWaveOn.value = 0; beams.forEach(B => B.b.visible = false); if (AU.ctx) AU.city.gain.setTargetAtTime(.02, AU.ctx.currentTime, .5); }
  });
  { const done = new Set(); island.traverse(o => { if (!o.isMesh || !o.material || done.has(o.material) || o.material === water.mat || o.material === water.wallMat || o.material.isShaderMaterial || o === wl || o.material === leafMat || o.material === facM || o.material === glassM || o.material === strobeM || o.material === beaconM) return; done.add(o.material); underwater(o.material, SEA, 1.15); }); }
  ctx.api = api; return ctx;
}
