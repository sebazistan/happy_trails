/* CUBEA — camping.js : A CAMP CAN BE FOUND — and so it can be broken, carried, and set up again.

   EXPOSURE   Every hour a camp stays put, the army learns a little more about it. It rises with smoke by day, firelight and
              music by night, gunfire, the radio on the air, vehicles parked, people, and sheer time; it falls when you are
              away and resets when you move. El Viejo warns you at 60%; at 100% the army comes — a patrol in the morning, and
              from the air if the heat is high. The visibility lens (hold L) shows the number.
   BREAK CAMP A verb on the ground: strike the tents, hammocks, racks, benches, the pot, the board, the radio. Everything
              becomes "camp gear" — weight in the packs of the people and the cargo of any vehicle nearby, so a heavy camp
              slows a march and what cannot be carried is left behind (the printing press, usually).
   MAKE CAMP  Another verb, anywhere you choose: the gear comes out of the packs and goes up again around you in a sensible
              layout — kitchen at the centre, hammocks in a ring, sentries out on the edge.
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, T = C.T;
  const rnd = Math.random;
  const TUNE = { perHour: 0.35, perTenPeople: 0.25, smokeDay: 1.6, glowNight: 0.6, music: 1.0, gunfire: 3.0, radio: 4.0, vehicle: 0.3, things: 0.03, warn: 60, raid: 100, afterRaid: 40, decayAway: 5, radius: 280, moveDur: 45 };
  C.CAMPING_TUNE = TUNE;
  const WEIGHT = { hammock: 2, toolrack: 4, barbacoa: 5, woodpile: 3, marmita: 3, fire: 0, banco: 4, fragua: 10, prensa: 20, cosedora: 3, radioset: 5, camilla: 3, pizarra: 4, posta: 1, estacada: 3, tribunal: 3, snare: 0.4, stake: 0.5, cartel: 0.1, trough: 4 };
  const inv = (a) => C.initInv(a.p);
  C.ITEMS.gear = { n: 'Camp gear', icon: '⛺', w: 1.0, res: null, d: 'Tents, racks, pots and boards, folded and lashed for the march.' };
  C.ITEM_KEYS = Object.keys(C.ITEMS);

  // ---------------------------------------------------------------------------------------------------------------- exposure
  const hourly = (s, g) => {
    if ((g.sea && g.sea.active) || s.type === 'road') return;                  // no camp at sea or on the road
    if (!s.camp && !(s.things || []).some((t) => t.k === 'hammock' || t.k === 'fire')) return;
    const ppl = s.actors.filter((a) => !a.dead && (a.side === 'rebel' || a.isPlayer) && !a.inside); if (ppl.length < 3) return;
    const things = s.things || []; const fires = things.filter((t) => t.k === 'fire' && t.d.lit).length; const night = g.hour >= 19 || g.hour < 5.5;
    let e = TUNE.perHour + ppl.length / 10 * TUNE.perTenPeople + things.length * TUNE.things;
    if (fires) e += night ? TUNE.glowNight * Math.min(3, fires) : TUNE.smokeDay * Math.min(3, fires);
    if (s.actors.some((a) => a.playing)) e += TUNE.music; if (g.combatT > 0) e += TUNE.gunfire; if (things.some((t) => t.k === 'radioset' && t.d.air > g.time)) e += TUNE.radio; e += s.vehicles.filter((v) => !v.wreck).length * TUNE.vehicle;
    g.expo = g.expo || {}; const was = g.expo[s.sid] || 0; const now = clamp(was + e, 0, 130); g.expo[s.sid] = now;
    if (was < TUNE.warn && now >= TUNE.warn) { if (C.viejoSays) C.viejoSays('Hijo, we have been in this place too long. Smoke, noise, footprints. Somebody will come. Move.'); C.log(`The camp is becoming known (${Math.round(now)}% exposed). Break camp and move soon.`, 'warn'); }
    if (now >= TUNE.raid) { g.expo[s.sid] = TUNE.afterRaid; raid(s, g); }
  };
  function raid(s, g) {
    const c = s.camp ? { x: s.camp.x * T, y: s.camp.y * T } : { x: g.player.x, y: g.player.y }; C.log('The army has found the camp.', 'bad');
    if (C.spawnPatrol) C.spawnPatrol(s, 6, 'raid'); if (g.regime.heat > 45 && C.airstrike && rnd() < 0.6) C.airstrike(s, c.x - 160, c.y - 60, c.x + 160, c.y + 60, 4);
  }
  let lastH = -1; C.campingTick = function (s) { const g = G(), h = Math.floor(g.hour); if (h === lastH) return; lastH = h; hourly(s, g); };
  C.campExposure = (s) => Math.round(((G().expo || {})[s.sid]) || 0);
  C.campingDaily = function () { const g = G(); if (!g.expo) return; for (const sid in g.expo) if (!g.scene || g.scene.sid !== sid) g.expo[sid] = Math.max(0, g.expo[sid] - TUNE.decayAway); };

  // ---------------------------------------------------------------------------------------------------------------- break camp / make camp
  const capacityLeft = (s, a) => { let free = 0; for (const q of s.actors) if (!q.dead && q.side === 'rebel' || q.isPlayer) { if (q.dead) continue; free += Math.max(0, C.capacityOf(q.p) - C.loadOf(q.p)); } for (const v of s.vehicles) if (!v.wreck && Math.hypot(v.x - a.x, v.y - a.y) < 140) free += Math.max(0, (v.def.cargoCap || 0) - (C.vehLoad ? C.vehLoad(v) : 0)); return free; };
  C.registerVerb({ id: 'break_camp', n: 'Break camp', icon: '🏕', kinds: ['ground'], reach: 9999, dur: TUNE.moveDur,
    check: (a) => { const g = G(); if (g.combatT > 0) return 'Not under fire.'; const s = a.scene; if (!(s.things || []).some((t) => WEIGHT[t.k] !== undefined && Math.hypot(t.x - a.x, t.y - a.y) < TUNE.radius)) return 'There is no camp here to break.'; return null; },
    done: (a, tg) => {
      const g = G(), s = a.scene; const things = (s.things || []).filter((t) => WEIGHT[t.k] !== undefined && Math.hypot(t.x - a.x, t.y - a.y) < TUNE.radius).sort((p, q) => WEIGHT[p.k] - WEIGHT[q.k]);
      let room = capacityLeft(s, a), packed = [], left = [], w = 0;
      for (const t of things) { const wt = Math.max(0.1, WEIGHT[t.k]); if (wt <= room) { room -= wt; w += wt; packed.push({ k: t.k, d: JSON.parse(JSON.stringify(t.d || {})) }); C.removeThing(s, t); } else left.push(t); }
      // spread the weight across people and vehicles as 'gear'
      let units = Math.ceil(w); for (const v of s.vehicles) { if (units <= 0) break; if (v.wreck || Math.hypot(v.x - a.x, v.y - a.y) > 140) continue; v.cargo = v.cargo || {}; const take = Math.min(units, Math.max(0, (v.def.cargoCap || 0) - (C.vehLoad ? C.vehLoad(v) : 0))); if (take > 0) { v.cargo.gear = (v.cargo.gear || 0) + take; units -= take; } }
      const crew = s.actors.filter((q) => !q.dead && q.side === 'rebel' && !q.captive).sort((p, q) => C.capacityOf(q.p) - C.loadOf(q.p) - (C.capacityOf(p.p) - C.loadOf(p.p))); for (const q of crew) { if (units <= 0) break; const got = C.invAdd(q.p, 'gear', Math.min(units, 6)); units -= got; }
      g.packedCamp = (g.packedCamp || []).concat(packed); g.expo = g.expo || {}; g.expo[s.sid] = 0;
      C.log(`Camp struck: ${packed.length} things packed (${Math.round(w)} units of gear)${left.length ? '; left behind: ' + left.map((t) => C.THINGS[t.k].n.toLowerCase()).slice(0, 4).join(', ') : ''}.`, left.length ? 'warn' : 'good'); return null; } });
  const unload = (s, n) => { let rest = n; for (const v of s.vehicles) { if (rest <= 0) break; const c = (v.cargo && v.cargo.gear) || 0; const t = Math.min(c, rest); if (t) { v.cargo.gear -= t; rest -= t; } } for (const q of s.actors) { if (rest <= 0) break; if (q.side !== 'rebel' && !q.isPlayer) continue; const t = C.invTake(q.p, 'gear', rest); rest -= t; } };
  C.registerVerb({ id: 'make_camp', n: 'Make camp here', icon: '⛺', kinds: ['ground'], reach: 20, dur: 40,
    check: (a) => ((G().packedCamp || []).length ? (G().combatT > 0 ? 'Not under fire.' : null) : 'There is no gear packed.'),
    done: (a, tg) => {
      const g = G(), s = a.scene, list = g.packedCamp || []; let w = 0; const cx = tg.x, cy = tg.y; const by = (k) => list.filter((t) => t.k === k);
      const put = (t, x, y) => { C.addThing(s, t.k, x, y, t.d); w += Math.max(0.1, WEIGHT[t.k] || 0.1); };
      const ring = (arr, r0, r1, a0) => arr.forEach((t, i) => { const ang = (a0 || 0) + i / Math.max(1, arr.length) * Math.PI * 2; const r = r0 + (r1 - r0) * ((i % 2) * 0.5 + 0.25); put(t, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.7); });
      by('fire').forEach((t, i) => put(t, cx + i * 14, cy)); by('marmita').forEach((t, i) => put(t, cx + 10 + i * 12, cy - 4)); by('woodpile').forEach((t, i) => put(t, cx - 22 - i * 12, cy + 6)); by('barbacoa').forEach((t, i) => put(t, cx - 30, cy - 18 - i * 14)); by('toolrack').forEach((t, i) => put(t, cx - 52, cy + 8 + i * 12)); by('pizarra').forEach((t, i) => put(t, cx + 40, cy + 30 + i * 12));
      ring(by('hammock'), 44, 70, 0); ring(by('camilla'), 60, 80, 1); ring(['banco', 'fragua', 'prensa', 'cosedora', 'radioset'].flatMap(by), 70, 100, 2); ring(['posta', 'estacada', 'tribunal', 'trough', 'cartel'].flatMap(by), 100, 130, 0.4); ring(by('snare'), 150, 190, 0.3);
      unload(s, Math.ceil(w)); g.packedCamp = []; C.log('Camp made. It will take a day or two before it is comfortable — and before it is found.', 'good'); return null; } });
})();
