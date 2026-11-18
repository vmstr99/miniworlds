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

  /* buildings: every facade shares one material whose shader draws window grids, lit at night window by window;
     the power wave and the blackout drive it from two uniforms */
  const CU = { uPow: { value: 1 }, uWaveR: { value: 0 }, uWaveOn: { value: 0 }, uWO: { value: new THREE.Vector2(BE[0], BE[1]) } };
  const facade = (m, glass) => { m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, CU);
      sh.vertexShader = 'attribute vec2 bi; varying vec2 vBi; varying vec3 vWPb; varying vec3 vWNb;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBi = bi; vWPb = (modelMatrix * vec4(transformed, 1.)).xyz; vWNb = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = 'uniform float uTime, uGlow, uPow, uWaveR, uWaveOn; uniform vec2 uWO; varying vec2 vBi; varying vec3 vWPb; varying vec3 vWNb; float wWin; vec3 wE;\n' + GLSL_NOISE + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 P = vWPb, Nb = normalize(vWNb); float side = 1. - step(.55, abs(Nb.y)); float band = step(100., vBi.x);
    float u = dot(P.xz, normalize(vec2(-Nb.z, Nb.x) + 1e-5)) * ${glass ? '34.' : '26.'}, v = P.y * ${glass ? '24.' : '18.'};
    vec2 cl = floor(vec2(u, v)), fr = fract(vec2(u, v));
    float win = side * mix(step(.14, fr.x) * step(fr.x, .86) * step(.24, fr.y) * step(fr.y, .84), step(.3, fr.y) * step(fr.y, .78), band) * step(.07, P.y - vBi.y);
    float seed = mod(vBi.x, 100.), on = step(.56, hh(vec2(band > .5 ? floor(u * .2) : cl.x, cl.y) + seed * 37.)), tint = hh(cl + seed * 11. + 3.);
    vec3 lc = mix(vec3(1., .7, .4), vec3(.72, .86, 1.), step(.66, tint)) * (.55 + .7 * hh(cl + 9.)) * (.9 + .1 * sin(uTime * (1. + tint * 3.) + tint * 40.));
    float wave = mix(1., 1. - smoothstep(uWaveR - .5, uWaveR, length(P.xz - uWO)), uWaveOn) * uPow;
    wWin = win; wE = lc * win * on * uGlow * ${glass ? '.9' : '1.15'} * wave;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.05, .065, .08), win * ${glass ? '.4' : '.85'}); }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, .12, wWin);`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += wE;'); };
    m.customProgramCacheKey = () => 'facade' + glass; return m; };
  const facM = facade(new THREE.MeshStandardMaterial({ map: T.plaster, normalMap: T.plasterN, vertexColors: true, roughness: .75 }), false), glassM = facade(new THREE.MeshPhysicalMaterial({ color: '#7f97ab', metalness: .85, roughness: .07, clearcoat: .6, vertexColors: true }), true);
  glassM.userData.env = 1.4; MATS.push(facM, glassM);
  const goldM = new THREE.MeshStandardMaterial({ color: '#d6a650', metalness: 1, roughness: .28 }); MATS.push(goldM);
  const crownM = ctx.glowMat(new THREE.MeshStandardMaterial({ color: '#30261a', emissive: '#ffd890', emissiveIntensity: 2 }), 2), beaconM = new THREE.MeshStandardMaterial({ color: '#300', emissive: '#ff2a1a', emissiveIntensity: 0 }); MATS.push(crownM, beaconM);
  const NEON = ['#ff2e88', '#2ef2ff', '#ffb02e', '#9a5cff'].map(c => ctx.glowMat(new THREE.MeshStandardMaterial({ color: '#111', emissive: c, emissiveIntensity: 3 }), 3)); MATS.push(...NEON);
  const parts = { fac: [], glass: [], gold: [], crown: [], beacon: [], neon: [[], [], [], []] }, tall = [];
  const tag = (g, seed, base, col) => { const n = g.attributes.position.count, bi = new Float32Array(n * 2), c = new Float32Array(n * 3), cc = new THREE.Color(col); for (let i = 0; i < n; i++) { bi[i * 2] = seed; bi[i * 2 + 1] = base; c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; }
    g.setAttribute('bi', new THREE.BufferAttribute(bi, 2)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g.index ? g.toNonIndexed() : g; };
  const put = (list, g, x, y, z, ry = 0, seed = 0, base = 0, col = '#ffffff') => { g.rotateY(ry); g.translate(x, y, z); list.push(list === parts.fac || list === parts.glass ? tag(g, seed, base, col) : (g.index ? g.toNonIndexed() : g)); return g; };
  const BX = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), CY = (r, h, s = 24, r2 = r) => new THREE.CylinderGeometry(r, r2, h, s).translate(0, h / 2, 0);
  const FACC = ['#e8e0d0', '#d8d0c4', '#c8c0b4', '#ece4d8', '#bfb6a8', '#d9c9b0'], GLC = ['#8fa6b8', '#7d96a8', '#9ab0c0', '#6f8a9e', '#a0a8b0'];
  let seed = 1;
  const building = (x, z, back) => { const y = hAt(x, z) - .02, s = ++seed, fw = rnd(.26, .36), fd = rnd(.26, .36), ry = 0, Hm = .35 + back * back * 3.6 + R() * (.4 + back * 1.6), kind = R();
    if (Hm > 2.4 && kind < .22) { // art deco: setbacks, gold bands, a lit stepped crown
      let yy = y, w = fw * 1.15, d = fd * 1.15; const tiers = [.5, .22, .14]; tiers.forEach((f, i) => { const hh = Hm * f; put(parts.fac, BX(w, hh, d), x, yy, z, ry, s, y, pick(FACC)); put(parts.gold, BX(w + .012, .018, d + .012), x, yy + hh - .018, z); yy += hh; w *= .78; d *= .78; });
      for (let k = 0; k < 4; k++) { put(parts.crown, BX(w * (1 - k * .2), .06, d * (1 - k * .2)), x, yy + k * .06, z); } put(parts.gold, CY(.008, .35, 6), x, yy + .24, z); tall.push([x, yy + .55, z]); parts.beacon.push(new THREE.SphereGeometry(.014, 8, 6).translate(x, yy + .6, z).toNonIndexed()); return; }
    if (Hm > 2.0 && kind < .36) { // twisting glass tower
      const n = 26, hh = Hm / n; for (let k = 0; k < n; k++) put(parts.glass, BX(fw, hh * .96, fd), x, y + k * hh, z, k * .055, s, y, pick(GLC)); tall.push([x, y + Hm, z]); return; }
    if (kind < .5) { // round or octagonal glass
      const seg = R() < .5 ? 28 : 8, r = Math.min(fw, fd) * .62; put(parts.glass, CY(r, Hm, seg), x, y, z, 0, s, y, pick(GLC)); put(parts.fac, CY(r * 1.05, .04, seg), x, y + Hm, z, 0, s, y + 9, '#cfc8bc');
      if (R() < .4) put(parts.glass, new THREE.ConeGeometry(r, r * 1.2, seg).translate(0, r * .6, 0), x, y + Hm + .04, z, 0, s, y + 99, pick(GLC)); else { put(parts.fac, CY(.03, .12, 8), x + r * .4, y + Hm, z, 0, s, y + 9, '#888'); }
      if (Hm > 1.6) tall.push([x, y + Hm, z]); return; }
    if (kind < .72 && Hm > 1.0) { // setback slab with a mast and beacon
      put(parts.fac, BX(fw, Hm * .7, fd), x, y, z, ry, s, y, pick(FACC)); put(parts.fac, BX(fw * .7, Hm * .3, fd * .7), x, y + Hm * .7, z, ry, s, y, pick(FACC));
      if (R() < .55) { put(parts.gold, CY(.006, .45, 5, .012), x, y + Hm, z); parts.beacon.push(new THREE.SphereGeometry(.013, 8, 6).translate(x, y + Hm + .46, z).toNonIndexed()); }
      if (R() < .5) put(parts.glass, new THREE.ConeGeometry(fw * .5, fw * .5, 4).rotateY(Math.PI / 4).translate(0, fw * .25, 0), x, y + Hm, z, 0, s, y + 99, pick(GLC));
      if (R() < .35) { const ni = Math.floor(R() * 4), side = R() < .5 ? 1 : -1; parts.neon[ni].push(BX(.012, Math.min(.6, Hm * .4), .05).translate(x + side * (fw / 2 + .008), y + .1 + R() * Hm * .3, z).toNonIndexed()); }
      if (Hm > 1.6) tall.push([x, y + Hm, z]); return; }
    // low and mid blocks with rooftop tanks; neon on some
    put(R() < .3 ? parts.glass : parts.fac, BX(fw, Hm, fd), x, y, z, ry, s, y, R() < .3 ? pick(GLC) : pick(FACC));
    if (R() < .5) put(parts.fac, CY(.035, .06, 10), x + rnd(-.06, .06), y + Hm, z + rnd(-.06, .06), 0, s, y + 9, '#8a8478');
    if (R() < .3) { const ni = Math.floor(R() * 4); parts.neon[ni].push(BX(fw * .8, .03, .012).translate(x, y + Hm * rnd(.3, .8), z + fd / 2 + .008).toNonIndexed()); } };
  for (let gx = -11; gx <= 11; gx++) for (let gz = -11; gz <= 11; gz++) { const x = gx * GRID, z = gz * GRID; if (!CITY(x, z)) continue; const back = sm((-(x + z) / 1.414 + 1.4) / 6.2);
    if (R() < .1 && back < .6) continue; building(x + rnd(-.03, .03), z + rnd(-.03, .03), back); if (back > .55 && R() < .4) building(x + rnd(-.08, .08), z + rnd(-.08, .08), back * .7); }
  // streamline hotels along the promenade
  for (let k = 0; k < 9; k++) { const a = -3.2 + k * .62, x = a * .7071 + .0, z = -a * .7071, sd = shoreD(x, z); let px = x, pz = z; for (let q = 0; q < 20 && shoreD(px, pz) > -.42; q++) { px -= .05; pz -= .05; } if (!CITY(px, pz) && riverD(px, pz) < .6) continue;
    const y = hAt(px, pz) - .02, H = rnd(.45, .85), w = rnd(.42, .6), s = 100 + (++seed); put(parts.fac, BX(w, H, .2), px, y, pz, -Math.PI / 4, s, y, '#f2ece2'); [-1, 1].forEach(e => put(parts.fac, CY(.1, H, 18), px + Math.cos(Math.PI / 4) * e * w / 2, y, pz + Math.sin(Math.PI / 4) * e * w / 2, 0, s, y, '#f2ece2'));
    parts.neon[k % 4].push(BX(w * .6, .035, .012).rotateY(-Math.PI / 4).translate(px + .07, y + H + .02, pz + .07).toNonIndexed()); }
  const mergeTo = (list, m, shadow = true) => { if (!list.length) return null; const o = new THREE.Mesh(mergeGeometries(list), m); o.castShadow = shadow; o.receiveShadow = true; island.add(o); return o; };
  mergeTo(parts.fac, facM); mergeTo(parts.glass, glassM); mergeTo(parts.gold, goldM); mergeTo(parts.crown, crownM, false); mergeTo(parts.beacon, beaconM, false); parts.neon.forEach((l, i) => mergeTo(l, NEON[i], false));

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

  /* the show */
  const beamM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uA: { value: 0 } },
    vertexShader: 'varying float vV; varying vec3 vN; varying vec3 vVw; void main(){ vV = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vVw = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uA; uniform vec3 diffuse; varying float vV; varying vec3 vN; varying vec3 vVw; void main(){ float e = pow(abs(dot(normalize(vN), vVw)), 1.5); gl_FragColor = vec4(diffuse * uA * e * pow(clamp(1. - vV, 0., 1.), 1.6) * .55, 1.); }' });
  const beamG = new THREE.CylinderGeometry(.02, .5, 10, 24, 1, true).translate(0, -5, 0).rotateX(Math.PI); // apex at the origin, opening along +y
  { const uv = beamG.attributes.uv, p = beamG.attributes.position; for (let i = 0; i < uv.count; i++) uv.setY(i, clamp(p.getY(i) / 10, 0, 1)); }
  const origins = tall.slice().sort((a, b) => b[1] - a[1]).slice(0, 10); origins.push([BE[0], hAt(BE[0], BE[1]) + 2.9, BE[1]]);
  const COLS = ['#ffffff', '#bfe0ff', '#ffd8a0', '#ff4aa0', '#4af0ff', '#b080ff'];
  const beams = origins.map(([x, y, z], i) => { const m = beamM.clone(); m.uniforms = { uA: { value: 0 }, diffuse: { value: new THREE.Color(COLS[i % 3]) } }; const b = new THREE.Mesh(beamG, m); b.position.set(x, y, z); b.visible = false; b.renderOrder = 8; island.add(b); return { b, m, ph: rnd(TAU), i }; });
  const AU = makeAudio(); AU.onStart = A => { A.surf = A.loop('lowpass', 420, .7, .08); A.hum = A.loop('lowpass', 120, 1.2, .02); A.city = A.loop('bandpass', 700, .4, .02); };
  let ev = null; const api = { ev: () => { AU.get(); ev = { t: 0, f: {} }; }, get evOn() { return !!ev; } };
  const PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784];
  const eu = new THREE.Euler(), qq = new THREE.Quaternion();
  ctx.steps.push(dt => { const t = ctx.clock; cm.uniforms.uPx.value = ctx.renderer.domElement.height / (2 * Math.tan(ctx.camera.fov * Math.PI / 360));
    beaconM.emissiveIntensity = (Math.sin(t * 3.1) > .6 ? 7 : .2) * CU.uPow.value * (.4 + U.uGlow.value * .5);
    ringL.intensity = ringM.emissiveIntensity * 1.6 * CU.uPow.value;
    NEON.forEach((m, i) => { m.emissiveIntensity *= CU.uPow.value * (R() < dt * .6 ? .15 : 1); });
    cruisers.forEach(c => { c.a += c.sp * dt; c.o.position.set(2.85 + Math.cos(c.a) * c.r, .01, 3.0 + Math.sin(c.a) * c.r * .6); c.o.rotation.set(Math.sin(t * 1.3 + c.r) * .03, -c.a - Math.sign(c.sp) * Math.PI / 2, 0); });
    // traffic
    const want = [0, 60, 140, 220][ctx.MOD.life] * (LO ? .55 : 1); let n = 0;
    for (let i = 0; i < Math.min(NC, want); i++) { const c = CARS[i], L = c.l; c.f += c.sp * dt * c.dir / Math.max(.5, L.a.distanceTo(L.b)) * 3; if (c.f > 1) c.f -= 1; if (c.f < 0) c.f += 1;
      const p = L.a.clone().lerp(L.b, c.f), dx = L.b.x - L.a.x, dz = L.b.z - L.a.z, ln = Math.hypot(dx, dz), ox = -dz / ln * L.w * c.dir, oz = dx / ln * L.w * c.dir; const y = L.road ? hAt(p.x, p.z) + .015 : p.y;
      cp[n * 3] = p.x + ox; cp[n * 3 + 1] = y; cp[n * 3 + 2] = p.z + oz; const head = c.dir > 0 ? 1 : 0; cc[n * 3] = head ? 1 : 1; cc[n * 3 + 1] = head ? .9 : .12; cc[n * 3 + 2] = head ? .7 : .06; n++; }
    cg.setDrawRange(0, n); cg.attributes.position.needsUpdate = cg.attributes.color.needsUpdate = true; cm.uniforms.uG.value = (.35 + U.uGlow.value * .6) * CU.uPow.value;
    if (ev) { ev.t += dt; const e = ev.t, f = ev.f;
      // blackout: a flicker, then the whole shore goes dark
      if (e < .9) CU.uPow.value = e < .5 ? (R() < .5 ? 1 : .2) : Math.max(0, CU.uPow.value - dt * 6);
      if (e > .5 && !f.out) { f.out = 1; AU.burst(.6, 300, .35); AU.tone(110, 40, 1.2, .2); if (AU.ctx) AU.city.gain.setTargetAtTime(0, AU.ctx.currentTime, .2); }
      // the power wave: the colossus's ring flares, then light rolls out across the city
      if (e > 2.2 && !f.wave) { f.wave = 1; CU.uWaveOn.value = 1; CU.uWaveR.value = 0; CU.uPow.value = 1; ctx.flash(.12, '#ffe2a0'); AU.tone(80, 320, 3.2, .18); for (let k = 0; k < 6; k++) AU.tone(PENTA[k] * 2, PENTA[k] * 2, 1.2, .05, .3 + k * .25, 'triangle'); }
      if (f.wave) { CU.uWaveR.value += dt * 3.2; ringM.emissiveIntensity = Math.max(ringM.emissiveIntensity, 30 * Math.exp(-(e - 2.2) * 1.5)); if (CU.uWaveR.value > 16) CU.uWaveOn.value = 0; }
      // searchlights: fan sweeps, a crossing over the colossus, colour strobes
      const show = e > 4.2 && e < 22, k = sm((e - 4.2) / 1) * (1 - sm((e - 20.5) / 1.5));
      beams.forEach(B => { B.b.visible = k > .01; if (!B.b.visible) return; let rx, rz; const s = B.i * .7 + B.ph;
        if (e < 9) { rx = Math.sin(t * .8 + s) * .5; rz = Math.cos(t * .6 + s * 1.3) * .5; }
        else if (e < 13) { const tx = BE[0], tz = BE[1], ty = 7.5, dx = tx - B.b.position.x, dz = tz - B.b.position.z, dy = ty - B.b.position.y; rz = -Math.atan2(dx, dy) * .9; rx = Math.atan2(dz, dy) * .9; rx += Math.sin(t * 2 + s) * .05; }
        else { rx = Math.sin(t * 2.2 + s) * .7; rz = Math.sin(t * 1.7 + s * 2.1) * .7; }
        B.b.rotation.set(rx, 0, rz); B.m.uniforms.uA.value = k * (e > 13 && e < 20 ? (Math.sin(t * 9 + B.i) > 0 ? 1.3 : .25) : 1) * (B.i === beams.length - 1 ? 1.4 : 1);
        if (e > 13 && R() < dt * 2) B.m.uniforms.diffuse.value.set(pick(COLS)); });
      if (show && Math.floor(e * 2.5) !== f.beat) { f.beat = Math.floor(e * 2.5); AU.tone(PENTA[f.beat % 9] * (e > 13 ? 2 : 1), PENTA[f.beat % 9] * (e > 13 ? 2 : 1), .5, .04, 0, 'triangle'); if (f.beat % 4 === 0) AU.burst(.35, 140, .2); }
      if (e > 23) { ev = null; CU.uPow.value = 1; CU.uWaveOn.value = 0; beams.forEach(B => B.b.visible = false); if (AU.ctx) AU.city.gain.setTargetAtTime(.02, AU.ctx.currentTime, .5); } }
  });
  { const done = new Set(); island.traverse(o => { if (!o.isMesh || !o.material || done.has(o.material) || o.material === water.mat || o.material === water.wallMat || o.material.isShaderMaterial || o === wl || o.material === leafMat || o.material === facM || o.material === glassM) return; done.add(o.material); underwater(o.material, SEA, 1.15); }); }
  ctx.api = api; return ctx;
}
