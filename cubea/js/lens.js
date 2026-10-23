/* CUBEA — lens.js : INFORMATION WITHOUT PANELS — hold L to see the island through a lens.

   Instead of opening a chart, hold L: every person and thing in view is tinted by one measure, green (fine) to red (bad), with the
   number beside your own people. Tap L to move to the next lens; roll the mouse wheel while holding L to choose; release and it is gone.
   LENSES: Hunger · Thirst · Fatigue · Mood · Health · Strain (heat/cold) · Loyalty · Visibility (what the army could see or hear from
   far off: smoke, firelight, music, shots, and the radius at which each soldier would spot you) · Climate (feels-like tint) · Supplies
   (what is in each rack, pile, pot and tank).
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, T = C.T;
  const LENSES = [
    { id: 'hunger', n: 'Hunger', f: (a) => bad(a.p.needs.food, 0, 100, true), t: (a) => Math.round(a.p.needs.food) },
    { id: 'thirst', n: 'Thirst', f: (a) => bad(a.p.needs.water, 0, 100, true), t: (a) => Math.round(a.p.needs.water) },
    { id: 'fatigue', n: 'Fatigue', f: (a) => 1 - (a.p.needs.energy / 100) * (1 - (a.p.body ? a.p.body.sleepDebt / 48 : 0) * 0.5), t: (a) => Math.round(a.p.needs.energy) },
    { id: 'mood', n: 'Mood', f: (a) => bad(a.p.mind ? a.p.mind.happiness : 50, 0, 100, true), t: (a) => Math.round(a.p.mind ? a.p.mind.happiness : 50) },
    { id: 'health', n: 'Health', f: (a) => 1 - a.p.hp / (a.p.maxHp || 100), t: (a) => Math.round(a.p.hp) },
    { id: 'strain', n: 'Heat / cold strain', f: (a) => (a.p.body ? Math.max(a.p.body.heat, a.p.body.chill) / 100 : 0), t: (a) => (a.p.body ? Math.round(Math.max(a.p.body.heat, a.p.body.chill)) + (a.p.body.heat >= a.p.body.chill ? '↑' : '↓') : '') },
    { id: 'loyalty', n: 'Loyalty', f: (a) => 1 - (clamp(a.p.trueStance, -100, 100) + 100) / 200, t: (a) => Math.round(a.p.trueStance), all: true },
    { id: 'visibility', n: 'Visibility to the army', special: true },
    { id: 'climate', n: 'Climate', special: true },
    { id: 'supplies', n: 'Supplies', special: true },
  ];
  C.LENSES = LENSES;
  function bad(v, lo, hi, high) { const t = (v - lo) / (hi - lo); return high ? 1 - t : t; }
  const col = (t, a) => { t = clamp(t, 0, 1); const r = Math.round(60 + 195 * Math.min(1, t * 2)), g = Math.round(200 - 140 * Math.max(0, t - 0.4) / 0.6 - 30 * (1 - Math.min(1, t * 2))), b = 70; return `rgba(${r},${Math.max(40, g)},${b},${a === undefined ? 0.85 : a})`; };
  const S = { on: false, i: 0, t0: 0, flash: 0 };
  C.lens = S;

  // input: hold L, tap L to cycle, wheel while held to choose
  window.addEventListener('keydown', (e) => { if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return; const g = G(); if (!g || !g.scene || g.over || g.modalOpen) return; if ((e.key === 'l' || e.key === 'L') && !e.repeat && !e.ctrlKey && !e.metaKey) { S.on = true; S.t0 = performance.now(); } });
  window.addEventListener('keyup', (e) => { if (e.key === 'l' || e.key === 'L') { if (S.on && performance.now() - S.t0 < 230) { S.i = (S.i + 1) % LENSES.length; S.flash = performance.now() + 1600; } S.on = false; } });
  window.addEventListener('wheel', (e) => { if (S.on) { S.i = (S.i + (e.deltaY > 0 ? 1 : LENSES.length - 1)) % LENSES.length; S.t0 = 0; e.preventDefault(); e.stopImmediatePropagation(); } }, { capture: true, passive: false });
  window.addEventListener('blur', () => { S.on = false; });

  /** Called from render.js just before the day/night overlay. */
  C.drawLens = function (ctx, s, cam, W, H, z) {
    const showing = S.on || performance.now() < S.flash; if (!showing) return; const L = LENSES[S.i]; const g = G();
    // title chip
    ctx.save(); ctx.font = '600 12px Inter, system-ui, sans-serif'; const label = `Lens · ${L.n}`, tw = ctx.measureText(label).width + 22; ctx.fillStyle = 'rgba(24,20,16,.85)'; ctx.fillRect(W / 2 - tw / 2, 100, tw, 22); ctx.strokeStyle = "rgba(232,195,106,.7)"; ctx.strokeRect(W / 2 - tw / 2 + .5, 100.5, tw - 1, 21); ctx.fillStyle = '#e8c36a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, W / 2, 111);
    ctx.fillStyle = 'rgba(243,234,216,.6)'; ctx.font = '10px Inter, system-ui, sans-serif'; ctx.fillText("hold L · tap L or roll the wheel to change", W / 2, 130); ctx.restore();
    if (!S.on && performance.now() > S.flash) return;
    if (L.id === 'climate') return climate(ctx, g, W, H);
    if (L.id === 'visibility') return visibility(ctx, s, cam, W, H, z, g);
    if (L.id === 'supplies') return supplies(ctx, s, cam, W, H, z);
    ctx.save(); ctx.lineWidth = 2;
    for (const a of s.actors) {
      if (a.dead || a.inside || a.gone || a.inVeh || !C.visible(a)) continue; if (!L.all && !(a.side === 'rebel' || a.isPlayer) && L.id !== 'loyalty' && L.id !== 'hunger' && L.id !== 'health') continue;
      const sp = C.toScreen(cam, a.x, a.y + 2); if (sp.x < -30 || sp.x > W + 30 || sp.y < -30 || sp.y > H + 30) continue; const t = L.f(a); const r = Math.max(7, 8.5 * z);
      ctx.fillStyle = col(t, 0.35); ctx.strokeStyle = col(t, 0.95); ctx.beginPath(); ctx.ellipse(sp.x, sp.y, r, r * 0.45, 0, 0, 6.3); ctx.fill(); ctx.stroke();
      if (a.side === 'rebel' || a.isPlayer || L.id === 'loyalty') { ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3; ctx.font = '600 ' + Math.max(9, 3 * z + 3) + 'px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const txt = String(L.t(a)); ctx.strokeText(txt, sp.x, sp.y - r * 0.2 - 2); ctx.fillText(txt, sp.x, sp.y - r * 0.2 - 2); ctx.lineWidth = 2; }
    }
    ctx.restore();
  };

  function climate(ctx, g, W, H) {
    const c = g.clim; if (!c) return; ctx.save(); const hot = clamp((c.feels - 28) / 10, 0, 1), cold = clamp((20 - c.feels) / 12, 0, 1);
    ctx.fillStyle = hot > cold ? `rgba(255,140,40,${0.08 + 0.28 * hot})` : `rgba(80,150,255,${0.08 + 0.3 * cold})`; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 4; ctx.font = '700 30px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; const t = `${Math.round(c.temp)}°C`; ctx.strokeText(t, W / 2, H * 0.42); ctx.fillText(t, W / 2, H * 0.42);
    ctx.font = '600 14px Inter, system-ui, sans-serif'; const w = `feels like ${Math.round(c.feels)}° · humidity ${Math.round(c.humid * 100)}% · wind ${c.wind < 0.3 ? 'calm' : c.wind < 0.7 ? 'fresh' : 'strong'}${c.front ? ' · a norte is blowing' : ''}${c.heatwave ? ' · heat wave' : ''}`; ctx.strokeText(w, W / 2, H * 0.42 + 26); ctx.fillText(w, W / 2, H * 0.42 + 26); ctx.restore();
  }
  function ring(ctx, x, y, r, c, label, dash) { ctx.save(); ctx.strokeStyle = c; ctx.fillStyle = c.replace(/[\d.]+\)$/, '0.10)'); ctx.lineWidth = 1.6; if (dash) ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.62, 0, 0, 6.3); ctx.fill(); ctx.stroke(); if (label) { ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3; ctx.font = '600 10px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeText(label, x, y - r * 0.62 - 3); ctx.fillText(label, x, y - r * 0.62 - 3); } ctx.restore(); }
  function visibility(ctx, s, cam, W, H, z, g) {
    const night = g.hour >= 19.5 || g.hour < 5.5, day = !night; const sc = (px) => px * z;
    // soldiers: the distance at which each would pick you out right now
    if (C.campExposure && s.camp && C.campExposure(s) > 0) { ctx.fillStyle = 'rgba(255,200,120,0.95)'; ctx.font = '12px sans-serif'; const cp = C.toScreen(cam, s.camp.x * C.T, s.camp.y * C.T); ctx.fillText('camp known: ' + C.campExposure(s) + '%', cp.x - 40, cp.y - 30); }
    const pl = g.player; for (const a of s.actors) { if (a.side !== 'army' || a.dead || a.inside) continue; const sp = C.toScreen(cam, a.x, a.y); if (sp.x < -300 || sp.x > W + 300 || sp.y < -300 || sp.y > H + 300) continue; const r = C.detectRange(a, pl, s) * (C.alertMod ? C.alertMod(a) : 1); ring(ctx, sp.x, sp.y, sc(r), 'rgba(230,80,70,0.55)', null, true); }
    // fires: smoke by day, glow by night
    for (const t of s.things || []) { const sp = C.toScreen(cam, t.x, t.y); if (t.k === 'fire' && t.d.lit) ring(ctx, sp.x, sp.y, sc(day ? 300 : 220), day ? 'rgba(200,200,200,0.7)' : 'rgba(255,170,60,0.75)', day ? 'smoke can be seen from afar' : 'firelight', false); if (t.k === 'radioset' && t.d.air > g.time) ring(ctx, sp.x, sp.y, sc(500), 'rgba(255,230,120,0.8)', 'on the air — they are triangulating', false); }
    // music and shots
    for (const a of s.actors) { if (a.playing) { const sp = C.toScreen(cam, a.x, a.y); ring(ctx, sp.x, sp.y, sc(260), 'rgba(160,120,220,0.8)', 'music carries', false); } if (a.shooting > 0) { const sp = C.toScreen(cam, a.x, a.y); ring(ctx, sp.x, sp.y, sc(520), 'rgba(255,120,80,0.8)', 'gunfire', false); } }
    // you
    const sp = C.toScreen(cam, pl.x, pl.y); const camo = Math.round((1 - (pl.camo || 0)) * 100); ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3; ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; const m = `you are ${camo}% visible${pl.hide ? ' (hiding)' : pl.moving ? ' (moving)' : ''}`; ctx.strokeText(m, sp.x, sp.y + 22); ctx.fillText(m, sp.x, sp.y + 22); ctx.restore();
  }
  function supplies(ctx, s, cam, W, H, z) {
    ctx.save(); ctx.font = '600 10px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; const out = (t, x, y, c) => { ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 3; ctx.strokeText(t, x, y); ctx.fillStyle = c || '#fff'; ctx.fillText(t, x, y); };
    const g = G();
    for (const t of s.things || []) { const sp = C.toScreen(cam, t.x, t.y - 14); if (sp.x < -40 || sp.x > W + 40 || sp.y < -40 || sp.y > H + 40) continue; let txt = null, c = '#fff';
      if (t.k === 'barbacoa') { txt = `food ${Math.round(g.res.food)}`; c = g.res.food < 10 ? '#ff8a7a' : '#bff0c0'; } else if (t.k === 'woodpile') { txt = `wood ${Math.round(g.res.lena || 0)}`; c = (g.res.lena || 0) < 4 ? '#ff8a7a' : '#fff'; } else if (t.k === 'marmita') txt = t.d.serv > 0 ? `${t.d.serv} servings` : 'empty'; else if (t.k === 'fire') txt = t.d.lit ? (t.d.coffee > 0 ? `lit · ${t.d.coffee} cups` : 'lit') : 'cold'; else if (t.k === 'camilla') txt = t.d.occ ? 'occupied' : 'free'; else if (t.k === 'latrine') txt = t.d.covered ? 'covered' : `${t.d.use || 0}/14`; else if (t.k === 'crop') txt = `${Math.round((t.d.g || 0) * 100)}%`; else if (t.k === 'snare') txt = t.d.catch ? 'caught!' : 'set';
      if (txt) out(txt, sp.x, sp.y, c); }
    for (const v of s.vehicles) { if (v.gone) continue; const sp = C.toScreen(cam, v.x, v.y - 12); if (sp.x < -40 || sp.x > W + 40) continue; if (v.def.tank) out(`fuel ${Math.round(v.fuel)}/${v.def.tank}${v.faults && v.faults.some((f) => f.known) ? ' ⚠' : ''}`, sp.x, sp.y, v.fuel < 8 ? '#ff8a7a' : '#fff'); }
    for (const it of s.items) { const sp = C.toScreen(cam, it.x, it.y - 6); if (sp.x < -30 || sp.x > W + 30) continue; out(it.label || it.k, sp.x, sp.y, '#ffe28a'); }
    ctx.restore();
  }
})();
