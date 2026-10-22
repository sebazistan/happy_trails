// Second event module: the rackets and the mercenary drift, the Americans behind the regime,
// the non-violent path, and what comes after the fall of Havana (governing, and the Bay of Pigs).
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp; const rnd = Math.random; const pick = (a) => a[Math.floor(rnd() * a.length)];
  const card = (c) => c;
  const defs = () => C.story.defs;
  const def = (o) => C.story.defs.push(o);
  const S = (id) => C.SETTLEMENTS[id];
  const localPeople = (sid, f) => (C.W.bySet[sid] || []).map((i) => C.P(i)).filter((p) => p.status === 'alive' && (!f || f(p)));
  const toast = (t) => C.ui && C.ui.toast && C.ui.toast(t);

  // =================================================================== rackets & mercenary drift
  // g.merc 0..100: how far the band has drifted from a cause toward a business. It is profitable and it costs you the people.
  C.racketInit = function () { const g = G(); if (g.merc === undefined) { g.merc = 0; g.rackets = { protect: 0, contraband: 0, kidnaps: 0 }; g.racketLog = { earned: 0 }; } };
  const RACKETS = {
    protect: { n: 'Protection payments', per: 5, drift: 0.55, d: 'Shopkeepers and landowners pay so that nothing happens to them.' },
    contraband: { n: 'Contraband runs', per: 9, drift: 0.7, d: 'Rum, cigars, and the white powder the mob pays for, carried by boat.' },
  };
  C.racketStart = function (kind, p) {
    const g = G(); C.racketInit();
    if (kind === 'protect') {
      g.rackets.protect++; g.merc = clamp(g.merc + 6, 0, 100); g.res.money += 22;
      C.addEvent({ type: 'extortion', victim: p, perpSide: 'rebel', positive: false, sev: 46, pub: 0.5, x: 0, y: 0, settlement: p.settlement, text: `Rebels demanded protection money from ${C.tagName(p)}`, memText: 'The rebels came for money and called it patriotism' });
      C.adjustRep('justice', -4); C.adjustRep('fear', 3); g.trust.peasants = clamp(g.trust.peasants - 0.02, 0.02, 1); g.trust.middle = clamp((g.trust.middle || 0.4) - 0.03, 0.02, 1);
      C.log(`${C.tagName(p)} pays. A weekly arrangement begins.`, 'warn');
    } else if (kind === 'contraband') {
      g.rackets.contraband++; g.merc = clamp(g.merc + 8, 0, 100); g.res.money += 30; C.adjustRep('honesty', -3);
      C.log('A boat leaves Cayo Piedra after dark with something in the hold that is not fish.', 'warn');
    } else if (kind === 'kidnap') {
      g.rackets.kidnaps++; g.merc = clamp(g.merc + 14, 0, 100);
      const r = rnd();
      if (r < 0.6) { const pay = 120 + Math.round(rnd() * 220); g.res.money += pay; C.log(`A ransom of ${pay} pesos is paid for ${C.tagName(p)}.`, 'warn'); C.addEvent({ type: 'kidnap', victim: p, perpSide: 'rebel', positive: false, sev: 62, pub: 0.7, x: 0, y: 0, settlement: p.settlement, text: `${C.tagName(p)} was held for ransom by the rebels`, memText: 'They took a man from his house and sold him back to his family' }); }
      else { C.log(`The kidnapping of ${C.tagName(p)} goes wrong. He is shot trying to run.`, 'bad'); C.killOffscreen(p, 'rebel', `${C.tagName(p)} was shot during a rebel kidnapping`, 80, false); }
      C.adjustRep('justice', -9); C.adjustRep('fear', 6); g.regime.heat += 3; g.regime.usSupport = clamp(g.regime.usSupport + 2, 0, 100);
      g.us && (g.us.outrage = (g.us.outrage || 0) + 1);
    }
  };
  C.racketDaily = function () {
    const g = G(); C.racketInit(); const R = g.rackets; let earned = 0, level = 0;
    for (const k in RACKETS) { const n = R[k]; if (!n) continue; level += n; earned += RACKETS[k].per * n * (0.7 + rnd() * 0.6); g.merc = clamp(g.merc + RACKETS[k].drift * n, 0, 100); }
    if (earned) { g.res.money += earned; g.racketLog.earned += earned; if (g.day % 7 === 0) C.log(`Your arrangements brought in ${Math.round(g.racketLog.earned)} pesos this month.`, 'warn'); if (g.day % 30 === 0) g.racketLog.earned = 0; }
    else g.merc = clamp(g.merc - 0.12, 0, 100);
    // busts
    if (R.contraband && rnd() < 0.05 * R.contraband) { g.res.money = Math.max(0, g.res.money - 40); g.regime.heat += 2; C.log('The army seizes a boat from Cayo Piedra. A man is arrested and the cargo is gone.', 'bad'); if (rnd() < 0.4) { R.contraband--; } }
    // the drift eats trust and ideals
    if (g.merc > 20) {
      const k = (g.merc - 15) / 85;
      for (const p of C.W.people) if (p.status === 'alive' && rnd() < 0.05) { if (p.mil && p.mil.side === 'rebel') { if (p.traits.includes('idealist')) C.addTrust(p, -k * 3); } else p.trueStance -= k * (p.fac === 'peasants' || p.fac === 'middle' || p.fac === 'church' ? 1.6 : 0.8); }
      g.rep.justice = clamp(g.rep.justice - k * 0.35, 0, 100); g.rep.honesty = clamp(g.rep.honesty - k * 0.2, 0, 100);
    }
    mercMilestones();
  };
  function mercMilestones() {
    const g = G(), fl = g.flags;
    if (g.merc >= 30 && !fl.mercA) {
      fl.mercA = true;
      const idealists = C.squadPeople().filter((p) => p.id !== C.W.player && !p.roster && p.traits.includes('idealist')).slice(0, 3);
      for (const p of idealists) { for (const sq of g.squads) sq.members = sq.members.filter((i) => i !== p.id); p.status = 'away'; p.trueStance = Math.min(p.trueStance, 10); p.mil = null; if (p.actor) { p.actor.gone = true; } }
      const locals = localPeople('palmarito', (p) => p.sex === 'M' && C.ageOf(p) > 17 && C.ageOf(p) < 40 && !p.mil).slice(0, 4);
      for (const p of locals) { p.traits = p.traits.filter((t) => t !== 'idealist').concat(['greedy']); p.merc = true; C.recruit(p, 3); }
      C.ui.card({ title: 'Different men are joining', icon: '💰', body: `${idealists.length ? idealists.map(C.tagName).join(', ') + ' left. "I did not come to the mountain to collect rent."\n\n' : ''}${locals.length} new faces arrive, asking about the pay and the share. They are good with a rifle and uninterested in your manifesto.`, choices: [{ label: 'Understood', fn: () => { } }] });
    }
    if (g.merc >= 55 && !fl.mercB) {
      fl.mercB = true; for (const k in g.trust) g.trust[k] = clamp(g.trust[k] - 0.06, 0.02, 1); C.adjustRep('justice', -12);
      C.ui.card({ title: 'Your name on the street', icon: '📰', body: 'In the towns they no longer say "the rebels". They say "los cobradores" — the collectors. The government radio does not have to invent anything. A schoolteacher writes to you: "I told my pupils you were different."', choices: [{ label: 'It pays', fn: () => { } }, { label: 'Wind the rackets down', sub: 'Lose the income; the drift slows', fn: () => { g.rackets.protect = 0; g.rackets.contraband = 0; g.merc = Math.max(0, g.merc - 12); } }] });
    }
    if (g.merc >= 80 && !fl.mercC) {
      fl.mercC = true; for (const f of C.FACTION_KEYS) g.trust[f] = clamp(g.trust[f] - 0.08, 0.02, 1); g.regime.legit = clamp(g.regime.legit + 3, 0, 100);
      C.ui.card({ title: 'A band, not a movement', icon: '🗡', body: 'A lieutenant says it out loud: "Why talk about land and elections? We run this valley. Let the city people keep their speeches." Half the camp nods. The other half looks at the ground.', choices: [{ label: 'Say nothing', fn: () => { } }] });
    }
  }
  // opportunities
  def({ id: 'racket_offer', cat: 'social', t: 3, cd: 40, layer: 3, w: (g) => g.day > 35 && (g.res.money < 70 ? 1.8 : 0.5), run: (g) => {
    C.racketInit(); const who = C.squadPeople().find((p) => p.traits.includes('greedy') || p.traits.includes('opportunist')) || null;
    const sid = pick(['palmarito', 'cayo']); const shop = localPeople(sid, (p) => ['bodeguero', 'comerciante', 'mayordomo', 'tendero'].includes(p.occ) || p.fac === 'landowners' || p.cls >= 2)[0];
    return card({ title: 'An easy way to pay for the war', icon: '💵', body: `${who ? C.tagName(who) + ' takes you aside' : 'One of your lieutenants takes you aside'}: "Pesos are the problem. There are people with money in ${S(sid).name} who would be happy to buy some peace. And a boat captain in Cayo Piedra who owes me a favour and carries things for people in Havana who pay well."\n\nThe men who do this stop being quite the same men.`, choices: [
      { label: 'Start collecting protection payments', sub: `About ${RACKETS.protect.per} pesos a day each. Costs you the villages' trust.`, disabled: !shop, fn: () => C.racketStart('protect', shop) },
      { label: 'Run contraband through the Cayo boats', sub: `About ${RACKETS.contraband.per} pesos a day. Risk of seizures.`, fn: () => C.racketStart('contraband', null) },
      { label: 'No. We pay our way honestly.', sub: 'Slower. Cleaner.', fn: () => { g.merc = Math.max(0, (g.merc || 0) - 2); C.deed(6, 2); } },
    ] }); } });

  // =================================================================== the Americans
  C.usInit = function () { const g = G(); if (!g.us) g.us = { arms: 0, strings: 0, outrage: 0, interests: 0, courted: false }; };
  const YANKEE_TXT = [
    'Batista is not the one who matters. The men in Washington who sign the cheques matter.',
    'The mill is American. The phone company is American. The bank that holds the mortgage is in New York. You will find, compadre, that a country can have a flag and no keys.',
    'Every plane that dropped bombs on the Sierra had a stamp from the United States on its belly.',
  ];
  def({ id: 'us_arms', cat: 'pressure', t: 3, cd: 70, layer: 3, w: (g) => g.day > 120 ? 1.5 : 0, run: (g) => {
    C.usInit(); g.us.arms++; g.regime.armyMorale = clamp(g.regime.armyMorale + 4, 0, 100); g.regime.heat += 2;
    C.viejoSays(pick(YANKEE_TXT));
    return card({ title: 'New American planes, new American bombs', icon: '✈', body: 'A shipment arrives at Santiago: rockets, bombs, spare parts for the air force — "military assistance" under a treaty nobody in Oriente voted for. Your own men are quoting the labels. A fragment of a bomb casing from the last raid is on the table in front of you: it reads "Made in U.S.A."', choices: [
      { label: 'Print it: pamphlets with the serial numbers (3 pamphlets)', sub: 'Shames the regime abroad; at home, men notice who is paying.', disabled: g.res.pamph < 3, fn: () => { g.res.pamph -= 3; g.regime.usSupport = clamp(g.regime.usSupport - 4, 0, 100); g.regime.legit = clamp(g.regime.legit - 1.5, 0, 100); C.deed(2, 3); for (const p of C.W.people) if (p.status === 'alive' && (p.fac === 'students' || p.fac === 'workers')) p.trueStance += 1.2; } },
      { label: 'Send the bomb fragment to a New York journalist', sub: 'Slower. May shift American opinion.', fn: () => { g.regime.usSupport = clamp(g.regime.usSupport - (rnd() < 0.5 ? 3 : 0.5), 0, 100); } },
      { label: 'Say nothing', fn: () => { } },
    ] }); } });
  def({ id: 'us_mill', cat: 'social', t: 3, cd: 60, layer: 3, w: (g) => g.day > 60 ? 1.1 : 0, run: (g) => {
    C.usInit();
    return card({ title: 'The mill belongs to someone in Connecticut', icon: '🏭', body: 'The American manager of the central comes to a meeting in a clean white shirt with an interpreter and a briefcase. "My company has employed three thousand of your countrymen for fifty years. We would like to keep working. We would be glad to make a donation to your cause — and in exchange our cane, our trucks and our warehouses are not touched."', choices: [
      { label: 'Take the money (200 pesos) and leave the mill alone', sub: 'The cane cutters\' brothers will ask who you are working for.', fn: () => { g.res.money += 200; g.us.strings++; C.adjustRep('honesty', -6); g.merc = Math.min(100, (g.merc || 0) + 4); for (const p of C.W.people) if (p.status === 'alive' && p.fac === 'workers') p.trueStance -= 2; C.log('The mill\'s trucks roll on, under a rebel safe-conduct.', 'warn'); } },
      { label: 'Refuse — tell him the harvest belongs to those who cut it', sub: 'Workers cheer; the company will remember.', fn: () => { g.us.interests++; C.deed(3, 6); g.regime.usSupport = clamp(g.regime.usSupport + 2, 0, 100); for (const p of C.W.people) if (p.status === 'alive' && p.fac === 'workers') p.trueStance += 2.5; } },
      { label: 'Sabotage the mill at night', sub: 'A mission. The Americans will notice.', fn: () => { g.us.interests++; g.flags.sabotageMill = true; g.strikePrep += 5; g.regime.heat += 3; C.log('You plan to burn the weighing sheds at the mill.', 'info'); } },
    ] }); } });
  def({ id: 'us_sailors', cat: 'pressure', t: 3, cd: 80, layer: 3, w: (g) => g.day > 50 && ['santiago', 'habana'].includes(g.scene.sid) ? 3 : 0, run: (g) => {
    const sid = g.scene.sid; const victim = localPeople(sid, (p) => p.sex === 'F' && C.ageOf(p) > 16 && C.ageOf(p) < 40)[0]; if (!victim) return null;
    return card({ title: 'Drunk American sailors, a bar, a girl', icon: '⚓', body: `Marines on shore leave from the base at Guantánamo are arguing with the staff of a bar in ${S(sid).name}. One of them has taken ${C.tagName(victim)} by the arm. The police are across the street, not looking. A group of students watches you to see what you do.`, choices: [
      { label: 'Intervene with your people', sub: 'A brawl. The embassy will complain.', fn: () => { C.deed(2, 4); g.regime.heat += 2; g.us && (g.us.outrage++); for (const p of C.W.people) if (p.status === 'alive' && (p.fac === 'students' || p.fac === 'workers' || p.fac === 'peasants')) p.trueStance += 1; C.addEvent({ type: 'aid', victim, perpSide: 'rebel', positive: true, sev: 40, pub: 0.6, x: 0, y: 0, settlement: sid, text: `Rebels intervened to protect ${C.tagName(victim)} from American sailors`, memText: 'The rebels stood between my daughter and the Americans' }); } },
      { label: 'Stay hidden — you are not here for this', sub: 'It is not your job. Yet.', fn: () => { C.addEvent({ type: 'abuse', victim, perpSide: 'army', sev: 58, pub: 0.6, x: 0, y: 0, settlement: sid, text: `American sailors abused ${C.tagName(victim)} and the police did nothing`, memText: 'They did what they wanted, and the police looked the other way' }); } },
    ] }); } });
  def({ id: 'us_diplomat', cat: 'social', t: 3, cd: 90, layer: 4, w: (g) => g.day > 220 ? 1.3 : 0, run: (g) => {
    C.usInit();
    return card({ title: 'A man from the embassy', icon: '🇺🇸', body: 'A polite man in a linen suit, "a cultural attaché," finds you through three intermediaries. "Washington has no love for General Batista anymore. We can live with a government of reformers: elections, property respected, no Moscow. We are not asking for much. A few planks in your programme might be softened. A friendly word on the radio."', choices: [
      { label: 'Hear him out and publicly soften the nationalisation plank', sub: 'American pressure on Batista grows. Radicals feel betrayed. Washington will expect you to keep your word.', fn: () => { g.us.strings += 2; g.regime.usSupport = clamp(g.regime.usSupport - 6, 0, 100); C.declarePlank && C.declarePlank(3, 1, 2); C.adjustRep('honesty', -6); for (const p of C.W.people) if (p.status === 'alive' && (p.fac === 'students' || p.fac === 'workers')) p.trueStance -= 1.8; } },
      { label: 'Thank him and say nothing will change', sub: 'Politely. Washington will remember.', fn: () => { g.us.interests++; C.adjustRep('honesty', 3); } },
      { label: 'Tell him to take it up with the people', sub: 'Heads turn. This will be repeated.', fn: () => { g.us.interests += 2; C.deed(2, 5); for (const p of C.W.people) if (p.status === 'alive' && (p.fac === 'students' || p.fac === 'peasants')) p.trueStance += 1.5; } },
    ] }); } });
  def({ id: 'us_agent', cat: 'social', t: 3, cd: 120, layer: 4, w: (g) => g.day > 300 ? 1 : 0, run: (g) => {
    C.usInit(); const who = localPeople('santiago', (p) => p.sex === 'M' && C.ageOf(p) > 28)[0];
    return card({ title: 'A "journalist" with a lot of money', icon: '🕴', body: 'A tall man with an American accent and a Havana newspaper\'s press card finds you in the Llano. He is interested in your programme, and in a fund. "We could help with arms. You would keep your independence. We would simply like to know a little more, from time to time."', choices: [
      { label: 'Accept arms and money (150 pesos, 12 rifles)', sub: 'Now there is a leash.', fn: () => { g.res.money += 150; g.res.guns += 12; g.res.ammo += 120; g.us.strings += 3; C.adjustRep('honesty', -5); g.flags.usFund = true; for (const p of C.W.people) if (p.status === 'alive' && p.fac === 'students' && rnd() < 0.3) p.trueStance -= 1.5; C.log('The crates have English stencilled on the sides.', 'warn'); } },
      { label: 'Throw him out', sub: 'The story gets around.', fn: () => { g.us.interests++; C.deed(3, 4); for (const p of C.W.people) if (p.status === 'alive' && p.fac === 'students') p.trueStance += 1.3; } },
      { label: 'Have him followed (12 pesos)', disabled: g.res.money < 12, sub: 'Learn who he works for.', fn: () => { g.res.money -= 12; C.log('He is staying at a hotel paid for by a company whose board includes a former ambassador.', 'info'); g.us.interests++; } },
    ] }); } });
  def({ id: 'mob_casino', cat: 'social', t: 3, cd: 90, layer: 4, w: (g) => g.scene.sid === 'habana' && g.day > 100 ? 2 : 0, run: (g) => {
    C.racketInit(); C.usInit();
    return card({ title: 'The men from the casinos', icon: '🎰', body: 'In Havana, the big hotels belong to men from Miami and New York who pay Batista\'s people a percentage. One of them offers you a deal through a lawyer: protection for their cash couriers and a small cut for your cause, no questions, no politics.', choices: [
      { label: 'Take their money (260 pesos now; 10 a day)', sub: 'It is a lot. It is also a leash with a very bad dog on the end.', fn: () => { g.res.money += 260; g.rackets.protect++; g.merc = clamp(g.merc + 10, 0, 100); g.us.strings++; C.adjustRep('honesty', -6); C.adjustRep('justice', -3); } },
      { label: 'No. We do not take money from the gambling houses.', sub: 'Students and the Church approve; the men grumble.', fn: () => { C.deed(3, 3); for (const p of C.W.people) if (p.status === 'alive' && (p.fac === 'students' || p.fac === 'church')) p.trueStance += 1.2; } },
    ] }); } });

  // =================================================================== the non-violent path
  def({ id: 'peaceful_protest', cat: 'social', t: 3, cd: 35, layer: 3, w: (g) => g.day > 25 && g.stats.killedArmy === 0 && g.stats.executed === 0 ? 2.5 : 0, run: (g) => {
    const sid = pick(['santiago', 'bayamo', 'manzanillo']); const marchers = localPeople(sid, (p) => C.ageOf(p) > 16 && C.ageOf(p) < 60 && p.trueStance > 0).slice(0, 8);
    if (marchers.length < 3) return null;
    return card({ title: `A silent march in ${S(sid).name}`, icon: '🕊', body: `Mothers and students, dressed in white and carrying flowers, plan to walk to the courthouse in ${S(sid).name} without a word, to ask for the release of the prisoners. They ask you to endorse it, and to make sure nobody has a weapon.`, choices: [
      { label: 'Endorse it and keep every weapon away', sub: 'You will see what the regime does to people who do not fight back.', fn: () => {
        const r = rnd(); C.deed(5, 6);
        if (r < 0.6) { const hit = marchers.slice(0, 2 + Math.floor(rnd() * 3)); C.log('Soldiers and police charge the march with clubs and rifle butts. Shots are fired.', 'bad'); hit.forEach((p, i) => { if (i < 2 && rnd() < 0.7) C.killOffscreen(p, 'army', `${C.tagName(p)} was killed by the police at a peaceful march`, 82, false); else { p.status = 'jailed'; C.addEvent({ type: 'arrest', victim: p, perpSide: 'army', sev: 62, pub: 0.8, x: 0, y: 0, settlement: sid, text: `${C.tagName(p)} was beaten and jailed at a peaceful march`, memText: 'They beat my child and put her in a cell for walking in silence' }); } }); g.regime.legit = clamp(g.regime.legit - 2.5, 0, 100); g.regime.heat += 2; }
        else if (r < 0.88) { marchers.slice(0, 3).forEach((p) => { p.status = 'jailed'; C.addEvent({ type: 'arrest', victim: p, perpSide: 'army', sev: 56, pub: 0.7, x: 0, y: 0, settlement: sid, text: `${C.tagName(p)} was arrested at a peaceful march`, memText: 'They arrested my mother for carrying flowers' }); }); g.regime.legit = clamp(g.regime.legit - 1.2, 0, 100); }
        else { C.log('The police stand aside. The march reaches the courthouse. Nothing changes — except that thousands saw it.', 'good'); g.regime.legit = clamp(g.regime.legit - 1.5, 0, 100); for (const p of C.W.people) if (p.status === 'alive' && p.fac === 'church') p.trueStance += 1.5; }
      } },
      { label: 'Tell them the regime only understands rifles', sub: 'You lose a mass movement that did not need guns.', fn: () => { C.deed(5, -4); } },
    ] }); } });

  // misconduct reacts to the drift
  const mc = defs().find((e) => e.id === 'misconduct');
  if (mc) { const w0 = mc.w; mc.w = (g) => w0(g) + (g.merc || 0) * 0.035; }
})();
