// After Havana: a short run of governing decisions that calibrate the state you inherit, and then the flash-forward
// to April 1961 — the American-backed invasion at Playa Girón (the Bay of Pigs). Win or lose there, the game is over.
(function () {
  const C = window.C, G = () => C.G, clamp = C.clamp, rnd = Math.random;

  // Start the post-victory phase: compute the six meters (support from faction means, readiness from party size, unity from the drift/strings/executions, repression from fear/executions/atrocities, tension with Washington from American interests crossed, economy 50) and show the first card.
  C.beginGoverning = function () {
    const g = G(); if (g.over || g.gov) return;
    C.usInit && C.usInit(); C.racketInit && C.racketInit();
    const t = C.factionTable(); const avg = t.rows.reduce((a, r) => a + r.mean * (r.n || 1), 0) / Math.max(1, t.rows.reduce((a, r) => a + (r.n || 1), 0));
    const party = C.squadPeople().length;
    g.gov = { step: 0, done: [false, false, false, false, false, false, false, false], cur: -1, log: [], m: {
      sup: clamp(50 + avg * 0.55, 5, 95),                                     // popular support
      rdy: clamp(18 + Math.min(30, party * 0.7) + (g.regime.armyMorale < 40 ? 6 : 0), 5, 90),   // militia and army readiness
      unity: clamp(66 - (g.merc || 0) * 0.35 - (g.us.strings || 0) * 4 - (g.stats.executed || 0) * 0.2, 10, 90),
      rep: clamp(g.rep.fear * 0.55 + (g.stats.executed || 0) * 0.5 + (g.stats.atrocities ? g.stats.atrocities.rebel * 2 : 0), 0, 100),   // repression
      usT: clamp(18 + (g.us.interests || 0) * 8 + (g.us.outrage || 0) * 6 - (g.us.strings || 0) * 3, 5, 100),   // tension with Washington
      econ: 50,
    } };
    if (C.govPlaces) C.govPlaces(g.scene);
    g.minPerSec = 0; g.speed = 1;
    C.ui.card({ title: 'Havana, January 1959', icon: '🏙', body: 'The column rolls into Havana under a rain of paper. The war is over and the government is yours — a country with a ruined sugar economy, a million people out of work every dead season, a Church, an army with no head, a great American embassy, and sixty thousand cheering people who all want something different.\n\nA few decisions will fix what kind of state you are when someone comes for it.', choices: [{ label: 'Begin', fn: () => next() }] });
  };

  // THE EIGHT GOVERNING DECISIONS: land, trials, press and the vote, American-owned utilities, schools and the Church, the army and militias, women and race, trade and oil. Each option adjusts the meters (see adj).
  const STEPS = [
    () => ({ title: 'The land', icon: '🌾', body: 'Half the cane belongs to a handful of owners, a good part of them American companies. The cane-cutters want the land now. The owners want you to remember who pays.', choices: [
      { label: 'Break the great estates up at once', sub: 'Peasants and workers rejoice. Owners and Washington bristle.', fn: () => adj({ sup: +8, usT: +14, unity: -4, econ: -6 }, 'land', 2) },
      { label: 'Distribute idle land; compensate the rest slowly', sub: 'The middle road.', fn: () => adj({ sup: +4, usT: +4, econ: +1 }, 'land', 1) },
      { label: 'Keep the estates for now', sub: 'Order and the sugar quota first.', fn: () => adj({ sup: -7, usT: -6, unity: -3, econ: +3 }, 'land', 0) },
    ] }),
    () => ({ title: 'The old regime', icon: '⚖', body: 'Batista\'s torturers and informers are in the cells. Crowds outside the courthouses want blood, and some of your own men have already begun settling scores.', choices: [
      { label: 'Revolutionary tribunals and firing squads', sub: 'Fast. Popular with many. Not with those who see themselves in the dock.', fn: () => adj({ sup: +2, rep: +14, usT: +6, unity: -2 }, 'justice', 2) },
      { label: 'Fair trials, slowly, by lawyers', sub: 'Order and legitimacy at the cost of angry crowds.', fn: () => adj({ sup: +1, rep: -5, unity: +3, rdy: -2 }, 'justice', 1) },
      { label: 'Amnesty for everyone below the rank of colonel', sub: 'Healing — or a gift to the enemy.', fn: () => adj({ sup: -3, rep: -10, rdy: -4, unity: +2 }, 'justice', 0) },
    ] }),
    () => ({ title: 'The press and the vote', icon: '🗳', body: 'The 1940 Constitution promised elections. The newspapers, many of them bought by Batista\'s friends, are printing worry. You promised a return to democracy.', choices: [
      { label: 'Set a date for elections, keep the press free', sub: 'You keep your word. You may lose the vote.', fn: () => adj({ sup: +5, rep: -8, unity: +6, usT: -4, rdy: -3 }, 'democracy', 2) },
      { label: 'Elections later: "the revolution first"', sub: 'Order, momentum, and a promise that must be kept some day.', fn: () => adj({ sup: -1, rep: +8, unity: -4, rdy: +4 }, 'democracy', 1) },
      { label: 'Close the papers that backed Batista', sub: 'Quiet, efficient — and a precedent.', fn: () => adj({ sup: -3, rep: +12, unity: -6, rdy: +2 }, 'democracy', 0) },
    ] }),
    () => ({ title: 'The Americans\' phone company', icon: '☎', body: 'American companies own the phones, the electricity, the refineries and half the sugar. The embassy sends a note — polite, and unmistakably a note. The people expect you to take what the country needs.', choices: [
      { label: 'Nationalise the utilities and the refineries', sub: 'Nobody in the country will fight for the phone company. Washington will take notice.', fn: () => adj({ sup: +7, usT: +22, econ: -5, unity: -3 }, 'property', 2) },
      { label: 'Negotiate: partial ownership, bonds as compensation', sub: 'Sensible; slow; the radicals say you are selling out.', fn: () => adj({ sup: -2, usT: +3, econ: +4, unity: -4 }, 'property', 1) },
      { label: 'Leave things as they are', sub: 'Washington approves. Your own people do not.', fn: () => adj({ sup: -9, usT: -10, econ: +4, unity: -7 }, 'property', 0) },
    ] }),
    () => ({ title: 'Schools and the Church', icon: '🏫', body: 'Almost half the country\'s countryside cannot read. Thousands of young volunteers could go out to teach. Most of the schools that exist are run by the Church, which is nervous and not unreasonably.', choices: [
      { label: 'A national literacy campaign, with volunteers in every village', sub: 'Immense goodwill. Cardinals are uneasy.', fn: () => adj({ sup: +8, rdy: +5, unity: +2, econ: -2 }, 'health', 2) },
      { label: 'Expand schools and clinics steadily', sub: 'A good, slow thing.', fn: () => adj({ sup: +3, econ: -1 }, 'health', 1) },
      { label: 'Leave the schools to the Church for now', sub: 'Quiet. Many of the poor stay unlettered.', fn: () => adj({ sup: -4, unity: +2 }, 'health', 0) },
    ] }),
    () => ({ title: 'The army and the militias', icon: '🪖', body: 'Batista\'s army is in barracks, leaderless. Thousands of armed volunteers fill the plazas. Exiles in Miami are not sleeping.', choices: [
      { label: 'Disband the old army; arm the militias and train them', sub: 'You control the guns. They are untested.', fn: () => adj({ rdy: +14, rep: +5, unity: -2, usT: +5 }, 'army', 2) },
      { label: 'Merge the rebel army with vetted officers', sub: 'A professional force; fewer true believers.', fn: () => adj({ rdy: +9, unity: -2, rep: +1 }, 'army', 1) },
      { label: 'Keep the old army intact under new officers', sub: 'Efficient on paper. A garrison full of men who fought you.', fn: () => adj({ rdy: -2, unity: -8, rep: -3 }, 'army', 0) },
    ] }),
    () => ({ title: 'Women and race', icon: '✊', body: 'The beaches, clubs and best jobs are still closed to Black Cubans. Women of the Mariana Grajales platoon ask whether the revolution is over. Federations for both are ready to be built.', choices: [
      { label: 'Legal equality, open clubs and beaches, women in commands and unions', sub: 'Many are overjoyed. Some elders and clubs resist.', fn: () => adj({ sup: +6, unity: +4, rdy: +3 }, 'race', 2) },
      { label: 'End formal segregation; move gradually', sub: 'A steady course.', fn: () => adj({ sup: +2, unity: +1 }, 'race', 1) },
      { label: 'The revolution comes first — these can wait', sub: 'Many will remember.', fn: () => adj({ sup: -5, unity: -3 }, 'race', 0) },
    ] }),
    () => ({ title: 'Who will buy the sugar, and who will sell the oil?', icon: '🛢', body: 'The sugar quota is set in Washington. The oil comes from American companies. If either tightens, the economy will stall within a season. There is another buyer: a country on the other side of the world with ships and appetite.', choices: [
      { label: 'Trade with the Soviet Union and the Eastern bloc', sub: 'Security of supply — and a name Washington will not forgive.', fn: () => adj({ econ: +9, usT: +20, rdy: +7, unity: -4 }, 'alignment', 2) },
      { label: 'Try a balanced policy: sell to everyone', sub: 'Possible for a while.', fn: () => adj({ econ: +3, usT: +4 }, 'alignment', 1) },
      { label: 'Stay inside the American economy and ask for terms', sub: 'The quota holds. So does the leash.', fn: () => adj({ econ: +5, usT: -8, sup: -5, unity: -5 }, 'alignment', 0) },
    ] }),
  ];

  // Apply an option's meter changes, a small honesty cost if you backtrack on a declared plank, and show the next card.
  function adj(d, key, level) {
    const g = G(), m = g.gov.m; for (const k in d) m[k] = clamp(m[k] + d[k], 0, 100);
    if (g.platform && g.platform.declared) { const idx = C.PLANK_IDX[key]; if (idx !== undefined) { if (g.platform.real[idx] !== level) C.adjustRep('honesty', g.platform.declared[idx] && g.platform.pub[idx] > level ? -4 : 0); } }
    const i = g.gov.cur >= 0 ? g.gov.cur : g.gov.step; g.gov.done[i] = true; g.gov.cur = -1; g.gov.step = g.gov.done.filter(Boolean).length; next();
  }
  // Show the next decision, or the flash-forward after the last.
  function next() {
    const g = G(); const left = g.gov.done.filter((d) => !d).length;
    if (!left) { flashForward(); return; }
    // the matters are decided at their places (services.js): banners stand at the buildings where each waits
    if (C.govPlaces) C.govPlaces(g.scene);
    const where = (C.GOV_PLACES || []).map(([k, label], i) => (g.gov.done[i] ? null : label)).filter(Boolean);
    C.log(`${left} matter${left > 1 ? 's' : ''} still wait${left > 1 ? '' : 's'} for you in Havana: ${where.join('; ')}. Walk to the red banners and hold audience.`, 'info');
    if (g.scene && g.scene.sid !== 'habana') C.ui.toast('The matters of state wait in Havana.');
  }
  /** Take up one of the eight matters (called by the "hold audience" verb at its banner). */
  C.govDecide = function (i) { const g = G(); if (!g.gov || g.gov.done[i]) return; g.gov.cur = i; C.ui.card(STEPS[i]()); };

  // The April 1961 card: two years and three months later; the CIA-backed brigade is coming.
  function flashForward() {
    const g = G(), m = g.gov.m;
    C.ui.card({ title: 'April 1961', icon: '📅', body: 'You have governed for two years and three months. Not long. The sugar harvest is up in some provinces and down in others; there are queues in some shops; there are schools where there were none. Across the Straits of Florida, in the offices of an American agency, a plan prepared under the previous administration is about to be carried out.\n\nOn 15 April, planes painted with the markings of your own air force bomb your airfields.', choices: [{ label: 'The brigade lands at Playa Girón', fn: () => invasion() }] });
  }

  // Resolve Playa Girón: score = 0.30·support + 0.28·readiness + 0.20·unity + 0.10·economy + 0.12·(100 − 0.8·repression) − 0.14·drift − 2.5·American strings ± noise; above 48 wins. The text depends on how broad the support was; then the end screen.
  function invasion() {
    const g = G(), m = g.gov.m;
    const merc = g.merc || 0, str = (g.us && g.us.strings) || 0;
    const score = 0.30 * m.sup + 0.28 * m.rdy + 0.20 * m.unity + 0.10 * m.econ + 0.12 * (100 - m.rep * 0.8) - merc * 0.14 - str * 2.5 + (rnd() - 0.5) * 22;
    const win = score > 48;
    const detail = [`Popular support ${Math.round(m.sup)} · readiness ${Math.round(m.rdy)} · unity ${Math.round(m.unity)} · repression ${Math.round(m.rep)} · tension with Washington ${Math.round(m.usT)}`];
    g.gov.result = { win, score, m: Object.assign({}, m) };
    const intro = '17 April 1961. About 1,400 Cuban exiles — Brigade 2506 — trained in Guatemala by the CIA, carried on ships supplied by Washington and promised American air cover, come ashore at Playa Girón, in the Bay of Pigs. The plan assumes that the island will rise and that the government will fall in days. Washington hopes its own hand will not be seen.';
    const outcome = win
      ? (m.sup > 60 ? 'The island does not rise for them. Militias from the cane fields and the cities, the same people who cheered you in 1959, converge on the swamp road, old men with Springfields among them. In seventy-two hours the brigade is surrounded, out of ammunition, and in your prisons. The planes the exiles were promised do not come.' : 'Your army holds. The brigade is pinned in the swamp and starved of ammunition by the sheer disorder of its own plan. It surrenders in three days. The island did not rise for them — nor, wholly, for you.')
      : (m.rep > 60 ? 'You find out who you are afraid of. Whole garrisons stand aside; the roads fill with arrests, not volunteers. Fear holds the capital, and nothing else. The beachhead grows. Uprisings that Washington promised arrive in half a dozen provinces, and so does a civil war.' : 'The militias are brave and unready. The brigade holds its beachhead, the American ships stand offshore, and in three provinces garrisons change sides. The government falls apart as the war you thought was over begins again, on someone else\'s terms.');
    C.ui.card({ title: win ? 'Playa Girón: the brigade is beaten' : 'Playa Girón: the beachhead holds', icon: win ? '🏴' : '🪖', body: `${intro}\n\n${outcome}\n\n${detail[0]}`, choices: [{ label: 'See what you built', fn: () => C.endGame(win ? 'bop_win' : 'bop_loss') }] });
  }
})();
