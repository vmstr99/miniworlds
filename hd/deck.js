/* The deck: the classic K-9's nine keys in soft plastic, drawn as an overlay in its own small scene below the world.
   Engraved icons change with each key's level, dots and an LED show the setting, keys sink with a spring and click.
   Centre key: WORLD. Around it: TIME, CLOUDS, RAIN / WIND, GLOW / EVENT, LIFE, SPIN. */
import { THREE, TAU, clamp, lerp, rnd, pick, REDUCE } from './core.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const KEYDEF = [
  { id: 'time', label: 'TIME', key: 'T', levels: ['Dawn', 'Noon', 'Dusk', 'Night'] },
  { id: 'clouds', label: 'CLOUDS', key: 'C', levels: ['Clear', 'Fair', 'Overcast', 'Storm'] },
  { id: 'rain', label: 'RAIN', key: 'R', levels: ['Dry', 'Drizzle', 'Rain', 'Downpour'] },
  { id: 'wind', label: 'WIND', key: 'W', levels: ['Calm', 'Breeze', 'Windy', 'Gale'] },
  { id: 'world', label: 'WORLD', key: ' ' },
  { id: 'glow', label: 'GLOW', key: 'G', levels: ['Off', 'Dim', 'Warm', 'Bright'] },
  { id: 'event', label: 'EVENT', key: 'E' },
  { id: 'life', label: 'LIFE', key: 'L', levels: ['Empty', 'Few', 'Busy', 'Teeming'] },
  { id: 'spin', label: 'SPIN', key: 'S' }
];
const KIND = i => ({ 2: 'brown', 4: 'amber', 6: 'rust', 8: 'teal' })[i] || 'putty';
const KEYCOL = { putty: ['#c9c2b6', '#4a4d54'], brown: ['#6e4429', '#5e3a23'], rust: ['#b4502a', '#a3482a'], amber: ['#e8842c', '#d9782a'], teal: ['#23968f', '#1f8780'] };
const PENTA = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

