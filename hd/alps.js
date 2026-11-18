/* Midsummer night in an alpine valley: snow-capped peaks massed behind, pine forest on the slopes, a village of chalets
   with lit windows around a church, and a lake still enough to mirror the sky. EVENT: a fireworks show. Every spark is
   tracked: it bursts in a real pyrotechnic colour bright enough to bloom, cools as it falls, leaves a slowly fading trail,
   and lights the snow, the village and the lake. Smoke drifts in the afterglow. */
import { THREE, mergeGeometries, $, TAU, R, rnd, pick, clamp, lerp, sm, Q, makeNoise, GLSL_NOISE, TRI, createEngine, LO, QN, makeHeightfield, DZ, SLAB, makeWalls, wallMaterial, makeAudio, makeSnowfall, underwater } from './core.js';
import { Water } from 'three/addons/objects/Water.js';

export const META = { name: 'Midsummer Night', line: 'Snow peaks, a village in the pines and a lake that mirrors everything. Press Fireworks. Drag to orbit, pinch or scroll to zoom.', era: 'Alpine valley · 23:58', ev: 'Fireworks', preset: { time: 3, clouds: 0, rain: 0, wind: 0, glow: 2, life: 2 }, rainIs: 'Snow' };

export function build() {
  const N = makeNoise(+(Q.get('seed') || 11)), S = 10, H5 = 5, K = S / 6.4, LAKE = .17 * K, DEPTH = SLAB, NORM = 2.4;
  const ctx = createEngine({ cam: { target: [0, 1.1, 0], dist: 46, pol: 1.04, az: Math.PI / 4, min: 9, max: 60 }, look: 'night', sunRef: 1, bloom: [.6, .5, .85], sat: 1.04, stars: true,
    skies: { night: 'sky_night.rgbe.png' }, looks: { night: { sky: 'night', dir: [-.3, .9, -.75], col: '#9fb2ff', I: .6, env: .22, exp: 1.15, skyI: .32 } } });
  const { island, tex, U, MATS } = ctx; ctx.waterLevel = LAKE; U.uCloud.value = 0;
  const T = { snow: tex('snow_diff.jpg'), snowN: tex('snow_nor.jpg', false), rock: tex('lime_diff.jpg'), rockN: tex('lime_nor.jpg', false), dark: tex('rock_diff.jpg'), grass: tex('mtn_diff.jpg'), grassN: tex('mtn_nor.jpg', false), forest: tex('forest_diff.jpg'), forestN: tex('forest_nor.jpg', false),
    roof: tex('roof_diff.jpg'), roofN: tex('roof_nor.jpg', false), plaster: tex('plaster_diff.jpg'), wood: tex('pine_diff.jpg'), fir: tex('fir_diff.jpg', true, false), firA: tex('fir_alpha.jpg', false, false), firN: tex('fir_nor.jpg', false, false), waterN: tex('water_nor.jpg', false) };

  /* the valley, composed as in the classic deck: a wall of peaks massed in the far corner, a river gorge sawn through them,
     the village on the middle terraces, and a lake at the near corner breaking through both cut walls */
  function height(u, v) { const b = -(u + v) * .5, pk = Math.max(0, b + .02);
    let h = .36 + N.fbm(u * 1.6 + 9, v * 1.6) * .22 + Math.max(0, b + .3) * .32;
    h += Math.min(3.6, Math.pow(pk, 1.3) * (2.7 + N.ridge(u * 2.7 + 1, v * 2.3, 5) * 1.7) * (.9 + .3 * N.fbm(u * 1.3 + 4, v * 1.3 - 2)));
    const rv = u - .2 * Math.sin(v * 2.5) + .05, gw = .012 + pk * .05; h -= Math.exp(-rv * rv / gw) * (.3 + pk * 1.6);
    const lk = clamp((-b - .42) / .3, 0, 1); h = lerp(h, -.25 + N.fbm(u * 4, v * 4) * .06, lk * lk * (3 - 2 * lk));
    const dk = clamp((-b - .55) / .22, 0, 1); h = lerp(h, -3.0 + N.fbm(u * 3, v * 3) * .15, dk * dk * (3 - 2 * dk));  // the reservoir deepens into black water
    return h * K; }
  const hf = makeHeightfield(S, 300, height), { hAt, normAt } = hf;
  const terrMat = new THREE.MeshStandardMaterial({ roughness: .92 }); MATS.push(terrMat);
  terrMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, { tSnow: { value: T.snow }, tSnowN: { value: T.snowN }, tRock: { value: T.rock }, tRockN: { value: T.rockN }, tDark: { value: T.dark }, tGrass: { value: T.grass }, tGrassN: { value: T.grassN }, tForest: { value: T.forest }, tForestN: { value: T.forestN } });
    sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform sampler2D tSnow, tSnowN, tRock, tRockN, tDark, tGrass, tGrassN, tForest, tForestN; uniform float uTime; varying vec3 vWP; varying vec3 vWN; float mS, mR, mG, mF;\n' + GLSL_NOISE + TRI + sh.fragmentShader
      .replace('#include <map_fragment>', `
  vec3 P = vWP, Nn = normalize(vWN), w = triW(Nn); float slope = 1. - Nn.y, line = 2.15 + fbm(P.xz * .4) * .6;
  mR = smoothstep(.32, .55, slope); mS = smoothstep(line - .15, line + .2, P.y) * (1. - smoothstep(.72, .95, slope)); mR *= 1. - mS * .7;
  mG = (1. - mR) * (1. - mS) * smoothstep(1.9, 1.1, P.y); mF = max(0., 1. - mR - mS - mG);
  vec3 snow = tri2(tSnow, P, w, .3) * 1.15, rock = mix(tri2(tRock, P, w, .25), tri(tDark, P, w, .3), .45) * .8, grass = tri2(tGrass, P, w, .35) * .75, forest = tri2(tForest, P, w, .4) * .55;
  vec3 col = snow * mS + rock * mR + grass * mG + forest * mF; float shore = smoothstep(${(LAKE + .12).toFixed(2)}, ${LAKE.toFixed(2)}, P.y); col = mix(col, rock * .6, shore); diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(.92, .6, mS);')
      .replace('#include <normal_fragment_maps>', '{ vec3 nT = normalize(triN(tSnowN, vWP, Nn, w, .3) * mS + triN(tRockN, vWP, Nn, w, .25) * mR + triN(tGrassN, vWP, Nn, w, .35) * mG + triN(tForestN, vWP, Nn, w, .4) * mF + Nn * .05); normal = normalize((viewMatrix * vec4(nT, 0.)).xyz); }'); };
  const terr = new THREE.Mesh(hf.geo, terrMat); terr.castShadow = terr.receiveShadow = true; island.add(terr);
  const walls = makeWalls(hf, DEPTH, LAKE, NORM); const wl = new THREE.Mesh(walls.land, wallMaterial(ctx, T.rock, T.rockN, [.8, .78, .74])); wl.castShadow = wl.receiveShadow = true; island.add(wl);
  const lwm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .1, transparent: true, depthWrite: false }); MATS.push(lwm);
  lwm.onBeforeCompile = sh => { sh.vertexShader = 'varying float vDp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDp = uv.y;'); sh.fragmentShader = 'varying float vDp;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n float f = 1. - exp(-vDp * 4.); diffuseColor.rgb = mix(vec3(.06, .15, .16), vec3(.004, .012, .018), f); diffuseColor.a = mix(.2, .62, f) + smoothstep(.8, 1., vDp) * .15;'); };
  island.add(new THREE.Mesh(walls.water, lwm));
  /* the drowned village: a bell tower and roofless walls on the reservoir floor, and something large down there with them */
  { const stone = new THREE.MeshStandardMaterial({ map: T.plaster, color: '#9aa898', roughness: .95, emissive: '#0a1a18', emissiveIntensity: 1 }); MATS.push(stone); const g = new THREE.Group();
    const tw = new THREE.Mesh(new THREE.BoxGeometry(.32, 2.1, .32), stone); tw.position.y = 1.05; g.add(tw); const belf = new THREE.Mesh(new THREE.BoxGeometry(.36, .12, .36), stone); belf.position.y = 2.1; g.add(belf);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(.25, .7, 4), stone); sp.rotation.y = Math.PI / 4; sp.position.y = 2.5; g.add(sp);
    for (let k = 0; k < 4; k++) { const ar = new THREE.Mesh(new THREE.BoxGeometry(.33, .22, .05), new THREE.MeshBasicMaterial({ color: '#000' })); ar.position.set(Math.sin(k * Math.PI / 2) * .14, 1.85, Math.cos(k * Math.PI / 2) * .14); ar.rotation.y = k * Math.PI / 2; g.add(ar); }
    [[.7, .2, .5], [-.6, .5, .4], [.4, -.7, .45], [1.1, -.4, .35]].forEach(([x, z, w]) => { [[0, w / 2, w, .06], [0, -w / 2, w, .06], [w / 2, 0, .06, w], [-w / 2, 0, .06, w]].forEach(([dx, dz, sx, sz]) => { if (R() < .2) return; const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, rnd(.25, .55), sz), stone); wall.position.set(x + dx, .15, z + dz); g.add(wall); }); });
    g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); const dx = 2.9, dz = 3.7; g.position.set(dx, hAt(dx, dz) - .05, dz); g.rotation.set(.04, .5, -.06); island.add(g); }
  const fish = (() => { const prof = [[.01, -.5], [.04, -.4], [.07, -.2], [.09, 0], [.1, .2], [.09, .35], [.07, .45], [0, .5]]; const body = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20); body.rotateZ(-Math.PI / 2); body.scale(1, .7, .9);
    const m = new THREE.MeshStandardMaterial({ color: '#2a2e2a', roughness: .5 }); MATS.push(m); const g = new THREE.Group(); g.add(new THREE.Mesh(body, m)); g.scale.setScalar(3); island.add(g); ctx.life(g, 2); return g; })();
  makeSnowfall(ctx, 1400, [-1, 4.9, -2.4, -.3, -1, 4.9], [.6, .7, .65], .22);

  { const moon = new THREE.Mesh(new THREE.SphereGeometry(.46, 32, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.1, 2.9) })); moon.position.set(-1.9, 7.4, -4.8); island.add(moon); }
  /* the lake: a true mirror with gentle ripples */
  const lake = new Water(new THREE.PlaneGeometry(S, S), { textureWidth: LO ? 512 : 1024, textureHeight: LO ? 512 : 1024, waterNormals: T.waterN, sunDirection: new THREE.Vector3(.5, .9, -.45).normalize(), sunColor: 0x8899cc, waterColor: 0x061420, distortionScale: .35, alpha: 1, fog: false });
  T.waterN.wrapS = T.waterN.wrapT = THREE.RepeatWrapping; lake.rotation.x = -Math.PI / 2; lake.position.y = LAKE; lake.material.uniforms.size.value = 4; lake.material.uniforms.alpha.value = .9; lake.material.transparent = true; if (!Q.has('nolake')) island.add(lake);

  /* the village: plaster and timber chalets with snow on their roofs and warm windows, around a church */
  const winU = { value: 1 };
  const wallM = new THREE.MeshStandardMaterial({ map: T.plaster, roughness: .85 }); MATS.push(wallM);
  wallM.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, { uWin: U.uGlow, tWood: { value: T.wood } });
    sh.vertexShader = 'varying vec3 vLP; varying vec3 vLN; varying vec3 vC;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position; vLN = normal; vC = vec3(instanceMatrix[3].x, instanceMatrix[3].z, instanceMatrix[0].x);');
    sh.fragmentShader = 'uniform float uTime, uWin; uniform sampler2D tWood; varying vec3 vLP; varying vec3 vLN; varying vec3 vC;\n' + GLSL_NOISE + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= vec3(.95, .9, .85); if (vLP.y > .55) diffuseColor.rgb = texture2D(tWood, vLP.xy * 1.5 + vLP.zy * 1.5).rgb * .7;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 if (abs(vLN.y) < .5) { float u = (abs(vLN.x) > .5 ? vLP.z : vLP.x) * 3.2, v = vLP.y * 4.; vec2 cl = floor(vec2(u, v)), fr = fract(vec2(u, v)); float g = step(.3, fr.x) * step(fr.x, .7) * step(.3, fr.y) * step(fr.y, .75) * step(.2, vLP.y) * step(vLP.y, .85);
   float on = step(.35, hh(cl + vC.xy * 13.)) , fl = .85 + .15 * sin(uTime * (2. + hh(cl) * 5.) + hh(cl + 3.) * 20.); totalEmissiveRadiance += vec3(1., .62, .28) * g * on * fl * 2.4 * uWin; }`); };
  const roofM = new THREE.MeshStandardMaterial({ map: T.roof, normalMap: T.roofN, roughness: .8 }); MATS.push(roofM);
  roofM.onBeforeCompile = sh => { sh.vertexShader = 'varying vec3 vN2;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvN2 = normal;'); sh.fragmentShader = 'varying vec3 vN2;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb * vec3(.55, .42, .36), vec3(.85, .88, .95), smoothstep(.45, .75, vN2.y) * .85);'); };
  const houses = []; for (let t = 0; t < 20000 && houses.length < 40; t++) { const x = rnd(-4, 4), z = rnd(-4.6, 4.6), h = hAt(x, z); if (h < .22 * K || h > .75 * K || normAt(x, z).y < .9 || houses.some(o => Math.hypot(o[0] - x, o[2] - z) < .3)) continue; houses.push([x, h, z, rnd(TAU), rnd(.85, 1.25)]); }
  const VC = houses.length ? [houses.reduce((a, o) => a + o[0], 0) / houses.length, houses.reduce((a, o) => a + o[2], 0) / houses.length] : [0, 0];
  const boxG = new THREE.BoxGeometry(1, 1, 1); boxG.translate(0, .5, 0);
  const roofG = (() => { const s = new THREE.Shape(); s.moveTo(-.62, 0); s.lineTo(.62, 0); s.lineTo(0, .55); s.lineTo(-.62, 0); const g = new THREE.ExtrudeGeometry(s, { depth: 1.15, bevelEnabled: false }); g.translate(0, 0, -.575); return g; })();
  const wallI = new THREE.InstancedMesh(boxG, wallM, houses.length + 2), roofI = new THREE.InstancedMesh(roofG, roofM, houses.length + 1), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  houses.forEach(([x, h, z, a, s], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a); m.compose(new THREE.Vector3(x, h - .02, z), q, new THREE.Vector3(.2 * s, .16 * s, .17 * s)); wallI.setMatrixAt(i, m); m.compose(new THREE.Vector3(x, h - .02 + .16 * s, z), q, new THREE.Vector3(.2 * s, .14 * s, .17 * s)); roofI.setMatrixAt(i, m); });
  { const ch = houses.slice().sort((a, b2) => Math.hypot(a[0] - VC[0], a[2] - VC[1]) - Math.hypot(b2[0] - VC[0], b2[2] - VC[1]))[0] || [0, 1, 0], x = ch[0] + .2, z = ch[2] + .2, h = hAt(x, z); q.identity(); m.compose(new THREE.Vector3(x, h, z), q, new THREE.Vector3(.36, .26, .2)); wallI.setMatrixAt(houses.length, m); m.compose(new THREE.Vector3(x + .22, h, z), q, new THREE.Vector3(.1, .62, .1)); wallI.setMatrixAt(houses.length + 1, m);
    m.compose(new THREE.Vector3(x, h + .26, z), q, new THREE.Vector3(.36, .24, .2)); roofI.setMatrixAt(houses.length, m); const sp = new THREE.Mesh(new THREE.ConeGeometry(.075, .32, 4), roofM); sp.rotation.y = Math.PI / 4; sp.position.set(x + .22, h + .62 + .16, z); sp.castShadow = true; island.add(sp); }
  wallI.castShadow = wallI.receiveShadow = roofI.castShadow = roofI.receiveShadow = true; island.add(wallI, roofI);

  /* pines from real fir twigs: tiers of drooping cards around a trunk */
  const firMat = new THREE.MeshStandardMaterial({ map: T.fir, alphaMap: T.firA, alphaTest: .45, normalMap: T.firN, side: THREE.DoubleSide, roughness: .8 }); MATS.push(firMat);
  const pineGeo = (() => { const parts = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), RECT = [.36, .04, .62, .92];
    for (let t = 0; t < 8; t++) { const f = t / 8, y = .12 + f * .78, r = (1 - f) * .3 + .03, n = 7 - Math.floor(f * 3);
      for (let k = 0; k < n; k++) { const a = k / n * TAU + t * .7, dir = new THREE.Vector3(Math.cos(a), -.35, Math.sin(a)).normalize(); q.setFromUnitVectors(up, dir); q.multiply(new THREE.Quaternion().setFromAxisAngle(up, rnd(TAU)));
        const g = new THREE.PlaneGeometry(.22 * (1 - f * .5) + .06, r * 1.4); g.translate(0, r * .7, 0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, RECT[0] + uv.getX(i) * RECT[2], RECT[1] + uv.getY(i) * RECT[3]); m.compose(new THREE.Vector3(0, y, 0), q, new THREE.Vector3(1, 1, 1)); g.applyMatrix4(m); parts.push(g); } }
    const tr = new THREE.CylinderGeometry(.012, .025, .9, 5); tr.translate(0, .45, 0); const tu = tr.attributes.uv; for (let i = 0; i < tu.count; i++) tu.setXY(i, .2, .5); parts.push(tr.toNonIndexed());
    return mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g)); })();
  { const pts = []; for (let t = 0; t < 80000 && pts.length < 1400 * QN; t++) { const x = rnd(-H5 + .15, H5 - .15), z = rnd(-H5 + .15, H5 - .15), h = hAt(x, z); if (h < LAKE + .12 || h > 2.6) continue; const n = normAt(x, z); if (n.y < .7) continue; if (houses.some(o => Math.hypot(o[0] - x, o[2] - z) < .26)) continue; pts.push([x, h, z]); }
    const im = new THREE.InstancedMesh(pineGeo, firMat, pts.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    pts.forEach(([x, h, z], i) => { const s = rnd(.75, 1.4); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd(TAU)); m.compose(new THREE.Vector3(x, h - .02, z), q, new THREE.Vector3(s, s * rnd(.9, 1.3), s)); im.setMatrixAt(i, m); im.setColorAt(i, c.setHSL(.28 + rnd(-.03, .03), .35, rnd(.28, .42))); });
    im.castShadow = im.receiveShadow = true; island.add(im); }

  /* fireworks */
  const AU = makeAudio(); AU.onStart = A => { A.wind = A.loop('lowpass', 300, .5, .05); };
  const NP = 60000, pg = new THREE.BufferGeometry(), pp = new Float32Array(NP * 3), pc = new Float32Array(NP * 4), ps = new Float32Array(NP);
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3).setUsage(THREE.DynamicDrawUsage)); pg.setAttribute('pc', new THREE.BufferAttribute(pc, 4).setUsage(THREE.DynamicDrawUsage)); pg.setAttribute('ps', new THREE.BufferAttribute(ps, 1).setUsage(THREE.DynamicDrawUsage)); pg.setDrawRange(0, 0);
  const pmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 1 } },
    vertexShader: 'attribute vec4 pc; attribute float ps; uniform float uPx; varying vec4 vC; void main(){ vC = pc; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * ps / -mv.z, 1.2, 90.); }',
    fragmentShader: 'varying vec4 vC; void main(){ vec2 d = gl_PointCoord - .5; float r2 = dot(d, d) * 4.; if (r2 > 1.) discard; float a = exp(-r2 * 9.) + .22 * exp(-r2 * 2.2); gl_FragColor = vec4(vC.rgb * a * vC.a, 1.); }' });
  const pts = new THREE.Points(pg, pmat); pts.frustumCulled = false; pts.renderOrder = 6; island.add(pts);
  const PT = [];  // trail particles: x y z vx vy vz age life r g b r2 g2 b2 size a
  const emitP = (x, y, z, vx, vy, vz, life, c0, c1, size, a = 1, g = -.4, head = 0) => { if (PT.length < NP) PT.push({ x, y, z, vx, vy, vz, age: 0, life, c0, c1, size, a, g, head }); };
  const smokeG = new THREE.BufferGeometry(), NS = 1400, sp_ = new Float32Array(NS * 3), sc_ = new Float32Array(NS * 4); smokeG.setAttribute('position', new THREE.BufferAttribute(sp_, 3).setUsage(THREE.DynamicDrawUsage)); smokeG.setAttribute('pc', new THREE.BufferAttribute(sc_, 4).setUsage(THREE.DynamicDrawUsage)); smokeG.setDrawRange(0, 0);
  const smat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPx: { value: 1 } }, vertexShader: 'attribute vec4 pc; uniform float uPx; varying vec4 vC; void main(){ vC = pc; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * .55 / -mv.z, 2., 160.); }',
    fragmentShader: 'varying vec4 vC; void main(){ vec2 d = gl_PointCoord - .5; float r2 = dot(d, d) * 4.; if (r2 > 1.) discard; float a = (1. - r2) * (1. - r2); gl_FragColor = vec4(vC.rgb, a * vC.a); }' });
  const smoke = new THREE.Points(smokeG, smat); smoke.frustumCulled = false; smoke.renderOrder = 5; island.add(smoke); const SM = [];
  const LIGHTS = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight('#fff', 0, 14, 1.6); island.add(l); return l; }); let li = 0;
  const FC = { red: [1, .12, .06], gold: [1, .55, .15], green: [.25, 1, .3], blue: [.2, .35, 1], purple: [.65, .25, 1], white: [1, .95, .85], silver: [.85, .9, 1], orange: [1, .35, .05] }, FK = Object.keys(FC);
  const SPK = [], shells = [];
  const sphere = sp => { const th = rnd(TAU), ph = Math.acos(rnd(-1, 1)); return [Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp]; };
  const spark = (x, y, z, v, o) => SPK.push(Object.assign({ x, y, z, vx: v[0], vy: v[1], vz: v[2], age: 0, life: rnd(2.6, 3.8), col: FC.white, end: [.9, .25, .05], drag: .75, g: .8, trail: .9, I: 4, size: .085, ph: rnd(TAU) }, o));
  function burst(sh) { const { x, y, z, kind } = sh, A = FC[sh.c1], B = FC[sh.c2], sc = rnd(2.2, 2.9);
    if (kind === 'peony' || kind === 'double') { for (let i = 0; i < 220; i++) spark(x, y, z, sphere(rnd(1.25, 1.45) * sc), { col: R() < .55 ? A : B }); if (kind === 'double') for (let i = 0; i < 90; i++) spark(x, y, z, sphere(.6 * sc), { col: FC.white, end: B, life: rnd(1.8, 2.4), trail: .6 }); }
    else if (kind === 'chrys') for (let i = 0; i < 180; i++) spark(x, y, z, sphere(rnd(1.3, 1.5) * sc), { col: A, trail: 1.8, life: rnd(2.8, 3.6) });
    else if (kind === 'willow') for (let i = 0; i < 110; i++) spark(x, y, z, sphere(rnd(.9, 1.05) * sc), { col: FC.gold, end: [.8, .3, .04], drag: 1.6, g: .42, life: rnd(4.2, 5.4), trail: 3.2, I: 3 });
    else if (kind === 'ring') { const ax = new THREE.Vector3(rnd(-1, 1), rnd(.4, 1), rnd(-1, 1)).normalize(), e1 = new THREE.Vector3(1, 0, 0).cross(ax).normalize(), e2 = ax.clone().cross(e1); for (let i = 0; i < 130; i++) { const a = i / 130 * TAU, s = 1.6 * sc; spark(x, y, z, [(e1.x * Math.cos(a) + e2.x * Math.sin(a)) * s, (e1.y * Math.cos(a) + e2.y * Math.sin(a)) * s, (e1.z * Math.cos(a) + e2.z * Math.sin(a)) * s], { col: A }); } }
    else if (kind === 'palm') for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; spark(x, y, z, [Math.cos(a) * 1.3 * sc, rnd(.9, 1.3) * sc, Math.sin(a) * 1.3 * sc], { col: FC.gold, drag: .7, life: 3.2, trail: 2, size: .1, comet: 1, I: 4 }); }
    else if (kind === 'crossette') for (let i = 0; i < 18; i++) spark(x, y, z, sphere(1.4 * sc), { col: A, life: 1.1, split: 1 });
    else if (kind === 'strobe') for (let i = 0; i < 160; i++) spark(x, y, z, sphere(rnd(1, 1.4) * sc), { col: FC.white, end: FC.silver, trail: .1, life: rnd(3, 4.2), strobe: 1, g: .6, I: 4.5 });
    else if (kind === 'kamuro') for (let i = 0; i < 140; i++) spark(x, y, z, sphere(rnd(1.1, 1.3) * sc), { col: [1, .7, .35], end: [.7, .35, .1], drag: 1.3, g: .5, life: rnd(4, 5.2), trail: 2.6, crackle: 1, I: 3.2 });
    else if (kind === 'crackle') for (let i = 0; i < 140; i++) spark(x, y, z, sphere(rnd(1.2, 1.4) * sc), { col: FC.gold, trail: 1, life: rnd(2, 2.6), crackle: 1 });
    for (let i = 0; i < 26; i++) { if (SM.length >= NS) SM.shift(); SM.push({ x: x + rnd(-.4, .4), y: y + rnd(-.4, .4), z: z + rnd(-.4, .4), vx: rnd(-.04, .04) + .05, vy: rnd(-.02, .03), vz: rnd(-.04, .04), age: 0, life: rnd(9, 13), c: A }); }
    const l = LIGHTS[li++ % 4]; l.position.set(x, y, z); l.color.setRGB(...A); l.intensity = 55; l.userData.k = 1;
    const dist = ctx.camera.position.distanceTo(new THREE.Vector3(x, y, z)), delay = Math.min(.8, dist * .012); AU.burst(2.4, 380, rnd(.35, .55), 'lowpass', delay); AU.burst(.25, 2600, .08, 'highpass', delay);
    if (kind === 'crackle' || kind === 'strobe' || kind === 'kamuro') for (let i = 0; i < 14; i++) AU.burst(.03, 4200, .05, 'highpass', delay + rnd(1, 2.6)); }
  function launch(fin) { const a = rnd(TAU), r = Math.sqrt(R()) * 2, x = clamp(VC[0] + .6 + Math.cos(a) * r, -3.8, 3.8), z = clamp(VC[1] + .6 + Math.sin(a) * r, -3.8, 3.8), y0 = Math.max(hAt(x, z), LAKE) + .05, H = Math.max(y0 + 3, rnd(5.8, 7.6) + (fin ? rnd(-.4, .6) : 0)), g = 3.4;
    const kinds = fin ? ['peony', 'chrys', 'kamuro', 'strobe', 'willow', 'peony', 'crackle'] : ['peony', 'chrys', 'willow', 'ring', 'palm', 'crossette', 'strobe', 'crackle', 'double', 'kamuro'];
    shells.push({ x, y: y0, z, vx: rnd(-.15, .15), vy: Math.sqrt(2 * g * (H - y0)), vz: rnd(-.15, .15), g, kind: pick(kinds), c1: pick(FK), c2: pick(FK) }); if (R() < .35) AU.tone(rnd(700, 900), rnd(1800, 2400), 1, .05); else AU.burst(.6, 1200, .06, 'bandpass'); }
  let show = null, idle = rnd(2, 4); const api = { ev: () => { AU.get(); show = { t: 0, next: 0 }; }, rain: lv => { snow.visible = lv > 0; snow.geometry.setDrawRange(0, Math.round(5000 * QN * lv / 3)); }, get evOn() { return !!show; } };
  // snowfall
  const snow = (() => { const n = Math.round(5000 * QN), p = new Float32Array(n * 3); for (let i = 0; i < n; i++) p.set([rnd(-H5, H5), rnd(0, 7), rnd(-H5, H5)], i * 3); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: U.uTime, uPx: pmat.uniforms.uPx }, vertexShader: 'uniform float uT, uPx; void main(){ vec3 p = position; p.y = mod(p.y - uT * .35, 7.); p.x += sin(uT * .6 + p.y * 2. + position.z) * .12; vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = max(1., uPx * .025 / -mv.z); }', fragmentShader: 'void main(){ float r = length(gl_PointCoord - .5) * 2.; if (r > 1.) discard; gl_FragColor = vec4(vec3(.9, .93, 1.), (1. - r) * .7); }' });
    const s = new THREE.Points(g, m); s.frustumCulled = false; s.visible = false; island.add(s); return s; })();

  const pv = new THREE.Vector3();
  ctx.steps.push(dt => {
    const t = ctx.clock; lake.material.uniforms.time.value = t * .35; { const a = t * .05; fish.position.set(2.6 + Math.cos(a) * 1.5, DZ(-3.5 + Math.sin(t * .3) * .15), 3.2 + Math.sin(a) * 1.1); fish.rotation.y = -a - Math.PI / 2; } pmat.uniforms.uPx.value = smat.uniforms.uPx.value = ctx.renderer.domElement.height / (2 * Math.tan(ctx.camera.fov * Math.PI / 360));
    // schedule: an occasional shell at rest; on EVENT a 32 s show that builds to a finale
    if (show) { show.t += dt; show.next -= dt; const s = show.t; if (show.next <= 0) { const fin = s > 26; show.next = fin ? rnd(.12, .22) : s < 4 ? rnd(1, 1.5) : rnd(.45, .9); const n = fin ? 1 : R() < .25 ? 2 : 1; for (let k = 0; k < n; k++) launch(fin); } if (s > 32) { show = null; } }
    else { idle -= dt; if (idle <= 0) { idle = rnd(4, 8); launch(false); } }
    shells.forEach(sh => { sh.vy -= sh.g * dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.z += sh.vz * dt; for (let q = 0; q < 3; q++) emitP(sh.x, sh.y - q * .015, sh.z, rnd(-.08, .08), rnd(-.3, -.05), rnd(-.08, .08), rnd(.5, 1.1), [2.4, 1.4, .6], [.5, .12, .02], .04, 1, -.6); if (sh.vy < .2) { sh.dead = 1; burst(sh); } });
    for (let i = shells.length - 1; i >= 0; i--) if (shells[i].dead) shells.splice(i, 1);
    for (let i = SPK.length - 1; i >= 0; i--) { const p = SPK[i]; p.age += dt; const k = p.age / p.life;
      if (p.split && p.age > p.life) { const ax = new THREE.Vector3(p.vx, p.vy, p.vz).normalize(), e1 = new THREE.Vector3(0, 1, 0).cross(ax).normalize(), e2 = ax.clone().cross(e1); [e1, e2, e1.clone().negate(), e2.clone().negate()].forEach(e => spark(p.x, p.y, p.z, [p.vx * .3 + e.x * 1.1, p.vy * .3 + e.y * 1.1, p.vz * .3 + e.z * 1.1], { col: FC[pick(['white', 'gold', 'silver'])], life: rnd(1.8, 2.4), trail: .9 })); SPK.splice(i, 1); continue; }
      if (k >= 1) { SPK.splice(i, 1); continue; }
      const dr = Math.max(0, 1 - p.drag * dt); p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      let b = (1 - Math.pow(k, 2.2)) * p.I; if (k > .55) b *= .7 + .3 * Math.sin(p.age * 30 + p.ph); if (p.strobe) b *= Math.sin(p.age * 34 + p.ph) > .3 ? 1.6 : .03; if (p.crackle && k > .65) b *= R() < .45 ? 2 : .15;
      const m = Math.pow(k, 1.3), c = [lerp(p.col[0], p.end[0], m) * b, lerp(p.col[1], p.end[1], m) * b, lerp(p.col[2], p.end[2], m) * b];
      emitP(p.x, p.y, p.z, 0, 0, 0, dt * 1.5, c, c, p.size * (1.1 - k * .4), 1, 0, 1);
      if (R() < .5) emitP(p.x, p.y, p.z, rnd(-.02, .02), -.03, rnd(-.02, .02), p.trail * rnd(.6, 1), [c[0] * .3, c[1] * .26, c[2] * .22], [c[0] * .03, c[1] * .01, 0], p.size * .5, 1, -.12);
      if (p.comet && R() < .6) emitP(p.x, p.y, p.z, rnd(-.2, .2), rnd(-.3, .05), rnd(-.2, .2), rnd(.5, 1), [2.4, 1.6, .8], [.4, .12, .02], .03, 1, -1); }
    let n = 0; for (let i = PT.length - 1; i >= 0; i--) { const p = PT[i]; p.age += dt; if (p.age >= p.life) { PT[i] = PT[PT.length - 1]; PT.pop(); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
    for (const p of PT) { const k = p.age / p.life, f = 1 - k; pp[n * 3] = p.x; pp[n * 3 + 1] = p.y; pp[n * 3 + 2] = p.z; pc[n * 4] = lerp(p.c0[0], p.c1[0], k); pc[n * 4 + 1] = lerp(p.c0[1], p.c1[1], k); pc[n * 4 + 2] = lerp(p.c0[2], p.c1[2], k); pc[n * 4 + 3] = p.head ? p.a : p.a * f * f; ps[n] = p.size; n++; }
    pg.setDrawRange(0, n); pg.attributes.position.needsUpdate = pg.attributes.pc.needsUpdate = pg.attributes.ps.needsUpdate = true;
    let m2 = 0; for (let i = SM.length - 1; i >= 0; i--) { const s = SM[i]; s.age += dt; if (s.age > s.life) { SM.splice(i, 1); continue; } s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; }
    for (const s of SM) { const k = s.age / s.life, lit = Math.exp(-s.age * 1.6) * 2.2; sp_[m2 * 3] = s.x; sp_[m2 * 3 + 1] = s.y; sp_[m2 * 3 + 2] = s.z; const lt = lit * .25; sc_[m2 * 4] = .03 + s.c[0] * lt; sc_[m2 * 4 + 1] = .035 + s.c[1] * lt; sc_[m2 * 4 + 2] = .045 + s.c[2] * lt; sc_[m2 * 4 + 3] = .22 * Math.min(1, s.age * 3) * (1 - k); m2++; }
    smokeG.setDrawRange(0, m2); smokeG.attributes.position.needsUpdate = smokeG.attributes.pc.needsUpdate = true;
    LIGHTS.forEach(l => { l.intensity *= Math.exp(-dt * 2.4); });
    winU.value = .9 + .1 * Math.sin(t * .7);
  });
  { const done = new Set(); island.traverse(o => { if (!o.isMesh || !o.material || done.has(o.material) || o.material === lwm || o.material.isShaderMaterial || o === lake || o === wl) return; done.add(o.material); underwater(o.material, LAKE, .7, [.002, .008, .01]); }); }
  ctx.api = api; return ctx;
}
