// The opening: the Granma crossing, the helm near the coast, the choice of landing site, the landing itself.
// Everything hidden about the coast (threat levels, patrols) is re-rolled every run so a replay is never a stronger start.
(function () {
  const C = window.C, G = () => C.G, T = C.T, TL = C.TILE, clamp = C.clamp;
  const GR = TL.G, FOR = TL.FOR, ROAD = TL.ROAD, DEEP = TL.DEEP, SHAL = TL.SHAL, ROCK = TL.ROCK, SAND = TL.SAND, TRAIL = TL.TRAIL;
  const rnd = () => Math.random();
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  // ------------------------------------------------------------------ the coast
  // THE FOUR LANDING SITES: name, position along the coast (tile x), description and base threat (0.35–0.85). Each run multiplies the base by a random 0.55–1.5 factor, so nobody can learn 'the safe one'.
  const SITES = [
    { id: 'cabo',      x: 20,  name: 'Cabo Cruz', desc: 'A rocky point under a lighthouse. A tiny cove. The mountains are close — so are the guards.', base: 0.85, inland: 'The Sierra is two days away.' },
    { id: 'coloradas', x: 52,  name: 'Las Coloradas', desc: 'A mangrove swamp. The boat will ground far from dry land. Quiet, but the wading is brutal.', base: 0.55, inland: 'Cane country behind it; the army knows this coast.' },
    { id: 'playa',     x: 82,  name: 'Long beach by Niquero', desc: 'A firm white beach — an easy landing, and an army post a few kilometres up the road.', base: 0.8, inland: 'A road, a town, and the barracks.' },
    { id: 'rio',       x: 104, name: 'The Toro river mouth', desc: 'A channel that winds inland between marsh. Few soldiers. Mosquitoes, mud, and a long way to the mountains.', base: 0.35, inland: 'Four hungry days to the foothills.' },
  ];
  C.LANDING_SITES = SITES;

  // Generate the coast scene: deep sea, reefs, a cliff-and-reef coast everywhere except the four sites (a rocky cove with a lighthouse, a mangrove swamp, a long beach with an army post, a winding river mouth), hills and forest inland.
  C.gen.bay = function (s) {
    const R = s.R, nz = C.makeNoise(31), n2 = C.makeNoise(57);
    s.rect(0, 0, s.tw, s.th, DEEP);
    const coast = (x) => 22 + nz(x * 0.045, 3) * 7;
    for (let x = 0; x < s.tw; x++) {
      const cy = Math.floor(coast(x));
      for (let y = 0; y < cy; y++) { const h = n2(x * 0.08, y * 0.08); s.set(x, y, y < cy - 12 && h > 0.55 ? ROCK : (h > 0.4 ? FOR : GR)); }
      for (let y = cy; y < cy + 2; y++) s.set(x, y, ROCK);           // cliffs and reef everywhere except the four sites
    }
    // reefs out at sea
    for (let i = 0; i < 26; i++) { const x = R.irange(4, s.tw - 4), y = R.irange(34, s.th - 16); s.disc(x, y, 0.6 + R() * 0.9, ROCK); }
    SITES.forEach((st) => {
      const cy = Math.floor(coast(st.x)); st.cy = cy;
      if (st.id === 'cabo') {
        for (let y = cy - 1; y < cy + 3; y++) for (let x = st.x - 3; x <= st.x + 2; x++) s.set(x, y, y < cy + 1 ? SAND : SHAL);
        for (let y = cy + 3; y < cy + 6; y++) for (let x = st.x - 4; x <= st.x + 3; x++) s.set(x, y, SHAL);
        s.line([[st.x, cy - 1], [st.x + 3, cy - 12], [st.x + 8, cy - 18]], 2, TRAIL);
        s.addBld('casa', st.x + 7, cy - 9, { label: 'Faro de Cabo Cruz' });
      } else if (st.id === 'coloradas') {
        for (let y = cy - 2; y < cy + 6; y++) for (let x = st.x - 9; x <= st.x + 9; x++) s.set(x, y, y < cy + 3 ? FOR : SHAL);
        for (let y = cy + 6; y < cy + 10; y++) for (let x = st.x - 10; x <= st.x + 10; x++) s.set(x, y, SHAL);
        s.line([[st.x, cy - 2], [st.x + 2, cy - 14]], 2, TRAIL);
      } else if (st.id === 'playa') {
        for (let y = cy - 2; y < cy + 2; y++) for (let x = st.x - 10; x <= st.x + 10; x++) s.set(x, y, SAND);
        for (let y = cy + 2; y < cy + 6; y++) for (let x = st.x - 11; x <= st.x + 11; x++) s.set(x, y, SHAL);
        s.line([[st.x, cy - 2], [st.x + 8, cy - 9], [st.x + 14, cy - 14]], 2, ROAD);
        s.addBld('cuartel', st.x + 14, cy - 18, { label: 'Puesto de la Guardia Rural' });
      } else if (st.id === 'rio') {
        const pts = []; for (let y = cy + 10; y >= cy - 22; y -= 3) pts.push([st.x + Math.sin(y * 0.3) * 5, y]);
        s.line(pts, 3.2, SHAL);
        for (let y = cy + 2; y < cy + 8; y++) for (let x = st.x - 5; x <= st.x + 5; x++) s.set(x, y, SHAL);
        for (let y = cy - 20; y < cy; y++) for (let x = st.x - 8; x <= st.x + 8; x++) if (s.get(x, y) === GR && R() < 0.5) s.set(x, y, FOR);
      }
      st.wx = st.x * T + 8; st.wy = (cy + 1) * T;
    });
    s.spawn = { x: 56 * T, y: (s.th - 8) * T };
    s.title = 'The Granma';
    s.landings = SITES;
  };

  // ------------------------------------------------------------------ the crossing
  // Real seconds per day at sea (seven days ≈ 56 s).
  const DAY_LEN = 8;                                   // real seconds per day at sea
  // Calendar labels for the crossing (25 Nov – 2 Dec 1956).
  const DATES = ['25 Nov', '26 Nov', '27 Nov', '28 Nov', '29 Nov', '30 Nov', '1 Dec', '2 Dec'];

  const party = () => C.squadPeople();
  const everyone = (fn) => { for (const p of party()) fn(p); };
  function setNeeds(dn, dm) { everyone((p) => { if (dn) for (const k in dn) p.needs[k] = clamp(p.needs[k] + dn[k], 0, 100); if (dm) p.morale = clamp(p.morale + dm, 0, 100); }); }

  // Start the opening: move the party to the bay scene, put the Granma on it with everyone on deck, roll the hidden threats, freeze the calendar, show the objective.
  C.beginCrossing = function () {
    const g = G();
    const ids = C.W.party.filter((id) => id !== C.W.player);
    for (const id of ids) C.moveTo(C.P(id), 'bay');
    C.enterScene('bay', { far: true });
    const s = g.scene; const v = C.addVehicle(s, 'yacht', s.spawn.x, s.spawn.y, -Math.PI / 2, { fuel: 0 });
    v.deck = true; v.lights = false;
    g.sea = { active: true, phase: 'cross', t: 0, day: 0, veh: v, alert: 0, fired: {}, startY: v.y, threat: {}, label: '25 Nov 1956 · at sea' };
    for (const st of SITES) g.sea.threat[st.id] = clamp(st.base * (0.55 + rnd() * 0.95), 0.1, 1.3);   // hidden, new every run
    // the party on deck
    const slots = []; for (let u = -26; u <= 26; u += 5) for (let w = -8; w <= 8; w += 5) slots.push({ u, w });
    slots.sort(() => rnd() - 0.5);
    const place = (a, i) => { const sl = slots[i % slots.length]; a.deck = { u: sl.u, w: sl.w, du: 0, dw: 0, t: rnd() * 4 }; a.x = v.x + sl.w; a.y = v.y - sl.u; a.moving = false; a.weaponOut = false; a.alpha = 1; };
    let i = 0; for (const a of s.actors) if (a.side === 'rebel' || a.isPlayer) { if (a.isPlayer) { a.deck = { u: 0, w: 0 }; a.x = v.x; a.y = v.y; } else place(a, i++); }
    g.minPerSec = 0; g.hour = 8; g.cam.z = 3.2;
    g.mission = { text: 'Seven days at sea, eighty-two men, one leaking yacht. Move about the deck (WASD), talk to your men (E). The helm is not yours until land is sighted.', kind: 'sea' };
    C.log('25 November 1956. The Granma leaves Tuxpan in the dark, overloaded, with the lights off.', 'info');
    for (const p of party()) { p.needs.energy = Math.min(p.needs.energy, 62); }
  };

  // deck movement for the player while at sea
  // WASD movement of the player on the deck (clamped to the deck rectangle).
  C.deckMove = function (dt, mx, my) {
    const g = G(), a = g.player, v = g.sea.veh; const d = a.deck;
    const sp = 30; d.w = clamp(d.w + mx * sp * dt, -8, 8); d.u = clamp(d.u - my * sp * dt, -27, 27);
    a.moving = !!(mx || my); if (mx) a.face = mx > 0 ? 1 : -1;
    a.x = v.x + d.w; a.y = v.y - d.u; a.anim += (mx || my) ? dt * 40 : 0;
  };
  // Crew on deck shuffle about, sway and tire slowly.
  C.deckActorUpdate = function (s, a, dt) {
    const g = G(), v = g.sea && g.sea.veh; if (!v || !a.deck) return;
    const d = a.deck; d.t -= dt;
    if (d.t <= 0) { d.t = 2 + rnd() * 6; d.tu = clamp(d.u + (rnd() - 0.5) * 8, -27, 27); d.tw = clamp(d.w + (rnd() - 0.5) * 6, -8, 8); if (rnd() < 0.15) { d.tu = d.u; d.tw = d.w; } }
    if (d.tu !== undefined) { const du = d.tu - d.u, dw = d.tw - d.w, l = Math.hypot(du, dw); if (l > 0.6) { d.u += du / l * 9 * dt; d.w += dw / l * 9 * dt; a.moving = true; a.anim += dt * 12; if (Math.abs(dw) > 0.3) a.face = dw > 0 ? 1 : -1; } else a.moving = false; }
    a.x = v.x + d.w; a.y = v.y - d.u;
    // the sea makes people ill: faces and needs reflect it
    if (g.sea.phase === 'cross' && rnd() < dt * 0.05) a.p.needs.energy = clamp(a.p.needs.energy - 1, 0, 100);
  };

  function card(c) { C.ui.card(c); }
  // THE SIX CROSSING EVENTS: seasickness (day 1), the leak (2), a man overboard (3), the storm (4), a plane (5), the ration fight (6). Each presents choices that move needs, trust, supplies or the chance of losing someone.
  const EVENTS = [
    { day: 1, run: () => card({ title: 'The sea takes them', icon: '🤢', body: 'By the second night the yacht is rolling hard. Men are bent over the rail; the deck stinks of vomit. The cook has lemons and a little sugar. Someone says out loud that they should have waited for better weather.',
      choices: [
        { label: 'Hand out the lemons and sugar (3 food)', fn: () => { G().res.food = Math.max(0, G().res.food - 3); setNeeds({ energy: 6 }, 4); } },
        { label: 'Order silence and discipline', sub: 'Some will respect it. Some will not forget it.', fn: () => { setNeeds(null, -3); everyone((p) => { if (p.traits.includes('idealist') || p.traits.includes('stoic')) C.addTrust(p, 2); else C.addTrust(p, -1); }); } },
        { label: 'Let them be', fn: () => { setNeeds({ energy: -4 }, -2); } },
      ] }) },
    { day: 2, run: () => card({ title: 'The yacht is taking water', icon: '🚤', body: 'She was built for a dozen passengers. Water is rising in the bilge, and the pump jams. Equipment is heavy and everyone is standing on everyone.',
      choices: [
        { label: 'Throw cargo overboard', sub: 'Lose a third of the cartridges and food. She rides higher.', fn: () => { const r = G().res; r.ammo = Math.floor(r.ammo * 0.67); r.food = Math.floor(r.food * 0.7); setNeeds(null, -3); C.log('You throw boxes into the sea.', 'warn'); } },
        { label: 'Bail by hand, in shifts, all night', sub: 'Everyone is exhausted; nothing is lost.', fn: () => { setNeeds({ energy: -14 }, 2); everyone((p) => { if (p.traits.includes('stoic') || p.traits.includes('brave')) C.addTrust(p, 1.5); }); } },
        { label: 'Press on and hope', sub: 'A gamble.', fn: () => { if (rnd() < 0.5) { const r = G().res; r.ammo = Math.floor(r.ammo * 0.5); r.med = Math.max(0, r.med - 2); C.log('A wave comes over the side. Boxes of cartridges are ruined.', 'bad'); setNeeds(null, -6); } else { C.log('She holds. Barely.', 'info'); } } },
      ] }) },
    { day: 3, run: () => {
      const cand = party().filter((p) => p.id !== C.W.player && !p.roster); const who = cand.length ? pick(cand) : null; if (!who) return;
      card({ title: `${C.tagName(who)} is overboard`, icon: '🌊', body: `In the dark, ${C.tagName(who)} lost his footing at the rail. Someone is shouting his name. The yacht is moving away from the place where he fell.`,
        choices: [
          { label: 'Turn back and search', sub: 'Costs time and food, and every hour near the coast is a risk. He may live.', fn: () => { const g = G(); g.res.food = Math.max(0, g.res.food - 4); g.sea.t += DAY_LEN * 0.7; g.sea.alert += 0.08; if (rnd() < 0.7) { C.log(`${C.tagName(who)} is pulled from the water, coughing. The men cheer.`, 'good'); setNeeds(null, 6); everyone((p) => C.addTrust(p, 2.5)); } else { C.log(`${C.tagName(who)} is not found.`, 'bad'); C.killOffscreen(who, null, `${C.tagName(who)} was lost overboard on the way to Cuba`, 40, false); setNeeds(null, -5); } } },
          { label: 'Press on — we cannot turn back', sub: 'The mission comes first. They will remember it.', fn: () => { C.log(`${C.tagName(who)} is left in the water.`, 'bad'); C.killOffscreen(who, null, `${C.tagName(who)} was left behind in the sea`, 55, false); everyone((p) => { C.addTrust(p, -3.5); p.morale = clamp(p.morale - 5, 0, 100); }); } },
        ] }); } },
    { day: 4, run: () => card({ title: 'Storm', icon: '⛈', body: 'A norther comes up before dawn. The sea breaks over the bow. A boat this size should not be out in it.',
      choices: [
        { label: 'Heave to and ride it out', sub: 'Slower — but safer.', fn: () => { G().sea.t -= DAY_LEN * 0.35; G().weather.target = 1; setNeeds({ energy: -8 }, -2); } },
        { label: 'Keep your heading', sub: 'Faster. The sea decides who goes into it.', fn: () => { G().weather.target = 1; setNeeds({ energy: -12 }, -4); if (rnd() < 0.45) { const c = party().filter((p) => p.id !== C.W.player && !p.roster && p.needs.energy < 60); const who = c.length ? pick(c) : null; if (who) { C.log(`${C.tagName(who)} was swept off the deck.`, 'bad'); C.killOffscreen(who, null, `${C.tagName(who)} was swept overboard in a storm`, 50, false); } } } },
      ] }) },
    { day: 5, run: () => card({ title: 'A plane, far off', icon: '✈', body: 'A navy patrol plane crosses the horizon. It does not turn. It might not have seen you. It might have radioed anyway.',
      choices: [
        { label: 'Everyone below, rifles hidden', fn: () => { setNeeds(null, -1); if (rnd() < 0.3) G().sea.alert += 0.1; } },
        { label: 'Hold your course and your nerve', fn: () => { if (rnd() < 0.55) G().sea.alert += 0.18; } },
      ] }) },
    { day: 6, run: () => card({ title: 'Rations', icon: '🍞', body: 'The food is nearly gone. There is a fight over a tin of condensed milk, and a man who did not eat is staring at a man who did.',
      choices: [
        { label: 'Share equally — you eat the same as the rest', sub: 'Slow hunger for all.', fn: () => { const g = G(); g.res.food = Math.max(0, g.res.food - 4); everyone((p) => { C.addTrust(p, 2); }); } },
        { label: 'Fighters first, the sick last', sub: 'Efficient. Some will resent it.', fn: () => { everyone((p) => { if (p.hp < p.maxHp * 0.8 || p.needs.energy < 40) { p.needs.food = clamp(p.needs.food - 6, 0, 100); C.addTrust(p, -2); } else C.addTrust(p, 0.5); }); } },
        { label: 'Leave it to the men to sort out', sub: 'There will be a fight.', fn: () => { everyone((p) => { p.anger = clamp(p.anger + 8, 0, 100); }); G().sea.brawl = true; } },
      ] }) },
  ];

  // Per-frame crossing logic: sail north steadily (cross phase), fire the day's event, set the sea clock; at the end start the approach. In the approach phase it runs the dawn light and the patrol boat.
  C.seaUpdate = function (dt) {
    const g = G(), S = g.sea; if (!S || !S.active) return;
    const v = S.veh, s = g.scene;
    S.t += dt;
    if (S.phase === 'cross') {
      const L = DAY_LEN, day = Math.min(7, Math.floor(S.t / L));
      // sail north at a steady pace; the whole crossing is 7 days
      const prog = clamp(S.t / (L * 7), 0, 1); const target = S.startY - (S.startY - (s.th - 50) * T) * prog;
      v.y += (target - v.y) * Math.min(1, dt * 4); v.spd = 14;
      g.hour = (8 + 24 * (S.t / L)) % 24; g.min = g.hour * 60;
      S.label = `${DATES[Math.min(7, day)]} 1956 · at sea`;
      for (const e of EVENTS) if (day >= e.day && !S.fired[e.day]) { S.fired[e.day] = true; e.run(); }
      g.weather.rain += (Math.min(g.weather.target, 1) - g.weather.rain) * Math.min(1, dt * 0.5);
      if (S.t >= L * 7) startApproach();
    } else if (S.phase === 'approach') {
      g.hour = 4.2 + Math.min(2.5, (S.t - S.t0) / 70); g.min = g.hour * 60;
      S.label = '2 Dec 1956 · the coast';
      patrolUpdate(dt);
    }
  };

  // The helm unlocks: everyone goes below (into the vehicle), a patrol boat appears, and a card describes the four sites.
  function startApproach() {
    const g = G(), S = g.sea, s = g.scene, v = S.veh; S.phase = 'approach'; S.t0 = S.t; g.weather.target = 0;
    // from now the boat is yours: put everyone below and you at the helm
    for (const a of s.actors) if ((a.side === 'rebel' || a.isPlayer) && a.deck) { a.deck = null; }
    for (const a of s.actors) if (a.side === 'rebel' && !a.isPlayer) C.enterVehicle(a, v);
    C.enterVehicle(g.player, v); g.vehicle = v; v.ang = -Math.PI / 2; v.spd = 10;
    g.sea.hasHelm = true;
    // patrol boat
    const pb = C.addVehicle(s, 'boat', 76 * T, (s.th - 38) * T, 0, { fuel: 30 }); pb.driving = false; pb.army = true; pb.patrol = { dir: 1, x0: 40 * T, x1: 100 * T }; S.patrol = pb;
    g.mission = { text: 'Land ahead. The helm is yours (WASD). Pick a landing site and run her aground (E to land when close). Each coast has a different reception — and nobody knows exactly what.', kind: 'sea' };
    C.ui.card({ title: 'Land ahead', icon: '🏝', body: 'Dawn on 2 December. A low dark line on the north. The coast of Oriente — and four places to put ashore.\n\n' + SITES.map((st) => `• ${st.name}: ${st.desc}`).join('\n') + '\n\nThe helm is yours now. Nobody on board knows what waits at each place.', choices: [{ label: 'Take the helm', fn: () => { } }] });
    C.log('Land ahead. The helm is yours.', 'info');
  }

  // The patrol boat sweeps the coast; if it comes within 190 px at dawn it may spot you (alert +0.35); a plane may circle later (+0.2).
  function patrolUpdate(dt) {
    const g = G(), S = g.sea, s = g.scene, pb = S.patrol, v = S.veh; if (!pb || pb.wreck) return;
    pb.x += pb.patrol.dir * 22 * dt; pb.ang = pb.patrol.dir > 0 ? 0 : Math.PI; if (pb.x > pb.patrol.x1) pb.patrol.dir = -1; if (pb.x < pb.patrol.x0) pb.patrol.dir = 1;
    const d = Math.hypot(pb.x - v.x, pb.y - v.y);
    if (!S.spotted && d < 190 && g.hour > 4.4 && rnd() < dt * 0.6) { S.spotted = true; S.alert += 0.35; C.say(g.player, '¡Una patrullera!', '#7a1d1d', 3); C.ui.toast('A patrol boat has seen you!'); C.log('A patrol boat turns toward you. The coast will be waiting.', 'bad'); }
    if (!S.plane && S.t - S.t0 > 55 && rnd() < dt * 0.05) { S.plane = true; S.alert += 0.2; C.log('A plane circles above the coast, low.', 'warn'); }
  }

  // landing: E near the shore or running aground
  // Is the boat touching land (within 40 px)?
  C.seaNearLand = function () {
    const g = G(), v = g.sea && g.sea.veh; if (!v) return false; const s = g.scene;
    for (let r = 0; r <= 40; r += 10) for (let a = 0; a < 6.28; a += 0.8) { const t = C.tileAt(s, v.x + Math.cos(a) * r, v.y + Math.sin(a) * r); if (t !== DEEP && t !== SHAL) return true; }
    return false;
  };
  // Land: choose the nearest site (a landing between sites adds +0.18 threat) and resolve it.
  C.seaLand = function () {
    const g = G(), S = g.sea; if (!S || S.phase !== 'approach' || S.landed) return; if (!C.seaNearLand()) { C.ui.toast('Not close enough to land'); return; }
    S.landed = true; const v = S.veh;
    let site = null, bd = 1e9; for (const st of SITES) { const d = Math.hypot(st.wx - v.x, st.wy - v.y); if (d < bd) { bd = d; site = st; } }
    const threat = S.threat[site.id] + (bd > 320 ? 0.18 : 0);      // a blind landing between the sites is worse
    resolveLanding(site, threat);
  };

  // Outcome = threat + 0.55·alert + noise → ashore unseen / under fire / ambushed on the beach / massacre (60–100% of the party die; sometimes the player; sometimes everyone). Supplies are lost in proportion, the dead's families hear of it, survivors are shaken, and the story continues to Alegría de Pío with an enemy multiplier of 0.7–1.7.
  function resolveLanding(site, threat) {
    const g = G(), S = g.sea;
    const risk = threat + S.alert * 0.55 + (rnd() - 0.5) * 0.4;
    const people = party().filter((p) => p.id !== C.W.player);
    const dead = [], hurt = [];
    let kind, f, supplies, text;
    if (risk < 0.42) { kind = 'quiet'; f = 0; supplies = 0.92; text = 'Nothing moves on the beach. You wade ashore with the water to your chest and a wet, silent dawn around you.'; }
    else if (risk < 0.78) { kind = 'contact'; f = 0.04 + rnd() * 0.12; supplies = 0.75; text = 'Shots from the dunes while you are still in the water. A machine gun, a few rifles. You get ashore — not all of you.'; }
    else if (risk < 1.05) { kind = 'ambush'; f = 0.25 + rnd() * 0.25; supplies = 0.45; text = 'They were waiting. Machine guns open on the boat as the keel touches the sand. Men go down in the shallows. There is nowhere to hide on a beach.'; }
    else { kind = 'massacre'; f = 0.6 + rnd() * 0.4; supplies = 0.2; text = 'It is a slaughter. The boat is ringed by fire from three sides and from the air. The sea turns red around the hull.'; }
    const playerDies = kind === 'massacre' && rnd() < 0.35 + (f - 0.6) * 0.8;
    for (const p of people) {
      let pr = f * (p.roster ? 0.55 : 1) * (p.exp < 15 ? 1.1 : 0.9);
      if (kind === 'massacre' && f > 0.92) pr = 0.97;
      if (rnd() < pr) dead.push(p); else if (rnd() < f * 0.9) hurt.push(p);
    }
    for (const p of dead) { C.killOffscreen(p, 'army', `${C.tagName(p)} was killed in the surf at the landing`, 70, false); if (p.actor) p.actor.gone = true; }
    for (const p of hurt) { p.hp = Math.max(5, p.hp - p.maxHp * (0.3 + rnd() * 0.4)); p.limp = p.limp || rnd() < 0.3; p.fear = clamp(p.fear + 20, 0, 100); }
    everyone((p) => { p.fear = clamp(p.fear + (kind === 'quiet' ? 3 : kind === 'contact' ? 12 : 30), 0, 100); p.needs.food = Math.max(5, p.needs.food - 15); });
    const r = g.res; r.ammo = Math.floor(r.ammo * supplies); r.food = Math.floor(r.food * supplies); r.med = Math.floor(r.med * supplies); r.gren = Math.floor(r.gren * supplies); r.guns = Math.floor(r.guns * supplies);
    g.flags.landing = { site: site.id, kind, dead: dead.length, hurt: hurt.length, risk };
    g.stats.landingDead = dead.length;
    const survivors = people.length - dead.length;
    const mult = clamp(0.8 + risk * 0.55 + (rnd() - 0.5) * 0.35, 0.7, 1.7);
    C.ui.card({ title: `${site.name}: ${kind === 'quiet' ? 'ashore unseen' : kind === 'contact' ? 'under fire' : kind === 'ambush' ? 'ambushed on the beach' : 'massacre'}`, icon: kind === 'massacre' ? '💀' : kind === 'ambush' ? '🔥' : '🏝',
      body: `${text}\n\n${dead.length ? `Dead: ${dead.length}${dead.length <= 6 ? ' (' + dead.map(C.tagName).join(', ') + ')' : ''}.` : 'Nobody was killed.'} ${hurt.length ? `${hurt.length} wounded.` : ''}\n${survivors} of the ${people.length} who crossed with you are alive${playerDies ? '' : ', counting you ' + (survivors ? 'with them' : 'alone')}.\n\n${site.inland}`,
      choices: [{ label: playerDies ? 'Go on…' : 'Go inland', fn: () => { if (playerDies) { g.sea.active = false; g.over = { kind: 'dead', cause: 'killed at the landing' }; return; } C.endSea(site, kind, mult, survivors); } }] });
  }

  // Leave the sea phase and start Alegría de Pío with the survivors.
  C.endSea = function (site, kind, mult, survivors) {
    const g = G(); g.sea.active = false; g.vehicle = null; g.minPerSec = 1.5;
    const intro = `${kind === 'quiet' ? 'Three days of marching' : 'Three days of hiding and marching'} inland from ${site.name}. Wet boots, no food, no sleep. On 5 December, at midday, you rest in a cane field at Alegría de Pío. Someone has told the army where you are.`;
    C.startAlegria({ mult, intro });
  };
})();
