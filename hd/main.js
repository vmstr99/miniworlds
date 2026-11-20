/* Wonder Deck HD: the engine, the deck and the weather are created once; WORLD sinks the current diorama into the deck and
   raises the next one without reloading. Each world module (palau.js, vesuvius.js, alps.js, dunes.js, city.js) builds its
   scene on the shared engine in core.js. ?world=<id> or #<id> opens a world; &ev=1 fires its event, &ff=<s> fast-forwards,
   &time=0..3 sets the time of day, &q=lo|hi forces a quality tier. */
import { initEngine, Q, $, sm, clamp, LO } from './core.js';
import { createFX } from './fx.js';
import { createDeck, KEYDEF } from './deck.js';

const WORLDS = { palau: () => import('./palau.js'), vesuvius: () => import('./vesuvius.js'), alps: () => import('./alps.js'), dunes: () => import('./dunes.js'), city: () => import('./city.js'), amazon: () => import('./amazon.js') };
const ORDER = ['palau', 'vesuvius', 'alps', 'dunes', 'city', 'amazon'], BASE = { time: 1, clouds: 1, rain: 0, wind: 1, glow: 1, life: 2 };
let deck = null, busy = false, cur = null, meta = null, queued = false;
const E = initEngine({ pointerFilter: e => deck && deck.pointerFilter(e) });
createFX(E);
const evOn = () => !!(E.world && E.world.api && E.world.api.evOn);
deck = createDeck(E, { MOD: E.MOD, evOn, onPress });
const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

/* HUD */
const readout = $('#readout'); let count = store.get('k9hd-worlds', 0);
const say = t => { readout.textContent = t; readout.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 250 }); };
const updCount = () => { $('#count').textContent = String(count % 10000).padStart(4, '0'); };
const cap = M => { const p = $('#plaque'); p.classList.remove('show'); setTimeout(() => { $('#cn').textContent = M.name; $('#cl').textContent = M.line; $('#ce').textContent = M.era; p.classList.add('show'); }, 350); };
const mute = $('#mute'), syncMute = () => { mute.setAttribute('aria-pressed', String(!E.AUD.muted)); $('#muteLbl').textContent = E.AUD.muted ? 'Sound off' : 'Sound on'; };
E.AUD.muted = store.get('k9hd-muted', false); syncMute();
mute.addEventListener('click', () => { E.AUD.muted = !E.AUD.muted; store.set('k9hd-muted', E.AUD.muted); const c = E.AUD.get(); if (c) c[E.AUD.muted ? 'suspend' : 'resume'](); syncMute(); });
updCount();

/* arrival and departure: the world rises out of the deck with a little overshoot, and sinks back into it */
let anim = null; const easeOutBack = t => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
E.fx.push({ step(dt) { if (!anim || !anim.isl) return; anim.t += dt; const k = clamp(anim.t / anim.d, 0, 1);
  if (anim.kind === 'in') { anim.isl.scale.setScalar(Math.max(.001, easeOutBack(k))); anim.isl.position.y = (1 - sm(k)) * -2.2; anim.isl.rotation.y = (1 - sm(k)) * -.5; E.applyCam(k); }
  else { const e = k * k; anim.isl.scale.setScalar(Math.max(.001, 1 - e)); anim.isl.position.y = -2.4 * e; anim.isl.rotation.y = e * .4; }
  if (k >= 1) { const r = anim.res; anim = null; r && r(); } } });
const play = (kind, isl, d) => new Promise(res => { anim = { kind, isl, d, t: 0, res }; });
const frame = () => new Promise(r => requestAnimationFrame(() => r()));

