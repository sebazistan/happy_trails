/* CUBEA — things.js : physical objects the player and soldiers can place, carry to, use and see in the world,
   and the CONTEXT WHEEL that offers the verbs that make sense for whatever is under the cursor.

   WHY THIS EXISTS (see docs/PLAYER_AGENCY.md)
   The design goal is that important mechanics happen ON THE MAP, in real time, with visible detail — not behind a
   menu button. A latrine is a trench someone digs somewhere; a food store is a rack with sacks that can spoil or be
   stolen; land reform is stakes in the ground, families walking onto plots, seed carried in a pack. This file is the
   foundation for that: a registry of THING kinds (what they look like and what they are), the lists of things in a
   scene (s.things), and the way the player discovers what can be done with them (the wheel).

   DATA
     s.things  = [ { id, k, x, y, d:{...kind-specific data} } ]   persisted with the scene (save/load)
     C.THINGS  = { kind → { n, draw(ctx,t,time), solid? } }
   VERBS live in actions.js (C.registerVerb); this file asks C.verbsFor(target) to build the wheel.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, T = C.T, TL = C.TILE, clamp = C.clamp;
  const ui = C.ui;

  // ------------------------------------------------------------------------------------------------------------------
  // THING KINDS and how they are drawn (simple, readable shapes in the game's low-poly language)
  // ------------------------------------------------------------------------------------------------------------------
  const wood = 'rgb(120,88,54)', woodD = 'rgb(84,60,36)', canvas = 'rgb(176,190,150)';
  function shadow(c, x, y, w) { c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x, y + 2, w, w * 0.35, 0, 0, 6.3); c.fill(); }

  C.THINGS = {
    // a surveyor's stake with a red rag; four of them close a plot (farm.js)
    stake: { n: 'Survey stake', draw(c, t) { shadow(c, t.x, t.y, 3); c.strokeStyle = woodD; c.lineWidth = 1.6; c.beginPath(); c.moveTo(t.x, t.y + 2); c.lineTo(t.x, t.y - 11); c.stroke(); c.fillStyle = 'rgb(210,50,44)'; c.beginPath(); c.moveTo(t.x, t.y - 11); c.lineTo(t.x + 6, t.y - 9); c.lineTo(t.x, t.y - 7); c.fill(); } },
    // a hammock slung between two points; d.occ = person id sleeping in it
    hammock: { n: 'Hammock', draw(c, t) { shadow(c, t.x, t.y, 9); c.strokeStyle = woodD; c.lineWidth = 1.4; c.beginPath(); c.moveTo(t.x - 9, t.y + 1); c.lineTo(t.x - 9, t.y - 8); c.moveTo(t.x + 9, t.y + 1); c.lineTo(t.x + 9, t.y - 8); c.stroke(); c.fillStyle = canvas; c.beginPath(); c.moveTo(t.x - 9, t.y - 7); c.quadraticCurveTo(t.x, t.y + 1, t.x + 9, t.y - 7); c.quadraticCurveTo(t.x, t.y - 3, t.x - 9, t.y - 7); c.fill(); c.strokeStyle = 'rgba(40,50,30,.6)'; c.lineWidth = 0.7; c.stroke(); } },
    // a trench latrine; d.use = how full it is (0..1); d.covered = closed
    latrine: { n: 'Latrine', draw(c, t) { shadow(c, t.x, t.y, 8); c.fillStyle = t.d.covered ? 'rgb(96,78,56)' : 'rgb(34,26,20)'; c.fillRect(t.x - 7, t.y - 2, 14, 5); c.fillStyle = wood; c.fillRect(t.x - 8, t.y - 3, 16, 1.6); c.fillRect(t.x - 8, t.y + 3, 16, 1.6); if (!t.d.covered && t.d.use > 0.6) { c.fillStyle = 'rgba(120,150,60,.5)'; c.fillRect(t.x - 6, t.y - 1, 12, 3); } } },
    // a raised rack (barbacoa) for food, seed and feed, kept off the damp and away from rats; d.cap = sacks it holds
    barbacoa: { n: 'Storage rack (barbacoa)', draw(c, t) { shadow(c, t.x, t.y, 11); c.fillStyle = woodD; for (const dx of [-9, 9]) c.fillRect(t.x + dx - 1, t.y - 3, 2, 7); c.fillStyle = wood; c.fillRect(t.x - 11, t.y - 5, 22, 3); const n = Math.min(5, Math.round((t.d.fill || 0) * 5)); for (let i = 0; i < n; i++) { c.fillStyle = 'rgb(176,146,96)'; c.fillRect(t.x - 10 + i * 4.2, t.y - 10, 3.8, 5); c.fillStyle = 'rgb(140,112,70)'; c.fillRect(t.x - 10 + i * 4.2, t.y - 10, 3.8, 1.2); } c.fillStyle = 'rgb(86,110,60)'; c.beginPath(); c.moveTo(t.x - 12, t.y - 11); c.lineTo(t.x, t.y - 16); c.lineTo(t.x + 12, t.y - 11); c.fill(); } },
    // a sack pile left on the ground (exposed: spoils, rats, rain); d.item, d.n
    sack: { n: 'Sacks on the ground', draw(c, t) { shadow(c, t.x, t.y, 7); for (let i = 0; i < Math.min(4, 1 + (t.d.n || 1) / 4); i++) { c.fillStyle = 'rgb(176,146,96)'; c.beginPath(); c.ellipse(t.x - 4 + i * 4, t.y - 1 - (i % 2) * 3, 4, 3, 0, 0, 6.3); c.fill(); c.fillStyle = 'rgb(140,112,70)'; c.fillRect(t.x - 5 + i * 4, t.y - 4 - (i % 2) * 3, 2, 1.2); } } },
    // stacked firewood; d.n = number of loads
    woodpile: { n: 'Firewood pile', draw(c, t) { shadow(c, t.x, t.y, 8); const n = Math.min(12, Math.round(t.d.n || 0)); for (let i = 0; i < Math.max(2, n); i++) { c.fillStyle = i % 2 ? 'rgb(136,100,60)' : 'rgb(110,80,48)'; c.fillRect(t.x - 8 + (i % 4) * 4.2, t.y - 2 - Math.floor(i / 4) * 3, 4, 2.6); } } },
    // the kitchen fire; d.lit, d.fuel; smoke is a security problem
    fire: { n: 'Cooking fire (fogón)', draw(c, t, time) { shadow(c, t.x, t.y, 7); c.fillStyle = 'rgb(70,64,60)'; for (let i = 0; i < 6; i++) { const a = i * 1.05; c.beginPath(); c.arc(t.x + Math.cos(a) * 5.5, t.y + Math.sin(a) * 3, 1.8, 0, 6.3); c.fill(); } if (t.d.lit) { c.fillStyle = 'rgba(255,150,40,.95)'; c.beginPath(); c.moveTo(t.x - 3, t.y + 1); c.quadraticCurveTo(t.x, t.y - 9 - Math.sin(time * 9 + t.x) * 2, t.x + 3, t.y + 1); c.fill(); c.fillStyle = 'rgba(255,220,90,.9)'; c.beginPath(); c.moveTo(t.x - 1.4, t.y + 1); c.quadraticCurveTo(t.x, t.y - 5, t.x + 1.4, t.y + 1); c.fill(); } c.fillStyle = 'rgb(60,56,52)'; c.fillRect(t.x - 4, t.y - 6, 8, 4); } },
    // a blackboard on posts: where lessons and the day's order are given
    pizarra: { n: 'Blackboard', draw(c, t) { shadow(c, t.x, t.y, 8); c.fillStyle = woodD; c.fillRect(t.x - 8, t.y - 4, 1.6, 7); c.fillRect(t.x + 6.4, t.y - 4, 1.6, 7); c.fillStyle = 'rgb(38,52,44)'; c.fillRect(t.x - 9, t.y - 12, 18, 10); c.strokeStyle = wood; c.lineWidth = 1; c.strokeRect(t.x - 9, t.y - 12, 18, 10); c.strokeStyle = 'rgba(240,240,230,.8)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(t.x - 6, t.y - 9); c.lineTo(t.x + 1, t.y - 9); c.moveTo(t.x - 6, t.y - 6); c.lineTo(t.x + 5, t.y - 6); c.stroke(); } },
    // a wooden trough for pigs and chickens; d.feed = amount of feed in it
    trough: { n: 'Feeding trough', draw(c, t) { shadow(c, t.x, t.y, 7); c.fillStyle = wood; c.fillRect(t.x - 8, t.y - 3, 16, 5); c.fillStyle = woodD; c.fillRect(t.x - 7, t.y - 2, 14, 2.4); if ((t.d.feed || 0) > 0) { c.fillStyle = 'rgb(190,170,110)'; c.fillRect(t.x - 6, t.y - 2, 12, 1.6); } } },
    // a sentry post: a raised stand with a flag; d.watch = rota slot; the guard's station at night
    posta: { n: 'Sentry post (posta)', draw(c, t) { shadow(c, t.x, t.y, 6); c.strokeStyle = woodD; c.lineWidth = 1.6; c.beginPath(); c.moveTo(t.x - 4, t.y + 2); c.lineTo(t.x - 3, t.y - 9); c.moveTo(t.x + 4, t.y + 2); c.lineTo(t.x + 3, t.y - 9); c.stroke(); c.fillStyle = wood; c.fillRect(t.x - 5, t.y - 10, 10, 2); c.fillStyle = 'rgb(214,52,44)'; c.fillRect(t.x - 0.5, t.y - 17, 5, 3); c.fillStyle = woodD; c.fillRect(t.x - 0.5, t.y - 17, 1, 9); } },
    // a poster pasted on a wall or tree: d.text = id of a document in ideology.js
    cartel: { n: 'Poster', draw(c, t) { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(t.x - 4, t.y - 8, 9, 11); c.fillStyle = 'rgb(236,226,196)'; c.fillRect(t.x - 4, t.y - 10, 8, 10); c.fillStyle = 'rgb(200,50,44)'; c.fillRect(t.x - 3, t.y - 9, 6, 2); c.fillStyle = 'rgba(40,30,20,.7)'; for (let i = 0; i < 3; i++) c.fillRect(t.x - 3, t.y - 6 + i * 2, 6, 0.8); } },
    // a tool rack
    toolrack: { n: 'Tool rack', draw(c, t) { shadow(c, t.x, t.y, 8); c.fillStyle = woodD; c.fillRect(t.x - 8, t.y - 2, 16, 2); c.fillRect(t.x - 7, t.y - 8, 1.6, 7); c.fillRect(t.x + 5.4, t.y - 8, 1.6, 7); c.strokeStyle = 'rgb(160,160,150)'; c.lineWidth = 1.2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(t.x - 4 + i * 4, t.y - 9); c.lineTo(t.x - 4 + i * 4, t.y - 1); c.stroke(); } } },
    // a planted/growing/ripe patch: drawn by farm.js (parcels draw their own crops); this is one crop cell
    crop: { n: 'Crop', draw(c, t, time) { const g = t.d.g || 0; shadow(c, t.x, t.y, 5); const h = 2 + g * 8; c.strokeStyle = g > 0.95 ? 'rgb(214,190,70)' : 'rgb(70,140,52)'; c.lineWidth = 1.4; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(t.x + i * 2.6, t.y + 1); c.lineTo(t.x + i * 2.6 + Math.sin(time * 1.5 + t.x) * 0.6, t.y + 1 - h); c.stroke(); } } },
  };

  // ------------------------------------------------------------------------------------------------------------------
  // The things list of a scene
  // ------------------------------------------------------------------------------------------------------------------
  let nextId = 1;
  /** Add a thing of kind k at world (x,y). d is its kind-specific data. Returns the thing. */
  C.addThing = function (s, k, x, y, d) {
    s.things = s.things || []; const t = { id: (s.nextThing = (s.nextThing || 1) + 1), k, x, y, d: d || {} };
    s.things.push(t); return t;
  };
  C.removeThing = function (s, t) { const i = (s.things || []).indexOf(t); if (i >= 0) s.things.splice(i, 1); };
  C.thingsOf = (s, k) => (s.things || []).filter((t) => t.k === k);
  C.thingById = (s, id) => (s.things || []).find((t) => t.id === id);
  /** Nearest thing (optionally of kind k) to a point within r px. */
  C.nearestThing = function (s, x, y, k, r) {
    let best = null, bd = r || 1e9; for (const t of s.things || []) { if (k && t.k !== k) continue; const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; best = t; } } return best;
  };

  /** Draw all things in view (called from render.js drawScene, in world coordinates, before the actor layer). */
  C.drawThings = function (ctx, s, t, vis) {
    for (const th of s.things || []) {
      if (!vis(th.x, th.y, 30)) continue;
      const def = C.THINGS[th.k]; if (!def) continue;
      if (C.fogOn && C.fogOn() && !C.pointSeen(th.x, th.y) && !C.explored(th.x, th.y)) continue;   // unexplored ground hides its contents
      def.draw(ctx, th, t);
      if (th.hover) { ctx.strokeStyle = 'rgba(255,230,140,.9)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(th.x, th.y + 1, 12, 5, 0, 0, 6.3); ctx.stroke(); }
    }
  };

  // ------------------------------------------------------------------------------------------------------------------
  // TARGETS under a world point: what could the player be pointing at?
  // Each target: { kind, o, x, y, label, tk } where kind ∈ thing|animal|actor|tree|water|ground and tk = thing kind
  // ------------------------------------------------------------------------------------------------------------------
  const TREE = { tree: 1, palm: 1, ceiba: 1 };
  C.targetsAt = function (wx, wy) {
    const g = G(), s = g.scene, out = [];
    for (const th of s.things || []) if (Math.hypot(th.x - wx, th.y - 4 - wy) < 13) out.push({ kind: 'thing', tk: th.k, o: th, x: th.x, y: th.y, label: (C.THINGS[th.k] || {}).n || th.k });
    for (const an of s.animals) if (Math.hypot(an.x - wx, an.y - wy) < 10) out.push({ kind: 'animal', o: an, x: an.x, y: an.y, label: (C.aName ? C.aName(an.k) : an.k) + (an.dead ? ' (carcass)' : '') });
    for (const a of s.actors) if (!a.dead && !a.inside && !a.inVeh && Math.hypot(a.x - wx, a.y - 8 - wy) < 12) out.push({ kind: 'actor', o: a, x: a.x, y: a.y, label: C.tagName(a.p) });
    for (const p of s.props) if (TREE[p.k] && Math.hypot(p.x - wx, p.y - wy) < 11) { out.push({ kind: 'tree', o: p, x: p.x, y: p.y, label: p.k === 'palm' ? 'Palm' : 'Tree' }); break; }
    const tt = C.tileAt(s, wx, wy); if (tt === TL.SHAL || tt === TL.DEEP) out.push({ kind: 'water', o: { x: wx, y: wy }, x: wx, y: wy, label: 'Water' });
    out.push({ kind: 'ground', o: { x: wx, y: wy }, x: wx, y: wy, label: 'Ground' });
    return out;
  };

  // ------------------------------------------------------------------------------------------------------------------
  // THE CONTEXT WHEEL: Q (or Alt+click) at the cursor opens a ring of verbs for the targets there.
  //   - verbs come from actions.js (C.verbsFor); each has an icon, a short label, and may be greyed with a reason
  //   - choosing one sends the selected people to do it (or you, if you are close and nobody is selected)
  //   - in RECORD mode (actions.js) the chosen verb is also written into the macro being recorded
  // ------------------------------------------------------------------------------------------------------------------
  const css = document.createElement('style');
  css.textContent = `
#wheel{position:fixed;z-index:8;display:none;pointer-events:none}
#wheel .hub{position:absolute;left:-18px;top:-18px;width:36px;height:36px;border-radius:50%;background:rgba(30,24,18,.9);border:1px solid var(--gold);display:flex;align-items:center;justify-content:center;font-size:15px;pointer-events:auto;cursor:pointer}
#wheel .vb{position:absolute;pointer-events:auto;min-width:64px;max-width:110px;text-align:center;padding:4px 8px;border-radius:999px;background:linear-gradient(180deg,rgba(54,44,34,.96),rgba(32,26,20,.96));border:1px solid var(--line);color:var(--ink);font-size:11px;cursor:pointer;transform:translate(-50%,-50%);animation:wIn .14s ease-out;white-space:nowrap}
#wheel .vb:hover{border-color:var(--gold);background:rgba(230,184,78,.22)}
#wheel .vb.off{opacity:.45;cursor:not-allowed}
#wheel .vb small{display:block;font-size:9px;color:var(--mute)}
#wheel .tg{position:absolute;left:-60px;top:-60px;width:120px;text-align:center;font-size:11px;color:var(--gold);text-shadow:0 1px 2px #000}
@keyframes wIn{from{opacity:0;transform:translate(-50%,-50%) scale(.6)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`;
  document.head.appendChild(css);
  const wheel = document.createElement('div'); wheel.id = 'wheel'; document.body.appendChild(wheel);

  /** Open the wheel for the targets under the cursor. */
  C.openWheel = function (sx, sy) {
    const g = G(); if (!g || !g.scene || g.modalOpen) return;
    const wv = C.toWorld(g.cam, sx, sy); const targets = C.targetsAt(wv.x, wv.y);
    // the most specific target first (things, animals, actors, trees, water) and ground last
    const verbs = []; const seen = new Set();  // entries {v: concrete verb (with .param), tg: target}
    const takenKind = {}; for (const tg of targets) { if ((tg.kind === 'actor' || tg.kind === 'animal') && takenKind[tg.kind]) continue; if (tg.kind === 'actor' || tg.kind === 'animal') takenKind[tg.kind] = 1; for (const v of C.verbsFor(tg)) { const key = v.id + ':' + JSON.stringify(v.param || '') + ':' + tg.kind + (tg.o && tg.o.id || ''); if (seen.has(key)) continue; seen.add(key); verbs.push({ v, tg }); } }
    if (!verbs.length) { ui.toast('Nothing to do there'); return; }
    const who = C.actorsForVerb(); const rec = g.rec && g.rec.on;
    const first = targets[0];
    let h = `<div class="tg">${C.es ? first.label : first.label}${rec ? '<br><b style="color:#ff8a7a">● recording</b>' : ''}</div><div class="hub" id="wheelClose" title="Close (Esc)">✕</div>`;
    wheel.style.left = sx + 'px'; wheel.style.top = sy + 'px'; wheel.innerHTML = h; wheel.style.display = 'block';
    // GROUPING: one node per verb per target; a verb with several variants (which item to take, which speech to give…)
    // opens a second ring when clicked, so the wheel never shows thirty buttons at once.
    const groups = []; const gi = {};
    for (const e of verbs) { const key = e.v.id + '|' + (e.tg.kind === 'thing' ? e.tg.o.id : ''); if (gi[key] === undefined) { gi[key] = groups.length; groups.push({ v: e.v, tg: e.tg, list: [] }); } groups[gi[key]].list.push(e); }
    const actor0 = (who[0] && who[0].p) ? who[0] : g.player;
    const whyOf = (e) => (e.v.check ? e.v.check(actor0, e.tg, e.v.param) : null);
    const node = (label, ang, R, why, fn, sub) => {
      const b = document.createElement('div'); b.className = 'vb' + (why ? ' off' : ''); b.innerHTML = label + (sub || why ? `<small>${why || sub}</small>` : '');
      b.style.left = Math.cos(ang) * R + 'px'; b.style.top = Math.sin(ang) * R + 'px'; b.onclick = () => { if (why) { ui.toast(why); return; } fn(); }; wheel.appendChild(b); return b;
    };
    const ring = (items) => { const n = items.length; return Math.max(66, 26 + n * 10); };
    const clearNodes = () => wheel.querySelectorAll('.vb').forEach((x) => x.remove());
    const top = () => {
      clearNodes(); const R = ring(groups);
      groups.forEach((gr, i) => {
        const ang = -Math.PI / 2 + (i / groups.length) * Math.PI * 2, one = gr.list.length === 1;
        const ok = gr.list.filter((e) => !whyOf(e)).length; const why = one ? whyOf(gr.list[0]) : (ok ? null : whyOf(gr.list[0]) || 'Not possible now');
        node(`${gr.v.icon || ''} ${one && gr.v.label ? gr.v.label(gr.tg, gr.v.param) : gr.v.n}${one ? '' : ' ▸'}`, ang, R, why, () => { if (one) { C.closeWheel(); C.doVerb(gr.list[0].v, gr.list[0].tg, gr.list[0].v.param); } else sub(gr); }, one ? '' : `${gr.list.length} ways`);
      });
    };
    const sub = (gr) => {
      clearNodes(); const R = ring(gr.list);
      gr.list.forEach((e, i) => { const ang = -Math.PI / 2 + (i / gr.list.length) * Math.PI * 2; node(e.v.label ? e.v.label(e.tg, e.v.param) : e.v.n, ang, R, whyOf(e), () => { C.closeWheel(); C.doVerb(e.v, e.tg, e.v.param); }); });
      wheel.querySelector('.hub').title = 'Back'; wheel.querySelector('.hub').onclick = () => { top(); wheel.querySelector('.hub').onclick = C.closeWheel; wheel.querySelector('.hub').title = 'Close (Esc)'; };
    };
    top();
    document.getElementById('wheelClose').onclick = C.closeWheel;
  };
  C.closeWheel = function () { wheel.style.display = 'none'; wheel.innerHTML = ''; };
  window.addEventListener('keydown', (e) => { const g = G(); if (!g || !g.scene || g.over) return; if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return; if (e.key === 'q' || e.key === 'Q') { if (wheel.style.display === 'block') C.closeWheel(); else C.openWheel(C.mouse.x, C.mouse.y); } if (e.key === 'Escape') C.closeWheel(); });
  document.getElementById('game').addEventListener('mousedown', (e) => { if (e.altKey && e.button === 0) { e.preventDefault(); e.stopImmediatePropagation(); C.openWheel(e.clientX, e.clientY); } else if (wheel.style.display === 'block') C.closeWheel(); }, true);

  // hover highlight for things
  setInterval(() => { const g = G(); if (!g || !g.scene || !g.scene.things) return; for (const t of g.scene.things) t.hover = false; const m = C.mouse; if (!m) return; const wv = C.toWorld(g.cam, m.x, m.y); const t = C.nearestThing(g.scene, wv.x, wv.y + 4, null, 13); if (t) t.hover = true; }, 120);
})();
