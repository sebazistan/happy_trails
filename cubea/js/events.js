/* CUBEA — events.js : the storyteller (director), event table, historical anchors, abstract battles, El Viejo's advice.
   The director watches tension, momentum and a "spiral sensor" and chooses what happens next — and when to throw a lifeline. */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  const clamp = C.clamp;
  const G = () => C.G;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const S = (id) => C.SETTLEMENTS[id];

  C.story = { vars: {}, hist: [], last: {}, fired: {}, defs: null, anchors: null };

  // HELPERS shared by the events: the party, local people, a settlement-wide memory spreader, offscreen killing, battle resolution.
  // ---------- helpers ----------
  // (E and A are exposed below as C.story.defs / C.story.anchors for the test harness)
  const squadPeople = () => G().squads.flatMap((s) => s.members).map((id) => C.P(id)).filter((p) => p && p.status === 'alive');
  // Everyone in the rebel squads who is alive.
  C.squadPeople = squadPeople;
  const near = (sid) => G().scene && G().scene.sid === sid;
  const inRegion = () => { const sid = G().scene.sid; return ['sierra', 'palmarito', 'cayo'].includes(sid); };
  const rnd = Math.random;
  // Living people of a settlement, optionally filtered.
  function localPeople(sid, filter) { return (C.W.bySet[sid] || []).map((i) => C.P(i)).filter((p) => p.status === 'alive' && (!filter || filter(p))); }
  // One random such person.
  function randomLocal(sid, filter) { const l = localPeople(sid, filter); return l.length ? l[(rnd() * l.length) | 0] : null; }
  // A public matter affecting a whole settlement: publishes one event with a wide public reach, so many townspeople gain a memory of it.
  function memoryAll(sid, ev, sign, sev, pub) { // generic: a public matter affecting a whole settlement
    const l = localPeople(sid).filter((p) => C.ageOf(p) >= 14); if (!l.length) return;
    const v = l[(rnd() * l.length) | 0]; C.addEvent(Object.assign({ victim: v, x: 0, y: 0, settlement: sid, pub: pub === undefined ? 1 : pub }, ev, { val: sign, sev }));
  }
  // Kill a person who is not in the current scene (or via their actor if they are): status, squad removal, statistics, and a death event that ripples through their family and friends.
  C.killOffscreen = function (p, perpSide, text, sev, just) {
    const g = G(); if (p.status === 'dead') return;
    if (p.actor && !p.actor.dead && g.scene && p.actor.scene === g.scene) { C.die(p.actor, null, 'killed'); return; }
    p.status = 'dead'; p.died = g.day; p.diedBy = 'killed'; for (const sq of g.squads) sq.members = sq.members.filter((id) => id !== p.id);
    if (p.mil && p.mil.side === 'rebel') g.stats.lostRebels++; else if (p.mil && p.mil.side === 'army') g.stats.killedArmy++;
    C.addEvent({ type: 'death', victim: p, perpSide: perpSide, val: perpSide === 'rebel' ? -1 : 1, sev: sev || 55, just: !!just, pub: 0.3, x: 0, y: 0, settlement: p.settlement, text: text || `${C.tagName(p)} was killed`, memText: text || `${C.tagName(p)} was killed`, headline: text });
  };
  // An abstract measure of the column's strength: experience, morale, health and armament, scaled by ammunition and food per person. Used for set-piece battles that are resolved without being played.
  C.rebelStrength = function () {
    const ps = squadPeople(); let pw = 0; const g = G();
    for (const p of ps) pw += (1 + p.exp / 45) * clamp(p.morale / 60, 0.3, 1.3) * clamp(p.hp / p.maxHp, 0.3, 1) * (p.wpn ? 1 : 0.5);
    const sup = clamp(g.res.ammo / (ps.length * 6 + 1), 0.3, 1.2) * clamp((g.res.food + 5) / (ps.length + 3), 0.6, 1.1);
    return pw * sup;
  };
  // abstract battle: used for set-piece actions we don't play out
  // Resolve an unplayed action (La Plata, El Uvero, Santa Clara…): odds from your strength against the enemy's, casualties (veterans and named people less likely to die, never immune), experience, morale, ammunition spent, loot and prisoners.
  C.resolveBattle = function (name, enemy, o) {
    o = o || {}; const g = G();
    const mine = C.rebelStrength() * (o.bonus || 1) * (g.hour < 6 || g.hour > 19 ? 1.1 : 1);
    const theirs = enemy * 1.25;
    const odds = clamp(0.5 + (mine - theirs) / (mine + theirs + 3) * 1.3, 0.08, 0.95);
    const win = rnd() < odds;
    const ps = squadPeople().filter((p) => !p.roster || p.roster === 'fidel' ? false : true);
    const all = squadPeople();
    const lossRate = win ? clamp(0.06 + (theirs / (mine + 1)) * 0.12, 0.02, 0.4) : clamp(0.28 + rnd() * 0.25, 0.15, 0.7);
    const dead = [];
    const pool = all.filter((p) => p.id !== C.W.player).sort((a, b) => (a.exp + a.hp * 0.2) - (b.exp + b.hp * 0.2));
    const nLoss = Math.min(pool.length - 1, Math.round(all.length * lossRate * (rnd() * 0.5 + 0.75)));
    for (let i = 0; i < nLoss; i++) { const v = pool[i]; if (v.roster && rnd() < 0.78) continue; dead.push(v); }
    for (const v of dead) C.killOffscreen(v, 'army', `${C.tagName(v)} fell at ${name}`, 55);
    for (const p of all) { p.exp = clamp(p.exp + (win ? 2.5 : 1.2), 0, 100); p.morale = clamp(p.morale + (win ? 10 : -14), 0, 100); if (rnd() < 0.3) p.cracks.push({ x: rnd() - 0.5, y: rnd() - 0.5, a: rnd() * 6, l: 0.9, n: 1, s: rnd(), t: g.day }); }
    g.res.ammo = Math.max(0, g.res.ammo - Math.round(all.length * (3 + rnd() * 4)));
    const loot = win ? { ammo: Math.round(enemy * (6 + rnd() * 8)), med: Math.round(rnd() * 3), food: Math.round(enemy * 2), guns: Math.round(enemy * 0.8) } : { ammo: 0, med: 0, food: 0, guns: 0 };
    const pris = win ? Math.round(enemy * (0.2 + rnd() * 0.5)) : 0;
    return { win, odds, dead, loot, pris, mine, theirs };
  };

  // THE DIRECTOR'S STATE (see Design Bible §10). Each day it measures hunger, morale, supply stress, threat (heat + alert), pressure, trends in support and troop size, MOMENTUM, a SPIRAL sensor (bad levels AND falling trends), a sawtooth TARGET tension (build for 6 days, release for 2, with a rising baseline) and the recent intensity of events; tension = 0.6·pressure + 2.5·recent intensity.
  // ---------- storyteller variables ----------
  // (see above)
  C.story.update = function () {
    const g = G(), V = C.story.vars, ps = squadPeople();
    const n = ps.length || 1; let hunger = 0, morale = 0; for (const p of ps) { hunger += 100 - p.needs.food; morale += p.morale; }
    hunger /= n; morale /= n;
    V.hunger = hunger; V.morale = morale; V.n = ps.length;
    V.supplyStress = clamp(((g.res.food < ps.length * 2 ? 40 : 0) + (g.res.ammo < ps.length * 3 ? 30 : 0) + (hunger > 50 ? 30 : 0)), 0, 100);
    V.threat = clamp(g.regime.heat + (g.scene && g.scene.alert * 30), 0, 100);
    V.pressure = clamp(V.threat * 0.5 + V.supplyStress * 0.35 + (100 - morale) * 0.15, 0, 100);
    C.story.hist.push({ day: g.day, food: hunger, mor: morale, sup: g.supportMean || 0, n: ps.length }); if (C.story.hist.length > 10) C.story.hist.shift();
    const h = C.story.hist, a = h[0], b = h[h.length - 1];
    V.supTrend = h.length > 3 ? b.sup - a.sup : 0; V.nTrend = h.length > 3 ? b.n - a.n : 0;
    V.momentum = clamp(50 + V.supTrend * 12 + V.nTrend * 3, 0, 100);
    // spiral sensor: bad levels AND falling trends
    V.spiral = clamp((hunger > 55 ? 0.28 : 0) + (morale < 38 ? 0.25 : 0) + (V.supTrend < -1.2 ? 0.25 : 0) + (V.nTrend < -2 ? 0.2 : 0) + (g.res.food < 3 && ps.length > 3 ? 0.18 : 0) + (g.rep.fear > 60 ? 0.12 : 0) + (ps.length < 4 ? 0.15 : 0), 0, 1);
    // tension target: sawtooth (build 6 days, release 2) with a rising baseline
    const phase = g.day % 8; V.target = clamp(20 + g.day * 0.06 + (phase < 6 ? phase * 9 : 4), 0, 90);
    V.intensity7 = (C.story.recent || []).filter((e) => e.day > g.day - 7).reduce((s, e) => s + e.t, 0);
    V.tension = clamp(V.pressure * 0.6 + V.intensity7 * 2.5, 0, 100);
  };
  // Record that an event of intensity t just happened (feeds the 7-day intensity sum).
  C.story.noteEvent = function (t) { (C.story.recent = C.story.recent || []).push({ day: G().day, t }); if (C.story.recent.length > 40) C.story.recent.shift(); };

  // THE EVENT TABLE. Each entry: id, category (pressure / social / personal / lifeline / rest), intensity t (1–5), cooldown cd in days, the interface layer it needs, a weight function w(g) saying when it is likely, and run(g) which returns a decision card (or acts silently).
  // ---------- event table ----------
  // The table itself; also exposed as C.story.defs so other modules (events2.js, policy.js) can add events.
  const E = [];
  const def = (o) => E.push(o);
  const ready = (id, cd) => { const l = C.story.last[id]; return l === undefined || G().day - l >= cd; };

  // An army patrol enters the Sierra (or news of one elsewhere); raises heat. Pressure, tension 2.
  def({ id: 'patrol', cat: 'pressure', t: 2, cd: 4, layer: 1, w: (g) => inRegion() ? 3 : 0, run: (g) => {
    const s = g.scene; if (s.sid === 'sierra') { C.spawnPatrol(s, 4 + Math.floor(rnd() * 3), 'Patrulla del Ejército'); C.viejoSays('Compay — soldiers on the trail. A patrol, six at most. We can hide, or hit them where they are thin.'); }
    else C.viejoSays('Word from the road: the Guardia is sending a patrol into the hills.'); g.regime.heat += 1; return null; } });
  // El Viejo senses a leak. Choices: watch, pay the network to investigate, or question villagers (heavy-handed).
  def({ id: 'informant_hint', cat: 'pressure', t: 3, cd: 20, layer: 3, w: (g) => hasInformant() ? 2.5 : 0, run: (g) => {
    const inf = hasInformant(); if (!inf) return null; const w = C.viejoVoice('informant'); return card({ title: 'Someone is talking', icon: '👂', body: `${w}\n\nEl Viejo says a man among the people near the camp knows too much and spends money he does not have.`, choices: [
      { label: 'Keep quiet and watch him', sub: 'Risk: he keeps leaking. Chance to catch him in the act.', fn: () => { g.flags.watching = true; g.regime.heat += 2; } },
      { label: 'Have your network check him (12 pesos)', sub: 'Slow, quiet, usually right', disabled: g.res.money < 12, fn: () => { C.investigate(inf); } },
      { label: 'Question people near the camp', sub: 'Heavy-handed: frightens villagers', fn: () => { C.adjustRep('fear', 5); C.adjustRep('justice', -2); if (rnd() < 0.5) { inf.revealed = true; inf.stance = inf.trueStance; C.log('The questioning pays off: someone points at ' + C.fullName(inf) + '.', 'warn'); } } },
    ] }); } });
  // The army takes villagers' food; choose to ambush the truck, compensate, or do nothing. More likely when heat is high and it is not harvest time.
  def({ id: 'army_requisition', cat: 'pressure', t: 3, cd: 22, layer: 3, w: (g) => g.regime.heat > 12 && C.isZafra(g.day) === false ? 2.5 : 0.6, run: (g) => {
    const sid = pick(['palmarito', 'cayo']); const nm = S(sid).name;
    return card({ title: `The army takes the food at ${nm}`, icon: '🪖', body: `A truck and six soldiers arrive at ${nm} and carry off rice, beans and two pigs "for the troops". Families come to you afterward.`, choices: [
      { label: 'Ambush the truck on the road', sub: 'A fight. If it works, the food returns to the families.', fn: () => { g.flags.ambushTruck = sid; C.viejoSays('The truck leaves by the east road. We can reach the bend before they do.'); C.log('Mission: ambush the army truck.', 'warn'); } },
      { label: 'Help families hide what is left', sub: 'No cost. They remember who helped.', fn: () => { memoryAll(sid, { type: 'aid', perpSide: 'rebel', positive: true, text: 'Rebels helped families hide food from the army', memText: 'Rebels helped hide our food' }, 1, 40, 1); C.deed(0, 3); C.deed(1, 2); } },
      { label: 'Do nothing', sub: 'You are not strong enough yet.', fn: () => { memoryAll(sid, { type: 'requisition', perpSide: 'army', text: `The army took food from ${nm}`, memText: 'The army took our food' }, 1, 45, 1); g.regime.legit -= 0.6; } },
    ] }); } });
  // Landowners evict tenants; a chance to intervene (a land-reform hook).
  def({ id: 'eviction', cat: 'pressure', t: 3, cd: 35, layer: 3, w: (g) => 2, run: (g) => {
    const sid = 'palmarito'; const may = localPeople(sid, (p) => p.occ === 'mayordomo')[0]; const fam = randomLocal(sid, (p) => p.fac === 'peasants' && C.ageOf(p) > 28);
    if (!fam) return null;
    const declared = g.platform.declared[0] && g.platform.pub[0] >= 1;
    return card({ title: 'Eviction at Palmarito', icon: '🏚', body: `${may ? C.tagName(may) : 'The steward'} has ordered ${C.tagName(fam)}'s family and four others off the land they have farmed for years. The hacendado wants the cane planted.${declared ? '\n\nYou have promised land reform. They are watching what you do.' : ''}`, choices: [
      { label: 'Confront the steward\'s men and stop it', sub: 'Peasants cheer; landowners will hate you', fn: () => { memoryAll(sid, { type: 'aid', perpSide: 'rebel', positive: true, text: 'Rebels stopped an eviction at Palmarito', memText: 'Rebels stopped our eviction' }, 1, 75, 1); C.deed(0, 22); C.deed(3, -4); landOwnersAngry(sid, 38, 'Rebels intimidated the steward and blocked an eviction'); C.adjustRep('justice', 2); } },
      { label: 'Pay the rent arrears (40 pesos)', sub: 'Fair but expensive. Landowners barely notice.', disabled: g.res.money < 40, fn: () => { g.res.money -= 40; memoryAll(sid, { type: 'aid', perpSide: 'rebel', positive: true, text: 'Rebels paid the arrears for families facing eviction', memText: 'Rebels paid our rent' }, 1, 55, 0.8); C.deed(0, 8); } },
      { label: 'Stay out of it', sub: declared ? 'A promise broken in front of everyone' : 'It is not your quarrel — yet', fn: () => { memoryAll(sid, { type: 'eviction', perpSide: 'army', text: 'Five families were evicted from Palmarito', memText: 'We were evicted and nobody helped' }, 1, 30, 1); if (declared) { g.trust.peasants = clamp(g.trust.peasants - 0.09, 0.02, 1); C.log('The peasants noticed you did nothing.', 'bad'); } } },
    ] }); } });
  // After rebel killings the army punishes a village; the player may warn, hide people, or strike back. High tension (5).
  def({ id: 'reprisal', cat: 'pressure', t: 5, cd: 40, layer: 3, w: (g) => g.regime.heat > 42 && g.stats.killedArmy > 3 ? 3.5 : 0, run: (g) => {
    const sid = pick(['palmarito', 'cayo']); const nm = S(sid).name;
    return card({ title: `Reprisal at ${nm}`, icon: '🔥', body: `After your attacks, soldiers burn three bohíos at ${nm} and drag off two men for questioning. People are terrified — and furious. Some blame the army. Some blame you for drawing them here.`, choices: [
      { label: 'Send your people to help the families', sub: 'Shelter, food, medicine', fn: () => { const c = Math.min(g.res.food, 12); g.res.food -= c; memoryAll(sid, { type: 'aid', perpSide: 'rebel', positive: true, text: 'Rebels sheltered families after the army burned their homes', memText: 'Rebels sheltered us after the fire' }, 1, 70, 1); C.deed(1, 6); } },
      { label: 'Stay hidden; avoid more attention', sub: 'Safer for you', fn: () => { } },
    ], onShow: () => { memoryAll(sid, { type: 'reprisal', perpSide: 'army', text: `Soldiers burned homes at ${nm}`, memText: 'The army burned our homes' }, 1, 80, 1); memoryAll(sid, { type: 'reprisal', perpSide: 'rebel', text: 'The rebels brought the army down on us', memText: 'The rebels brought the army to us' }, -1, 22, 1); g.regime.legit -= 1.5; } }); } });
  // Wounded people arrive at the camp: a medical dilemma (medicine vs risk).
  def({ id: 'wounded_arrive', cat: 'pressure', t: 3, cd: 12, layer: 2, w: (g) => g.stats.lostRebels + g.stats.killedArmy > 2 ? 1.5 : 0.3, run: (g) => {
    const v = randomLocal('palmarito', (p) => C.ageOf(p) > 8); if (!v) return null;
    return card({ title: `${C.tagName(v)} is hurt`, icon: '🩹', body: `${C.tagName(v)} was gored by a bull / cut with a machete and cannot stop the bleeding. His family looks to the rebel doctor.`, choices: [
      { label: 'Treat him (2 medicine)', sub: 'Che will go himself', disabled: g.res.med < 2, fn: () => { g.res.med -= 2; C.addEvent({ type: 'aid', victim: v, perpSide: 'rebel', positive: true, sev: 62, pub: 0.4, x: 0, y: 0, settlement: v.settlement, text: `Rebel doctor saved ${C.tagName(v)}`, memText: 'The rebel doctor saved our family member', headline: null }); C.deed(1, 6); } },
      { label: 'Say you cannot spare supplies', sub: 'They remember', fn: () => { C.addEvent({ type: 'refuse', victim: v, perpSide: 'rebel', val: -1, sev: 30, pub: 0.2, x: 0, y: 0, settlement: v.settlement, text: `Rebels refused medicine to ${C.tagName(v)}`, memText: 'The rebels refused to help' }); } },
    ] }); } });
  // An air raid on the Sierra camp, telegraphed by rings; when heat is above 55.
  def({ id: 'airraid', cat: 'pressure', t: 5, cd: 25, layer: 2, w: (g) => g.regime.heat > 55 ? 3 : 0, run: (g) => {
    const s = g.scene; if (s.sid === 'sierra') { C.viejoSays('Airplanes! Get away from the camp! Spread out!'); s.bombing = true; const cx = s.camp.x * C.T, cy = s.camp.y * C.T; C.later(s, 5, () => { const pl2 = g.player; const off = (140 + rnd() * 60) * (rnd() < 0.5 ? -1 : 1); C.airstrike(s, pl2.x - 320, pl2.y + off, pl2.x + 300, pl2.y + off + 30, 8); C.later(s, 9, () => { s.bombing = false; }); }); g.regime.heat -= 14; }
    else { C.log('Aircraft bombed the Sierra. The camp is empty, but the mountain trembles.', 'warn'); g.regime.heat -= 10; memoryAll('sierra', { type: 'bombing', perpSide: 'army', text: 'The air force bombed the Sierra', memText: 'Bombs fell on the Sierra' }, 1, 40, 1); }
    return null; } });
  // A major army offensive (heat above 70 or the summer of 1958).
  def({ id: 'offensive', cat: 'pressure', t: 5, cd: 45, layer: 4, w: (g) => g.regime.heat > 70 || (g.day > 540 && g.day < 612 && ready('offensive', 12)) ? 4 : 0, run: (g) => {
    const s = g.scene;
    if (s.sid === 'sierra') { C.spawnPatrol(s, 12 + Math.floor(g.day > 540 ? 6 : 0), 'Columna del Ejército'); C.viejoSays('A whole column is coming up from the lowlands, and the airplanes behind it. This is the big one.'); C.log('OFFENSIVE: an army column enters the Sierra!', 'bad'); }
    else C.log('An army offensive is rolling into the Sierra. Your camp is exposed — return?', 'bad');
    g.regime.heat -= 18; return null; } });
  // ---- misconduct in your own ranks: theft, drunken violence, abuse, killing. Punishment divides the troop. ----
  // One of your men steals, drinks, kills or abuses a civilian. Choices: firing squad (grave only), court-martial, apologise and repay, let it pass — the troop reacts through its own views (see sim.js punishOffender). More likely with low discipline and with the mercenary drift.
  def({ id: 'misconduct', cat: 'pressure', t: 4, cd: 10, layer: 3, w: (g) => { const bad = squadPeople().filter((p) => !p.roster && (p.traits.includes('drinker') || p.traits.includes('hothead') || p.needs.food < 25 || p.morale < 28)); return bad.length && g.rep.discipline < 70 ? 1.6 + (55 - g.rep.discipline) * 0.04 : 0.08; }, run: (g) => {
    const score = (p) => (p.traits.includes('drinker') ? 2 : 0) + (p.traits.includes('hothead') ? 2 : 0) + (p.traits.includes('greedy') ? 1 : 0) + (p.needs.food < 25 ? 1 : 0) + (p.morale < 28 ? 1 : 0) - (p.traits.includes('kind') ? 2 : 0) - (p.traits.includes('stoic') ? 1 : 0) + rnd() * 1.6;
    const cand = squadPeople().filter((p) => !p.roster).sort((a, b) => score(b) - score(a))[0]; if (!cand) return null;
    const sid = pick(['palmarito', 'cayo']); const nm = S(sid).name;
    const kind = C.rnd.weighted([['theft', 0.36], ['drunk', 0.26], ['abuse', 0.13], ['killing', 0.09]]);
    const vic = randomLocal(sid, (p) => (kind === 'abuse' ? p.sex === 'F' && C.ageOf(p) > 14 && C.ageOf(p) < 45 : C.ageOf(p) > 14)); if (!vic) return null;
    const cn = C.tagName(cand), vn = C.tagName(vic);
    const friends = C.squadPeople().filter((q) => q.id !== cand.id && C.relativeLabel(cand, q)).length;
    const exp = cand.exp > 25 ? 'one of your experienced men' : 'a recent recruit';
    const text = { theft: `${cn} took a family's savings and their pig at ${nm}.`, drunk: `${cn}, drunk, beat ${vn} at ${nm} in front of the neighbours.`, abuse: `${cn}, drunk and angry, abused ${vn} at ${nm}. Her family is waiting to see what the rebels do about it.`, killing: `${cn} shot ${vn} at ${nm} after an argument over food. The village saw it.` }[kind];
    const sev = { theft: 28, drunk: 40, abuse: 85, killing: 90 }[kind];
    const graveKind = kind === 'abuse' || kind === 'killing';
    const base = { type: kind === 'abuse' ? 'abuse' : kind === 'killing' ? 'murder' : kind === 'drunk' ? 'beating' : 'theft', victim: vic, perpSide: 'rebel', val: -1, sev, pub: kind === 'theft' ? 0.15 : 0.8, x: 0, y: 0, settlement: sid, text: `A rebel soldier ${kind === 'abuse' ? 'abused' : kind === 'killing' ? 'killed' : kind === 'drunk' ? 'beat' : 'robbed'} ${vn} at ${nm}`, memText: kind === 'abuse' ? `A rebel soldier abused ${vn}` : kind === 'killing' ? `A rebel soldier killed ${vn}` : kind === 'drunk' ? `A drunk rebel beat ${vn}` : `A rebel soldier robbed us`, headline: graveKind ? `Rebel soldier accused of ${kind === 'abuse' ? 'abuse' : 'murder'} at ${nm}` : null };
    const info = `\n\n${cn} is ${exp}, and has ${friends} friend${friends === 1 ? '' : 's'} or kin among your men. You have ${C.squadPeople().length} soldiers in all.${graveKind ? '\n\nIn a small troop every rifle counts, and killing one of your own divides the rest. The village — and the women of the Sierra — are watching.' : ''}`;
    const choices = [];
    if (graveKind) choices.push({ label: 'Firing squad', sub: 'The historic answer. Strongest signal to the people; some of your men will not forgive it', fn: () => C.punishOffender(cand, vic, sid, kind, 'squad') });
    choices.push({ label: graveKind ? 'Court-martial: disarm, hard labour, ration cut' : 'Court-martial: confiscate his weapon and put him on latrine duty', sub: 'Harsh but he lives; fewer feel it', fn: () => C.punishOffender(cand, vic, sid, kind, 'martial') });
    choices.push({ label: 'Make him apologize and repay the family', sub: graveKind ? 'The village will think it too little' : 'A quiet, cheap answer', fn: () => C.punishOffender(cand, vic, sid, kind, 'private') });
    choices.push({ label: 'Let it pass — we need every rifle', sub: 'Your soldiers see impunity. The village sees you', fn: () => C.punishOffender(cand, vic, sid, kind, 'ignore') });
    return card({ title: 'Misconduct in the ranks', icon: '⚖', body: text + info, choices, onShow: () => { C.addEvent(base); g.rep.discipline = clamp(g.rep.discipline - 3, 0, 100); } }); } });

  // ---- the army's own atrocities reach you as reports ----
  // A report that soldiers abused or killed a local (set by atrocityTick). Choices: strike the post at night, shelter the family, keep your heads down.
  def({ id: 'army_abuse', cat: 'pressure', t: 4, cd: 12, layer: 3, w: (g) => g.recentAtrocity && g.day - g.recentAtrocity.day < 8 && !g.recentAtrocity.handled ? 4 : 0, run: (g) => {
    const r = g.recentAtrocity; if (!r) return null; r.handled = true; const sid = r.settlement; const nm = S(sid).name;
    return card({ title: `${nm}: the soldiers again`, icon: '🪖', body: `${r.text} The family has come to the camp. They do not ask for revenge. They ask whether anyone is left who will answer for such things.`, choices: [
      { label: 'Strike the post at night', sub: 'A mission for your best men. Risky. The village will know who answered', fn: () => { g.flags.avenge = sid; g.mission = { text: `Answer the abuse at ${nm}: hit the Guardia post.`, kind: 'avenge' }; C.log(`Mission: hit the army post at ${nm}.`, 'warn'); } },
      { label: 'Take the family into the hills and feed them', sub: 'Costs 10 food', disabled: g.res.food < 10, fn: () => { g.res.food -= 10; C.addEvent({ type: 'aid', victim: C.P(r.victim), perpSide: 'rebel', positive: true, sev: 50, pub: 0.3, x: 0, y: 0, settlement: sid, text: `Rebels sheltered a family from ${nm}`, memText: 'Rebels sheltered us' }); C.deed(1, 3); } },
      { label: 'Tell them to keep their heads down', sub: 'You are not strong enough yet', fn: () => { g.trust.peasants = clamp(g.trust.peasants - 0.02, 0.02, 1); } },
    ] }); } });

  // social
  // A village delegation asks for something (protection, food, a hearing).
  def({ id: 'delegation', cat: 'social', t: 2, cd: 8, layer: 3, w: (g) => 3, run: (g) => {
    const sid = pick(['palmarito', 'cayo']); const asks = pick([['the well has gone dry; they need a pump washer and a day of labor', 'labor'], ['two families are quarreling over a pig and a fence', 'mediate'], ['the school roof leaks and the teacher has no chalk', 'school'], ['a fever is passing through the children', 'medicine']]);
    return card({ title: `A delegation from ${S(sid).name}`, icon: '🤝', body: `Three villagers come to the camp. They say ${asks[0]}.`, choices: [
      { label: asks[1] === 'medicine' ? 'Send medicine (2) and a medic' : asks[1] === 'school' ? 'Send paper and chalk (8 pesos)' : 'Lend a few hands for a day', sub: 'Cheap goodwill', disabled: (asks[1] === 'medicine' && g.res.med < 2) || (asks[1] === 'school' && g.res.money < 8), fn: () => { if (asks[1] === 'medicine') g.res.med -= 2; if (asks[1] === 'school') g.res.money -= 8; memoryAll(sid, { type: 'aid', perpSide: 'rebel', positive: true, text: 'Rebels helped our village', memText: 'Rebels helped with what we asked' }, 1, 52, 1); C.deed(1, 4); C.adjustRep('justice', 1); } },
      { label: 'Send apologies', sub: 'You are busy', fn: () => { } },
    ] }); } });
  // A village festival: relief and a chance to gather intelligence (more common in the dead season).
  def({ id: 'fiesta', cat: 'rest', t: 1, cd: 25, layer: 2, w: (g) => g.day > 6 && !C.isZafra(g.day) ? 1.5 : 0.6, run: (g) => {
    const sid = pick(['palmarito', 'cayo']);
    return card({ title: `Fiesta at ${S(sid).name}`, icon: '🎺', body: `Drums, a guitar, rum and roast pig. The village invites the rebels to a night of music. It is a chance to rest — and to hear what people are saying.`, choices: [
      { label: 'Let the troops go (with a rule: no drunkenness)', sub: 'Morale up, intel, small risk of trouble', fn: () => { for (const p of squadPeople()) { p.morale = clamp(p.morale + 14, 0, 100); p.needs.hope = clamp(p.needs.hope + 8, 0, 100); p.stress = Math.max(0, p.stress - 20); } memoryAll(sid, { type: 'fiesta', perpSide: 'rebel', positive: true, text: 'Rebels danced with us at the fiesta', memText: 'The rebels joined our fiesta' }, 1, 24, 1); g.res.food += 6; C.adjustRep('discipline', -3); g.cooldown.fiesta = g.day; C.viejoSays('At a fiesta the walls have ears. Listen. The women know everything about everybody.'); } },
      { label: 'Decline: we cannot lower our guard', sub: 'Safe but sour', fn: () => { for (const p of squadPeople()) p.morale = clamp(p.morale - 2, 0, 100); } },
    ] }); } });
  // A priest visits and asks about your policy toward the Church.
  def({ id: 'priest_visit', cat: 'social', t: 2, cd: 30, layer: 4, w: (g) => 1.5, run: (g) => {
    const pr = randomLocal('manzanillo', (p) => p.occ === 'sacerdote') || randomLocal('santiago', (p) => p.occ === 'sacerdote'); const nm = pr ? C.tagName(pr) : 'The parish priest';
    return card({ title: 'The priest asks for a promise', icon: '⛪', body: `${nm} comes through the hills with a message from the parish: "Do not touch the churches. Do not touch our schools. And do not become the men you are fighting." In towns the young priests quietly support you; the old bishops are cautious.`, choices: [
      { label: 'Promise to protect churches and worship', sub: 'The Church relaxes. Radical youth roll their eyes.', fn: () => { C.deed(2, 8); g.trust.church = clamp(g.trust.church + 0.1, 0, 1); memoryAll('manzanillo', { type: 'speech', perpSide: 'rebel', positive: true, text: 'Rebels pledged to protect the Church', memText: 'The rebels pledged to protect the Church' }, 1, 28, 1); } },
      { label: 'Say the Church must stay out of politics', sub: 'Students approve. The devout bristle.', fn: () => { C.deed(2, -6); memoryAll('santiago', { type: 'speech', perpSide: 'rebel', positive: true, text: 'Rebels called for a secular state', memText: 'The rebels want church and state apart' }, 1, 22, 0.6); g.trust.church = clamp(g.trust.church - 0.1, 0.02, 1); for (const p of C.W.people) if (p.fac === 'church' && p.status === 'alive') { p.trueStance -= 6; } } },
    ] }); } });
  // A stranger arrives: a recruit, a possible spy (check with the network), or a contact from Santiago.
  def({ id: 'stranger', cat: 'social', t: 3, cd: 14, layer: 3, w: (g) => 2.4, run: (g) => {
    const r = rnd(); const sid = pick(['palmarito', 'cayo']);
    if (r < 0.5) { const rec = randomLocal(sid, (p) => p.sex === 'M' && C.ageOf(p) > 17 && C.ageOf(p) < 38 && !p.mil && p.trueStance > 5); if (!rec) return null; return card({ title: `${C.tagName(rec)} wants to join`, icon: '🙋', body: `${C.tagName(rec)}, ${C.OCC[rec.occ].n.toLowerCase()} from ${S(sid).name}, shows up at the camp: "I can shoot. My brother is in prison. I am hungry for something to believe in."`, choices: [{ label: 'Welcome him (feed him, give him a rifle if you have one)', fn: () => C.recruit(rec) }, { label: 'Send him home', sub: 'We cannot feed another mouth', fn: () => { } }] }); }
    const spy = randomLocal(sid, (p) => p.sex === 'M' && C.ageOf(p) > 20 && C.ageOf(p) < 45 && !p.mil && !p.roster); if (!spy) return null;
    if (r < 0.75) return card({ title: `A stranger, ${C.tagName(spy)}`, icon: '🕴', body: `${C.tagName(spy)} claims to bring a message from Santiago. His hands are too clean for a guajiro, and his boots are new.`, choices: [{ label: 'Take his message', sub: 'A chance at a contact — or a trap', fn: () => { if (rnd() < 0.45) { spy.informant = true; spy.trueStance = -50; spy.stance = 25; spy.conv = 55; C.recruit(spy); C.log('He seems sincere...', 'info'); } else { g.res.money += 30; C.log('Honest: a Llano contact sends 30 pesos.', 'good'); } } }, { label: 'Turn him away', fn: () => { } }, { label: 'Have someone check him out (12 pesos)', sub: 'Usually right', disabled: g.res.money < 12, fn: () => { C.investigate(spy); } }] });
    return null; } });
  // The village teacher asks for school supplies: a small act of goodwill.
  def({ id: 'teacher', cat: 'social', t: 1, cd: 40, layer: 3, w: (g) => 1.2, run: (g) => card({ title: 'The teacher of Palmarito', icon: '📚', body: 'The village teacher asks for paper, pencils and a map. "Half my pupils cannot read. Give them a reason to."', choices: [{ label: 'Give paper and pencils (6 pesos)', disabled: g.res.money < 6, fn: () => { g.res.money -= 6; memoryAll('palmarito', { type: 'aid', perpSide: 'rebel', positive: true, text: 'Rebels supplied the school', memText: 'Rebels supplied our school' }, 1, 46, 0.9); C.deed(1, 7); } }, { label: 'Not now', fn: () => { } }] }) });
  // Women ask to fight. Choices: form a women's platoon (armed from the armory — rifles are scarce), use them as couriers/nurses/scouts, or decline. Each moves women's and traditionalists' support differently.
  def({ id: 'women_volunteers', cat: 'social', t: 3, cd: 60, layer: 4, w: (g) => g.day > 60 ? 1.8 : 0, run: (g) => {
    const wmn = localPeople('sierra', (p) => p.sex === 'F' && C.ageOf(p) > 16 && C.ageOf(p) < 36).slice(0, 5).concat(localPeople('palmarito', (p) => p.sex === 'F' && C.ageOf(p) > 16 && C.ageOf(p) < 36).slice(0, 3));
    if (wmn.length < 3) return null; const names = wmn.slice(0, 3).map(C.tagName).join(', ');
    return card({ title: 'Women ask to fight', icon: '👩', body: `${names} and others come to the camp: "We cook, we carry messages, we hide your men. Let us carry rifles." Some of your men grumble. In the villages, the older women are watching; so are the priests.\n\n(Historically the Mariana Grajales Women's Platoon was formed in September 1958, commanded by Isabel Rielo and Teté Puebla.)`, choices: [
      { label: 'Form a women\'s platoon and arm them from the armory', sub: `Spare rifles: ${g.res.guns}. Women strongly approve; some men and traditionalists resist. Guns are limited — arming novices over veterans will divide the rebels.`, fn: () => { C.deed(6, 30); for (const p of wmn) C.recruit(p, 3); for (const p of C.W.people) { if (p.status !== 'alive') continue; if (p.sex === 'F') p.trueStance += 3; else if (p.fac === 'church' || (p.iss[6] < -0.2 && p.sal.includes(6))) p.trueStance -= 3.5; } g.flags.womenPlatoon = true; C.log('The women\'s platoon is formed' + (g.res.guns <= 0 ? ' — most of them with machetes, for lack of rifles.' : '.'), 'good'); } },
      { label: 'Use them as couriers, nurses and scouts', sub: 'Safer politically; still valuable (and women attract less suspicion in towns)', fn: () => { C.deed(6, 12); for (const p of wmn) { C.recruit(p, 3); p.covert = true; } } },
      { label: 'Decline', sub: 'The old order holds', fn: () => { C.deed(6, -6); for (const p of C.W.people) if (p.sex === 'F' && p.status === 'alive' && p.sal.includes(6)) p.trueStance -= 2; } },
    ] }); } });
  // Delegates of a Sociedad de Color ask what you will change; sets the race plank's deeds.
  def({ id: 'racial_clubs', cat: 'social', t: 2, cd: 50, layer: 4, w: (g) => g.day > 90 ? 1.2 : 0, run: (g) => card({ title: 'Black Cubans ask what you will change', icon: '✊', body: 'Delegates from a Sociedad de Color in Santiago ask you straight: "The beaches, the clubs and the best jobs are closed to us. Almeida is a commander, but who else will you promote? Which clubs will you open?"', choices: [
    { label: 'Pledge full integration and promotion on merit', sub: 'Afro-Cuban communities rally; segregationist clubs and some elites are alarmed', fn: () => { C.deed(7, 30); g.platform.declared[7] || C.declarePlank(7, 2); for (const p of C.W.people) { if (p.status !== 'alive') continue; if (p.eth === 'negra' || p.eth === 'mulata') p.trueStance += 4; else if (p.fac === 'elite' || p.fac === 'landowners') p.trueStance -= 2.5; } } },
    { label: 'End formal segregation, move gradually', sub: 'Welcome but cautious', fn: () => { C.deed(7, 14); for (const p of C.W.people) if ((p.eth === 'negra' || p.eth === 'mulata') && p.status === 'alive') p.trueStance += 1.5; } },
    { label: 'Say the war comes first', sub: 'Many will remember', fn: () => { C.deed(7, -8); for (const p of C.W.people) if ((p.eth === 'negra' || p.eth === 'mulata') && p.status === 'alive') p.trueStance -= 2; } },
  ] }) });
  // Students want to march in Santiago; fund and endorse it (police crackdown possible) or advise caution.
  def({ id: 'students_march', cat: 'social', t: 3, cd: 24, layer: 5, w: (g) => g.unlocked.layer >= 5 ? 2 : 0, run: (g) => card({ title: 'Students want to march in Santiago', icon: '📣', body: 'A student cell from the Universidad de Oriente plans a march for the dead of last month. They need pamphlets, bail money, and someone with weight to endorse it. Police will be waiting.', choices: [
    { label: 'Fund and endorse the march (25 pesos, 5 pamphlets)', sub: 'Student and worker hope up; police crackdown possible', disabled: g.res.money < 25, fn: () => { g.res.money -= 25; g.res.pamph = Math.max(0, g.res.pamph - 5); g.strikePrep += 8; g.regime.heat += 3; g.regime.legit -= 1.2; memoryAll('santiago', { type: 'march', perpSide: 'rebel', positive: true, text: 'Students marched in Santiago with rebel support', memText: 'The students marched; the rebels backed them' }, 1, 44, 1); for (const p of C.W.people) if (p.fac === 'students' && p.status === 'alive') p.trueStance += 3; if (rnd() < 0.5) { const arrested = localPeople('santiago', (p) => p.fac === 'students' && C.ageOf(p) < 25)[0]; if (arrested) { arrested.status = 'jailed'; C.addEvent({ type: 'arrest', victim: arrested, perpSide: 'army', sev: 62, pub: 0.7, x: 0, y: 0, settlement: 'santiago', text: `Police beat and arrest students in Santiago`, memText: 'Police arrested and beat our child', headline: 'Police beat marching students in Santiago' }); } } C.deed(4, 6); } },
    { label: 'Advise caution — the time is not right', sub: 'Students are disappointed', fn: () => { for (const p of C.W.people) if (p.fac === 'students' && p.status === 'alive') p.trueStance -= 1.5; } },
  ] }) });
  // Sugar-mill and dock workers ask if you will back a work stoppage; builds strike readiness.
  def({ id: 'union_call', cat: 'social', t: 3, cd: 30, layer: 5, w: (g) => g.unlocked.layer >= 5 ? 1.6 : 0, run: (g) => card({ title: 'The union locals ask: are we in?', icon: '🏭', body: 'Sugar mill delegates and dockworkers want to know if you will back a work stoppage. The CTC leadership is bought by Batista; the communists (PSP) are cautious. Rank-and-file are ready, if someone will feed their families through a strike.', choices: [
    { label: 'Back a slowdown and set up a strike fund (40 pesos)', disabled: g.res.money < 40, sub: 'Builds strike readiness', fn: () => { g.res.money -= 40; g.strikePrep += 12; C.deed(3, 4); C.deed(1, 3); for (const p of C.W.people) if (p.fac === 'workers' && p.status === 'alive') { p.trueStance += 2.2; p.needs.hope += 4; } } },
    { label: 'Ask them to wait for the right moment', fn: () => { g.strikePrep += 2; } },
  ] }) });

  // personal
  // Che offers a clinic for a village (costs medicine, earns long-lasting goodwill).
  def({ id: 'che_medic', cat: 'personal', t: 2, cd: 18, layer: 2, w: (g) => g.res.med > 2 && C.W.roster.che.status === 'alive' ? 1.8 : 0, run: (g) => {
    const sid = pick(['palmarito', 'cayo']);
    return card({ title: 'Che offers to hold a clinic', icon: '🩺', body: `The doctor of the expedition offers to spend a day treating ${S(sid).name}'s sick: infections, parasites, bad teeth. "A rifle wins a skirmish. A clinic wins a village." It will cost 3 medicine.`, choices: [{ label: 'Yes — hold the clinic', disabled: g.res.med < 3, fn: () => { g.res.med -= 3; memoryAll(sid, { type: 'aid', perpSide: 'rebel', positive: true, text: 'The rebel doctor ran a free clinic', memText: 'The rebel doctor treated us for free' }, 1, 66, 1); C.deed(1, 12); for (const p of localPeople(sid)) p.health = clamp(p.health + 8, 0, 100); } }, { label: 'Not now', fn: () => { } }] }); } });
  // El Viejo tells a story (flavour and hints).
  def({ id: 'viejo_story', cat: 'rest', t: 1, cd: 9, layer: 1, w: (g) => 1, run: (g) => { C.viejoSays(C.viejoVoice('story')); return null; } });
  // The communists (PSP) offer an alliance; trades strike readiness and union loyalty for Church, elite and US support.
  def({ id: 'psp_offer', cat: 'social', t: 3, cd: 80, layer: 5, w: (g) => g.day > 120 ? 1.4 : 0, run: (g) => card({ title: 'The communists offer an alliance', icon: '☭', body: 'Delegates of the Partido Socialista Popular — disciplined, organized in every union local, and until now skeptical of your "adventure" — offer their network: strike committees, safe houses, and a press. They want guarantees on labour rights and no quarrel with the Soviet Union. The Church, the United States and many elites will not like it.', choices: [
    { label: 'Accept a working alliance', sub: 'Strike readiness and union loyalty jump. Elites, Church and US support slip.', fn: () => { g.strikePrep += 18; C.deed(3, 8); g.flags.psp = true; for (const p of C.W.people) { if (p.status !== 'alive') continue; if (p.fac === 'workers') p.trueStance += 3.5; else if (p.fac === 'elite' || p.fac === 'church' || p.fac === 'landowners') p.trueStance -= 3; } g.trust.church = clamp(g.trust.church - 0.07, 0.02, 1); g.trust.elite = clamp(g.trust.elite - 0.07, 0.02, 1); g.regime.usSupport = clamp(g.regime.usSupport - 2, 0, 100); } },
    { label: 'Cooperate on specific actions only', sub: 'A small, deniable benefit', fn: () => { g.strikePrep += 6; } },
    { label: 'Decline', sub: 'Keep your freedom of action', fn: () => { for (const p of C.W.people) if (p.fac === 'workers' && p.status === 'alive' && p.sal.includes(3)) p.trueStance -= 1; } },
  ] }) });
  // In Havana, a salon of donors: a chance to raise money (and strings).
  def({ id: 'havana_salon', cat: 'social', t: 3, cd: 18, layer: 3, w: (g) => g.scene.sid === 'habana' ? 6 : 0, run: (g) => {
    const don = ['larrea', 'mercedes', 'quesada'].map((k) => C.W.roster[k]).filter((p) => p.status === 'alive');
    const hostess = C.W.roster.mercedes;
    return card({ title: 'A salon in the Vedado', icon: '🥂', body: `${C.tagName(hostess)} has invited a few families of means to her house for an evening of guitar and conversation. A rum merchant, a lawyer for political prisoners, and several wives who run the family purse. A man at the back who talks to nobody is certainly SIM. A woman can circulate here without drawing a glance; a bearded man in a borrowed jacket cannot.`, choices: [
      { label: 'Speak of the nation, and of the dead of Santiago', sub: 'Honest and moving. Good with the middle class.', fn: () => { const m = Math.round(70 + rnd() * 140); g.pipe.balance += m; for (const p of C.W.people) if (p.settlement === 'habana' && p.status === 'alive' && (p.fac === 'middle' || p.fac === 'elite') && rnd() < 0.3) p.trueStance += 2; if (rnd() < 0.25) { g.player.susp = (g.player.susp || 0) + 30; C.log('The man at the back wrote something down.', 'warn'); } C.log(`The salon passes the hat: ${m} pesos for the pipeline.`, 'good'); } },
      { label: 'Speak of property, order and the 1940 Constitution', sub: 'Reassures merchants; commits you to a moderate line', fn: () => { const m = Math.round(120 + rnd() * 200); g.pipe.balance += m; C.declarePlank(3, 1, 1); C.declarePlank(4, 2, 2); g.trust.elite = clamp(g.trust.elite + 0.08, 0, 1); C.log(`The merchants open their purses: ${m} pesos.`, 'good'); } },
      { label: 'Say nothing but listen; take names of who might help', sub: 'No money tonight; safer; builds contacts for later pitches', fn: () => { for (const p of don) p.donorCd = 0; g.strikePrep += 1; g.regime.heat -= 1; } },
      { label: 'Slip away: the man at the back is looking at you', sub: 'Safety first', fn: () => { g.player.susp = 0; } },
    ] }); } });
  // The SIM (secret police) closes in on your Havana network; choose to bluff, flee or sacrifice.
  def({ id: 'sim_net', cat: 'pressure', t: 4, cd: 14, layer: 3, w: (g) => g.scene.sid === 'habana' || g.scene.sid === 'santiago' ? (g.regime.heat > 20 ? 3 : 0.8) : 0, run: (g) => {
    const cell = C.squadPeople().find((p) => p.covert || p.sex === 'F'); const nm = cell ? C.tagName(cell) : 'a courier';
    return card({ title: 'The SIM is closing in', icon: '🕴', body: `A friendly clerk at the telephone exchange warns that plainclothes police have been asking about ${nm}'s block. A safehouse may be compromised.`, choices: [
      { label: 'Move everyone out tonight (costs 30 pesos)', disabled: g.res.money < 30, sub: 'Safe', fn: () => { g.res.money -= 30; g.regime.heat -= 3; } },
      { label: 'Stay and bluff — change habits, burn papers', sub: 'Cheap. A 35% chance of arrests.', fn: () => { if (rnd() < 0.35 && cell) { cell.status = 'jailed'; C.addEvent({ type: 'arrest', victim: cell, perpSide: 'army', sev: 62, pub: 0.5, x: 0, y: 0, settlement: cell.settlement, text: `${nm} arrested by the SIM`, memText: `${nm} was arrested by the SIM`, headline: `SIM arrests suspected subversive: ${nm}` }); for (const sq of g.squads) sq.members = sq.members.filter((id) => id !== cell.id); } } },
    ] }); } });
  // Mail call: letters drawn from each soldier's actual family graph — morale and stories.
  def({ id: 'letters_home', cat: 'personal', t: 2, cd: 20, layer: 3, w: (g) => squadPeople().length >= 4 ? 1.6 : 0, run: (g) => {
    const ps = squadPeople().filter((p) => !p.roster && C.kinOf(p).size > 2); if (ps.length < 2) return null;
    const lines = []; let morale = 0;
    for (let i = 0; i < 3 && ps.length; i++) {
      const p = ps.splice((rnd() * ps.length) | 0, 1)[0]; const kin = [...C.kinOf(p).entries()].filter(([, v]) => v.w >= 0.5).map(([id]) => C.P(id)).filter((q) => q.status !== 'dead'); if (!kin.length) continue; const q = kin[(rnd() * kin.length) | 0];
      let msg, d;
      if (q.status === 'jailed') { msg = `writes from visiting hour: ${C.tagName(q)} is still in prison; the family manages.`; d = -4; }
      else if (q.needs.food < 32) { msg = `says ${C.tagName(q)} and the children are hungry this dead season.`; d = -5; }
      else if (q.trueStance > 35) { msg = `says ${C.tagName(q)} is proud and tells the neighbours.`; d = 6; }
      else if (q.trueStance < -35) { msg = `writes that ${C.tagName(q)} says you are throwing your life away.`; d = -3; }
      else { msg = `sends news of ${C.tagName(q)} and the harvest. All well.`; d = 2; }
      const rel = C.relLabelEs[C.relativeLabel(p, q)] || 'a relative'; lines.push(`${C.tagName(p)}'s ${rel} ${msg}`); morale += d; p.morale = clamp(p.morale + d, 0, 100);
    }
    if (!lines.length) return null;
    return card({ title: 'Mail call', icon: '✉', body: 'A courier brings letters to the camp. Some are read quietly; some aloud.\n\n' + lines.join('\n'), choices: [
      { label: 'Read the good ones aloud at the fire', sub: 'Morale up a little', fn: () => { for (const p of squadPeople()) p.morale = clamp(p.morale + 3, 0, 100); } },
      { label: 'Let each keep their own', fn: () => { } },
    ] }); } });
  // Lieutenants emerge: promote someone, with consequences for the rest.
  def({ id: 'lieutenants', cat: 'personal', t: 3, cd: 40, layer: 4, w: (g) => g.stats.killedArmy > 2 ? 1.6 : 0.2, run: (g) => card({ title: 'Your lieutenants disagree', icon: '🗣', body: 'Che argues that the prisoners must be tried and the guilty shot: "Revolution without justice is tourism." Almeida, who knows what soldiers are, says to let the conscripts go with their boots and a lesson. Raúl says: "Decide, and be consistent."', choices: [
    { label: 'Free conscripts unharmed; try only the guilty', sub: 'Harms the army\'s will to fight. Costs nothing.', fn: () => { C.setJusticePolicy('mercy'); } },
    { label: 'Try and shoot officers and informers', sub: 'Frightens waverers; costs you with elites and the Church', fn: () => { C.setJusticePolicy('tribunal'); } },
    { label: 'Keep each case separate', fn: () => { C.setJusticePolicy('case'); } },
  ] }) });

  // lifelines
  // Lifeline: a shopkeeper offers credit when you are short of food.
  def({ id: 'bodeguero_credit', cat: 'lifeline', t: 1, cd: 15, layer: 2, w: (g) => g.res.food < 8 ? 3 : 0, run: (g) => { const s2 = randomLocal('palmarito', (p) => p.occ === 'bodeguero'); const nm = s2 ? C.tagName(s2) : 'The bodeguero'; return card({ title: `${nm} offers credit`, icon: '🏪', body: `${nm} runs the bodega at Palmarito. "I don't care who wins. I care who pays. Take what you need and settle in a month, and I'll write it in the book."`, choices: [{ label: 'Accept 24 food on a vale (owed 8 pesos in 30 days)', fn: () => { g.res.food += 24; g.res.vales += 8; if (s2) g.promises.push({ kind: 'vale', day: g.day, due: g.day + 30, amount: 8, who: s2.id, paid: false }); } }, { label: 'Refuse', fn: () => { } }] }); } });
  // Lifeline: a guard defects when the army's morale is low (more often with a merciful policy).
  def({ id: 'guard_defects', cat: 'lifeline', t: 2, cd: 25, layer: 2, w: (g) => g.regime.armyMorale < 62 ? 2.2 : 0, run: (g) => { const sd = C.W.people.find((p) => p.mil && p.mil.side === 'army' && p.status === 'alive' && !p.roster && (p.settlement === 'sierra' || p.settlement === 'palmarito')); if (!sd) return null; return card({ title: `${C.tagName(sd)} comes over`, icon: '🏳', body: `${C.tagName(sd)}, a guardia from ${C.SETTLEMENTS[sd.settlement].name}, walks into the camp at dawn with his rifle and two bandoliers. "My mother's sick and nobody pays us. I don't want to die for Batista."`, choices: [{ label: 'Welcome him', sub: 'He keeps his rifle. He knows the post.', fn: () => { g.res.ammo += 24; C.recruit(sd, 0, 'Springfield'); g.regime.armyMorale -= 1; } }, { label: 'Send him home', fn: () => { sd.mil = null; } }] }); } });
  // Lifeline: bad weather keeps the army out of the hills.
  def({ id: 'storm', cat: 'lifeline', t: 1, cd: 18, layer: 1, w: (g) => g.regime.heat > 35 ? 2 : 0.3, run: (g) => { g.weather.target = 1; g.weather.t = 1; g.regime.heat = clamp(g.regime.heat - 12, 0, 100); C.log('A storm rolls in off the sea. The army will not move tonight.', 'good'); C.viejoSays('Rain! The mountain is on our side tonight.'); return null; } });
  // Lifeline: a sympathiser donates supplies.
  def({ id: 'donation', cat: 'lifeline', t: 1, cd: 18, layer: 3, w: (g) => g.supportMean > 0 && (g.res.food < 15 || g.res.med < 2) ? 2.2 : 0.4, run: (g) => { const r = rnd(); const f = Math.round(10 + rnd() * 14); g.res.food += f; if (r < 0.4) g.res.med += 2; C.log(`Sympathizers leave ${f} food${r < 0.4 ? ' and some medicine' : ''} at the edge of camp.`, 'good'); return null; } });
  // Lifeline: a village hides your wounded men.
  def({ id: 'hidden_wounded', cat: 'lifeline', t: 1, cd: 25, layer: 3, w: (g) => squadPeople().some((p) => p.hp < p.maxHp * 0.6) ? 2.2 : 0, run: (g) => { for (const p of squadPeople()) { p.hp = Math.min(p.maxHp, p.hp + 20); p.bleed = 0; } C.log('A midwife and the parish sacristan shelter and dress your wounded.', 'good'); return null; } });
  // Rest: a rainy day; everyone slows down; a quiet day.
  def({ id: 'rain_day', cat: 'rest', t: 1, cd: 7, layer: 1, w: (g) => 1.1, run: (g) => { g.weather.target = 0.9; g.weather.t = 1; C.log('Heavy rain. Trails turn to mud; patrols stay home.', 'info'); return null; } });

  // Make a local landowner (and his friends) angry: publishes a negative event.
  function landOwnersAngry(sid, sev, text) { const lo = localPeople(sid, (p) => p.fac === 'landowners')[0] || randomLocal('palmarito', (p) => p.fac === 'landowners'); if (lo) C.addEvent({ type: 'intimidation', victim: lo, perpSide: 'rebel', val: -1, sev, pub: 0.4, x: 0, y: 0, settlement: lo.settlement, text, memText: 'Rebels threatened landowners' }); for (const p of C.W.people) if (p.fac === 'landowners' && p.status === 'alive') p.trueStance -= 2; }
  // Is there an unrevealed informer near the camp or among the garrison?
  function hasInformant() { const g = G(); return C.W.people.find((p) => p.informant && !p.revealed && p.status === 'alive' && (p.settlement === 'sierra' || (p.mil && p.mil.side === 'rebel'))); }

  // Set the standing justice policy (mercy for conscripts / case by case / revolutionary tribunals) and declare the matching plank.
  C.setJusticePolicy = function (m) {
    const g = G(); g.policy.justice = m;
    if (m === 'mercy') { C.declarePlank(5, 0, 0); } else if (m === 'tribunal') { C.declarePlank(5, 2, 2); }
    C.log('Justice policy: ' + (m === 'mercy' ? 'mercy for conscripts' : m === 'tribunal' ? 'revolutionary tribunals' : 'case by case'), 'info');
  };

  // Recruit a person to the rebels: status, rank, squad (the smallest), experience boost, high morale; arms them from the armory (rifles are scarce: others may resent it) or a machete; brings them into the scene if the player is in the Sierra.
  C.recruit = function (p, expBoost, wpn) {
    const g = G(); if (p.status !== 'alive' && p.status !== 'away') return;
    p.status = 'alive'; p.mil = { side: 'rebel', rank: 'Soldado', squad: -1 }; p.side = 'rebel'; p.settlement !== 'sierra' && C.moveTo(p, 'sierra'); p.exp = Math.max(p.exp, expBoost || 0);
    p.morale = 70; p.stateRecruit = g.day; p.trueStance = Math.max(p.trueStance, 55); p.stance = p.trueStance; p.conv = Math.max(p.conv, 45);
    p.look.sw = Math.min(1.08, p.look.sw);
    let best = g.squads[0]; for (const sq of g.squads) if (sq.members.length < best.members.length) best = sq;
    best.members.push(p.id); p.mil.squad = best.id; g.stats.hired++;
    if (wpn) p.wpn = 'rifle'; else if (g.res.guns > 0) { g.res.guns--; p.wpn = 'rifle'; C.resentment(p); } else p.wpn = 'machete';
    C.log(`${C.tagName(p)} joins the rebels (${best.name}).`, 'good');
    if (p.actor && p.actor.scene) { p.actor.gone = true; p.actor = null; }
    if (g.scene && g.scene.sid === 'sierra') C.joinPlayerScene(p, best.id);
  };

  // A card is the decision UI object {title, icon, body, choices:[{label, sub, disabled, fn}]}.
  // ---------- card helper ----------
  function card(c) { c.id = c.id || ('c' + rnd()); return c; }

  // EL VIEJO (Don Anselmo), the in-world adviser: stories, informer hints, and contextual advice computed from the current state (hunger, ammunition, morale, fear, discipline, leaks, money, the manifesto, camouflage, colour).
  // ---------- lines of El Viejo ----------
  // Say something in El Viejo's voice: logged and shown as a toast.
  C.viejoSays = function (text) { const g = G(); if (!g) return; g.viejoLast = { day: g.day, text }; C.log('El Viejo: "' + text + '"', 'warn'); if (C.ui && C.ui.viejoToast) C.ui.viejoToast(text); };
  // A line by kind ('story', 'informant').
  C.viejoVoice = function (kind) {
    const g = G();
    const stories = [
      'In \'95 we ate boiled hide and called it a feast. The Spanish had cannon; we had the mountain. A man who knows where the water is will beat a man who knows only where the road is.',
      'You ask the men to be soldiers. Remember that every soldier of theirs is some mother\'s boy. Kill one, and a whole street learns your name — and not kindly.',
      'A peasant gives food to whoever looks like they will still be here after the harvest. Pay him, and he will hide you under his bed.',
      'There is a saying: the army walks in boots and leaves its tracks; the guerrilla walks in sandals and leaves a rumour.',
      'Hungry men do foolish things. Fed men do cruel things when they are afraid. Be the one who is neither.',
      'I buried my brother in this hill. Do not make me bury your promises beside him.',
      'The priest, the teacher and the bodeguero know every family in a hundred caballerías. Win one of them and you have the map.',
    ];
    if (kind === 'story') return pick(stories);
    if (kind === 'informant') return pick(['Have you noticed how the army always knows which trail we take?', 'In \'95 we had a man like that. His pockets had silver in them.']);
    return pick(stories);
  };
  // contextual advice
  // The tips shown in the journal: only the ones that apply now.
  C.viejoAdvice = function () {
    const g = G(), V = C.story.vars, tips = [];
    const ps = squadPeople();
    if (V.hunger > 55) tips.push(['Hunger', 'Your men are hungry, and hungry men disobey. Buy food in the villages (set Forage to PAY), or accept a vale. Taking it from the poor costs you more than it feeds you.']);
    if (g.res.ammo < ps.length * 3) tips.push(['Ammunition', 'You are short of cartridges. The best source is the army: wounded men and surrendered men give up their rifles. Do not kill everyone — a surrendered soldier is worth a rifle and a story.']);
    if (V.morale < 40) tips.push(['Morale', 'The boys are low. Fiestas, letters, a fire, a good meal. Win a small fight. Keep promises you make to them.']);
    if (g.rep.fear > 55) tips.push(['Fear', 'People are afraid of you. Fear gets quick obedience, and quick betrayal. The towns and the Church will not forgive it.']);
    if (g.rep.discipline < 35) tips.push(['Discipline', 'Your men have been getting away with things. Punish an offender where the village can see it, or the village will punish you.']);
    if (hasInformant()) tips.push(['A leak', 'Someone near the camp is talking to the Guardia. Look for the tells in his file (click him), or pay the network to check.']);
    if (g.res.money < 20) tips.push(['Money', 'Pesos come from Havana, from the merchants and the students. Find a donor and a courier. A woman travelling in a good dress is stopped less often than a man.']);
    if (!g.platform.declared.some((d) => d)) tips.push(['Your program', 'People do not know what you want. Tell them: open the Manifesto (P). Then keep the promises — they will count the days.']);
    if (g.unlocked.layer < 6 && g.day > 90) tips.push(['Beyond the Sierra', 'The island is bigger than this mountain. The cities have money and students; the unions have strikes. Take the road when you are ready.']);
    tips.push(['Camouflage', 'Peasants melt into the forest, townsmen into the crowd. Stand still, crouch (C), and let the mountain do the work. Experience makes it better.']);
    tips.push(['Colour', 'Red cubes are yours, blue are Batista\'s, white are undecided. Pale means weakly held. Click a person: see why they feel as they do, and who their family is.']);
    return tips;
  };

  // Spawn a patrol at a scene exit heading toward the player's neighbourhood.
  // ---------- spawn army patrols (for events) ----------
  // (see above)
  C.spawnPatrol = function (s, n, label) {
    const exits = s.exits.filter((e) => !e.scripted); const e = exits.length ? exits[(rnd() * exits.length) | 0] : { x: 2, y: 2, w: 3, h: 3 };
    const tgt = G().player;
    for (let i = 0; i < n; i++) {
      const a = C.armyActor(s, (e.x + e.w / 2) * C.T + (rnd() - 0.5) * 30, (e.y + e.h / 2) * C.T + (rnd() - 0.5) * 20, i % 5 === 0 ? 'thompson' : pick(['garand', 'rifle', 'rifle']), 'investigate');
      a.brain.lastX = tgt.x + (rnd() - 0.5) * 200; a.brain.lastY = tgt.y + (rnd() - 0.5) * 200; a.brain.moveT = 0;
    }
    C.log(`${label || 'Army patrol'} (${n} men) enters the area.`, 'warn');
  };

  // SELECTION: gather candidate events that are off cooldown and unlocked; weight them by their own w(g), push pressure up when tension is below target and relief when above, make lifelines appear only when the spiral sensor is high, and mirror themes (a fear-ruled player meets informants; a merciful one meets defectors).
  // ---------- storyteller selection ----------
  // (see above)
  C.story.pickEvent = function () {
    const g = G(), V = C.story.vars; C.story.update();
    const cands = [];
    const wantRelief = V.tension > V.target + 8, wantPressure = V.tension < V.target - 8;
    for (const ev of E) {
      if (!ready(ev.id, ev.cd) || (ev.layer || 1) > g.unlocked.layer) continue;
      let w = ev.w(g); if (w <= 0) continue;
      if (ev.cat === 'lifeline') { if (V.spiral < 0.35) continue; w *= 1 + V.spiral * 4; }
      else if (ev.cat === 'pressure') { if (V.spiral > 0.6) w *= 0.25; if (wantRelief) w *= 0.3; if (wantPressure) w *= 1.8; if (ev.t >= 4 && V.intensity7 > 7) w *= 0.2; }
      else if (wantRelief && (ev.cat === 'rest' || ev.cat === 'social' || ev.cat === 'personal')) w *= 2;
      if (g.scene.sid === 'alegria') w = 0;
      // thematic mirror: fear-ruled players meet informants; merciful ones meet defectors
      if (ev.id === 'informant_hint' && g.rep.fear > 40) w *= 1.8;
      if (ev.id === 'guard_defects' && g.policy.justice === 'mercy') w *= 2;
      cands.push([ev, w]);
    }
    if (!cands.length) return null;
    let tot = 0; for (const c of cands) tot += c[1]; let r = rnd() * tot;
    for (const c of cands) { r -= c[1]; if (r <= 0) return c[0]; }
    return cands[0][0];
  };
  // Each day: update the director, fire any due historical anchor, and — at most once a day and not every day — pick and run an event.
  C.story.daily = function () {
    const g = G(); if (g.over) return;
    C.story.update();
    checkAnchors();
    if (g.pendingCard || g.modalOpen) return;
    // at most one non-anchor event a day, and not every day
    const V = C.story.vars; const quiet = g.day - (C.story.lastAny === undefined ? -9 : C.story.lastAny); const chance = (0.6 + (V.spiral > 0.5 ? 0.3 : 0)) + (quiet >= 3 ? 1 : 0);
    if (g.day < 1 || g.scene.sid === 'alegria' || rnd() > chance) return;
    const ev = C.story.pickEvent(); if (!ev) return;
    C.story.last[ev.id] = g.day; C.story.lastAny = g.day; C.story.noteEvent(ev.t);
    const res = ev.run(g);
    if (res) { if (res.onShow) res.onShow(); C.ui.card(res); }
  };

  // ANCHORS: the historical beats, each with a date and a condition on what you did (La Plata, Eutimio, Matthews, the Palace attack, El Uvero, Frank País, Radio Rebelde, the embargo, the April strike, Operation Verano, the Pact of Caracas, the columns, Santa Clara, New Year). They are conditional: skipped if the condition fails for 40 days.
  // ---------- anchors: the historical beats (conditional on what you did) ----------
  // The anchors list (also exposed as C.story.anchors).
  const A = [];
  // Shorthand for turning a date into a game day.
  const D = C.dayOfDate;
  // Register an anchor.
  const anchor = (o) => A.push(o);

  // 8 Dec 1956 — the survivors regroup in the Sierra; counts who found their way back, offers the first mission.
  anchor({ id: 'regroup', day: 8, run: (g) => {
    const missing = C.ROSTER.filter((r) => r.at === 'party').map((r) => C.W.roster[r.id]).filter((p) => p.status === 'alive' && p.mil && !p.actor || p.status === 'away').slice(0, 4);
    const lost = g.flags.leftBehind || [];
    const back = lost.filter((id) => C.P(id).status === 'alive' || C.P(id).status === 'away').filter(() => rnd() < 0.6);
    for (const id of back) { const p = C.P(id); p.status = 'alive'; C.recruit(p); }
    return card({ title: 'Cinco Palmas: the survivors regroup', icon: '🌴', body: `Two weeks after the landing, scattered survivors trickle in through peasant guides. ${back.length ? back.map((id) => C.tagName(C.P(id))).join(', ') + ' find their way to you.' : 'No one else comes.'}\n\nThe peasants who hid you, fed you and guided you did it at their own risk. They will remember how you treat them.`, choices: [{ label: 'Take stock of the men and the mountain', fn: () => { g.unlocked.layer = Math.max(g.unlocked.layer, 3); } }] }); } });
  // 15 Jan 1957 — intelligence on the La Plata outpost; the first real attack (played or resolved).
  anchor({ id: 'laplata', day: D(1957, 1, 15), run: (g) => card({ title: 'Intel on the La Plata outpost', icon: '🏴', body: 'A guide reports the army post near the mouth of the river has only a dozen guards and sleeps carelessly. A victory would arm your men, show the island you live, and bring the army down on you. Historically, the rebels attacked this post on 17 January 1957 and won their first battle.', choices: [
    { label: 'Attack it yourself (play the fight)', sub: 'The post is in the Sierra, northwest of camp. Take its weapons and medicine.', fn: () => { g.flags.laPlata = true; g.mission = { text: 'Take the army outpost (northwest). Capture the arms. Decide what to do with prisoners.', done: false, kind: 'outpost' }; C.log('Mission: take the army outpost in the Sierra.', 'warn'); } },
    { label: 'Not yet — we are too few', fn: () => { } },
  ] }) });
  // 8 Feb 1957 — the guide Eutimio Guerra is the historical informer; you may spot him first.
  anchor({ id: 'eutimio', day: D(1957, 2, 8), cond: (g) => !C.W.roster.eutimio.revealed && C.W.roster.eutimio.status === 'alive', run: (g) => {
    const eu = C.W.roster.eutimio;
    if (eu.mil && eu.mil.side === 'rebel') {
      return card({ title: 'Altos de Espinosa', icon: '🪖', body: 'At dawn the camp is surrounded by soldiers who knew exactly where it was. Only luck and the jungle save you. Eutimio Guerra, the guide who joined you, slipped away the night before. Historically, he had been paid by the army, and was later confronted and executed.', choices: [{ label: 'He is gone. Tighten security.', fn: () => { C.adjustRep('discipline', 4); g.flags.eutimioGone = true; eu.mil = null; eu.status = 'away'; for (const sq of g.squads) sq.members = sq.members.filter((id) => id !== eu.id); if (g.scene.sid === 'sierra') { C.spawnPatrol(g.scene, 8, 'Columna del Ejército'); g.regime.heat += 5; } } }] });
    }
    return null; } });
  // 17 Feb 1957 — the New York Times reporter Herbert Matthews climbs the mountain: proof you are alive; a propaganda choice.
  anchor({ id: 'matthews', day: D(1957, 2, 17), run: (g) => card({ title: 'A journalist climbs the mountain', icon: '📰', body: 'Havana has announced that you are dead. A correspondent for The New York Times, Herbert Matthews, has been smuggled up by Celia Sánchez\'s network. You will have one afternoon to show your force to a skeptical foreign reporter (the same few men march past in circles).', choices: [
    { label: 'Present a movement of democrats and reformers', sub: 'Elites and the middle class relax. Radicals sneer.', fn: () => { g.regime.legit -= 4; g.regime.usSupport -= 4; C.declarePlank(4, 2, 1); for (const p of C.W.people) if (p.fac === 'elite' || p.fac === 'middle') p.trueStance += 3.5; g.res.money += 90; g.unlocked.layer = Math.max(g.unlocked.layer, 5); g.news.unshift({ day: g.day, text: 'NYT: Castro is alive, and fighting for democracy' }); C.log('The interview runs in the Times. Havana looks foolish.', 'good'); } },
    { label: 'Present a movement of the poor, for land and justice', sub: 'Peasants and students cheer. Landowners recoil.', fn: () => { g.regime.legit -= 4; C.declarePlank(0, 2, 2); for (const p of C.W.people) if (p.fac === 'peasants' || p.fac === 'students') p.trueStance += 3; for (const p of C.W.people) if (p.fac === 'landowners' || p.fac === 'elite') p.trueStance -= 2.5; g.unlocked.layer = Math.max(g.unlocked.layer, 5); g.news.unshift({ day: g.day, text: 'NYT: Rebel chief promises agrarian revolution' }); } },
    { label: 'Keep the message vague', sub: 'Safe. Less impact.', fn: () => { g.regime.legit -= 2; g.unlocked.layer = Math.max(g.unlocked.layer, 5); } },
  ] }) });
  // 13 Mar 1957 — the Directorio's attack on the Presidential Palace in Havana and its aftermath.
  anchor({ id: 'palace', day: D(1957, 3, 13), run: (g) => card({ title: 'The attack on the Presidential Palace', icon: '🏛', body: 'José Antonio Echeverría\'s Revolutionary Directorate plans to storm the Palace and kill Batista in a single stroke. You think it is brave and likely to fail. You can send some rifles. History: the attack failed with heavy losses; Echeverría was shot dead near the university.', choices: [
    { label: 'Send 20 cartridges and a message of support', disabled: g.res.ammo < 20, sub: 'Improves their odds slightly', fn: () => { g.res.ammo -= 20; g.flags.helpedDR = true; } },
    { label: 'Stay out', fn: () => { } },
  ], after: () => { const ech = C.W.roster.echeverria; const ok = g.flags.helpedDR && rnd() < 0.3; if (ok) { C.log('Against the odds, the Directorate takes the radio station and withdraws with few losses. Echeverría lives.', 'good'); g.regime.legit -= 6; } else { C.killOffscreen(ech, 'army', 'José Antonio Echeverría shot dead in Havana', 85); g.regime.heat += 6; g.regime.legit -= 3; for (const p of C.W.people) if (p.fac === 'students' && p.status === 'alive') { p.trueStance += 4; p.conv = clamp(p.conv + 6, 0, 100); } } } }) });
  // 28 May 1957 — El Uvero: the first set-piece victory (needs a column of at least 12).
  anchor({ id: 'uvero', day: D(1957, 5, 28), cond: (g) => squadPeople().length >= 12, run: (g) => card({ title: 'El Uvero', icon: '⚔', body: 'A coastal army post at El Uvero has about 50 soldiers. Attacking it in daylight is bold, costly, and would make you a force the army can no longer ignore. Historically, the rebels took the post on 28 May 1957 with heavy losses.', choices: [
    { label: 'Attack at dawn', sub: 'Needs a strong, fed force', fn: () => { const r = C.resolveBattle('El Uvero', 7); showBattle('El Uvero', r); } },
    { label: 'Decline', fn: () => { } },
  ] }) });
  // 20 Jul 1957 — Frank País is hunted in Santiago; his death costs the Llano network.
  anchor({ id: 'frank', day: D(1957, 7, 20), run: (g) => card({ title: 'Frank País is hunted in Santiago', icon: '🕯', body: 'The police are closing in on the young leader of the Santiago underground; his brothers have been killed. The Llano can hide him and move him — it will cost money and a covert operative. Historically he was shot in the street on 30 July 1957 and tens of thousands filled the funeral and a spontaneous strike followed.', choices: [
    { label: 'Pay for a safehouse and a courier network (60 pesos)', disabled: g.res.money < 60, sub: 'Might save him', fn: () => { g.res.money -= 60; g.flags.frankSafe = true; } },
    { label: 'Order him to leave Santiago', sub: 'He may refuse. The underground suffers.', fn: () => { g.flags.frankSafe = rnd() < 0.2; } },
    { label: 'Nothing to be done', fn: () => { } },
  ], after: () => { const f = C.W.roster.frank; if (g.flags.frankSafe && rnd() < 0.62) { C.log('Frank País slips out of Santiago in a laundry truck.', 'good'); } else { C.killOffscreen(f, 'army', 'Frank País shot dead by police in Santiago', 95); g.news.unshift({ day: g.day + 1, text: 'Santiago stops in mourning for Frank País' }); for (const p of C.W.people) if (p.settlement === 'santiago' && p.status === 'alive') { p.trueStance += 3; p.conv = clamp(p.conv + 3, 0, 100); } g.regime.legit -= 3; g.strikePrep += 5; } } }) });
  // 24 Feb 1958 — Radio Rebelde begins broadcasting (better if you built the radio).
  anchor({ id: 'radio', day: D(1958, 2, 24), run: (g) => card({ title: 'Radio Rebelde', icon: '📻', body: g.base.built.radiocamp ? 'Your camp radio goes on the air for the first time. A voice crackles across the island: "Aquí Radio Rebelde, transmitting from the Sierra Maestra, territory free of Cuba." The army will hunt the transmitter.' : 'In history, Radio Rebelde began broadcasting on 24 February 1958. You have no radio station built. Build one in your camp (B) and its voice can reach the whole island.', choices: [{ label: g.base.built.radiocamp ? 'Broadcast' : 'Understood', fn: () => { if (g.base.built.radiocamp) { g.flags.radio = true; g.regime.heat += 6; for (const p of C.W.people) if (p.status === 'alive') { p.needs.hope = clamp(p.needs.hope + 4, 0, 100); } } } }] }) });
  // 14 Mar 1958 — the US arms embargo on Batista: his support from Washington slips.
  anchor({ id: 'embargo', day: D(1958, 3, 14), run: (g) => { g.flags.embargo = true; g.regime.usSupport = clamp(g.regime.usSupport - 15, 0, 100); g.regime.armyMorale = clamp(g.regime.armyMorale - 4, 0, 100); return card({ title: 'The United States cuts off arms sales', icon: '🚫', body: 'Washington announces an embargo on arms sales to the Batista government. The army still has what it has, but spare parts and ammunition will dwindle. Its officers read the signal.', choices: [{ label: 'Press the advantage', fn: () => { } }] }); } });
  // 9 Apr 1958 — the general strike call; depends on your preparation (unions, students).
  anchor({ id: 'strike', day: D(1958, 4, 9), run: (g) => {
    const ready = g.strikePrep >= 55 && g.trust.workers > 0.45 && g.trust.students > 0.4;
    return card({ title: 'The general strike', icon: '✊', body: `A call goes out for a national general strike. ${ready ? 'Your preparation shows: unions, students and the Llano are ready, and the strike committees hold.' : 'Not enough has been prepared: the unions are divided, the communists were not consulted, and the police are waiting. History: the 9 April 1958 strike failed.'}`, choices: [{ label: 'See what happens', fn: () => {
      if (ready) { g.flags.strikeWon = true; g.regime.legit -= 14; g.regime.armyMorale -= 6; C.log('The strike holds. Havana shuts down.', 'good'); for (const p of C.W.people) if (p.fac === 'workers' || p.fac === 'students') { p.trueStance += 5; p.needs.hope = clamp(p.needs.hope + 12, 0, 100); } }
      else { g.regime.legit += 2; g.regime.heat += 8; for (const p of C.W.people) { if (p.fac === 'workers' && p.status === 'alive') { p.trueStance -= 4; p.needs.hope = clamp(p.needs.hope - 14, 0, 100); } if (p.fac === 'students' && p.status === 'alive') p.needs.safety -= 12; } C.log('The strike fails. Repression falls on the cities. The Llano is shaken.', 'bad'); g.rep.competence = clamp(g.rep.competence - 8, 0, 100); const h = C.W.roster.hart; if (h.status === 'alive' && rnd() < 0.5) { h.status = 'jailed'; C.log('Armando Hart is arrested.', 'bad'); } }
    } }] }); } });
  // 25 May 1958 — Operation Verano, the army's summer offensive into the Sierra.
  anchor({ id: 'verano', day: D(1958, 5, 25), run: (g) => { g.flags.verano = true; return card({ title: 'Operation Verano', icon: '💣', body: 'Batista throws ~10,000 men at the Sierra: columns from three sides, bombing, and a naval landing. Your force is a few hundred at most. For the next weeks the army will probe, burn farms, and bomb. Your edge is the mountain, the peasants, and your ability to refuse a pitched fight. The more civilians the army hurts, the weaker its hand will be.', choices: [{ label: 'We stay in the mountains', fn: () => { g.regime.heat = Math.max(g.regime.heat, 70); } }] }); } });
  // 8 Aug 1958 — the offensive collapses (or not), depending on whether you survived it intact.
  anchor({ id: 'veranoend', day: D(1958, 8, 8), run: (g) => { g.flags.verano = false; const ok = squadPeople().length >= 6; g.regime.armyMorale = clamp(g.regime.armyMorale - (ok ? 14 : 3), 0, 100); g.regime.legit = clamp(g.regime.legit - (ok ? 6 : 1), 0, 100); return card({ title: 'The offensive collapses', icon: '🏔', body: ok ? 'The army withdraws after heavy losses, dropping weapons and thousands of prisoners. Their will is broken; yours is not.' : 'Your force survives only as a shadow of itself. The army claims victory.', choices: [{ label: 'Continue', fn: () => { if (ok) { g.res.ammo += 150; g.res.med += 8; g.res.food += 40; for (const p of squadPeople()) { p.exp = clamp(p.exp + 4, 0, 100); p.morale = clamp(p.morale + 14, 0, 100); } } } }] }); } });
  // 4 Sep 1958 — the Mariana Grajales women's platoon was formed historically; offered if you did not do it yourself.
  anchor({ id: 'platoon', day: D(1958, 9, 4), cond: (g) => !g.flags.womenPlatoon && g.flags.platoonOffered !== true, run: (g) => { g.flags.platoonOffered = true; return card({ title: 'The Mariana Grajales Platoon', icon: '👩‍✈️', body: 'In September 1958 the Mariana Grajales women\'s platoon was formed in the Sierra: 13 women, led by Isabel Rielo with Teté Puebla second in command, who fought the army at the front. Here you can decide.', choices: [
    { label: 'Create the platoon and arm it', fn: () => { const rl = C.W.roster.rielo, tt = C.W.roster.tete; rl.status = 'alive'; tt.status = 'alive'; C.recruit(rl, 5); C.recruit(tt, 5); C.deed(6, 30); g.flags.womenPlatoon = true; for (const p of C.W.people) { if (p.status !== 'alive') continue; if (p.sex === 'F') p.trueStance += 2.5; } } },
    { label: 'Not now', fn: () => { C.deed(6, -4); } },
  ] }); } });
  // 20 Jul 1958 — the Pact of Caracas: opposition unity and who leads it.
  anchor({ id: 'caracas', day: D(1958, 7, 20), run: (g) => card({ title: 'The Pact of Caracas', icon: '🤝', body: 'Opposition parties, student groups and exiled politicians sign a unity pact in Caracas, recognizing a single leadership and a provisional civilian government. The price is some autonomy and a promise of elections. The reward is money, press, and respectability with the middle class and the Church.', choices: [
    { label: 'Sign the pact', sub: 'Middle class, elites and Church warm; radicals mutter', fn: () => { C.declarePlank(4, 2, 2); g.res.money += 120; g.trust.elite = clamp(g.trust.elite + 0.12, 0, 1); g.trust.middle = clamp(g.trust.middle + 0.1, 0, 1); g.trust.church = clamp(g.trust.church + 0.06, 0, 1); for (const p of C.W.people) { if (p.status !== 'alive') continue; if (p.fac === 'elite' || p.fac === 'middle') p.trueStance += 3; if (p.fac === 'students' && p.traits.includes('hothead')) p.trueStance -= 1; } g.flags.caracas = true; } },
    { label: 'Sign, but keep command of the armed forces', fn: () => { g.res.money += 60; g.trust.elite = clamp(g.trust.elite + 0.05, 0, 1); g.flags.caracas = 'partial'; } },
    { label: 'Refuse: the Sierra decides', sub: 'Keeps your hands free', fn: () => { g.trust.elite = clamp(g.trust.elite - 0.05, 0.02, 1); } },
  ] }) });
  // 30 Aug 1958 — Camilo and Che's columns march west.
  anchor({ id: 'columns', day: D(1958, 8, 30), run: (g) => card({ title: 'The columns to the west', icon: '🧭', body: 'Camilo Cienfuegos and Che Guevara can each lead a column of your best men westward to cut the island in two, as history. You will lose their strength here but force the army to spread thin.', choices: [
    { label: 'Send both columns', sub: 'Regime morale falls hard; your Sierra force shrinks', fn: () => { g.regime.armyMorale -= 10; g.regime.legit -= 6; g.flags.columns = true; for (const id of ['camilo', 'che']) { const p = C.W.roster[id]; if (p.status === 'alive') { for (const sq of g.squads) sq.members = sq.members.filter((m) => m !== p.id); p.mil = { side: 'rebel', rank: 'Comandante' }; p.settlement = 'sierra'; } } C.log('Columns set out across the plains.', 'good'); } },
    { label: 'Keep your force together', fn: () => { } },
  ] }) });
  // 28 Dec 1958 — the battle of Santa Clara (resolved abstractly).
  anchor({ id: 'santaclara', day: D(1958, 12, 28), run: (g) => {
    const r = C.resolveBattle('Santa Clara', 10, { bonus: 1 + (g.flags.columns ? 0.6 : 0) + clamp((70 - g.regime.armyMorale) / 60, 0, 0.6) });
    return card({ title: 'Santa Clara', icon: '🚂', body: r.win ? 'The decisive battle in the city of Santa Clara: a derailed armoured train, street fighting, and a garrison that no longer wants to die. The road to Havana is open.' : 'The army holds Santa Clara for now. The war goes on, but the end is within sight if the regime keeps weakening.', choices: [{ label: 'Continue', fn: () => { if (r.win) { g.regime.armyMorale -= 12; g.regime.legit -= 10; } } }] }); } });
  // 1 Jan 1959 — Batista flees if legitimacy and army morale have collapsed (→ governing); otherwise the war continues.
  anchor({ id: 'newyear', day: D(1959, 1, 1) - 1, run: (g) => {
    const collapse = g.regime.legit < 38 && g.regime.armyMorale < 48 || g.regime.legit < 28;
    if (collapse) return card({ title: 'Batista flees', icon: '✈', body: 'In the early hours of 1 January 1959, Batista boards a plane for the Dominican Republic with his family and his friends. The generals negotiate; the garrisons lay down their weapons; a general strike you did or did not prepare finishes the job. The revolution has won. What kind of revolution is up to what you built.', choices: [{ label: 'See what you built', fn: () => { C.beginGoverning(); } }] });
    return card({ title: 'The regime holds — for now', icon: '⌛', body: 'The new year arrives and Batista is still in the Palace. You have not broken the army\'s will or the regime\'s legitimacy. The war goes on.', choices: [{ label: 'Keep fighting', fn: () => { } }] }); } });

  // Fire the first anchor whose day has come and whose condition holds (never during Alegría de Pío, never while another card is open); also checks the regime-collapse condition at any time (→ governing, govern.js).
  function checkAnchors() {
    const g = G();
    for (const a of A) {
      if (C.story.fired[a.id] || g.day < a.day) continue;
      if (a.cond && !a.cond(g)) { if (g.day > a.day + 40) C.story.fired[a.id] = true; continue; }
      if (g.scene.sid === 'alegria' && a.id !== 'regroup') continue;
      if (g.pendingCard || g.modalOpen) return;
      C.story.fired[a.id] = true;
      const res = a.run(g); if (res) { if (res.after) { const orig = res.choices; res.choices = orig.map((ch) => Object.assign({}, ch, { fn: () => { ch.fn && ch.fn(); res.after(); } })); } C.ui.card(res); return; }
    }
    // collapse check any time
    if (g.regime.legit < 18 && g.regime.armyMorale < 25 && !g.over) { g.regime.legit = 18; C.story.fired.newyear = true; C.ui.card({ title: 'The regime collapses', icon: '🏳', body: 'Garrisons surrender across the island. The army will not fight any more. Batista leaves.', choices: [{ label: 'See what you built', fn: () => C.beginGoverning() }] }); }
  }
  // Show the outcome of an abstract battle and the prisoner/loot choices (release with a lecture, release but keep weapons, execute officers, execute all) — each changes the army's morale, your reputation and mercy index.
  function showBattle(name, r) {
    const g = G();
    C.ui.card({ title: `${name}: ${r.win ? 'victory' : 'defeat'}`, icon: r.win ? '🏆' : '💀', body: `${r.win ? 'Your men take the post.' : 'The attack stalls under fire and you pull back.'} ${r.dead.length ? 'Fallen: ' + r.dead.map(C.tagName).join(', ') + '.' : 'No named losses.'}${r.win ? `\n\nSpoils: ${r.loot.ammo} cartridges, ${r.loot.guns} rifles, ${r.loot.med} medicine, ${r.loot.food} food. ${r.pris} prisoners are waiting for your verdict.` : ''}`, choices: r.win ? [
      { label: 'Release prisoners unharmed with a lecture', sub: 'The army\'s will to fight drops. No grievance.', fn: () => { applyLoot(r); g.regime.armyMorale -= 0.4 * r.pris + 1; g.stats.released += r.pris; C.adjustRep('justice', 5); C.deed(5, 6); } },
      { label: 'Release them; keep their weapons and uniforms', fn: () => { applyLoot(r); g.regime.armyMorale -= 0.4 * r.pris + 1; g.stats.released += r.pris; C.adjustRep('justice', 4); } },
      { label: 'Execute the officers; free the conscripts', sub: 'Terror at the top; mercy below', fn: () => { applyLoot(r); C.adjustRep('fear', 8); C.adjustRep('justice', -4); g.stats.executed += 2; g.regime.armyMorale -= 0.25 * r.pris; } },
      { label: 'Execute all prisoners', sub: 'Brutal. Every family hears of it.', fn: () => { applyLoot(r); C.adjustRep('fear', 20); C.adjustRep('justice', -24); g.stats.executed += r.pris; g.stats.killedArmy += r.pris; for (let i = 0; i < Math.min(r.pris, 4); i++) memoryAll('manzanillo', { type: 'massacre', perpSide: 'rebel', text: `Rebels shot prisoners after ${name}`, memText: 'The rebels shot prisoners', headline: `Rebels accused of killing prisoners after ${name}` }, -1, 75, 1); } },
    ] : [{ label: 'Withdraw to the mountain', fn: () => { } }] });
  }
  // Spoils of a won action. Besides rifles, a good haul can include heavy weapons — each is a tactical change AND a
  // political one (arming a novice with a bazooka divides the veterans, see C.resentment).
  function applyLoot(r) {
    const g = G(); g.heavy = g.heavy || {};
    g.res.ammo += r.loot.ammo; g.res.med += r.loot.med; g.res.food += r.loot.food; g.res.guns += r.loot.guns;
    const big = r.loot.guns >= 3 ? 1 : 0.5;                       // bigger garrisons hold more heavy kit
    const got = [];
    if (Math.random() < 0.30 * big) { g.heavy.bar = (g.heavy.bar || 0) + 1; got.push('a BAR'); }
    if (Math.random() < 0.18 * big) { g.heavy.mortar = (g.heavy.mortar || 0) + 1; g.res.shell += 4 + Math.floor(Math.random() * 5); got.push('a 60 mm mortar with shells'); }
    if (Math.random() < 0.15 * big) { g.heavy.bazooka = (g.heavy.bazooka || 0) + 1; g.res.rocket += 2 + Math.floor(Math.random() * 3); got.push('a bazooka with rockets'); }
    if (Math.random() < 0.12 * big) { g.heavy.mg = (g.heavy.mg || 0) + 1; got.push('a machine gun'); }
    if (got.length) C.log('Among the spoils: ' + got.join(', ') + '.', 'good');
  }
  // (exported for the test harness)
  C.showBattle = showBattle;

  // ---------- an arms dealer: the weapons you cannot capture, you can buy (Havana money, Miami contacts, Mexican smugglers) ----------
  def({ id: 'arms_dealer', cat: 'lifeline', t: 2, cd: 45, layer: 3, w: (g) => (g.day > 70 && g.res.money > 120 ? 1.6 : 0), run: (g) => {
    g.heavy = g.heavy || {}; const price = { carbines: 150, bar: 170, mortar: 230, bazooka: 280 };
    return card({ title: 'A man with a boat and a catalogue', icon: '🔫', body: 'A smuggler who has run guns for three governments offers what he has this week — Cuban pesos only, no questions, delivered to the coast by night. The army will be curious where it came from.', choices: [
      { label: `Four M1 carbines and 120 rounds (${price.carbines} pesos)`, sub: 'Light, handy, good for women and boys who cannot carry a Springfield', disabled: g.res.money < price.carbines, fn: () => { g.res.money -= price.carbines; g.res.guns += 4; g.res.ammo += 120; g.regime.heat += 1; } },
      { label: `A Browning automatic rifle (BAR) and 100 rounds (${price.bar} pesos)`, sub: 'Heavy but devastating at 400 m', disabled: g.res.money < price.bar, fn: () => { g.res.money -= price.bar; g.heavy.bar = (g.heavy.bar || 0) + 1; g.res.ammo += 100; g.regime.heat += 1; } },
      { label: `A 60 mm mortar and 8 shells (${price.mortar} pesos)`, sub: 'Needs a crew; shells are heavy', disabled: g.res.money < price.mortar, fn: () => { g.res.money -= price.mortar; g.heavy.mortar = (g.heavy.mortar || 0) + 1; g.res.shell += 8; g.regime.heat += 2; } },
      { label: `A bazooka and 3 rockets (${price.bazooka} pesos)`, sub: 'Stops a truck. Do not stand behind it.', disabled: g.res.money < price.bazooka, fn: () => { g.res.money -= price.bazooka; g.heavy.bazooka = (g.heavy.bazooka || 0) + 1; g.res.rocket += 3; g.regime.heat += 2; } },
      { label: 'Not this week', fn: () => { } },
    ] }); } });

  C.story.defs = E; C.story.anchors = A;

  // ENDING: C.endGame marks the game over and shows the end screen (ledger of deaths, releases, executions, coalition, what shaped the run).
  // ---------- the end ----------
  // (see above)
  C.endGame = function (kind) {
    const g = G(); if (g.over) return;
    g.over = { kind, day: g.day };
    if (C.ui && C.ui.showEnd) C.ui.showEnd(kind);
  };
})();
