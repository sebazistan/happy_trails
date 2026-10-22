/* CUBEA — sim.js : the political simulation. Events -> memories spreading through family & friend ties -> daily loyalty
   updates from policy fit, needs, memories, fear and peer pull. Also economy, promises/trust, reputation, regime meters. */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  const clamp = C.clamp;
  const G = () => C.G;
  C.TUNE = { rate: 0.05, memHalf: 70, memHalfKin: 260, policyW: 46, bgW: 14, needW: 0.2, peerW: 0.12, memW: 0.55, memCap: 75, fearW: 0.25 };

  // ---------------- new game ----------------
  C.newGame = function (seed, opts) {
    opts = opts || {};
    C.scenes = {};
    C.genWorld(seed);
    const g = C.G = {
      seed, opts, scene: null, player: null, cam: { x: 0, y: 0, z: 2.3 }, time: 0, min: 16.5 * 60, day: 0, hour: 16.5, weekday: 3, speed: 1, paused: false, minPerSec: 1.5,
      shake: 0, flash: 0, hurt: 0, weather: { rain: 0, fog: 0, target: 0, t: 0 }, orderMarks: [], selected: null, combatT: 0,
      squads: [
        { id: 0, name: 'Vanguardia', col: '#e4574b', members: [], stance: 'follow', fireNow: false },
        { id: 1, name: 'Centro', col: '#e8a23a', members: [], stance: 'follow', fireNow: false },
        { id: 2, name: 'Retaguardia', col: '#5ab0e8', members: [], stance: 'follow', fireNow: false },
        { id: 3, name: 'Sanidad', col: '#7fd07a', members: [], stance: 'follow', fireNow: false },
      ],
      curSquad: 0,
      res: { food: 24, money: 140, ammo: 60, med: 5, fuel: 12, gren: 3, dyn: 0, pamph: 0, vales: 0, cloth: 6, scrap: 8 },
      policy: { forage: 'pay' },
      platform: { pub: [0, 0, 0, 0, 0, 0, 0, 0], real: [0, 0, 0, 0, 0, 0, 0, 0], declared: [false, false, false, false, false, false, false, false], dayDeclared: [-1, -1, -1, -1, -1, -1, -1, -1] },
      deeds: [0, 0, 0, 0, 0, 0, 0, 0], promises: [],
      trust: {}, rep: { fear: 8, justice: 50, honesty: 60, discipline: 50, competence: 35 },
      regime: { legit: 74, armyMorale: 72, usSupport: 82, heat: 6, offensive: 0 },
      flags: {}, log: [], news: [], events: [], queue: [], stats: { killedArmy: 0, killedCiv: 0, lostRebels: 0, released: 0, executed: 0, hired: 0, pesos: 0 },
      foresight: opts.foresight !== undefined ? opts.foresight : 3, strikePrep: 0, pipe: { balance: 0, couriers: [] },
      base: { built: {}, level: 0 }, cooldown: {}, over: null, pendingCard: null, tutorial: {}, mission: null, unlocked: { layer: 1 }, lastDay: -1,
      knownEnemies: [], modalOpen: false, prisoners: [],
    };
    for (const f of C.FACTION_KEYS) g.trust[f] = 0.5;
    g.weekday = (3 + 0) % 7;
    return g;
  };

  // ---------------- events and memory ----------------
  C.log = function (text, kind) { const g = G(); if (!g) return; g.log.unshift({ t: g.min, day: g.day, text, kind: kind || 'info' }); if (g.log.length > 80) g.log.pop(); if (C.ui && C.ui.onLog) C.ui.onLog(text, kind); };

  C.remember = function (p, m) {
    if (p.status !== 'alive' && p.status !== 'away' && p.status !== 'jailed') return;
    // repeated similar deeds towards the same person merge into one stronger memory (no farming goodwill)
    for (const o of p.mem) if (o.kind === m.kind && o.val === m.val && o.who === m.who && G().day - o.day < 30) { o.int = Math.min(100, o.int + m.int * 0.22); o.day = G().day; return; }
    p.mem.push(m); p.memCount++;
    if (p.mem.length > 9) { let wi = 0, wv = 1e9; for (let i = 0; i < p.mem.length; i++) { const v = Math.abs(p.mem[i].val * p.mem[i].int) * Math.pow(0.5, (G().day - p.mem[i].day) / 120); if (v < wv) { wv = v; wi = i; } } p.mem.splice(wi, 1); }
    p.lastEvent = G().day;
  };
  const sideOf = (a) => (a ? a.side : null);

  // base weights per event type: [intensity, valence-sign-by-perp] — see addEvent
  const EV = {
    death_army_by_rebel: { int: 52, text: (v) => `${v} was killed by the rebels`, },
  };

  // Generic event: {type, victim: person, perpSide: 'rebel'|'army'|null, perp: person?, sev (0..100), just (bool), pub (0..1), x,y, scene, text, positive (bool)}
  C.addEvent = function (ev) {
    const g = G(); ev.id = C.W.nextEv++; ev.day = g.day; g.events.push(ev); if (g.events.length > 500) g.events.shift();
    const v = ev.victim; if (!v) return ev;
    const sign = ev.val !== undefined ? ev.val : (ev.perpSide === 'rebel' ? (ev.positive ? 1 : -1) : ev.perpSide === 'army' ? 1 : 0);
    if (!sign) return ev;
    const I0 = ev.sev * (ev.just ? 0.55 : 1);
    const aud = C.audienceOf(v);
    aud.set(v.id, { w: 1, t: 'self' });
    const sc = ev.scene || null;
    for (const [id, o] of aud) {
      const q = C.P(id); if (!q || q.status === 'dead' || q.status === 'exile' && q.settlement === 'exterior' && o.w < 0.5) continue;
      let w = Math.abs(o.w); if (o.w < 0) continue;            // rivals shrug (could gloat; ignored)
      const same = q.settlement === v.settlement;
      let inten = I0 * w * (same ? 1 : 0.8);
      if (inten < 3) continue;
      const mem = { ev: ev.id, val: sign, int: inten, blame: ev.perpSide, kind: ev.type, text: ev.memText || ev.text, day: g.day, kin: o.t, who: v.id };
      // witnesses (in-scene, near) learn at once; kin within a day; others by gossip
      let delay = 0;
      if (q.actor && sc && q.actor.scene === sc && Math.hypot(q.actor.x - ev.x, q.actor.y - ev.y) < 190 && !q.actor.inside) delay = 0;
      else if (o.w >= 0.7) delay = same ? 0.3 : 1 + Math.random() * 2;
      else delay = (same ? 0.7 : 2) + Math.random() * 2.5 * (q.traits.includes('gossip') ? 0.6 : 1);
      if (delay <= 0.01) applyMemory(q, mem, o.w); else g.queue.push({ due: g.min + delay * 1440, id: q.id, mem, w: o.w });
    }
    // town-wide diffusion for public events
    if (ev.pub > 0 && ev.settlement) {
      const ids = C.W.bySet[ev.settlement] || [];
      const take = Math.min(ids.length, 140);
      for (let i = 0; i < take; i++) {
        const q = C.P(ids[(Math.random() * ids.length) | 0]); if (!q || q.status !== 'alive' || aud.has(q.id)) continue;
        const inten = I0 * ev.pub * 0.35; if (inten < 2) continue;
        g.queue.push({ due: g.min + (0.5 + Math.random() * 2.5) * 1440, id: q.id, mem: { ev: ev.id, val: sign, int: inten, blame: ev.perpSide, kind: ev.type, text: ev.memText || ev.text, day: g.day, kin: 'town', who: v.id }, w: 0.12 });
      }
    }
    // rumour reaches Havana's papers if big
    if (ev.sev >= 55 && ev.pub > 0.3) { g.news.unshift({ day: g.day, text: ev.headline || ev.text }); if (g.news.length > 30) g.news.pop(); }
    if (ev.headline || ev.sev >= 45) C.log(ev.headline || ev.text, ev.positive ? 'good' : sign > 0 ? 'info' : 'bad');
    return ev;
  };
  function applyMemory(q, mem, w) {
    C.remember(q, mem);
    // immediate reactions: kin shocks harden conviction in the direction of the grief/anger
    if (w >= 0.5) {
      const dir = mem.val; q.conv = clamp(q.conv + 11 * w * (Math.sign(q.trueStance) === dir || Math.abs(q.trueStance) < 15 ? 1 : -0.4), 3, 100);
      q.trueStance = clamp(q.trueStance + dir * mem.int * w * 0.12, -100, 100);
      q.anger = clamp(q.anger + mem.int * w * 0.5, 0, 100);
    }
    q.needs.dignity = clamp(q.needs.dignity + mem.val * mem.int * w * 0.05, 0, 100);
    q.needs.safety = clamp(q.needs.safety - (mem.kind === 'death' || mem.kind === 'requisition' || mem.kind === 'abuse' ? mem.int * w * 0.12 : 0), 0, 100);
    if (mem.kind === 'death' || mem.kind === 'abuse') { q.fear = clamp(q.fear + 8 * w, 0, 100); q.fearOf = mem.blame; }
    if (w >= 0.7 && mem.kind === 'death') { q.stress = clamp(q.stress + 30, 0, 100); }
  }

  // events from combat
  C.emit = function (type, o) {
    const g = G(); if (!g) return;
    if (type === 'death') {
      const v = o.victim, k = o.killer, vp = v.p; const sc = v.scene;
      let perpSide = k ? k.side : (sc.bombing ? 'army' : null);
      if (k && k.side === 'civ') perpSide = 'civ';
      const armed = v.weapon && v.weaponOut || v.shooting > 0 || (v.side !== 'civ' && v.lastHit && g.time - v.lastHit < 20);
      const unarmed = v.surrendered || (!v.weaponOut && v.side !== 'civ');
      let sev, just = false, pub = 0.35, text, positive = false;
      const vn = C.tagName(vp);
      if (v.side === 'army') {
        g.stats.killedArmy++; g.regime.armyMorale = clamp(g.regime.armyMorale - (v.surrendered ? 0.2 : 0.7), 0, 100);
        if (k && k.p) { k.p.exp = clamp(k.p.exp + 0.6, 0, 100); }
        g.regime.heat = clamp(g.regime.heat + 2, 0, 100); g.combatDays = (g.combatDays || 0) + 0.5;
        sev = v.surrendered ? 80 : 50; just = !v.surrendered; text = `${vn}, ${vp.mil ? vp.mil.rank : 'soldier'}, killed by rebels near ${sc.name}`;
        if (v.surrendered) { g.rep.justice = clamp(g.rep.justice - 10, 0, 100); g.rep.fear = clamp(g.rep.fear + 6, 0, 100); }
        else g.rep.fear = clamp(g.rep.fear + 0.4, 0, 100);
        for (const o2 of sc.actors) if (o2.side === 'army' && !o2.dead && Math.hypot(o2.x - v.x, o2.y - v.y) < 260) { o2.p.morale = clamp(o2.p.morale - 4, 0, 100); }
        if (perpSide === 'rebel') { C.addEvent({ type: 'death', victim: vp, perpSide: 'rebel', perp: k && k.p, sev, just, pub, x: v.x, y: v.y, scene: sc, settlement: sc.sid, text, memText: `${vn} was killed by the rebels`, headline: sev >= 70 ? text : null }); }
      } else if (v.side === 'rebel') {
        g.stats.lostRebels++; for (const q of sc.actors) if (q.side === 'rebel' && !q.dead) q.p.morale = clamp(q.p.morale - 3, 0, 100);
        sev = 55; text = `Rebel ${vn} killed${perpSide === 'army' ? ' by the army' : ''} near ${sc.name}`; g.rep.competence = clamp(g.rep.competence - 0.8, 0, 100);
        C.addEvent({ type: 'death', victim: vp, perpSide: perpSide === 'army' ? 'army' : 'army', val: 1, sev, just: false, pub: 0.3, x: v.x, y: v.y, scene: sc, settlement: sc.sid, text, memText: `${vn} died fighting for the rebels`, headline: text });
        if (vp.roster && vp.roster !== 'fidel') C.log('★ ' + C.fullName(vp) + ' has fallen.', 'bad');
      } else { // civilian
        g.stats.killedCiv++;
        sev = 85; pub = 0.8; positive = false; text = `${vn}, a civilian, was killed near ${sc.name}`;
        if (perpSide === 'rebel') { g.rep.justice = clamp(g.rep.justice - 9, 0, 100); g.rep.fear = clamp(g.rep.fear + 5, 0, 100); text = `${vn}, a civilian, was shot by rebels at ${sc.name}`; C.addEvent({ type: 'death', victim: vp, perpSide: 'rebel', perp: k && k.p, sev, just: false, pub, x: v.x, y: v.y, scene: sc, settlement: sc.sid, text, memText: `${vn} was killed by the rebels`, headline: text }); }
        else if (perpSide === 'army') { g.regime.legit = clamp(g.regime.legit - 1.6, 0, 100); text = `${vn}, a civilian, was killed by soldiers at ${sc.name}`; C.addEvent({ type: 'death', victim: vp, perpSide: 'army', perp: k && k.p, sev, just: false, pub, x: v.x, y: v.y, scene: sc, settlement: sc.sid, text, memText: `${vn} was killed by the army`, headline: text }); }
        else C.addEvent({ type: 'death', victim: vp, perpSide: null, val: 0, sev: 40, text, x: v.x, y: v.y, scene: sc, settlement: sc.sid });
      }
      // everyone who sees it is shaken
      for (const q of sc.actors) { if (q.dead || q.inside) continue; const d = Math.hypot(q.x - v.x, q.y - v.y); if (d < 200) { q.p.stress = clamp(q.p.stress + 6, 0, 100); if (q.side === 'civ') { q.p.fear = clamp(q.p.fear + 14, 0, 100); q.p.fearOf = perpSide; } } }
      if (C.ui && C.ui.refresh) C.ui.refresh();
    } else if (type === 'wound') {
      // wounded soldiers' kin are upset too, but mildly
      const v = o.victim; if (v.side === 'army' && o.killer && o.killer.side === 'rebel' && Math.random() < 0.15) C.addEvent({ type: 'wound', victim: v.p, perpSide: 'rebel', sev: 18, just: true, pub: 0, x: v.x, y: v.y, scene: v.scene, text: `${C.tagName(v.p)} was wounded by rebels` });
    } else if (type === 'surrender') {
      const a = o; g.regime.armyMorale = clamp(g.regime.armyMorale - 0.5, 0, 100);
    } else if (type === 'sabotage') {
      const ob = o.obj; g.regime.heat = clamp(g.regime.heat + 6, 0, 100); g.regime.legit = clamp(g.regime.legit - 0.8, 0, 100); g.rep.competence = clamp(g.rep.competence + 2, 0, 100);
      C.log(`Sabotage: ${ob.label} destroyed.`, 'good');
      // landowners/elite who owned it dislike property damage
      C.deed(3, ob.k === 'deposito' ? 0 : -2);
    } else if (type === 'blast') { g.regime.heat = clamp(g.regime.heat + 0.4, 0, 100); }
  };

  // ---------------- player-facing social actions ----------------
  C.deed = function (k, amt) { const g = G(); g.deeds[k] = clamp(g.deeds[k] + amt, 0, 100); };
  C.adjustRep = function (key, d) { const g = G(); g.rep[key] = clamp(g.rep[key] + d, 0, 100); };

  C.price = function (settlement, who) {
    const g = G(); let base = 0.26;
    base *= C.isZafra(g.day) ? 0.9 : 1.25;                         // tiempo muerto: hungry season, dear food
    if (g.weather.rain > 0.5) base *= 1.1;
    const disc = who ? clamp(who.stance / 400, -0.1, 0.25) : 0;      // sympathizers give a better price
    return Math.max(0.1, base * (1 - disc));
  };

  // rebels buy/take from a civilian (forage stance or player dialog)
  C.forageTransaction = function (a, t, kind) {
    const g = G(), s = a.scene; const policy = g.policy.forage;
    let target, qty = 5 + Math.floor(Math.random() * 6), seller;
    if (kind === 'animal') { qty = t.def.food; const near = s.actors.filter((o) => o.side === 'civ' && !o.dead).sort((p, q) => Math.hypot(p.x - t.x, p.y - t.y) - Math.hypot(q.x - t.x, q.y - t.y))[0]; seller = near ? near.p : null; t.dead = true; t.hp = 0; }
    else { seller = t.p; qty = Math.min(qty, Math.max(2, Math.floor(seller.needs.food / 10))); }
    if (!seller) { g.res.food += qty; return; }
    const price = C.price(seller.settlement, seller) * qty * (kind === 'animal' ? 1.6 : 1);
    const vn = C.tagName(seller);
    const poor = seller.cls <= 1;
    if (policy === 'pay' && g.res.money >= price) {
      g.res.money -= price; g.res.food += qty; seller.needs.food = clamp(seller.needs.food - qty * 0.6, 0, 100); seller.needs.hope += 1;
      C.addEvent({ type: 'purchase', victim: seller, perpSide: 'rebel', positive: true, sev: 9, pub: 0, x: t.x, y: t.y, scene: s, settlement: s.sid, text: `The rebels paid ${vn} for food`, memText: `The rebels paid fairly for food` });
      C.say(a, 'Gracias, compay', '#1d4a1d', 1.8); g.stats.pesos += price;
      if (seller.traits.includes('generous') || seller.stance > 40) { g.res.food += 2; }
    } else if (policy === 'vale' || (policy === 'pay' && g.res.money < price)) {
      g.res.food += qty; g.res.vales += price; seller.needs.food = clamp(seller.needs.food - qty * 0.6, 0, 100);
      g.promises.push({ kind: 'vale', day: g.day, due: g.day + 30, amount: price, who: seller.id, paid: false });
      C.addEvent({ type: 'purchase', victim: seller, perpSide: 'rebel', positive: true, sev: poor ? 4 : 5, pub: 0, x: t.x, y: t.y, scene: s, settlement: s.sid, text: `${vn} accepted a vale (IOU) from the rebels`, memText: `Took food on a promise to repay` });
      C.say(a, 'Le pago en un mes', '#444', 1.8);
    } else { // take
      g.res.food += qty; seller.needs.food = clamp(seller.needs.food - qty * 1.1, 0, 100); seller.needs.safety = clamp(seller.needs.safety - 8, 0, 100);
      const harm = (poor ? 1.5 : 1) * (seller.needs.food < 40 ? 1.4 : 1);
      g.rep.fear = clamp(g.rep.fear + 0.6, 0, 100); g.rep.justice = clamp(g.rep.justice - 0.9, 0, 100);
      C.addEvent({ type: 'requisition', victim: seller, perpSide: 'rebel', sev: Math.min(60, 19 * harm), pub: 0.25, x: t.x, y: t.y, scene: s, settlement: s.sid, text: `Rebels took food from ${vn}${poor ? ', who has little' : ''}`, memText: `Rebels took our food` });
      C.say(a, 'Es por la causa', '#7a1d1d', 1.8); if (kind === 'civ') { t.panic = 0.7; C.say(t, 'No nos dejen sin nada...', '#7a1d1d', 2.4); }
    }
  };
  C.harvestAnimal = function (a, an) { const g = G(); g.res.food += an.def.food; C.say(a, 'Buena caza', '#1d4a1d', 1.6); };

  // vales fall due
  function processVales() {
    const g = G();
    for (const pr of g.promises) {
      if (pr.kind !== 'vale' || pr.paid || g.day < pr.due) continue;
      const q = C.P(pr.who);
      if (g.res.money >= pr.amount) { g.res.money -= pr.amount; g.res.vales = Math.max(0, g.res.vales - pr.amount); pr.paid = true; C.addEvent({ type: 'repaid', victim: q, perpSide: 'rebel', positive: true, sev: 10, pub: 0.05, x: 0, y: 0, settlement: q.settlement, text: `The rebels repaid their vale to ${C.tagName(q)}`, memText: 'Rebels kept their word and repaid', headline: null }); g.rep.honesty = clamp(g.rep.honesty + 1.5, 0, 100); C.log(`You repaid a vale to ${C.tagName(q)}.`, 'good'); }
      else { pr.paid = true; g.res.vales = Math.max(0, g.res.vales - pr.amount); g.rep.honesty = clamp(g.rep.honesty - 5, 0, 100); C.addEvent({ type: 'default', victim: q, perpSide: 'rebel', sev: 38, pub: 0.2, x: 0, y: 0, settlement: q.settlement, text: `Rebels defaulted on a vale owed to ${C.tagName(q)}`, memText: 'Rebels did not repay what they owed', headline: `Rebels default on debts in ${C.SETTLEMENTS[q.settlement].name}` }); C.log(`You could not repay ${C.tagName(q)}. Word spreads.`, 'bad'); }
    }
    g.promises = g.promises.filter((p) => !p.paid || p.day > g.day - 3);
  }

  // ---------------- stance engine ----------------
  C.platformFit = function (p, k) { // -1..1 how well the DECLARED plank matches this person; 0 if undeclared
    const g = G(); if (!g.platform.declared[k]) return 0;
    const q = g.platform.pub[k] - 1;           // 0,1,2 -> -1,0,1
    return 1 - Math.abs(q - p.iss[k]);
  };
  C.explainStance = function (p) {
    const g = G(), TU = C.TUNE, out = [];
    const F = C.FACTIONS[p.fac];
    let pol = 0, wsum = 0;
    for (let i = 0; i < 2; i++) { const k = p.sal[i], w = i === 0 ? 0.6 : 0.4; let fit = C.platformFit(p, k); if (fit > 0) fit *= (0.4 + 0.6 * g.trust[p.fac]); pol += w * fit; if (g.platform.declared[k]) out.push({ label: `Plank "${C.PLANKS[k].en}" (they care)`, v: TU.policyW * w * fit }); }
    let bg = 0, tw = 0; for (let k = 0; k < 8; k++) { if (!g.platform.declared[k]) continue; const fit = C.platformFit(p, k) * (fit0(p, k)); bg += F.sal[k] * fit; tw += F.sal[k]; }
    if (tw) out.push({ label: 'Rest of your platform', v: TU.bgW * bg / tw });
    const n = p.needs; const needV = TU.needW * ((n.hope - 50) * 0.6 + (n.dignity - 50) * 0.4);
    out.push({ label: 'Hope & dignity', v: needV });
    if (n.food < 40) out.push({ label: 'Hunger (blames whoever rules)', v: -(40 - n.food) * 0.12 * (g.regime.legit > 50 ? -0.6 : 0.6) });
    let ms = 0; for (const m of p.mem) { const age = g.day - m.day; const half = (m.kin === 'spouse' || m.kin === 'child' || m.kin === 'parent' || m.kin === 'self') ? TU.memHalfKin : TU.memHalf; const v = m.val * m.int * Math.pow(0.5, age / half) * TU.memW; ms += v; if (Math.abs(v) > 3) out.push({ label: m.text + (m.kin && m.kin !== 'self' && m.kin !== 'town' ? ` (${C.relLabelEs[m.kin] || m.kin})` : ''), v: clamp(v, -TU.memCap, TU.memCap) }); }
    const peer = peerMean(p); out.push({ label: 'Family & friends pull', v: (peer - p.trueStance) * TU.peerW });
    if (p.traits.includes('opportunist')) out.push({ label: 'Opportunist leans toward the likely winner', v: (g.regime.legit - 55) * -0.2 });
    if (p.fear > 40 && p.fearOf) out.push({ label: `Afraid of ${p.fearOf === 'army' ? 'the army' : p.fearOf === 'rebel' ? 'the rebels' : 'the powerful'}`, v: p.fearOf === 'rebel' ? -(p.fear - 40) * 0.2 : (p.fear - 40) * 0.12 * -1 });
    out.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    return out;
  };
  function fit0(p, k) { return 1; }
  const kinCache = new Map();
  function peerMean(p) {
    let arr = kinCache.get(p.id);
    if (!arr) { arr = []; const m = C.kinOf(p); for (const [id, o] of m) if (o.w >= 0.3) arr.push([id, o.w]); for (const r of p.rel) if (r.w > 0.1) arr.push([r.id, r.w]); kinCache.set(p.id, arr); }
    let s = 0, w = 0; for (const [id, ww] of arr) { const q = C.P(id); if (q.status === 'dead') continue; s += q.trueStance * ww; w += ww; }
    return w ? s / w : p.trueStance;
  }
  C.shownStance = function (a) {
    const p = a.p;
    if (p.informant && !p.revealed) return { v: p.stance, c: Math.max(20, p.conv - 20) };
    return { v: p.trueStance, c: p.conv };
  };
  C.stanceTarget = function (p) { const e = C.explainStance(p); let t = 0; for (const x of e) t += x.v; return clamp(t + C.FACTIONS[p.fac].stance * 0.55, -100, 100); };

  // ---------------- daily tick ----------------
  C.dayTick = function () {
    const g = G(), TU = C.TUNE, day = g.day;
    kinCache.size > 8000 && kinCache.clear();
    const zafra = C.isZafra(day);
    let sumS = 0, nS = 0;
    for (const p of C.W.people) {
      if (p.status === 'dead') continue;
      if (p.status === 'exile') continue;
      const age = C.ageOf(p, day);
      const rebel = p.mil && p.mil.side === 'rebel';
      // needs drift for people not simulated live
      const n = p.needs; const inScene = p.actor && p.actor.scene === g.scene && !p.actor.dead;
      if (!inScene) {
        const wage = (p.fac === 'peasants' || p.fac === 'workers') && !zafra ? -0.4 : 0.1;
        const targetFood = clamp(40 + p.cls * 12 + (zafra ? 8 : -12) * (p.cls <= 1 ? 1 : 0.2), 15, 95);
        if (!rebel) n.food += (targetFood - n.food) * 0.12; else n.food = Math.max(0, n.food - 9);
        n.water = Math.min(100, n.water + 30); n.energy = Math.min(100, n.energy + 25);
        n.hope += ((45 + (g.regime.legit < 50 ? 12 : 0) + (g.mood || 0) - n.hope) * 0.03);
        n.safety += (g.regime.heat > 40 && C.SETTLEMENTS[p.settlement] && C.SETTLEMENTS[p.settlement].region === 'Oriente' ? -0.4 : 0.35);
        n.dignity += (50 + p.cls * 6 - n.dignity) * 0.02;
        p.stress = Math.max(0, p.stress - 4); p.anger = Math.max(0, p.anger - 3);
      }
      for (const k in n) n[k] = clamp(n[k], 0, 100);
      p.fear = Math.max(0, p.fear - 1.2);
      if (p.fear < 10) p.fearOf = null;
      // health: cracks heal (if fed & rested), chunks never do
      if (p.cracks.length) {
        const rate = (n.food > 40 ? 1 : 0.35) * (n.energy > 40 ? 1 : 0.6) * 0.08 * (p.traits.includes('stoic') ? 1.1 : 1);
        for (const c of p.cracks) c.l -= rate;
        p.cracks = p.cracks.filter((c) => c.l > 0.08);
      }
      if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + (n.food > 35 ? 3.2 : 1) * (p.bleed > 0 ? 0 : 1) + (g.base.built.enfermeria ? 2 : 0));
      p.bleed = Math.max(0, p.bleed - 0.25);
      p.morale = clamp(p.morale + (n.food > 50 ? 1.5 : -3) + (n.hope - 50) * 0.04 - (p.stress > 60 ? 2 : 0), 0, 100);
      // experience from time in any army
      if (p.mil && (p.mil.side === 'army' || p.mil.side === 'rebel') && p.status === 'alive') { p.service++; p.exp = clamp(p.exp + (rebel ? 0.12 : 0.07) * (1 + (p.traits.includes('idealist') ? 0.1 : 0)), 0, 100); }
      // stance update
      if (age < 12) { p.trueStance += (peerMean(p) - p.trueStance) * 0.1; p.stance = p.trueStance; continue; }
      let tgt = C.stanceTarget(p);
      if (p.mil && p.mil.side === 'army') tgt -= 6;
      const rate = TU.rate * (1 - p.conv / 135) * (p.traits.includes('cautious') ? 0.75 : 1) * (p.traits.includes('idealist') ? 1.1 : 1);
      const prev = p.trueStance;
      p.trueStance = clamp(prev + (tgt - prev) * rate, -100, 100);
      // conviction: grows when pushed the way they already lean, erodes when contradicted
      const aligned = Math.sign(tgt) === Math.sign(p.trueStance) && Math.abs(tgt) > 18;
      p.conv = clamp(p.conv + (aligned ? 0.18 + (p.traits.includes('idealist') ? 0.1 : 0) : -0.1) , 3, 100);
      if (p.informant && !p.revealed) p.stance = clamp(p.stance + (30 - p.stance) * 0.05, -100, 100); else p.stance = p.trueStance;
      if (!(p.informant && !p.revealed)) { /* public = true */ }
      if (age >= 14 && p.status === 'alive') { sumS += p.trueStance; nS++; }
      // ex-soldiers & soldiers: defections
      if (p.mil && p.mil.side === 'army' && p.status === 'alive' && !p.roster) {
        const wantOut = (p.morale < 24 || (g.regime.armyMorale < 36 && Math.random() < 0.15)) && Math.random() < 0.05 + (p.trueStance > 10 ? 0.08 : 0) + Math.max(0, (35 - g.regime.armyMorale)) * 0.002;
        if (wantOut) { p.mil = null; p.status = 'away'; p.note = 'Deserted the army.'; if (p.actor && !p.actor.dead) { p.actor.gone = true; } if (p.trueStance > 5 && Math.random() < 0.5) { p.defector = true; } g.regime.armyMorale = clamp(g.regime.armyMorale - 0.3, 0, 100); }
      }
      // rebels: desertion / AWOL / misconduct
      if (rebel && p.status === 'alive' && !p.roster) {
        const q = (p.morale < 22 ? 0.06 : 0) + (p.trueStance < 5 ? 0.06 : 0) + (n.food < 15 ? 0.03 : 0) + (p.fear > 70 ? 0.03 : 0);
        if (Math.random() < q) C.desert(p);
      }
    }
    g.supportMean = nS ? sumS / nS : 0;
    // process the delayed memory queue
    const now = g.min; const rest = [];
    for (const it of g.queue) { if (it.due <= now) { const q = C.P(it.id); if (q && q.status !== 'dead') applyMemory(q, it.mem, it.w); } else rest.push(it); }
    g.queue = rest;
    processVales();
    // trust in each faction: promises vs deeds
    updateTrust();
    // regime meters
    const rg = g.regime;
    { const tgt = 4 + rebelsCount() * 1.4 + (g.flags.radio ? 12 : 0) + (g.combatDays || 0) * 3; rg.heat = clamp(rg.heat + (tgt - rg.heat) * 0.07 - 0.3, 0, 100); g.combatDays = Math.max(0, (g.combatDays || 0) * 0.8); }
    rg.legit = clamp(rg.legit + (g.supportMean < 0 ? 0.02 : -0.06 - g.supportMean * 0.002) + (g.flags.strikeWon ? -0.5 : 0), 0, 100);
    rg.armyMorale = clamp(rg.armyMorale + (g.supportMean < 0 ? 0.04 : -0.05) + (rg.legit < 45 ? -0.12 : 0.02), 0, 100);
    rg.usSupport = clamp(rg.usSupport - (g.flags.embargo ? 0.07 : 0.0) - (rg.legit < 40 ? 0.05 : 0), 0, 100);
    // leaks: public vs real platform
    for (let k = 0; k < 8; k++) if (g.platform.declared[k] && g.platform.pub[k] !== g.platform.real[k] && Math.random() < 0.006 + g.regime.heat * 0.0002) C.exposeLie(k);
    // ruling by fear has long tails: informers multiply, elites and the Church drift away, defectors steal weapons
    if (g.rep.fear > 50) {
      const k = (g.rep.fear - 50) / 50;
      for (const f of ['elite', 'church', 'middle', 'students']) g.trust[f] = clamp(g.trust[f] - 0.006 * k, 0.02, 1);
      if (Math.random() < 0.012 * k * 6) { const cand = squadPeople().filter((p) => !p.roster && !p.informant); if (cand.length) { const p = cand[(Math.random() * cand.length) | 0]; p.informant = true; p.hidden = 1; p.stance = Math.max(p.stance, 30); p.trueStance = -45; p.conv = 55; } }
      if (g.regime.heat < 90) g.regime.heat += 0.6 * k;
    }
    // reputation drift toward neutral
    g.rep.fear = clamp(g.rep.fear - 0.35, 0, 100); g.rep.discipline += (50 - g.rep.discipline) * 0.01;
    // base effects
    if (g.base.built.escuelacamp) for (const id of squadIds()) { const p = C.P(id); p.literate = true; p.needs.hope = clamp(p.needs.hope + 0.6, 0, 100); }
    // mood: momentum of rebel victories
    g.mood = (g.mood || 0) * 0.9;
    // pipeline couriers
    processCouriers();
  };
  const squadIds = () => G().squads.flatMap((s) => s.members);
  const squadPeople = () => squadIds().map((id) => C.P(id)).filter((p) => p && p.status === 'alive');
  function rebelsCount() { return squadIds().length; }
  function updateTrust() {
    const g = G();
    for (const f of C.FACTION_KEYS) {
      let delta = 0, wsum = 0;
      for (let k = 0; k < 8; k++) {
        if (!g.platform.declared[k]) continue;
        const lvl = g.platform.pub[k] - 1; if (lvl <= 0 && k !== 4) continue;       // only reform promises are tested by deeds
        const days = g.day - g.platform.dayDeclared[k]; const need = clamp((days - 20) / 120, 0, 1) * 55 * Math.max(0.4, lvl + 1) / 2;
        const sal = C.FACTIONS[f].sal[k]; const have = g.deeds[k];
        delta += sal * (have >= need ? 0.0035 : -0.004 * (need - have) / 55); wsum += sal;
      }
      if (wsum) g.trust[f] = clamp(g.trust[f] + delta / wsum * 2.2, 0.02, 1);
      else g.trust[f] = clamp(g.trust[f] + (0.5 - g.trust[f]) * 0.01, 0, 1);
    }
    // conduct also moves trust
    g.trust.peasants = clamp(g.trust.peasants + (g.rep.justice - 50) * 0.00008, 0.02, 1);
    g.trust.elite = clamp(g.trust.elite + (g.rep.justice - 50) * 0.00006 - g.rep.fear * 0.00008, 0.02, 1);
    g.trust.church = clamp(g.trust.church + (g.rep.justice - 50) * 0.00006 - g.rep.fear * 0.00005, 0.02, 1);
  }
  C.exposeLie = function (k) {
    const g = G(); g.platform.real[k] = g.platform.pub[k]; g.rep.honesty = clamp(g.rep.honesty - 14, 0, 100);
    for (const f of C.FACTION_KEYS) g.trust[f] = clamp(g.trust[f] - 0.18 * Math.min(1, C.FACTIONS[f].sal[k] / 2), 0.02, 1);
    C.log(`EXPOSED: your public stand on "${C.PLANKS[k].en}" does not match your private plans. Trust collapses among those who care.`, 'bad');
    g.news.unshift({ day: g.day, text: `Leak: rebel leadership "says one thing, plans another" on ${C.PLANKS[k].en.toLowerCase()}` });
  };
  C.desert = function (p) {
    const g = G(); if (!p.mil || p.mil.side !== 'rebel') return;
    for (const sq of g.squads) sq.members = sq.members.filter((id) => id !== p.id);
    p.mil = null; p.status = 'away'; p.side = null; p.note = 'Left the rebels.';
    const had = p.actor && p.actor.weapon; if (p.actor) { p.actor.gone = true; if (had) C.dropWeapon(p.actor); }
    g.rep.discipline = clamp(g.rep.discipline - 2, 0, 100);
    C.log(`${C.tagName(p)} has gone AWOL${had ? ' and took a rifle' : ''}.`, 'bad');
    if (p.informant || p.trueStance < -10) { g.regime.heat = clamp(g.regime.heat + 8, 0, 100); C.log(`...and word is, they went to the army.`, 'bad'); }
  };

  // ---------------- platform ----------------
  C.declarePlank = function (k, level, realLevel) {
    const g = G(), P = g.platform;
    const was = P.declared[k] ? P.pub[k] : null;
    P.pub[k] = level; P.real[k] = realLevel === undefined ? level : realLevel;
    if (was !== null && was !== level) { // flip-flop
      for (const f of C.FACTION_KEYS) g.trust[f] = clamp(g.trust[f] - 0.04 * Math.min(2, C.FACTIONS[f].sal[k]) , 0.02, 1);
      g.rep.honesty = clamp(g.rep.honesty - 3, 0, 100);
    }
    if (!P.declared[k] || was !== level) P.dayDeclared[k] = g.day;
    P.declared[k] = true;
  };
  C.presets = {
    historia: { n: '"History Will Absolve Me" (26th of July program)', v: [1, 2, 1, 1, 2, 1, 1, 1] },
    radical: { n: 'Radical transformation', v: [2, 2, 2, 2, 0, 2, 2, 2] },
    moderate: { n: 'Moderate reformists', v: [1, 1, 1, 0, 2, 1, 1, 1] },
    order: { n: 'Order and tradition', v: [0, 1, 0, 0, 1, 0, 0, 0] },
  };
  C.applyPreset = function (key) { const pr = C.presets[key]; pr.v.forEach((lvl, k) => C.declarePlank(k, lvl)); C.log(`Announced: ${pr.n}.`, 'info'); };

  // ---------------- factions table for the UI ----------------
  C.factionTable = function () {
    const g = G(); const rows = {};
    for (const f of C.FACTION_KEYS) rows[f] = { f, sum: 0, n: 0, conv: 0, fear: 0 };
    let wS = 0, wN = 0, aS = 0, aN = 0;
    for (const p of C.W.people) {
      if (p.status === 'dead' || p.status === 'exile' || C.ageOf(p) < 15) continue; const r = rows[p.fac]; if (!r) continue;
      r.sum += p.trueStance; r.n++; r.conv += p.conv;
      if (p.sex === 'F') { wS += p.trueStance; wN++; } if (p.eth === 'negra' || p.eth === 'mulata') { aS += p.trueStance; aN++; }
    }
    const out = C.FACTION_KEYS.map((f) => ({ key: f, name: C.FACTIONS[f].name, n: rows[f].n, mean: rows[f].n ? rows[f].sum / rows[f].n : 0, trust: g.trust[f], col: C.FACTIONS[f].col }));
    return { rows: out, women: wN ? wS / wN : 0, afro: aN ? aS / aN : 0, all: g.supportMean || 0 };
  };

  // ---------------- couriers (the Havana pipeline) ----------------
  C.sendCourier = function (carrier, amount) {
    const g = G(); const risk = clamp(0.22 + g.regime.heat * 0.004 - (carrier.p.sex === 'F' ? 0.1 : 0) - carrier.p.exp * 0.0015, 0.05, 0.6);
    g.pipe.couriers.push({ id: carrier.p.id, amount, due: g.day + 6 + Math.floor(Math.random() * 5), risk });
    g.pipe.balance -= amount; C.log(`${C.tagName(carrier.p)} sets out with ${amount} pesos for the Sierra (risk of interception ${Math.round(risk * 100)}%).`, 'info');
  };
  function processCouriers() {
    const g = G(); const keep = [];
    for (const c of g.pipe.couriers) {
      if (g.day < c.due) { keep.push(c); continue; }
      const p = C.P(c.id);
      if (Math.random() < c.risk) { C.log(`The courier ${C.tagName(p)} was caught at a checkpoint. The money is lost.`, 'bad'); g.regime.heat = clamp(g.regime.heat + 6, 0, 100); if (Math.random() < 0.5) { p.status = 'jailed'; C.log(`${C.tagName(p)} was arrested.`, 'bad'); C.addEvent({ type: 'arrest', victim: p, perpSide: 'army', sev: 45, pub: 0.2, x: 0, y: 0, settlement: p.settlement, text: `${C.tagName(p)} arrested at a checkpoint`, memText: `${C.tagName(p)} was arrested` }); } }
      else { g.res.money += c.amount; g.stats.pesos += c.amount; C.log(`${c.amount} pesos from Havana reach the Sierra.`, 'good'); }
    }
    g.pipe.couriers = keep;
  }

  // ---------------- travel ----------------
  C.travelCost = function (from, to) { // shortest foot days / vehicle hours over the edge graph
    const nodes = C.PLAYABLE, dist = {}, vh = {}, prev = {};
    for (const n of nodes) { dist[n] = 1e9; vh[n] = 1e9; }
    dist[from] = 0; vh[from] = 0; const Q = new Set(nodes);
    while (Q.size) { let u = null; for (const n of Q) if (u === null || dist[n] < dist[u]) u = n; Q.delete(u); for (const e of C.EDGES) { let v = null, d = 0, h = 0; if (e[0] === u) { v = e[1]; } else if (e[1] === u) { v = e[0]; } if (!v) continue; d = e[2]; h = e[3]; if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; vh[v] = vh[u] + h; prev[v] = u; } } }
    return { days: dist[to], hours: vh[to] };
  };

  // ---------------- stats helpers for UI ----------------
  C.partyStats = function () {
    const g = G(); const ids = squadIds(); let exp = 0, mor = 0, hung = 0;
    for (const id of ids) { const p = C.P(id); exp += p.exp; mor += p.morale; hung += (100 - p.needs.food); }
    const n = ids.length || 1; return { n: ids.length, exp: exp / n, morale: mor / n, hunger: hung / n };
  };
})();
