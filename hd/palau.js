/* Rock Islands, Palau: jungle-capped limestone islets rising from milky turquoise lagoons. Each islet is a real 3D mesh,
   not a heightfield, so it can do what the sea does to limestone here: a deep undercut notch at the waterline with the
   rock overhanging it, bulging fluted walls, a jungle dome, vines spilling down the faces. Under the clear water: coral
   heads in every colour, a swarm of golden jellyfish, mantas gliding through the channel, fish schools. EVENT: a squall
   with rain and lightning, and a humpback that breaches, spouts and raises its flukes. */
import { THREE, mergeGeometries, $, TAU, R, rnd, pick, clamp, lerp, sm, Q, makeNoise, GLSL_NOISE, TRI, createEngine, LO, QN, makeHeightfield, DZ, SLAB, makeWalls, wallMaterial, makeWater, leafQuad, crownGeometry, makeSpray, makeAudio, makeSnowfall, underwater } from './core.js';

export const META = { name: 'Rock Islands', line: 'Jungle-capped limestone islets undercut by the sea, rising from milky turquoise lagoons. Drag to orbit, pinch or scroll to zoom.', era: 'Palau · Chelbacheb · late morning', ev: 'Squall & whale', preset: { time: 1, clouds: 1, rain: 0, wind: 1, glow: 1, life: 2 }, birds: 'gull' };