export function createDeck(E, { onPress, MOD, evOn }) {
  const { renderer } = E, NK = 9, SP = 1.85;
  const dark = () => document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(24, 1, .1, 100);
  { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); }
  scene.add(new THREE.HemisphereLight('#fffaf2', '#8a8278', .9));
  const key = new THREE.DirectionalLight('#fff4e6', 2.4); key.position.set(-4, 9, 3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 }); key.shadow.bias = -.0008; key.shadow.radius = 4; scene.add(key);

  const rr = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const keyGeo = new THREE.ExtrudeGeometry(rr(1.4, 1.4, .3), { depth: .34, bevelEnabled: true, bevelThickness: .1, bevelSize: .09, bevelSegments: 6, curveSegments: 10 }); keyGeo.rotateX(-Math.PI / 2); keyGeo.translate(0, .1, 0);
  const baseGeo = new THREE.ExtrudeGeometry(rr(5.9, 5.9, .75), { depth: .5, bevelEnabled: true, bevelThickness: .14, bevelSize: .14, bevelSegments: 6, curveSegments: 12 }); baseGeo.rotateX(-Math.PI / 2); baseGeo.translate(0, -.64, 0);
  const keyMats = {}; Object.keys(KEYCOL).forEach(k => keyMats[k] = new THREE.MeshPhysicalMaterial({ roughness: .5, clearcoat: .25, clearcoatRoughness: .55, sheen: .3, sheenRoughness: .8, envMapIntensity: .55 }));
  const baseMat = new THREE.MeshPhysicalMaterial({ roughness: .72, clearcoat: .1, envMapIntensity: .5 });
  const deck = new THREE.Group(); scene.add(deck);
  const base = new THREE.Mesh(baseGeo, baseMat); base.receiveShadow = base.castShadow = true; deck.add(base);
  ['#6e4429', '#b4502a', '#e8842c'].forEach((h, i) => { const m = new THREE.MeshStandardMaterial({ color: h, roughness: .6 }); const a = new THREE.Mesh(new THREE.BoxGeometry(4.4, .08, .03), m); a.position.set(0, -.2 - i * .12, 3.1); const b = a.clone(); b.rotation.y = Math.PI / 2; b.position.set(3.1, -.2 - i * .12, 0); deck.add(a, b); });
  // a soft contact shadow so the deck sits on the scene instead of floating in it
  const blobTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.6, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); })();
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 9.5), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: .8 })); m.rotation.x = -Math.PI / 2; m.position.y = -.8; deck.add(m); }

  const keys = [], keyMeshes = [], ledMats = [], decals = [], kDist = [];
  const ky = new Float32Array(NK), kv = new Float32Array(NK), kHeld = new Uint8Array(NK), kDownT = new Float32Array(NK).fill(-9), ripT = new Float32Array(NK).fill(-9), ledT = new Float32Array(NK).fill(-99);
  const ledGeo = new THREE.CylinderGeometry(.08, .08, .03, 20), decalGeo = new THREE.PlaneGeometry(1.3, 1.3); decalGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < NK; i++) { const r = Math.floor(i / 3), c = i % 3, g = new THREE.Group(); g.position.set((c - 1) * SP, 0, (r - 1) * SP);
    const m = new THREE.Mesh(keyGeo, keyMats[KIND(i)]); m.castShadow = m.receiveShadow = true; m.userData.i = i; g.add(m);
    const lm = new THREE.MeshStandardMaterial({ color: '#4a3c30', emissive: '#ff9a3a', emissiveIntensity: 0, roughness: .3 }); const led = new THREE.Mesh(ledGeo, lm); led.position.set(-.48, .555, -.48); g.add(led);
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const dm = new THREE.Mesh(decalGeo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, envMapIntensity: .3 })); dm.position.y = .545; dm.rotation.y = Math.PI / 4; dm.receiveShadow = true; g.add(dm);
    deck.add(g); keys.push(g); keyMeshes.push(m); ledMats.push(lm); decals.push({ canvas: cv, tex }); kDist.push(Math.hypot(r - 1, c - 1)); }

  function drawIcon(x, id, lv, ink) {
    x.save(); x.translate(128, 112); x.scale(1.45, 1.45); x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = 9; x.lineCap = 'round'; x.lineJoin = 'round';
    const line = (a, b, c2, d) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); };
    const rays = (r0, r1, n, a0, a1) => { for (let k = 0; k < n; k++) { const a = a0 + (a1 - a0) * (k + .5) / n; line(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1); } };
    const cloud = (cx, cy, sc, fill) => { x.beginPath(); x.moveTo(cx - 36 * sc, cy + 20 * sc); x.arc(cx - 22 * sc, cy + 4 * sc, 16 * sc, Math.PI * .5, Math.PI * 1.45); x.arc(cx + 2 * sc, cy - 10 * sc, 23 * sc, Math.PI * 1.05, Math.PI * 1.95); x.arc(cx + 25 * sc, cy + 6 * sc, 14 * sc, -Math.PI * .55, Math.PI * .5); x.closePath(); fill ? x.fill() : x.stroke(); };
    const cut = fn => { x.save(); x.globalCompositeOperation = 'destination-out'; fn(); x.restore(); };
    if (id === 'time') {
      if (lv === 1) { x.beginPath(); x.arc(0, 0, 21, 0, TAU); x.fill(); rays(33, 47, 8, 0, TAU); }
      else if (lv === 3) { x.beginPath(); x.arc(-4, 2, 32, 0, TAU); x.fill(); cut(() => { x.beginPath(); x.arc(14, -10, 28, 0, TAU); x.fill(); }); x.beginPath(); x.arc(30, 26, 5, 0, TAU); x.fill(); }
      else { const y0 = lv === 0 ? 14 : 22; x.beginPath(); x.arc(0, y0, 23, Math.PI, TAU); x.fill(); line(-52, y0 + 4, 52, y0 + 4); if (lv === 0) rays(34, 48, 5, Math.PI, TAU); else { line(-36, y0 + 20, 36, y0 + 20); line(-18, y0 + 34, 18, y0 + 34); } }
    } else if (id === 'clouds') {
      if (lv === 0) { x.beginPath(); x.arc(0, 0, 18, 0, TAU); x.stroke(); rays(30, 42, 8, 0, TAU); }
      else { cloud(0, 4, 1.15, lv >= 2); if (lv === 3) cut(() => { x.beginPath(); x.moveTo(6, -14); x.lineTo(-10, 12); x.lineTo(4, 12); x.lineTo(-6, 34); x.lineTo(16, 4); x.lineTo(2, 4); x.lineTo(12, -14); x.closePath(); x.fill(); }); }
    } else if (id === 'rain') {
      cloud(0, -16, .9, false); const n = [0, 2, 3, 5][lv];
      for (let k = 0; k < n; k++) { const dx = (k - (n - 1) / 2) * 20, dy = 30 + (k % 2) * 12; x.beginPath(); x.moveTo(dx, dy - 12); x.quadraticCurveTo(dx + 8, dy + 2, dx, dy + 6); x.quadraticCurveTo(dx - 8, dy + 2, dx, dy - 12); x.fill(); }
    } else if (id === 'wind') {
      const n = lv + 1; for (let k = 0; k < n; k++) { const y = (k - (n - 1) / 2) * 22, L = 34 + (k % 2 ? 6 : 18) + lv * 2; x.beginPath(); x.moveTo(-L, y); x.lineTo(L - 12, y); x.arc(L - 12, y - 10, 10, Math.PI * .5, -Math.PI * .6, true); x.stroke(); }
    } else if (id === 'world') {
      x.beginPath(); x.moveTo(0, -46); x.lineTo(42, -23); x.lineTo(42, 23); x.lineTo(0, 46); x.lineTo(-42, 23); x.lineTo(-42, -23); x.closePath(); x.stroke();
      x.globalAlpha = .35; x.beginPath(); x.moveTo(0, -46); x.lineTo(42, -23); x.lineTo(0, 0); x.lineTo(-42, -23); x.closePath(); x.fill(); x.globalAlpha = 1;
      line(0, 0, 0, 46); line(0, 0, 42, -23); line(0, 0, -42, -23); x.lineWidth = 6; line(-20, -18, -6, -30); line(-6, -30, 10, -14);
    } else if (id === 'glow') {
      x.beginPath(); x.arc(0, -8, 22, Math.PI * .8, Math.PI * 2.2); x.lineTo(10, 18); x.lineTo(-10, 18); x.closePath(); lv > 0 ? x.fill() : x.stroke(); line(-11, 28, 11, 28); line(-7, 37, 7, 37);
      rays(34, 46, [0, 3, 5, 7][lv], Math.PI * 1.05, Math.PI * 1.95);
    } else if (id === 'event') {
      x.beginPath(); for (let k = 0; k < 16; k++) { const r = k % 2 ? 19 : (k % 4 ? 38 : 48), a = k / 16 * TAU - Math.PI / 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill();
    } else if (id === 'life') {
      x.beginPath(); x.ellipse(0, 16, 22, 18, 0, 0, TAU); x.fill(); [[-30, -10], [-11, -28], [11, -28], [30, -10]].forEach(([px, py]) => { x.beginPath(); x.ellipse(px, py, 9, 11, px * .012, 0, TAU); x.fill(); });
    } else if (id === 'spin') {
      x.beginPath(); x.arc(0, 0, 34, -Math.PI * .35, Math.PI * 1.35); x.stroke(); const a = Math.PI * 1.35, ex = Math.cos(a) * 34, ey = Math.sin(a) * 34; x.beginPath(); x.moveTo(ex - 14, ey - 4); x.lineTo(ex + 6, ey - 10); x.lineTo(ex + 2, ey + 12); x.closePath(); x.fill();
    }
    x.restore();
  }
  function drawDecal(i) {
    const d = KEYDEF[i], x = decals[i].canvas.getContext('2d'), kind = KIND(i), light = kind !== 'putty' && kind !== 'amber' || (kind === 'putty' && dark());
    const ink = light ? 'rgba(255,246,234,.95)' : 'rgba(40,32,24,.9)', ghost = light ? 'rgba(255,246,234,.28)' : 'rgba(40,32,24,.22)', lv = MOD[d.id] ?? 0;
    x.clearRect(0, 0, 256, 256); x.save(); x.translate(0, 2); x.globalAlpha = .5; drawIcon(x, d.id, lv, light ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.6)'); x.restore(); drawIcon(x, d.id, lv, ink);
    if (d.levels) for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(92 + k * 24, 222, 8, 0, TAU); x.fillStyle = (d.id === 'time' ? k === lv : k <= lv && lv > 0) ? ink : ghost; x.fill(); }
    decals[i].tex.needsUpdate = true; }
  const redraw = () => { const d = dark() ? 1 : 0; Object.keys(KEYCOL).forEach(k => keyMats[k].color.set(KEYCOL[k][d])); baseMat.color.set(d ? '#303236' : '#bdb6aa'); for (let i = 0; i < NK; i++) drawDecal(i); };
  redraw(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', redraw);

  /* layout: a viewport at the bottom of the screen, the deck seen from the front corner and leaning toward the viewer */
  const rect = { x: 0, y: 0, w: 0, h: 0 };
  const layout = () => { const port = innerWidth < innerHeight * .9, pr = document.getElementById('sab'), sb = pr ? parseFloat(getComputedStyle(pr).paddingBottom) || 0 : 0;
    rect.w = Math.round(port ? Math.min(innerWidth * .8, 420, innerHeight * .44) : Math.min(innerWidth * .3, innerHeight * .44, 440)); rect.h = Math.round(rect.w * .72);
    rect.x = Math.round((innerWidth - rect.w) / 2); rect.y = Math.round(Math.max(6, sb)); cam.aspect = rect.w / rect.h;
    const el = .84, t = Math.tan(cam.fov * Math.PI / 360), dW = 8.9 / (2 * t * cam.aspect), dH = (8.4 * Math.sin(el) + 1.2) / (2 * t), d = Math.max(dW, dH) * 1.02;
    cam.position.set(Math.cos(el) * d * .7071, Math.sin(el) * d, Math.cos(el) * d * .7071); cam.lookAt(0, -.3, 0); cam.updateProjectionMatrix(); E.setDeckH(rect.h + rect.y); };
  layout(); E.onResize.push(layout);

  /* sound */
  const A = () => E.AUD.get();
  const tone = (f, dur, o = {}) => { const c = A(); if (!c || E.AUD.muted) return; const t = c.currentTime + (o.when || 0), os = c.createOscillator(), g = c.createGain(); os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t); if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + dur); let n = os;
    if (o.filter) { const fl = c.createBiquadFilter(); fl.type = o.filter; fl.frequency.value = o.ff || 1000; os.connect(fl); n = fl; } g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || .05, t + (o.attack || .005)); g.gain.exponentialRampToValueAtTime(.0001, t + dur); n.connect(g); g.connect(E.AUD.master); os.start(t); os.stop(t + dur + .05); };
  const noise = (dur, o = {}) => { const c = A(); if (!c || E.AUD.muted) return; const t = c.currentTime + (o.when || 0), s = c.createBufferSource(); s.buffer = E.AUD.noise; const f = c.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.frequency.setValueAtTime(o.ff || 1000, t); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur); f.Q.value = o.q || 1;
    const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || .05, t + (o.attack || .004)); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f); f.connect(g); g.connect(E.AUD.master); s.start(t, Math.random()); s.stop(t + dur + .05); };
  const sfx = { click() { noise(.016, { filter: 'highpass', ff: 3400, vol: .13 }); tone(190, .07, { to: 68, vol: .16, filter: 'lowpass', ff: 900 }); noise(.08, { filter: 'bandpass', ff: 480, q: 1.3, vol: .1, when: .01 }); tone(2600, .02, { type: 'triangle', vol: .018 }); },
    clack() { noise(.012, { filter: 'highpass', ff: 4400, vol: .07 }); tone(340, .045, { to: 190, vol: .06, filter: 'lowpass', ff: 1500 }); },
    arrive() { noise(.9, { filter: 'bandpass', ff: 300, to: 1800, q: 1.2, vol: .025, attack: .4 }); tone(pick(PENTA) * 2, 1.6, { vol: .022, when: .6 }); },
    level(lv) { tone(PENTA[3 + lv * 2], .25, { type: 'triangle', vol: .05 }); }, whoosh() { noise(.5, { filter: 'bandpass', ff: 600, to: 1400, vol: .05 }); } };

  /* input: the deck claims presses that land on a key; everything else falls through to orbiting the world */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ptrs = new Map();
  const hit = (cx, cy) => { const y = innerHeight - cy; if (cx < rect.x || cx > rect.x + rect.w || y < rect.y || y > rect.y + rect.h) return -1; ndc.set((cx - rect.x) / rect.w * 2 - 1, (y - rect.y) / rect.h * 2 - 1); ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(keyMeshes, false)[0]; return h ? h.object.userData.i : -1; };
  const down = i => { kHeld[i] = 1; press(i); }, up = i => { if (!kHeld[i]) return; kHeld[i] = 0; sfx.clack(); };
  function press(i) { const t = E.clock; sfx.click(); kDownT[i] = t; ledT[i] = t; try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
    for (let j = 0; j < NK; j++) if (j !== i) ripT[j] = t + Math.hypot(j % 3 - i % 3, Math.floor(j / 3) - Math.floor(i / 3)) * .07;
    onPress(KEYDEF[i], i); }
  const pointerFilter = e => { const i = hit(e.clientX, e.clientY); if (i < 0) return; e.stopImmediatePropagation(); e.preventDefault(); ptrs.set(e.pointerId, i); down(i); };
  addEventListener('pointerup', e => { const i = ptrs.get(e.pointerId); if (i === undefined) return; ptrs.delete(e.pointerId); up(i); });
  addEventListener('pointercancel', e => { const i = ptrs.get(e.pointerId); if (i === undefined) return; ptrs.delete(e.pointerId); up(i); });
  let hov = false; E.renderer.domElement.addEventListener('pointermove', e => { if (hov || e.buttons) return; hov = true; requestAnimationFrame(() => { hov = false; E.renderer.domElement.style.cursor = hit(e.clientX, e.clientY) >= 0 ? 'pointer' : 'grab'; }); });
  addEventListener('blur', () => { kHeld.fill(0); ptrs.clear(); });

  /* draw: spring the keys, run the LEDs, render into the bottom viewport */
  const render = dt => { const t = E.clock, ev = evOn();
    for (let j = 0; j < NK; j++) {
      const dn = kHeld[j] || t - kDownT[j] < .085, tgt = dn ? -.25 : 0, K = dn ? 2800 : 560, D = dn ? 85 : 15, n = Math.ceil(dt / (1 / 120));
      for (let q = 0; q < n; q++) { kv[j] += ((tgt - ky[j]) * K - kv[j] * D) * (dt / n); ky[j] += kv[j] * (dt / n); if (ky[j] < -.27) { ky[j] = -.27; kv[j] = 0; } }
      keys[j].position.y = ky[j]; keys[j].rotation.x = clamp(kv[j] * .004, -.04, .04) * (j % 3 - 1 || .5); keys[j].rotation.z = clamp(kv[j] * .004, -.04, .04) * (Math.floor(j / 3) - 1);
      const e = t - ledT[j], er = t - ripT[j]; let I = e >= 0 ? Math.max(0, 1 - e / .55) * 2.4 : 0; if (er >= 0 && er < .4) I = Math.max(I, (1 - er / .4) * .9);
      const d = KEYDEF[j]; if (d.levels) I = Math.max(I, d.id === 'time' ? .5 : MOD[d.id] / 3 * 1.5); else if (d.id === 'world') I = Math.max(I, .9 + .4 * Math.sin(t * 2.5)); else if (d.id === 'event' && ev) I = Math.max(I, 1.2 + .6 * Math.sin(t * 6));
      ledMats[j].emissiveIntensity = I; }
    const exp = renderer.toneMappingExposure; renderer.toneMappingExposure = 1;
    renderer.setScissorTest(true); renderer.setViewport(rect.x, rect.y, rect.w, rect.h); renderer.setScissor(rect.x, rect.y, rect.w, rect.h); renderer.clearDepth(); renderer.render(scene, cam);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.toneMappingExposure = exp; };
  E.overlays.push(render);
  return { pointerFilter, press: i => { down(i); setTimeout(() => up(i), 120); }, down, up, redraw, drawDecal, sfx, rect, ledAll() { for (let j = 0; j < NK; j++) ledT[j] = E.clock + kDist[j] * .09; } };
}
