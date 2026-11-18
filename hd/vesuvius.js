/* Vesuvius, 79 AD: the classic deck's composition (the Gran Cono, Monte Somma's broken rim wrapping its far flank, a villa
   terrace above vineyard rings, a bay below) rebuilt with real textures and light. A Roman villa around a colonnaded garden,
   umbrella pines, cypress avenues, vines, galleys in the bay. Out where the bay falls away into deep water, the cut walls
   hint at what the sea already holds: sunken Roman ruins and an amphora wreck. EVENT: the Plinian eruption. */
import { THREE, mergeGeometries, $, TAU, R, rnd, pick, clamp, lerp, sm, Q, makeNoise, GLSL_NOISE, TRI, createEngine, LO, QN, makeHeightfield, DZ, SLAB, makeWalls, wallMaterial, makeWater, crownGeometry, makeSpray, makeAudio, makeSnowfall, underwater } from './core.js';

export const META = { name: 'Vesuvius, 79 AD', line: 'A villa above the bay, vines on the slopes, and a mountain nobody thinks is a volcano. Press Eruption. Drag to orbit, pinch or scroll to zoom.', era: 'Bay of Naples · 24 August, 79 AD', ev: 'Eruption', preset: { time: 1, clouds: 1, rain: 0, wind: 1, glow: 1, life: 2 }, birds: 'gull' };

