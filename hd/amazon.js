/* Amazon Canopy: the upper Amazon where it starts to climb into the Andes, at dusk in the monsoon. A closed canopy in every
   green (and the odd flowering ipê) rolls up to a foothill whose face the Inca cut into stone-walled terraces, with a stair
   climbing to a small cloud-forest citadel of trapezoid doors and gabled houses. On the left a waterfall drops out of a cleft
   in a sheer cliff into a plunge pool; you hear it before you find it through the trees. A tea-brown river winds out through
   the front of the slab. In a clearing it tore for itself lies a four-engined jetliner from the sixties, broken in three,
   its bold super-graphics livery (sunflower, tangerine, a magenta sweep, a sun on the fin) chalking, flaking to primer and
   giving way to rust and moss, vines pulling it into the forest. Things move under the canopy that you never see: the
   crowns shake as they pass, leaves fall, macaws burst out, howlers roar. Fireflies come out with GLOW, and the mist banks
   drift with the wind. EVENT: a cloudburst. Lightning splits an emergent tree, the canopy heaves in the gust, the falls
   swell into a brown flood and the river rises, the macaws flush and the howlers answer the thunder. */
import { THREE, mergeGeometries, TAU, R, rnd, pick, clamp, lerp, sm, Q, LO, QN, makeNoise, GLSL_NOISE, TRI, createEngine, makeHeightfield, SLAB, makeWalls, wallMaterial, makeWater, leafQuad, crownGeometry, makeAudio, underwater, palmGeometry, LEAF_RECTS, makeFalls } from './core.js';

export const META = { name: 'Amazon Canopy', line: 'A closed canopy climbing to Inca terraces, a waterfall you hear before you see, and a sixties jetliner rusting where it fell. Something moves under the trees. Press Cloudburst.',
  era: 'Upper Amazon, Andean foothills · dusk, monsoon', ev: 'Cloudburst', preset: { time: 2, clouds: 2, rain: 3, wind: 2, glow: 1, life: 2 }, birds: 'none' };

