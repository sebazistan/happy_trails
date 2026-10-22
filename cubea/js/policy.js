/* CUBEA — policy.js : the rebel movement's hallmark policies, made solid.

   Four things the Cuban rebels were known for, each a small simulation of its own:

   1. TREATMENT OF ENEMY SOLDIERS & AMNESTY
      The rebels treated wounded prisoners, released captured soldiers (often through the Red Cross), and broadcast
      amnesty over Radio Rebelde. That was strategy, not only decency: it made soldiers surrender instead of fighting to
      the death. The reverse is also true — executions harden the army. This module tracks a MERCY index (a decaying
      record of how you treat prisoners) and feeds it to the army's willingness to surrender and to desert.

   2. LAND REFORM
      From seizing a landlord's estate in a village, to the Sierra Maestra agrarian law of late 1958 (a ceiling on estate
      size and a compensation rule). Redistribution raises peasant support at once, costs production for a while
      (disruption), then pays back in food; compensation softens the landowners' anger but costs pesos.

   3. PLATFORM CALIBRATION
      The manifesto already says who likes what. This adds a FORECAST ("if you declare this, support changes by about…"
      for each faction) and a POLL (pay to sample a town) so the player can tune the platform with numbers rather than guesses.

   4. THE LEDGER between them: everything here writes memories through C.addEvent so that families and friends react.

   STATE   g.mercy = {v, day}            decaying mercy index, about −3 … +3
           g.pol   = {amnesty}           'none' | 'rank' (below officers) | 'all'
           g.prisoners = [personId…]     detained soldiers (cost food, may escape)
           g.land  = {ceiling, comp, estates, families, coops}
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, rnd = Math.random;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const toast = (t) => C.ui && C.ui.toast && C.ui.toast(t);

  // ==================================================================================================================
  // 1. MERCY, PRISONERS, AMNESTY
  // ==================================================================================================================
  const MERCY_HALF_LIFE = 60;                       // days over which the army "forgets" how you treat prisoners

  C.policyInit = function () {
    const g = G();
    g.mercy = g.mercy || { v: 0, day: g.day }; g.pol = g.pol || { amnesty: 'none' }; g.prisoners = g.prisoners || [];
    g.land = g.land || { ceiling: 100, comp: 'none', estates: 0, families: 0, coops: 0, law: false };
  };

  /** Current mercy index (−3 … +3), decayed to today. */
  C.mercyNow = function () {
    const g = G(); C.policyInit();
    const m = g.mercy; const dt = g.day - m.day; if (dt > 0) { m.v *= Math.pow(0.5, dt / MERCY_HALF_LIFE); m.day = g.day; }
    return m.v;
  };
  /** Record an act of mercy (+) or cruelty (−). */
  C.noteMercy = function (d) { C.mercyNow(); const m = G().mercy; m.v = clamp(m.v + d, -3, 3); };

  /**
   * How much more (or less) willing the army is to surrender, as an additive probability.
   * Merciful rebels (and an announced amnesty) make surrender attractive; a record of executions makes soldiers fight on.
   */
  C.surrenderBonus = function () {
    const g = G(); C.policyInit();
    return clamp(C.mercyNow() * 0.12 + (g.pol.amnesty === 'all' ? 0.18 : g.pol.amnesty === 'rank' ? 0.12 : 0), -0.35, 0.5);
  };

  /** Remove a surrendered soldier's actor from the scene (he is processed, not killed). */
  function removeActor(a) { const s = a.scene; a.gone = true; const i = s.actors.indexOf(a); if (i >= 0) s.actors.splice(i, 1); if (a.weapon) C.dropWeapon(a); }

  /**
   * Handle a surrendered soldier. kind:
   *   'amnesty'  release with a safe-conduct paper — best for mercy; the army hears
   *   'treat'    bandage his wounds (1 medicine) then release
   *   'exchange' swap him (through the Red Cross) for a rebel held by the army
   *   'detain'   keep him in the camp (costs food; may escape; must be decided later)
   *   'execute'  shoot him — hardens the army, and breaks your word if you announced an amnesty
   */
  C.handlePrisoner = function (a, kind) {
    const g = G(), p = a.p; C.policyInit();
    const ev = (positive, sev, text, mem) => C.addEvent({ type: positive ? 'mercy' : 'execution', victim: p, perpSide: 'rebel', positive, val: positive ? 1 : -1, sev, pub: positive ? 0.25 : 0.7, x: a.x, y: a.y, scene: a.scene, settlement: a.scene.sid, text, memText: mem });
    if (kind === 'treat') {
      if (g.res.med < 1) { toast('No medicine to spare'); return false; }
      g.res.med--; p.hp = p.maxHp; p.bleed = 0; removeActor(a); p.status = 'away'; p.note = 'Treated and released by the rebels.';
      C.noteMercy(1.3); g.stats.released++; g.stats.treated = (g.stats.treated || 0) + 1; g.rep.justice = clamp(g.rep.justice + 3, 0, 100); C.deed(5, 4);
      ev(true, 46, `The rebels treated ${C.tagName(p)}'s wounds and let him go`, 'The rebels bandaged our soldier and sent him home');
      p.trueStance = Math.max(p.trueStance, -10) + 10; C.log(`${C.tagName(p)} is treated and released.`, 'good'); return true;
    }
    if (kind === 'amnesty') {
      removeActor(a); p.status = 'away'; p.note = 'Released under amnesty.';
      C.noteMercy(g.pol.amnesty !== 'none' ? 1.5 : 1); g.stats.released++; g.regime.armyMorale = clamp(g.regime.armyMorale - 0.8, 0, 100); g.rep.justice = clamp(g.rep.justice + 2, 0, 100); C.deed(5, 3);
      p.trueStance += 8; p.morale = 25; ev(true, 40, `The rebels released ${C.tagName(p)} under amnesty`, 'The rebels spared our soldier');
      if (rnd() < 0.18 && p.sex === 'M') { p.pendingDefect = g.day + 10 + Math.floor(rnd() * 20); }   // some will come back to join you
      C.log(`${C.tagName(p)} is released under amnesty.`, 'good'); return true;
    }
    if (kind === 'exchange') {
      const jailed = C.W.people.filter((q) => q.status === 'jailed' && q.trueStance > 15 && !q.roster).sort(() => rnd() - 0.5)[0];
      if (!jailed) { toast('There is no rebel in the army\'s hands to exchange him for'); return false; }
      removeActor(a); p.status = 'away'; jailed.status = 'alive'; C.recruit(jailed, 4);
      C.noteMercy(0.6); g.stats.released++; g.regime.heat = Math.max(0, g.regime.heat - 1); g.rep.justice = clamp(g.rep.justice + 1.5, 0, 100);
      ev(true, 34, `${C.tagName(p)} was exchanged for ${C.tagName(jailed)}`, 'My son was exchanged through the Red Cross'); C.log(`Exchanged ${C.tagName(p)} for ${C.tagName(jailed)}, who rejoins you.`, 'good'); return true;
    }
    if (kind === 'detain') {
      if (g.prisoners.length >= 8) { toast('You cannot hold more than eight prisoners'); return false; }
      removeActor(a); p.status = 'jailed'; p.note = 'Held by the rebels.'; g.prisoners.push(p.id); C.log(`${C.tagName(p)} is held in the camp.`, 'info'); return true;
    }
    if (kind === 'execute') {
      C.die(a, g.player, 'executed'); g.stats.executed++;
      const broke = g.pol.amnesty !== 'none';
      C.noteMercy(-2.2 - (broke ? 0.8 : 0)); g.rep.justice = clamp(g.rep.justice - 12, 0, 100); g.rep.fear = clamp(g.rep.fear + 8, 0, 100);
      if (broke) { C.adjustRep('honesty', -10); g.pol.amnesty = 'none'; C.log('You shot a man you had promised amnesty. The army has heard it. The amnesty is void.', 'bad'); }
      return true;
    }
    return false;
  };

  /** Treat a wounded ENEMY soldier who has not surrendered (he is down but alive). Generous act; small cost; big memory. */
  C.treatEnemy = function (a) {
    const g = G(), p = a.p; if (g.res.med < 1) { toast('No medicine to spare'); return; }
    g.res.med--; p.hp = Math.min(p.maxHp, p.hp + 40); p.bleed = 0; C.noteMercy(0.8); g.rep.justice = clamp(g.rep.justice + 2, 0, 100);
    C.addEvent({ type: 'mercy', victim: p, perpSide: 'rebel', positive: true, val: 1, sev: 42, pub: 0.2, x: a.x, y: a.y, scene: a.scene, settlement: a.scene.sid, text: `A rebel medic treated the wounded soldier ${C.tagName(p)}`, memText: 'A rebel treated our wounded boy' });
    a.surrendered = true; a.weaponOut = false; C.log(`You treat ${C.tagName(p)}, an enemy soldier. He surrenders.`, 'good');
  };

  /** Amnesty as a standing policy, announced on Radio Rebelde. */
  C.setAmnesty = function (level) {
    const g = G(); C.policyInit(); g.pol.amnesty = level;
    if (level !== 'none') { C.deed(5, 6); g.regime.armyMorale = clamp(g.regime.armyMorale - 2, 0, 100); C.log(`Radio Rebelde announces amnesty for ${level === 'all' ? 'every soldier' : 'rank and file'} who lays down arms.`, 'good'); }
  };

  /** Daily upkeep of prisoners, amnesty desertions, delayed defections. Called from dayTick (see sim.js). */
  C.policyDaily = function () {
    const g = G(); C.policyInit(); C.mercyNow();
    // prisoners eat, and may escape if there are too few guards
    const guards = C.squadPeople().length;
    for (const id of g.prisoners.slice()) {
      const p = C.P(id); g.res.food = Math.max(0, g.res.food - 0.4);
      if (guards < 3 && rnd() < 0.06) { p.status = 'away'; g.prisoners = g.prisoners.filter((x) => x !== id); C.log(`${C.tagName(p)} escaped from the camp.`, 'warn'); g.regime.heat += 1; }
    }
    // amnesty works on the army's morale: a trickle of desertions
    if (g.pol.amnesty !== 'none' && rnd() < (g.pol.amnesty === 'all' ? 0.55 : 0.4)) {
      const cand = C.W.people.filter((p) => p.status === 'alive' && p.mil && p.mil.side === 'army' && !p.roster && p.trueStance > -55 && (g.pol.amnesty === 'all' || (p.mil.rank || 'Soldado') === 'Soldado'));
      const p = cand.length ? pick(cand) : null;
      if (p) { p.mil = null; p.status = 'away'; p.trueStance += 12; g.regime.armyMorale = clamp(g.regime.armyMorale - 0.5, 0, 100); if (rnd() < 0.3) C.log(`A soldier from the garrison has deserted, citing Radio Rebelde's amnesty.`, 'info'); }
    }
    // some released men come back to join
    for (const p of C.W.people) if (p.pendingDefect && g.day >= p.pendingDefect && p.status === 'away') { p.pendingDefect = 0; if (p.sex === 'M') { C.recruit(p, p.exp); C.log(`${C.tagName(p)}, whom you spared, has come to join you.`, 'good'); } }
    C.land.daily();
  };

  // ==================================================================================================================
  // 2. LAND REFORM
  // ==================================================================================================================
  C.land = {};

  /** Seize an estate. mode: 'redistribute' (to tenants), 'cooperative' (run in common), 'compensate' (pay the owner). */
  C.land.seize = function (p, mode) {
    const g = G(), s = g.scene; C.policyInit(); const L = g.land;
    const cost = mode === 'compensate' ? (L.comp === 'cash' ? 90 : 45) : 0;
    if (cost && g.res.money < cost) { toast(`Compensation costs ${cost} pesos`); return false; }
    g.res.money -= cost;
    const tenants = C.W.people.filter((q) => q.status === 'alive' && q.fac === 'peasants' && q.settlement === s.sid);
    const fam = Math.max(3, Math.round(tenants.length / 3)); L.estates++; L.families += fam; if (mode === 'cooperative') L.coops++;
    L.pending = (L.pending || []).concat([{ sid: s.sid, fam, coop: mode === 'cooperative', day: g.day }]);
    C.deed(0, 28); C.deed(3, mode === 'cooperative' ? 6 : 3); C.adjustRep('justice', mode === 'compensate' ? 1 : -1);
    for (const q of tenants) { q.trueStance += 6; q.needs.hope = clamp(q.needs.hope + 12, 0, 100); q.needs.food = clamp(q.needs.food + 8, 0, 100); }
    const soft = mode === 'compensate' ? 0.45 : 1;                               // compensation halves the owners' anger
    for (const q of C.W.people) { if (q.status !== 'alive') continue; if (q.fac === 'landowners') q.trueStance -= 7 * soft; if (q.fac === 'elite') q.trueStance -= 1.5 * soft; }
    if (mode !== 'compensate' && rnd() < 0.4) { p.status = 'exile'; }              // owners often flee
    C.addEvent({ type: 'seizure', victim: p, perpSide: 'rebel', val: -1, sev: mode === 'compensate' ? 40 : 62, pub: 0.8, x: 0, y: 0, settlement: s.sid, text: `Rebels ${mode === 'compensate' ? 'bought out' : 'seized'} the estate of ${C.tagName(p)}`, memText: mode === 'compensate' ? 'The rebels bought our land at a price' : 'Rebels took our land', headline: `Rebels ${mode === 'compensate' ? 'buy out' : 'seize'} the ${C.tagName(p)} estate and hand it to ${fam} families` });
    toast(`${fam} families receive land.`); return true;
  };

  /** The menu the player sees when talking to a landowner/estate manager. */
  C.land.seizeMenu = function (p) {
    const g = G(); C.policyInit();
    C.ui.menu('The estate of ' + C.fullName(p), 'What will you do with the land? Tenants will wait and watch; so will every other owner in the Oriente.', [
      { label: 'Hand it to the tenants', sub: 'Quick, popular with peasants, enrages owners. Output dips for about 20 days, then pays back.', fn: () => { C.land.seize(p, 'redistribute'); } },
      { label: 'Run it as a cooperative', sub: 'Slower payback, higher yield, and workers\' support.', fn: () => { C.land.seize(p, 'cooperative'); } },
      { label: 'Buy it out (45 pesos, or 90 with cash compensation)', sub: 'The owner keeps some dignity; his friends are calmer.', disabled: g.res.money < 45, fn: () => { C.land.seize(p, 'compensate'); } },
    ]);
  };

  /** Daily: land that was handed over is disrupted for ~20 days, then yields food and goodwill. */
  C.land.daily = function () {
    const g = G(), L = g.land; if (!L.pending || !L.pending.length) return;
    for (const f of L.pending) {
      const age = g.day - f.day; const per = f.coop ? 0.9 : 0.6;
      const food = age < 20 ? -0.1 * f.fam * 0.2 : per * f.fam * 0.35;             // disruption first, then harvests shared with the column
      g.res.food = Math.max(0, g.res.food + food);
      if (age === 20) C.log(`The land given to ${f.fam} families near ${C.SETTLEMENTS[f.sid].name} has its first harvest.`, 'good');
    }
  };

  /** The agrarian law: a ceiling on estate size and a compensation rule. Enacted by anchor/event; sets the plank. */
  C.land.enact = function (ceiling, comp) {
    const g = G(), L = g.land; C.policyInit(); L.law = true; L.ceiling = ceiling; L.comp = comp;
    C.declarePlank && C.declarePlank(0, ceiling <= 30 ? 2 : 1, ceiling <= 30 ? 2 : 1);
    C.deed(0, ceiling <= 30 ? 30 : 18);
    const soft = comp === 'cash' ? 0.35 : comp === 'bonds' ? 0.6 : 1;
    for (const q of C.W.people) { if (q.status !== 'alive') continue; if (q.fac === 'peasants') q.trueStance += ceiling <= 30 ? 4.5 : 3; if (q.fac === 'landowners') q.trueStance -= (ceiling <= 30 ? 6 : 3.5) * soft; if (q.fac === 'workers') q.trueStance += 1; }
    if (comp === 'cash') g.res.money = Math.max(0, g.res.money - 150);
    g.regime.usSupport = clamp(g.regime.usSupport + (ceiling <= 30 ? 3 : 0), 0, 100);
    if (G().us) G().us.interests += ceiling <= 30 ? 1 : 0;
    C.log(`Land law: estates are capped at ${ceiling} caballerías${comp === 'none' ? ', without compensation' : comp === 'bonds' ? ', compensated in bonds' : ', compensated in cash'}.`, 'good');
  };

  // ==================================================================================================================
  // 3. PLATFORM CALIBRATION: forecast and poll
  // ==================================================================================================================

  // a fixed, repeatable sample of adults so forecasts do not jitter from one opening of the manifesto to the next
  let sample = null;
  function adults() { if (!sample) { const R = C.RNG(777); sample = R.shuffle(C.W.people.filter((p) => C.ageOf(p) >= 16)).slice(0, 700).map((p) => p.id); } return sample; }

  /**
   * Forecast: if plank k were declared at `level`, how would the target stance of each faction change?
   * Implementation: temporarily set the platform, evaluate C.stanceTarget for a fixed sample, restore it.
   * Returns { overall, byFaction:{f→delta}, best:[…], worst:[…] } with deltas in stance points (−100…100 scale).
   */
  C.platformForecast = function (k, level) {
    const g = G(), P = g.platform; const keep = { d: P.declared[k], pub: P.pub[k], real: P.real[k] };
    const base = {}, withIt = {}, cnt = {};
    const sumUp = (store) => { for (const id of adults()) { const p = C.P(id); if (p.status === 'dead') continue; store[p.fac] = (store[p.fac] || 0) + C.stanceTarget(p); } };
    for (const id of adults()) { const p = C.P(id); if (p.status !== 'dead') cnt[p.fac] = (cnt[p.fac] || 0) + 1; }
    sumUp(base);
    P.declared[k] = true; P.pub[k] = level; P.real[k] = level; sumUp(withIt);
    P.declared[k] = keep.d; P.pub[k] = keep.pub; P.real[k] = keep.real;
    const byFaction = {}; let tot = 0, n = 0;
    for (const f of C.FACTION_KEYS) { if (!cnt[f]) continue; byFaction[f] = ((withIt[f] || 0) - (base[f] || 0)) / cnt[f]; tot += (withIt[f] || 0) - (base[f] || 0); n += cnt[f]; }
    const ranked = Object.keys(byFaction).sort((a, b) => byFaction[b] - byFaction[a]);
    return { overall: n ? tot / n : 0, byFaction, best: ranked.slice(0, 2), worst: ranked.slice(-2).reverse() };
  };

  /** Forecast every option of every plank at once, cached per game day and per current platform (it is the expensive call). */
  C.forecastAll = function () {
    const g = G(), P = g.platform; const sig = g.day + '|' + P.declared.join('') + P.pub.join('') + P.real.join('');
    if (C._fc && C._fc.sig === sig) return C._fc.data;
    const data = C.PLANKS.map((pl, k) => pl.opts.map((o, i) => C.platformForecast(k, i)));
    C._fc = { sig, data }; return data;
  };

  /**
   * Poll a settlement (costs pesos). Samples up to 40 adults; the result has sampling noise (±1/√n) so it is an estimate.
   * Returns { sid, n, byFaction:{f→{n, mean, pctRebel}}, pctRebel, pctBatista, margin }.
   */
  C.pollSettlement = function (sid, cost) {
    const g = G(); cost = cost === undefined ? 20 : cost; if (g.res.money < cost) { toast(`A poll costs ${cost} pesos`); return null; }
    g.res.money -= cost;
    const pool = (C.W.bySet[sid] || []).map((i) => C.P(i)).filter((p) => p.status === 'alive' && C.ageOf(p) >= 16).sort(() => rnd() - 0.5).slice(0, 40);
    const by = {}; let reb = 0, bat = 0;
    for (const p of pool) {
      // people tell the pollster what they dare to say: informers and the afraid lean toward the regime
      let v = p.informant && !p.revealed ? p.stance : p.trueStance - (p.fear > 50 && p.fearOf === 'army' ? 12 : 0);
      v += (rnd() - 0.5) * 16;
      const r = by[p.fac] = by[p.fac] || { n: 0, sum: 0, rebel: 0 }; r.n++; r.sum += v; if (v > 10) { r.rebel++; reb++; } else if (v < -10) bat++;
    }
    const out = {}; for (const f in by) out[f] = { n: by[f].n, mean: by[f].sum / by[f].n, pctRebel: by[f].rebel / by[f].n };
    return { sid, n: pool.length, byFaction: out, pctRebel: pool.length ? reb / pool.length : 0, pctBatista: pool.length ? bat / pool.length : 0, margin: pool.length ? 1 / Math.sqrt(pool.length) : 1 };
  };

  // ==================================================================================================================
  // 4. EVENTS AND ANCHORS that use the above
  // ==================================================================================================================
  const card = (c) => c;
  const defs = C.story.defs, anchors = C.story.anchors, D = C.dayOfDate;

  // Radio Rebelde offers amnesty (needs the radio to exist or the winter of 1957-58 to have come)
  defs.push({ id: 'amnesty_broadcast', cat: 'social', t: 3, cd: 120, layer: 3, w: (g) => (g.day > 120 && (g.pol && g.pol.amnesty === 'none') && (g.base.built.radio || g.day > 330) ? 1.6 : 0), run: (g) => card({ title: 'What do we tell the soldiers?', icon: '📻', body: 'Your radio operator has a free half hour on Radio Rebelde. Conscripts listen at night in the barracks. "They are poor boys like us," says one of your men. "If they know we will not shoot them, they will not shoot us." Another answers: "And the officers who tortured our people?"', choices: [
    { label: 'Amnesty for every soldier who lays down arms', sub: 'The army will begin to melt. Anyone you later shoot makes you a liar.', fn: () => C.setAmnesty('all') },
    { label: 'Amnesty for rank and file only; officers answer for their acts', sub: 'A narrower promise you can keep.', fn: () => C.setAmnesty('rank') },
    { label: 'Say nothing', fn: () => { } },
  ] }) });

  // prisoners held for a while must be decided on
  defs.push({ id: 'prisoner_verdict', cat: 'pressure', t: 2, cd: 25, layer: 3, w: (g) => (g.prisoners && g.prisoners.length >= 1 ? 3 : 0), run: (g) => {
    const ps = g.prisoners.map((i) => C.P(i)).filter((p) => p && p.status === 'jailed'); if (!ps.length) { g.prisoners = []; return null; }
    const nm = ps.map(C.tagName).join(', ');
    const resolve = (how) => { for (const p of ps) { g.prisoners = g.prisoners.filter((x) => x !== p.id); if (how === 'release') { p.status = 'away'; C.noteMercy(0.7); g.stats.released++; p.trueStance += 6; } else if (how === 'join') { if (rnd() < 0.45) { p.trueStance = 35; C.recruit(p, p.exp); } else { p.status = 'away'; } C.noteMercy(0.4); } else { C.killOffscreen(p, 'rebel', `${C.tagName(p)} was shot as a prisoner of the rebels`, 62, false); g.stats.executed++; C.noteMercy(-2); g.rep.justice = clamp(g.rep.justice - 10, 0, 100); if (g.pol.amnesty !== 'none') { g.pol.amnesty = 'none'; C.adjustRep('honesty', -10); } } } };
    return card({ title: 'The prisoners in the camp', icon: '⛓', body: `${nm} ${ps.length > 1 ? 'have' : 'has'} been in the camp for days. They eat what your men eat. ${g.pol.amnesty !== 'none' ? 'You have promised amnesty on the radio.' : ''}`, choices: [
      { label: 'Release them with a safe-conduct', sub: 'The army will hear that you keep your word.', fn: () => resolve('release') },
      { label: 'Offer them a place in your ranks', sub: 'Some will accept. Some will not be trusted.', fn: () => resolve('join') },
      { label: 'Shoot them', sub: 'Quicker. The army will fight on, and families will remember.', fn: () => resolve('shoot') },
    ] }); } });

  // tenants occupy idle land and ask for your protection
  defs.push({ id: 'land_petition', cat: 'social', t: 3, cd: 50, layer: 3, w: (g) => (g.day > 40 ? 1.2 : 0), run: (g) => {
    const owner = C.W.people.find((p) => p.status === 'alive' && p.fac === 'landowners' && p.settlement === 'palmarito') || C.W.people.find((p) => p.status === 'alive' && p.fac === 'landowners');
    if (!owner) return null;
    return card({ title: 'The tenants have occupied the idle land', icon: '🌾', body: `Forty families have moved onto uncultivated land belonging to ${C.tagName(owner)}, who has not farmed it in nine years. The rural guard is coming. The tenants send word: "Compañero, tell us what to do."`, choices: [
      { label: 'Back them: the land is theirs from today', sub: 'Peasants rally; landowners will not forgive it.', fn: () => C.land.seize(owner, 'redistribute') },
      { label: 'Back them, and pay the owner a fair price', sub: '45 pesos. Calmer, slower.', disabled: g.res.money < 45, fn: () => C.land.seize(owner, 'compensate') },
      { label: 'Ask them to leave until the war is won', sub: 'Many will remember.', fn: () => { C.deed(0, -6); for (const p of C.W.people) if (p.status === 'alive' && p.fac === 'peasants') p.trueStance -= 1.2; } },
    ] }); } });

  // The Sierra agrarian law (Oct 1958 in history): a ceiling on estates and a compensation rule
  anchors.push({ id: 'sierra_law', day: D(1958, 10, 10), cond: (g) => !g.land || !g.land.law, run: (g) => card({ title: 'The law of the Sierra', icon: '📜', body: 'Your legal advisers have drafted an agrarian law for the liberated territory: a limit on how much land one family may hold, tenants made owners of what they work, and a rule about what the owners get. Every peasant in the Oriente will hear of it by Sunday — and so will every landowner and every American company with cane.', choices: [
    { label: 'Ceiling of 30 caballerías, no compensation', sub: 'Radical. Peasants are overjoyed; owners are not.', fn: () => C.land.enact(30, 'none') },
    { label: 'Ceiling of 30 caballerías, compensated in bonds', sub: 'Firm, with a promise to the owners.', fn: () => C.land.enact(30, 'bonds') },
    { label: 'Ceiling of 67 caballerías, compensated in cash (150 pesos)', sub: 'Moderate. Washington can live with it.', disabled: g.res.money < 150, fn: () => C.land.enact(67, 'cash') },
    { label: 'Postpone the law until victory', sub: 'Peasants will wait; some will not.', fn: () => { for (const p of C.W.people) if (p.status === 'alive' && p.fac === 'peasants' && p.sal.includes(0)) p.trueStance -= 1.5; } },
  ] }) });
})();
