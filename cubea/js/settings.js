/* CUBEA — settings.js : PAUSE MENU, SETTINGS, KEY REBINDING, SAVE / LOAD, AUTOSAVE.

   The things a finished game has and a prototype forgets.
   • PAUSE MENU (Esc when nothing else is open): Resume · Save · Load · Settings · Controls · Quit to title.
   • SETTINGS (persist in localStorage 'cubea_settings'): master volume, UI scale, reduce screen shake, high-contrast, Spanish level (auto follows the story; 0/1/2 forces), autosave interval, default speed.
   • CONTROLS: every key action can be rebound. A capture-phase listener translates a custom key into the default key the
     game code already understands (so main.js needs no knowledge of bindings) and swallows the old key.
   • SAVE / LOAD: the world is generated from a seed, so a save is the SEED + the changes: the game state (C.G minus
     live objects), only the people who differ from a fresh generation, the placed things of every visited scene
     (camp, plots, crops), and where the party stands. Three manual slots + one autosave, in localStorage.
     Loading regenerates the world, applies the saved changes, and re-enters the saved scene.
   KNOWN LIMITS: actors in non-current scenes are regenerated (positions/loose items there are not saved); vehicles and
   in-progress macros are not saved; a colour-blind palette needs the renderer's team colours centralised (not yet).
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp;
  const $ = (id) => document.getElementById(id);
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };

  // ------------------------------------------------------------------------------------------------------------------
  // 1. SETTINGS
  // ------------------------------------------------------------------------------------------------------------------
  const DEFAULTS = { volume: 0.35, uiScale: 1, reduceShake: false, contrast: false, compactUI: true, autoSlow: true, spanish: 'auto', autosave: 5, keys: {} };
  C.settings = Object.assign({}, DEFAULTS, (() => { try { return JSON.parse(LS.get('cubea_settings') || '{}'); } catch (e) { return {}; } })());
  C.settings.keys = C.settings.keys || {};
  const persist = () => LS.set('cubea_settings', JSON.stringify(C.settings));

  /** Push the settings into the running game. */
  C.applySettings = function () {
    const S = C.settings;
    document.documentElement.style.setProperty('--ui', S.uiScale);
    document.querySelectorAll('.panel,#top,#left,#actions').forEach((el) => { el.style.zoom = S.uiScale; });
    if (C.snd && C.snd.setVolume) C.snd.setVolume(S.volume);
    C.langOverride = S.spanish === 'auto' ? null : +S.spanish;
    document.body.classList.toggle('hicontrast', !!S.contrast);
    persist();
  };
  const cssEl = document.createElement('style');
  cssEl.textContent = `
#pause,#sets{position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(10,12,10,.62)}
#pause .box,#sets .box{width:min(460px,92vw);max-height:90vh;overflow:auto;padding:16px 18px;border-radius:14px;background:var(--panel,#1c211c);border:1px solid rgba(255,255,255,.14);box-shadow:0 12px 40px rgba(0,0,0,.5)}
#pause h2,#sets h2{margin:0 0 10px;font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold,#e8c36a)}
#pause button.big{display:block;width:100%;margin:5px 0;padding:10px;font-size:14px}
#sets .row{display:flex;align-items:center;gap:10px;margin:7px 0;font-size:13px}#sets .row label{flex:1}#sets .row input[type=range]{width:150px}
#sets .keyrow{display:flex;gap:8px;align-items:center;padding:2px 0;font-size:12px}#sets .keyrow span{flex:1}#sets .keyrow button{min-width:64px}
.hicontrast #game{filter:contrast(1.12) saturate(1.1)}`;
  document.head.appendChild(cssEl);
  const mk = (id) => { let el = $(id); if (!el) { el = document.createElement('div'); el.id = id; document.body.appendChild(el); } return el; };

  // ------------------------------------------------------------------------------------------------------------------
  // 2. KEY BINDINGS
  // ------------------------------------------------------------------------------------------------------------------
  const ACTIONS = [
    ['x', 'Draw / holster weapon'], ['g', 'Throw grenade'], ['r', 'Reload'], ['c', 'Hide (camouflage)'], ['e', 'Talk / use / pick up'],
    ['z', 'Rest until dawn'], ['f', 'Spring ambush'], ['v', 'Fog of war on/off'], ['m', 'Map'], ['p', 'Manifesto'], ['i', 'Factions'],
    ['j', 'Journal'], ['b', 'Camp'], ['h', 'Help'], ['t', 'Pack'], ['n', 'Sound on/off'], ['q', 'Context wheel'], ['k', 'Actions panel'],
  ];
  let rebinding = null;
  function bindingOf(def) { return C.settings.keys[def] || def; }
  // Capture-phase translation: custom key → default key; a default key that was rebound away is swallowed.
  const reverse = () => { const r = {}; for (const d in C.settings.keys) r[C.settings.keys[d]] = d; return r; };
  function translate(e, type) {
    if (e.__cubea || rebinding || !e.key || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const k = e.key.toLowerCase(), rev = reverse(), keys = C.settings.keys;
    if (rev[k] !== undefined) { e.stopImmediatePropagation(); e.preventDefault(); const n = new KeyboardEvent(type, { key: rev[k], code: 'Key' + rev[k].toUpperCase(), shiftKey: e.shiftKey, bubbles: true }); n.__cubea = true; window.dispatchEvent(n); }
    else if (keys[k] !== undefined) { e.stopImmediatePropagation(); e.preventDefault(); }                // the old key is now unbound
  }
  window.addEventListener('keydown', (e) => translate(e, 'keydown'), true);
  window.addEventListener('keyup', (e) => translate(e, 'keyup'), true);

  // ------------------------------------------------------------------------------------------------------------------
  // 3. SAVE / LOAD
  // ------------------------------------------------------------------------------------------------------------------
  const DROP = new Set(['actor', 'scene', 'player', 'vehicle', 'selected', 'tgt', 'target', 'pendingOrder', 'order', 'orderQ', 'path']);
  const strip = (o) => JSON.stringify(o, (k, v) => (DROP.has(k) ? undefined : v));
  /** Snapshot every person after generation so a save can store only those who changed. */
  const origGen = C.genWorld; let baseline = null;
  C.genWorld = function (seed) { const r = origGen.call(this, seed); baseline = C.W.people.map((p) => strip(p)); return r; };
  const origGet = C.getScene; let savedScenes = null;
  C.getScene = function (sid) { const fresh = !C.scenes[sid]; const s = origGet.call(this, sid); if (fresh && savedScenes && savedScenes[sid]) { const d = savedScenes[sid]; s.things = d.things || []; s.nextThing = d.nextThing || 0; s.estate = d.estate; s.foul = d.foul || 0; } return s; };

  /** Build the save object. */
  C.makeSave = function () {
    const g = G(), s = g.scene; if (!g || !s) return null;
    const people = {}; C.W.people.forEach((p, i) => { const j = strip(p); if (j !== baseline[i]) people[i] = JSON.parse(j); });
    const scenes = {}; for (const sid in C.scenes) { const sc = C.scenes[sid]; if ((sc.things && sc.things.length) || sc.estate || sc.foul) scenes[sid] = { things: sc.things || [], nextThing: sc.nextThing || 0, estate: sc.estate, foul: sc.foul || 0 }; }
    const pl = g.player; const party = s.actors.filter((a) => !a.dead && a.squad >= 0 && !a.isPlayer).map((a) => ({ id: a.p.id, x: a.x, y: a.y }));
    return { v: 1, t: Date.now(), seed: g.seed, name: C.tagName(C.P(C.W.player)), day: g.day, hour: g.hour, sid: s.sid, px: pl.x, py: pl.y, party, G: JSON.parse(strip(g)), W: { nextEv: C.W.nextEv, player: C.W.player, day: C.W.day }, people, scenes };
  };
  C.saveGame = function (slot) {
    const sv = C.makeSave(); if (!sv) return false;
    const ok = LS.set('cubea_save_' + slot, JSON.stringify(sv));
    C.ui.toast(ok ? `Saved to ${slot === 'auto' ? 'autosave' : 'slot ' + slot} (day ${sv.day + 1})` : 'Could not save — browser storage is full or blocked');
    return ok;
  };
  C.listSaves = function () { return ['auto', 1, 2, 3].map((k) => { const raw = LS.get('cubea_save_' + k); if (!raw) return { slot: k, empty: true }; try { const s = JSON.parse(raw); return { slot: k, day: s.day, name: s.name, sid: s.sid, t: s.t, size: raw.length }; } catch (e) { return { slot: k, empty: true }; } }); };
  C.loadGame = function (slot) {
    const raw = LS.get('cubea_save_' + slot); if (!raw) { C.ui.toast('That slot is empty'); return false; }
    const sv = JSON.parse(raw);
    C.snd && C.snd.init(); C.newGame(sv.seed, {});
    const g = G();
    // game state: copy saved fields over the fresh ones (live objects were never saved)
    for (const k in sv.G) if (!DROP.has(k)) g[k] = sv.G[k];
    g.scene = null; g.player = null; g.paused = false;
    Object.assign(C.W, sv.W);
    for (const i in sv.people) { const p = C.W.people[i]; const d = sv.people[i]; for (const k in d) p[k] = d[k]; }
    savedScenes = sv.scenes; C.scenes = {};
    C.enterScene(sv.sid, { campSpawn: true, far: true });
    const pl = G().player; pl.x = sv.px; pl.y = sv.py; G().cam.x = pl.x; G().cam.y = pl.y;
    for (const m of sv.party) { const q = C.P(m.id); if (q && q.actor) { q.actor.x = m.x; q.actor.y = m.y; } }
    if (C.ui.start) C.ui.start();
    $('title').style.display = 'none'; C.applySettings(); closeAll();
    C.ui.toast(`Loaded day ${sv.day + 1}`); return true;
  };
  setInterval(() => { const g = G(), m = C.settings.autosave; if (!g || !g.scene || g.over || !m || g.modalOpen || g.paused) return; if ((Date.now() - (C.lastAuto || 0)) > m * 60000) { C.lastAuto = Date.now(); if (g.combatT <= 0) C.saveGame('auto'); } }, 10000);

  // ------------------------------------------------------------------------------------------------------------------
  // 4. THE SCREENS
  // ------------------------------------------------------------------------------------------------------------------
  let wasPaused = false;
  function closeAll() { for (const id of ['pause', 'sets']) { const el = $(id); if (el) el.style.display = 'none'; } const g = G(); if (g && g.pausedByMenu) { g.paused = wasPaused; g.pausedByMenu = false; C.ui.syncSpeed && C.ui.syncSpeed(); } }
  function openPause() {
    const g = G(); if (!g || !g.scene || g.over) return; const el = mk('pause'); if (!g.pausedByMenu) { wasPaused = g.paused; g.paused = true; g.pausedByMenu = true; C.ui.syncSpeed && C.ui.syncSpeed(); }
    el.innerHTML = `<div class="box"><h2>Paused</h2><button class="btn primary big" data-a="resume">Resume</button><button class="btn big" data-a="save">Save game…</button><button class="btn big" data-a="load">Load game…</button><button class="btn big" data-a="sets">Settings</button><button class="btn big" data-a="keys">Controls</button><button class="btn big" data-a="quit">Quit to title</button></div>`;
    el.style.display = 'flex';
    el.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => ({ resume: closeAll, save: () => slots('save'), load: () => slots('load'), sets: () => openSettings(false), keys: () => openSettings(true), quit: () => { if (confirm('Quit to the title screen? Unsaved progress is lost.')) location.reload(); } }[b.dataset.a]()));
  }
  function slots(mode) {
    const el = mk('pause'); const list = C.listSaves().filter((s) => mode === 'save' ? s.slot !== 'auto' : true);
    el.innerHTML = `<div class="box"><h2>${mode === 'save' ? 'Save game' : 'Load game'}</h2>${list.map((s) => `<button class="btn big" data-s="${s.slot}" ${mode === 'load' && s.empty ? 'disabled' : ''}>${s.slot === 'auto' ? 'Autosave' : 'Slot ' + s.slot} — ${s.empty ? 'empty' : `${s.name}, day ${s.day + 1}, ${C.SETTLEMENTS[s.sid] ? C.SETTLEMENTS[s.sid].name : s.sid} (${Math.round(s.size / 1024)} KB)`}</button>`).join('')}<button class="btn big" data-s="back">Back</button></div>`;
    el.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { const k = b.dataset.s; if (k === 'back') return openPause(); const slot = k === 'auto' ? 'auto' : +k; if (mode === 'save') { C.saveGame(slot); openPause(); } else C.loadGame(slot); });
  }
  function openSettings(keysOnly) {
    const S = C.settings, el = mk('sets'); $('pause').style.display = 'none';
    const row = (id, label, inner) => `<div class="row"><label for="${id}">${label}</label>${inner}</div>`;
    let h = `<div class="box"><h2>${keysOnly ? 'Controls' : 'Settings'}</h2>`;
    if (!keysOnly) h += row('sVol', 'Volume', `<input type="range" id="sVol" min="0" max="1" step="0.05" value="${S.volume}">`) + row('sUi', 'Interface size', `<input type="range" id="sUi" min="0.8" max="1.4" step="0.05" value="${S.uiScale}">`)
      + row('sShake', 'Reduce screen shake', `<input type="checkbox" id="sShake" ${S.reduceShake ? 'checked' : ''}>`) + row('sCmp', 'Compact interface (panels open on hover)', `<input type="checkbox" id="sCmp" ${S.compactUI !== false ? 'checked' : ''}>`) + row('sSlow', 'Slow down when the shooting starts', `<input type="checkbox" id="sSlow" ${S.autoSlow !== false ? 'checked' : ''}>`) + row('sCon', 'High contrast', `<input type="checkbox" id="sCon" ${S.contrast ? 'checked' : ''}>`)
      + row('sEs', 'Spanish', `<select id="sEs"><option value="auto">Grows with the story</option><option value="0">English only</option><option value="1">Mixed</option><option value="2">Mostly Spanish</option></select>`)
      + row('sAuto', 'Autosave every (minutes, 0 = off)', `<input type="number" id="sAuto" min="0" max="30" value="${S.autosave}" style="width:60px">`);
    if (keysOnly) h += ACTIONS.map(([d, n]) => `<div class="keyrow"><span>${n}</span><button class="btn sm" data-k="${d}">${bindingOf(d).toUpperCase()}</button></div>`).join('') + `<div class="keyrow"><span style="opacity:.7">Fixed: WASD move, Shift run, Space pause, Esc menu, 1–9 groups, Wheel zoom</span></div><div class="row"><button class="btn sm" id="sReset">Reset all keys</button></div>`;
    h += `<div class="row"><button class="btn primary" id="sBack">Back</button></div></div>`;
    el.innerHTML = h; el.style.display = 'flex';
    const on = (id, f) => { const n = $(id); if (n) n.oninput = n.onchange = f; };
    if ($('sEs')) $('sEs').value = String(S.spanish);
    on('sVol', (e) => { S.volume = +e.target.value; C.applySettings(); }); on('sUi', (e) => { S.uiScale = +e.target.value; C.applySettings(); });
    on('sShake', (e) => { S.reduceShake = e.target.checked; C.applySettings(); }); on('sCon', (e) => { S.contrast = e.target.checked; C.applySettings(); }); on('sCmp', (e) => { S.compactUI = e.target.checked; C.applySettings(); }); on('sSlow', (e) => { S.autoSlow = e.target.checked; C.applySettings(); });
    on('sEs', (e) => { S.spanish = e.target.value; C.applySettings(); }); on('sAuto', (e) => { S.autosave = +e.target.value; C.applySettings(); });
    el.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => { rebinding = b.dataset.k; b.textContent = 'press a key…'; });
    if ($('sReset')) $('sReset').onclick = () => { S.keys = {}; C.applySettings(); openSettings(true); };
    $('sBack').onclick = () => { el.style.display = 'none'; G() && G().pausedByMenu ? openPause() : 0; };
  }
  // while rebinding, the next key press is the new binding
  window.addEventListener('keydown', (e) => {
    if (rebinding) { e.preventDefault(); e.stopImmediatePropagation(); if (e.key !== 'Escape' && e.key.length === 1) { const k = e.key.toLowerCase(); const S = C.settings; for (const d in S.keys) if (S.keys[d] === k) delete S.keys[d]; if (k === rebinding) delete S.keys[rebinding]; else S.keys[rebinding] = k; C.applySettings(); } rebinding = null; openSettings(true); return; }
    if (e.key === 'Escape') {
      const g = G(); if (!g || !g.scene || g.over) return;
      if ($('pause') && $('pause').style.display === 'flex') { e.stopImmediatePropagation(); closeAll(); return; }
      if ($('sets') && $('sets').style.display === 'flex') { e.stopImmediatePropagation(); $('sets').style.display = 'none'; openPause(); return; }
      if (g.modalOpen || (g.cmd && g.cmd.pending) || (g.rec && g.rec.on) || ($('wheel') && $('wheel').style.display === 'flex')) return;   // let main.js close those first
      e.stopImmediatePropagation(); openPause();
    }
  }, true);
  // a gear button in the top bar, and the "Continue" button on the title screen
  window.addEventListener('load', () => {
    const top = $('top'); if (top) { const b = document.createElement('button'); b.className = 'btn sm'; b.id = 'bSet'; b.title = 'Menu (Esc)'; b.textContent = '⚙'; b.onclick = openPause; top.appendChild(b); }
    const st = $('startBtn'); if (st && C.listSaves().some((s) => !s.empty)) { const b = document.createElement('button'); b.className = 'btn big'; b.textContent = 'Continue…'; b.onclick = () => { $('title').style.display = 'none'; const sv = C.listSaves().find((s) => !s.empty); slots('load'); $('pause').style.display = 'flex'; }; st.parentNode.insertBefore(b, st.nextSibling); }
    C.applySettings();
  });
  C.openPause = openPause;
})();
