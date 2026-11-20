/* Amazon Canopy: a jumbo jet lost in the upper Amazon. A sixties-livery 747, so big its port wing and tailplane reach out past the
   edges of the slice into the void, lies broken behind the wing in a swath it tore through the forest decades ago. Its bold
   super-graphics livery (sunflower to tangerine, a magenta sweep, a sun on the fin) is chalking, flaking to primer and rusting
   under moss and vines; vines hang from the wingtip into nothing. And something aboard is still awake: a few cabin windows glow,
   the open forward door spills warm light, light leaks from the break and mist drifts out of it, and the anti-collision beacon
   still blinks red. Behind it, a closed canopy in every green climbs to Inca terraces and a cloud-forest citadel; a waterfall
   drops out of a cleft and a tea-brown river snakes down from its pool past the nose. Shafts of low gold light fall through the
   humid air. Unseen animals shake the crowns, drop leaves, flush macaws and set off howlers; mist banks drift and fireflies come
   out with GLOW. EVENT: something comes. Rustling, then a cacophony as a troop of monkeys bursts over the canopy, leaping for
   their lives ahead of something invisible that flattens the trees as it comes; then a huge explosion, a fireball and a shock
   ring through the canopy, smoke climbing; then silence, and slowly the forest breathes again. */
import { THREE, mergeGeometries, TAU, R, rnd, pick, clamp, lerp, sm, Q, LO, QN, makeNoise, GLSL_NOISE, TRI, createEngine, makeHeightfield, SLAB, makeWalls, wallMaterial, makeWater, leafQuad, crownGeometry, makeAudio, underwater, palmGeometry, LEAF_RECTS, makeFalls } from './core.js';

export const META = { name: 'Amazon Canopy', line: 'A lost jumbo jet, too big for its world, rusting in the rainforest below Inca terraces. A few of its windows are still lit. Press the event, and listen.',
  era: 'Upper Amazon, Andean foothills · dusk, monsoon', ev: 'Something comes', preset: { time: 2, clouds: 1, rain: 2, wind: 1, glow: 2, life: 2 }, birds: 'none' };

