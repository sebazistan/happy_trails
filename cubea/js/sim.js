/* CUBEA — sim.js : the political simulation. Events -> memories spreading through family & friend ties -> daily loyalty
   updates from policy fit, needs, memories, fear and peer pull. Also economy, promises/trust, reputation, regime meters. */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  const clamp = C.clamp;
  const G = () => C.G;
  // TUNE — the loyalty engine's balance knobs (all in one place).
  //  rate     fraction of the gap to the target stance closed per day (before conviction slows it)
  //  memHalf  half-life in days of an ordinary memory; memHalfKin for memories of a spouse/child/parent/self
  //  policyW  weight of the declared platform's fit; bgW the rest of the platform; needW hope/dignity; peerW family/friends' pull
  //  memW     weight of memories; memCap the cap on any one memory's contribution; fearW weight of fear
  C.TUNE = { rate: 0.05, memHalf: 70, memHalfKin: 260, policyW: 46, bgW: 14, needW: 0.2, peerW: 0.12, memW: 0.55, memCap: 75, fearW: 0.25 };

  // NEW GAME. C.G is the whole mutable game state; C.W (gen.js) is the population database. Nothing else holds state.
  // ---------------- new game ----------------
  // Build a fresh game from a seed: generate the world, then create C.G with the starting squads, resources, platform, reputation, regime meters and flags.
  // G.res are the column's stores; G.platform holds public and real positions; G.regime = {legit, armyMorale, usSupport, heat}; G.rep = reputation axes.
  C.newGame = function (seed, opts) {
    opts = opts || {}; if (opts.fog === undefined) opts.fog = true;
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
      curSquad: 0, sel: [], cmd: { pending: null, tab: 'move', vol: 0 }, hygiene: 70,
      res: { food: 24, money: 140, ammo: 60, guns: 1, shell: 0, rocket: 0, hoe: 2, axe: 1, seed: 8, bucket: 2, feed: 6, lena: 10, stake: 8, hammock: 8, primer: 4, med: 5, fuel: 12, gren: 3, dyn: 0, pamph: 0, vales: 0, cloth: 6, scrap: 8 },
      policy: { forage: 'pay' },
      platform: { pub: [0, 0, 0, 0, 0, 0, 0, 0], real: [0, 0, 0, 0, 0, 0, 0, 0], declared: [false, false, false, false, false, false, false, false], dayDeclared: [-1, -1, -1, -1, -1, -1, -1, -1] },
      deeds: [0, 0, 0, 0, 0, 0, 0, 0], promises: [],
      trust: {}, rep: { fear: 8, justice: 50, honesty: 60, discipline: 50, competence: 35 },
      regime: { legit: 74, armyMorale: 72, usSupport: 82, heat: 6, offensive: 0 },
      flags: {}, log: [], news: [], events: [], queue: [], stats: { killedArmy: 0, killedCiv: 0, lostRebels: 0, released: 0, executed: 0, hired: 0, pesos: 0 },
      strikePrep: 0, pipe: { balance: 0, couriers: [] },
      base: { built: {}, level: 0 }, cooldown: {}, over: null, pendingCard: null, tutorial: {}, mission: null, unlocked: { layer: 1 }, lastDay: -1,
      knownEnemies: [], modalOpen: false, prisoners: [],
    };
    for (const f of C.FACTION_KEYS) g.trust[f] = 0.5;
    g.weekday = (3 + 0) % 7;
    return g;
  };

  // THE PLAYER'S NAME. You are Fidel under any name typed on the title screen; only the nametag changes, not the person's history.
  // ---------------- the player's name ----------------
  // Rename the player's person. A typed surname other than 'Castro' clears the maternal surname.
  C.setPlayerName = function (full) {
    const p = C.P(C.W.player); const parts = String(full || 'Fidel Castro').trim().replace(/\s+/g, ' ').split(' ');
    const last = parts.length > 1 ? parts.pop() : 'Castro'; const first = parts.join(' ');
    p.first = first; p.last = last; if (last !== 'Castro') p.last2 = ''; p.tag = first + ' ' + last; p.role = 'Comandante'; p.note = 'You lead the expedition.';
  };

  // COUNTER-INTELLIGENCE. Instead of foresight, the player reads TELLS (ambiguous observations) and can pay a network to investigate.
  // ---------------- counter-intelligence: tells and investigation ----------------
  // Observable hints about a person: an informer shows some of 'spends more than they earn', 'asks about trails', 'seen near the army post' (deterministically per person); innocents show them rarely; plus clean-shaven rebels after long service and kin in the army.
  C.tells = function (p) {
    const out = []; const h = (k) => (((p.id * 2654435761) ^ (k * 40503)) >>> 0) / 4294967296;
    if (p.informant) {
      if (h(1) < 0.8) out.push('Spends more than they earn');
      if (h(2) < 0.7) out.push('Keeps asking about trails and numbers');
      if (h(3) < 0.6) out.push('Was seen near the army post at night');
    } else {
      if (h(11) < 0.07) out.push('Spends more than they earn');
      if (h(12) < 0.05) out.push('Keeps asking about trails and numbers');
    }
    if (p.mil && p.mil.side === 'rebel' && p.sex === 'M' && (p.service || 0) > 40 && !(p.look && p.look.beard) && (p.beardLen || 0) < 0.3) out.push('Still clean-shaven after weeks in the mountains');
    const kin = C.kinOf(p); for (const [id] of kin) { const q = C.P(id); if (q.mil && q.mil.side === 'army' && q.status === 'alive') { out.push('Has kin in the army'); break; } }
    return out;
  };
  // Pay 12 pesos for a network check: usually right (50–92% depending on how well your network is established), sometimes wrong. Reveals an informer or clears a suspect.
  C.investigate = function (p) {
    const g = G(); if (g.res.money < 12) { C.ui.toast('Needs 12 pesos for the network'); return false; }
    g.res.money -= 12; g.stats.pesos += 12;
    const guilty = p.informant && !p.revealed;
    const acc = clamp(0.6 + g.trust.peasants * 0.25 + (p.settlement === 'sierra' ? 0.1 : 0), 0.5, 0.92);
    if (guilty && Math.random() < acc) { p.revealed = true; p.stance = p.trueStance; C.log(`Your network confirms it: ${C.fullName(p)} is selling you out.`, 'warn'); return true; }
    if (!guilty && Math.random() < 0.88) { C.log(`Your network finds nothing against ${C.fullName(p)}.`, 'info'); return false; }
    C.log(`Your network is unsure about ${C.fullName(p)}: some smoke, no proof.`, 'info'); return false;
  };

  // EVENTS AND MEMORY — the heart of the simulation.
  //  An EVENT happens to a victim. Everyone in the victim's audience (kin, friends, compadres… see gen.js audienceOf) receives a MEMORY of it, scaled by closeness.
  //  Memories decay (half-life 70 days, 260 for close kin) and each day pull the person's loyalty toward the rebels (+) or the regime (−).
  // ---------------- events and memory ----------------
  // Append a line to the player's log (newest first, capped at 80) and notify the UI.
  C.log = function (text, kind) { const g = G(); if (!g) return; g.log.unshift({ t: g.min, day: g.day, text, kind: kind || 'info' }); if (g.log.length > 80) g.log.pop(); if (C.ui && C.ui.onLog) C.ui.onLog(text, kind); };

  // Store a memory on a person. Similar memories from the same source within 30 days merge (no farming goodwill). A person remembers at most 9 things: when full, the least important (by value × intensity × recency) is forgotten.
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
  // Reference table for event types (intensity and text templates).
  const EV = {
    death_army_by_rebel: { int: 52, text: (v) => `${v} was killed by the rebels`, },
  };

  // C.addEvent(ev): publish an event. ev = {type, victim, perpSide:'rebel'|'army'|null, sev 0–100, just, pub 0–1, positive, x,y, scene, settlement, text, memText, headline}.
  //  1. sign: who benefits? (a killing by the army helps the rebels (+1); a rebel atrocity hurts them (−1)); 'just' acts count 55% as much.
  //  2. every member of the audience gets a memory with intensity = sev × closeness; witnesses on the scene learn at once, kin within a day, others by gossip (delayed queue).
  //  3. public events (pub>0) also reach ~140 random townspeople at 35% strength.
  //  4. big public events become headlines.
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
  // Apply one memory to a person immediately: store it, and for close kin harden conviction and shift loyalty in the direction of the grief or anger; adjust dignity, safety, fear and stress for deaths, abuse and requisitions.
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

  // C.emit(type, o): the combat module reports raw happenings (death, wound, surrender, sabotage, blast); this converts them into events, reputation changes, morale shocks and regime meters.
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

  // SOCIAL ACTIONS. Deeds and reputation adjust the long-term counters (G.deeds[plank], G.rep.*).
  // ---------------- player-facing social actions ----------------
  // Record progress on a plank (0–100): deeds are what 'prove' a promise (see updateTrust).
  C.deed = function (k, amt) { const g = G(); g.deeds[k] = clamp(g.deeds[k] + amt, 0, 100); };
  // Change one reputation axis (fear, justice, honesty, discipline, competence), clamped 0–100.
  C.adjustRep = function (key, d) { const g = G(); g.rep[key] = clamp(g.rep[key] + d, 0, 100); };

  // Price of a unit of food: dearer in the dead season and in rain; sympathizers give a discount.
  C.price = function (settlement, who) {
    const g = G(); let base = 0.26;
    base *= C.isZafra(g.day) ? 0.9 : 1.25;                         // tiempo muerto: hungry season, dear food
    if (g.weather.rain > 0.5) base *= 1.1;
    const disc = who ? clamp(who.stance / 400, -0.1, 0.25) : 0;      // sympathizers give a better price
    return Math.max(0.1, base * (1 - disc));
  };

  // C.forageTransaction: how rebels get food from civilians under the current policy — PAY (money, goodwill), VALE (an IOU due in 30 days; a promise that must be kept), or TAKE (free, resented, scaled by how poor and hungry the seller is). Each path publishes the right event.
  // rebels buy/take from a civilian (forage stance or player dialog)
  C.forageTransaction = function (a, t, kind) {
    const g = G(), s = a.scene; const policy = g.policy.forage;
    let target, qty = 3 + Math.floor(Math.random() * 4), seller;
    if (kind === 'animal') { qty = t.def.food; const near = s.actors.filter((o) => o.side === 'civ' && !o.dead).sort((p, q) => Math.hypot(p.x - t.x, p.y - t.y) - Math.hypot(q.x - t.x, q.y - t.y))[0]; seller = near ? near.p : null; t.dead = true; t.hp = 0; }
    else { seller = t.p; qty = Math.min(qty, Math.max(2, Math.floor(seller.needs.food / 10))); }
    if (!seller) { g.res.food += qty; return; }
    seller.sellCd = g.min + 1440 * (kind === 'animal' ? 3 : 1);
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
  // Butchered game or livestock adds its food value to the stores.
  C.harvestAnimal = function (a, an) { const g = G(); g.res.food += an.def.food; C.say(a, 'Buena caza', '#1d4a1d', 1.6); };

  // Vales are repaid (or defaulted on) when due; a default costs honesty and makes an enemy of the creditor's family.
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

  // THE STANCE ENGINE: what loyalty a person is pulled toward today, and why.
  // ---------------- stance engine ----------------
  // How well the DECLARED position on plank k matches this person's own position (−1…+1; 0 if not declared).
  C.platformFit = function (p, k) { // -1..1 how well the DECLARED plank matches this person; 0 if undeclared
    const g = G(); if (!g.platform.declared[k]) return 0;
    const q = g.platform.pub[k] - 1;           // 0,1,2 -> -1,0,1
    return 1 - Math.abs(q - p.iss[k]);
  };
  // The target-stance recipe as a list of labelled contributions: the two planks they care most about (× trust in your faction), the rest of the platform, hope & dignity, hunger, memories (decayed), family & friends' pull, opportunism, fear. The inspector shows exactly this list.
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
  // (Placeholder hook for per-person plank weighting; currently 1.)
  function fit0(p, k) { return 1; }
  const kinCache = new Map();
  // Weighted mean loyalty of a person's close kin and friends — the 'peer pull'. Cached per person (cache cleared when large).
  function peerMean(p) {
    let arr = kinCache.get(p.id);
    if (!arr) { arr = []; const m = C.kinOf(p); for (const [id, o] of m) if (o.w >= 0.3) arr.push([id, o.w]); for (const r of p.rel) if (r.w > 0.1) arr.push([r.id, r.w]); kinCache.set(p.id, arr); }
    let s = 0, w = 0; for (const [id, ww] of arr) { const q = C.P(id); if (q.status === 'dead') continue; s += q.trueStance * ww; w += ww; }
    return w ? s / w : p.trueStance;
  }
  // What a person SHOWS (informers show a pale friendly stance) versus what they really are.
  C.shownStance = function (a) {
    const p = a.p;
    if (p.informant && !p.revealed) return { v: p.stance, c: Math.max(20, p.conv - 20) };
    return { v: p.trueStance, c: p.conv };
  };
  // Sum of the explanation list plus the faction's baseline, clamped to −100…+100.
  C.stanceTarget = function (p) { const e = C.explainStance(p); let t = 0; for (const x of e) t += x.v; return clamp(t + C.FACTIONS[p.fac].stance * 0.55, -100, 100); };

  // THE DAILY TICK. Once per game day, for every living person: needs drift (for those not simulated live), healing (cracks heal if fed and rested; chunks never), morale, experience, beard growth, and the loyalty update (move toward the target at a rate slowed by conviction; conviction grows when pushed the way they lean). Then: soldiers may desert, queued memories arrive, vales fall due, atrocities, orders upkeep, rackets, policy; faction trust follows promises vs deeds; regime meters (heat, legitimacy, army morale, US support) drift; leaks expose lies; ruling by fear costs trust.
  // ---------------- daily tick ----------------
  // (see above)
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
      if (rebel && p.sex === 'M' && age > 16 && p.look && !p.look.beard) { p.beardLen = clamp((p.service || 0) / 110, 0, 1); if (p.informant && (p.id * 7) % 10 < 8) p.beardLen = Math.min(p.beardLen, 0.1); }   // the barbudos (infiltrators tend to stay clean-shaven)
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
    C.atrocityTick(); C.ordersDaily(); C.racketDaily && C.racketDaily(); C.policyDaily && C.policyDaily();
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
  // Faction trust: for each faction, announced reform planks are tested against deeds after a grace period of 20 days; kept promises raise trust, unkept lower it; conduct (justice, fear) also moves the elite, the Church and the peasants.
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
  // A leak: your public position on a plank is revealed to differ from your real plan. Honesty and trust collapse among those who care about it.
  C.exposeLie = function (k) {
    const g = G(); g.platform.real[k] = g.platform.pub[k]; g.rep.honesty = clamp(g.rep.honesty - 14, 0, 100);
    for (const f of C.FACTION_KEYS) g.trust[f] = clamp(g.trust[f] - 0.18 * Math.min(1, C.FACTIONS[f].sal[k] / 2), 0.02, 1);
    C.log(`EXPOSED: your public stand on "${C.PLANKS[k].en}" does not match your private plans. Trust collapses among those who care.`, 'bad');
    g.news.unshift({ day: g.day, text: `Leak: rebel leadership "says one thing, plans another" on ${C.PLANKS[k].en.toLowerCase()}` });
  };
  // A rebel leaves (AWOL), possibly with a rifle; if he was an informer or an enemy, heat rises.
  C.desert = function (p) {
    const g = G(); if (!p.mil || p.mil.side !== 'rebel') return;
    for (const sq of g.squads) sq.members = sq.members.filter((id) => id !== p.id);
    p.mil = null; p.status = 'away'; p.side = null; p.note = 'Left the rebels.';
    const had = p.actor && p.actor.weapon; if (p.actor) { p.actor.gone = true; if (had) C.dropWeapon(p.actor); }
    g.rep.discipline = clamp(g.rep.discipline - 2, 0, 100);
    C.log(`${C.tagName(p)} has gone AWOL${had ? ' and took a rifle' : ''}.`, 'bad');
    if (p.informant || p.trueStance < -10) { g.regime.heat = clamp(g.regime.heat + 8, 0, 100); C.log(`...and word is, they went to the army.`, 'bad'); }
  };

  // PER-SOLDIER TRUST (0–100, default 60): how far each soldier believes you will not waste them. Orders (orders.js) and discipline decisions move it; obedience reads it.
  // ---------------- trust in the leader (per soldier) ----------------
  C.trustOf = (p) => (p.trust === undefined ? 60 : p.trust);
  C.addTrust = function (p, d) { p.trust = clamp(C.trustOf(p) + d, 0, 100); };

  // DISCIPLINE: what you do when one of your own commits a crime against civilians. Methods: firing squad, court-martial, private reckoning, ignore.
  // Each soldier judges the outcome through their own sex, traits, closeness to the offender and the kind of offence — so the troop splits.
  // ---------------- discipline: punishing your own ----------------
  // Closeness weights of non-kin ties for judging an offender.
  const TIEW = { friend: 0.4, compadre: 0.5, comrade: 0.5, lover: 0.8, coworker: 0.15, neighbor: 0.1, rival: -0.2 };
  // How close q is to the offender (kin weight or tie weight, 0 if none).
  function tieTo(q, cand) { const rel = C.relativeLabel(q, cand); if (!rel) return 0; if (C.KINW[rel] !== undefined) return C.KINW[rel]; return TIEW[rel] || 0; }
  // A soldier's appetite for harsh punishment (0..1): more for women, idealists and graver crimes; less for hotheads, drinkers and kind people; much less if close to the offender.
  // would this soldier back harsh punishment for this offence? 0..1
  function harshOpinion(q, cand, kind, method) {
    let o = 0.45;
    if (q.sex === 'F') o += 0.22; if (q.traits.includes('idealist')) o += 0.14; if (q.traits.includes('stoic')) o += 0.05; if (q.traits.includes('kind') && method === 'squad') o -= 0.12;
    if (q.traits.includes('hothead')) o -= 0.08; if (q.traits.includes('drinker')) o -= 0.1;
    o += kind === 'abuse' ? 0.28 : kind === 'killing' ? 0.18 : kind === 'theft' ? -0.1 : 0;
    const tie = tieTo(q, cand); o -= (method === 'squad' ? 0.7 : 0.35) * tie;
    return clamp(o + (Math.random() - 0.5) * 0.3, 0, 1);
  }
  // Carry out the chosen punishment, update reputation/justice/discipline, publish the event for the victim's family, apply each crewman's reaction (approve: +morale/trust; disapprove: −; close friends of a shot man may desert), and show 'The troop reacts'.
  C.punishOffender = function (cand, vic, sid, kind, method) {
    const g = G(); const cn = C.tagName(cand), vn = C.tagName(vic); const grave = kind === 'abuse' || kind === 'killing';
    const crew = C.squadPeople().filter((q) => q.id !== cand.id && q.id !== C.W.player);
    const rep = { yes: [], no: [], left: [] };
    const scale = method === 'squad' ? 1 : method === 'martial' ? 0.55 : 0.3;
    if (method === 'squad' || method === 'martial') {
      const sev = method === 'squad' ? 70 : 45;
      C.addEvent({ type: 'justice', victim: vic, perpSide: 'rebel', positive: true, sev, pub: grave ? 0.9 : 0.3, x: 0, y: 0, settlement: sid, text: `Rebels ${method === 'squad' ? 'shot' : 'punished'} a soldier who wronged ${vn}`, memText: `The rebels punished their own soldier`, headline: grave && method === 'squad' ? `Rebel soldier shot by firing squad for crime at ${C.SETTLEMENTS[sid].name}` : null });
      g.rep.discipline = clamp(g.rep.discipline + (method === 'squad' ? 14 : 8), 0, 100); g.rep.justice = clamp(g.rep.justice + (method === 'squad' ? 10 : 6), 0, 100); if (method === 'squad') g.rep.fear = clamp(g.rep.fear + 5, 0, 100);
      C.deed(5, method === 'squad' ? 8 : 4); if (kind === 'abuse') C.deed(6, method === 'squad' ? 10 : 5);
      if (grave && method === 'squad') { g.trust.peasants = clamp(g.trust.peasants + 0.04, 0, 1); g.trust.church = clamp(g.trust.church + 0.02, 0, 1); if (kind === 'abuse') for (const p of C.W.people) if (p.sex === 'F' && p.status === 'alive') p.trueStance = clamp(p.trueStance + 1.5, -100, 100); }
      for (const q of crew) {
        const o = harshOpinion(q, cand, kind, method); const tie = tieTo(q, cand);
        if (o > 0.52) { rep.yes.push(q); q.morale = clamp(q.morale + 3 * scale, 0, 100); C.addTrust(q, 6 * scale); }
        else if (o < 0.36) { rep.no.push(q); q.morale = clamp(q.morale - 7 * scale, 0, 100); C.addTrust(q, -10 * scale); q.anger = clamp(q.anger + 10, 0, 100); if (tie >= 0.45 && method === 'squad' && Math.random() < 0.4) { rep.left.push(q); } }
      }
      if (method === 'squad') C.killOffscreen(cand, 'rebel', `${cn} was shot by firing squad`, 60, true);
      else { cand.wpn = 'machete'; if (cand.actor) { C.dropWeapon(cand.actor); C.giveWeapon(cand.actor, 'machete', 1); } cand.morale = clamp(cand.morale - 25, 0, 100); C.addTrust(cand, -20); }
    } else if (method === 'private') {
      C.addEvent({ type: 'justice', victim: vic, perpSide: 'rebel', positive: true, sev: grave ? 22 : 18, pub: 0.1, x: 0, y: 0, settlement: sid, text: 'A rebel apologised and repaid', memText: grave ? 'The rebel apologised but that is not enough' : 'The rebel apologised and repaid us' });
      g.rep.discipline = clamp(g.rep.discipline + 2, 0, 100); g.rep.justice = clamp(g.rep.justice + (grave ? -2 : 3), 0, 100);
      if (!grave) g.res.money = Math.max(0, g.res.money - 6);
      for (const q of crew) { const o = 1 - harshOpinion(q, cand, kind, 'martial') + 0.1; if (grave && o < 0.4) { rep.no.push(q); C.addTrust(q, -5); q.morale = clamp(q.morale - 3, 0, 100); } else if (o > 0.6) { rep.yes.push(q); } }
    } else { // ignore
      g.rep.discipline = clamp(g.rep.discipline - 9, 0, 100); g.rep.justice = clamp(g.rep.justice - 12, 0, 100);
      C.addEvent({ type: 'impunity', victim: vic, perpSide: 'rebel', val: -1, sev: grave ? 30 : 12, pub: 0.5, x: 0, y: 0, settlement: sid, text: `The rebels did nothing about what ${cn} did`, memText: 'The rebels did nothing' });
      if (grave) { g.trust.peasants = clamp(g.trust.peasants - 0.07, 0.02, 1); g.trust.church = clamp(g.trust.church - 0.06, 0.02, 1); if (kind === 'abuse') for (const p of C.W.people) if (p.sex === 'F' && p.status === 'alive') p.trueStance = clamp(p.trueStance - 3, -100, 100); }
      for (const q of crew) { const o = harshOpinion(q, cand, kind, 'martial'); if (grave && o > 0.6) { rep.no.push(q); C.addTrust(q, -7); q.morale = clamp(q.morale - 4, 0, 100); } }
    }
    g.stats.atrocities = g.stats.atrocities || { army: 0, rebel: 0 }; g.stats.atrocities.rebel++;
    for (const q of rep.left) C.desert(q);
    const names = (arr) => arr.slice(0, 4).map(C.tagName).join(', ') + (arr.length > 4 ? '…' : '');
    const lines = [];
    if (method === 'squad') lines.push(`${cn} is shot at dawn.`);
    else if (method === 'martial') lines.push(`${cn} is disarmed and set to hard labour.`);
    else if (method === 'private') lines.push(`${cn} apologizes to the family. It is not much.`);
    else lines.push(`Nothing happens to ${cn}. Everybody notices.`);
    if (rep.yes.length) lines.push(`${rep.yes.length} of your men approve (${names(rep.yes)}).`);
    if (rep.no.length) lines.push(`${rep.no.length} disapprove (${names(rep.no)}).`);
    if (rep.left.length) lines.push(`${names(rep.left)} ${rep.left.length > 1 ? 'were' : 'was'} ${rep.left.length > 1 ? 'his friends' : 'his friend'} and desert${rep.left.length > 1 ? '' : 's'} in the night.`);
    C.ui.card({ title: 'The troop reacts', icon: '🗣', body: lines.join('\n'), choices: [{ label: 'Carry on', fn: () => { } }] });
  };

  // THE REGIME'S ATROCITIES: each day every garrison soldier has a small chance (rising with heat, bad army morale, hothead/drinker/greedy traits; falling for kind men) of committing theft, looting, beating, abuse, torture or murder against locals. Grave ones are reported to the player (recentAtrocity → the army_abuse event).
  // ---------------- the regime's atrocities (every garrison, every day) ----------------
  // (see above)
  C.atrocityTick = function () {
    const g = G(); const heatK = 1 + g.regime.heat / 120; g.stats.atrocities = g.stats.atrocities || { army: 0, rebel: 0 };
    for (const sid of C.PLAYABLE) {
      const sol = (C.W.bySet[sid] || []).map((id) => C.P(id)).filter((p) => p.status === 'alive' && p.mil && p.mil.side === 'army');
      const locals = (C.W.bySet[sid] || []).map((id) => C.P(id)).filter((p) => p.status === 'alive' && C.ageOf(p) >= 14 && !p.mil);
      if (!locals.length) continue;
      for (const sd of sol) {
        let pr = 0.00055 * heatK * (g.flags.verano ? 1.5 : 1) * (g.regime.armyMorale < 40 ? 1.35 : 1);
        if (sd.traits.includes('hothead')) pr *= 2; if (sd.traits.includes('drinker')) pr *= 1.6; if (sd.traits.includes('greedy')) pr *= 1.3; if (sd.traits.includes('kind')) pr *= 0.25; if (sd.occ === 'oficial') pr *= 0.5; if (sd.occ === 'sim') pr *= 1.6;
        if (Math.random() > pr) continue;
        const kind = sd.occ === 'sim' ? C.rnd.weighted([['torture', 0.45], ['beating', 0.25], ['abuse', 0.1], ['murder', 0.2]]) : C.rnd.weighted([['theft', 0.34], ['beating', 0.24], ['abuse', 0.12], ['murder', 0.1], ['looting', 0.2]]);
        const pool = kind === 'abuse' ? locals.filter((p) => p.sex === 'F' && C.ageOf(p) < 45) : kind === 'torture' ? locals.filter((p) => p.trueStance > 10 || p.fac === 'students') : locals;
        const vic = pool.length ? pool[(Math.random() * pool.length) | 0] : null; if (!vic) continue;
        const vn = C.tagName(vic), nm = C.SETTLEMENTS[sid].name, sn = C.tagName(sd);
        const T = { theft: [`${sn} took food and money from ${vn} at ${nm}`, 22, 0.15], looting: [`Soldiers looted ${vn}'s shop at ${nm}`, 30, 0.3], beating: [`Soldiers beat ${vn} in the street at ${nm}`, 45, 0.55], abuse: [`A soldier abused ${vn} at ${nm}`, 82, 0.65], murder: [`${sn} shot ${vn} dead at ${nm}`, 90, 0.9], torture: [`Police agents tortured ${vn} at ${nm}`, 78, 0.6] }[kind];
        C.addEvent({ type: kind === 'looting' ? 'theft' : kind === 'torture' ? 'torture' : kind, victim: vic, perpSide: 'army', perp: sd, sev: T[1], pub: T[2], x: 0, y: 0, settlement: sid, text: T[0], memText: T[0].replace(/^.*? (took|looted|beat|abused|shot|tortured)/, (m, v) => (kind === 'abuse' ? 'A soldier abused' : kind === 'murder' ? 'A soldier shot' : kind === 'torture' ? 'Police tortured' : kind === 'beating' ? 'Soldiers beat' : 'A soldier took from')), headline: T[1] >= 78 ? T[0] : null });
        if (kind === 'murder' || (kind === 'torture' && Math.random() < 0.2)) { vic.status = 'dead'; vic.died = g.day; vic.diedBy = 'killed'; g.stats.killedCiv++; }
        g.stats.atrocities.army++; g.regime.legit = clamp(g.regime.legit - (T[1] >= 78 ? 1.1 : 0.3), 0, 100);
        if (T[1] >= 78) g.recentAtrocity = { kind, victim: vic.id, perp: sd.id, settlement: sid, day: g.day, text: T[0] + '.', handled: false };
      }
    }
  };

  // ARMING. Rifles are limited (G.res.guns for rifles, G.heavy[...] for BARs, machine guns, bazookas and mortars). Giving one to a novice while veterans carry machetes divides the troop.
  // ---------------- scarce rifles ----------------
  // Arming a novice while experienced men carry machetes divides the troop. Returns the number who resent it.
  // (Ordinary rifles come from G.res.guns; heavy ones from G.heavy.)
  // Heavy weapons (BAR, MG, bazooka, mortar) come from g.heavy; ordinary rifles from g.res.guns.
  // A heavy weapon given to a novice divides the troop exactly like a rifle does (C.resentment).
  C.armSoldier = function (p, wk) {
    const g = G(); g.heavy = g.heavy || {};
    if (wk && C.HEAVY.includes(wk)) { if (!(g.heavy[wk] > 0)) return false; g.heavy[wk]--; p.wpn = wk; }
    else { if (g.res.guns <= 0) return false; g.res.guns--; p.wpn = wk || 'rifle'; }
    if (p.actor && p.actor.scene === g.scene) { C.giveWeapon(p.actor, p.wpn, C.WEAPONS[p.wpn].mag * 2); p.actor.weaponOut = true; }
    return C.resentment(p);
  };
  // Experienced unarmed soldiers resent a novice getting a gun: trust and morale fall, anger rises (more if the novice is a woman and the veteran a traditionalist). Returns how many resent it.
  C.resentment = function (p) {
    let n = 0;
    for (const q of C.squadPeople()) {
      if (q.id === p.id || q.id === C.W.player) continue; const unarmed = !q.wpn || q.wpn === 'machete';
      if (unarmed && q.exp > p.exp + 12) { n++; C.addTrust(q, -5); q.morale = clamp(q.morale - 5, 0, 100); q.anger = clamp(q.anger + 6, 0, 100); if (p.sex === 'F' && q.iss[6] < -0.15) { C.addTrust(q, -4); } }
    }
    if (n) C.log(`${n} more experienced ${n > 1 ? 'men resent' : 'man resents'} that ${C.tagName(p)} got a rifle.`, 'warn');
    return n;
  };

  // THE MANIFESTO. declarePlank announces a position (public) and records the real plan; changing a declared position is a flip-flop (trust and honesty fall). Presets are quick starting points.
  // ---------------- platform ----------------
  // Announce plank k at `level` (0,1,2) with an optional different real plan; flip-flops cost trust and honesty.
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
  // Named starting platforms: 'History Will Absolve Me', radical, moderate, order-and-tradition.
  C.presets = {
    historia: { n: '"History Will Absolve Me" (26th of July program)', v: [1, 2, 1, 1, 2, 1, 1, 1] },
    radical: { n: 'Radical transformation', v: [2, 2, 2, 2, 0, 2, 2, 2] },
    moderate: { n: 'Moderate reformists', v: [1, 1, 1, 0, 2, 1, 1, 1] },
    order: { n: 'Order and tradition', v: [0, 1, 0, 0, 1, 0, 0, 0] },
  };
  // Announce every plank of a preset.
  C.applyPreset = function (key) { const pr = C.presets[key]; pr.v.forEach((lvl, k) => C.declarePlank(k, lvl)); C.log(`Announced: ${pr.n}.`, 'info'); };

  // Aggregated loyalty by faction (mean stance, trust, size) plus the mean for women and for Afro-Cubans; drives the factions panel and the end screen.
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
    const out = C.FACTION_KEYS.map((f) => ({ key: f, name: C.fName(f), n: rows[f].n, mean: rows[f].n ? rows[f].sum / rows[f].n : 0, trust: g.trust[f], col: C.FACTIONS[f].col }));
    return { rows: out, women: wN ? wS / wN : 0, afro: aN ? aS / aN : 0, all: g.supportMean || 0 };
  };

  // THE HAVANA PIPELINE. Donors in the capital send money via couriers to the Sierra; each trip can be intercepted (risk falls with experience, and for women).
  // ---------------- couriers (the Havana pipeline) ----------------
  // Dispatch a courier with money (the balance leaves the pipeline now; it arrives, or is lost, after 6–10 days).
  C.sendCourier = function (carrier, amount) {
    const g = G(); const risk = clamp(0.22 + g.regime.heat * 0.004 - (carrier.p.sex === 'F' ? 0.1 : 0) - carrier.p.exp * 0.0015, 0.05, 0.6);
    g.pipe.couriers.push({ id: carrier.p.id, amount, due: g.day + 6 + Math.floor(Math.random() * 5), risk });
    g.pipe.balance -= amount; C.log(`${C.tagName(carrier.p)} sets out with ${amount} pesos for the Sierra (risk of interception ${Math.round(risk * 100)}%).`, 'info');
  };
  // Resolve couriers whose trip is due: caught at a checkpoint (money lost, heat up) or delivered.
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

  // TRAVEL COST over the edge graph (Dijkstra): foot days and vehicle hours between two playable places.
  // ---------------- travel ----------------
  // (see above)
  C.travelCost = function (from, to) { // shortest foot days / vehicle hours over the edge graph
    const nodes = C.PLAYABLE, dist = {}, vh = {}, prev = {};
    for (const n of nodes) { dist[n] = 1e9; vh[n] = 1e9; }
    dist[from] = 0; vh[from] = 0; const Q = new Set(nodes);
    while (Q.size) { let u = null; for (const n of Q) if (u === null || dist[n] < dist[u]) u = n; Q.delete(u); for (const e of C.EDGES) { let v = null, d = 0, h = 0; if (e[0] === u) { v = e[1]; } else if (e[1] === u) { v = e[0]; } if (!v) continue; d = e[2]; h = e[3]; if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; vh[v] = vh[u] + h; prev[v] = u; } } }
    return { days: dist[to], hours: vh[to] };
  };

  // Quick aggregates over the rebel party (size, mean experience, morale, hunger) for the UI.
  // ---------------- stats helpers for UI ----------------
  C.partyStats = function () {
    const g = G(); const ids = squadIds(); let exp = 0, mor = 0, hung = 0;
    for (const id of ids) { const p = C.P(id); exp += p.exp; mor += p.morale; hung += (100 - p.needs.food); }
    const n = ids.length || 1; return { n: ids.length, exp: exp / n, morale: mor / n, hunger: hung / n };
  };
})();