export function build() {
  const N = makeNoise(+(Q.get('seed') || 7)), S = 10, H5 = 5, WATER = 0, DEPTH = SLAB, NORM = 2.4;
  const ctx = createEngine({ cam: { target: [0, -.3, .3], dist: 33, pol: 1.0, az: Math.PI / 4, min: 9, max: 60 }, look: 'noon', sunRef: 3.2,
    skies: { noon: 'sky_noon.rgbe.png', gold: 'sky_gold.rgbe.png', storm: 'sky_storm.rgbe.png' },
    looks: { noon: { sky: 'noon', dir: [-.62, 1, .5], col: '#fff4e6', I: 3.2, env: 1, exp: 1.05 }, gold: { sky: 'gold', dir: [-.95, .3, .1], col: '#ffa860', I: 3.4, env: .7, exp: 1.0, warm: 1 }, storm: { sky: 'storm', dir: [-.4, 1, .3], col: '#c8d0dc', I: .45, env: .75, exp: 1.15 } } });
  const { island, tex, U, MATS } = ctx; ctx.waterLevel = WATER;
  const T = { lime: tex('lime_diff.jpg'), limeN: tex('lime_nor.jpg', false), rock: tex('rock_diff.jpg'), rockN: tex('rock_nor.jpg', false), sand: tex('sand_diff.jpg'), sandN: tex('sand_nor.jpg', false), reef: tex('reef_diff.jpg'), reefN: tex('reef_nor.jpg', false),
    leaf: tex('leaf_diff.jpg', true, false), leafA: tex('leaf_alpha.jpg', false, false), leafN: tex('leaf_nor.jpg', false, false), bark: tex('bark_diff.jpg'), barkN: tex('bark_nor.jpg', false) };

  /* islets: [x, z, radius, height, notch depth] */
  const ISL = [[-2.2, -2.4, .95, 2.9, .3], [1.6, -2.7, .8, 2.5, .34], [-3.0, .4, .62, 2.1, .38], [.15, -.6, .55, 1.9, .42], [2.75, -.1, .5, 1.7, .4], [-1.2, 1.85, .42, 1.45, .45], [1.45, 1.7, .3, 1.1, .46], [-.55, 3.35, .24, .9, .48], [3.2, 2.6, .26, .95, .47], [.9, .55, .2, .75, .5], [-2.55, 2.95, .18, .7, .5]];
  /* the seabed: a shallow sandy lagoon with a winding deep channel, sand bars at the islet feet, and a beach cay at the back */
  const CAY = [-.2, -4.1];
  function height(u, v) { const x = u * H5, z = v * H5;
    let h = -.55 + N.fbm(u * 2, v * 2) * .22 + N.fbm(u * 8, v * 8) * .05;
    const cz = z - (1.1 * Math.sin(x * .55 + .8) + .3 * x), ch = Math.exp(-cz * cz / .9); h = lerp(h, -2.3 + N.fbm(u * 3, v * 3) * .3, ch * sm((x + 6) / 3));
    h = lerp(h, -2.2 + N.fbm(u * 2 + 4, v * 2) * .3, sm((u + v - 1.25) / .5));
    h = lerp(h, -4.9 + N.fbm(u * 3 + 2, v * 3) * .25, sm((u + v - 1.05) / .22));  // the drop-off: a wall of reef falling away into the blue
    ISL.forEach(([ix, iz, r]) => { const d = Math.hypot(x - ix, z - iz) / r; if (d < 2.2) h = Math.max(h, lerp(-.12, h, sm((d - 1) / 1.2))); });
    const cd = Math.hypot((x - CAY[0]) / 2.2, (z - CAY[1]) / 1.3); if (cd < 1.4) h = Math.max(h, lerp(1.1 + N.fbm(u * 3, v * 3) * .4, h, sm((cd - .35) / .9)) * (cd < .9 ? 1 : 1));
    return h; }
  const hf = makeHeightfield(S, 300, height), { hAt } = hf;

  /* the seabed and the cay: white sand, coral-ground patches, a beach and jungle floor on the cay */
  const seaMat = new THREE.MeshStandardMaterial({ roughness: .9 }); MATS.push(seaMat);
  seaMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, { tSand: { value: T.sand }, tSandN: { value: T.sandN }, tReef: { value: T.reef }, tReefN: { value: T.reefN }, tLime: { value: T.lime } });
    sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform sampler2D tSand, tSandN, tReef, tReefN, tLime; uniform float uTime, uSun, uCloud, uWet; varying vec3 vWP; varying vec3 vWN; float mSub, mVeg, mBeach;\n' + GLSL_NOISE + TRI + sh.fragmentShader
      .replace('#include <map_fragment>', `
  vec3 P = vWP, Nn = normalize(vWN), w = triW(Nn); mSub = smoothstep(.1, -.3, P.y); mBeach = (1. - mSub) * smoothstep(.75, .4, P.y); mVeg = (1. - mSub) * (1. - mBeach);
  vec3 sand = tri2(tSand, P, w, .35) * vec3(1.34, 1.29, 1.18); sand *= mix(.66, 1., smoothstep(.02, .3, P.y)); sand = mix(sand, sand * .6, uWet);
  vec3 reef = tri2(tReef, P, w, .3); float pt = smoothstep(.47, .64, fbm(P.xz * .42) * .7 + fbm(P.xz * 1.7) * .3); vec3 bed = mix(sand * .97, reef * vec3(.85, 1., .9) * 1.1, pt * .75); bed *= mix(1., .7, smoothstep(-.3, -2., P.y));
  vec3 col = mix(sand * mBeach + vec3(.05, .1, .03) * (.7 + .6 * vn(P.xz * 3.)) * mVeg, bed, mSub);
  float dep = -P.y; if (dep > 0.) col += vec3(.75, .95, .9) * caustic(P.xz, uTime) * exp(-dep * 1.1) * .65 * uSun;
  col *= cloudShade(P.xz, uTime, uCloud); diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(.9, .45, smoothstep(.3, .0, vWP.y) * (1. - mSub));')
      .replace('#include <normal_fragment_maps>', '{ vec3 nT = normalize(triN(tSandN, vWP, Nn, w, .35) * (mBeach + mVeg) + triN(tReefN, vWP, Nn, w, .3) * mSub + Nn * .05); normal = normalize((viewMatrix * vec4(nT, 0.)).xyz); }'); };
  const seabed = new THREE.Mesh(hf.geo, seaMat); seabed.receiveShadow = seabed.castShadow = true; island.add(seabed);
  const walls = makeWalls(hf, DEPTH, WATER, NORM); const wl = new THREE.Mesh(walls.land, wallMaterial(ctx, T.lime, T.limeN, [.95, .93, .88])); wl.castShadow = wl.receiveShadow = true; island.add(wl);

  /* the islets themselves */
  const prof = (y, H, notch) => { const top = H * .74;
    if (y < -.08) return 1.06 + (-.08 - y) * .16;
    if (y < .55) { const t = (y + .08) / .63, k = Math.pow(Math.sin(Math.PI * Math.pow(t, .62)), 1.3); return 1.06 - notch * k; }
    if (y < top) return 1.06 + .07 * sm((y - .55) / Math.max(.2, top - .55));
    const k = (y - top) / (H - top); return 1.13 * Math.sqrt(Math.max(0, 1 - k * k)); };
  function isletGeo(cx, cz, Rr, H, notch, seed) { const NT = 140, NY = 110, pos = [], idx = [], y0 = -1.6;
    for (let j = 0; j <= NY; j++) { const t = j / NY, y = y0 + (H - y0) * (t < .45 ? t / .45 * .55 : .55 + (t - .45) / .55 * .45) * 1, yy = y0 + (H - y0) * (t < .5 ? Math.pow(t / .5, 1) * (2.1 / (H - y0)) : (2.1 / (H - y0)) + (t - .5) / .5 * (1 - 2.1 / (H - y0)));
      const Y = yy; for (let i = 0; i < NT; i++) { const th = i / NT * TAU, c = Math.cos(th), s = Math.sin(th);
        const fp = 1 + .2 * N.fbm(c * 1.1 + seed, s * 1.1 + seed * .7, 4) + .06 * N.fbm(c * 3.7 + seed, s * 3.7, 3);
        const wall = Y > .5 && Y < H * .8 ? 1 : Y > .3 && Y < H * .86 ? .5 : 0, flute = wall * (.05 * (N.ridge(th * Rr * 9 + seed, Y * 1.2 + seed, 3) - .55) + .02 * N.n2(th * Rr * 30, Y * 3));
        const ledge = Y > .5 && Y < H * .7 ? .025 * Math.max(0, Math.sin(Y * 11 + seed + th * 2)) : 0, cave = Y > .55 && Y < 1.1 ? -.12 * sm(1 - Math.hypot((th - (seed % TAU)) * Rr * 2.5, (Y - .8) * 4)) : 0;
        const r = Rr * fp * prof(Y, H, notch) * (1 + flute + ledge + cave); pos.push(cx + c * r, Y, cz + s * r); } }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NT; i++) { const a = j * NT + i, b = j * NT + (i + 1) % NT, c2 = a + NT, d2 = b + NT; idx.push(a, c2, b, b, c2, d2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
  const rockMat = new THREE.MeshStandardMaterial({ roughness: .88 }); MATS.push(rockMat);
  rockMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, { tLime: { value: T.lime }, tLimeN: { value: T.limeN }, tRock: { value: T.rock }, tRockN: { value: T.rockN } });
    sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform sampler2D tLime, tLimeN, tRock, tRockN; uniform float uTime, uSun, uCloud, uWet; varying vec3 vWP; varying vec3 vWN; float mDark, mVeg;\n' + GLSL_NOISE + TRI + sh.fragmentShader
      .replace('#include <map_fragment>', `
  vec3 P = vWP, Nn = normalize(vWN), w = triW(Nn);
  vec3 lime = tri2(tLime, P, w, .28) * vec3(1.02, 1.01, .98), rk = tri2(tRock, P, w, .32) * vec3(1.15, 1.12, 1.05);
  float al = P.x * .7071 - P.z * .7071 + P.z * .3; mDark = clamp(smoothstep(.5, .75, fbm(P.xz * .7 + P.y * .35)) * .55 + (1. - smoothstep(.2, 1.4, P.y)) * .55, 0., 1.);
  vec3 col = mix(lime, rk, mDark); col *= 1. - smoothstep(.6, .88, fbm(vec2(al * 3.2, P.y * .14))) * .5;
  float tide = smoothstep(-.2, .0, P.y) * (1. - smoothstep(.32, .5, P.y)); col = mix(col, rk * vec3(.42, .44, .38), tide * .85); col = mix(col, col * vec3(.55, .75, .45), smoothstep(-.04, .02, P.y) * (1. - smoothstep(.06, .16, P.y)) * .8);
  mVeg = smoothstep(.45, .7, Nn.y) * smoothstep(.45, .8, P.y); col = mix(col, vec3(.05, .1, .03) * (.7 + .6 * vn(P.xz * 3.)), mVeg);
  float dep = -P.y; if (dep > 0.) { col *= vec3(.8, .95, .92); col += vec3(.75, .95, .9) * caustic(P.xz + P.y * .3, uTime) * exp(-dep * 1.1) * .5 * uSun; }
  col *= cloudShade(P.xz, uTime, uCloud); diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(.9, .55, smoothstep(.5, .0, vWP.y) * step(0., vWP.y));')
      .replace('#include <normal_fragment_maps>', '{ vec3 nT = normalize(mix(triN(tLimeN, vWP, Nn, w, .28), triN(tRockN, vWP, Nn, w, .32), mDark) + Nn * .1); normal = normalize((viewMatrix * vec4(nT, 0.)).xyz); }'); };
  const isletGeos = ISL.map(([x, z, r, H, nt], q) => isletGeo(x, z, r, H, nt, q * 3.7 + 1.3));
  const islets = new THREE.Mesh(mergeGeometries(isletGeos), rockMat); islets.castShadow = islets.receiveShadow = true; island.add(islets);

  /* the jungle: crowns on every dome, spilling over the rim; vines hanging down the faces; palms on the cay */
  const LEAVES = [[.01, .52, .15, .46], [.17, .52, .15, .46], [.34, .52, .15, .46], [.51, .52, .15, .46], [.68, .52, .15, .46], [.01, .02, .15, .46], [.17, .02, .15, .46], [.34, .02, .15, .46]];
  const leafMat = new THREE.MeshStandardMaterial({ map: T.leaf, alphaMap: T.leafA, alphaTest: .45, normalMap: T.leafN, side: THREE.DoubleSide, roughness: .62 }); MATS.push(leafMat);
  leafMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U); sh.vertexShader = 'uniform float uTime, uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n{ float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3; transformed.x += sin(uTime * 1.3 + ph + position.y * 2.) * .02 * (.3 + uWind * .7) * position.y; transformed.z += cos(uTime * 1.1 + ph) * .015 * (.3 + uWind * .7) * position.y; }\n#endif'); };
  const crowns = [], vines = [], up = new THREE.Vector3(0, 1, 0);
  isletGeos.forEach((g, q) => { const p = g.attributes.position, nrm = g.attributes.normal, H = ISL[q][3];
    for (let k = 0; k < p.count; k += 1) { const y = p.getY(k); if (y < H * .5) continue; const ny = nrm.getY(k);
      if (y < H * .7) continue; if (ny > .3 && R() < .1) crowns.push([p.getX(k), y, p.getZ(k), rnd(.09, .17) * (ISL[q][2] < .3 ? .8 : 1), 0]);
      else if (ny > -.1 && ny <= .3 && R() < .03) crowns.push([p.getX(k) + nrm.getX(k) * .05, y - .03, p.getZ(k) + nrm.getZ(k) * .05, rnd(.07, .12), 1]);
      else if (ny > -.2 && ny <= .25 && y < H * .82 && R() < .012) vines.push([p.getX(k) + nrm.getX(k) * .02, y, p.getZ(k) + nrm.getZ(k) * .02, nrm.getX(k), nrm.getZ(k), rnd(.25, Math.min(1.1, y - .5))]); } });
  for (let t = 0; t < 20000 && crowns.length < 3600 * QN; t++) { const x = rnd(-H5 + .2, H5 - .2), z = rnd(-H5 + .2, H5 - .2), h = hAt(x, z); if (h < .55) continue; if (hf.normAt(x, z).y < .6) continue; crowns.push([x, h, z, rnd(.18, .32), 0]); }
  { const im = new THREE.InstancedMesh(crownGeometry(LEAVES), leafMat, crowns.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), GR = ['#5f7a3a', '#4f6e30', '#7a8a44', '#3e5e2a', '#6a8a3e', '#8a9a50', '#456a32', '#5a8040'];
    crowns.forEach(([x, y, z, s, hang], i) => { q.setFromEuler(new THREE.Euler(rnd(-.2, .2) + (hang ? .5 : 0), rnd(TAU), rnd(-.2, .2))); m.compose(new THREE.Vector3(x, y + s * (hang ? -.1 : .2), z), q, new THREE.Vector3(s, s * rnd(.75, 1.05), s)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(pick(GR)).multiplyScalar(rnd(.85, 1.15))); });
    im.castShadow = im.receiveShadow = true; island.add(im); }
  { const parts = [], m = new THREE.Matrix4(), q = new THREE.Quaternion();
    vines.forEach(([x, y, z, nx, nz, L]) => { const n = Math.max(3, Math.round(L / .07)), out = new THREE.Vector3(nx, 0, nz).normalize();
      for (let k = 0; k < n; k++) { const f = k / n, yy = y - f * L; const lf = out.clone().multiplyScalar(.6).add(new THREE.Vector3(rnd(-.5, .5), -.5, rnd(-.5, .5))).normalize(); q.setFromUnitVectors(up, lf);
        m.compose(new THREE.Vector3(x + out.x * (.02 + Math.sin(f * 7) * .015), yy, z + out.z * (.02 + Math.sin(f * 7) * .015)), q, new THREE.Vector3(1, 1, 1)); parts.push(leafQuad(.07, .14 * (1 - f * .4), pick(LEAVES), m)); } });
    if (parts.length) { const vm = new THREE.Mesh(mergeGeometries(parts), leafMat); vm.castShadow = true; island.add(vm); } }
  { const barkMat = new THREE.MeshStandardMaterial({ map: T.bark, normalMap: T.barkN, roughness: .9 }); MATS.push(barkMat); const trunks = [], fronds = [], m = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let t = 0, n = 0; t < 4000 && n < 16; t++) { const x = rnd(-H5 + .3, H5 - .3), z = rnd(-H5 + .3, H5 - .3), h = hAt(x, z); if (h < .12 || h > .7 || hf.normAt(x, z).y < .85) continue; n++;
      const lean = new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1)).normalize().multiplyScalar(rnd(.15, .5)), Ht = rnd(.8, 1.3), pts = []; for (let k = 0; k <= 8; k++) { const f = k / 8; pts.push(new THREE.Vector3(x + lean.x * f * f * Ht, h + f * Ht, z + lean.z * f * f * Ht)); }
      trunks.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, .026, 7, false)); const top = pts[8];
      for (let fI = 0; fI < 10; fI++) { const az = fI / 10 * TAU + rnd(-.2, .2), L = rnd(.5, .7), droop = rnd(.5, .9);
        for (let k = 1; k <= 20; k++) { const f = k / 20, px = Math.cos(az) * L * f, pz = Math.sin(az) * L * f, py = Math.sin(f * Math.PI * .55) * .2 - f * f * droop * .5;
          [-1, 1].forEach(sd => { const dir = new THREE.Vector3(Math.cos(az), -.2 - f * .6, Math.sin(az)).normalize(), side = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az)).multiplyScalar(sd), lf = side.clone().add(new THREE.Vector3(0, -.55, 0)).add(dir.clone().multiplyScalar(.4)).normalize();
            q.setFromUnitVectors(up, lf); m.compose(new THREE.Vector3(top.x + px, top.y + py, top.z + pz), q, new THREE.Vector3(1, 1, 1)); fronds.push(leafQuad(.03, .19 * (1 - f * .5), LEAVES[(k + fI) % 5], m)); }); } } }
    if (trunks.length) { const tm = new THREE.Mesh(mergeGeometries(trunks), barkMat); tm.castShadow = true; island.add(tm); const fm = new THREE.Mesh(mergeGeometries(fronds), leafMat); fm.castShadow = true; island.add(fm); } }

  /* water */
  const water = makeWater(ctx, hf, { level: WATER, att: '#22b4c4', attDist: 1.05, deep: '#0c4f92', shallow: '#13706f', glint: 1, norm: NORM, wallK: 4 });
  const ww = new THREE.Mesh(walls.water, water.wallMat); island.add(ww);

  /* in the deep: a WWII freighter lies on the drop-off slope, a whale shark's shadow drifts past the other wall */
  { const g = new THREE.Group(), rust = new THREE.MeshStandardMaterial({ map: T.rock, color: '#6a5444', roughness: .95 }); MATS.push(rust);
    const hull = new THREE.BoxGeometry(2.4, .34, .4, 40, 3, 3), hp = hull.attributes.position; for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), t = clamp((x - .7) / .5, 0, 1), tb = clamp((-x - 1.0) / .2, 0, 1); hp.setZ(i, hp.getZ(i) * (1 - t * .92) * (1 - tb * .25)); if (hp.getY(i) < 0) hp.setZ(i, hp.getZ(i) * .7); hp.setY(i, hp.getY(i) + t * t * .08 * (hp.getY(i) > 0 ? 1 : 0)); } hull.computeVertexNormals();
    const parts = [[hull, 0, 0, 0], [new THREE.BoxGeometry(.42, .2, .3), -.55, .27, 0], [new THREE.BoxGeometry(.26, .14, .24), -.55, .44, 0], [new THREE.CylinderGeometry(.06, .07, .3, 10), -.85, .38, 0], [new THREE.BoxGeometry(.3, .12, .26), .45, .23, 0], [new THREE.CylinderGeometry(.07, .08, .07, 12), .85, .2, 0]];
    parts.forEach(([geo, x, y, z]) => { const m = new THREE.Mesh(geo, rust); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.012, .014, .32, 6), rust); barrel.rotation.z = Math.PI / 2 + .25; barrel.position.set(1.0, .24, 0); g.add(barrel);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.014, .02, 1.1, 6), rust); mast.position.set(.15, .45, -.3); mast.rotation.set(-1.1, 0, .3); g.add(mast);
    const growth = new THREE.MeshStandardMaterial({ color: '#4a5a4a', roughness: 1 }); MATS.push(growth); for (let k = 0; k < 40; k++) { const s2 = rnd(.03, .08), b = new THREE.Mesh(new THREE.SphereGeometry(s2, 6, 4), growth); b.position.set(rnd(-1.1, 1.1), rnd(.1, .2), rnd(-.18, .18)); b.scale.y = .5; g.add(b); }
    const wx = 2.0, wz = 3.95; g.position.set(wx, hAt(wx, wz) + .12, wz); g.rotation.set(-.32, -.08, .1); island.add(g); }
  const shark = (() => { const prof = [[.01, -.5], [.05, -.42], [.1, -.28], [.15, -.1], [.17, .08], [.16, .25], [.13, .38], [.09, .46], [0, .5]];
    const body = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(.001, r), y)), 28); body.rotateZ(-Math.PI / 2); body.scale(1, .55, 1);
    const cols = [], p = body.attributes.position, c = new THREE.Color(); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); c.set(y > -.01 && (Math.sin(x * 70) * Math.sin(z * 70)) > .55 ? '#9aa4a8' : y > -.01 ? '#2c3438' : '#c8ccc8'); cols.push(c.r, c.g, c.b); }
    body.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55 }); MATS.push(mat);
    const g = new THREE.Group(), b = new THREE.Mesh(body, mat); g.add(b); const fin = new THREE.Mesh(new THREE.ConeGeometry(.05, .16, 4), mat); fin.position.set(-.05, .1, 0); fin.scale.z = .2; g.add(fin);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(.06, .3, 4), mat); tail.rotation.z = Math.PI / 2; tail.position.set(-.55, .04, 0); tail.scale.set(1, 1, .15); g.add(tail);
    g.scale.setScalar(2.3); island.add(g); ctx.life(g, 2); return { g, tail }; })();
  makeSnowfall(ctx, 1800, [-4.9, 4.9, -2.5, -.4, -4.9, 4.9], [.75, .85, .9], .32);
  /* life under the water */
  const reefOK = (x, z) => { const h = hAt(x, z); return h < -.25 && h > -1.6 && !ISL.some(([ix, iz, r]) => Math.hypot(x - ix, z - iz) < r * 1.25); };
  { const CORAL = ['#8a6a5a', '#7a7a52', '#9a8a6a', '#6a7a6a', '#a07a7a', '#7a6a8a', '#b08a5a', '#c8b89a', '#c070a0', '#d08850'], c = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const brain = new THREE.SphereGeometry(1, 16, 10, 0, TAU, 0, Math.PI / 2); { const p = brain.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + .08 * Math.sin(p.getX(i) * 30) * Math.sin(p.getZ(i) * 30) + .1 * (R() - .5); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * .7, p.getZ(i) * k); } brain.computeVertexNormals(); }
    const branch = mergeGeometries(Array.from({ length: 9 }, () => { const g = new THREE.ConeGeometry(.12, rnd(.7, 1.3), 5); g.translate(0, .45, 0); g.rotateZ(rnd(-.7, .7)); g.rotateY(rnd(TAU)); return g.toNonIndexed(); }));
    const cm = new THREE.MeshStandardMaterial({ roughness: .75 }); MATS.push(cm);
    [[brain, 300, [.05, .14]], [branch, 220, [.06, .13]]].forEach(([g, n, sz]) => { const pts = []; for (let t = 0; t < n * 30 && pts.length < n; t++) { const x = rnd(-H5 + .2, H5 - .2), z = rnd(-H5 + .2, H5 - .2); if (reefOK(x, z)) pts.push([x, hAt(x, z), z]); }
      const im = new THREE.InstancedMesh(g, cm, pts.length); pts.forEach(([x, h, z], i) => { const s = rnd(sz[0], sz[1]); q.setFromEuler(new THREE.Euler(rnd(-.15, .15), rnd(TAU), rnd(-.15, .15))); m.compose(new THREE.Vector3(x, h - s * .1, z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(pick(CORAL)).multiplyScalar(rnd(.8, 1.1))); }); im.receiveShadow = true; island.add(im); }); }
  // golden jellyfish drifting in a sheltered pocket
  const JC = [-1.0, .35], jel = []; { const bell = new THREE.SphereGeometry(.05, 14, 8, 0, TAU, 0, Math.PI * .55), arms = [0, 1, 2, 3].map(k => { const g = new THREE.ConeGeometry(.012, .07, 5); g.rotateX(Math.PI); g.translate(Math.cos(k * TAU / 4) * .015, -.035, Math.sin(k * TAU / 4) * .015); return g.toNonIndexed(); });
    const jg = mergeGeometries([bell.toNonIndexed(), ...arms]), jm = new THREE.MeshStandardMaterial({ color: '#f0c060', emissive: '#b8781e', emissiveIntensity: .35, transparent: true, opacity: .62, roughness: .3, side: THREE.DoubleSide, depthWrite: false }); MATS.push(jm);
    jm.onBeforeCompile = sh => { Object.assign(sh.uniforms, U); sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n{ float ph = instanceMatrix[3].x * 7.1 + instanceMatrix[3].z * 5.3, p = sin(uTime * 1.6 + ph); transformed.xz *= 1. + .16 * p; transformed.y *= 1. - .12 * p; }\n#endif'); };
    for (let k = 0; k < 160; k++) { const a = rnd(TAU), r = Math.sqrt(R()) * .9, x = JC[0] + Math.cos(a) * r, z = JC[1] + Math.sin(a) * r, fl = hAt(x, z); if (fl > -.35) continue; jel.push({ x, z, y: rnd(fl + .08, -.08), a: rnd(TAU), s: rnd(.7, 1.4), sp: rnd(.02, .05) }); }
    const im = new THREE.InstancedMesh(jg, jm, jel.length); im.renderOrder = 1; island.add(im); jel.im = im; ctx.life(im, 2); ctx.glowMat(jm, 1.4); }
  // mantas through the channel
  const mantas = [0, 1].map(k => { const sh = new THREE.Shape(); sh.moveTo(.18, 0); sh.quadraticCurveTo(.05, .05, -.02, .3); sh.quadraticCurveTo(-.06, .12, -.14, .02); sh.lineTo(-.16, 0); sh.lineTo(-.14, -.02); sh.quadraticCurveTo(-.06, -.12, -.02, -.3); sh.quadraticCurveTo(.05, -.05, .18, 0);
    const g = new THREE.ShapeGeometry(sh, 14); g.rotateX(-Math.PI / 2); const tail = new THREE.CylinderGeometry(.002, .005, .22, 4); tail.rotateZ(Math.PI / 2); tail.translate(-.26, 0, 0);
    const mm = new THREE.MeshStandardMaterial({ color: '#22272c', roughness: .5, side: THREE.DoubleSide }); MATS.push(mm);
    mm.onBeforeCompile = shd => { Object.assign(shd.uniforms, U); shd.vertexShader = 'uniform float uTime;\n' + shd.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed.y += sin(uTime * 1.5 + ${k * 2}.0) * .18 * pow(abs(position.z) / .3, 1.6);`); shd.fragmentShader = shd.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = vec3(.85, .86, .84);'); };
    const grp = new THREE.Group(); const body = new THREE.Mesh(g, mm), tl = new THREE.Mesh(tail, mm); grp.add(body, tl); grp.scale.setScalar(2.4); island.add(grp); ctx.life(grp, 2); return { g: grp, a: rnd(TAU), ph: k * 3 }; });
  // fish schools
  const FG = (() => { const b = new THREE.SphereGeometry(.5, 9, 6); b.scale(1, .3, .17); const t = new THREE.ConeGeometry(.2, .34, 4); t.rotateZ(-Math.PI / 2); t.scale(1, 1, .22); t.translate(-.63, 0, 0); return mergeGeometries([b.toNonIndexed(), t.toNonIndexed()]); })();
  const fishM = new THREE.MeshStandardMaterial({ roughness: .35, metalness: .4 }); MATS.push(fishM);
  const schools = [[1.2, .9, '#f2d050'], [-2.2, -.9, '#c8d0d8'], [.4, 2.6, '#58a8e0']].map(([x, z, cl]) => { const n = 40, im = new THREE.InstancedMesh(FG, fishM, n), c = new THREE.Color(cl); for (let i = 0; i < n; i++) im.setColorAt(i, c); island.add(im); ctx.life(im, 1); return { im, x, z, n, o: Array.from({ length: n }, () => [rnd(-.18, .18), rnd(-.05, .05), rnd(-.4, .4)]), w: rnd(.25, .4) * (R() < .5 ? 1 : -1), r: rnd(.35, .55), y: -.32 }; });
  // kayaks drifting on the lagoon
  const kayaks = [0, 1, 2].map(k => { const g = new THREE.SphereGeometry(.5, 14, 8); g.scale(1, .12, .14); const m = new THREE.MeshStandardMaterial({ color: ['#f2b018', '#e8501e', '#2a8ad0'][k], roughness: .35 }); MATS.push(m);
    const grp = new THREE.Group(), hull = new THREE.Mesh(g, m), pad = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .7, 5), new THREE.MeshStandardMaterial({ color: '#333', roughness: .4 })); pad.rotation.x = Math.PI / 2; pad.position.y = .07; grp.add(hull, pad); grp.scale.setScalar(.42); grp.traverse(o => { if (o.isMesh) o.castShadow = true; }); island.add(grp); return { g: grp, pad, a: rnd(TAU), r: rnd(.5, 1.2), cx: [.7, -1.6, 1.8][k], cz: [1.2, 2.2, .7][k], sp: rnd(.04, .07) * (k % 2 ? 1 : -1) }; });

  /* squall and humpback */
  const SPR = makeSpray(ctx), AU = makeAudio(); AU.onStart = A => { A.surf = A.loop('lowpass', 500, .7, .12); A.rain = A.loop('bandpass', 2200, .5, 0); };
  const whale = (() => { const g = new THREE.Group(); g.rotation.order = 'YZX'; const prof2 = [[.008, -.5], [.03, -.44], [.06, -.34], [.1, -.2], [.13, -.05], [.14, .08], [.132, .2], [.112, .32], [.085, .41], [.05, .47], [0, .5]];
    const body = new THREE.LatheGeometry(prof2.map(([r, y]) => new THREE.Vector2(Math.max(.0005, r), y)), 40); body.rotateZ(-Math.PI / 2); body.scale(1, .82, 1);
    const cols = [], p = body.attributes.position, c = new THREE.Color(); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (y > -.02) c.set(Math.sin(x * 90 + z * 40) > .93 ? '#6a7074' : '#26292c'); else c.set(Math.floor(z * 90) % 2 && x > .05 ? '#9a9e9a' : '#c8ccc8'); cols.push(c.r, c.g, c.b); }
    body.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); const skin = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .36, clearcoat: .8, clearcoatRoughness: .2 }); MATS.push(skin);
    const bm = new THREE.Mesh(body, skin); bm.castShadow = true; g.add(bm); const finG = new THREE.ConeGeometry(.034, .38, 10); finG.scale(1, 1, .22); const finM = new THREE.MeshPhysicalMaterial({ color: '#d8dcd8', roughness: .4, clearcoat: .6 }); MATS.push(finM);
    const pecs = [-1, 1].map(sd => { const pv = new THREE.Group(); pv.position.set(.2, -.07, sd * .12); const f = new THREE.Mesh(finG, finM); f.position.y = -.19; pv.add(f); pv.rotation.set(sd * (Math.PI / 2 + .35), 0, .5); g.add(pv); return pv; });
    const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.quadraticCurveTo(-.04, .05, -.09, .16); fs.lineTo(-.135, .175); fs.quadraticCurveTo(-.1, .08, -.11, .012); fs.lineTo(-.095, 0); fs.lineTo(-.11, -.012); fs.quadraticCurveTo(-.1, -.08, -.135, -.175); fs.lineTo(-.09, -.16); fs.quadraticCurveTo(-.04, -.05, 0, 0);
    const fl = new THREE.ExtrudeGeometry(fs, { depth: .008, bevelEnabled: false, curveSegments: 12 }); fl.rotateX(-Math.PI / 2); const flM = new THREE.MeshPhysicalMaterial({ color: '#2a2d30', roughness: .35, clearcoat: .7 }); MATS.push(flM);
    const fluke = new THREE.Mesh(fl, flM); fluke.position.x = -.49; g.add(fluke); g.scale.setScalar(1.25); g.visible = false; island.add(g); return { g, pecs, fluke }; })();
  const rain = (() => { const n = 4500, p = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const x = rnd(-H5, H5), y = rnd(0, 7), z = rnd(-H5, H5); p.set([x, y, z, x - .025, y + .14, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: U.uTime, uA: { value: 0 } }, vertexShader: 'uniform float uT; void main(){ vec3 p = position; p.y = mod(p.y - uT * 7.5, 7.) - .3; p.x += p.y * .06; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }', fragmentShader: 'uniform float uA; void main(){ gl_FragColor = vec4(.78, .84, .9, .16 * uA); }' });
    const l = new THREE.LineSegments(g, m); l.frustumCulled = false; l.visible = false; island.add(l); return { l, m }; })();
  const bolt = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color(6, 6.5, 9), transparent: true })); bolt.visible = false; island.add(bolt);
  const flashL = new THREE.PointLight('#cfe0ff', 0, 30, 1.2); island.add(flashL);
  let ev = null;
  const strike = () => { const x = rnd(-4, 4), z = rnd(-4, 4), gy = Math.max(hAt(x, z), WATER), pts = []; let px = x + rnd(-1, 1), py = 7, pz = z + rnd(-1, 1);
    while (py > gy) { pts.push(new THREE.Vector3(px, py, pz)); py -= rnd(.2, .5); px += (x - px) * .15 + rnd(-.25, .25); pz += (z - pz) * .15 + rnd(-.25, .25); } pts.push(new THREE.Vector3(x, gy, z));
    bolt.geometry.dispose(); bolt.geometry = new THREE.BufferGeometry().setFromPoints(pts); bolt.visible = true; bolt.userData.t = .18; flashL.position.set(x, 3, z); flashL.intensity = 260; ctx.skyU.uFlash.value = 1.4; AU.burst(3.2, 220, .5, 'lowpass', rnd(.2, .6)); AU.burst(.4, 2400, .12, 'highpass'); };
  const whaleCall = () => { AU.tone(160, 420, 1.6, .09); AU.tone(420, 190, 1.8, .07, 1.4); };
  const api = { ev: () => { AU.get(); ev = { t: 0, f: {}, wh: null }; }, get evOn() { return !!ev; } };

  ctx.steps.push(dt => {
    const t = ctx.clock;
    // life
    jel.forEach((j, i) => { j.a += j.sp * dt; const x = j.x + Math.cos(j.a) * .12, z = j.z + Math.sin(j.a * 1.3) * .12, y = j.y + Math.sin(t * .4 + i) * .03 + Math.max(0, Math.sin(t * 1.6 + x * 7.1 + z * 5.3)) * .01; jel.im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(j.s, j.s, j.s))); }); jel.im.instanceMatrix.needsUpdate = true;
    mantas.forEach((mt, k) => { mt.a += dt * .12 * (k ? -1 : 1); const x = Math.cos(mt.a) * 3.2 * (k ? .8 : 1) + .2, z = Math.sin(mt.a) * 1.4 + Math.sin(mt.a * 2) * .5 + (k ? 1.2 : .4), y = -.7 - .15 * Math.sin(t * .3 + k); mt.g.position.set(x, y, z);
      const nx = -Math.sin(mt.a) * 3.2 * (k ? -1 : 1), nz = Math.cos(mt.a) * 1.4 * (k ? -1 : 1); mt.g.rotation.set(0, Math.atan2(-nz, nx), Math.sin(t * .7 + k) * .1); });
    schools.forEach(s => { const m = new THREE.Matrix4(), q = new THREE.Quaternion(); for (let i = 0; i < s.n; i++) { const [dr, dy, dp] = s.o[i], a = t * s.w + dp, r = s.r + dr, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r, sg = Math.sign(s.w);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-Math.cos(a) * sg, -Math.sin(a) * sg)); m.compose(new THREE.Vector3(x, s.y + dy + Math.sin(t * 2 + dp * 9) * .01, z), q, new THREE.Vector3(.07, .07, .07)); s.im.setMatrixAt(i, m); } s.im.instanceMatrix.needsUpdate = true; });
    { const a = t * .045, z = Math.sin(a) * 1.6 + 2.2, x = 3.95 + Math.sin(a * 2.3) * .15; shark.g.position.set(x, DZ(-3.7 + Math.sin(t * .2) * .2), z); shark.g.rotation.set(0, Math.cos(a) > 0 ? -Math.PI / 2 : Math.PI / 2, Math.sin(t * .5) * .05); shark.tail.rotation.y = Math.sin(t * 1.4) * .4; }
    kayaks.forEach(k => { k.a += k.sp * dt; const x = k.cx + Math.cos(k.a) * k.r, z = k.cz + Math.sin(k.a) * k.r; k.g.position.set(x, WATER + .01, z); k.g.rotation.set(Math.sin(t * 1.2 + k.cx) * .04, -k.a - Math.sign(k.sp) * Math.PI / 2, 0); k.pad.rotation.z = Math.sin(t * 2.4 + k.cx) * .5; });
    // event
    ctx.skyU.uFlash.value = Math.max(0, ctx.skyU.uFlash.value - dt * 7); flashL.intensity = Math.max(0, flashL.intensity - dt * 1400); if (bolt.visible) { bolt.userData.t -= dt; bolt.material.opacity = R() < .7 ? 1 : .2; if (bolt.userData.t <= 0) bolt.visible = false; }
    if (ev) { ev.t += dt; const e = ev.t, k = sm(e / 3) * (1 - sm((e - 21) / 3)), f = ev.f;
      if (!f.go) { f.go = 1; ctx.setLook('storm'); } if (e > 21 && !f.back) { f.back = 1; ctx.setLook(ctx.baseLook()); }
      rain.l.visible = k > .01; rain.m.uniforms.uA.value = k; U.uWet.value = k; water.WU.uWave.value = .03 + k * .07; water.WU.uWind.value = 1 + k * 2.2; water.WU.uFoam.value = 1 + k * 1.5; ctx.grade.uniforms.uStorm.value = k; U.uCloud.value = .35 + k * .3;
      if (AU.rain) { AU.rain.gain.value = k * .22; AU.surf.gain.value = .12 + k * .12; }
      if (e > 2 && e < 20 && R() < dt * .7) strike();
      if (e > 5 && !f.br) { f.br = 1; ev.wh = { k: 'breach', t: 0, x: 2.3, z: 3.0, hd: Math.atan2(-1, -.6) }; whaleCall(); }
      if (e > 12 && !f.sp) { f.sp = 1; for (let i = 0; i < 260; i++) SPR.emit(-.3 + rnd(-.03, .03), WATER + .05, 2.6 + rnd(-.03, .03), rnd(-.08, .08), rnd(1.6, 2.8), rnd(-.08, .08), rnd(1.4, 2.4), i % 5 === 0 ? 1 : 0); AU.burst(1.4, 900, .14, 'bandpass'); }
      if (e > 13.5 && !f.fl) { f.fl = 1; ev.wh = { k: 'fluke', t: 0, x: -.3, z: 2.6, hd: Math.atan2(-1, -.4) }; }
      if (e > 25) { ev = null; } }
    const W = ev && ev.wh, g = whale.g;
    if (!W) g.visible = false; else { W.t += dt; const q = W.t; g.visible = true; g.rotation.y = W.hd; const cs = Math.cos(W.hd), sn = -Math.sin(W.hd);
      if (W.k === 'breach') { const v0 = 3.4, gr = 3.6, y = WATER - 1 + v0 * q - .5 * gr * q * q, fwd = .5 * q; g.position.set(W.x + cs * fwd, y, W.z + sn * fwd);
        g.rotation.z = lerp(1.25, -.35, sm(q / 1.7)); g.rotation.x = lerp(0, 2.1, sm((q - .2) / 1.4)); whale.pecs.forEach(p => p.rotation.z = .5 + Math.sin(q * 3) * .25);
        if (q > .14 && !W.up) { W.up = 1; SPR.splash(W.x, W.z, 1.2); AU.burst(1.4, 1800, .25); }
        if (q < .9) for (let i = 0; i < 26; i++) SPR.emit(W.x + cs * fwd + rnd(-.12, .12), WATER + .02, W.z + sn * fwd + rnd(-.12, .12), rnd(-.4, .4), rnd(.8, 2.6), rnd(-.4, .4), rnd(.6, 1.1));
        if (y < WATER - .1 && q > 1 && !W.dn) { W.dn = 1; const px = g.position.x, pz = g.position.z; SPR.splash(px, pz, 2.4); SPR.splash(px + cs * .4, pz + sn * .4, 1.5); AU.burst(2.6, 1400, .45); AU.burst(1.6, 160, .4); }
        if (q > 3) ev.wh = null; }
      else { const rise = sm(q / 1.3), sink = sm((q - 2.6) / 1.8), y = lerp(WATER - 1.4, WATER - .68, rise) - 1 * sink; g.position.set(W.x, y, W.z); g.rotation.z = lerp(-.95, -1.38, rise) - .1 * sink; g.rotation.x = 0; g.updateMatrix();
        if (q > .5 && q < 3.8) for (let i = 0; i < 14; i++) { const p = new THREE.Vector3(-rnd(0, .13), 0, rnd(-.17, .17)).applyMatrix4(whale.fluke.matrix).applyMatrix4(g.matrix); if (p.y > WATER + .01) SPR.emit(p.x, p.y, p.z, rnd(-.03, .03), rnd(-.2, 0), rnd(-.03, .03), rnd(.4, .9)); }
        if (q > 3.4 && !W.tin) { W.tin = 1; SPR.splash(W.x, W.z, .9); AU.burst(1.2, 1600, .2); }
        if (q > 4.6) ev.wh = null; } }
  });
  { const done = new Set(); island.traverse(o => { if (!o.isMesh || !o.material || done.has(o.material) || o.material === water.mat || o.material === water.wallMat || o.material.isShaderMaterial || o === wl) return; done.add(o.material); underwater(o.material, WATER, 1.15); }); }
  ctx.api = api; return ctx;
}
