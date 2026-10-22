/* CUBEA — pack.js : the "Pack" window (drag-and-drop inventory) and the context-aware suggestion strip.

   WHAT THE PLAYER GETS
   • Double-click a rebel (or press T with someone selected, or use the inspector's Pack button) to open their PACK.
   • The pack shows what they carry (weight vs capacity), their weapon, their ration allowance, and three kinds of
     DROP TARGETS: nearby comrades, the column's stores, and the ground.
   • Drag any item tile onto a target to move it. Plain drag = 1, Shift = all, Ctrl = 5. Drag a ground item onto a
     person to pick it up; drag your own item to "Ground" to drop it. Drag the weapon tile onto a comrade to hand it over.
   • Rules mirror the world: you can only hand things to someone within sharing range; the column's stores are only
     reachable by people near the leader; weight limits are enforced (the tile shakes and a toast says why).
   • While paused the window is read-only (no orders while paused — time is part of the pressure).

   THE SUGGESTION STRIP (context-aware UI)
   Under the command bar, a few buttons appear only when the situation calls for them: hungry people and someone with
   food to spare → "Share out"; thirst → "Fetch water"; wounded and medicine → "Treat wounded"; heavy loads → "Lighten
   loads"; contact → "Ambush / Retreat". The UI reads the simulation, so it adapts as the day goes.

   Everything here is a thin skin over C.transfer (inventory.js); no game rules live in this file.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, ui = C.ui, clamp = C.clamp;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ------------------------------------------------------------------------------------------------------------------
  // Styles (kept here so the window is self-contained)
  // ------------------------------------------------------------------------------------------------------------------
  const css = document.createElement('style');
  css.textContent = `
#pack{position:fixed;left:292px;top:104px;width:560px;max-width:calc(100vw - 320px);z-index:6;display:none;padding:10px 12px;
  background:linear-gradient(180deg,rgba(46,37,28,.94),rgba(30,24,18,.94));backdrop-filter:blur(10px);border-radius:14px}
#pack h3{margin:6px 0 4px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--gold)}
#pack .hd{display:flex;gap:10px;align-items:center}
#pack .hd canvas{width:52px;height:52px;border-radius:10px;background:rgba(0,0,0,.28)}
#pack .hd .nm{font-weight:700;font-size:15px}
#pack .load{height:8px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:3px}
#pack .load i{display:block;height:100%;background:linear-gradient(90deg,#7fc46a,#e6b84e 70%,#dc4a3a)}
#pack .cols{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;margin-top:6px}
#pack .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
#pack .tile{position:relative;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.06);padding:6px 4px;text-align:center;cursor:grab;transition:transform .12s,background .12s}
#pack .tile:hover{background:rgba(255,255,255,.14);transform:translateY(-1px)}
#pack .tile .ic{font-size:20px;line-height:1.1}
#pack .tile .ct{position:absolute;right:5px;top:2px;font-weight:700;font-size:11px;background:rgba(0,0,0,.45);border-radius:9px;padding:0 5px}
#pack .tile .nm2{font-size:10px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pack .tile.empty{opacity:.25;cursor:default}
#pack .tile.shake{animation:pk .3s}
@keyframes pk{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
#pack .zone{border:1.5px dashed var(--line);border-radius:10px;padding:6px;margin-bottom:6px;transition:background .12s,border-color .12s}
#pack .zone.over{background:rgba(230,184,78,.16);border-color:var(--gold)}
#pack .zone .ztitle{display:flex;justify-content:space-between;align-items:center;font-weight:600}
#pack .zone .zsub{font-size:11px;color:var(--mute)}
#pack .mini{height:5px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:2px}
#pack .mini i{display:block;height:100%}
#pack .gz{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
#pack .gz .tile{padding:2px 6px;display:inline-block}
#pack .rat{display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:4px;font-size:11px;color:var(--mute)}
#pack .x{position:absolute;right:8px;top:6px}
#cmdSuggest{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}
#cmdSuggest .sg{border:1px solid rgba(230,184,78,.55);background:rgba(230,184,78,.14);color:var(--ink);border-radius:999px;padding:2px 9px;font-size:11px;cursor:pointer;animation:sgIn .25s}
#cmdSuggest .sg:hover{background:rgba(230,184,78,.3)}
@keyframes sgIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id = 'pack'; el.className = 'panel'; document.body.appendChild(el);

  // ------------------------------------------------------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------------------------------------------------------
  let lastHtml = '', dragging = false;              // render de-duplication and drag guard
  let who = null;                                   // the person whose pack is open
  const SHARE_RANGE = 60;                           // generous version of the sharing range for manual hand-overs
  const near = (a, b) => a && b && Math.hypot(a.x - b.x, a.y - b.y) <= SHARE_RANGE;
  const bar = (v, col) => `<div class="mini"><i style="width:${clamp(v, 0, 100)}%;background:${col}"></i></div>`;

  /** Rebels near the person (and the leader), for hand-overs. */
  function neighbours(p) {
    const g = G(), s = g.scene, a = p.actor; if (!a) return [];
    return s.actors.filter((o) => o !== a && !o.dead && !o.inside && (o.side === 'rebel' || o.isPlayer) && near(a, o)).sort((x, y) => Math.hypot(x.x - a.x, x.y - a.y) - Math.hypot(y.x - a.x, y.y - a.y)).slice(0, 7);
  }
  const nearLeader = (p) => { const g = G(), a = p.actor; return !!(a && g.player && Math.hypot(a.x - g.player.x, a.y - g.player.y) < 140); };

  C.openPack = function (p) {
    const g = G(); if (!p || !g.scene) return; C.initInv(p); who = p; lastHtml = ''; render(); el.style.display = 'block';
  };
  C.closePack = function () { who = null; el.style.display = 'none'; };

  /** Draw the window. Re-run whenever something changes (cheap: it is a small panel). */
  function render() {
    const g = G(); if (!who) return; const p = who, a = p.actor; C.initInv(p);
    const cap = C.capacityOf(p), load = C.loadOf(p), pct = load / cap * 100;
    let h = `<button class="btn sm x" id="pkClose">✕</button>`;
    h += `<div class="hd"><canvas id="pkPortrait" width="52" height="52"></canvas><div style="flex:1"><div class="nm">${esc(C.tagName(p))}'s pack</div>
      <div class="zsub">Load <b>${load.toFixed(1)}</b> / ${cap.toFixed(1)} · ${a && a.loadK < 0.99 ? `<span style="color:#ff9d8c">slowed ${Math.round((1 - a.loadK) * 100)}%</span>` : 'moving freely'}</div>
      <div class="load"><i style="width:${clamp(pct, 0, 130) * 100 / 130}%"></i></div></div></div>`;
    // ---- left: what they carry
    h += `<div class="cols"><div><h3>Carrying (drag out)</h3><div class="grid" id="pkMine">`;
    for (const k of C.ITEM_KEYS) { const n = p.inv[k] || 0; if (!n && !['food', 'water', 'med', 'ammo'].includes(k)) continue; h += tile({ from: 'self', k }, C.ITEMS[k].icon, n, C.ITEMS[k].n, n > 0); }
    if (p.wpn) h += tile({ from: 'self', k: '__weapon' }, '🔫', '', C.WEAPONS[p.wpn].n, true, true);
    h += `</div>`;
    h += `<div class="rat"><span>Food:</span>${['1:Free', '0.5:Half', '0:None'].map((o) => { const [v, l] = o.split(':'); return `<button class="btn sm ${(+v === p.rat.f) ? 'on' : ''}" data-rf="${v}">${l}</button>`; }).join('')}
      <span>Water:</span>${['1:Free', '0.5:Sparing', '0:None'].map((o) => { const [v, l] = o.split(':'); return `<button class="btn sm ${(+v === p.rat.w) ? 'on' : ''}" data-rw="${v}">${l}</button>`; }).join('')}</div>`;
    h += `<div class="zsub" style="margin-top:6px">Hunger ${Math.round(p.needs.food)} · thirst ${Math.round(p.needs.water)} · energy ${Math.round(p.needs.energy)}${p.stats && p.stats.brokeRation ? ` · broke orders ${p.stats.brokeRation}×` : ''}</div>`;
    h += `<div class="zsub">Weight limit depends on strength, age and health. Shift = all, Ctrl = 5.</div></div>`;
    // ---- right: drop targets
    h += `<div><h3>Hand to…</h3>`;
    const ns = neighbours(p);
    if (!ns.length) h += `<div class="zsub">No comrade within reach.</div>`;
    for (const o of ns) { const q = o.p; C.initInv(q); h += `<div class="zone" data-to="person" data-pid="${q.id}"><div class="ztitle"><span>${esc(C.tagName(q))}</span><span class="zsub">${(C.loadOf(q)).toFixed(0)}/${C.capacityOf(q).toFixed(0)}</span></div>
      <div class="zsub">🍚${q.inv.food || 0} 💧${q.inv.water || 0} ${q.inv.med ? '✚' + q.inv.med : ''}</div>${bar(q.needs.food, '#e6b84e')}${bar(q.needs.water, '#5b86e0')}</div>`; }
    h += `<div class="zone" data-to="stores"><div class="ztitle"><span>📦 Column stores</span><span class="zsub">${nearLeader(p) ? 'in reach' : 'too far from the column'}</span></div>
      <div class="zsub">🍚${Math.round(g.res.food)} • ${Math.round(g.res.ammo)} ✚${Math.round(g.res.med)} 💣${Math.round(g.res.gren)} 🚀${g.res.shell || 0} 🎯${g.res.rocket || 0}</div></div>`;
    const items = a ? g.scene.items.filter((it) => Math.hypot(it.x - a.x, it.y - a.y) < 50) : [];
    h += `<div class="zone" data-to="ground"><div class="ztitle"><span>⬇ Ground</span><span class="zsub">drop here</span></div><div class="gz">`;
    for (const it of items.slice(0, 8)) { const k = ['food', 'ammo', 'med', 'gren', 'molo', 'water'].includes(it.k) ? it.k : null; if (k) h += tile({ from: 'ground', k }, (C.ITEMS[k] || {}).icon || '•', it.amount || 1, it.label || k, true); }
    h += `</div></div></div></div>`;
    // Only touch the DOM when the content changed (and never during a drag): replacing the tiles mid-drag would cancel it.
    if (h === lastHtml || dragging) return; lastHtml = h;
    el.innerHTML = h;
    try { ui.portrait && ui.portrait($$('#pkPortrait'), p, a, 2.3); } catch (e) { }
    wire();
  }
  const tile = (src, icon, n, name, enabled, weapon) => `<div class="tile ${enabled ? '' : 'empty'}" ${enabled ? 'draggable="true"' : ''} data-from="${src.from}" data-k="${src.k}"><div class="ic">${icon}</div>${n !== '' ? `<span class="ct">${n}</span>` : ''}<div class="nm2">${esc(name)}</div></div>`;

  // ------------------------------------------------------------------------------------------------------------------
  // Drag and drop wiring
  // ------------------------------------------------------------------------------------------------------------------
  function toast(t) { ui.toast(t); }
  function wire() {
    $$('#pkClose').onclick = C.closePack;
    el.querySelectorAll('[data-rf]').forEach((b) => b.onclick = () => { if (G().paused) return toast('No orders while paused'); C.setRation([who.id], +b.dataset.rf, null); render(); });
    el.querySelectorAll('[data-rw]').forEach((b) => b.onclick = () => { if (G().paused) return toast('No orders while paused'); C.setRation([who.id], null, +b.dataset.rw); render(); });
    el.querySelectorAll('.tile[draggable]').forEach((t) => {
      t.ondragend = () => { dragging = false; };
      t.ondragstart = (e) => { dragging = true; e.dataTransfer.setData('text/plain', JSON.stringify({ from: t.dataset.from, k: t.dataset.k })); e.dataTransfer.effectAllowed = 'move'; };
    });
    el.querySelectorAll('.zone').forEach((z) => {
      z.ondragover = (e) => { e.preventDefault(); z.classList.add('over'); };
      z.ondragleave = () => z.classList.remove('over');
      z.ondrop = (e) => { dragging = false; e.preventDefault(); z.classList.remove('over'); let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; } drop(d, z, e); };
    });
    // the main pack grid is also a target: picking things up from the ground or stores
    const mine = $$('#pkMine'); if (mine) { mine.ondragover = (e) => e.preventDefault(); mine.ondrop = (e) => { dragging = false; e.preventDefault(); let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; } drop(d, { dataset: { to: 'self' } }, e); }; }
  }
  const $$ = (sel) => el.querySelector(sel);

  /** Perform a drop: translate the drag source and target into a C.transfer call with the world's rules. */
  function drop(d, zone, e) {
    const g = G(), p = who, a = p.actor; if (g.paused) { toast('No orders while paused — time is part of the pressure'); return; }
    const to = zone.dataset.to; const amount = e.shiftKey ? 999 : e.ctrlKey ? 5 : 1;
    // source holder
    let from;
    if (d.from === 'self') from = { kind: 'person', p }; else if (d.from === 'ground') from = { kind: 'ground', s: g.scene, x: a.x, y: a.y }; else return;
    // weapon hand-over
    if (d.k === '__weapon') { if (to === 'person') { const q = C.P(+zone.dataset.pid); handWeapon(p, q); } else toast('Drop a weapon on a comrade to hand it over'); return; }
    // target holder and rules
    let dest;
    if (to === 'person') { const q = C.P(+zone.dataset.pid); if (!q.actor || !near(a, q.actor)) { toast('Too far away'); return; } dest = { kind: 'person', p: q }; }
    else if (to === 'stores') { if (!nearLeader(p)) { toast('Too far from the column to reach the stores'); return; } dest = { kind: 'stores' }; if (!C.ITEMS[d.k].res) { toast('The stores do not hold that'); return; } }
    else if (to === 'ground') dest = { kind: 'ground', s: g.scene, x: a.x + 10, y: a.y + 6 };
    else if (to === 'self') dest = { kind: 'person', p };
    const moved = to === 'person' && d.from === 'self' ? C.give(p, dest.p, d.k, amount) : C.transfer(from, dest, d.k, amount);
    if (!moved) { shake(d.k); toast(dest.kind === 'person' ? `${C.tagName(dest.p)} cannot carry any more of that` : 'Nothing moved'); }
    else if (C.snd && C.snd.click) C.snd.click();
    lastHtml = ''; render();
  }
  function shake(k) { const t = el.querySelector(`.tile[data-k="${k}"]`); if (t) { t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); } }

  /** Hand a weapon to a comrade (swap if they hold something other than a machete). Heavy weapons divide the troop (resentment). */
  function handWeapon(p, q) {
    const g = G(); if (!q.actor || !near(p.actor, q.actor)) { toast('Too far away'); return; }
    const mine = p.wpn, theirs = (q.wpn && q.wpn !== 'machete') ? q.wpn : null;
    const give = (person, wk) => { person.wpn = wk; if (person.actor) { const old = person.actor.weapon; C.giveWeapon(person.actor, wk || 'machete', old ? old.spare : undefined); person.actor.weaponOut = !!wk; } };
    give(q, mine); give(p, theirs || 'machete');
    C.bondEvent && C.bondEvent(p, q, 'shared', 0.8); if (C.resentment && theirs === null) C.resentment(q);
    toast(`${C.tagName(q)} takes the ${C.WEAPONS[mine].n}`);
  }

  // open/close hooks
  window.addEventListener('keydown', (e) => {
    const g = G(); if (!g || !g.scene || g.modalOpen || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 't' || e.key === 'T') { const a = g.selected || g.hover; const p = a ? a.p : (C.selIds()[0] ? C.P(C.selIds()[0]) : null); if (p) C.openPack(p); }
    if (e.key === 'Escape' && who) C.closePack();
  });
  const cv = document.getElementById('game');
  cv.addEventListener('dblclick', () => { const g = G(); if (g && g.hover && (g.hover.side === 'rebel' || g.hover.isPlayer) && !g.hover.dead) C.openPack(g.hover.p); });
  setInterval(() => { if (who && el.style.display !== 'none' && !el.matches(':hover')) { if (who.status !== 'alive') C.closePack(); else render(); } }, 1000);   // live refresh unless the mouse is on it
})();
