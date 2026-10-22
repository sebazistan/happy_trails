/* CUBEA — journeys.js : THE ROAD BETWEEN PLACES, MULE TRAINS, AND COURIERS ON FOOT.

   Travel used to be a menu: pick a place, days pass, a card says a checkpoint happened. Now the road is a place.
   • THE ROAD SCENE  choosing a destination (map, or walking through a scene's exit) takes your party and any vehicle onto a long
     road scene between the two places: a dirt road through the monte, peasants walking, an occasional carretón, sometimes a
     family by the road, a patrol, a breakdown — and sometimes a real checkpoint with a barrier, guards and your own rifles
     hidden under blankets. Time runs faster on the road (8×) so a day's walk is a few minutes; a vehicle crosses it quicker,
     which is the point of having one. Meals, thirst, heat and rain happen to the walkers as they walk.
     The checkpoint: walk up and the sergeant's question is asked of you: bribe, bluff, run for it, or turn back. What is hidden
     in the trunk and the blankets matters (garage.js checkpointSearch).
   • MULE TRAINS     supplies from the lowlands arrive at the Sierra camp as a drover and three mules who walk in from the edge
     and unload; you may meet them, and sometimes they do not arrive (the army took them).
   • COURIERS        the Havana pipeline's money arrives as a person on foot, who hands it to you (verb) or leaves it with the
     storekeeper after two days. Interception is decided on the road, out of sight, as before.
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, T = C.T, TL = C.TILE;
  const rnd = Math.random;

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    timeMul: 8, tilesPerDay: 55, minW: 70, maxW: 230, H: 30,
    chance: 0.28, heatW: 0.004, vehBonus: 0.05,
    walkers: [3, 7], carts: [1, 3],
    muleChance: 0.07, muleCargo: { food: [8, 22], ammo: [0, 25], med: [0, 3] }, muleLostChance: 0.12,
    courierPatience: 2,
  };
  C.JOURNEY_TUNE = TUNE;
  const A = () => C.ai;

  // ------------------------------------------------------------------------------------------------------------------
  // THE ROAD SCENE
  // ------------------------------------------------------------------------------------------------------------------
  C.THINGS.barrera = { n: 'Checkpoint barrier', draw(c, t) { c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(t.x - 22, t.y + 1, 44, 3); c.fillStyle = 'rgb(120,96,68)'; c.fillRect(t.x - 24, t.y - 14, 3, 15); c.fillRect(t.x + 21, t.y - 14, 3, 15); for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? 'rgb(240,240,236)' : 'rgb(200,50,44)'; c.fillRect(t.x - 21 + i * 7, t.y - 11, 7, 3.4); } c.fillStyle = 'rgb(96,110,76)'; c.fillRect(t.x + 26, t.y - 18, 16, 14); c.fillStyle = 'rgb(170,150,90)'; c.beginPath(); c.moveTo(t.x + 24, t.y - 18); c.lineTo(t.x + 34, t.y - 25); c.lineTo(t.x + 44, t.y - 18); c.fill(); } };
  const SET = (rid, from, to) => { const A0 = C.SETTLEMENTS[from], B0 = C.SETTLEMENTS[to]; C.SETTLEMENTS[rid] = { name: `The road: ${A0.name} → ${B0.name}`, type: 'road', road: true }; C.W.bySet[rid] = C.W.bySet[rid] || []; };
  function makeRoad(rid, from, to, days) {
    SET(rid, from, to); const W = clamp(Math.round(days * TUNE.tilesPerDay), TUNE.minW, TUNE.maxW), H = TUNE.H;
    const s = new C.Scene(rid, 'road', W, H); s.hhs = []; const R = s.R, noise = C.makeNoise(31 + W);
    s.rect(0, 0, W, H, TL.G);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = noise(x * 0.07, y * 0.12); if (y < 5 + n * 4 || y > H - 6 - n * 4) s.set(x, y, TL.FOR); else if (n > 0.7) s.set(x, y, TL.FOR); }
    const pts = []; for (let x = 0; x <= W; x += 8) pts.push([x, H / 2 + Math.sin(x * 0.08) * 3.4]); s.line(pts, 3.2, TL.TRAIL);
    for (let i = 0; i < W * 0.9; i++) { const x = R.irange(2, W - 3), y = R.irange(2, H - 3); const t = s.get(x, y); if ((t === TL.G || t === TL.FOR) && R() < 0.7) s.prop(R() < 0.5 ? 'palm' : 'tree', x, y); }
    const mid = Math.round(H / 2);
    s.exits.push({ x: 0, y: mid - 5, w: 3, h: 10, label: A0n(from), dest: from, side: 'w' }, { x: W - 3, y: mid - 5, w: 3, h: 10, label: A0n(to), dest: to, side: 'e' });
    s.rect(0, mid - 5, 3, 10, TL.TRAIL, [TL.FOR]); s.rect(W - 3, mid - 5, 3, 10, TL.TRAIL, [TL.FOR]);
    s.spawn = { x: 6 * T, y: mid * T }; s.title = `The road to ${C.SETTLEMENTS[to].name}`; s.road = { from, to, days, W, H, mid };
    return s;
  }
  const A0n = (sid) => '→ ' + C.SETTLEMENTS[sid].name;
  const roadY = (s, x) => (s.road.H / 2 + Math.sin(x / T * 0.08) * 3.4) * T;

  /** Populate the road with what the journey meets. Called once when the party arrives on it. */
  function populate(s, mode) {
    const g = G(), R = s.R, W = s.road.W; const mid = s.road.mid;
    const place = (frac) => { const x = Math.round(W * frac); return { x: x * T + 8, y: roadY(s, x * T) }; };
    // everyday traffic
    const nW = TUNE.walkers[0] + Math.floor(rnd() * (TUNE.walkers[1] - TUNE.walkers[0] + 1));
    for (let i = 0; i < nW; i++) { const p = pickPeasant(s); if (!p) break; const q = place(0.15 + rnd() * 0.7); const a = C.makeActor(s, p, q.x, q.y + (rnd() - 0.5) * 12); a.side = 'civ'; a.task = { kind: 'spot', x: rnd() < 0.5 ? 5 * T : (W - 5) * T, y: q.y }; a.speed = 30 + rnd() * 8; s.actors.push(a); C.ai.setPath(s, a, a.task.x, a.task.y); a.roadWalker = true; }
    const nC = TUNE.carts[0] + Math.floor(rnd() * (TUNE.carts[1] - TUNE.carts[0] + 1));
    for (let i = 0; i < nC; i++) { const q = place(0.2 + rnd() * 0.6); const v = C.addVehicle(s, 'carreton', q.x, q.y, rnd() < 0.5 ? 0 : Math.PI, { fuel: 0 }); v.driving = true; v.ambient = true; v.route = [{ x: v.ang === 0 ? (W - 4) * T : 4 * T, y: q.y }]; v.ri = 0; }
    // the day's incident
    const chance = TUNE.chance + g.regime.heat * TUNE.heatW + (mode === 'vehicle' ? TUNE.vehBonus : 0), dest = s.road.to;
    if (rnd() < chance && dest !== 'sierra' && s.road.from !== 'sierra' || rnd() < chance * 0.5) {
      const k = ['checkpoint', 'checkpoint', 'patrol', 'family', 'breakdown'][(rnd() * 5) | 0]; s.road.incident = k;
      if (k === 'checkpoint') { const q = place(0.5 + (rnd() - 0.5) * 0.2); C.addThing(s, 'barrera', q.x, q.y, {}); s.road.check = { x: q.x, y: q.y, done: false }; for (let i = 0; i < 3; i++) { const sol = C.armyActor(s, q.x + 30 + i * 12, q.y - 14 + (i % 2) * 24, i === 0 ? 'thompson' : 'rifle'); sol.brain.mode = 'guard'; sol.stanceOv = 'hold'; sol.checkpoint = true; } }
      if (k === 'patrol') { const q = place(0.35 + rnd() * 0.3); for (let i = 0; i < 4; i++) { const sol = C.armyActor(s, q.x + i * 10, q.y + (rnd() - 0.5) * 8, i === 0 ? 'thompson' : 'rifle'); sol.brain.mode = 'patrol'; } }
      if (k === 'family') { const q = place(0.4 + rnd() * 0.3); for (let i = 0; i < 3; i++) { const p = pickPeasant(s, true); if (!p) break; const a = C.makeActor(s, p, q.x + i * 9, q.y + 16); a.side = 'civ'; a.react = { id: 'help', t: 0, until: g.time + 9999, at: null, subj: g.player, phase: 0 }; s.actors.push(a); } }
      if (k === 'breakdown') s.road.breakdownAt = 0.3 + rnd() * 0.4;
    }
  }
  function pickPeasant(s, sympathetic) { const pool = C.W.people.filter((p) => p.status === 'alive' && !p.mil && !p.actor && (p.fac === 'peasants' || p.fac === 'workers') && C.ageOf(p) > 15 && (!sympathetic || p.trueStance > 10)); return pool.length ? pool[(rnd() * pool.length) | 0] : null; }

  // ------------------------------------------------------------------------------------------------------------------
  // BEGINNING AND ENDING A JOURNEY
  // ------------------------------------------------------------------------------------------------------------------
  /** Called first by main.js C.travelTo: returns true if the journey is handled here (as a road scene). */
  C.travelToRoad = function (dest, mode, squadsGoing) {
    const g = G(); if (!C.SETTLEMENTS[dest] || (g.sea && g.sea.active)) return false;
    if (g.scene.type === 'road') {                           // choosing a new destination from the road: go back to where you set out from first
      const rs = g.scene, from = g.journey ? g.journey.from : rs.road.from; if (from === dest) { C.ui.toast('You are already on the way back.'); return true; }
      const party = rs.actors.filter((x) => !x.dead && x.side === 'rebel' && x.squad >= 0 && !x.isPlayer).map((x) => x.p.id); g.journey = null; C.enterScene(from, { party, far: true });
    }
    const cur = g.scene.sid; if (!C.PLAYABLE.includes(cur) || !C.PLAYABLE.includes(dest)) return false;
    const cost = C.travelCost(cur, dest), veh = mode === 'vehicle' ? g.vehicle : null;
    if (mode === 'vehicle' && !veh) { C.ui.toast('You need to be driving a vehicle.'); return true; }
    const days = mode === 'vehicle' ? cost.hours / 24 : cost.days;
    if (veh && veh.def.tank) { const need = cost.hours * veh.def.burn * 0.9 * (C.fuelMod ? C.fuelMod() : 1); if (veh.fuel < need) { C.ui.toast(`Not enough fuel (${Math.ceil(need)} needed)`); return true; } }
    const going = squadsGoing ? g.squads.filter((sq) => squadsGoing.includes(sq.id)).flatMap((sq) => sq.members) : [];
    const rid = `road:${cur}>${dest}`; delete C.scenes[rid]; C.ui.closeModal && C.ui.closeModal();
    const old = g.scene; if (veh) old.vehicles = old.vehicles.filter((v) => v !== veh);
    g.journey = { from: cur, to: dest, mode, rid, t0: g.min, vehicle: veh, fuel0: veh ? veh.fuel : 0, cost };
    const s = makeRoad(rid, cur, dest, days); C.scenes[rid] = s; populate(s, mode); s.populated = true;
    C.enterScene(rid, { party: going, far: true, vehicle: veh });
    if (veh) { C.enterVehicle(g.player, veh); g.vehicle = veh; C.boardParty(veh); }
    C.log(`You set out on the road to ${C.SETTLEMENTS[dest].name} (${mode === 'vehicle' ? Math.round(cost.hours) + ' hours' : days.toFixed(1) + ' days'} on foot or by cart).`, 'info');
    return true;
  };
  // leaving the road scene through either end
  C.journeyExit = function (e) {
    const g = G(), s = g.scene; if (s.type !== 'road' || g.exitPrompt) return; g.exitPrompt = true;
    const j = g.journey; const veh = g.vehicle;
    if (veh && veh.def.tank && j) { const used = j.cost.hours * veh.def.burn * 0.9 * (C.fuelMod ? C.fuelMod() : 1) * (e.dest === j.to ? 1 : 0.5); veh.fuel = Math.max(0, veh.fuel - used); }
    const party = s.actors.filter((a) => !a.dead && a.side === 'rebel' && a.squad >= 0 && !a.isPlayer).map((a) => a.p.id);
    s.vehicles = s.vehicles.filter((v) => v !== veh); g.journey = null;
    C.enterScene(e.dest, { party, far: true, vehicle: veh }); if (veh) { C.enterVehicle(g.player, veh); g.vehicle = veh; C.boardParty(veh); }
  };
  // time runs fast on the road
  C.afterEnter = function (s) { const g = G(); if (s && s.type === 'road') { if (!g.mpsSaved) g.mpsSaved = g.minPerSec; g.minPerSec = g.mpsSaved * TUNE.timeMul; } else if (g.mpsSaved) { g.minPerSec = g.mpsSaved; g.mpsSaved = 0; } };

  // ------------------------------------------------------------------------------------------------------------------
  // ON THE ROAD (per frame)
  // ------------------------------------------------------------------------------------------------------------------
  C.journeyTick = function (s, dt) {
    const g = G(); if (s.type !== 'road' || !s.road) return; const r = s.road, pl = g.player; if (!pl) return;
    // the ends of the road (also reached by vehicle)
    for (const e of s.exits) if (pl.x > e.x * T && pl.x < (e.x + e.w) * T && pl.y > e.y * T && pl.y < (e.y + e.h) * T) { C.journeyExit(e); return; }
    // the barrier
    if (r.check && !r.check.done && Math.hypot(pl.x - r.check.x, pl.y - r.check.y) < 90 && !g.modalOpen && !g.paused) {
      const guards = s.actors.filter((a) => a.checkpoint && !a.dead); if (!guards.length) { r.check.done = true; }
      else if (!pl.weaponOut && !(pl.shooting > 0) && !guards.some((a) => a.brain.mode === 'engage')) { r.check.done = true; checkpointCard(s, guards); }
    }
    // a breakdown part-way
    if (r.breakdownAt !== undefined && g.vehicle && pl.x / T > r.W * r.breakdownAt && !r.broke) { r.broke = true; const v = g.vehicle; const ids = ['hose', 'belt', 'plugs', 'clog', 'battery']; const id = ids[(rnd() * ids.length) | 0]; if (C.vState && v.faults) { C.vState(v); v.faults.push({ id, n: C.FAULT[id].n, known: true, t: g.time }); C.say(v.driver || pl, '¡Ay, no!', '#7a1d1d', 3); C.log(`The ${v.def.n} breaks down on the road: ${C.FAULT[id].n}.`, 'warn'); } }
    // a patrol shouting and the party in view: they just look; shooting only if rifles are out (the usual rules)
  };
  function checkpointCard(s, guards) {
    const g = G(); const party = s.actors.filter((a) => a.side === 'rebel' && !a.dead);
    const hidden = party.filter((a) => a.p.stash).length; const veh = g.vehicle; const sr = veh && C.checkpointSearch ? C.checkpointSearch(veh) : { contraband: false, guns: 0, people: 0 };
    const armed = hidden + (sr.guns ? 1 : 0) + sr.people; const note = hidden ? 'Your men carry rifles under blankets.' : 'You carry only what can be hidden.';
    const out = (txt, kind) => { C.log(txt, kind); };
    C.ui.card({ title: 'Checkpoint', icon: '🚧', body: `A sergeant of the Rural Guard raises a hand beside the barrier. Three soldiers watch you. ${note}${sr.people ? ' There are people in the trunk.' : ''}`, choices: [
      { label: 'Bribe the sergeant (20 pesos)', sub: 'Quick and quiet', disabled: g.res.money < 20, fn: () => { g.res.money -= 20; guards.forEach((a) => { a.checkpoint = false; }); out('The sergeant pockets it and lifts the bar.', 'info'); } },
      { label: 'Bluff — you are cane merchants', sub: armed ? 'Risky with what you carry' : 'Likely to work', fn: () => { const ok = rnd() < (armed ? 0.3 : 0.78) + (g.player.p.exp * 0.002); if (ok) { guards.forEach((a) => { a.checkpoint = false; }); out('The guards wave you through.', 'good'); } else { out('They search your things.', 'bad'); revealed(s, guards); } } },
      { label: 'Break through', sub: 'Weapons out. This will be a fight.', fn: () => { revealed(s, guards); } },
      { label: 'Turn back before they see you', fn: () => { const j = g.journey; const back = s.exits.find((e) => e.dest === (j ? j.from : null)) || s.exits[0]; g.player.x = (back.x + back.w / 2) * T + 40; g.player.y = (back.y + back.h / 2) * T; for (const a of party) { a.x = g.player.x + (rnd() - 0.5) * 20; a.y = g.player.y + (rnd() - 0.5) * 20; } } },
    ] });
  }
  function revealed(s, guards) { const g = G(); for (const a of s.actors) if ((a.side === 'rebel' || a.isPlayer)) { a.covertNow = false; if (a.p.stash) { a.weapon = a.p.stash; a.p.stash = null; } a.weaponOut = !!a.weapon; a.exposed = 8; } for (const a of guards) { a.brain.mode = 'engage'; a.checkpoint = false; } g.regime.heat = clamp(g.regime.heat + 3, 0, 100); }

  // ------------------------------------------------------------------------------------------------------------------
  // MULE TRAINS
  // ------------------------------------------------------------------------------------------------------------------
  C.ANIMALS.mule = { n: 'mula', sz: 5.4, col: [118, 96, 78], food: 0, spd: 22 };
  if (C.LEX) C.LEX.a_mule = ['mule', 'mula', 2];
  C.muleDaily = function () {
    const g = G(); g.muleQ = g.muleQ || []; if (rnd() > TUNE.muleChance + (g.supportMean || 0) * 0.001) return;
    const c = TUNE.muleCargo, rr = (a) => Math.round(a[0] + rnd() * (a[1] - a[0])); g.muleQ.push({ food: rr(c.food), ammo: rr(c.ammo), med: rr(c.med), lost: rnd() < TUNE.muleLostChance });
  };
  C.muleTick = function (s, dt) {
    const g = G(); if (s.sid !== 'sierra' || !s.camp) return;
    if (g.muleQ && g.muleQ.length && !s.mule) {
      const m = g.muleQ.shift(); if (m.lost) { C.log('A mule train from the lowlands never arrived — the army took it, they say.', 'warn'); return; }
      const p = pickPeasant(s, true); if (!p) { g.res.food += m.food; return; }
      const x0 = s.camp.x * T - 300, y0 = s.camp.y * T + 90; const a = C.makeActor(s, p, x0, y0); a.side = 'civ'; a.speed = 26; a.recruit = null; a.muleDrover = true; s.actors.push(a);
      const mules = []; for (let i = 0; i < 3; i++) { const an = { k: 'mule', def: C.ANIMALS.mule, x: x0 - 14 - i * 12, y: y0 + (i - 1) * 6, hx: x0, hy: y0, face: 1, anim: 0, moving: false, dead: false, wait: 0, hp: 40, hpMax: 40, tx: x0, ty: y0, wild: false, owner: a }; s.animals.push(an); mules.push(an); }
      s.mule = { drover: a, mules, cargo: m, tx: s.camp.x * T - 40, ty: s.camp.y * T + 60 }; C.log('A mule train is coming up the trail with supplies.', 'info'); C.ai.setPath(s, a, s.mule.tx, s.mule.ty);
    }
    const mt = s.mule; if (!mt) return; const a = mt.drover;
    if (a.dead) { for (const an of mt.mules) an.owner = null; s.mule = null; return; }
    const d = Math.hypot(mt.tx - a.x, mt.ty - a.y);
    if (!mt.arrived) { a.task = null; if (d > 14) { C.ai.followPath(s, a, dt, a.speed * C.ai.terrainSpeed(s, a)); } else { mt.arrived = true; mt.t = 0; const c = mt.cargo; g.res.food += c.food; g.res.ammo += c.ammo; g.res.med += c.med; C.log(`The mule train arrives: ${c.food} food${c.ammo ? ', ' + c.ammo + ' cartridges' : ''}${c.med ? ', ' + c.med + ' medicine' : ''}.`, 'good'); C.say(a, '¡Mercancía de la llanura!', '#1d5b2a', 4); } }
    else { mt.t += dt; a.moving = false; if (mt.t > 40) { a.gone = true; const i = s.actors.indexOf(a); if (i >= 0) s.actors.splice(i, 1); for (const an of mt.mules) { const j = s.animals.indexOf(an); if (j >= 0) s.animals.splice(j, 1); } s.mule = null; } }
    // the mules follow their drover in a line
    mt.mules.forEach((an, i) => { if (an.dead) return; const tx = a.x - 14 - i * 13, ty = a.y + 2 + (i % 2) * 5; const dd = Math.hypot(tx - an.x, ty - an.y); if (dd > 4) { const sp = 34 * (dd > 40 ? 1.6 : 1); an.x += (tx - an.x) / dd * sp * dt; an.y += (ty - an.y) / dd * sp * dt; an.moving = true; an.anim += sp * dt * 0.6; an.face = a.x >= an.x ? 1 : -1; an.wait = 1; } else an.moving = false; });
  };

  // ------------------------------------------------------------------------------------------------------------------
  // COURIERS ARRIVE ON FOOT
  // ------------------------------------------------------------------------------------------------------------------
  const send = C.sendCourier;
  C.courierArrives = function (id, amount) { const g = G(); g.courierQ = g.courierQ || []; g.courierQ.push({ id, amount, day: g.day }); };
  C.courierTick = function (s, dt) {
    const g = G(); if (s.sid !== 'sierra' || !s.camp || !g.courierQ || !g.courierQ.length) return; const c = g.courierQ[0]; if (g.day - c.day > TUNE.courierPatience) { g.courierQ.shift(); g.res.money += c.amount; g.stats.pesos += c.amount; C.log(`${c.amount} pesos from Havana were left with the camp storekeeper.`, 'good'); return; }
    if (c.spawned) return; c.spawned = true; const p = C.P(c.id); if (!p) { g.courierQ.shift(); return; }
    const x0 = s.camp.x * T - 280, y0 = s.camp.y * T + 70; const a = C.makeActor(s, p, x0, y0); a.side = 'civ'; a.speed = 34; a.courier = c; a.recruit = { since: g.day, tx: s.camp.x * T - 50, ty: s.camp.y * T + 60 }; s.actors.push(a); C.log(`${C.tagName(p)} has come up from Havana with money for you.`, 'info');
  };
  C.registerVerb({ id: 'receive_funds', n: 'Receive the pipeline money', icon: '💰', kinds: ['actor'], reach: 26, dur: 4,
    check: (a, tg) => (!tg.o.courier ? 'Not a courier.' : null),
    done: (a, tg) => { const g = G(), c = tg.o.courier; g.res.money += c.amount; g.stats.pesos += c.amount; g.courierQ = (g.courierQ || []).filter((x) => x !== c); tg.o.courier = null; tg.o.recruit = null; C.log(`${c.amount} pesos from Havana reach the Sierra.`, 'good'); C.say(tg.o, 'Con el cariño de La Habana.', '#1d5b2a', 3); C.bondEvent && C.bondEvent(a.p, tg.o.p, 'shared', 1); return null; } });
  // the pipeline's arrival is now a person on foot (processCouriers in sim.js calls this when a trip succeeds)
  C.sendCourier = send;
})();