async function load(id, first) {
  busy = true; E.busy = true; say('LOADING'); const modP = WORLDS[id]();
  const mk = n => (window.__marks = window.__marks || []).push([n, performance.now()]); mk('out');
  if (E.world) { deck.sfx.whoosh(); await play('out', E.world.island, .45); mk('outEnd'); E.unmount(); }
  let mod; try { mod = await modP; } catch (e) { console.error(e); say('LOAD FAILED'); busy = false; return; }
  meta = mod.META; Object.assign(E.MOD, BASE, meta.preset || {}); if (first && Q.has('time')) E.MOD.time = clamp(+Q.get('time'), 0, 3);
  deck.redraw(); await frame();
  const ctx = mod.build(); ctx.meta = meta; ctx.id = id; cur = id;
  ['rain', 'glow', 'life', 'wind', 'clouds'].forEach(k => { if (ctx.api && ctx.api[k]) ctx.api[k](E.MOD[k]); });
  await E.waitReady();
  // warm everything up off screen: compile every material (hidden ones too) with its shadow and transmission variants and
  // upload every texture, so the world rises without a single hitch
  // (each reveal is synchronous: the render loop must never see the new world at full size before it rises)
  { const hidden = [], show = on => { if (on) { ctx.island.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } }); ctx.island.scale.setScalar(1); } else { hidden.forEach(o => { o.visible = false; }); hidden.length = 0; ctx.island.scale.setScalar(.001); } };
    let pr = null; show(true); try { if (E.renderer.compileAsync) pr = E.renderer.compileAsync(E.scene, E.camera); } catch (e) {} show(false);
    if (pr) { try { await Promise.race([pr, new Promise(r => setTimeout(r, 2500))]); } catch (e) {} }
    show(true); E.composer.renderToScreen = false; E.step(0); E.composer.render(); E.composer.render(); E.composer.renderToScreen = true; show(false); await frame(); }
  E.ready = true; E.spinDeg = 0; history.replaceState(null, '', location.pathname + location.search.replace(/([?&])world=[^&]*&?/, '$1').replace(/[?&]$/, '') + '#' + id);
  document.title = meta.name + ' · Wonder Deck HD'; cap(meta); count++; store.set('k9hd-worlds', count); updCount(); say(meta.name.toUpperCase()); deck.ledAll();
  if (!first) deck.sfx.arrive();
  mk('in'); if (first && Q.has('shot')) { ctx.island.scale.setScalar(1); E.applyCam(1); } else await play('in', ctx.island, 1.3); mk('inEnd');
  E.busy = false; E.calmAt = E.clock + 1.5;
  const prefetch = () => Object.values(E.looks()).forEach(L => E.needSky(L.sky)); (window.requestIdleCallback || setTimeout)(prefetch, { timeout: 4000 });
  busy = false;
  if (first && Q.get('keys')) for (const k of Q.get('keys').split(',')) { deck.press(+k); await new Promise(r => setTimeout(r, 200)); } // test hook: press keys after load
  if (first) { if (Q.get('ev')) ctx.api.ev(); const ff = +Q.get('ff') || 0; for (let k = 0; k < ff / .05; k++) E.step(.05); }
  busy = false; if (queued) { queued = false; load(ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length]); }
}

function onPress(d, i) {
  E.AUD.get();
  if (d.id === 'world') { if (busy) { queued = true; return; } load(ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length]); return; }
  if (busy || !E.world) return;
  if (d.levels) { const v = (E.MOD[d.id] + 1) % 4; E.setMod(d.id, v); deck.drawDecal(i); deck.sfx.level(v);
    const label = d.id === 'rain' && meta.rainIs ? meta.rainIs.toUpperCase() : d.label; say(label + ' · ' + d.levels[v].toUpperCase()); return; }
  if (d.id === 'event') { E.world.api && E.world.api.ev(); say((meta.ev || 'EVENT').toUpperCase()); return; }
  if (d.id === 'spin') { const deg = E.spin(1); deck.sfx.whoosh(); E.controls.userData.touched = 1; say('SPIN · ' + deg + '°'); }
}

/* keyboard: letters and 1–9 press keys, arrows orbit, +/− zoom */
const keyIdx = e => { const k = e.key.toUpperCase(); return k === ' ' || k === 'ENTER' ? 4 : k >= '1' && k <= '9' ? +k - 1 : KEYDEF.findIndex(d => d.key === k); };
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('button'))) return;
  const C = E.controls, off = E.camera.position.clone().sub(C.target);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); off.applyAxisAngle(new E.THREE.Vector3(0, 1, 0), (e.key === 'ArrowLeft' ? -1 : 1) * Math.PI / 12); E.camera.position.copy(C.target).add(off); C.userData.touched = 1; return; }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const s = new E.THREE.Spherical().setFromVector3(off); s.phi = clamp(s.phi + (e.key === 'ArrowUp' ? -.08 : .08), C.minPolarAngle, C.maxPolarAngle); off.setFromSpherical(s); E.camera.position.copy(C.target).add(off); C.userData.touched = 1; return; }
  if ('+=-_'.includes(e.key)) { const k = e.key === '-' || e.key === '_' ? 1.12 : .89, L = clamp(off.length() * k, C.minDistance, C.maxDistance); E.camera.position.copy(C.target).add(off.setLength(L)); return; }
  if (e.repeat) return; const i = keyIdx(e); if (i >= 0) { e.preventDefault(); deck.down(i); }
});
addEventListener('keyup', e => { const i = keyIdx(e); if (i >= 0) deck.up(i); });

const want = (location.hash || '').slice(1) || Q.get('world');
const first = load(WORLDS[want] ? want : ORDER[0], true);
if (Q.has('shot')) { await first; await new Promise(r => setTimeout(r, +Q.get('wait') || 1500)); } // headless screenshots fire on the load event
window.__wonder = { press: i => deck.press(i), E, load };