export function build() {
  const N = makeNoise(+(Q.get('seed') || 11)), S = 10, H5 = 5, DEPTH = SLAB, NORM = 1.6, WL = 0;
  const ctx = createEngine({ cam: { target: [-.35, 1.0, -.35], dist: 45, pol: 1.0, az: Math.PI / 4, min: 9, max: 70 }, sunRef: 3.0, bloom: [.2, .5, 1.35], sat: 1.05, stars: true,
    looks: { noon: { sky: 'noon', dir: [-.5, 1, .6], col: '#fff2e0', I: 3.2, env: .9, exp: 1.05 },
      gold: { sky: 'storm', dir: [-.42, .24, .88], col: '#ffa062', I: 5.2, env: .8, exp: 1.16, warm: .85 },
      night: { sky: 'night', dir: [-.3, .9, -.7], col: '#a0b4ff', I: .8, env: .3, exp: 1.32, skyI: .3 },
      burst: { sky: 'storm', dir: [-.3, .6, .75], col: '#c4c8d8', I: 2.6, env: .7, exp: 1.22, skyI: .7 } } });
  const { island, tex, U, MATS } = ctx; ctx.waterLevel = WL;
  Object.assign(ctx.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, far: 90 }); ctx.sun.shadow.camera.updateProjectionMatrix();
  const T = { rock: tex('rock_diff.jpg'), rockN: tex('rock_nor.jpg', false), lime: tex('lime_diff.jpg'), limeN: tex('lime_nor.jpg', false), grass: tex('mtn_diff.jpg'), grassN: tex('mtn_nor.jpg', false),
    forest: tex('forest_diff.jpg'), forestN: tex('forest_nor.jpg', false), sand: tex('sand_diff.jpg'), sandN: tex('sand_nor.jpg', false),
    leaf: tex('leaf_diff.jpg', true, false), leafA: tex('leaf_alpha.jpg', false, false), leafN: tex('leaf_nor.jpg', false, false), bark: tex('bark_diff.jpg'), barkN: tex('bark_nor.jpg', false) };

  /* ---------------- the land ----------------
     d runs toward the back corner, t across the view (right is positive). The foothill rises with d; the Inca terraces
     step its face in a band, a stair climbs their middle, the citadel sits on a flattened shoulder; on the left a sheer
     cliff with a notch carries the falls. The river leaves the plunge pool and winds out through the front-left wall. */
  const dOf = (x, z) => -(x + z) * .7071, tOf = (x, z) => (x - z) * .7071, XZ = (t, d) => [(t - d) * .7071, (-t - d) * .7071];
  const POOL = XZ(-2.35, 1.3), LIPd = 1.74, LIPt = -2.35, CIT = XZ(.25, 3.95), STt = .25;
  const RIV = [POOL, [-2.0, 1.75], [-.9, 2.45], [-1.5, 3.45], [-.9, 4.4], [-.7, 5.5]].map(p => new THREE.Vector2(p[0], p[1]));
  const segD = (pts, x, z) => { let d = 9; const p = new THREE.Vector2(x, z); for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], ab = b.clone().sub(a), t = clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); d = Math.min(d, p.distanceTo(a.clone().addScaledVector(ab, t))); } return d; };
  const riverD = (x, z) => segD(RIV, x, z);
  const CR = [new THREE.Vector2(4.6, .7), new THREE.Vector2(.7, 4.6)], crashD = (x, z) => Math.min(segD(CR, x, z), Math.max(0, dOf(x, z) + 4.55) * 1.4 + .3);
  const ddOf = (x, z) => { const d = dOf(x, z), t = tOf(x, z); return d + .22 * Math.cos(t * 1.15) + N.fbm(t * .5, 3) * .25; };
  const terrK = (x, z) => { const t = tOf(x, z), dd = ddOf(x, z); return sm((t + 1.3) / .25) * sm((2.0 - t) / .25) * sm((dd - 1.15) / .15) * sm((3.6 - dd) / .25) * (1 - sm((.14 - Math.abs(t - STt)) / .03)); };
  const cliffB = (x, z) => { const t = tOf(x, z); return sm((-1.45 - t) / .3) * sm((t + 3.7) / .4); };
  function ridgeH(x, z) { const t = tOf(x, z), dd = ddOf(x, z);
    let rh = 2.95 * sm((dd - 1.1) / 3.0) + N.ridge(x * .9, z * .9) * .35 * sm((dd - 1.4) / 1.5);
    let rc = sm((dd - LIPd) / .07) * (2.05 + .75 * sm((dd - 1.9) / 2.2)) + N.ridge(x * 2, z * 2) * .12 * sm((dd - 1.8) / .3);
    rc = lerp(rc, 1.62 * sm((dd - LIPd) / .07), sm((.26 - Math.abs(t - LIPt)) / .07) * sm((2.75 - dd) / .12)); // the notch the stream runs in
    rh = lerp(rh, rc, cliffB(x, z));
    const st = .21, q = rh / st, rq = (Math.floor(q) + sm((q - Math.floor(q) - .8) / .2)) * st; rh = lerp(rh, rq, terrK(x, z));
    rh = lerp(rh, 2.92, 1 - sm((Math.hypot(x - CIT[0], z - CIT[1]) - .85) / .45));
    return rh; }
  function height(u, v) { const x = u * H5, z = v * H5;
    let h = .34 + N.fbm(u * 2.2, v * 2.2) * .14 + N.fbm(u * 7, v * 7) * .04 + ridgeH(x, z);
    const cd = crashD(x, z); h = lerp(h, .3 + N.fbm(u * 5, v * 5) * .05, sm((.95 - cd) / .5) * .7); h -= .05 * sm((.13 - segD(CR, x, z)) / .1);
    const rd = riverD(x, z); h = lerp(h, -.5 + N.fbm(u * 4, v * 4) * .1, sm((.3 - rd) / .14)); h = Math.min(h, lerp(h, .1, sm((.5 - rd) / .14)));
    const pd = Math.hypot(x - POOL[0], z - POOL[1]); h = lerp(h, -.8, sm((.55 - pd) / .25));
    return h; }
  const hf = makeHeightfield(S, 300, height), { hAt, normAt } = hf;
  { const p = hf.geo.attributes.position, zn = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); zn[i * 2] = terrK(x, z); zn[i * 2 + 1] = sm((1.0 - crashD(x, z)) / .35); } hf.geo.setAttribute('zn', new THREE.BufferAttribute(zn, 2)); }

  /* Inca masonry: polygonal blocks, each its own tone, pillowed faces and deep joints, moss and rain darkening */
  const MASON = `vec3 mason(vec2 q){ vec2 i = floor(q), f = fract(q); float d1 = 8., d2 = 8.; vec2 id = vec2(0.);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)), o = vec2(hh(i + g), hh(i + g + 17.3)) * .85 + .075; float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) d2 = d; }
    return vec3(d2 - d1, hh(id + 3.1), d1); }\n`;
  const terrMat = new THREE.MeshStandardMaterial({ roughness: .95 }); MATS.push(terrMat);
  terrMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, { tRock: { value: T.rock }, tRockN: { value: T.rockN }, tLime: { value: T.lime }, tGrass: { value: T.grass }, tGrassN: { value: T.grassN }, tForest: { value: T.forest }, tForestN: { value: T.forestN }, tSand: { value: T.sand } });
    sh.vertexShader = 'attribute vec2 zn; varying vec2 vZn; varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvZn = zn; vWP = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform sampler2D tRock, tRockN, tLime, tGrass, tGrassN, tForest, tForestN, tSand; uniform float uTime, uSun, uCloud, uWet; varying vec2 vZn; varying vec3 vWP; varying vec3 vWN; float mRk, mGr, mMs;\n' + GLSL_NOISE + TRI + MASON + sh.fragmentShader
      .replace('#include <map_fragment>', `
  vec3 P = vWP, Nn = normalize(vWN), w = triW(Nn); float slope = 1. - Nn.y;
  vec3 litter = tri2(tForest, P, w, .45) * vec3(.62, .58, .45), grass = tri2(tGrass, P, w, .5) * vec3(.5, .78, .34), rock = tri2(tRock, P, w, .32) * vec3(.62, .6, .55), mud = tri2(tSand, P, w, .5) * vec3(.52, .4, .28);
  float mossN = smoothstep(.35, .75, fbm(P.xz * 1.6 + P.y * .8)); rock = mix(rock, rock * vec3(.45, .62, .32), mossN * .7); rock *= mix(1., .62, smoothstep(.4, .8, vn(vec2((P.x - P.z) * 9., P.y * .7))) * .6);
  mRk = smoothstep(.42, .7, slope); mGr = max(vZn.x * (1. - mRk), vZn.y * smoothstep(.3, .7, fbm(P.xz * 2.4)));
  vec3 col = mix(litter, grass, mGr); col = mix(col, rock, mRk);
  // the terrace risers: stone retaining walls
  if (vZn.x > .02 && mRk > .02) { vec3 m = mason((abs(Nn.x) > abs(Nn.z) ? P.zy : P.xy) * vec2(13., 16.)); vec3 st = tri2(tLime, P, w, .6) * vec3(.74, .7, .62) * (.72 + .45 * m.y) * (.9 + .25 * smoothstep(.0, .6, m.z));
    st = mix(st, st * vec3(.5, .66, .36), smoothstep(.45, .8, fbm(P.xz * 3. + P.y * 4.)) * .8); st *= mix(.3, 1., smoothstep(.02, .07, m.x)); col = mix(col, st, vZn.x * mRk); }
  col = mix(col, mud, smoothstep(.16, .04, P.y)); float dep = -P.y; if (dep > 0.) { col *= vec3(.58, .52, .4); col += vec3(.6, .55, .35) * caustic(P.xz * 1.4, uTime) * exp(-dep * 2.) * .25 * uSun; }
  col = mix(col, col * .62, uWet * .7); mMs = mRk; col *= cloudShade(P.xz, uTime, uCloud); diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(.95, .45, uWet * (.4 + .6 * mMs));')
      .replace('#include <normal_fragment_maps>', '{ vec3 nT = normalize(mix(mix(triN(tForestN, vWP, Nn, w, .45), triN(tGrassN, vWP, Nn, w, .5), mGr), triN(tRockN, vWP, Nn, w, .32), mRk)); normal = normalize((viewMatrix * vec4(nT, 0.)).xyz); }'); };
  const terr = new THREE.Mesh(hf.geo, terrMat); terr.castShadow = terr.receiveShadow = true; island.add(terr);
  const walls = makeWalls(hf, DEPTH, WL, NORM); const wl = new THREE.Mesh(walls.land, wallMaterial(ctx, T.rock, T.rockN, [.86, .56, .4])); wl.castShadow = wl.receiveShadow = true; island.add(wl);
  const water = makeWater(ctx, hf, { level: WL, att: '#6a6a34', attDist: .7, deep: '#2a2410', shallow: '#5e5a2c', glint: .8, norm: NORM, wallK: 5.2, wave: .01 });
  island.add(new THREE.Mesh(walls.water, water.wallMat));

  const add = (g, m, x, y, z, par = island, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; par.add(o); return o; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);

  /* ---------------- the citadel and the stair ---------------- */
  const incaM = new THREE.MeshStandardMaterial({ roughness: .9 }); MATS.push(incaM);
  incaM.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, { tLime: { value: T.lime }, tLimeN: { value: T.limeN } });
    sh.vertexShader = 'varying vec3 vIP; varying vec3 vIN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvIP = (modelMatrix * vec4(transformed, 1.)).xyz; vIN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform sampler2D tLime, tLimeN; uniform float uWet; varying vec3 vIP; varying vec3 vIN;\n' + GLSL_NOISE + TRI + MASON + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 P = vIP, Nc = normalize(vIN), w = triW(Nc); vec2 q = abs(Nc.y) > .6 ? P.xz : (abs(Nc.x) > abs(Nc.z) ? P.zy : P.xy); vec3 m = mason(q * vec2(16., 20.));
    vec3 st = tri2(tLime, P, w, .7) * vec3(.78, .74, .66) * (.72 + .45 * m.y) * (.88 + .26 * smoothstep(.0, .6, m.z)); st *= mix(.32, 1., smoothstep(.02, .07, m.x));
    st = mix(st, st * vec3(.48, .64, .34), smoothstep(.4, .78, fbm(P.xz * 4. + P.y * 3.)) * (.5 + .5 * smoothstep(.3, .9, Nc.y))); st = mix(st, st * .6, uWet * .6); diffuseColor.rgb *= st; }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(.9, .5, uWet);'); };
  const trapWall = (w, h, d, doors) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
    doors.forEach(([cx, bw, tw, dh, y0 = 0]) => { const p = new THREE.Path(); p.moveTo(cx - bw / 2, y0 + .001); p.lineTo(cx + bw / 2, y0 + .001); p.lineTo(cx + tw / 2, y0 + dh); p.lineTo(cx - tw / 2, y0 + dh); p.lineTo(cx - bw / 2, y0 + .001); s.holes.push(p); });
    return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2); };
  const gable = (w, h0, h1, d) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h0); s.lineTo(0, h1); s.lineTo(-w / 2, h0); s.lineTo(-w / 2, 0);
    const p = new THREE.Path(); p.moveTo(-.035, .02); p.lineTo(.035, .02); p.lineTo(.026, .11); p.lineTo(-.026, .11); s.holes.push(p); return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2); };
  const cit = new THREE.Group(); cit.position.set(CIT[0], hAt(CIT[0], CIT[1]) - .01, CIT[1]); cit.rotation.y = Math.PI / 4; island.add(cit);
  const house = (x, z, ry, w, d) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; cit.add(g); const H = .2, th = .045;
    add(trapWall(w, H, th, [[0, .075, .055, .15], [-w * .32, .04, .03, .06, .08], [w * .32, .04, .03, .06, .08]]), incaM, 0, 0, d / 2, g);
    add(trapWall(w, H, th, [[-w * .25, .04, .03, .06, .08], [w * .25, .04, .03, .06, .08]]), incaM, 0, 0, -d / 2, g);
    [-1, 1].forEach(sd => add(gable(d + th, H, H + .17, th), incaM, sd * w / 2, 0, 0, g, 0, Math.PI / 2)); };
  house(-.42, -.18, 0, .5, .3); house(.42, -.2, 0, .46, .3); house(-.5, .4, Math.PI / 2, .42, .28); house(.55, .38, Math.PI / 2, .4, .26);
  [[.62, .5], [.5, .38], [.38, .26]].forEach(([w, d], i) => add(box(w, .06, d), incaM, 0, i * .06, .05, cit)); add(box(.06, .1, .05), incaM, 0, .18, .05, cit); add(box(.04, .05, .1), incaM, .02, .24, .05, cit, 0, .4); // the ushnu and its carved stone
  add(trapWall(.62, .3, .09, [[0, .17, .12, .24]]), incaM, 0, 0, .74, cit); add(box(.66, .04, .1), incaM, 0, .3, .74, cit); // the gate at the head of the stair
  [[-.86, -.6, .08], [.86, -.6, .08], [-.86, .7, .08], [.86, .7, .08]].forEach(([x, z]) => add(box(.08, .14, .08), incaM, x, 0, z, cit));
  { const ring = trapWall(1.8, .12, .06, []); add(ring, incaM, 0, -.02, -.82, cit); [-1, 1].forEach(sd => add(trapWall(1.5, .12, .06, []), incaM, sd * .9, -.02, -.05, cit, 0, Math.PI / 2)); }
  { const parts = []; for (let k = 0; k < 56; k++) { const d = 1.18 + k * .043, [x, z] = XZ(STt, d), y = hAt(x, z); if (y > 3.0) break; const b = new THREE.BoxGeometry(.24, .08, .055).translate(0, -.03, 0); b.rotateY(Math.PI / 4); b.translate(x, y, z); parts.push(b); }
    const stair = new THREE.Mesh(mergeGeometries(parts), incaM); stair.castShadow = stair.receiveShadow = true; island.add(stair); }

  /* ---------------- the forest ---------------- */
  const LEAVES = LEAF_RECTS;
  const DU = { uDist: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 1)) }, uGust: { value: 0 } };
  const leafMat = new THREE.MeshStandardMaterial({ map: T.leaf, alphaMap: T.leafA, alphaTest: .45, normalMap: T.leafN, side: THREE.DoubleSide, roughness: .58 }); MATS.push(leafMat);
  leafMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, DU); sh.vertexShader = 'uniform float uTime, uWind, uGust; uniform vec4 uDist[4];\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
{ vec2 ip = instanceMatrix[3].xz; float ph = ip.x * 1.7 + ip.y * 2.3, sh = 0.; for (int i = 0; i < 4; i++) { vec4 d = uDist[i]; sh += d.z * (1. - smoothstep(0., d.w, distance(ip, d.xy))); } sh = min(sh, 1.6) + uGust * (.5 + .5 * sin(ip.x * .9 + ip.y * .7 - uTime * 2.6));
  float k = (.3 + uWind * .7); transformed.x += sin(uTime * 1.3 + ph + position.y * 2.) * .05 * k * position.y + sh * sin(uTime * 21. + ph * 3.) * .2;
  transformed.z += cos(uTime * 1.1 + ph) * .04 * k * position.y + sh * cos(uTime * 17. + ph * 5.) * .16; transformed.y += sh * sin(uTime * 13. + ph) * .08; }
#endif`); };
  leafMat.customProgramCacheKey = () => 'amazonLeaf';
  const barkM = new THREE.MeshStandardMaterial({ map: T.bark, normalMap: T.barkN, roughness: .92, color: '#9a8e7e' }); MATS.push(barkM);
  const GR = ['#3e5e2a', '#4f6e30', '#5f7a3a', '#2e4a26', '#6a8a3e', '#7a9440', '#8aa04a', '#3a5a3a', '#2a4a30', '#577a2a', '#9aa850', '#4a6a48', '#365a40', '#6e8a30', '#a0aa58', '#2c3e24'];
  const okGround = (x, z) => { const h = hAt(x, z); if (h < .1 || Math.abs(x) > 4.92 || Math.abs(z) > 4.92) return 0; if (riverD(x, z) < .4 || Math.hypot(x - POOL[0], z - POOL[1]) < .72) return 0;
    if (normAt(x, z).y < .5) return 0; if (Math.hypot(x - CIT[0], z - CIT[1]) < 1.0) return 0; if (Math.abs(tOf(x, z) - STt) < .2 && dOf(x, z) > 1.1 && dOf(x, z) < 3.6) return 0; return 1; };
  const crowns = [], trunks = [], step = LO ? .24 : .18;
  for (let gx = -H5; gx <= H5; gx += step) for (let gz = -H5; gz <= H5; gz += step) { const x = gx + rnd(-.4, .4) * step, z = gz + rnd(-.4, .4) * step; if (!okGround(x, z)) continue;
    const cd = crashD(x, z), h = hAt(x, z), tk = terrK(x, z), hill = sm((h - 1.0) / 1.2);
    if (cd < .95 && R() > (segD(CR, x, z) < .6 ? .08 : .45)) continue; if (tk > .5 && R() > .1) continue;
    const s = (cd < .95 || tk > .5 ? rnd(.07, .13) : rnd(.15, .26)) * (LO ? 1.15 : 1) * lerp(1, .8, hill), th = (cd < .95 || tk > .5 ? rnd(.08, .22) : rnd(.45, .8)) * lerp(1, .6, hill);
    const ci = R() < .018 ? (R() < .5 ? '#d0a830' : '#c86a9a') : pick(GR); crowns.push([x, h + th, z, s, ci, .62]); trunks.push([x, h - .02, z, th + s * .2, s * .07]); }
  // emergents: kapoks towering out of the canopy on buttressed trunks
  const EMG = []; for (let t = 0; t < 4000 && EMG.length < 14; t++) { const x = rnd(-4.6, 4.6), z = rnd(-4.6, 4.6); if (!okGround(x, z) || crashD(x, z) < 1.3 || hAt(x, z) > 1.2 || EMG.some(e => Math.hypot(e[0] - x, e[2] - z) < 1.1)) continue;
    const h = hAt(x, z), th = rnd(1.25, 1.6), s = rnd(.42, .58); EMG.push([x, h, z, th, s]); crowns.push([x, h + th, z, s, pick(GR.slice(0, 8)), .42]); trunks.push([x, h - .02, z, th + s * .1, .045]); }
  // overgrowth on the terraces and in the clearing
  const jungleCrown = (n, lumps = 3) => { const parts = []; for (let k = 0; k < lumps; k++) { const g = crownGeometry(LEAVES, n, [.075, .7], [.34, .62], .8), a = k / lumps * TAU + rnd(-.4, .4), r = k ? rnd(.38, .55) : 0, sc = k ? rnd(.6, .78) : 1;
      g.scale(sc, sc, sc); g.translate(Math.cos(a) * r, k ? rnd(-.2, .05) : 0, Math.sin(a) * r); parts.push(g); } return mergeGeometries(parts); };
  { const crownG = jungleCrown(LO ? 34 : 58);
    const im = new THREE.InstancedMesh(crownG, leafMat, crowns.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    crowns.forEach(([x, y, z, s, ci, fl], i) => { q.setFromEuler(new THREE.Euler(rnd(-.15, .15), rnd(TAU), rnd(-.15, .15))); m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * fl * rnd(.85, 1.15), s)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(ci).multiplyScalar(rnd(.8, 1.15))); });
    im.castShadow = im.receiveShadow = true; island.add(im);
    const tg = new THREE.CylinderGeometry(.6, 1, 1, 6).translate(0, .5, 0), tm = new THREE.InstancedMesh(tg, barkM, trunks.length + EMG.length * 4);
    trunks.forEach(([x, y, z, hh, r], i) => { m.compose(new THREE.Vector3(x, y, z), q.identity(), new THREE.Vector3(r, hh, r)); tm.setMatrixAt(i, m); });
    EMG.forEach(([x, h, z], k) => { for (let b = 0; b < 4; b++) { const a = b / 4 * TAU + rnd(-.3, .3); q.setFromEuler(new THREE.Euler(0, -a, 0)); m.compose(new THREE.Vector3(x + Math.cos(a) * .04, h - .02, z + Math.sin(a) * .04), q, new THREE.Vector3(.09, .3, .015)); tm.setMatrixAt(trunks.length + k * 4 + b, m); } });
    tm.castShadow = tm.receiveShadow = true; island.add(tm); }
  // palms along the river and the pool
  { const spots = []; for (let t = 0; t < 3000 && spots.length < 34 * QN + 8; t++) { const x = rnd(-4.8, 4.8), z = rnd(-4.8, 4.8), rd = Math.min(riverD(x, z), Math.hypot(x - POOL[0], z - POOL[1]) - .3); if (rd < .42 || rd > .8 || hAt(x, z) < .1 || normAt(x, z).y < .7) continue; spots.push([x, hAt(x, z) - .01, z, rnd(.5, .8)]); }
    const [tr, fr] = palmGeometry(spots, { fronds: 9 }); if (tr) { const a = new THREE.Mesh(tr, barkM), b = new THREE.Mesh(fr, leafMat); a.castShadow = b.castShadow = true; island.add(a, b); } }

  /* ---------------- the jetliner ----------------
     Built in one aircraft frame (nose toward +x) so the livery runs on across the breaks; each piece is placed on its own. */
  const R0 = .115, liv = new THREE.MeshStandardMaterial({ roughness: .5, metalness: .4, side: THREE.DoubleSide }); MATS.push(liv);
  liv.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vPL; varying vec3 vPW; varying vec3 vNW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPL = position; vPW = (modelMatrix * vec4(transformed, 1.)).xyz; vNW = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform float uWet, uTime; varying vec3 vPL; varying vec3 vPW; varying vec3 vNW; float rRust, mMetal;\n' + GLSL_NOISE + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 P = vPL; vec3 sunf = vec3(.92, .58, .05), tang = vec3(.95, .26, .03), mag = vec3(.55, .03, .24), navy = vec3(.02, .04, .13), alum = vec3(.62, .63, .64);
    bool wing = abs(P.z) > .13 && P.y < .14, fin = P.y > .135;
    vec3 c = mix(sunf, tang, smoothstep(-.03, .03, -(P.x + P.y * 1.8) - .05)); mMetal = 0.;
    float cheat = abs(P.y - (.0 + max(0., -P.x - .15) * .32)); c = mix(c, mag, smoothstep(.034, .026, cheat)); c = mix(c, navy, smoothstep(.012, .006, abs(cheat - .04)));
    c = mix(c, alum, smoothstep(-.055, -.08, P.y)); mMetal = smoothstep(-.055, -.08, P.y);
    if (fin) { c = tang; vec2 sq = vec2(P.x + 1.07, P.y - .37); float r = length(sq), ray = step(.5, fract(atan(sq.y, sq.x) * 1.9099)); c = mix(c, mag, smoothstep(.2, .19, r) * ray); c = mix(c, sunf, smoothstep(.085, .075, r)); c = mix(c, vec3(.9, .86, .74), smoothstep(.05, .042, r)); }
    if (wing) { c = alum; mMetal = 1.; c = mix(c, tang, smoothstep(.9, .95, abs(P.z))); c = mix(c, c * .78, step(.5, fract(P.x * 9.)) * .15); }
    if (!wing && !fin) { float wr = step(.015, P.y) * step(P.y, .045) * step(.45, abs(P.z) / .115) * step(fract(P.x * 26.), .42) * step(-.85, P.x) * step(P.x, .86); c = mix(c, vec3(.02), wr * .9);
      float ck = step(1.04, P.x) * step(P.x, 1.16) * step(.035, P.y) * step(P.y, .072) * step(.25, abs(P.z) / .115); c = mix(c, vec3(.015, .02, .03), ck); }
    // forty years of rain: the paint chalks and fades, flakes to yellow-green primer, rusts from the bottom and the breaks, streaks, and grows moss
    float n1 = fbm(P.xz * 7. + P.y * 5.), n2 = fbm(P.xy * 13. + 3.1), n3 = vn(P.xy * 46. + P.z * 9.), low = smoothstep(.05, -.1, P.y);
    c = mix(c, c * .7 + vec3(.1, .09, .08), .3);
    float flake = smoothstep(.5, .56, n1 * .75 + n3 * .25 + low * .25), rust = smoothstep(.56, .7, n1 * .7 + n3 * .3 + low * .35);
    c = mix(c, vec3(.3, .33, .1), flake * (1. - rust)); vec3 rc = mix(vec3(.24, .08, .025), vec3(.42, .17, .05), n2) * (.7 + .5 * n3); c = mix(c, rc, rust); rRust = max(rust, flake * .6);
    float streak = smoothstep(.55, .9, vn(vec2(P.x * 70. + P.z * 30., P.y * 2.5))) * (1. - abs(normalize(vNW).y)); c *= 1. - .45 * streak;
    float moss = smoothstep(.6, .95, normalize(vNW).y) * smoothstep(.5, .7, n2 + .15 * n3); c = mix(c, vec3(.05, .11, .025) * (.7 + .6 * n3), moss); rRust = max(rRust, moss);
    if (!gl_FrontFacing) { c = vec3(.035, .028, .02) * (.6 + .5 * step(.5, fract(P.x * 18.))); rRust = 1.; }
    c = mix(c, c * .7, uWet * .5); diffuseColor.rgb = c; }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(mix(.55, .32, mMetal), .95, rRust) * mix(1., .7, uWet);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mix(mix(.15, .75, mMetal), .05, rRust);'); };
  const jag = (g, ends) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); ends.forEach(([ex, dir]) => { if (Math.abs(x - ex) < .002) { const a = Math.atan2(p.getZ(i), p.getY(i)); p.setX(i, x + dir * (.03 + .06 * Math.abs(Math.sin(a * 5.3 + ex * 9)) + rnd(0, .04))); } }); } g.computeVertexNormals(); return g; };
  const fus = (x0, x1, ends = []) => { const g = new THREE.CylinderGeometry(R0, R0, x1 - x0, 28, Math.max(2, Math.round((x1 - x0) * 30)), true).rotateZ(-Math.PI / 2).translate((x0 + x1) / 2, 0, 0); return jag(g, ends); };
  const lathX = (prof, x0, up = 0) => { const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(.002, r), y)), 28); g.rotateZ(-Math.PI / 2); g.translate(x0, 0, 0); if (up) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const f = Math.max(0, (x0 - p.getX(i)) / .5); p.setY(i, p.getY(i) + f * f * up); } } g.computeVertexNormals(); return g; };
  const plan = (pts, th) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => s.lineTo(p[0], p[1])); s.lineTo(pts[0][0], pts[0][1]); return new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: .004, bevelSize: .006, bevelSegments: 1 }); };
  const wingG = sd => { const g = plan([[.26, 0], [-.55, 1.05 * sd], [-.72, 1.05 * sd], [-.32, 0]].map(([x, z]) => [x, z]), .026); g.rotateX(Math.PI / 2); g.translate(0, .013, 0); if (sd > 0) {} g.rotateX(-sd * .1); g.translate(0, -.065, 0); return g; };
  const podG = (x, z) => { const parts = [new THREE.CylinderGeometry(.036, .043, .3, 18, 1, true).rotateZ(-Math.PI / 2).translate(x, -.13, z), new THREE.TorusGeometry(.042, .008, 6, 18).rotateY(Math.PI / 2).translate(x + .15, -.13, z), new THREE.BoxGeometry(.16, .07, .012).translate(x - .02, -.085, z)]; return parts; };
  const finG = () => { const g = plan([[-.78, .08], [-1.1, .6], [-1.3, .6], [-1.32, .05]], .024); g.translate(0, 0, -.012); return g; };
  const stabG = sd => { const g = plan([[-1.0, 0], [-1.24, .5 * sd], [-1.37, .5 * sd], [-1.32, 0]], .018); g.rotateX(Math.PI / 2); g.translate(0, .03, 0); return g; };
  const wreck = new THREE.Group(); island.add(wreck); const pieces = [], WS = 1.55;
  const piece = (geos, s, side, yaw, roll, pitch, lift = 0) => { const g = new THREE.Group(); geos.forEach(gg => add(gg, liv, 0, 0, 0, g)); const p = CR[0].clone().lerp(CR[1], s), dir = CR[1].clone().sub(CR[0]).normalize(), nx = -dir.y, nz = dir.x;
    const x = p.x + nx * side, z = p.y + nz * side; g.scale.setScalar(WS); g.position.set(x, hAt(x, z) + (R0 * .75 + lift) * WS, z); g.rotation.order = 'YXZ'; g.rotation.set(roll, Math.atan2(-dir.y, dir.x) + yaw, pitch); wreck.add(g); pieces.push(g); return g; };
  const engL = [...podG(-.12, -.42), ...podG(-.32, -.78)].map(g => { g.rotateX(.1); return g; });
  const nose = (() => { const g = lathX([[R0, 0], [R0 * .98, .06], [R0 * .9, .14], [R0 * .72, .22], [R0 * .46, .28], [R0 * .2, .315], [0, .325]], 1.0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); if (x > 1.12) { const k = (x - 1.12) * 2.5; p.setY(i, p.getY(i) - k * .08 + N.n2(p.getZ(i) * 40, x * 30) * .012 * k); p.setX(i, x - k * .05); } } g.computeVertexNormals(); return g; })();
  piece([fus(.42, 1.0, [[.42, -1]]), nose], .49, .05, .12, .2, -.07, -.04);
  const mid = piece([fus(-.38, .42, [[-.38, -1], [.42, 1]]), wingG(-1), ...engL], .445, -.02, -.04, .38, .02);
  const tailG = (() => { const g = new THREE.LatheGeometry([[R0, 0], [R0 * .93, .12], [R0 * .75, .26], [R0 * .5, .38], [R0 * .22, .48], [R0 * .08, .5]].map(([r, y]) => new THREE.Vector2(r, y)), 28); g.rotateZ(Math.PI / 2); g.translate(-.85, 0, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const f = Math.max(0, (-.85 - p.getX(i)) / .5); p.setY(i, p.getY(i) + f * f * .06); } g.computeVertexNormals(); return g; })();
  const aft = piece([fus(-.85, -.4, [[-.4, 1]]), tailG, finG(), stabG(1), stabG(-1)], .405, .08, .15, .3, .05, .02);
  { const g = new THREE.Group(); const wgeo = wingG(1); add(wgeo, liv, 0, 0, 0, g); podG(-.12, .42).forEach(pg => add(pg.rotateX(-.1), liv, 0, 0, 0, g)); const x = 3.75, z = 2.75; g.scale.setScalar(WS); g.position.set(x, hAt(x, z) + .1, z); g.rotation.set(.06, -.55, -.05); wreck.add(g); pieces.push(g); }
  { const g = new THREE.Group(); podG(0, 0).slice(0, 2).forEach(pg => add(pg, liv, 0, 0, 0, g)); const x = 2.2, z = 1.75; g.scale.setScalar(WS); g.position.set(x, hAt(x, z) + .22, z); g.rotation.set(.3, .8, .2); wreck.add(g); }
  // a young tree pushing up through the broken wing, vines pulling the hull down, shrubs rooted in the dirt on the wings
  wreck.updateMatrixWorld(true);
  { const vp = [], m = new THREE.Matrix4(), qq = new THREE.Quaternion(), upv = new THREE.Vector3(0, 1, 0), sh = [];
    pieces.forEach((pc, k) => { for (let i = 0; i < (k < 3 ? 14 : 6); i++) { const lx = rnd(-.8, .9) * (k === 1 ? .5 : k === 2 ? .55 : .5) + (k === 0 ? .7 : k === 2 ? -.62 : 0), top = new THREE.Vector3(k > 2 ? rnd(-.5, -.1) : lx, k > 2 ? .03 : R0 * .95, k > 2 ? rnd(.1, .9) : rnd(-.04, .04)); pc.localToWorld(top);
        const side = new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1)).normalize(), L = rnd(.12, .3), n = Math.max(3, Math.round(L / .045));
        for (let j = 0; j < n; j++) { const f = j / n, lf = side.clone().multiplyScalar(.6).add(new THREE.Vector3(rnd(-.5, .5), -.6, rnd(-.5, .5))).normalize(); qq.setFromUnitVectors(upv, lf);
          m.compose(new THREE.Vector3(top.x + side.x * (.02 + f * .1), top.y - f * L, top.z + side.z * (.02 + f * .1)), qq, new THREE.Vector3(1, 1, 1)); vp.push(leafQuad(.05, .1 * (1 - f * .4), pick(LEAVES), m)); }
        if (R() < .45) sh.push([top.x, top.y - .01, top.z, rnd(.04, .09)]); } });
    if (vp.length) { const vm = new THREE.Mesh(mergeGeometries(vp), leafMat); vm.castShadow = true; island.add(vm); }
    const im = new THREE.InstancedMesh(crownGeometry(LEAVES, 40), leafMat, sh.length), c = new THREE.Color(); sh.forEach(([x, y, z, s], i) => { m.compose(new THREE.Vector3(x, y + s * .3, z), qq.setFromEuler(new THREE.Euler(0, rnd(TAU), 0)), new THREE.Vector3(s, s * .7, s)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(pick(GR))); }); im.castShadow = true; island.add(im);
    const tp = new THREE.Vector3(-.15, 0, -.5); mid.localToWorld(tp); add(new THREE.CylinderGeometry(.018, .03, .9, 6).translate(0, .45, 0), barkM, tp.x, hAt(tp.x, tp.z) - .02, tp.z, island, .05, 0, -.04);
    const tc = new THREE.InstancedMesh(crownGeometry(LEAVES, 60, [.075, .7], [.2, .46], .62), leafMat, 1); tc.setMatrixAt(0, m.compose(new THREE.Vector3(tp.x - .04, hAt(tp.x, tp.z) + .92, tp.z), qq.identity(), new THREE.Vector3(.2, .14, .2))); tc.setColorAt(0, c.set('#6a8a3e')); tc.castShadow = true; island.add(tc); }
  // fallen trunks along the swath it cut
  for (let k = 0; k < 9; k++) { const s = rnd(-.05, 1.05), p = CR[0].clone().lerp(CR[1], s), nx = -(CR[1].y - CR[0].y), nz = CR[1].x - CR[0].x, ln = Math.hypot(nx, nz), sd = rnd(-.45, .45), x = p.x + nx / ln * sd, z = p.y + nz / ln * sd;
    add(new THREE.CylinderGeometry(.022, .03, rnd(.5, .9), 6).rotateZ(Math.PI / 2), barkM, x, hAt(x, z) + .02, z, island, 0, rnd(TAU), 0); }

  /* ---------------- the falls, out of a cleft in the cliff ---------------- */
  const FLOW = { value: 1 }, LIP = XZ(LIPt, LIPd + .02);
  let notchTop = 0; for (let k = 0; k < 8; k++) { const [x, z] = XZ(LIPt + rnd(-.1, .1), LIPd + .1 + k * .1); notchTop = Math.max(notchTop, hAt(x, z)); }
  const falls = makeFalls(ctx, { x: LIP[0], z: LIP[1], ry: Math.PI / 4, top: notchTop + .05, bottom: WL, width: .38, reach: .3, tint: [.78, .84, .8], flood: [.6, .48, .3], flow: FLOW, foamR: .55, mist: 360, mistS: 1.4, rise: 1.7, mistA: .2 });
  { const flowM = new THREE.MeshStandardMaterial({ color: '#4a5a3a', roughness: .08, metalness: .1, normalMap: tex('water_nor.jpg', false), normalScale: new THREE.Vector2(.5, .5), transparent: true, opacity: .9 }); MATS.push(flowM);
    flowM.onBeforeCompile = sh => { sh.uniforms.uT = U.uTime; sh.fragmentShader = 'uniform float uT;\n' + sh.fragmentShader.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec2 fuv = vNormalMapUv * vec2(1.5, 4.); vec3 mapN = normalize((texture2D(normalMap, fuv + vec2(0., -uT * .35)).xyz * 2. - 1.) + (texture2D(normalMap, fuv * 1.7 + vec2(.3, -uT * .55)).xyz * 2. - 1.));'); };
    const [cx, cz] = XZ(LIPt, LIPd + .5); const st = new THREE.Mesh(new THREE.PlaneGeometry(.42, .95).rotateX(-Math.PI / 2), flowM); st.position.set(cx, notchTop + .05, cz); st.rotation.y = Math.PI / 4; island.add(st);
    const [hx, hz] = XZ(LIPt, 2.72); const cave = new THREE.Mesh(new THREE.CircleGeometry(.24, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#050403' })); cave.position.set(hx, notchTop + .04, hz); cave.rotation.y = Math.PI / 4; island.add(cave); }

  /* ---------------- particles: mist banks, falling leaves, fireflies ---------------- */
  const PX = { value: 1 };
  const fogN = Math.round(130 * QN), fg = new THREE.BufferGeometry(), fp = new Float32Array(fogN * 3), fs = new Float32Array(fogN);
  for (let i = 0; i < fogN; i++) { const ridge = R() < .35, x = rnd(-4.8, 4.8), z = rnd(-4.8, 4.8), y = ridge ? rnd(2.1, 3.4) : rnd(.75, 1.35); fp.set([x, y, z], i * 3); fs[i] = R(); }
  fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('sd', new THREE.BufferAttribute(fs, 1));
  const FOG = { uT: U.uTime, uWind: U.uWind, uSun: U.uSun, uPx: PX, uA: { value: .5 } };
  const fogM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: FOG,
    vertexShader: 'attribute float sd; uniform float uT, uWind, uPx; varying float vA; void main(){ vec3 q = position; q.x = mod(q.x + 4.8 + uT * (.02 + .03 * uWind) * (.6 + sd * .8), 9.6) - 4.8; q.z += sin(uT * .05 + sd * 40.) * .2; vA = smoothstep(4.8, 3.8, abs(q.x)) * smoothstep(4.9, 4.2, abs(q.z)) * (.5 + .5 * sd); vec4 mv = modelViewMatrix * vec4(q, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * (.7 + sd * .8) / -mv.z, 2., 380.); }',
    fragmentShader: 'uniform float uSun, uA; varying float vA; void main(){ float r2 = dot(gl_PointCoord - .5, gl_PointCoord - .5) * 4.; if (r2 > 1.) discard; gl_FragColor = vec4(vec3(.8, .82, .82) * (.25 + .7 * uSun), exp(-r2 * 2.6) * vA * uA * .055); }' });
  const fog = new THREE.Points(fg, fogM); fog.frustumCulled = false; fog.renderOrder = 5; island.add(fog);
  const ffN = Math.round(300 * QN), ffg = new THREE.BufferGeometry(), ffp = new Float32Array(ffN * 3), ffs = new Float32Array(ffN);
  for (let i = 0, t = 0; i < ffN && t < 40000; t++) { const x = rnd(-4.8, 4.8), z = rnd(-4.8, 4.8), h = hAt(x, z), edge = Math.min(riverD(x, z), crashD(x, z), Math.hypot(x - POOL[0], z - POOL[1])); if (h < .05 || edge > .9 || h > 1.5) continue; ffp.set([x, h + rnd(.05, .4), z], i * 3); ffs[i] = R(); i++; ffg.setDrawRange(0, i); }
  ffg.setAttribute('position', new THREE.BufferAttribute(ffp, 3)); ffg.setAttribute('sd', new THREE.BufferAttribute(ffs, 1));
  const ffM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: U.uTime, uGlow: U.uGlow, uPx: PX },
    vertexShader: 'attribute float sd; uniform float uT, uPx; varying float vA; void main(){ vec3 q = position + vec3(sin(uT * .4 + sd * 30.), sin(uT * .7 + sd * 11.) * .5, cos(uT * .3 + sd * 20.)) * .08; vA = pow(max(0., sin(uT * (1.2 + sd) + sd * 50.)), 6.); vec4 mv = modelViewMatrix * vec4(q, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * .02 / -mv.z, 1.5, 8.); }',
    fragmentShader: 'uniform float uGlow; varying float vA; void main(){ float r = length(gl_PointCoord - .5) * 2.; if (r > 1.) discard; gl_FragColor = vec4(vec3(.75, 1., .3) * exp(-r * r * 3.) * vA * uGlow * 2.2, 1.); }' });
  const flies = new THREE.Points(ffg, ffM); flies.frustumCulled = false; island.add(flies);
  const LV = { n: Math.round(900 * QN), list: [] }; { const g = new THREE.BufferGeometry(); LV.p = new Float32Array(LV.n * 3); LV.c = new Float32Array(LV.n * 4); g.setAttribute('position', new THREE.BufferAttribute(LV.p, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('pc', new THREE.BufferAttribute(LV.c, 4).setUsage(THREE.DynamicDrawUsage)); g.setDrawRange(0, 0); LV.g = g;
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPx: PX, uSun: U.uSun }, vertexShader: 'attribute vec4 pc; uniform float uPx; varying vec4 vC; void main(){ vC = pc; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * .018 / -mv.z, 1.5, 9.); }',
      fragmentShader: 'uniform float uSun; varying vec4 vC; void main(){ vec2 d = gl_PointCoord - .5; if (abs(d.x) + abs(d.y) * 1.8 > .5) discard; gl_FragColor = vec4(vC.rgb * (.3 + .7 * uSun), vC.a); }' });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; island.add(pts); }
  const LEAFC = [[.22, .3, .08], [.3, .36, .1], [.38, .3, .1], [.16, .24, .07], [.45, .38, .12]];
  const dropLeaves = (x, z, n, y0) => { for (let i = 0; i < n; i++) if (LV.list.length < LV.n) LV.list.push({ x: x + rnd(-.3, .3), y: y0 + rnd(-.1, .15), z: z + rnd(-.3, .3), vx: rnd(-.15, .15), vy: rnd(-.05, .25), vz: rnd(-.15, .15), ph: rnd(TAU), age: 0, life: rnd(2.5, 4.5), c: pick(LEAFC) }); };

  /* ---------------- macaws: a flock that bursts out of the canopy and crosses it ---------------- */
  const NBIRD = 9, bgeo = (() => { const p = [], wg = []; const tri = (a, b, c, wa, wb, wc) => { p.push(...a, ...b, ...c); wg.push(wa, wb, wc); };
    [-1, 1].forEach(s => { tri([0, 0, -.05], [0, 0, .06], [s * .45, .02, -.01], 0, 0, 1); tri([0, 0, .06], [s * .45, .02, -.01], [s * .24, .01, .08], 0, 1, .55); });
    tri([0, .015, -.16], [-.04, 0, .1], [.04, 0, .1], 0, 0, 0); tri([0, -.012, -.16], [.04, 0, .1], [-.04, 0, .1], 0, 0, 0); tri([-.03, 0, .1], [.03, 0, .1], [0, 0, .36], 0, 0, 0);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('wing', new THREE.Float32BufferAttribute(wg, 1)); g.computeVertexNormals(); return g; })();
  const birdM = new THREE.MeshStandardMaterial({ roughness: .7, side: THREE.DoubleSide }); MATS.push(birdM);
  birdM.onBeforeCompile = sh => { sh.uniforms.uT = U.uTime; sh.vertexShader = 'attribute float wing; uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7; float f = sin(uT * 11. + ph); transformed.y += wing * f * .3; transformed.x *= 1. - wing * abs(f) * .12; }'); };
  const macaws = new THREE.InstancedMesh(bgeo, birdM, NBIRD); macaws.frustumCulled = false; macaws.castShadow = true; island.add(macaws); ctx.life(macaws, 1);
  { const c = new THREE.Color(); for (let i = 0; i < NBIRD; i++) macaws.setColorAt(i, c.set(i % 3 === 2 ? '#2a6ad8' : i % 3 === 1 ? '#e8b020' : '#d81a14')); }
  let flock = null; const ZERO = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < NBIRD; i++) macaws.setMatrixAt(i, ZERO);
  const flush = (x, z) => { if (flock || MOD().life < 1) return; const a = rnd(TAU); flock = { t: 0, x, z, dx: Math.cos(a), dz: Math.sin(a), n: 4 + Math.floor(R() * (NBIRD - 4)), off: Array.from({ length: NBIRD }, () => [rnd(-.35, .35), rnd(-.1, .15), rnd(-.4, .4), rnd(TAU)]) }; squawk(); };
  const MOD = () => ctx.MOD;

  /* ---------------- sound ---------------- */
  const AU = makeAudio(); AU.onStart = A => { A.falls = A.loop('lowpass', 700, .5, .05); A.bugs = A.loop('bandpass', 4600, 6, .012); A.frogs = A.loop('bandpass', 1900, 9, .008); A.leaves = A.loop('bandpass', 1200, .6, 0); };
  const squawk = () => { for (let k = 0; k < 3; k++) { const f = rnd(900, 1400); AU.tone(f, f * .7, rnd(.18, .3), .035, k * rnd(.15, .3), 'sawtooth'); } };
  const howl = (g = 1) => { const c = AU.get(); if (!c) return; for (let k = 0; k < 3; k++) { const w = k * rnd(.5, .9), f = rnd(110, 160); AU.tone(f, f * 1.25, rnd(1.2, 1.8), .06 * g, w, 'sawtooth'); AU.tone(f * 1.5, f * 1.3, rnd(1.1, 1.6), .03 * g, w + .05, 'square'); AU.burst(1.4, 500, .05 * g, 'bandpass', w); } };
  const rustle = (g = 1) => { AU.burst(rnd(.5, 1.1), rnd(1500, 2600), .06 * g, 'bandpass'); AU.burst(.25, 400, .05 * g, 'lowpass', rnd(.1, .4)); };

  /* ---------------- the unseen: animals moving under the canopy ---------------- */
  const AG = [0, 1, 2, 3].map(() => ({ x: rnd(-3.5, 3.5), z: rnd(-3.5, 3.5), dir: rnd(TAU), sp: rnd(.5, 1.1), on: 0, k: 0, t: rnd(1, 6) }));
  const bolt = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color(6, 6.5, 9), transparent: true })); bolt.visible = false; island.add(bolt);
  const flashL = new THREE.PointLight('#cfe0ff', 0, 30, 1.2); island.add(flashL);
  const strike = (x, z, top) => { const pts = []; let px = x + rnd(-1.5, 1.5), py = 7.5, pz = z + rnd(-1.5, 1.5); while (py > top) { pts.push(new THREE.Vector3(px, py, pz)); py -= rnd(.2, .5); px += (x - px) * .2 + rnd(-.22, .22); pz += (z - pz) * .2 + rnd(-.22, .22); } pts.push(new THREE.Vector3(x, top, z));
    bolt.geometry.dispose(); bolt.geometry = new THREE.BufferGeometry().setFromPoints(pts); bolt.visible = true; bolt.userData.t = .22; flashL.position.set(x, top + 1, z); flashL.intensity = 300; ctx.skyU.uFlash.value = 1.4; ctx.flash(.25, '#dfe8ff'); AU.thunder(1); };
  let ev = null; const api = { ev: () => { AU.get(); ev = { t: 0, f: {} }; }, get evOn() { return !!ev; } };
  const wv = new THREE.Vector3();

  ctx.steps.push(dt => { const t = ctx.clock, M = MOD(); PX.value = ctx.renderer.domElement.height / (2 * Math.tan(ctx.camera.fov * Math.PI / 360));
    const storm = ev ? sm(ev.t / 2.5) * (1 - sm((ev.t - 18) / 4)) : 0;
    FOG.uA.value = lerp(FOG.uA.value, .45 + M.rain * .14 + M.clouds * .08 + storm * .5, 1 - Math.exp(-dt));
    // the unseen: each animal moves in bursts; while it moves the crowns over it shake and leaves come down
    const nAct = [0, 1, 2, 4][M.life] + (storm > .3 ? 2 : 0);
    AG.forEach((a, i) => { const live = i < nAct; a.t -= dt; if (a.t < 0) { a.on = live && !a.on ? 1 : 0; a.t = a.on ? rnd(2, 4.5) : rnd(3, 9) * (storm > .3 ? .4 : 1);
        if (a.on) { a.dir = rnd(TAU); const r = R(); if (r < .3) howl(.8); else if (r < .6) { flush(a.x, a.z); } rustle(); } }
      a.k = lerp(a.k, a.on ? 1 : 0, 1 - Math.exp(-dt * 4));
      if (a.on) { a.dir += rnd(-1, 1) * dt * 2.5; const nx = a.x + Math.cos(a.dir) * a.sp * dt, nz = a.z + Math.sin(a.dir) * a.sp * dt; if (okGround(nx, nz) && crashD(nx, nz) > .45) { a.x = nx; a.z = nz; } else a.dir += Math.PI * rnd(.6, 1.4);
        if (R() < dt * 9) dropLeaves(a.x, a.z, 2, hAt(a.x, a.z) + .8); }
      DU.uDist.value[i].set(a.x, a.z, a.k * (.75 + .25 * Math.sin(t * 7 + i)), .55); });
    if (AU.ctx) { AU.leaves.gain.setTargetAtTime(AG.reduce((s, a) => s + a.k, 0) * .02 + storm * .05, AU.ctx.currentTime, .2); AU.falls.gain.setTargetAtTime(.05 * FLOW.value, AU.ctx.currentTime, .4); AU.bugs.gain.setTargetAtTime(.012 * (1 - storm), AU.ctx.currentTime, .5); }
    // macaws
    if (flock) { flock.t += dt; const f = flock, m = new THREE.Matrix4(), q = new THREE.Quaternion(); const yaw = Math.atan2(-f.dz, f.dx) - Math.PI / 2;
      for (let i = 0; i < NBIRD; i++) { if (i >= f.n) { macaws.setMatrixAt(i, ZERO); continue; } const [ox, oy, oz, ph] = f.off[i], d = f.t * 1.4 - oz, x = f.x + f.dx * d + -f.dz * ox, z = f.z + f.dz * d + f.dx * ox, y = hAt(f.x, f.z) + .8 + Math.min(1, f.t * .9) * .9 + oy + Math.sin(t * 2 + ph) * .04;
        q.setFromEuler(new THREE.Euler(-.15, yaw, Math.sin(t * 1.5 + ph) * .15)); m.compose(wv.set(x, y, z), q, new THREE.Vector3(.32, .32, .32)); macaws.setMatrixAt(i, Math.abs(x) < 5.6 && Math.abs(z) < 5.6 ? m : ZERO); }
      macaws.instanceMatrix.needsUpdate = true; if (f.t > 9) { flock = null; for (let i = 0; i < NBIRD; i++) macaws.setMatrixAt(i, ZERO); macaws.instanceMatrix.needsUpdate = true; } }
    else if (M.life >= 1 && R() < dt * .03) flush(rnd(-3, 3), rnd(-3, 3));
    // falling leaves
    let k = 0; for (let i = LV.list.length - 1; i >= 0; i--) { const p = LV.list[i]; p.age += dt; if (p.age > p.life) { LV.list[i] = LV.list[LV.list.length - 1]; LV.list.pop(); continue; }
      p.vy -= .5 * dt; p.vy = Math.max(p.vy, -.35); p.x += (p.vx + Math.sin(t * 3 + p.ph) * .12) * dt; p.y += p.vy * dt; p.z += (p.vz + Math.cos(t * 2.6 + p.ph) * .1) * dt; const g = hAt(p.x, p.z); if (p.y < g) { p.y = g; p.vx = p.vz = p.vy = 0; } }
    for (const p of LV.list) { LV.p[k * 3] = p.x; LV.p[k * 3 + 1] = p.y; LV.p[k * 3 + 2] = p.z; LV.c.set([...p.c, Math.min(1, p.age * 3) * (1 - sm((p.age - p.life + .8) / .8))], k * 4); k++; }
    LV.g.setDrawRange(0, k); LV.g.attributes.position.needsUpdate = LV.g.attributes.pc.needsUpdate = true;
    // lightning and the cloudburst
    flashL.intensity = Math.max(0, flashL.intensity - dt * 1400); if (bolt.visible) { bolt.userData.t -= dt; bolt.material.opacity = R() < .7 ? 1 : .2; if (bolt.userData.t <= 0) bolt.visible = false; }
    DU.uGust.value = lerp(DU.uGust.value, storm * .9 + (M.wind === 3 ? .25 : 0), 1 - Math.exp(-dt * 2));
    FLOW.value = lerp(FLOW.value, 1 + storm * 1.3, 1 - Math.exp(-dt * .8)); water.WU.uWave.value = .01 + storm * .03; water.WU.uFoam.value = 1 + storm;
    if (ev) { ev.t += dt; const e = ev.t, f = ev.f;
      if (!f.go) { f.go = 1; ctx.setLook('burst'); AU.thunder(.6, .3); }
      if (e > 2.2 && !f.hit) { f.hit = 1; const em = EMG[0] || [0, .5, 0, 1.3, .5]; strike(em[0], em[2], em[1] + em[3] + .2); dropLeaves(em[0], em[2], 60, em[1] + em[3]); DU.uDist.value[3].set(em[0], em[2], 2, 1.2); ctx.shake(.4); setTimeout(() => howl(1.2), 900); flush(em[0], em[2]); }
      if (e > 3 && e < 17 && R() < dt * .35) { const em = pick(EMG.length ? EMG : [[0, .5, 0, 1.3]]); strike(em[0] + rnd(-.8, .8), em[2] + rnd(-.8, .8), em[1] + em[3] * .8); }
      if (e > 2 && e < 18 && R() < dt * 1.5) { const x = rnd(-4, 4), z = rnd(-4, 4); dropLeaves(x, z, 6, hAt(x, z) + 1); }
      if (e > 21 && !f.back) { f.back = 1; ctx.setLook(ctx.baseLook()); }
      if (e > 24) ev = null; }
  });
  { const done = new Set(); island.traverse(o => { if (!o.isMesh || !o.material || done.has(o.material) || o.material === water.mat || o.material === water.wallMat || o.material.isShaderMaterial || o === wl || o.material === leafMat || o.material === birdM) return; done.add(o.material); underwater(o.material, WL, 2.2, [.03, .028, .012]); }); }
  ctx.api = api; return ctx;
}