export function build() {
  const N = makeNoise(+(Q.get('seed') || 11)), S = 10, H5 = 5, DEPTH = SLAB, NORM = 1.6, WL = 0;
  const ctx = createEngine({ cam: { target: [.25, .8, .25], dist: 47, pol: 1.05, az: Math.PI / 4, min: 9, max: 72 }, sunRef: 3.0, bloom: [.3, .55, 1.15], sat: 1.12, stars: true,
    grade: { lift: [-.012, .03, .022], gain: [1.05, 1.0, .86] },
    looks: { noon: { sky: 'noon', dir: [-.5, 1, .6], col: '#fff2e0', I: 3.0, env: .85, exp: 1.05 },
      gold: { sky: 'gold', dir: [-.42, .24, .88], col: '#ff9a50', I: 4.4, env: .75, exp: 1.12, warm: .8, rot: .14 },
      night: { sky: 'night', dir: [-.3, .9, -.7], col: '#a0b4ff', I: .8, env: .3, exp: 1.32, skyI: .3 },
      blast: { sky: 'gold', dir: [-.3, .5, .8], col: '#ffb070', I: 3.2, env: .7, exp: 1.18, warm: 1, rot: .14 } } });
  const { island, tex, U, MATS } = ctx; ctx.waterLevel = WL;
  Object.assign(ctx.sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, far: 90 }); ctx.sun.shadow.camera.updateProjectionMatrix();
  const T = { rock: tex('rock_diff.jpg'), rockN: tex('rock_nor.jpg', false), lime: tex('lime_diff.jpg'), limeN: tex('lime_nor.jpg', false), grass: tex('mtn_diff.jpg'), grassN: tex('mtn_nor.jpg', false),
    forest: tex('forest_diff.jpg'), forestN: tex('forest_nor.jpg', false), sand: tex('sand_diff.jpg'),
    leaf: tex('leaf_diff.jpg', true, false), leafA: tex('leaf_alpha.jpg', false, false), leafN: tex('leaf_nor.jpg', false, false), bark: tex('bark_diff.jpg'), barkN: tex('bark_nor.jpg', false) };
  const add = (g, m, x, y, z, par = island, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; par.add(o); return o; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);

  /* ---------------- layout ----------------
     d runs toward the back corner, t across the view (right is positive). The 747 lies broadside across the front half,
     nose to the left; its port wing points at the viewer and out past the right-front wall. */
  const dOf = (x, z) => -(x + z) * .7071, tOf = (x, z) => (x - z) * .7071, XZ = (t, d) => [(t - d) * .7071, (-t - d) * .7071];
  const POOL = XZ(-2.35, 1.3), LIPd = 1.74, LIPt = -2.35, CIT = XZ(.25, 3.95), STt = .25;
  const RIV = (() => { const c = new THREE.CatmullRomCurve3([POOL, [-1.7, 1.05], [-1.55, 1.85], [-2.55, 2.15], [-3.15, 2.85], [-2.45, 3.45], [-1.6, 3.75], [-1.7, 4.45], [-2.45, 4.85], [-2.6, 5.6]].map(p => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
    return c.getPoints(90).map(p => new THREE.Vector2(p.x, p.z)); })();
  const segD = (pts, x, z) => { let d = 9; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], abx = b.x - a.x, aby = b.y - a.y, t = clamp(((x - a.x) * abx + (z - a.y) * aby) / (abx * abx + aby * aby), 0, 1), dx = x - a.x - abx * t, dz = z - a.y - aby * t; d = Math.min(d, Math.hypot(dx, dz)); } return d; };
  const riverD = (x, z) => segD(RIV, x, z);
  // the aircraft frame: built in units where the fuselage runs -1.35..1.35, then scaled up
  const R0 = .115, SP = 3.2, PO = [2.1, 2.1], PN = [-.7071, .7071], PS = [-.7071, -.7071];
  const NOSE = new THREE.Vector2(PO[0] + PN[0] * 1.35 * SP, PO[1] + PN[1] * 1.35 * SP), TAIL = new THREE.Vector2(PO[0] - PN[0] * 1.35 * SP, PO[1] - PN[1] * 1.35 * SP);
  const planeD = (x, z) => segD([TAIL, NOSE], x, z), AXD = -(PO[0] + PO[1]) * .7071;
  const toLocal = (x, z) => [((x - PO[0]) * PN[0] + (z - PO[1]) * PN[1]) / SP, ((x - PO[0]) * PS[0] + (z - PO[1]) * PS[1]) / SP];
  const LE = a => .32 - a * .768, TE = a => a < .42 ? -.3 - a * .333 : -.44 - (a - .42) * .434;
  const underWing = (x, z, m = .05) => { const [lx, lz] = toLocal(x, z), a = Math.abs(lz); if (lx < -1.0 && a < .55) return true; return a > .08 && a < 1.3 && lx < LE(a) + m && lx > TE(a) - m; };

  /* ---------------- the land ---------------- */
  const ddOf = (x, z) => { const d = dOf(x, z), t = tOf(x, z); return d + .22 * Math.cos(t * 1.15) + N.fbm(t * .5, 3) * .25; };
  const terrK = (x, z) => { const t = tOf(x, z), dd = ddOf(x, z); return sm((t + 1.3) / .25) * sm((2.0 - t) / .25) * sm((dd - 1.15) / .15) * sm((3.6 - dd) / .25) * (1 - sm((.14 - Math.abs(t - STt)) / .03)); };
  const cliffB = (x, z) => { const t = tOf(x, z); return sm((-1.45 - t) / .3) * sm((t + 3.7) / .4); };
  function ridgeH(x, z) { const t = tOf(x, z), dd = ddOf(x, z);
    let rh = 2.95 * sm((dd - 1.1) / 3.0) + N.ridge(x * .9, z * .9) * .35 * sm((dd - 1.4) / 1.5);
    let rc = sm((dd - LIPd) / .07) * (2.05 + .75 * sm((dd - 1.9) / 2.2)) + N.ridge(x * 2, z * 2) * .12 * sm((dd - 1.8) / .3);
    rc = lerp(rc, 1.62 * sm((dd - LIPd) / .07), sm((.26 - Math.abs(t - LIPt)) / .07) * sm((2.75 - dd) / .12));
    rh = lerp(rh, rc, cliffB(x, z));
    const st = .21, q = rh / st, rq = (Math.floor(q) + sm((q - Math.floor(q) - .8) / .2)) * st; rh = lerp(rh, rq, terrK(x, z));
    return lerp(rh, 2.92, 1 - sm((Math.hypot(x - CIT[0], z - CIT[1]) - .85) / .45)); }
  function height(u, v) { const x = u * H5, z = v * H5;
    let h = .34 + N.fbm(u * 2.2, v * 2.2) * .14 + N.fbm(u * 7, v * 7) * .04 + ridgeH(x, z);
    const pd = planeD(x, z); h = lerp(h, .3 + N.fbm(u * 5, v * 5) * .04, Math.max(sm((1.2 - pd) / .6) * .85, sm((AXD + .4 - dOf(x, z)) / .6) * .6)); h -= .07 * sm((.3 - pd) / .2); // the swath and the furrow the belly ploughed
    const rd = riverD(x, z); h = lerp(h, -.45 + N.fbm(u * 4, v * 4) * .08, sm((.26 - rd) / .12)); h = Math.min(h, lerp(h, .1, sm((.44 - rd) / .12)));
    const qd = Math.hypot(x - POOL[0], z - POOL[1]); h = lerp(h, -.8, sm((.55 - qd) / .25));
    return h; }
  const hf = makeHeightfield(S, 300, height), { hAt, normAt } = hf;
  { const p = hf.geo.attributes.position, zn = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); zn[i * 2] = terrK(x, z); zn[i * 2 + 1] = Math.max(sm((1.1 - planeD(x, z)) / .4), underWing(x, z, .12) ? .8 : 0); } hf.geo.setAttribute('zn', new THREE.BufferAttribute(zn, 2)); }

  const MASON = `vec3 mason(vec2 q){ vec2 i = floor(q), f = fract(q); float d1 = 8., d2 = 8.; vec2 id = vec2(0.);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)), o = vec2(hh(i + g), hh(i + g + 17.3)) * .85 + .075; float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) d2 = d; }
    return vec3(d2 - d1, hh(id + 3.1), d1); }\n`;
  const terrMat = new THREE.MeshStandardMaterial({ roughness: .95 }); MATS.push(terrMat);
  terrMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, { tRock: { value: T.rock }, tRockN: { value: T.rockN }, tLime: { value: T.lime }, tGrass: { value: T.grass }, tGrassN: { value: T.grassN }, tForest: { value: T.forest }, tForestN: { value: T.forestN }, tSand: { value: T.sand } });
    sh.vertexShader = 'attribute vec2 zn; varying vec2 vZn; varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvZn = zn; vWP = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform sampler2D tRock, tRockN, tLime, tGrass, tGrassN, tForest, tForestN, tSand; uniform float uTime, uSun, uCloud, uWet; varying vec2 vZn; varying vec3 vWP; varying vec3 vWN; float mRk, mGr, mMs;\n' + GLSL_NOISE + TRI + MASON + sh.fragmentShader
      .replace('#include <map_fragment>', `
  vec3 P = vWP, Nn = normalize(vWN), w = triW(Nn); float slope = 1. - Nn.y;
  vec3 litter = tri2(tForest, P, w, .45) * vec3(.5, .55, .38), grass = tri2(tGrass, P, w, .5) * vec3(.42, .74, .3), rock = tri2(tRock, P, w, .32) * vec3(.56, .58, .5), mud = tri2(tSand, P, w, .5) * vec3(.46, .36, .24);
  float mossN = smoothstep(.35, .75, fbm(P.xz * 1.6 + P.y * .8)); rock = mix(rock, rock * vec3(.4, .62, .3), mossN * .75); rock *= mix(1., .62, smoothstep(.4, .8, vn(vec2((P.x - P.z) * 9., P.y * .7))) * .6);
  mRk = smoothstep(.42, .7, slope); mGr = max(vZn.x * (1. - mRk), vZn.y * smoothstep(.25, .65, fbm(P.xz * 2.4)));
  vec3 col = mix(litter, grass, mGr); col = mix(col, rock, mRk);
  if (vZn.x > .02 && mRk > .02) { vec3 m = mason((abs(Nn.x) > abs(Nn.z) ? P.zy : P.xy) * vec2(13., 16.)); vec3 st = tri2(tLime, P, w, .6) * vec3(.72, .7, .6) * (.72 + .45 * m.y) * (.9 + .25 * smoothstep(.0, .6, m.z));
    st = mix(st, st * vec3(.45, .66, .34), smoothstep(.45, .8, fbm(P.xz * 3. + P.y * 4.)) * .85); st *= mix(.3, 1., smoothstep(.02, .07, m.x)); col = mix(col, st, vZn.x * mRk); }
  col = mix(col, mud, smoothstep(.16, .04, P.y)); float dep = -P.y; if (dep > 0.) { col *= vec3(.58, .52, .4); col += vec3(.6, .55, .35) * caustic(P.xz * 1.4, uTime) * exp(-dep * 2.) * .25 * uSun; }
  col = mix(col, col * .62, uWet * .7); mMs = mRk; col *= cloudShade(P.xz, uTime, uCloud); diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(.95, .45, uWet * (.4 + .6 * mMs));')
      .replace('#include <normal_fragment_maps>', '{ vec3 nT = normalize(mix(mix(triN(tForestN, vWP, Nn, w, .45), triN(tGrassN, vWP, Nn, w, .5), mGr), triN(tRockN, vWP, Nn, w, .32), mRk)); normal = normalize((viewMatrix * vec4(nT, 0.)).xyz); }'); };
  const terr = new THREE.Mesh(hf.geo, terrMat); terr.castShadow = terr.receiveShadow = true; island.add(terr);
  const walls = makeWalls(hf, DEPTH, WL, NORM); const wl = new THREE.Mesh(walls.land, wallMaterial(ctx, T.rock, T.rockN, [.86, .56, .4])); wl.castShadow = wl.receiveShadow = true; island.add(wl);
  const water = makeWater(ctx, hf, { level: WL, att: '#6a6a34', attDist: .7, deep: '#2a2410', shallow: '#5e5a2c', glint: .8, norm: NORM, wallK: 5.2, wave: .01 });
  island.add(new THREE.Mesh(walls.water, water.wallMat));

  /* ---------------- the citadel and the stair ---------------- */
  const incaM = new THREE.MeshStandardMaterial({ roughness: .9 }); MATS.push(incaM);
  incaM.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, { tLime: { value: T.lime } });
    sh.vertexShader = 'varying vec3 vIP; varying vec3 vIN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvIP = (modelMatrix * vec4(transformed, 1.)).xyz; vIN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform sampler2D tLime; uniform float uWet; varying vec3 vIP; varying vec3 vIN;\n' + GLSL_NOISE + TRI + MASON + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 P = vIP, Nc = normalize(vIN), w = triW(Nc); vec2 q = abs(Nc.y) > .6 ? P.xz : (abs(Nc.x) > abs(Nc.z) ? P.zy : P.xy); vec3 m = mason(q * vec2(16., 20.));
    vec3 st = tri2(tLime, P, w, .7) * vec3(.76, .74, .64) * (.72 + .45 * m.y) * (.88 + .26 * smoothstep(.0, .6, m.z)); st *= mix(.32, 1., smoothstep(.02, .07, m.x));
    st = mix(st, st * vec3(.44, .64, .32), smoothstep(.4, .78, fbm(P.xz * 4. + P.y * 3.)) * (.5 + .5 * smoothstep(.3, .9, Nc.y))); st = mix(st, st * .6, uWet * .6); diffuseColor.rgb *= st; }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(.9, .5, uWet);'); };
  const trapWall = (w, h, d, doors) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
    doors.forEach(([cx, bw, tw, dh, y0 = 0]) => { const p = new THREE.Path(); p.moveTo(cx - bw / 2, y0 + .001); p.lineTo(cx + bw / 2, y0 + .001); p.lineTo(cx + tw / 2, y0 + dh); p.lineTo(cx - tw / 2, y0 + dh); p.lineTo(cx - bw / 2, y0 + .001); s.holes.push(p); });
    return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2); };
  const gable = (w, h0, h1, d) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h0); s.lineTo(0, h1); s.lineTo(-w / 2, h0); s.lineTo(-w / 2, 0);
    const p = new THREE.Path(); p.moveTo(-.035, .02); p.lineTo(.035, .02); p.lineTo(.026, .11); p.lineTo(-.026, .11); s.holes.push(p); return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2); };
  { const parts = [], put = (g, x, y, z, ry = 0) => { g.rotateY(ry); g.translate(x, y, z); parts.push(g.index ? g.toNonIndexed() : g); };
    const house = (x, z, ry, w, d) => { const H = .2, th = .045, c = Math.cos(ry), s = Math.sin(ry), at = (px, pz) => [x + px * c + pz * s, z - px * s + pz * c];
      let [ax, az] = at(0, d / 2); put(trapWall(w, H, th, [[0, .075, .055, .15], [-w * .32, .04, .03, .06, .08], [w * .32, .04, .03, .06, .08]]), ax, 0, az, ry);
      [ax, az] = at(0, -d / 2); put(trapWall(w, H, th, [[-w * .25, .04, .03, .06, .08], [w * .25, .04, .03, .06, .08]]), ax, 0, az, ry);
      [-1, 1].forEach(sd => { const [gx, gz] = at(sd * w / 2, 0); put(gable(d + th, H, H + .17, th), gx, 0, gz, ry + Math.PI / 2); }); };
    house(-.42, -.18, 0, .5, .3); house(.42, -.2, 0, .46, .3); house(-.5, .4, Math.PI / 2, .42, .28); house(.55, .38, Math.PI / 2, .4, .26);
    [[.62, .5], [.5, .38], [.38, .26]].forEach(([w, d], i) => put(box(w, .06, d), 0, i * .06, .05)); put(box(.06, .1, .05), 0, .18, .05);
    put(trapWall(.62, .3, .09, [[0, .17, .12, .24]]), 0, 0, .74); put(box(.66, .04, .1), 0, .3, .74);
    [[-.86, -.6], [.86, -.6], [-.86, .7], [.86, .7]].forEach(([x, z]) => put(box(.08, .14, .08), x, 0, z));
    put(trapWall(1.8, .12, .06, []), 0, -.02, -.82); [-1, 1].forEach(sd => put(trapWall(1.5, .12, .06, []), sd * .9, -.02, -.05, Math.PI / 2));
    parts.forEach(g => { if (g.attributes.uv) g.deleteAttribute('uv'); });
    add(mergeGeometries(parts), incaM, CIT[0], hAt(CIT[0], CIT[1]) - .01, CIT[1], island, 0, Math.PI / 4); }
  { const parts = []; for (let k = 0; k < 56; k++) { const d = 1.18 + k * .043, [x, z] = XZ(STt, d), y = hAt(x, z); if (y > 3.0) break; const b = new THREE.BoxGeometry(.24, .08, .055).translate(0, -.03, 0); b.rotateY(Math.PI / 4); b.translate(x, y, z); parts.push(b); }
    add(mergeGeometries(parts), incaM, 0, 0, 0); }

  /* ---------------- the 747 ----------------
     Livery, windows and decay are painted from the aircraft-frame position, so they run on across the break. */
  const MY = { uMy: { value: 1 } };
  const liv = new THREE.MeshStandardMaterial({ roughness: .5, metalness: .4, side: THREE.DoubleSide }); MATS.push(liv);
  liv.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, MY);
    sh.vertexShader = 'varying vec3 vPL; varying vec3 vNW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPL = position; vNW = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform float uWet, uTime, uMy; varying vec3 vPL; varying vec3 vNW; float rRust, mMetal; vec3 wGlow;\n' + GLSL_NOISE + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 P = vPL; vec3 sunf = vec3(.92, .58, .05), tang = vec3(.95, .26, .03), mag = vec3(.55, .03, .24), navy = vec3(.02, .04, .13), alum = vec3(.62, .63, .64);
    bool wing = abs(P.z) > .135 && P.y < .1, fin = P.y > .1 && P.x < -.66 && abs(P.z) < .03; wGlow = vec3(0.);
    vec3 c = mix(sunf, tang, smoothstep(-.03, .03, -(P.x + P.y * 1.8) - .05)); mMetal = 0.;
    float cheat = abs(P.y - (.0 + max(0., -P.x - .15) * .32)); c = mix(c, mag, smoothstep(.034, .026, cheat)); c = mix(c, navy, smoothstep(.012, .006, abs(cheat - .04)));
    c = mix(c, alum, smoothstep(-.055, -.08, P.y)); mMetal = smoothstep(-.055, -.08, P.y);
    if (fin) { c = tang; vec2 sq = vec2(P.x + 1.08, P.y - .36); float r = length(sq), ray = step(.5, fract(atan(sq.y, sq.x) * 1.9099)); c = mix(c, mag, smoothstep(.2, .19, r) * ray); c = mix(c, sunf, smoothstep(.085, .075, r)); c = mix(c, vec3(.9, .86, .74), smoothstep(.05, .042, r)); }
    if (wing) { c = alum; mMetal = 1.; c = mix(c, tang, smoothstep(1.12, 1.18, abs(P.z))); c = mix(c, c * .78, step(.5, fract(P.x * 9.)) * .15); }
    if (!wing && !fin) { float side = step(.5, abs(P.z) / .115), id = floor(P.x * 30.) + step(0., P.z) * 97.;
      float wr = step(.012, P.y) * step(P.y, .04) * side * step(fract(P.x * 30.), .42) * step(-.95, P.x) * step(P.x, .98);
      float up = step(.124, P.y) * step(P.y, .142) * step(.045, abs(P.z)) * step(fract(P.x * 30.), .42) * step(.45, P.x) * step(P.x, 1.06);
      float ck = step(1.1, P.x) * step(P.x, 1.2) * step(.128, P.y) * step(P.y, .156) * step(abs(P.z), .07);
      float door = step(.925, P.x) * step(P.x, .99) * step(-.035, P.y) * step(P.y, .075) * step(P.z, -.08);
      float win = max(max(wr, up), ck); c = mix(c, vec3(.02), win * .92); c = mix(c, vec3(.01), door);
      // something aboard is awake: a scatter of lit windows, the cockpit instruments, the open door
      float lit = step(.74, hh(vec2(id, 3.7))) * (.6 + .4 * sin(uTime * (1.3 + hh(vec2(id, 1.1)) * 3.) + id)) * (.75 + .25 * step(.5, fract(uTime * .37 + hh(vec2(id, 9.)))));
      wGlow = vec3(1., .66, .32) * (max(wr, up) * lit + door * (.8 + .2 * sin(uTime * 7.))) + vec3(.25, .9, .7) * ck * .5; }
    // decades of rain: the paint chalks and fades, flakes to yellow-green primer, rusts from the bottom and the breaks, streaks, and grows moss
    float n1 = fbm(P.xz * 7. + P.y * 5.), n2 = fbm(P.xy * 13. + 3.1), n3 = vn(P.xy * 46. + P.z * 9.), low = smoothstep(.05, -.1, P.y);
    c = mix(c, c * .7 + vec3(.1, .09, .08), .3);
    float flake = smoothstep(.5, .56, n1 * .75 + n3 * .25 + low * .25), rust = smoothstep(.56, .7, n1 * .7 + n3 * .3 + low * .35);
    c = mix(c, vec3(.3, .33, .1), flake * (1. - rust)); vec3 rc = mix(vec3(.24, .08, .025), vec3(.42, .17, .05), n2) * (.7 + .5 * n3); c = mix(c, rc, rust); rRust = max(rust, flake * .6);
    float streak = smoothstep(.55, .9, vn(vec2(P.x * 70. + P.z * 30., P.y * 2.5))) * (1. - abs(normalize(vNW).y)); c *= 1. - .45 * streak;
    float moss = smoothstep(.55, .95, normalize(vNW).y) * smoothstep(.45, .68, n2 + .15 * n3); c = mix(c, vec3(.05, .11, .025) * (.7 + .6 * n3), moss); rRust = max(rRust, moss);
    if (!gl_FrontFacing) { c = vec3(.035, .028, .02) * (.6 + .5 * step(.5, fract(P.x * 18.))); rRust = 1.; wGlow = vec3(1., .55, .25) * .35 * smoothstep(.5, .0, abs(P.x + .44)); }
    c = mix(c, c * .7, uWet * .5); diffuseColor.rgb = c; }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(mix(.55, .32, mMetal), .95, rRust) * mix(1., .7, uWet);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mix(mix(.15, .75, mMetal), .05, rRust);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += wGlow * uMy * 2.2;'); };
  liv.customProgramCacheKey = () => 'liv747';
  const fanM = new THREE.MeshStandardMaterial({ color: '#1a1816', metalness: .7, roughness: .5 }); MATS.push(fanM);
  const humpH = x => .052 * sm((x - .22) / .5) * (x > 1.04 ? Math.sqrt(Math.max(0, 1 - ((x - 1.04) / .3) ** 2)) : 1);
  const fusR = x => x > 1.0 ? R0 * Math.pow(Math.max(0, 1 - Math.pow((x - 1.0) / .35, 2.4)), .5) : x < -.72 ? R0 * (1 - .9 * Math.pow((-.72 - x) / .63, 1.5)) : R0;
  const fusY = x => x < -.72 ? .055 * ((-.72 - x) / .63) ** 2 : x > 1.0 ? -.012 * ((x - 1.0) / .35) ** 2 : 0;
  const loft = (x0, x1, jag0, jag1) => { const NS = Math.max(4, Math.round((x1 - x0) * (LO ? 34 : 50))), NA = LO ? 28 : 40, pos = [], idx = [];
    for (let i = 0; i <= NS; i++) { const x = lerp(x0, x1, i / NS), r = fusR(x), yc = fusY(x), hu = humpH(x);
      for (let j = 0; j < NA; j++) { const th = j / NA * TAU, c = Math.cos(th), s = Math.sin(th); let xx = x;
        if ((i === 0 && jag0) || (i === NS && jag1)) xx += (i === 0 ? -1 : 1) * (.015 + .05 * Math.abs(Math.sin(th * 5.3 + x * 9)) + R() * .035);
        pos.push(xx, yc + r * c + hu * Math.pow(Math.max(0, c), 1.6), r * s * (1 + hu / R0 * .25 * Math.max(0, c))); } }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) { const a = i * NA + j, b = i * NA + (j + 1) % NA, c2 = a + NA, d2 = b + NA; idx.push(a, b, c2, b, d2, c2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  const plan = (pts, th) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => s.lineTo(p[0], p[1])); s.lineTo(pts[0][0], pts[0][1]); return new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: .004, bevelSize: .006, bevelSegments: 1 }); };
  const wingG = sd => { const g = plan([[.32, 0], [-.64, 1.25 * sd], [-.8, 1.25 * sd], [-.44, .42 * sd], [-.3, 0]], .03); g.rotateX(Math.PI / 2); g.translate(0, .015, 0); g.rotateX(-sd * .1); g.translate(0, -.07, 0); return g; };
  const wingY = a => -.07 + a * .1;
  const engine = (z, L, F) => { const a = Math.abs(z), x = LE(a) + .06, y = wingY(a) - .085;
    L.push(new THREE.CylinderGeometry(.045, .053, .27, 22, 1, true).rotateZ(-Math.PI / 2).translate(x, y, z), new THREE.TorusGeometry(.052, .009, 6, 22).rotateY(Math.PI / 2).translate(x + .135, y, z),
      new THREE.ConeGeometry(.032, .08, 14).rotateZ(Math.PI / 2).translate(x - .17, y, z), new THREE.BoxGeometry(.2, .06, .014).translate(x - .04, y + .05, z));
    F.push(new THREE.CircleGeometry(.047, 22).rotateY(Math.PI / 2).translate(x + .1, y, z), new THREE.ConeGeometry(.016, .04, 12).rotateZ(-Math.PI / 2).translate(x + .12, y, z)); };
  const fairings = (sd, L) => [.24, .52, .8, 1.02].forEach(a => L.push(new THREE.SphereGeometry(1, 10, 6).scale(.075, .012, .014).translate(TE(a) + .015, wingY(a) - .02, a * sd)));
  const finG = () => plan([[-.74, .09], [-1.1, .53], [-1.3, .53], [-1.32, .06]], .022).translate(0, 0, -.011);
  const stabG = sd => { const g = plan([[-1.02, 0], [-1.25, .48 * sd], [-1.36, .48 * sd], [-1.33, 0]], .018); g.rotateX(Math.PI / 2); g.translate(0, .045, 0); return g; };
  const bake = list => mergeGeometries(list.map(g => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; }));
  const plane = new THREE.Group(); island.add(plane);
  const fwd = new THREE.Group(), aft = new THREE.Group(); plane.add(fwd, aft);
  { const L = [loft(-.42, 1.35, true, false), wingG(1), wingG(-1)], F = []; engine(-.42, L, F); engine(.42, L, F); engine(.78, L, F); fairings(1, L); fairings(-1, L);
    const m = new THREE.Mesh(bake(L), liv), f = new THREE.Mesh(bake(F), fanM); m.castShadow = m.receiveShadow = f.castShadow = true; fwd.add(m, f); }
  { const L = [loft(-1.35, -.47, false, true), finG(), stabG(1), stabG(-1)]; const m = new THREE.Mesh(bake(L), liv); m.castShadow = m.receiveShadow = true; aft.add(m); }
  const yaw = Math.atan2(-PN[1], PN[0]), gy = hAt(PO[0], PO[1]);
  fwd.scale.setScalar(SP); fwd.position.set(PO[0], gy + R0 * SP * .88, PO[1]); fwd.rotation.order = 'YXZ'; fwd.rotation.set(.05, yaw, -.025);
  aft.scale.setScalar(SP); aft.position.set(PO[0] - PN[0] * .16, gy + R0 * SP * .9, PO[1] - PN[1] * .16); aft.rotation.order = 'YXZ'; aft.rotation.set(-.12, yaw + .09, .03);
  // the port outboard engine, torn off, lying under the wing
  { const L = [], F = []; engine(0, L, F); const g = new THREE.Group(), m = new THREE.Mesh(bake(L), liv), f = new THREE.Mesh(bake(F), fanM); m.castShadow = f.castShadow = true; g.add(m, f); g.scale.setScalar(SP);
    const ex = PO[0] + SP * (.05 * PN[0] - .62 * PS[0]), ez = PO[1] + SP * (.05 * PN[1] - .62 * PS[1]); g.position.set(ex, hAt(ex, ez) + .22, ez); g.rotation.set(.35, yaw + .7, .25); island.add(g); }
  // the beacon still blinks; the tail strobe double-flashes; light leaks out of the break and the open door
  const beaconM = new THREE.MeshStandardMaterial({ color: '#200404', emissive: '#ff1a0c', emissiveIntensity: 0 }), strobeM = new THREE.MeshStandardMaterial({ color: '#202020', emissive: '#e8f0ff', emissiveIntensity: 0 }); MATS.push(beaconM, strobeM);
  add(new THREE.SphereGeometry(.009, 10, 8), beaconM, .1, R0 + .062, 0, fwd).castShadow = false; add(new THREE.SphereGeometry(.007, 10, 8), strobeM, -1.345, .052, 0, aft).castShadow = false;
  const breakL = new THREE.PointLight('#ffa050', 0, 3.2, 1.6); breakL.position.set(-.36, 0, 0); fwd.add(breakL);
  const doorL = new THREE.PointLight('#ffb060', 0, 2.2, 1.8); doorL.position.set(.96, .02, -.14); fwd.add(doorL);
  plane.updateMatrixWorld(true);

  /* ---------------- the forest ---------------- */
  const LEAVES = LEAF_RECTS;
  const DU = { uDist: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 1)) }, uGust: { value: 0 }, uMon: { value: new THREE.Vector4(0, 0, 1, 0) }, uShock: { value: new THREE.Vector4(0, 0, 0, 0) } };
  const leafMat = new THREE.MeshStandardMaterial({ map: T.leaf, alphaMap: T.leafA, alphaTest: .45, normalMap: T.leafN, side: THREE.DoubleSide, roughness: .5 }); MATS.push(leafMat);
  leafMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, DU); sh.vertexShader = 'uniform float uTime, uWind, uGust; uniform vec4 uDist[8]; uniform vec4 uMon, uShock;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
{ vec2 ip = instanceMatrix[3].xz; float ph = ip.x * 1.7 + ip.y * 2.3, sh = 0.; for (int i = 0; i < 8; i++) { vec4 d = uDist[i]; sh += d.z * (1. - smoothstep(0., d.w, distance(ip, d.xy))); } sh = min(sh, 1.8) + uGust * (.5 + .5 * sin(ip.x * .9 + ip.y * .7 - uTime * 2.6));
  float sc = length(instanceMatrix[0].xyz), k = (.3 + uWind * .7); vec2 mo = ip - uMon.xy; float md = length(mo), mf = uMon.w * (1. - smoothstep(0., uMon.z, md)); sh += mf * 1.5;
  float sd = distance(ip, uShock.xy), bq = (sd - uShock.z) / .45, band = exp(-bq * bq) * uShock.w;
  transformed.x += sin(uTime * 1.3 + ph + position.y * 2.) * .05 * k * position.y + sh * sin(uTime * 21. + ph * 3.) * .2;
  transformed.z += cos(uTime * 1.1 + ph) * .04 * k * position.y + sh * cos(uTime * 17. + ph * 5.) * .16; transformed.y += sh * sin(uTime * 13. + ph) * .08;
  if (mf + band > .002) { vec2 push = normalize(mo + vec2(.0001)) * mf * .9 + normalize(ip - uShock.xy + vec2(.0001)) * band * 1.2; float inv = 1. / max(sc, .05);
    transformed.x += push.x * inv * (.4 + .6 * clamp(position.y + .5, 0., 1.)); transformed.z += push.y * inv * (.4 + .6 * clamp(position.y + .5, 0., 1.)); transformed.y -= (mf * .5 + band * .4) * inv * .3; } }
#endif`); };
  leafMat.customProgramCacheKey = () => 'amazonLeaf2';
  const barkM = new THREE.MeshStandardMaterial({ map: T.bark, normalMap: T.barkN, roughness: .92, color: '#9a8e7e' }); MATS.push(barkM);
  const GR = ['#3e5e2a', '#4f6e30', '#5f7a3a', '#2e4a26', '#6a8a3e', '#7a9440', '#8aa04a', '#3a5a3a', '#2a4a30', '#577a2a', '#9aa850', '#4a6a48', '#365a40', '#6e8a30', '#a0aa58', '#2c3e24'];
  const okGround = (x, z) => { const h = hAt(x, z); if (h < .1 || Math.abs(x) > 4.92 || Math.abs(z) > 4.92) return 0; if (riverD(x, z) < .36 || Math.hypot(x - POOL[0], z - POOL[1]) < .72) return 0;
    if (normAt(x, z).y < .5) return 0; if (Math.hypot(x - CIT[0], z - CIT[1]) < 1.0) return 0; if (Math.abs(tOf(x, z) - STt) < .2 && dOf(x, z) > 1.1 && dOf(x, z) < 3.6) return 0; return 1; };
  const crowns = [], trunks = [], step = LO ? .26 : .2;
  for (let gx = -H5; gx <= H5; gx += step) for (let gz = -H5; gz <= H5; gz += step) { const x = gx + rnd(-.4, .4) * step, z = gz + rnd(-.4, .4) * step; if (!okGround(x, z)) continue;
    const pd = planeD(x, z), uw = underWing(x, z), h = hAt(x, z), tk = terrK(x, z), hill = sm((h - 1.0) / 1.2); if (pd < .6 || uw) continue;
    const front = dOf(x, z) < AXD + .45 - N.fbm(tOf(x, z) * .8, 5) * .4, near = pd < 1.1 || front; if (tk > .5 && R() > .1) continue; if (front && R() > .55) continue;
    const s = (near || tk > .5 ? rnd(.08, .15) : rnd(.16, .28)) * (LO ? 1.12 : 1) * lerp(1, .8, hill), th = (near || tk > .5 ? rnd(.1, .3) : rnd(.45, .8)) * lerp(1, .6, hill);
    crowns.push([x, h + th, z, s, R() < .018 ? (R() < .5 ? '#d0a830' : '#c86a9a') : pick(GR), .62]); trunks.push([x, h - .02, z, th + s * .2, s * .07]); }
  const EMG = []; for (let t = 0; t < 4000 && EMG.length < 12; t++) { const x = rnd(-4.6, 4.6), z = rnd(-4.6, 4.6); if (!okGround(x, z) || planeD(x, z) < 1.5 || underWing(x, z, .4) || dOf(x, z) < AXD + 1.1 || hAt(x, z) > 1.2 || EMG.some(e => Math.hypot(e[0] - x, e[2] - z) < 1.1)) continue;
    const h = hAt(x, z), th = rnd(1.3, 1.65), s = rnd(.42, .58); EMG.push([x, h, z, th, s]); crowns.push([x, h + th, z, s, pick(GR.slice(0, 8)), .42]); trunks.push([x, h - .02, z, th + s * .1, .045]); }
  // two trees grew up through the starboard wing
  [[-.25, .62], [-.42, .95]].forEach(([lx, lz]) => { const x = PO[0] + SP * (lx * PN[0] + lz * PS[0]), z = PO[1] + SP * (lx * PN[1] + lz * PS[1]), h = hAt(x, z), th = rnd(1.0, 1.2); crowns.push([x, h + th, z, rnd(.24, .3), pick(GR), .6]); trunks.push([x, h - .02, z, th, .022]); });
  const jungleCrown = (n, lumps = 3) => { const parts = []; for (let k = 0; k < lumps; k++) { const g = crownGeometry(LEAVES, n, [.075, .7], [.34, .62], .8), a = k / lumps * TAU + rnd(-.4, .4), r = k ? rnd(.38, .55) : 0, sc = k ? rnd(.6, .78) : 1;
      g.scale(sc, sc, sc); g.translate(Math.cos(a) * r, k ? rnd(-.2, .05) : 0, Math.sin(a) * r); parts.push(g); } return mergeGeometries(parts); };
  const CG = 48, CTOP = new Float32Array(CG * CG); // canopy-top height grid, for the monkeys to land on
  for (let j = 0; j < CG; j++) for (let i = 0; i < CG; i++) { const x = (i + .5) / CG * S - H5, z = (j + .5) / CG * S - H5; CTOP[j * CG + i] = hAt(x, z) + .05; if (planeD(x, z) < .3) CTOP[j * CG + i] = gy + R0 * SP * 1.9; }
  { const im = new THREE.InstancedMesh(jungleCrown(LO ? 30 : 50), leafMat, crowns.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    crowns.forEach(([x, y, z, s, ci, fl], i) => { const sy = s * fl * rnd(.85, 1.15); q.setFromEuler(new THREE.Euler(rnd(-.15, .15), rnd(TAU), rnd(-.15, .15))); m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, sy, s)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(ci).multiplyScalar(rnd(.8, 1.15)));
      const i0 = Math.floor((x - s + H5) / S * CG), i1 = Math.floor((x + s + H5) / S * CG), j0 = Math.floor((z - s + H5) / S * CG), j1 = Math.floor((z + s + H5) / S * CG);
      for (let jj = Math.max(0, j0); jj <= Math.min(CG - 1, j1); jj++) for (let ii = Math.max(0, i0); ii <= Math.min(CG - 1, i1); ii++) CTOP[jj * CG + ii] = Math.max(CTOP[jj * CG + ii], y + sy * .8); });
    im.castShadow = im.receiveShadow = true; island.add(im);
    const tm = new THREE.InstancedMesh(new THREE.CylinderGeometry(.6, 1, 1, 6).translate(0, .5, 0), barkM, trunks.length + EMG.length * 4);
    trunks.forEach(([x, y, z, hh, r], i) => { m.compose(new THREE.Vector3(x, y, z), q.identity(), new THREE.Vector3(r, hh, r)); tm.setMatrixAt(i, m); });
    EMG.forEach(([x, h, z], k) => { for (let b = 0; b < 4; b++) { const a = b / 4 * TAU + rnd(-.3, .3); q.setFromEuler(new THREE.Euler(0, -a, 0)); m.compose(new THREE.Vector3(x + Math.cos(a) * .04, h - .02, z + Math.sin(a) * .04), q, new THREE.Vector3(.09, .3, .015)); tm.setMatrixAt(trunks.length + k * 4 + b, m); } });
    tm.castShadow = tm.receiveShadow = true; island.add(tm); }
  const canopyTop = (x, z) => { const i = clamp(Math.floor((x + H5) / S * CG), 0, CG - 1), j = clamp(Math.floor((z + H5) / S * CG), 0, CG - 1); return CTOP[j * CG + i]; };
  { const spots = []; for (let t = 0; t < 3000 && spots.length < 30 * QN + 8; t++) { const x = rnd(-4.8, 4.8), z = rnd(-4.8, 4.8), rd = Math.min(riverD(x, z), Math.hypot(x - POOL[0], z - POOL[1]) - .3); if (rd < .4 || rd > .8 || hAt(x, z) < .1 || normAt(x, z).y < .7 || planeD(x, z) < .6) continue; spots.push([x, hAt(x, z) - .01, z, rnd(.5, .8)]); }
    const [tr, fr] = palmGeometry(spots, { fronds: 9 }); if (tr) { const a = new THREE.Mesh(tr, barkM), b = new THREE.Mesh(fr, leafMat); a.castShadow = b.castShadow = true; island.add(a, b); } }
  // the forest reclaiming the jet: vines in curtains off the wings and fuselage, long ones from the wingtip into the void; shrubs rooted in the dirt on the wings
  { const vp = [], sh = [], m = new THREE.Matrix4(), qq = new THREE.Quaternion(), upv = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3();
    const vine = (p, out, L) => { const n = Math.max(3, Math.round(L / .05)); for (let j = 0; j < n; j++) { const f = j / n, lf = out.clone().multiplyScalar(.5).add(new THREE.Vector3(rnd(-.5, .5), -.7, rnd(-.5, .5))).normalize(); qq.setFromUnitVectors(upv, lf);
      m.compose(new THREE.Vector3(p.x + out.x * (.02 + f * .04) + Math.sin(f * 9) * .015, p.y - f * L, p.z + out.z * (.02 + f * .04)), qq, new THREE.Vector3(1, 1, 1)); vp.push(leafQuad(.06, .12 * (1 - f * .35), pick(LEAVES), m)); } };
    for (let k = 0; k < (LO ? 70 : 120); k++) { const sd = R() < .6 ? -1 : 1, a = rnd(.15, 1.25), edge = R() < .5, lx = edge ? LE(a) : TE(a); v.set(lx, wingY(a) - .015, a * sd); fwd.localToWorld(v);
      const outside = Math.abs(v.x) > 4.95 || Math.abs(v.z) > 4.95; vine(v.clone(), new THREE.Vector3(PN[0] * (edge ? 1 : -1), 0, PN[1] * (edge ? 1 : -1)), outside ? rnd(.6, 2.2) : Math.min(rnd(.1, .4), Math.max(.06, v.y - hAt(v.x, v.z)))); }
    for (let k = 0; k < (LO ? 40 : 70); k++) { const lx = rnd(-.4, 1.1), sd = R() < .5 ? -1 : 1; v.set(lx, R0 * .7 + humpH(lx) * .6, sd * R0 * .6); fwd.localToWorld(v); vine(v.clone(), new THREE.Vector3(PS[0] * sd, 0, PS[1] * sd), rnd(.15, .45)); }
    for (let k = 0; k < 30; k++) { const lx = rnd(-1.25, -.5), sd = R() < .5 ? -1 : 1; v.set(lx, fusY(lx) + fusR(lx) * .7, sd * fusR(lx) * .6); aft.localToWorld(v); vine(v.clone(), new THREE.Vector3(PS[0] * sd, 0, PS[1] * sd), rnd(.15, .4)); }
    for (let k = 0; k < (LO ? 26 : 44); k++) { const sd = R() < .5 ? -1 : 1, a = rnd(.2, 1.1), lx = lerp(TE(a), LE(a), rnd(.15, .85)); v.set(lx, wingY(a) + .02, a * sd); fwd.localToWorld(v); sh.push([v.x, v.y, v.z, rnd(.05, .13)]); }
    for (let k = 0; k < 12; k++) { const lx = rnd(-.38, .2); v.set(lx, R0 + .01, rnd(-.03, .03)); fwd.localToWorld(v); sh.push([v.x, v.y, v.z, rnd(.06, .12)]); }
    const vm = new THREE.Mesh(mergeGeometries(vp), leafMat); vm.castShadow = true; island.add(vm);
    const im = new THREE.InstancedMesh(crownGeometry(LEAVES, 36), leafMat, sh.length), c = new THREE.Color(); sh.forEach(([x, y, z, s], i) => { m.compose(new THREE.Vector3(x, y + s * .3, z), qq.setFromEuler(new THREE.Euler(0, rnd(TAU), 0)), new THREE.Vector3(s, s * .7, s)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(pick(GR))); }); im.castShadow = true; island.add(im); }

  /* ---------------- the falls and the stream above them ---------------- */
  const FLOW = { value: 1 }, LIP = XZ(LIPt, LIPd + .02);
  let notchTop = 0; for (let k = 0; k < 8; k++) { const [x, z] = XZ(LIPt + rnd(-.1, .1), LIPd + .1 + k * .1); notchTop = Math.max(notchTop, hAt(x, z)); }
  makeFalls(ctx, { x: LIP[0], z: LIP[1], ry: Math.PI / 4, top: notchTop + .05, bottom: WL, width: .38, reach: .3, tint: [.78, .84, .8], flood: [.6, .48, .3], flow: FLOW, foamR: .55, mist: LO ? 220 : 340, mistS: 1.4, rise: 1.7, mistA: .2 });
  { const flowM = new THREE.MeshStandardMaterial({ color: '#4a5a3a', roughness: .08, metalness: .1, normalMap: tex('water_nor.jpg', false), normalScale: new THREE.Vector2(.5, .5), transparent: true, opacity: .9 }); MATS.push(flowM);
    flowM.onBeforeCompile = sh => { sh.uniforms.uT = U.uTime; sh.fragmentShader = 'uniform float uT;\n' + sh.fragmentShader.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec2 fuv = vNormalMapUv * vec2(1.5, 4.); vec3 mapN = normalize((texture2D(normalMap, fuv + vec2(0., -uT * .35)).xyz * 2. - 1.) + (texture2D(normalMap, fuv * 1.7 + vec2(.3, -uT * .55)).xyz * 2. - 1.));'); };
    const [cx, cz] = XZ(LIPt, LIPd + .5); const st = new THREE.Mesh(new THREE.PlaneGeometry(.42, .95).rotateX(-Math.PI / 2), flowM); st.position.set(cx, notchTop + .05, cz); st.rotation.y = Math.PI / 4; island.add(st);
    const [hx, hz] = XZ(LIPt, 2.72); const cave = new THREE.Mesh(new THREE.CircleGeometry(.24, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#050403' })); cave.position.set(hx, notchTop + .04, hz); cave.rotation.y = Math.PI / 4; island.add(cave); }

  /* ---------------- shafts of low gold light through the humid air ---------------- */
  const SHU = { uT: U.uTime, uK: { value: 1 } };
  const shaftM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: SHU,
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vP; void main(){ vY = uv.y; vec4 wp = modelMatrix * vec4(position, 1.); vP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: `uniform float uT, uK; varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vP;\n${GLSL_NOISE}
      void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 2.2) * smoothstep(0., .1, vY) * (1. - smoothstep(.3, 1., vY)) * (.55 + .45 * vn(vec2(vP.x * 2.5 + vP.z * 1.7, vP.y * 1.5 - uT * .25)));
        gl_FragColor = vec4(vec3(1., .74, .4) * a * uK * .1, 1.); }` });
  const shaftG = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, .5, 0);
  const shafts = [[0, -.9], [.35, .35], [-.2, 1.0], [-.8, -.2], [-1.2, .55]].map(([lx, lz]) => { const x = PO[0] + SP * (lx * PN[0] + lz * PS[0]), z = PO[1] + SP * (lx * PN[1] + lz * PS[1]); const m = new THREE.Mesh(shaftG, shaftM); m.position.set(x, hAt(x, z), z); m.scale.set(rnd(.18, .34), 6, rnd(.18, .34)); m.renderOrder = 6; m.frustumCulled = false; island.add(m); return m; });
  { const m = new THREE.Mesh(shaftG, shaftM); m.position.set(POOL[0], 0, POOL[1]); m.scale.set(.3, 6, .3); m.renderOrder = 6; m.frustumCulled = false; island.add(m); shafts.push(m); }

  /* ---------------- particles: mist, falling leaves, fireflies, smoke and fire ---------------- */
  const PX = { value: 1 };
  const fogN = Math.round(130 * QN), fg = new THREE.BufferGeometry(), fp = new Float32Array(fogN * 3), fs = new Float32Array(fogN);
  for (let i = 0; i < fogN; i++) { const ridge = R() < .35; fp.set([rnd(-4.8, 4.8), ridge ? rnd(2.1, 3.4) : rnd(.75, 1.35), rnd(-4.8, 4.8)], i * 3); fs[i] = R(); }
  fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('sd', new THREE.BufferAttribute(fs, 1));
  const FOG = { uT: U.uTime, uWind: U.uWind, uSun: U.uSun, uPx: PX, uA: { value: .5 } };
  const fog = new THREE.Points(fg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: FOG,
    vertexShader: 'attribute float sd; uniform float uT, uWind, uPx; varying float vA; void main(){ vec3 q = position; q.x = mod(q.x + 4.8 + uT * (.02 + .03 * uWind) * (.6 + sd * .8), 9.6) - 4.8; q.z += sin(uT * .05 + sd * 40.) * .2; vA = smoothstep(4.8, 3.8, abs(q.x)) * smoothstep(4.9, 4.2, abs(q.z)) * (.5 + .5 * sd); vec4 mv = modelViewMatrix * vec4(q, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * (.7 + sd * .8) / -mv.z, 2., 380.); }',
    fragmentShader: 'uniform float uSun, uA; varying float vA; void main(){ float r2 = dot(gl_PointCoord - .5, gl_PointCoord - .5) * 4.; if (r2 > 1.) discard; gl_FragColor = vec4(vec3(.74, .86, .78) * (.25 + .7 * uSun), exp(-r2 * 2.6) * vA * uA * .055); }' }));
  fog.frustumCulled = false; fog.renderOrder = 5; island.add(fog);
  const ffN = Math.round(320 * QN), ffg = new THREE.BufferGeometry(), ffp = new Float32Array(ffN * 3), ffs = new Float32Array(ffN);
  { let i = 0; for (let t = 0; i < ffN && t < 40000; t++) { const x = rnd(-4.8, 4.8), z = rnd(-4.8, 4.8), h = hAt(x, z), edge = Math.min(riverD(x, z), planeD(x, z) - .3, Math.hypot(x - POOL[0], z - POOL[1])); if (h < .05 || edge > .9 || edge < 0 || h > 1.5) continue; ffp.set([x, h + rnd(.05, .5), z], i * 3); ffs[i] = R(); i++; } ffg.setDrawRange(0, i); }
  ffg.setAttribute('position', new THREE.BufferAttribute(ffp, 3)); ffg.setAttribute('sd', new THREE.BufferAttribute(ffs, 1));
  const flies = new THREE.Points(ffg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: U.uTime, uGlow: U.uGlow, uPx: PX },
    vertexShader: 'attribute float sd; uniform float uT, uPx; varying float vA; void main(){ vec3 q = position + vec3(sin(uT * .4 + sd * 30.), sin(uT * .7 + sd * 11.) * .5, cos(uT * .3 + sd * 20.)) * .08; vA = pow(max(0., sin(uT * (1.2 + sd) + sd * 50.)), 6.); vec4 mv = modelViewMatrix * vec4(q, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * .02 / -mv.z, 1.5, 8.); }',
    fragmentShader: 'uniform float uGlow; varying float vA; void main(){ float r = length(gl_PointCoord - .5) * 2.; if (r > 1.) discard; gl_FragColor = vec4(vec3(.75, 1., .3) * exp(-r * r * 3.) * vA * uGlow * 2.2, 1.); }' }));
  flies.frustumCulled = false; island.add(flies);
  // one soft-particle system for leaves, mist out of the break, smoke and debris; one additive system for fire and embers
  const sys = (n, additive) => { const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 4), s = new Float32Array(n); g.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('pc', new THREE.BufferAttribute(c, 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('ps', new THREE.BufferAttribute(s, 1).setUsage(THREE.DynamicDrawUsage)); g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uPx: PX, uSun: U.uSun },
      vertexShader: 'attribute vec4 pc; attribute float ps; uniform float uPx; varying vec4 vC; varying float vS; void main(){ vC = pc; vS = ps; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * abs(ps) / -mv.z, 1.5, 400.); }',
      fragmentShader: `uniform float uSun; varying vec4 vC; varying float vS; void main(){ vec2 d = gl_PointCoord - .5; float r2 = dot(d, d) * 4.; if (r2 > 1.) discard; float a = vS < 0. ? step(abs(d.x) + abs(d.y) * 1.8, .5) : exp(-r2 * 2.5);
        gl_FragColor = vec4(vC.rgb * ${additive ? '1.' : '(.35 + .65 * uSun)'}, a * vC.a); }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = additive ? 7 : 5; island.add(pts); const L = [];
    return { L, emit(o) { if (L.length < n) L.push(Object.assign({ age: 0, grow: 0, drag: 0, buoy: 0, grav: 0, a: 1 }, o)); },
      step(dt, t) { let k = 0; for (let i = L.length - 1; i >= 0; i--) { const q = L[i]; q.age += dt; if (q.age > q.life) { L[i] = L[L.length - 1]; L.pop(); continue; }
          q.vy += (q.buoy - q.grav) * dt; const dr = 1 - q.drag * dt; q.vx *= dr; q.vy *= dr; q.vz *= dr; if (q.flutter) { q.vy = Math.max(q.vy, -.35); q.x += Math.sin(t * 3 + q.ph) * .12 * dt; q.z += Math.cos(t * 2.6 + q.ph) * .1 * dt; }
          q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (q.ground && Math.abs(q.x) < 5 && Math.abs(q.z) < 5) { const g2 = hAt(q.x, q.z); if (q.y < g2) { q.y = g2; q.vx = q.vz = q.vy = 0; } } }
        for (const q of L) { const f = q.age / q.life, col = q.ramp ? q.ramp(f) : q.c; p[k * 3] = q.x; p[k * 3 + 1] = q.y; p[k * 3 + 2] = q.z; c[k * 4] = col[0]; c[k * 4 + 1] = col[1]; c[k * 4 + 2] = col[2]; c[k * 4 + 3] = q.a * Math.min(1, q.age * (q.fadeIn || 4)) * (1 - sm((f - .6) / .4)); s[k] = q.size * (1 + f * q.grow) * (q.flat ? -1 : 1); k++; }
        g.setDrawRange(0, k); g.attributes.position.needsUpdate = g.attributes.pc.needsUpdate = g.attributes.ps.needsUpdate = true; } }; };
  const SOFT = sys(LO ? 1400 : 2600, false), FIRE = sys(LO ? 500 : 900, true);
  const LEAFC = [[.22, .3, .08], [.3, .36, .1], [.38, .3, .1], [.16, .24, .07], [.45, .38, .12]];
  const dropLeaves = (x, z, n, y0) => { for (let i = 0; i < n; i++) SOFT.emit({ x: x + rnd(-.3, .3), y: y0 + rnd(-.1, .15), z: z + rnd(-.3, .3), vx: rnd(-.15, .15), vy: rnd(-.05, .25), vz: rnd(-.15, .15), grav: .5, ph: rnd(TAU), flutter: 1, ground: 1, life: rnd(2.5, 4.5), c: pick(LEAFC), size: .018, flat: 1 }); };
  const breakW = new THREE.Vector3(-.43, .02, 0); fwd.localToWorld(breakW);

  /* ---------------- macaws and the monkey troop ---------------- */
  const wingGeo = span => { const p = [], wg = []; const tri = (a, b, c, wa, wb, wc) => { p.push(...a, ...b, ...c); wg.push(wa, wb, wc); };
    [-1, 1].forEach(s => { tri([0, 0, -.05], [0, 0, .06], [s * span, .02, -.01], 0, 0, 1); tri([0, 0, .06], [s * span, .02, -.01], [s * span * .53, .01, .08], 0, 1, .55); });
    tri([0, .015, -.16], [-.04, 0, .1], [.04, 0, .1], 0, 0, 0); tri([0, -.012, -.16], [.04, 0, .1], [-.04, 0, .1], 0, 0, 0); tri([-.03, 0, .1], [.03, 0, .1], [0, 0, .36], 0, 0, 0);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('wing', new THREE.Float32BufferAttribute(wg, 1)); g.computeVertexNormals(); return g; };
  const birdM = new THREE.MeshStandardMaterial({ roughness: .7, side: THREE.DoubleSide }); MATS.push(birdM);
  birdM.onBeforeCompile = sh => { sh.uniforms.uT = U.uTime; sh.vertexShader = 'attribute float wing; uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7; float f = sin(uT * 11. + ph); transformed.y += wing * f * .3; transformed.x *= 1. - wing * abs(f) * .12; }'); };
  const NBIRD = 14, macaws = new THREE.InstancedMesh(wingGeo(.45), birdM, NBIRD); macaws.frustumCulled = false; macaws.castShadow = true; island.add(macaws); ctx.life(macaws, 1);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0); { const c = new THREE.Color(); for (let i = 0; i < NBIRD; i++) { macaws.setColorAt(i, c.set(i % 3 === 2 ? '#2a6ad8' : i % 3 === 1 ? '#e8b020' : '#d81a14')); macaws.setMatrixAt(i, ZERO); } }
  const flocks = [];
  const monkeyG = (() => { const parts = [], E2 = (rx, ry, rz, x, y, z) => new THREE.SphereGeometry(1, 10, 7).scale(rx, ry, rz).translate(x, y, z), limb = (a, b, r) => { const v = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), l = v.length(), g = new THREE.CylinderGeometry(r * .8, r, l, 6); g.translate(0, l / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize())); g.translate(...a); return g; };
    parts.push(E2(.22, .12, .1, 0, 0, 0), E2(.09, .085, .085, .27, .05, 0), E2(.045, .035, .04, .34, .03, 0));
    [-1, 1].forEach(s => { parts.push(limb([.12, 0, s * .07], [.42, -.04, s * .2], .03), limb([-.12, 0, s * .06], [-.36, -.1, s * .16], .035)); });
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-.2, .02, 0], [-.45, .12, 0], [-.62, .05, 0], [-.66, -.08, 0], [-.58, -.15, 0]].map(p => new THREE.Vector3(...p))), 12, .02, 5));
    return mergeGeometries(parts.map(g => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; })); })();
  const monkM = new THREE.MeshStandardMaterial({ roughness: .85 }); MATS.push(monkM);
  const NMK = LO ? 12 : 18, monkeys = new THREE.InstancedMesh(monkeyG, monkM, NMK); monkeys.frustumCulled = false; monkeys.castShadow = true; island.add(monkeys);
  { const c = new THREE.Color(); for (let i = 0; i < NMK; i++) { monkeys.setColorAt(i, c.set(i % 5 === 4 ? '#8a5a2a' : pick(['#2a1c14', '#3a2618', '#1e1612']))); monkeys.setMatrixAt(i, ZERO); } }
  const MK = Array.from({ length: NMK }, () => ({ on: 0 }));
  let lastLand = 0; const landShake = (x, z) => { lastLand = (lastLand + 1) % 4; DU.uDist.value[4 + lastLand].set(x, z, 1.1, .4); };

  /* ---------------- sound ---------------- */
  const AU = makeAudio(); AU.onStart = A => { A.falls = A.loop('lowpass', 700, .5, .05); A.bugs = A.loop('bandpass', 4600, 6, .012); A.frogs = A.loop('bandpass', 1900, 9, .008); A.leaves = A.loop('bandpass', 1200, .6, 0); A.hum = A.loop('lowpass', 90, 2, 0); };
  const squawk = () => { for (let k = 0; k < 3; k++) { const f = rnd(900, 1400); AU.tone(f, f * .7, rnd(.18, .3), .035, k * rnd(.15, .3), 'sawtooth'); } };
  const howl = (g = 1) => { if (!AU.get()) return; for (let k = 0; k < 3; k++) { const w = k * rnd(.5, .9), f = rnd(110, 160); AU.tone(f, f * 1.25, rnd(1.2, 1.8), .06 * g, w, 'sawtooth'); AU.tone(f * 1.5, f * 1.3, rnd(1.1, 1.6), .03 * g, w + .05, 'square'); AU.burst(1.4, 500, .05 * g, 'bandpass', w); } };
  const screech = (g = 1) => { const n = 2 + Math.floor(R() * 3), w0 = rnd(0, .2); for (let k = 0; k < n; k++) { const f = rnd(1500, 2300); AU.tone(f, f * rnd(1.2, 1.6), rnd(.07, .12), .03 * g, w0 + k * rnd(.09, .14), 'square'); } };
  const chirp = (g = 1) => { const f = rnd(2600, 3600); for (let k = 0; k < 4; k++) AU.tone(f * (1 + k * .06), f * (1.15 + k * .05), .06, .018 * g, k * .09); };
  const rustle = (g = 1) => { AU.burst(rnd(.5, 1.1), rnd(1500, 2600), .06 * g, 'bandpass'); AU.burst(.25, 400, .05 * g, 'lowpass', rnd(.1, .4)); };
  const snap = (g = 1) => AU.burst(.05, rnd(3000, 5000), .08 * g, 'highpass');
  const thump = (g = 1) => { AU.tone(46, 28, .5, .3 * g); AU.burst(.4, 120, .18 * g, 'lowpass'); };
  const flush = (x, z, n = 5) => { if (ctx.MOD.life < 1 || flocks.length > 1) return; const base = flocks.reduce((s, f) => s + f.n, 0); if (base >= NBIRD) return; const a = rnd(TAU);
    flocks.push({ t: 0, x, z, dx: Math.cos(a), dz: Math.sin(a), b0: base, n: Math.min(n, NBIRD - base), off: Array.from({ length: NBIRD }, () => [rnd(-.35, .35), rnd(-.1, .15), rnd(-.4, .4), rnd(TAU)]) }); squawk(); };

  /* ---------------- the unseen ---------------- */
  const AG = [0, 1, 2, 3].map(() => ({ x: rnd(-3.5, 3.5), z: rnd(-3.5, 3.5), dir: rnd(TAU), sp: rnd(.5, 1.1), on: 0, k: 0, t: rnd(1, 6) }));
  const MA = new THREE.Vector2(...XZ(-1.3, .95)), MB = new THREE.Vector2(...XZ(1.6, .85)), MON = new THREE.Vector2().copy(MA);
  const blastL = new THREE.PointLight('#ffa040', 0, 14, 1.2); island.add(blastL);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd8a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); ring.visible = false; island.add(ring);
  const FIREC = f => [lerp(1.6, .5, f), lerp(1.0, .12, f), lerp(.4, .02, f)], SMOKEC = f => [lerp(.3, .2, f), lerp(.27, .19, f), lerp(.24, .18, f)];
  const blast = (x, z) => { const y = hAt(x, z) + .6; AU.boom(1.25); ctx.shake(1.6); ctx.flash(.55, '#ffd2a0'); ctx.skyU.uFlash.value = 1.6; blastL.position.set(x, y + .8, z); blastL.intensity = 900;
    for (let i = 0; i < (LO ? 260 : 460); i++) { const a = rnd(TAU), el = rnd(-.2, 1.2), v = rnd(.6, 2.2); FIRE.emit({ x: x + rnd(-.1, .1), y, z: z + rnd(-.1, .1), vx: Math.cos(a) * Math.cos(el) * v, vy: Math.sin(el) * v + rnd(.3, 1.2), vz: Math.sin(a) * Math.cos(el) * v, drag: 2.2, buoy: .9, life: rnd(.9, 2.2), size: rnd(.25, .6), grow: 2.2, ramp: FIREC, fadeIn: 30 }); }
    for (let i = 0; i < (LO ? 120 : 220); i++) { const a = rnd(TAU), v = rnd(1.5, 4); FIRE.emit({ x, y, z, vx: Math.cos(a) * v * rnd(.3, 1), vy: rnd(1.5, 4.5), vz: Math.sin(a) * v * rnd(.3, 1), grav: 2.2, drag: .3, life: rnd(1.5, 3.5), size: rnd(.025, .05), c: [1.6, .7, .2], fadeIn: 30 }); }
    for (let i = 0; i < (LO ? 160 : 300); i++) { const a = rnd(TAU), v = rnd(.2, 1.1); SOFT.emit({ x: x + rnd(-.3, .3), y: y + rnd(0, .6), z: z + rnd(-.3, .3), vx: Math.cos(a) * v, vy: rnd(.4, 1.4), vz: Math.sin(a) * v, drag: .8, buoy: .25, life: rnd(6, 11), size: rnd(.4, .9), grow: 2.5, ramp: SMOKEC, a: .55, fadeIn: 2 }); }
    for (let i = 0; i < 120; i++) { const a = rnd(TAU), v = rnd(.8, 2.5); SOFT.emit({ x, y, z, vx: Math.cos(a) * v, vy: rnd(1, 3.5), vz: Math.sin(a) * v, grav: 2.4, ground: 1, life: rnd(2, 4), c: pick(LEAFC), size: .03, flat: 1 }); }
    ring.position.set(x, hAt(x, z) + 1.0, z); ring.visible = true; ring.userData.t = 0; DU.uShock.value.set(x, z, 0, 1.4); };
  let ev = null; const api = { ev: () => { AU.get(); ev = { t: 0, f: {} }; MK.forEach(m => { m.on = 0; }); AG.forEach(a => { a.seeded = 0; }); }, get evOn() { return !!ev; } };
  const v3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), m4 = new THREE.Matrix4(), eu = new THREE.Euler(0, 0, 0, 'YZX'), sc3 = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
  const FLEE = new THREE.Vector2(.82, -.15).normalize();
  const leap = (m, monX, monZ) => { let dx = FLEE.x + (m.x - monX) * .25 + rnd(-.45, .45), dz = FLEE.y + (m.z - monZ) * .25 + rnd(-.45, .45); const l = Math.hypot(dx, dz); dx /= l; dz /= l; const len = rnd(.55, 1.0);
    m.x0 = m.x; m.z0 = m.z; m.y0 = m.y; m.x1 = m.x + dx * len; m.z1 = m.z + dz * len; m.y1 = Math.abs(m.x1) < 4.95 && Math.abs(m.z1) < 4.95 ? canopyTop(m.x1, m.z1) : m.y0 - .3; m.T = len / rnd(1.5, 2.0); m.hop = .32 + len * .4; m.t = 0; m.dir = Math.atan2(-dz, dx); };

  ctx.steps.push(dt => { const t = ctx.clock, M = ctx.MOD; PX.value = ctx.renderer.domElement.height / (2 * Math.tan(ctx.camera.fov * Math.PI / 360));
    const e = ev ? ev.t : -1, quiet = ev ? sm((e - 9.6) / .3) * (1 - sm((e - 15) / 6)) : 0, frenzy = ev ? sm((e - 3.2) / .8) * (1 - sm((e - 9.4) / .3)) : 0;
    // the jet: a few windows burn, the beacon blinks, light leaks from the break and mist seeps out of it
    const gl = U.uGlow.value, dark = 1 - U.uSun.value; MY.uMy.value = (.25 + gl * .75) * (.6 + .4 * dark) * (ev && e > 9.6 && e < 10.4 ? (R() < .5 ? 0 : 2) : 1);
    beaconM.emissiveIntensity = (t % 1.7 < .14 ? 9 : 0) * (.4 + gl * .6); strobeM.emissiveIntensity = ((t % 2.6 < .05) || (t % 2.6 > .16 && t % 2.6 < .21) ? 14 : 0) * (.3 + gl * .7);
    breakL.intensity = (1.2 + Math.sin(t * 5.3) * .25 + (R() < .03 ? -.8 : 0)) * (.4 + gl * .8); doorL.intensity = (.9 + Math.sin(t * 7) * .1) * (.4 + gl * .8);
    if (R() < dt * 5 * QN) SOFT.emit({ x: breakW.x + rnd(-.15, .15), y: breakW.y + rnd(-.15, .1), z: breakW.z + rnd(-.15, .15), vx: rnd(-.08, .08) + PN[0] * .05, vy: rnd(.02, .08), vz: rnd(-.08, .08) + PN[1] * .05, drag: .3, buoy: .02, life: rnd(4, 7), size: rnd(.35, .7), grow: 1.5, c: [.82, .86, .82], a: .12, fadeIn: 1 });
    // light shafts follow the sun
    v3.copy(ctx.cur.dir); v3.set(v3.x * .45, Math.max(v3.y, .2) + .75, v3.z * .45).normalize(); q4.setFromUnitVectors(UPV, v3); shafts.forEach(s => s.quaternion.copy(q4)); SHU.uK.value = lerp(SHU.uK.value, U.uSun.value * (.35 + ctx.cur.warm * 1.1) * (1 - M.clouds * .2) * (1 - quiet * .3), 1 - Math.exp(-dt));
    FOG.uA.value = lerp(FOG.uA.value, .45 + M.rain * .14 + M.clouds * .08 + quiet * .5, 1 - Math.exp(-dt));
    // the unseen, any time: crowns shake over something moving beneath, leaves come down, birds go up
    const nAct = ev && e < 16 ? 4 : [0, 1, 2, 4][M.life];
    AG.forEach((a, i) => { const live = i < nAct; a.t -= dt; if (a.t < 0) { a.on = live && !a.on ? 1 : 0; a.t = a.on ? rnd(2, 4.5) : rnd(3, 9) * (ev ? .3 : 1);
        if (a.on && !ev) { a.dir = rnd(TAU); const r = R(); if (r < .3) howl(.8); else if (r < .6) flush(a.x, a.z); rustle(); } }
      if (ev && e < 3.2) { a.on = 1; if (!a.seeded) { a.seeded = 1; a.x = MA.x + rnd(-1.4, 1.4); a.z = MA.y + rnd(-1.4, 1.4); } }
      if (ev && e > 9.6) a.on = 0;
      a.k = lerp(a.k, a.on ? 1 : 0, 1 - Math.exp(-dt * 4));
      if (a.on) { a.dir += rnd(-1, 1) * dt * 2.5; const nx = a.x + Math.cos(a.dir) * a.sp * dt, nz = a.z + Math.sin(a.dir) * a.sp * dt; if (okGround(nx, nz) && planeD(nx, nz) > .6) { a.x = nx; a.z = nz; } else a.dir += Math.PI * rnd(.6, 1.4);
        if (R() < dt * 9) dropLeaves(a.x, a.z, 2, hAt(a.x, a.z) + .8); }
      DU.uDist.value[i].set(a.x, a.z, a.k * (.75 + .25 * Math.sin(t * 7 + i)) * (ev && e < 3.5 ? .4 + e / 3.5 : 1), .55); });
    for (let i = 4; i < 8; i++) DU.uDist.value[i].z *= Math.exp(-dt * 5);
    if (AU.ctx) { const ct = AU.ctx.currentTime, calm = 1 - quiet; AU.leaves.gain.setTargetAtTime((AG.reduce((s, a) => s + a.k, 0) * .02 + frenzy * .08) * calm, ct, .2); AU.falls.gain.setTargetAtTime(.05 * FLOW.value * (1 - quiet * .6), ct, .4);
      AU.bugs.gain.setTargetAtTime(.012 * calm * (1 - frenzy * .5), ct, quiet > .5 ? .05 : 1.5); AU.frogs.gain.setTargetAtTime(.008 * calm, ct, quiet > .5 ? .05 : 2); AU.hum.gain.setTargetAtTime(ev && e > 2 && e < 9.6 ? .06 + frenzy * .08 : 0, ct, .3); }
    // macaws
    for (let k = flocks.length - 1; k >= 0; k--) { const f = flocks[k]; f.t += dt; const yawB = Math.atan2(-f.dz, f.dx) - Math.PI / 2;
      for (let i = 0; i < f.n; i++) { const [ox, oy, oz, ph] = f.off[i], d = f.t * 1.4 - oz, x = f.x + f.dx * d - f.dz * ox, z = f.z + f.dz * d + f.dx * ox, y = hAt(f.x, f.z) + .8 + Math.min(1, f.t * .9) * .9 + oy + Math.sin(t * 2 + ph) * .04;
        q4.setFromEuler(new THREE.Euler(-.15, yawB, Math.sin(t * 1.5 + ph) * .15)); m4.compose(v3.set(x, y, z), q4, sc3.setScalar(.32)); macaws.setMatrixAt(f.b0 + i, Math.abs(x) < 6 && Math.abs(z) < 6 ? m4 : ZERO); }
      if (f.t > 9) { for (let i = 0; i < f.n; i++) macaws.setMatrixAt(f.b0 + i, ZERO); flocks.splice(k, 1); } }
    macaws.instanceMatrix.needsUpdate = true; if (!ev && M.life >= 1 && R() < dt * .03) flush(rnd(-3, 3), rnd(-3, 3));
    // the event
    blastL.intensity = Math.max(0, blastL.intensity * Math.exp(-dt * 2.2) - dt * 30);
    if (ring.visible) { ring.userData.t += dt; const k = ring.userData.t; ring.scale.setScalar(.2 + k * 5.5); ring.material.opacity = Math.max(0, .7 - k * .55); DU.uShock.value.z = .2 + k * 5.5; DU.uShock.value.w = 1.4 * Math.max(0, 1 - k / 1.6); if (k > 1.6) { ring.visible = false; DU.uShock.value.w = 0; } }
    if (ev) { ev.t += dt; const f = ev.f;
      if (e < 3.4) { if (R() < dt * (1.5 + e * 2.5)) rustle(.6 + e * .3); if (R() < dt * (.5 + e)) snap(.6 + e * .2); if (e > 1.2 && !f.th1) { f.th1 = 1; thump(.4); } if (e > 2.3 && !f.th2) { f.th2 = 1; thump(.6); } }
      // the monster moves; the canopy over it flattens and thrashes; the troop flees ahead of it
      const mk = sm((e - 2.6) / 7); MON.lerpVectors(MA, MB, mk); DU.uMon.value.set(MON.x, MON.y, .95, e > 2.6 && e < 9.6 ? 1 : DU.uMon.value.w * Math.exp(-dt * 6));
      if (e > 2.6 && e < 9.6 && Math.floor(e / .75) !== f.lastT) { f.lastT = Math.floor(e / .75); thump(.7 + mk * .5); ctx.shake(.08 + mk * .12); dropLeaves(MON.x, MON.y, 10, canopyTop(MON.x, MON.y)); }
      if (e > 3.3 && e < 7.5) for (let i = 0; i < NMK; i++) { const m = MK[i]; if (m.on || R() > dt * 3.5) continue; const a = rnd(-1, 1), ax = MON.x + FLEE.x * rnd(.3, 1.2) - FLEE.y * a * 1.4, az = MON.y + FLEE.y * rnd(.3, 1.2) + FLEE.x * a * 1.4;
        if (Math.abs(ax) > 4.8 || Math.abs(az) > 4.8) continue; Object.assign(m, { on: 1, x: ax, z: az, y: canopyTop(ax, az), pause: rnd(0, .3), sc: rnd(.4, .5) }); leap(m, MON.x, MON.y); screech(.8); landShake(ax, az); }
      if (frenzy > .1) { if (R() < dt * 3.5 * frenzy) screech(); if (R() < dt * 1.1 * frenzy) howl(.9); if (R() < dt * 1.6 * frenzy) squawk(); if (R() < dt * 2 * frenzy) chirp(.8); if (R() < dt * 1.2 * frenzy) flush(MON.x + rnd(-1, 1), MON.y + rnd(-1, 1), 4); }
      if (e > 9.6 && !f.boom) { f.boom = 1; blast(MON.x, MON.y); ctx.setLook('blast'); }
      if (e > 17.5 && !f.bird) { f.bird = 1; chirp(1); setTimeout(() => chirp(.8), 700); }
      if (e > 19 && !f.back) { f.back = 1; ctx.setLook(ctx.baseLook()); }
      if (e > 26) { ev = null; DU.uMon.value.w = 0; } }
    // monkeys: leap from crown to crown, crouch for a beat, go again, and are gone past the edge of the world
    for (let i = 0; i < NMK; i++) { const m = MK[i]; if (!m.on) { monkeys.setMatrixAt(i, ZERO); continue; }
      let x, y, z, pitch = 0, crouch = 1;
      if (m.pause > 0) { m.pause -= dt; x = m.x; y = m.y; z = m.z; crouch = .72; if (m.pause <= 0) leap(m, MON.x, MON.y); }
      else { m.t += dt; const k = Math.min(1, m.t / m.T); x = lerp(m.x0, m.x1, k); z = lerp(m.z0, m.z1, k); y = lerp(m.y0, m.y1, k) + m.hop * 4 * k * (1 - k); pitch = Math.atan2((m.y1 - m.y0) / m.T + m.hop * 4 * (1 - 2 * k) / m.T, Math.hypot(m.x1 - m.x0, m.z1 - m.z0) / m.T) * .6;
        if (k >= 1) { m.x = m.x1; m.z = m.z1; m.y = m.y1; m.pause = rnd(.03, .14); if (Math.abs(m.x) < 4.95 && Math.abs(m.z) < 4.95) { landShake(m.x, m.z); if (R() < .3) dropLeaves(m.x, m.z, 3, m.y); } } }
      if (Math.abs(x) > 5.4 || Math.abs(z) > 5.4 || y < -1) { m.on = 0; monkeys.setMatrixAt(i, ZERO); continue; }
      eu.set(0, m.dir, pitch); q4.setFromEuler(eu); m4.compose(v3.set(x, y + .03, z), q4, sc3.set(m.sc, m.sc * crouch, m.sc)); monkeys.setMatrixAt(i, m4); }
    monkeys.instanceMatrix.needsUpdate = true;
    SOFT.step(dt, t); FIRE.step(dt, t);
  });
  { const done = new Set(); island.traverse(o => { if (!o.isMesh || !o.material || done.has(o.material) || o.material === water.mat || o.material === water.wallMat || o.material.isShaderMaterial || o === wl || o.material === leafMat || o.material === birdM || o.material === liv) return; done.add(o.material); underwater(o.material, WL, 2.2, [.03, .028, .012]); }); }
  ctx.api = api; return ctx;
}