export function build() {
  const N = makeNoise(+(Q.get('seed') || 79)), S = 10, H5 = 5, K = S / 6.4, SEA = .1 * K, DEPTH = SLAB, NORM = 2.4;
  const VC = [-1.45, -1.45], VX = .62, VZ = .74, VS = 1.5, VH = .6, BACKA = Math.atan2(-.35, -1); // classic units (slab 6.4 wide)
  const villaD = (x, z) => Math.hypot((x - VX - .26) / 1.25, (z - VZ) / .82) + N.fbm(x * .9 + 3, z * .9) * .28, inVilla = (x, z, m = 0) => villaD(x, z) < 1 + m;
  const ctx = createEngine({ cam: { target: [-.4, 2.2, -.4], dist: 50, pol: 1.08, az: Math.PI / 4, min: 12, max: 80 }, look: 'noon', sunRef: 3.2,
    skies: { noon: 'sky_noon.rgbe.png', gold: 'sky_gold.rgbe.png', storm: 'sky_storm.rgbe.png' },
    looks: { noon: { sky: 'noon', dir: [-.55, 1, .55], col: '#fff2e2', I: 3.2, env: 1, exp: 1.05 }, gold: { sky: 'gold', dir: [-.95, .32, .15], col: '#ffa860', I: 3.4, env: .7, exp: 1.0, warm: 1 },
      erupt: { sky: 'storm', dir: [.6, .5, .5], col: '#ff5a24', I: .5, env: .16, exp: 1.4, warm: .9, skyI: .2, ember: 1 } } });
  const { island, tex, U, MATS } = ctx; ctx.waterLevel = SEA;
  ctx.shadowExtent = 9; Object.assign(ctx.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, far: 90 }); ctx.sun.shadow.camera.updateProjectionMatrix();
  const T = { rock: tex('rock_diff.jpg'), rockN: tex('rock_nor.jpg', false), lime: tex('lime_diff.jpg'), limeN: tex('lime_nor.jpg', false), grass: tex('mtn_diff.jpg'), grassN: tex('mtn_nor.jpg', false), forest: tex('forest_diff.jpg'), forestN: tex('forest_nor.jpg', false),
    sand: tex('sand_diff.jpg'), sandN: tex('sand_nor.jpg', false), reef: tex('reef_diff.jpg'), plaster: tex('plaster_diff.jpg'), roof: tex('roof_diff.jpg'), roofN: tex('roof_nor.jpg', false), leaf: tex('leaf_diff.jpg', true, false), leafA: tex('leaf_alpha.jpg', false, false), leafN: tex('leaf_nor.jpg', false, false),
    fir: tex('fir_diff.jpg', true, false), firA: tex('fir_alpha.jpg', false, false), firN: tex('fir_nor.jpg', false, false), bark: tex('bark_diff.jpg'), barkN: tex('bark_nor.jpg', false), wood: tex('pine_diff.jpg') };

  /* the land: the classic composition, roughened so no side is plain. The cone leans and is lopsided, its crater breached
     with a collapse scar falling away below; three parasitic cones and two old lava tongues sit on its flanks; Somma stands
     higher and jagged across the valley; farming terraces step down to an irregular villa shelf; the coast breaks into
     headlands and coves with sea stacks and a lighthouse islet; a canyon cuts the far slopes so the back walls show strata. */
  const BRE = -.3, PARA = [[-.25, -.15, .18, .5], [-2.6, -.5, .15, .38], [-.8, -2.6, .17, .42]], LAVA = [[BACKA + 2.5, .9, 2.4, .16], [BACKA - 2.1, 1.0, 2.2, .13]];
  const STK = [[1.85, 2.75, .25, .62], [2.95, 1.25, .1, .45], [.95, 3.0, .09, .38]], FARM = [1.25, -2.2];
  const seaE = (u, v) => Math.hypot(u + .22, v + .22) + N.fbm(u * 2.2 + 5, v * 2.2) * .36 + N.fbm(u * 5, v * 5) * .035 - .1;
  function height(u, v) { const x = u * 3.2, z = v * 3.2;
    const wx = N.fbm(u * 1.6 + 7, v * 1.6) * .22, wz = N.fbm(u * 1.6, v * 1.6 + 7) * .22, dx = x - VC[0] + wx, dz = z - VC[1] + wz, ca = Math.cos(.45), sa = Math.sin(.45);
    const r = Math.hypot((dx * ca + dz * sa) / 1.08, (-dx * sa + dz * ca) / .92), rS = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
    let h = .3 + N.fbm(u * 3, v * 3) * .12;
    const mass = 1.45 * Math.pow(Math.max(0, 1 - rS / 3.3), 1.35), lop = 1 + .1 * Math.cos(ang - BACKA) - .06 * Math.cos(2 * ang + 1);
    const CR = .46, CH = 3.25 * lop, CW = 1.8, rim = CH * Math.pow(1 - CR / CW, 1.3) * (1 + .12 * N.fbm(ang * 1.7 + 4, 2.1));
    let cone = r < CR ? rim - .75 * (1 - Math.pow(r / CR, 2.2)) : rim * Math.pow(Math.max(0, 1 - (r - CR) / (CW - CR)), 1.3);
    const db = Math.atan2(Math.sin(ang - BRE), Math.cos(ang - BRE)); cone -= Math.exp(-db * db / .16) * .95 * clamp(1 - (r - .3) / 1.35, 0, 1);
    const back = Math.cos(ang - BACKA), mask = clamp((back + .05) / .7, 0, 1), smk = mask * mask * (3 - 2 * mask), SR = 1.95;
    let som = rS < SR ? 2.45 * sm((rS - 1.2) / (SR - 1.2)) : 2.45 * Math.pow(Math.max(0, 1 - (rS - SR) / 1.6), 1.35); som *= smk * (.62 + .55 * (N.fbm(ang * 2.3 + 2, rS * .6) * .5 + .5)) * (.9 + .18 * N.ridge(ang * 3.2, rS * 1.4, 3));
    const gul = (N.ridge(ang * 5 + 3, r * 1.8, 4) - .55) * .2 * clamp(mass + .3, 0, 1) * clamp(r / .6, 0, 1);
    const ero = (N.ridge(ang * 11 + N.fbm(r * 2.2, ang * 1.3) * 1.6, r * .9, 3) - .5) * .26 * (.5 + .8 * (N.fbm(ang * 3, 1.7) * .5 + .5)) * clamp((r - .38) / .3, 0, 1) * clamp((1.75 - r) / .6, 0, 1);
    h += mass + Math.max(cone, som) + gul + ero;
    PARA.forEach(([px, pz, pr, ph]) => { const d = Math.hypot(x - px, z - pz) / pr; if (d < 2.3) h += d < .35 ? ph - .14 * (1 - (d / .35) ** 2) : ph * Math.pow(Math.max(0, 1 - (d - .35) / 1.95), 1.6); });
    LAVA.forEach(([a0, r0, r1, w]) => { const dd = Math.atan2(Math.sin(ang - a0), Math.cos(ang - a0)) * rS, t = (rS - r0) / (r1 - r0), lw = w * (1 + Math.max(0, t) * .9); if (t > 0 && t < 1.1 && Math.abs(dd) < lw) h += .14 * (1 - (dd / lw) ** 2) * Math.min(1, t * 5) * (t > 1 ? (1.1 - t) / .1 : 1) * (.75 + .5 * N.ridge(x * 9, z * 9, 3)); });
    if (z < -1.5) { const cx = lerp(-.7, .55, clamp((-z - 1.6) / 1.5, 0, 1)) + .22 * Math.sin(z * 3.1), d = Math.abs(x - cx); h -= Math.exp(-d * d / .025) * .8 * sm((-z - 1.5) / .5); }
    const e = seaE(u, v), cm = clamp((e - 1.04) / .22, 0, 1);
    h = lerp(h, -.7 - .45 * clamp((e - 1.25) / .35, 0, 1) + N.fbm(u * 5, v * 5) * .12, cm * cm * (3 - 2 * cm));
    h = lerp(h, -3.05 + N.fbm(u * 3 + 2, v * 3) * .15, sm((e - 1.3) / .25));
    STK.forEach(([sx, sz, sr, sh], q) => { const d = Math.max(0, Math.hypot(x - sx, z - sz) / sr + N.fbm(x * 5 + q, z * 5) * .3); if (d < 1) h = Math.max(h, sh * (1 - Math.pow(d, 6)) + N.ridge(x * 14, z * 14, 3) * .05); });
    const vd = villaD(x, z); if (vd < 2.4 && h > .12) { const fm = 1 - sm((vd - .85) / .3); h = lerp(h, VH, fm); const tm = sm((2.4 - vd) / .45) * (1 - fm) * (1 - sm((h - 1.5) / .2));
      if (tm > 0) { const st = .11, q = h / st, fq = q - Math.floor(q); h = lerp(h, (Math.floor(q) + sm((fq - .78) / .22)) * st, tm * .85); } }
    const fd = Math.hypot(x - FARM[0], z - FARM[1]) + N.fbm(x * 2, z * 2) * .2; if (fd < .9 && h > .2) { const st = .1, q = h / st, fq = q - Math.floor(q); h = lerp(h, (Math.floor(q) + sm((fq - .8) / .2)) * st, (1 - sm((fd - .5) / .4)) * .85); }
    return h * K; }
  const hf = makeHeightfield(S, 320, height), { hAt, normAt } = hf, cl = (X, Z) => [X / K, Z / K];
  // zones baked per vertex: cone and ash, Somma forest, vineyard rings, villa garden; plus the classic radius for lava and vine rows
  { const p = hf.geo.attributes.position, zone = new Float32Array(p.count * 4), rr = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) { const [x, z] = cl(p.getX(i), p.getZ(i)), h = p.getY(i) / K, dx = x - VC[0], dz = z - VC[1], r = Math.hypot(dx, dz), back = Math.cos(Math.atan2(dz, dx) - BACKA);
      zone[i * 4] = sm((h - 1.3) / .3) * (1 - sm((back - .25) / .2)) + (r < .55 ? 1 : 0); zone[i * 4 + 1] = sm((back - .3) / .15) * sm((h - .8) / .15); zone[i * 4 + 2] = r > 1.95 && r < 3.05 && h > .4 && h < 1.1 ? 1 : 0; zone[i * 4 + 3] = inVilla(x, z, .05) ? 1 : 0; rr[i] = r; }
    hf.geo.setAttribute('zone', new THREE.BufferAttribute(zone, 4)); hf.geo.setAttribute('rr', new THREE.BufferAttribute(rr, 1)); }
  const LU = { uLava: { value: 0 }, uBlow: { value: 0 } }, CRX = VC[0] * K, CRZ = VC[1] * K, BR = .62 * K, BD = .5 * K;
  const terrMat = new THREE.MeshStandardMaterial({ roughness: .92 }); MATS.push(terrMat);
  terrMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, LU, { tRock: { value: T.rock }, tRockN: { value: T.rockN }, tLime: { value: T.lime }, tLimeN: { value: T.limeN }, tGrass: { value: T.grass }, tGrassN: { value: T.grassN }, tForest: { value: T.forest }, tForestN: { value: T.forestN }, tSand: { value: T.sand }, tSandN: { value: T.sandN }, tReef: { value: T.reef } });
    sh.vertexShader = 'uniform float uBlow; attribute vec4 zone; attribute float rr; varying vec4 vZ; varying float vR; varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float bd = length(transformed.xz - vec2(' + CRX.toFixed(3) + ', ' + CRZ.toFixed(3) + ')) / ' + BR.toFixed(3) + '; if (bd < 1.) transformed.y -= uBlow * ' + BD.toFixed(3) + ' * (1. - bd * bd); }\nvZ = zone; vR = rr; vWP = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = `uniform sampler2D tRock, tRockN, tLime, tLimeN, tGrass, tGrassN, tForest, tForestN, tSand, tSandN, tReef; uniform float uTime, uSun, uCloud, uLava, uBlow; varying vec4 vZ; varying float vR; varying vec3 vWP; varying vec3 vWN; float mC, mF, mG, mK, mB, mS; float lavaGlow;\n` + GLSL_NOISE + TRI + sh.fragmentShader
      .replace('#include <map_fragment>', `
  vec3 P = vWP, Nn = normalize(vWN), w = triW(Nn); float slope = 1. - Nn.y;
  mS = smoothstep(${(SEA + .05).toFixed(3)}, ${(SEA - .25).toFixed(3)}, P.y); mB = (1. - mS) * smoothstep(${(SEA + .5).toFixed(3)}, ${(SEA + .15).toFixed(3)}, P.y) * (1. - smoothstep(.5, .8, slope));
  mK = smoothstep(.4, .65, slope) * (1. - mS); mC = clamp(vZ.x, 0., 1.) * (1. - mS); mF = vZ.y * (1. - mC) * (1. - mS);
  vec3 ash = tri2(tRock, P, w, .3) * vec3(.42, .38, .36), cliff = mix(tri2(tLime, P, w, .25) * vec3(.9, .82, .7), ash * 1.4, .4), grass = tri2(tGrass, P, w, .35) * vec3(1.05, .98, .72), forest = tri2(tForest, P, w, .4) * vec3(.5, .6, .38);
  vec3 sand = tri2(tSand, P, w, .35) * vec3(1.0, .9, .74), bed = mix(sand * .9, tri2(tReef, P, w, .3) * .9, smoothstep(.45, .62, fbm(P.xz * .4))) * mix(1., .7, smoothstep(-.3, -2., P.y));
  float vine = vZ.z * smoothstep(.35, .45, abs(fract(vR * 9.) - .5)); grass = mix(grass, mix(grass * vec3(.5, .7, .4), vec3(.36, .3, .22), .3), vine);
  { vec2 gq = vec2(P.x + P.z, P.x - P.z) * 4.5; vec2 gf = abs(fract(gq) - .5); float hedge = smoothstep(.36, .4, max(gf.x, gf.y)) * (1. - smoothstep(.46, .5, max(gf.x, gf.y))), walk = smoothstep(.44, .48, max(gf.x, gf.y)); vec3 garden = mix(grass * vec3(.85, 1.1, .7), vec3(.08, .17, .06), hedge); garden = mix(garden, grass * vec3(1.15, 1.05, .8), walk * .6); grass = mix(grass, garden, vZ.w); }
  vec3 col = grass; col = mix(col, forest, mF); col = mix(col, ash, mC); col = mix(col, cliff, mK * (1. - mC)); col = mix(col, sand, mB); col = mix(col, bed, mS);
  float dep = ${SEA.toFixed(3)} - P.y; if (dep > 0.) col += vec3(.75, .95, .9) * caustic(P.xz, uTime) * exp(-dep * 1.1) * .5 * uSun;
  col *= cloudShade(P.xz, uTime, uCloud);
  float ch = fbm(vec2(atan(P.z + ${(1.45 * K).toFixed(3)}, P.x + ${(1.45 * K).toFixed(3)}) * 9., vR * 2.) ), chan = smoothstep(.55, .72, ch) * mC;
  lavaGlow = chan * step(vR, .3 + uLava * 1.5) * uLava + step(vR, .33) * uLava * .8; col = mix(col, vec3(.05, .03, .02), clamp(lavaGlow, 0., 1.) * .7); { float bd = length(P.xz - vec2(${CRX.toFixed(3)}, ${CRZ.toFixed(3)})) / ${BR.toFixed(3)}; col = mix(col, mix(vec3(.2, .06, .035), vec3(.09, .075, .07), smoothstep(.5, 1.3, bd)), uBlow * smoothstep(1.6, .7, bd)); lavaGlow += uBlow * smoothstep(.55, .2, bd) * (.5 + .5 * vn(P.xz * 9. + uTime * .5)); }
  diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(.92, .5, mB * smoothstep(.4, .1, vWP.y - ' + SEA.toFixed(3) + '));')
      .replace('#include <normal_fragment_maps>', '{ vec3 nT = normalize(triN(tRockN, vWP, Nn, w, .3) * (mC + mK * .5) + triN(tGrassN, vWP, Nn, w, .35) * (1. - mC - mF) + triN(tForestN, vWP, Nn, w, .4) * mF + triN(tSandN, vWP, Nn, w, .35) * (mB + mS) + Nn * .05); normal = normalize((viewMatrix * vec4(nT, 0.)).xyz); }')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(6., 1.6, .25) * lavaGlow * (.7 + .3 * vn(vWP.xz * 6. + uTime * .4));'); };
  const terr = new THREE.Mesh(hf.geo, terrMat); terr.castShadow = terr.receiveShadow = true; island.add(terr);
  const walls = makeWalls(hf, DEPTH, SEA, NORM), wallM0 = wallMaterial(ctx, T.rock, T.rockN, [.55, .5, .46]);
  /* lava veins in the cut: a magma chamber deep under the cone feeding branching dikes up through the strata, glow pulses
     creeping upward; at rest a slow simmer, in the eruption they swell, brighten and run */
  LU.uVein = { value: .22 }; LU.uVeinW = { value: 1 };
  { const prev = wallM0.onBeforeCompile; wallM0.onBeforeCompile = (sh, r) => { prev(sh, r); Object.assign(sh.uniforms, { uTime: U.uTime, uVein: LU.uVein, uVeinW: LU.uVeinW });
    sh.vertexShader = 'varying vec3 vVW; varying vec3 vVN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvVW = (modelMatrix * vec4(transformed, 1.)).xyz; vVN = normal;');
    sh.fragmentShader = 'uniform float uTime, uVein, uVeinW; varying vec3 vVW; varying vec3 vVN; float veinE;\n' + GLSL_NOISE + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 P = vVW; float a = abs(vVN.x) > .5 ? P.z : P.x, y = P.y, side = abs(vVN.x) > .5 ? 3.7 : 0.;
    float prox = exp(-length(P.xz - vec2(${CRX.toFixed(2)}, ${CRZ.toFixed(2)})) * .22), deep = smoothstep(.1, -2.4, y);
    float n1 = fbm(vec2(a * .9 + side, y * 1.0 + side)), n2 = fbm(vec2(a * 2.3 - side, y * 2.4 + 3.1)), n3 = fbm(vec2(a * 5.1 + 7., y * 5. - side));
    float w = .014 * uVeinW * (.5 + deep * .7 + prox * .6);
    float v = smoothstep(w, 0., abs(n1 - .5)) + smoothstep(w * .7, 0., abs(n2 - .5)) * (.35 + deep * .65) + smoothstep(w * .45, 0., abs(n3 - .5)) * deep * .6;
    float chamber = smoothstep(2.6, .0, length(vec2((a - ${(CRX * .0).toFixed(2)}) * .45 + (side > 0. ? ${(CRZ * .45).toFixed(2)} : ${(CRX * .45).toFixed(2)}) * -1., (y + 2.35) * 1.9))) * prox * 1.6;
    float pulse = .55 + .45 * sin(y * 5. - uTime * (1.1 + uVein * 1.4) + n2 * 18.) * sin(a * 2.1 + uTime * .3);
    v = clamp(v, 0., 1.) * (.25 + .75 * deep + prox * .5) * pulse + chamber * (.7 + .3 * sin(uTime * 1.3 + a));
    veinE = v * uVein * step(y, -.12); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.08, .03, .02), clamp(v * 1.5, 0., 1.) * .8); }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += mix(vec3(1.6, .28, .03), vec3(4.5, 1.7, .4), clamp(veinE * .8, 0., 1.)) * veinE * 2.2;'); };
    wallM0.customProgramCacheKey = () => 'vesWall'; }
  const wl = new THREE.Mesh(walls.land, wallM0); wl.castShadow = wl.receiveShadow = true; island.add(wl);
  const water = makeWater(ctx, hf, { level: SEA, att: '#1e8fb0', attDist: 1.2, deep: '#0b3f86', shallow: '#167a8a', glint: 1, norm: NORM, wallK: 4 });
  island.add(new THREE.Mesh(walls.water, water.wallMat));

  /* the villa: rooms around a colonnaded garden with a pool, a portico to the sea, Pompeian-red dados and terracotta roofs */
  const vx = (VX + .26) * K, vz = VZ * K, vy = VH * K, villa = new THREE.Group(); villa.position.set(vx, vy, vz); villa.rotation.y = -Math.PI / 4 + .1; island.add(villa);
  const wallM = new THREE.MeshStandardMaterial({ map: T.plaster, roughness: .85 }); MATS.push(wallM);
  wallM.onBeforeCompile = sh => { sh.vertexShader = 'varying vec3 vLP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec4 q = vec4(transformed, 1.);\n#ifdef USE_INSTANCING\n q = instanceMatrix * q;\n#endif\n vLP = q.xyz; }');
    sh.fragmentShader = 'varying vec3 vLP;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= vec3(1.35, 1.24, 1.06); float y = vLP.y; if (y < .1) diffuseColor.rgb = vec3(.42, .07, .04) * (.85 + .3 * fract(sin(dot(floor(vLP.xz * 40.), vec2(12.9, 78.2))) * 437.5)); else if (y < .115) diffuseColor.rgb = vec3(.75, .52, .18);'); };
  const roofM = new THREE.MeshStandardMaterial({ map: T.roof, normalMap: T.roofN, roughness: .78 }); MATS.push(roofM);
  const colM = new THREE.MeshStandardMaterial({ map: T.lime, color: '#f4f0e6', roughness: .55 }); MATS.push(colM);
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); b.castShadow = b.receiveShadow = true; villa.add(b); return b; };
  const gable = (w, h, d, x, y, z) => { const s = new THREE.Shape(); s.moveTo(-w / 2 - .02, 0); s.lineTo(w / 2 + .02, 0); s.lineTo(0, h); s.lineTo(-w / 2 - .02, 0); const g = new THREE.ExtrudeGeometry(s, { depth: d + .04, bevelEnabled: false }); g.translate(0, 0, -d / 2 - .02); const m = new THREE.Mesh(g, roofM); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; villa.add(m); return m; };
  box(1.9, .05, 1.3, 0, 0, 0, colM);
  [[-.75, 0, .3, 1.1], [.75, 0, .3, 1.1]].forEach(([x, z, w, d]) => { box(w, .28, d, x, .05, z, wallM); const g = gable(d, .14, w, x, .33, z); g.rotation.y = Math.PI / 2; });
  box(1.2, .3, .28, 0, .05, -.5, wallM); gable(1.2, .15, .28, 0, .35, -.5);
  for (let k = 0; k <= 8; k++) [-.3, .3].forEach(z => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.018, .022, .24, 10), colM); c.position.set(-.48 + k * .12, .17, z + .04); c.castShadow = true; villa.add(c); });
  box(1.04, .03, .08, 0, .29, .34, colM); box(1.04, .03, .08, 0, .29, -.26, colM);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(.4, .16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a8aa0', roughness: .05, metalness: .2 })); pool.position.set(0, .056, .04); villa.add(pool); MATS.push(pool.material);
  for (let k = 0; k < 7; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.02, .024, .26, 10), colM); c.position.set(-.45 + k * .15, .18, .58); c.castShadow = true; villa.add(c); }
  { const lm = ctx.glowMat(new THREE.MeshStandardMaterial({ color: '#3a2a18', emissive: '#ffb060', emissiveIntensity: 3 }), 6); for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.014, 8, 6), lm); l.position.set(-.375 + k * .15, .22, .5); villa.add(l); }
    [[-.75, .56], [.75, .56], [0, -.64]].forEach(([x, z]) => { for (let k = 0; k < 3; k++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(.04, .07), lm); w.position.set(x + (k - 1) * .09, .16, z); villa.add(w); } }); }
  box(1.0, .03, .18, 0, .31, .54, colM); { const pg = gable(1.0, .08, .18, 0, .34, .54); }

  /* trees: umbrella pines, cypress avenues, Somma forest, vines, garden shrubs */
  const LEAVES = [[.01, .52, .15, .46], [.17, .52, .15, .46], [.34, .52, .15, .46], [.51, .52, .15, .46], [.68, .52, .15, .46], [.01, .02, .15, .46], [.17, .02, .15, .46], [.34, .02, .15, .46]], FIR = [[.36, .04, .62, .92]];
  const leafMat = new THREE.MeshStandardMaterial({ map: T.leaf, alphaMap: T.leafA, alphaTest: .45, normalMap: T.leafN, side: THREE.DoubleSide, roughness: .62 }); MATS.push(leafMat);
  const needleMat = new THREE.MeshStandardMaterial({ map: T.fir, alphaMap: T.firA, alphaTest: .45, normalMap: T.firN, side: THREE.DoubleSide, roughness: .8 }); MATS.push(needleMat);
  [leafMat, needleMat].forEach(m => { m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U); sh.vertexShader = 'uniform float uTime, uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n{ float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3; transformed.x += sin(uTime * 1.2 + ph + position.y * 2.) * .02 * (.3 + uWind * .7) * position.y; }\n#endif'); }; });
  const barkM = new THREE.MeshStandardMaterial({ map: T.bark, normalMap: T.barkN, roughness: .9 }); MATS.push(barkM);
  const land = (x, z, m = .12) => { const h = hAt(x, z); const [cx, cz] = cl(x, z); return h > SEA + .2 && !inVilla(cx, cz, m); };
  const place = (geo, mat, pts, cols, scl) => { const im = new THREE.InstancedMesh(geo, mat, pts.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    pts.forEach(([x, y, z, s], i) => { q.setFromEuler(new THREE.Euler(rnd(-.1, .1), rnd(TAU), rnd(-.1, .1))); m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s * scl[0], s * scl[1], s * scl[0])); im.setMatrixAt(i, m); im.setColorAt(i, c.set(pick(cols)).multiplyScalar(rnd(.85, 1.15))); });
    im.castShadow = im.receiveShadow = true; island.add(im); return im; };
  const sample = (n, test, grove = .1) => { n = Math.round(n * QN); const out = []; for (let t = 0; t < n * 60 && out.length < n; t++) { const x = rnd(-H5 + .2, H5 - .2), z = rnd(-H5 + .2, H5 - .2); if (grove && N.fbm(x * .45 + 11, z * .45) < grove - .25 + R() * .3) continue; const r = test(x, z, hAt(x, z)); if (r) out.push(r); } return out; };
  const rC = (x, z) => { const [a, b] = cl(x, z); return Math.hypot(a - VC[0], b - VC[1]); }, bC = (x, z) => { const [a, b] = cl(x, z); return Math.cos(Math.atan2(b - VC[1], a - VC[0]) - BACKA); };
  // umbrella pines: a tall bare trunk and a flat parasol of needles
  { const pines = sample(26, (x, z, h) => land(x, z) && h < 1.8 && rC(x, z) > 2 && normAt(x, z).y > .8 ? [x, h, z, rnd(.8, 1.2)] : null), trunks = [];
    pines.forEach(([x, h, z, s]) => { const lean = new THREE.Vector3(rnd(-.15, .15), 0, rnd(-.15, .15)), pts = []; for (let k = 0; k <= 6; k++) { const f = k / 6; pts.push(new THREE.Vector3(x + lean.x * f * f, h + f * .95 * s, z + lean.z * f * f)); } trunks.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, .022 * s, 6, false)); });
    if (trunks.length) { const tm = new THREE.Mesh(mergeGeometries(trunks), barkM); tm.castShadow = true; island.add(tm); }
    place(crownGeometry(FIR, 130, [.6, .5], [.26, .3], .35), needleMat, pines.map(([x, h, z, s]) => [x, h + .95 * s, z, .5 * s]), ['#3a5a2a', '#466a30', '#33522a'], [1, .38]); }
  // cypress avenues up toward the cone, and scattered cypress
  { const cyp = []; for (let k = 0; k < 10; k++) [-1, 1].forEach(sd => { const f = .12 + k * .08, x = lerp(VX - 1.0, VC[0], f) * K + sd * .26, z = lerp(VZ - .95, VC[1], f) * K - sd * .26; if (land(x, z) && hAt(x, z) < 2) cyp.push([x, hAt(x, z), z, rnd(.85, 1.1)]); });
    place(crownGeometry(LEAVES, 90, [.075, .7], [.16, .34], 1), leafMat, cyp.map(([x, h, z, s]) => [x, h + .3 * s, z, .14 * s]), ['#22381f', '#2b4426', '#1f3420'], [1, 3.4]); }
  // Somma's forest, orchards and garden shrubs, vine rows
  place(crownGeometry(LEAVES), leafMat, sample(1300, (x, z, h) => land(x, z) && bC(x, z) > .3 && h > 1.3 && h < 3.6 && normAt(x, z).y > .55 ? [x, h, z, rnd(.18, .3)] : null), ['#2f4a24', '#3a5428', '#2a4020', '#456a30'], [1, .9]);
  place(crownGeometry(LEAVES), leafMat, sample(260, (x, z, h) => land(x, z) && bC(x, z) < .4 && h < 2 && normAt(x, z).y > .8 ? [x, h, z, rnd(.14, .22)] : null), ['#6f7a4a', '#7d8a5a', '#5f6a40'], [1, .85]);
  { const vines = []; for (let k = 0; k < 10; k++) { const R0 = (1.98 + k / 9) * K; for (let a = -Math.PI; a < Math.PI; a += (LO ? .14 : .09) / R0) { const x = VC[0] * K + Math.cos(a) * R0, z = VC[1] * K + Math.sin(a) * R0; if (Math.abs(x) > 4.8 || Math.abs(z) > 4.8) continue; const h = hAt(x, z); if (!land(x, z) || h < .4 * K || h > 1.1 * K || normAt(x, z).y < .8) continue; vines.push([x, h, z, rnd(.07, .09)]); } }
    place(crownGeometry(LEAVES, 40), leafMat, vines, ['#4a6a24', '#557a2a', '#3e5e20'], [1, .8]); }

  /* a Roman pharos on the islet, a hill farm on the far slopes */
  { const stone = new THREE.MeshStandardMaterial({ map: T.lime, color: '#d8ccb4', roughness: .8 }); MATS.push(stone); const [sx, sz] = [STK[0][0] * K, STK[0][1] * K], g = new THREE.Group();
    [[.34, .3], [.26, .36], [.18, .3]].reduce((y, [w, h]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), stone); b.position.y = y + h / 2; b.castShadow = b.receiveShadow = true; g.add(b); return y + h; }, 0);
    const lan = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .12, 10), stone); lan.position.y = 1.02; g.add(lan); const fireM = ctx.glowMat(new THREE.MeshStandardMaterial({ color: '#2a1a10', emissive: '#ff9a40', emissiveIntensity: 4 }), 7), fire = new THREE.Mesh(new THREE.SphereGeometry(.04, 10, 8), fireM); fire.position.y = 1.1; g.add(fire);
    g.position.set(sx, hAt(sx, sz), sz); island.add(g); }
  { const stone = new THREE.MeshStandardMaterial({ map: T.plaster, color: '#e8dcc4', roughness: .85 }); MATS.push(stone); const [fx, fz] = [FARM[0] * K, FARM[1] * K];
    [[0, 0, .3, .16, .2, 0], [.26, .12, .18, .12, .16, .5], [-.2, .2, .14, .1, .14, .2]].forEach(([dx, dz, w, h, d, ry]) => { const x = fx + dx, z = fz + dz, y = hAt(x, z); const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone); b.position.set(x, y + h / 2, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; island.add(b);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * .55, h * .5, 4), roofM); rf.rotation.y = Math.PI / 4 + ry; rf.position.set(x, y + h + h * .25, z); rf.castShadow = true; island.add(rf); }); }
  /* galleys in the bay */
  const galleys = [0, 1].map(k => { const g = new THREE.Group(), hullG = new THREE.LatheGeometry([[0, -.2], [.022, -.19], [.036, -.15], [.044, -.07], [.045, .05], [.04, .12], [.025, .175], [.004, .2]].map(([r, y]) => new THREE.Vector2(r, y)), 16); hullG.rotateZ(-Math.PI / 2); hullG.scale(1, .6, 1);
    const hm = new THREE.MeshStandardMaterial({ map: T.wood, color: '#8a6040', roughness: .75 }); MATS.push(hm); g.add(new THREE.Mesh(hullG, hm));
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(.17, .14, 4, 4), new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: .9, side: THREE.DoubleSide })); sail.rotation.y = Math.PI / 2; sail.position.y = .14; g.add(sail); MATS.push(sail.material);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.003, .004, .24, 5), hm); mast.position.y = .1; g.add(mast);
    for (let i = 0; i < 9; i++) [-1, 1].forEach(sd => { const o = new THREE.Mesh(new THREE.CylinderGeometry(.002, .002, .12, 4), hm); o.position.set(-.12 + i * .03, .0, sd * .06); o.rotation.x = sd * 1.2; g.add(o); });
    g.scale.setScalar(2.2); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); island.add(g); ctx.life(g, 1); return { g, a: rnd(TAU), r: 1 + k * .6, sp: rnd(.025, .04) * (k ? -1 : 1) }; });

  /* in the deep: a drowned Roman villa's colonnade and a colossal marble head, an amphora wreck */
  { const marble = new THREE.MeshStandardMaterial({ map: T.lime, color: '#d8d4c8', roughness: .7 }); MATS.push(marble); const g = new THREE.Group();
    for (let k = 0; k < 7; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, k % 3 === 1 ? .5 : 1.1, 12), marble); if (k % 3 === 1) { c.rotation.z = Math.PI / 2 - .2; c.position.set(k * .38 - 1.1, .08, rnd(-.2, .2)); } else c.position.set(k * .38 - 1.1, .55, 0); g.add(c); }
    const arch = new THREE.Mesh(new THREE.BoxGeometry(1.5, .12, .2), marble); arch.position.set(-.5, 1.15, 0); arch.rotation.z = .08; g.add(arch);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.42, 24, 18), marble); head.scale.set(.85, 1.1, .9); head.position.set(.9, .25, .55); head.rotation.set(.4, .6, 1.2); g.add(head);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(.1, .18, .14), marble); nose.position.set(1.15, .4, .8); g.add(nose);
    g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); const x = 4.0, z = 4.0; g.scale.setScalar(.7); g.position.set(x, hAt(x, z), z); g.rotation.y = -Math.PI / 4; island.add(g); }
  { const clay = new THREE.MeshStandardMaterial({ color: '#9a5a38', roughness: .85 }); MATS.push(clay); const amph = new THREE.LatheGeometry([[0, 0], [.02, .01], [.045, .08], [.05, .16], [.035, .26], [.015, .3], [.016, .34], [0, .35]].map(([r, y]) => new THREE.Vector2(r, y)), 10);
    const n = 70, im = new THREE.InstancedMesh(amph, clay, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), x0 = 4.25, z0 = 3.1;
    for (let i = 0; i < n; i++) { const x = x0 + rnd(-.45, .45), z = z0 + rnd(-.7, .7); q.setFromEuler(new THREE.Euler(rnd(TAU), rnd(TAU), rnd(TAU))); m.compose(new THREE.Vector3(x, hAt(x, z) + .05, z), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m); } im.castShadow = true; island.add(im);
    const ribs = new THREE.Group(); for (let k = 0; k < 9; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(.3, .02, 4, 10, Math.PI * .8), new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 1 })); r.rotation.set(0, Math.PI / 2, -Math.PI * .9); r.position.set(0, .05, -.8 + k * .2); ribs.add(r); } ribs.position.set(x0, hAt(x0, z0) - .05, z0); ribs.rotation.set(.2, .1, .4); island.add(ribs); }
  makeSnowfall(ctx, 1500, [-1, 4.9, -2.5, -.3, -1, 4.9], [.8, .88, .9], .3);

  /* the eruption, after the classic deck: a rumble and steam jets, then the blast. The pressure dome shatters the summit, a white
     shock dome and rings race out with a sonic crack, thousands of incandescent ejecta fly, an ash column punches up into an
     umbrella canopy that blots out the sun, bombs set fires, lava spills from the crater and pyroclastic flows pour into the bay. */
  const AU = makeAudio(); AU.onStart = A => { A.surf = A.loop('lowpass', 450, .7, .1); A.roar = A.loop('lowpass', 85, .8, 0); A.hiss = A.loop('bandpass', 900, .6, 0); };
  const CX = CRX, CZ = CRZ, CY0 = hAt(CX, CZ) + .1, BL = 1.1, CE = 17, CH = 6.4 * K;
  const NA = LO ? 7000 : 15000, ag = new THREE.BufferGeometry(), ap = new Float32Array(NA * 3), ac = new Float32Array(NA * 4), as = new Float32Array(NA);
  ag.setAttribute('position', new THREE.BufferAttribute(ap, 3).setUsage(THREE.DynamicDrawUsage)); ag.setAttribute('pc', new THREE.BufferAttribute(ac, 4).setUsage(THREE.DynamicDrawUsage)); ag.setAttribute('ps', new THREE.BufferAttribute(as, 1).setUsage(THREE.DynamicDrawUsage)); ag.setDrawRange(0, 0);
  const amat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPx: { value: 1 }, uLit: { value: 1 } }, vertexShader: 'attribute vec4 pc; attribute float ps; uniform float uPx; varying vec4 vC; varying float vS; void main(){ vC = pc; vS = fract(position.x * 7.13 + position.z * 3.71 + ps * 11.3); vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * ps / -mv.z, 2., 520.); }',
    fragmentShader: 'uniform float uLit; varying vec4 vC; varying float vS; float h2(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); } float vn2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y); }\nvoid main(){ vec2 d = gl_PointCoord - .5; float r2 = dot(d, d) * 4.; if (r2 > 1.) discard; vec2 q = gl_PointCoord * 3. + vS * 17.; float nz = vn2(q) * .6 + vn2(q * 2.3) * .4; float a = exp(-r2 * 3.2) * smoothstep(.15, .75, nz + .35 - r2 * .3); float sh = .62 + .7 * (.5 - gl_PointCoord.y) + nz * .2; gl_FragColor = vec4(vC.rgb * sh * uLit, a * vC.a); }' });
  const ash = new THREE.Points(ag, amat); ash.frustumCulled = false; ash.renderOrder = 4; island.add(ash);
  const NG2 = LO ? 9000 : 20000, gg = new THREE.BufferGeometry(), gp = new Float32Array(NG2 * 3), gc = new Float32Array(NG2 * 4), gs = new Float32Array(NG2);
  gg.setAttribute('position', new THREE.BufferAttribute(gp, 3).setUsage(THREE.DynamicDrawUsage)); gg.setAttribute('pc', new THREE.BufferAttribute(gc, 4).setUsage(THREE.DynamicDrawUsage)); gg.setAttribute('ps', new THREE.BufferAttribute(gs, 1).setUsage(THREE.DynamicDrawUsage)); gg.setDrawRange(0, 0);
  const gmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: amat.uniforms, vertexShader: amat.vertexShader, fragmentShader: 'varying vec4 vC; void main(){ vec2 d = gl_PointCoord - .5; float r2 = dot(d, d) * 4.; if (r2 > 1.) discard; float a = exp(-r2 * 6.) + .2 * exp(-r2 * 1.8); gl_FragColor = vec4(vC.rgb * a * vC.a, 1.); }' });
  const glow = new THREE.Points(gg, gmat); glow.frustumCulled = false; glow.renderOrder = 6; island.add(glow);
  const AP = [], GP = [];
  const puff = (x, y, z, vx, vy, vz, life, size, c, grow = 1.6, g = 0, c2 = null) => { if (AP.length < NA) AP.push({ x, y, z, vx, vy, vz, age: 0, life, size, c, c2, grow, g }); };
  const spark = (x, y, z, vx, vy, vz, life, size, c, g = -3.5, trail = 0, c2 = null) => { if (GP.length < NG2) GP.push({ x, y, z, vx, vy, vz, age: 0, life, size, c, c2, g, trail }); };
  const nOf = (rate, dt) => Math.floor(rate * QN * dt + R());
  const glowL = new THREE.PointLight('#ff6a20', 0, 30, 1.3); glowL.position.set(CX, CY0 + .6, CZ); island.add(glowL);
  const bolt = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color(5, 5.5, 8), transparent: true })); bolt.visible = false; island.add(bolt);
  // the shock: a condensation dome with a bright rim, and rings racing over the land and the water
  const shockM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float r = 1. - abs(dot(vN, vV)); gl_FragColor = vec4(vec3(1., .97, .93) * 1.6, uA * (.08 + .92 * pow(r, 3.))); }' });
  const shock = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 24, 0, TAU, 0, Math.PI / 2), shockM); shock.visible = false; shock.renderOrder = 7; island.add(shock);
  const ringMk = y => { const m = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 128).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.55, 1.5), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); m.position.set(CX, y, CZ); m.visible = false; m.renderOrder = 7; island.add(m); return m; };
  const rings = [ringMk(CY0 - .2), ringMk(SEA + .02), ringMk(CY0 - .6)];
  let ev = null; const api = { ev: () => { AU.get(); ev = { t: 0, f: {}, bombs: 0, t0: ctx.controls.target.clone(), d0: ctx.camera.position.distanceTo(ctx.controls.target) }; }, get evOn() { return !!ev; } };
  const flowPath = []; for (let k = 0; k < 7; k++) flowPath.push(rnd(-1, 1) + Math.atan2(vz - CZ, vx - CX));
  const camT = new THREE.Vector3(), camD = new THREE.Vector3();

  ctx.steps.push(dt => {
    const t = ctx.clock; amat.uniforms.uPx.value = ctx.renderer.domElement.height / (2 * Math.tan(ctx.camera.fov * Math.PI / 360)); amat.uniforms.uLit.value = .45 + .75 * ctx.U.uSun.value; const CY = CY0 - LU.uBlow.value * BD;
    galleys.forEach(gl => { gl.a += gl.sp * dt; const x = 2.4 + Math.cos(gl.a) * gl.r, z = 2.4 + Math.sin(gl.a) * gl.r * .7; gl.g.position.set(x, SEA + .01, z); gl.g.rotation.set(Math.sin(t * 1.1 + gl.r) * .03, -gl.a - Math.sign(gl.sp) * Math.PI / 2, 0); });
    if (!ev && R() < dt * 4) puff(CX + rnd(-.12, .12), CY + .1, CZ + rnd(-.12, .12), rnd(-.03, .03) + .04, rnd(.25, .4), rnd(-.03, .03), rnd(6, 9), rnd(.3, .5), [.88, .88, .88, .28], 1.6);
    if (ev) { ev.t += dt; const e = ev.t, f = ev.f;
      if (!f.go) { f.go = 1; AU.burst(2.6, 160, .55); AU.tone(38, 30, 2.4, .3); ctx.shake(.25); }
      // the rumble: steam jets from the summit and the flanks, the ground trembling harder
      if (e < BL) { ctx.shake(.12 + e * .5); for (let i = 0; i < nOf(160, dt); i++) puff(CX + rnd(-.22, .22), CY, CZ + rnd(-.22, .22), rnd(-.15, .15), rnd(1.6, 3.4), rnd(-.15, .15), rnd(1.5, 2.5), rnd(.15, .3), [.95, .95, .93, .7], 2.5);
        PARA.forEach(([px, pz]) => { if (R() < dt * 12) { const x = px * K, z = pz * K; puff(x, hAt(x, z) + .05, z, 0, rnd(.6, 1.2), 0, rnd(1.5, 2.5), .14, [.92, .92, .9, .55], 2); } }); }
      // the blast
      if (e >= BL && !f.blast) { f.blast = 1; f.bt = 0; ctx.setLook('erupt'); ctx.flash(.95); ctx.skyU.uFlash.value = 1.2; ctx.shake(3.2); glowL.intensity = 900;
        AU.burst(.09, 7000, .9, 'highpass'); AU.burst(.35, 2600, .7, 'bandpass'); AU.burst(3.2, 240, .95); AU.tone(58, 26, 2.8, .6); AU.burst(2.4, 180, .8, 'lowpass', .32); AU.tone(44, 24, 2.2, .45, .32); AU.burst(11, 170, .55); AU.burst(9, 420, .22, 'bandpass', .5);
        shock.visible = true; shock.position.set(CX, CY - .3, CZ); rings.forEach((r, i) => { r.visible = true; r.userData.t = -i * .18; });
        for (let i = 0; i < 3200 * QN; i++) { const a = rnd(TAU), el = rnd(.15, 1.45), v = rnd(1.4, 6.5) * K; spark(CX, CY + .15, CZ, Math.cos(a) * Math.cos(el) * v, Math.sin(el) * v, Math.sin(a) * Math.cos(el) * v, rnd(1.2, 2.8), rnd(.05, .11), [6, 3.6, 1.6, 1], -5 * K, 0, [3, .5, .08]); }
        for (let i = 0; i < 700 * QN; i++) { const a = rnd(TAU), el = rnd(.3, 1.4), v = rnd(1, 4.5) * K; puff(CX, CY + .15, CZ, Math.cos(a) * Math.cos(el) * v, Math.sin(el) * v, Math.sin(a) * Math.cos(el) * v, rnd(1.5, 3), rnd(.08, .14), [.14, .11, .1, 1], .6, -6 * K); }
        for (let i = 0; i < 260 * QN; i++) { const a = rnd(TAU), v = rnd(2, 5) * K; puff(CX + Math.cos(a) * .3, CY, CZ + Math.sin(a) * .3, Math.cos(a) * v, rnd(.1, .8), Math.sin(a) * v, rnd(1.2, 2.2), rnd(.4, .7), [.9, .88, .85, .55], 2.2); } }
      if (f.blast) { f.bt += dt; LU.uBlow.value = Math.max(LU.uBlow.value, sm(f.bt / .25));
        if (shock.visible) { const st = f.bt; shock.scale.setScalar(.3 + st * 15); shockM.uniforms.uA.value = Math.max(0, .75 - st * .68); if (st > 1.1) shock.visible = false; }
        rings.forEach((r, i) => { if (!r.visible) return; r.userData.t += dt; const rt = r.userData.t; if (rt < 0) return; r.scale.setScalar(.1 + rt * (i === 1 ? 5.5 : 9) * K); r.material.opacity = Math.max(0, .85 - rt * .55); if (rt > 1.8) r.visible = false; }); }
      const colK = e < BL ? 0 : e < CE ? Math.min(1, (e - BL) / .4) : Math.max(0, 1 - (e - CE) / 3), canK = e < BL + .9 ? 0 : e < CE + 1 ? Math.min(1, (e - BL - .9) / 1.2) : Math.max(0, 1 - (e - CE - 1) / 4), fade = 1 - sm((e - 30) / 6);
      glowL.intensity = Math.max(glowL.intensity * Math.exp(-dt * 3), (70 + 40 * Math.sin(t * 9)) * Math.max(colK, LU.uLava.value * .6));
      LU.uLava.value = clamp((e - 2.5) / 12, 0, 1) * fade;
      { const vk = f.blast ? sm(f.bt / 1.5) * fade : 0; LU.uVein.value = lerp(.22, 1.9, vk); LU.uVeinW.value = lerp(1, 2.3, vk);
        for (let i = 0; i < nOf(160 * vk, dt); i++) { const sd = Math.floor(R() * 4), a = rnd(-4.9, 4.9), x = sd === 0 ? 5.005 : sd === 1 ? -5.005 : a, z = sd === 2 ? 5.005 : sd === 3 ? -5.005 : a, nx = sd === 0 ? 1 : sd === 1 ? -1 : 0, nz = sd === 2 ? 1 : sd === 3 ? -1 : 0, top = hAt(clamp(x, -4.99, 4.99), clamp(z, -4.99, 4.99));
          if (top < SEA + .05 && R() < .7) continue; const prox = Math.exp(-Math.hypot(x - CX, z - CZ) * .25); if (R() > .25 + prox) continue;
          spark(x + nx * .02, rnd(-2.5, top - .1), z + nz * .02, nx * rnd(.02, .12), rnd(-.1, .05), nz * rnd(.02, .12), rnd(2, 4), rnd(.05, .09), [5, 1.4, .25, 1], -.5, 0, [1.2, .15, .02]); } }
      if (AU.ctx) { const at = AU.ctx.currentTime; AU.roar && AU.roar.gain.setTargetAtTime(.45 * Math.max(colK, canK * .5), at, .3); AU.hiss && AU.hiss.gain.setTargetAtTime(.06 * colK, at, .3); }
      // the column: a dense dark jet punching straight up, glowing at its root, with a fountain of incandescent fragments
      if (colK > 0) { ctx.shake(.35 * colK);
        for (let i = 0; i < nOf(1700 * colK, dt); i++) { const a = rnd(TAU), r0 = rnd(0, .26) * K, sp = rnd(.1, .75) * K; puff(CX + Math.cos(a) * r0, CY + rnd(0, .4), CZ + Math.sin(a) * r0, Math.cos(a) * sp, rnd(4.8, 7.4) * K, Math.sin(a) * sp, rnd(2.6, 3.8), .6, [.12, .1, .09, .9], 3.2, 0, [.34, .31, .28]); }
        for (let i = 0; i < nOf(420 * colK, dt); i++) spark(CX + rnd(-.3, .3), CY + Math.pow(R(), 2) * 4, CZ + rnd(-.3, .3), 0, rnd(2, 4), 0, rnd(.4, .7), .4, [1.6, .6, .15, .5], 0);
        for (let i = 0; i < nOf(1500 * colK, dt); i++) spark(CX + rnd(-.14, .14), CY, CZ + rnd(-.14, .14), rnd(-.9, .9) * K, rnd(2.6, 6.6) * K, rnd(-.9, .9) * K, rnd(1.2, 2.2), rnd(.05, .09), [6, 3.4, 1.4, 1], -6 * K, 0, [3, .4, .05]);
        if (R() < dt * 6) AU.burst(.03, 4200, .06, 'highpass', rnd(0, .3)); if (R() < dt * 1.5) AU.burst(.45, 260, .25);
        ev.bombs -= dt; while (ev.bombs <= 0 && colK > .3) { ev.bombs += rnd(.05, .14); const a = rnd(TAU), sp = rnd(.5, 2.7) * K; spark(CX, CY + .2, CZ, Math.cos(a) * sp, rnd(4, 7.2) * K, Math.sin(a) * sp, rnd(2.6, 4), .17, [6, 2.2, .45, 1], -6 * K, 1); } }
      // the umbrella: ash spreading out at the top of the column and drifting with the wind, blotting out the sun
      if (canK > 0) for (let i = 0; i < nOf(480 * canK, dt); i++) { const a = rnd(TAU), sp = rnd(.3, 1.1) * K, w = .25 * K * (.5 + ctx.U.uWind.value * .5); puff(CX + rnd(-.8, .8), CY + CH + rnd(-.8, 1.1), CZ + rnd(-.8, .8), Math.cos(a) * sp + w, rnd(-.15, .4), Math.sin(a) * sp - w * .3, rnd(6, 9), 1.3, [.26, .23, .21, .85], 1.7, 0, [.36, .33, .3]); }
      ctx.U.uCloud.value = Math.max(ctx.U.uCloud.value, .95 * canK);
      if (e > 6 && e < 26 && R() < dt * 1.1) { const y0 = CY + rnd(5, 10), pts = []; let px = CX + rnd(-1.4, 1.4), py = y0, pz = CZ + rnd(-1.4, 1.4); for (let q = 0; q < 16; q++) { pts.push(new THREE.Vector3(px, py, pz)); px += rnd(-.4, .4); py -= rnd(.25, .55); pz += rnd(-.4, .4); } bolt.geometry.dispose(); bolt.geometry = new THREE.BufferGeometry().setFromPoints(pts); bolt.visible = true; bolt.userData.t = .15; ctx.skyU.uFlash.value = .9; ctx.flash(.12, '#cfd8ff'); AU.burst(2.4, 200, .45, 'lowpass', rnd(.1, .4)); }
      // pyroclastic flows: glowing-rooted ash avalanches racing down the flanks toward the villa and out over the bay
      if (e > 12 && e < 30) { for (let i = 0; i < nOf(140 * fade, dt); i++) { const a = pick(flowPath) + rnd(-.15, .15), r = rnd(.2, Math.min(7.5, (e - 12) * .7)), x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r; if (Math.abs(x) > 4.9 || Math.abs(z) > 4.9) continue; const h = Math.max(hAt(x, z), SEA); puff(x, h + .1, z, Math.cos(a) * rnd(.4, .9), rnd(.05, .35), Math.sin(a) * rnd(.4, .9), rnd(4, 7), rnd(.4, .8), [.3, .27, .25, .85], 2.4); } if (!f.pf) { f.pf = 1; AU.burst(10, 160, .5); } }
      // the camera pulls back and up to take it all in, then settles again
      { const k = sm((e - .6) / 3.5) * (1 - sm((e - 31) / 5)); camT.copy(ev.t0).lerp(new THREE.Vector3(CX * .35, ev.t0.y + 3.6, CZ * .35), k); camD.copy(ctx.camera.position).sub(ctx.controls.target).setLength(ev.d0 * (1 + .38 * k)); ctx.controls.target.copy(camT); ctx.camera.position.copy(camT).add(camD); }
      if (e > 34 && !f.back) { f.back = 1; ctx.setLook(ctx.baseLook()); }
      if (e > 40) { ev = null; LU.uLava.value = 0; glowL.intensity = 0; LU.uVein.value = .22; LU.uVeinW.value = 1; } }
    if (bolt.visible) { bolt.userData.t -= dt; if (bolt.userData.t <= 0) bolt.visible = false; }
    // ash: rise, stall and spread into the umbrella at the canopy height, drift with the wind; lit orange near the vent
    let n = 0; const CYn = CY0 - LU.uBlow.value * BD;
    for (let i = AP.length - 1; i >= 0; i--) { const p = AP[i]; p.age += dt; if (p.age > p.life) { AP[i] = AP[AP.length - 1]; AP.pop(); continue; } const hgt = p.y - CYn;
      if (p.g) { p.vy += p.g * dt; if (p.y < hAt(p.x, p.z)) { p.vy = 0; p.vx *= .5; p.vz *= .5; p.g = 0; } }
      else if (hgt > CH) { p.vy *= Math.exp(-dt * 2.5); p.vx += (p.x - CX) * .12 * dt + .05 * dt; p.vz += (p.z - CZ) * .12 * dt; } else { p.vy *= Math.exp(-dt * .12); }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
    for (const p of AP) { const k = p.age / p.life, hot = Math.exp(-Math.hypot(p.x - CX, p.y - CYn, p.z - CZ) * .55) * 3 * (ev ? 1 : 0), c = p.c, c2 = p.c2 || c; ap[n * 3] = p.x; ap[n * 3 + 1] = p.y; ap[n * 3 + 2] = p.z;
      ac[n * 4] = lerp(c[0], c2[0], k) + hot * .9; ac[n * 4 + 1] = lerp(c[1], c2[1], k) + hot * .35; ac[n * 4 + 2] = lerp(c[2], c2[2], k) + hot * .08; ac[n * 4 + 3] = c[3] * Math.min(1, p.age * 3) * (1 - k * k) * clamp((8.5 - Math.max(Math.abs(p.x), Math.abs(p.z))) / 2.5, 0, 1); as[n] = p.size * (1 + k * p.grow); n++; }
    ag.setDrawRange(0, n); ag.attributes.position.needsUpdate = ag.attributes.pc.needsUpdate = ag.attributes.ps.needsUpdate = true;
    let m = 0; for (let i = GP.length - 1; i >= 0; i--) { const p = GP[i]; p.age += dt; if (p.age > p.life || (p.y < hAt(p.x, p.z) && p.age > .3)) { if (p.trail) { for (let q = 0; q < 16; q++) spark(p.x, Math.max(p.y, hAt(p.x, p.z)) + .02, p.z, rnd(-.6, .6), rnd(.3, 1.4), rnd(-.6, .6), rnd(.4, .9), .05, [5, 1.5, .3, 1]); for (let q = 0; q < 6; q++) puff(p.x, Math.max(p.y, hAt(p.x, p.z)) + .05, p.z, rnd(-.1, .1), rnd(.2, .5), rnd(-.1, .1), rnd(3, 6), .2, [.25, .22, .2, .7], 2.5); } GP[i] = GP[GP.length - 1]; GP.pop(); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.trail && R() < .8) { GP.push({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, age: 0, life: .7, size: .07, c: [3, 1, .2, 1], g: 0, trail: 0 }); if (R() < .3) puff(p.x, p.y, p.z, 0, .05, 0, rnd(1.5, 2.5), .08, [.24, .21, .19, .7], 3); } }
    for (const p of GP) { const k = p.age / p.life, f = 1 - k, c = p.c, c2 = p.c2; gp[m * 3] = p.x; gp[m * 3 + 1] = p.y; gp[m * 3 + 2] = p.z;
      if (c2) { gc[m * 4] = lerp(c[0], c2[0], k); gc[m * 4 + 1] = lerp(c[1], c2[1], k); gc[m * 4 + 2] = lerp(c[2], c2[2], k); } else { gc[m * 4] = c[0]; gc[m * 4 + 1] = c[1] * (1 - k * .6); gc[m * 4 + 2] = c[2] * (1 - k); } gc[m * 4 + 3] = f * f * c[3]; gs[m] = p.size; m++; }
    gg.setDrawRange(0, m); gg.attributes.position.needsUpdate = gg.attributes.pc.needsUpdate = gg.attributes.ps.needsUpdate = true;
  });
  { const done = new Set(); island.traverse(o => { if (!o.isMesh || !o.material || done.has(o.material) || o.material === water.mat || o.material === water.wallMat || o.material.isShaderMaterial || o === wl) return; done.add(o.material); underwater(o.material, SEA, 1.15); }); }
  ctx.api = api; return ctx;
}
