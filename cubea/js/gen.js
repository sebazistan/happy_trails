/* CUBEA — gen.js : procedural Cubean population. Families are generated as lineages (grandparents -> parents -> kids),
   married across lineages inside a settlement, then given friends, compadres, coworkers, rivals, statuses (dead, jailed,
   exiled, away, soldiering) and political attitudes. Deterministic from the world seed. */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  // The 'present' of the world, as a fractional year (Dec 1956). Ages are computed from year of birth against this plus the game day.
  const NOW_Y = 1956.93;

  // THE WORLD DATABASE (C.W). people[] is dense by id (a person's id is its index) — this is the struct-of-arrays candidate for Unreal.
  // bySet maps a settlement id to the ids currently living there; houses[] are households; roster maps authored keys ('che','raul') to people.
  const W = (C.W = { people: [], bySet: {}, seed: 0, day: 0, player: -1, houses: [], nextEv: 1 });
  // Age in whole years at game day `day` (defaults to today).
  C.ageOf = (p, day) => Math.floor(NOW_Y + (day === undefined ? W.day : day) / 365.25 - p.yob);
  // Shorthand: the person with this id.
  C.P = (id) => W.people[id];

  // PERSON FACTORY. Everything about one Cubean is a plain object (see docs/SCHEMA.md); runtime actors are separate (ai.js makeActor).
  // ---------------- person factory ----------------
  // Pick a paternal surname for the settlement: mostly common Spanish names, a few Galician, West-Indian or Chinese-Cuban ones by place and background.
  function surnameFor(R, sid, eth) {
    if (eth === 'china') return R.pick(C.SURN_CN);
    const r = R();
    if (sid === 'cayo' || sid === 'sierra' || sid === 'palmarito') { if (r < 0.04) return R.pick(C.SURN_WI); }
    if ((sid === 'santiago' || sid === 'bayamo' || sid === 'manzanillo') && r < 0.05) return R.pick(C.SURN_WI);
    if (r < 0.09) return R.pick(C.SURN_GAL);
    return R.pick(C.SURNAMES);
  }
  // Sample an ethnicity ('blanca','mulata','negra','china','otra') with a distribution that differs between Havana and the east. Ethnicity is a SOCIAL position variable only (never tints the cube).
  function pickEth(R, sid) {
    const hab = sid === 'habana';
    return R.weighted(hab ? [['blanca', 70], ['mulata', 14], ['negra', 13], ['china', 2], ['otra', 1]]
      : [['blanca', 50], ['mulata', 28], ['negra', 19], ['china', 1], ['otra', 2]]);
  }
  // Ethnicity of a child from two parents' ethnicities (a white and a Black parent give a mulato child; otherwise one of the two).
  function mixEth(R, a, b) {
    if (a === b) return a;
    const s = new Set([a, b]);
    if (s.has('blanca') && s.has('negra')) return 'mulata';
    if (s.has('mulata')) return R.pick([a, b, 'mulata']);
    return R.pick([a, b]);
  }
  // Hair colour palette for the look generator.
  const HAIR = { blk: [30, 24, 20], brn: [74, 50, 32], gry: [150, 150, 150], wht: [235, 235, 235], red: [140, 70, 40], blo: [190, 160, 90] };

  // The FACE AND BODY of a cube: eye position and size, brow, mouth, nose, freckles, hair colour and style, glasses, beard/moustache, body width/height,
  // and an occupation-driven hat (straw for farmers, cap for fishermen, panama for the well-off, collar for priests, veil for nuns). All random draws come
  // from the seeded R so a seed gives the same faces. Beards at birth are rare; rebels grow them later (sim.js beardLen).
  function makeLook(R, p) {
    const age = C.ageOf(p);
    const hair = p.hair || (age > 62 ? 'wht' : age > 48 ? R.weighted([['gry', 3], ['blk', 3], ['brn', 2]]) : R.weighted([['blk', 6], ['brn', 4], ['red', 0.5], ['blo', 0.6]]));
    const L = {
      eyeX: R.range(0.2, 0.3), eyeY: R.range(-0.05, 0.08), eyeR: R.range(0.07, 0.105), brow: R.range(0.14, 0.22), browT: R.range(0.8, 1.7),
      mouthW: R.range(0.22, 0.34), mouthY: R.range(0.2, 0.3), nose: R.chance(0.45), cheek: R.chance(0.12), freckle: R.chance(0.08),
      sw: R.range(0.92, 1.1), sh: R.range(0.92, 1.12), hair, hairCol: HAIR[hair] || HAIR.blk, style: R.int(4), glasses: R.chance(age > 40 ? 0.12 : 0.04),
      beard: p.sex === 'M' && age > 17 ? (p.beard !== undefined ? p.beard : R.chance(age > 55 ? 0.28 : 0.14)) : false,
      mustache: p.sex === 'M' && age > 20 && R.chance(0.22), hat: p.hat || null, mole: R.chance(0.1),
      tone: 0,
    };
    if (!L.hat && p.sex === 'M' && age > 15) {
      const o = C.OCC[p.occ];
      if (o && (p.occ === 'guajiro' || p.occ === 'colono' || p.occ === 'macheteo' || p.occ === 'carbonero' || p.occ === 'vaquero')) L.hat = R.chance(0.8) ? 'straw' : null;
      else if (p.occ === 'pescador') L.hat = R.chance(0.7) ? 'cap' : null;
      else if (p.occ === 'sacerdote') L.hat = 'collar';
      else if (p.occ === 'obrerocentral' || p.occ === 'estibador') L.hat = R.chance(0.3) ? 'cap' : null;
      else if (p.occ === 'hacendado' || p.occ === 'banquero' || p.occ === 'comerciante') L.hat = R.chance(0.6) ? 'panama' : null;
    }
    if (p.sex === 'F' && age > 14) { L.bun = R.chance(0.5); L.scarf = !L.bun && R.chance(0.3); L.hat = (p.occ === 'monja') ? 'veil' : L.hat; }
    return L;
  }

  // Create a person with all fields at neutral defaults and register them in W.people and W.bySet. `o` carries whatever the caller knows (names, birth year, parents, settlement, authored extras).
  function newPerson(R, o) {
    const sex = o.sex || (R.chance(0.5) ? 'M' : 'F');
    const p = {
      id: W.people.length, first: o.first || R.pick(sex === 'M' ? C.MALE : C.FEMALE), last: o.last, last2: o.last2 || '',
      tag: o.tag || null, nick: o.nick || (R.chance(0.11) ? R.pick(C.NICKS) : ''), sex, yob: o.yob,
      status: o.status || 'alive', settlement: o.settlement, home: o.home || o.settlement, birth: o.birth || o.home || o.settlement,
      mother: o.mother === undefined ? -1 : o.mother, father: o.father === undefined ? -1 : o.father, spouse: -1, kids: [],
      eth: o.eth || 'blanca', occ: o.occ || 'guajiro', cls: 0, fac: 'peasants', hh: -1, lineage: o.lineage === undefined ? -1 : o.lineage,
      stance: 0, trueStance: 0, conv: 20, covert: !!o.covert, informant: !!o.informant, hidden: 0,
      fear: 6, fearOf: null,
      needs: { food: 70, water: 85, energy: 75, safety: 60, dignity: 50, hope: 45 }, stress: 5, morale: 60, anger: 0,
      iss: [], sal: [0, 1], traits: [], rel: [], mem: [], memCount: 0,
      exp: o.exp || 0, service: 0, side: null, mil: null, role: o.role || '', note: o.note || '', roster: o.roster || null,
      hp: 100, maxHp: 100, cracks: [], chunks: [], bleed: 0, limp: 0, armHurt: 0, died: null, diedBy: null,
      look: null, actor: null, donor: o.donor || 0, wpn: null, ammo: 0, items: {}, literate: false, health: 80, loc: null,
      lastEvent: -999, hair: o.hair, beard: o.beard, hat: o.hat,
    };
    W.people.push(p);
    (W.bySet[p.settlement] = W.bySet[p.settlement] || []).push(p.id);
    return p;
  }
  C.newPerson = newPerson;
  // Full legal name: first + paternal + maternal surname.
  C.fullName = (p) => p.first + ' ' + p.last + (p.last2 ? ' ' + p.last2 : '');
  // Short nametag shown over a cube: an authored tag if any, else 'First Last'.
  C.tagName = (p) => p.tag || (p.first.split(' ')[0] + ' ' + p.last);
  // Move a person to another settlement (keeps the bySet lists consistent). Used for travel, migration and joining the rebels.
  C.moveTo = function (p, sid) {
    if (p.settlement === sid) return;
    const a = W.bySet[p.settlement]; if (a) { const i = a.indexOf(p.id); if (i >= 0) a.splice(i, 1); }
    p.settlement = sid; (W.bySet[sid] = W.bySet[sid] || []).push(p.id);
  };

  // FINISHING a person once occupation and age are fixed: occupation → class and faction; 1–3 personality traits; positions on the eight planks
  // (faction mean + noise, with adjustments for sex, ethnicity, devotion, idealism) and the two planks they care most about (salience);
  // starting loyalty and conviction around the faction mean (shifted by lineage and settlement bias); needs, literacy, health, body size and face.
  // finishing touches once occupation/age are final
  function finishPerson(R, p, S) {
    const age = C.ageOf(p);
    const o = C.OCC[p.occ] || C.OCC.guajiro;
    p.cls = o.cls; p.fac = o.fac;
    const F = C.FACTIONS[p.fac];
    // traits
    const nt = R.weighted([[1, 3], [2, 4], [3, 2]]);
    const pool = C.TRAIT_KEYS.slice();
    while (p.traits.length < nt) { const t = R.pick(pool); if (!p.traits.includes(t)) p.traits.push(t); }
    if (p.fac === 'church' && !p.traits.includes('devout')) p.traits[0] = 'devout';
    if (p.fac === 'army' && R.chance(0.3) && !p.traits.includes('loyalist')) p.traits[0] = 'loyalist';
    if (age > 62 && R.chance(0.35) && !p.traits.includes('veteran')) p.traits.push('veteran');
    // issues
    p.iss = F.iss.map((m) => C.clamp(m + R.gauss() * 0.34, -1, 1));
    if (p.sex === 'F') p.iss[6] = C.clamp(p.iss[6] + 0.25 + R.gauss() * 0.1, -1, 1);
    if (p.eth === 'negra' || p.eth === 'mulata') p.iss[7] = C.clamp(p.iss[7] + 0.45, -1, 1);
    if (p.traits.includes('devout')) p.iss[2] = C.clamp(p.iss[2] - 0.35, -1, 1);
    if (p.traits.includes('idealist')) for (let i of [0, 1, 4]) p.iss[i] = C.clamp(p.iss[i] + 0.15, -1, 1);
    const sals = F.sal.map((w, i) => [i, w * R.range(0.6, 1.4) * (i === 2 && p.traits.includes('devout') ? 2 : 1) * (i === 6 && p.sex === 'F' ? 1.5 : 1) * (i === 7 && p.eth !== 'blanca' ? 1.8 : 1)]);
    sals.sort((a, b) => b[1] - a[1]); p.sal = [sals[0][0], sals[1][0]];
    // attitude
    if (p.roster) { /* authored stance set by caller */ }
    else {
      const bias = (p._lbias || 0) * 0.8 + ((S && S.bias) || 0) + (p.sex === 'F' ? 2 : 0);
      p.trueStance = C.clamp(F.stance + bias + R.gauss() * F.sd, -100, 100);
      p.conv = R.range(F.conv[0], F.conv[1]) + (age > 55 ? 6 : 0);
      if (p.traits.includes('loyalist')) { p.trueStance = Math.min(p.trueStance, -35); p.conv += 20; }
      if (p.traits.includes('cautious')) p.conv -= 4;
      if (age < 14) { p.conv = 5; }
    }
    p.stance = p.trueStance;
    // needs
    const n = p.needs;
    n.food = C.clamp(48 + p.cls * 10 + R.gauss() * 12, 18, 98);
    n.safety = C.clamp(62 + (p.fac === 'army' ? 14 : 0) + R.gauss() * 10, 20, 95);
    n.dignity = C.clamp(40 + p.cls * 8 + (p.eth === 'negra' ? -9 : p.eth === 'mulata' ? -5 : 0) + R.gauss() * 10, 10, 95);
    n.hope = C.clamp(44 + (p.fac === 'students' ? 8 : 0) + R.gauss() * 14, 8, 95);
    p.literate = R.chance(age < 12 ? 0.35 : (S && (S.type === 'village' || S.type === 'sierra' || S.type === 'fishing')) ? 0.55 : 0.86) || p.cls >= 3;
    p.health = C.clamp(88 - Math.max(0, age - 35) * 0.6 + R.gauss() * 8, 25, 100);
    p.maxHp = Math.round(C.clamp(60 + p.health * 0.4, 55, 105)); p.hp = p.maxHp;
    p.look = makeLook(R, p);
    if (age < 14) p.look.sw = p.look.sh = 0.62 + age * 0.028;
  }

  // LINEAGES. People are generated as families, not as independent rolls: founder couples → their children → marriages across lineages → grandchildren.
  // ---------------- lineages ----------------
  // Choose an occupation by age/sex/settlement type: children, retirees, students, housewives, otherwise a weighted pick of the local job pool.
  function occFor(R, sid, S, p) {
    const age = C.ageOf(p);
    if (age < 13) return 'nino';
    if (age >= 67) return p.sex === 'F' ? 'jubilado' : (R.chance(0.55) ? 'jubilado' : R.weighted(C.occPool(S.type, p.sex, age)));
    if (age <= 22 && R.chance(S.type === 'village' || S.type === 'sierra' || S.type === 'fishing' ? 0.07 : 0.3)) return 'estudiante';
    if (p.sex === 'F' && R.chance(S.type === 'village' || S.type === 'sierra' || S.type === 'fishing' ? 0.78 : 0.6) && age >= 19) return 'ama';
    return R.weighted(C.occPool(S.type, p.sex, age));
  }

  // Birth years for a mother's children: she starts at 17–24 and each next child follows 1–3 years later, never after the 'present'.
  function birthYearsForKids(R, motherYob, n) {
    const out = []; let y = motherYob + R.irange(17, 24);
    for (let i = 0; i < n; i++) { if (y > 1956) break; out.push(y); y += R.irange(1, 3); }
    return out;
  }

  // Generate one settlement's population in four phases:
  //  1. founder couples (born 1868–94) and their native children;
  //  2. marry the children across lineages (or bring in an outsider spouse) and breed grandchildren; repeat once more for great-grandchildren;
  //  3. top up with migrant families if the sample is still small;
  //  4. assign occupations. The result is families with grandparents, uncles, cousins in a realistic age spread.
  function genSettlement(R, S) {
    const sid = S.id;
    const target = S.pop; if (!target) return;
    const rural = S.type === 'village' || S.type === 'sierra' || S.type === 'fishing';
    const lins = []; let lid = 0;
    const alive = () => (W.bySet[sid] || []).length;
    const lineagesOf = {};
    let guard = 0;
    // Phase 1: founder couples (G0) and their native children (G1)
    const G1 = [];
    while (alive() < target * 0.34 && guard++ < 500) {
      const eth = pickEth(R, sid);
      const sn = surnameFor(R, sid, eth);
      const husbandYob = R.irange(1868, 1894), wifeYob = husbandYob + R.irange(-2, 9);
      const lb = R.gauss() * 11;
      const hus = newPerson(R, { sex: 'M', yob: husbandYob, last: sn, last2: R.pick(C.SURNAMES), settlement: sid, eth, lineage: lid, birth: sid });
      const wif = newPerson(R, { sex: 'F', yob: wifeYob, last: R.pick(C.SURNAMES), last2: R.pick(C.SURNAMES), settlement: sid, eth: R.chance(0.85) ? eth : pickEth(R, sid), lineage: lid, birth: sid });
      hus.spouse = wif.id; wif.spouse = hus.id; hus._lbias = wif._lbias = lb;
      const nk = Math.max(1, Math.round((rural ? 5.2 : 3.8) + R.gauss() * 1.8));
      for (const y of birthYearsForKids(R, wifeYob, nk)) {
        if (y < 1895) continue;
        const k = newPerson(R, { yob: y, last: hus.last, last2: wif.last, mother: wif.id, father: hus.id, settlement: sid, eth: mixEth(R, hus.eth, wif.eth), lineage: lid, birth: sid });
        k._lbias = lb; hus.kids.push(k.id); wif.kids.push(k.id); G1.push(k);
      }
      lins.push({ id: lid, bias: lb }); lid++;
    }
    // Phase 2: marry G1 adults across lineages, produce G2 kids; marry G2 adults, produce G3 kids
    // Pair unmarried men and women of different lineages within a plausible age band; if no match is found, sometimes create an outsider spouse. Returns the couples.
    const marryPool = (pool, gen) => {
      const men = pool.filter((p) => p.sex === 'M' && C.ageOf(p) >= 19 && p.spouse < 0 && p.status === 'alive');
      const women = pool.filter((p) => p.sex === 'F' && C.ageOf(p) >= 17 && p.spouse < 0 && p.status === 'alive');
      R.shuffle(men); R.shuffle(women);
      const couples = [];
      for (const m of men) {
        if (!R.chance(0.82)) continue;
        // find a woman from another lineage within age band
        let best = -1, bd = 99;
        for (let i = 0; i < women.length; i++) {
          const w = women[i]; if (w.spouse >= 0 || w.lineage === m.lineage) continue;
          if (m.mother === w.mother && m.mother >= 0) continue;
          const d = Math.abs((m.yob + 3) - w.yob); if (d < bd && d < 9) { bd = d; best = i; }
        }
        let w;
        if (best >= 0) w = women[best];
        else if (R.chance(0.6)) { // outsider spouse: new person without lineage (kin elsewhere is implied)
          const eth = R.chance(0.75) ? m.eth : pickEth(R, sid);
          w = newPerson(R, { sex: 'F', yob: m.yob + R.irange(-6, 2), last: surnameFor(R, sid, eth), last2: R.pick(C.SURNAMES), settlement: sid, eth, lineage: -1, birth: sid });
          if (C.ageOf(w) < 17) { W.people.pop(); W.bySet[sid].pop(); continue; }
          w._lbias = m._lbias; w.fresh = true;
        } else continue;
        m.spouse = w.id; w.spouse = m.id; couples.push([m, w]);
      }
      return couples;
    };
    // Give each couple children by a total-fertility target (higher in the countryside, lower for later generations).
    const breed = (couples, tfr) => {
      const kids = [];
      for (const [m, w] of couples) {
        if (C.ageOf(w) < 18 && !w.fresh) continue;
        const nk = Math.max(0, Math.round(tfr + R.gauss() * 1.7 - (w.yob > 1930 ? 1.4 : 0)));
        for (const y of birthYearsForKids(R, w.yob, nk)) {
          if (y < w.yob + 16) continue;
          const k = newPerson(R, { yob: y, last: m.last, last2: w.last, mother: w.id, father: m.id, settlement: sid, eth: mixEth(R, m.eth, w.eth), lineage: m.lineage, birth: sid });
          k._lbias = ((m._lbias || 0) + (w._lbias || 0)) / 2; m.kids.push(k.id); w.kids.push(k.id); kids.push(k);
        }
      }
      return kids;
    };
    const c1 = marryPool(G1, 1);
    const G2 = breed(c1, rural ? 4.6 : 3.2);
    const c2 = marryPool(G2.concat(), 2);
    const G3 = breed(c2, rural ? 3.4 : 2.4);
    // top up with migrant families if the sample is too small
    let tries = 0;
    while (alive() < target * 0.9 && tries++ < 400) {
      const eth = pickEth(R, sid), yob = R.irange(1900, 1935);
      const m = newPerson(R, { sex: 'M', yob, last: surnameFor(R, sid, eth), last2: R.pick(C.SURNAMES), settlement: sid, eth, lineage: -1, birth: R.pick(C.PLAYABLE) });
      m._lbias = R.gauss() * 10; m.fresh = true;
      const w = newPerson(R, { sex: 'F', yob: yob + R.irange(-4, 6), last: surnameFor(R, sid, eth), last2: R.pick(C.SURNAMES), settlement: sid, eth, lineage: -1, birth: sid });
      w._lbias = m._lbias; w.fresh = true; m.spouse = w.id; w.spouse = m.id;
      if (C.ageOf(w) < 17) continue;
      const ks = breed([[m, w]], rural ? 4 : 3);
      ks.forEach((k) => { k.occFixed = false; });
    }
    // occupations
    for (const id of (W.bySet[sid] || []).slice()) {
      const p = W.people[id]; if (p.occDone) continue;
      p.occ = occFor(R, sid, S, p); p.occDone = true;
    }
  }

  // HOUSEHOLDS. A household is a head, spouse, unmarried children, and elderly parents living together. People left over become single-person households.
  // ---------------- households ----------------
  // Group living people into households (see above) and assign a tenure type (wage, tenant, smallholder, squatter in the country; wage, rent, owner in town).
  function makeHouseholds(R) {
    const seen = new Set();
    for (const p of W.people) {
      if (p.hh >= 0 || p.status !== 'alive') continue;
      const age = C.ageOf(p);
      let head = null;
      if (p.spouse >= 0) head = p.sex === 'M' ? p : W.people[p.spouse];
      else if (age >= 22 || p.mother < 0 && p.father < 0) head = p;
      if (!head || head.hh >= 0) continue;
      const hh = { id: W.houses.length, sid: head.settlement, members: [], head: head.id, cls: head.cls, tenure: null, bld: -1 };
      const add = (q) => { if (q && q.hh < 0 && q.status === 'alive' && q.settlement === head.settlement) { q.hh = hh.id; hh.members.push(q.id); } };
      add(head); if (head.spouse >= 0) add(W.people[head.spouse]);
      for (const kid of head.kids) { const k = W.people[kid]; if (k.spouse < 0 && (C.ageOf(k) < 26 || k.sex === 'F')) add(k); }
      const sp = head.spouse >= 0 ? W.people[head.spouse] : null;
      for (const par of [head.mother, head.father, sp ? sp.mother : -1, sp ? sp.father : -1]) {
        if (par >= 0) { const q = W.people[par]; if (q.status === 'alive' && q.spouse < 0 || (q.status === 'alive' && W.people[q.spouse] && W.people[q.spouse].status !== 'alive')) add(q); }
      }
      const S = C.SETTLEMENTS[head.settlement];
      hh.tenure = R.weighted(S && (S.type === 'village' || S.type === 'sierra') ? [['wage', 4], ['tenant', 3], ['smallholder', 2], ['squatter', 2]] : [['wage', 5], ['rent', 3], ['owner', 2]]);
      W.houses.push(hh);
    }
    // anyone left (singles)
    for (const p of W.people) {
      if (p.hh >= 0 || p.status !== 'alive') continue;
      const hh = { id: W.houses.length, sid: p.settlement, members: [p.id], head: p.id, cls: p.cls, tenure: 'rent', bld: -1 };
      p.hh = hh.id; W.houses.push(hh);
    }
  }

  // FATES. Before play begins history has already happened: some people have died (by age, illness, childbirth, violence, army), been jailed or exiled, or moved to a bigger city. Those absences are what make families feel real (a jailed brother, a dead father).
  // ---------------- statuses, migration ----------------
  // Roll each non-authored person's fate by age and place; mark dead/jailed/exile; move migrants to Havana/Santiago; take exiles off the map.
  function applyFates(R) {
    for (const p of W.people) {
      if (p.roster) continue;
      const age = C.ageOf(p), S = C.SETTLEMENTS[p.settlement];
      const rebelZone = S && S.region === 'Oriente';
      let dead = 0;
      if (age >= 70) dead = 0.6; else if (age >= 60) dead = 0.34; else if (age >= 45) dead = 0.14; else if (age >= 28) dead = 0.07; else if (age >= 14) dead = 0.04; else dead = 0.075;
      if (R.chance(dead)) {
        p.status = 'dead'; p.diedBy = p.sex === 'M' && age > 17 && age < 45 && R.chance(rebelZone ? 0.18 : 0.08) ? 'violence' : age > 50 ? 'age' : R.pick(['illness', 'illness', 'accident', 'childbirth']);
        if (p.sex === 'M' && p.diedBy === 'violence' && rebelZone && R.chance(0.45)) p.diedBy = 'army';
        p.died = 1956 - R.irange(0, 25);
        if (p.diedBy === 'childbirth' && p.sex === 'M') p.diedBy = 'illness';
        continue;
      }
      if (p.sex === 'M' && age >= 19 && age <= 50) {
        if (R.chance(0.025)) { p.status = 'jailed'; p.note = 'Jailed for politics or a fight.'; }
        else if (R.chance(p.cls >= 2 ? 0.05 : 0.012)) { p.status = 'exile'; }
      }
      if (p.status === 'alive' && age >= 17 && age <= 45 && R.chance(0.09) && p.settlement !== 'habana' && C.PLAYABLE.includes(p.settlement)) {
        // migrant worker / relative who moved to a bigger place
        const dest = R.weighted([['habana', 4], ['santiago', 3], ['manzanillo', 1], ['bayamo', 1]]);
        if (dest !== p.settlement) { C.moveTo(p, dest); if (R.chance(0.5)) p.occ = R.weighted(C.occPool(C.SETTLEMENTS[dest].type, p.sex, age)); }
      }
    }
    // dead/exile persons: keep in DB but remove from settlement lists used for spawning
    for (const p of W.people) if (p.status === 'exile') C.moveTo(p, 'exterior');
  }

  // NON-KIN EDGES: friends, compadres (godparent ties), coworkers, employers/employees, neighbours, rivals, lovers. Symmetric; each has a type and a weight.
  // ---------------- relationships (non-kin edges) ----------------
  // Create a symmetric relationship edge (employer↔employee are mirrored types). Duplicate edges of the same type are ignored.
  function link(a, b, t, w) {
    if (a.id === b.id) return;
    for (const r of a.rel) if (r.id === b.id && r.t === t) return;
    a.rel.push({ id: b.id, t, w }); b.rel.push({ id: a.id, t: t === 'employer' ? 'employee' : t === 'employee' ? 'employer' : t, w });
  }
  // Exported so other modules (e.g. the roster, the Granma party) can link people.
  C.link = link;
  // For each settlement and each adult: 2–5 friends of similar age/class, a compadre, coworkers, an employer (for rural workers under a landlord), a neighbour, sometimes a rival, sometimes a cousin or pen-pal in another town; plus a few lovers. Denser edges = richer ripples.
  function makeEdges(R) {
    const per = {};
    for (const p of W.people) if (p.status === 'alive' && C.SETTLEMENTS[p.settlement] && C.SETTLEMENTS[p.settlement].pop > 0) (per[p.settlement] = per[p.settlement] || []).push(p);
    for (const sid in per) {
      const arr = per[sid]; const S = C.SETTLEMENTS[sid];
      const adults = arr.filter((p) => C.ageOf(p) >= 14);
      const byOcc = {}; adults.forEach((p) => (byOcc[p.occ] = byOcc[p.occ] || []).push(p));
      const landlords = adults.filter((p) => p.fac === 'landowners');
      for (const p of adults) {
        const age = C.ageOf(p);
        // friends (age/sex/class proximity)
        let nf = R.irange(2, 5), tries = 0;
        while (nf > 0 && tries++ < 25) {
          const q = arr[R.int(arr.length)];
          if (q.id === p.id || C.ageOf(q) < 14 || Math.abs(C.ageOf(q) - age) > 9) continue;
          if (R.chance(0.7) && q.sex !== p.sex) continue;
          if (Math.abs(q.cls - p.cls) > 1 && R.chance(0.8)) continue;
          if (q.hh === p.hh) continue;
          link(p, q, 'friend', 0.4 + R.range(0, 0.3)); nf--;
        }
        // compadre / comadre (godparent)
        if (R.chance(0.7)) {
          const q = arr[R.int(arr.length)];
          if (q.id !== p.id && C.ageOf(q) > age - 5 && C.ageOf(q) >= 25 && q.hh !== p.hh) link(p, q, 'compadre', 0.55);
        }
        // coworkers
        const mates = byOcc[p.occ]; if (mates && mates.length > 1 && p.cls <= 2 && !['ama', 'jubilado', 'estudiante'].includes(p.occ)) {
          for (let i = 0; i < 2; i++) { const q = mates[R.int(mates.length)]; if (q.id !== p.id) link(p, q, 'coworker', 0.18); }
        }
        // employer
        if (landlords.length && (p.occ === 'macheteo' || p.occ === 'colono' || p.occ === 'guajiro' || p.occ === 'vaquero') && R.chance(0.7)) link(p, R.pick(landlords), 'employer', 0.15);
        // neighbours (same settlement, adjacent household id)
        const nb = W.houses[p.hh + (R.chance(0.5) ? 1 : -1)]; if (nb && nb.sid === sid && nb.members.length) link(p, W.people[nb.members[0]], 'neighbor', 0.12);
        // rivals
        if (R.chance(0.07)) { const q = arr[R.int(arr.length)]; if (q.id !== p.id && Math.abs(C.ageOf(q) - age) < 12 && q.hh !== p.hh) link(p, q, 'rival', -0.35); }
        // cross-settlement ties (cousins in the city, letter-writing friends)
        if (R.chance(0.1)) { const other = per[R.pick(Object.keys(per))]; if (other && other !== arr) { const q = other[R.int(other.length)]; if (C.ageOf(q) >= 14) link(p, q, 'friend', 0.3); } }
      }
      // lovers (a few)
      for (let i = 0; i < Math.floor(adults.length / 40); i++) {
        const a = adults[R.int(adults.length)], b = adults[R.int(adults.length)];
        if (a.id !== b.id && a.sex !== b.sex && Math.abs(C.ageOf(a) - C.ageOf(b)) < 10 && a.spouse !== b.id && a.spouse < 0 && b.spouse < 0) link(a, b, 'lover', 0.8);
      }
    }
  }

  // GARRISONS. Soldiers and police are drawn from the same population — often sons of *other* places, so a soldier's mother lives elsewhere. That is what lets a death in a barracks echo through a village.
  // ---------------- garrisons ----------------
  // How many guards, officers, soldiers, police and SIM agents are stationed in each settlement.
  const GARRISON = { sierra: [['guardia', 8], ['oficial', 1], ['soldado', 3]], palmarito: [['guardia', 5], ['oficial', 1]], cayo: [['guardia', 3]], manzanillo: [['soldado', 16], ['policia', 6], ['oficial', 2]], bayamo: [['soldado', 22], ['policia', 6], ['oficial', 3]], santiago: [['soldado', 36], ['policia', 14], ['sim', 6], ['oficial', 5]], habana: [['soldado', 44], ['policia', 32], ['sim', 14], ['oficial', 8]] };
  // Fill the garrisons: pick young working-class men from other settlements (or invent conscripts), make them soldiers with rank, a little experience and an army allegiance.
  function makeGarrisons(R) {
    const cand = W.people.filter((p) => p.status === 'alive' && p.sex === 'M' && !p.roster && C.ageOf(p) >= 18 && C.ageOf(p) <= 36 && p.cls <= 2 && !['ama', 'estudiante'].includes(p.occ));
    R.shuffle(cand);
    let ci = 0;
    for (const sid in GARRISON) {
      for (const [role, n] of GARRISON[sid]) {
        for (let i = 0; i < n; i++) {
          let p = null;
          while (ci < cand.length) { const c = cand[ci++]; if (c.settlement !== sid && c.mil === null) { p = c; break; } }
          if (!p) { // no suitable local son -> a fresh conscript from nowhere in particular
            const eth = pickEth(R, sid);
            p = newPerson(R, { sex: 'M', yob: R.irange(1921, 1938), last: surnameFor(R, sid, eth), last2: R.pick(C.SURNAMES), settlement: sid, eth, birth: R.pick(C.PLAYABLE) });
            p.occ = role; p._lbias = 0; p.hh = -1;
          } else { C.moveTo(p, sid); }
          p.occ = role; finishPerson(R, p, C.SETTLEMENTS[sid]); p.mil = { side: 'army', unit: sid, rank: role === 'oficial' ? 'Teniente' : role === 'sim' ? 'Agente' : role === 'policia' ? 'Policía' : role === 'guardia' ? 'Guardia' : 'Soldado' };
          p.side = 'army'; p.exp = Math.min(60, R.irange(2, role === 'oficial' ? 40 : 20) + (p.traits.includes('veteran') ? 10 : 0));
          p._army = true;
        }
      }
    }
  }

  // SCENE ROLES. Make sure each place has the characters its map needs (priests, doctors, shopkeepers, charcoal-burners…) by re-assigning plausible locals.
  // make sure every place has the characters its scene needs
  // Target counts of each occupation per settlement.
  const ROLES = {
    sierra: [['carbonero', 6], ['partera', 1]],
    palmarito: [['hacendado', 2], ['mayordomo', 1], ['bodeguero', 1], ['maestro', 1], ['partera', 1], ['sacerdote', 0], ['colono', 6]],
    cayo: [['bodeguero', 1], ['maestro', 1], ['partera', 1]],
    manzanillo: [['sacerdote', 2], ['medico', 3], ['abogado', 2], ['hacendado', 3], ['bodeguero', 4], ['maestro', 4], ['sindicalista', 4], ['comerciante', 4], ['periodista', 1], ['monja', 2]],
    bayamo: [['sacerdote', 2], ['medico', 3], ['abogado', 2], ['hacendado', 3], ['bodeguero', 4], ['maestro', 4], ['sindicalista', 3], ['comerciante', 4], ['monja', 2]],
    santiago: [['sacerdote', 3], ['medico', 6], ['abogado', 5], ['hacendado', 3], ['banquero', 2], ['comerciante', 8], ['maestro', 8], ['sindicalista', 6], ['periodista', 3], ['monja', 4], ['estudiante', 40]],
    habana: [['sacerdote', 3], ['medico', 8], ['abogado', 8], ['hacendado', 5], ['banquero', 6], ['comerciante', 14], ['maestro', 8], ['sindicalista', 8], ['periodista', 5], ['monja', 5], ['locutor', 3], ['casino', 8], ['estudiante', 70], ['funcionario', 8]],
  };
  // Convert suitable existing locals to reach the ROLES targets (respecting age bands and sex restrictions; priests and nuns are unmarried).
  function ensureRoles(R) {
    for (const sid in ROLES) {
      const S = C.SETTLEMENTS[sid];
      for (const [occ, n] of ROLES[sid]) {
        const o = C.OCC[occ]; if (!n) continue;
        const have = (W.bySet[sid] || []).filter((id) => W.people[id].occ === occ && W.people[id].status === 'alive').length;
        let need = n - have, tries = 0;
        while (need > 0 && tries++ < 400) {
          const p = W.people[W.bySet[sid][R.int(W.bySet[sid].length)]];
          if (!p || p.status !== 'alive' || p.roster || p.occ === 'soldado' || p._army || p.mil) continue;
          const age = C.ageOf(p);
          if (o.sex && o.sex !== p.sex) continue;
          const lo = occ === 'estudiante' ? 15 : occ === 'maestro' ? 20 : occ === 'hacendado' ? 38 : 24, hi = occ === 'estudiante' ? 25 : 62;
          if (age < lo || age > hi) continue;
          if (['sacerdote', 'monja'].includes(occ) && p.spouse >= 0) continue;
          p.occ = occ; finishPerson(R, p, S); need--;
        }
      }
    }
  }

  // ---------------- roster ----------------
  // An off-map relative of an authored character (a mother in Birán, a brother in Havana) — real people in the database, not in any scene.
  function ghost(R, o) { // off-map relative
    const p = newPerson(R, o); p.occ = o.occ || (C.ageOf(p) >= 60 ? 'jubilado' : 'guajiro'); p.roster = null; p.occDone = true;
    finishPerson(R, p, C.SETTLEMENTS[o.settlement]); return p;
  }
  // Place the historical roster in the world: create each authored person with their traits and loyalty, link them to authored relatives and each other (comrades, friends, informers), and give them generated kin around them. The player's role is Fidel.
  function injectRoster(R) {
    const byId = {}; const castroParents = {};
    // the player's mantle: Fidel
    const mk = (r) => {
      const eth = r.eth || (r.birth === 'rosario' ? 'blanca' : 'blanca');
      const p = newPerson(R, { first: r.first, last: r.last, last2: r.last2, tag: r.tag, sex: r.sex, yob: r.yob, settlement: r.at === 'party' ? 'alegria' : r.at, home: r.birth, birth: r.birth, eth, occ: r.occ, exp: r.exp, role: r.role, note: r.note, covert: r.covert, informant: r.informant, hair: r.hair, beard: r.beard, hat: r.hat, donor: r.donor, roster: r.id });
      p.rosterV = r.v; p.traits = r.traits.slice(); p.occDone = true;
      p.side = r.side;
      return p;
    };
    const S0 = C.SETTLEMENTS;
    for (const r of C.ROSTER) {
      const p = mk(r);
      byId[r.id] = p;
    }
    // the player character: Fidel's place (the player chooses the name)
    const fidel = newPerson(R, { first: 'Fidel', last: 'Castro', last2: 'Ruz', tag: 'Fidel Castro', sex: 'M', yob: 1926, settlement: 'alegria', home: 'biran', birth: 'biran', occ: 'abogado', exp: 4, role: 'Comandante (El Viajero)', hair: 'blk', beard: false, roster: 'fidel', note: 'You lead the expedition.' });
    fidel.traits = ['idealist', 'brave', 'stoic']; fidel.occDone = true; fidel.side = 'rebel'; byId.fidel = fidel; W.player = fidel.id;
    // Castro family: shared parents
    const ang = ghost(R, { first: 'Ángel', last: 'Castro', last2: 'Argiz', sex: 'M', yob: 1875, settlement: 'biran', home: 'biran', birth: 'galicia', status: 'dead', occ: 'hacendado', eth: 'blanca' });
    ang.died = 1956; ang.diedBy = 'age';
    const lina = ghost(R, { first: 'Lina', last: 'Ruz', last2: 'González', sex: 'F', yob: 1903, settlement: 'biran', home: 'biran', birth: 'biran', occ: 'ama', eth: 'blanca' });
    ang.spouse = lina.id; lina.spouse = ang.id;
    for (const k of [fidel, byId.raul]) { k.father = ang.id; k.mother = lina.id; ang.kids.push(k.id); lina.kids.push(k.id); k.last = 'Castro'; k.last2 = 'Ruz'; }
    for (const nm of [['Ramón', 'M', 1924], ['Angelita', 'F', 1923], ['Juanita', 'F', 1933], ['Emma', 'F', 1938]]) {
      const s = ghost(R, { first: nm[0], last: 'Castro', last2: 'Ruz', sex: nm[1], yob: nm[2], settlement: 'biran', home: 'biran', birth: 'biran', mother: lina.id, father: ang.id, occ: nm[1] === 'M' ? 'hacendado' : 'ama', eth: 'blanca' });
      ang.kids.push(s.id); lina.kids.push(s.id);
    }
    // other authored families
    for (const r of C.ROSTER) {
      if (r.id === 'raul') continue;
      const p = byId[r.id]; if (!p) continue;
      const mkParents = () => {
        if (p.mother >= 0 || p.father >= 0) return;
        const f = ghost(R, { sex: 'M', yob: p.yob - R.irange(22, 36), last: p.last, last2: R.pick(C.SURNAMES), settlement: r.birth, home: r.birth, birth: r.birth, eth: p.eth, status: R.chance(0.45) ? 'dead' : 'alive', occ: r.birth === 'habana' ? 'comerciante' : 'guajiro' });
        const m = ghost(R, { sex: 'F', yob: p.yob - R.irange(18, 30), last: p.last2 || R.pick(C.SURNAMES), last2: R.pick(C.SURNAMES), settlement: r.birth, home: r.birth, birth: r.birth, eth: p.eth, status: R.chance(0.35) ? 'dead' : 'alive', occ: 'ama' });
        f.spouse = m.id; m.spouse = f.id; p.father = f.id; p.mother = m.id; f.kids.push(p.id); m.kids.push(p.id); f._sib = m._sib = true; p._par = [f, m];
      };
      for (const fm of (r.fam || [])) {
        const [rel, first, last, yob, sex, st, place] = fm;
        // link to an existing roster character by name (e.g., Haydée <-> Armando Hart)
        const existing = C.ROSTER.find((x) => x.first.startsWith(first.split(' ')[0]) && x.last === last && x.id !== r.id);
        const other = existing ? byId[existing.id] : null;
        if (rel === 'spouse') {
          const q = other || ghost(R, { first, last, last2: '', sex, yob, settlement: place === 'exterior' ? 'exterior' : place, home: place, birth: place, status: st === 'dead' ? 'dead' : 'alive', eth: p.eth, occ: 'ama' });
          p.spouse = q.id; q.spouse = p.id;
        } else if (rel === 'child' || rel === 'grandchild') {
          const q = ghost(R, { first, last, last2: p.last, sex, yob, settlement: place, home: place, birth: place, status: st === 'dead' ? 'dead' : 'alive', eth: p.eth, mother: p.sex === 'F' ? p.id : p.spouse, father: p.sex === 'M' ? p.id : p.spouse });
          p.kids.push(q.id);
          if (p.spouse >= 0) W.people[p.spouse].kids.push(q.id);
        } else if (rel === 'mother' || rel === 'father') {
          if (p.mother < 0 && p.father < 0) mkParents();
          const q = rel === 'mother' ? W.people[p.mother] : W.people[p.father];
          if (q) { q.first = first; q.last = last; if (rel === 'mother' && !q.last2) q.last2 = ''; q.yob = yob; q.status = st === 'dead' ? 'dead' : 'alive'; }
        } else if (rel === 'sibling') {
          if (p.mother < 0 && p.father < 0) mkParents();
          const sb = ghost(R, { first, last: p.last, last2: p.last2, sex, yob, settlement: place, home: place, birth: place, mother: p.mother, father: p.father, status: st === 'dead' ? 'dead' : 'alive', eth: p.eth });
          if (p.mother >= 0) W.people[p.mother].kids.push(sb.id); if (p.father >= 0) W.people[p.father].kids.push(sb.id);
        }
      }
      if (p.mother < 0 && p.father < 0) mkParents();     // everyone has parents in the graph
    }
    // finish all roster persons + stance/exp/conviction
    for (const r of C.ROSTER) {
      const p = byId[r.id]; const S = S0[p.settlement];
      p.trueStance = r.trueStance !== undefined ? r.trueStance : r.st; p.stance = r.st; p.conv = r.cv;
      finishPerson(R, p, S); p.trueStance = r.trueStance !== undefined ? r.trueStance : r.st; p.stance = p.trueStance;
      if (r.informant) { p.stance = 30; p.hidden = 1; }
      p.conv = r.cv; p.exp = r.exp || 0; p.eth = r.eth || p.eth;
      if (r.side === 'regime') p.mil = { side: 'army', unit: p.settlement, rank: r.role }, p.side = 'army';
      if (r.side === 'rebel') p.mil = { side: 'rebel', rank: r.role, squad: -1 };
      p.fac = r.side === 'rebel' ? 'peasants' : p.fac;
      if (r.side === 'regime') p.fac = 'army';
      if (r.side === 'church') p.fac = 'church';
      if (r.side === 'student') p.fac = 'students';
      if (r.side === 'union') p.fac = 'workers';
      if (r.side === 'elite') p.fac = 'elite';
      if (['llano'].includes(r.side) && r.occ === 'ama') p.fac = 'middle';
      // fix up look for specifics
      if (r.beard !== undefined) p.look.beard = r.beard;
      if (r.hat) p.look.hat = r.hat;
      if (r.hair) { p.look.hair = r.hair; p.look.hairCol = HAIR[r.hair]; }
    }
    finishPerson(R, fidel, S0.alegria); fidel.trueStance = fidel.stance = 100; fidel.conv = 100; fidel.look.beard = true; fidel.look.hat = 'cap'; fidel.look.mustache = true; fidel.exp = 4;
    fidel.mil = { side: 'rebel', rank: 'Comandante', squad: -1 };
    for (const p of W.people) if (!p.look) { // ghosts created before finishing
      finishPerson(R, p, S0[p.settlement]);
    }
    // comrades & friends: every authored character is connected into the living community
    const rebels = C.ROSTER.filter((r) => r.side === 'rebel').map((r) => byId[r.id]).concat([fidel]);
    for (let i = 0; i < rebels.length; i++) for (let j = i + 1; j < rebels.length; j++) if (R.chance(0.6)) link(rebels[i], rebels[j], 'comrade', 0.6);
    link(byId.raul, fidel, 'comrade', 0.9);
    link(byId.che, byId.camilo, 'comrade', 0.5);
    const tie = (a, b, t, w) => { if (byId[a] && byId[b]) link(byId[a], byId[b], t, w); };
    tie('celia', 'frank', 'comrade', 0.8); tie('frank', 'vilma', 'comrade', 0.9); tie('haydee', 'melba', 'comrade', 0.8); tie('hart', 'frank', 'comrade', 0.7);
    tie('celia', 'crescencio', 'friend', 0.7); tie('celia', 'vallejo', 'friend', 0.5); tie('anselmo', 'crescencio', 'friend', 0.8);
    tie('echeverria', 'hart', 'comrade', 0.4); tie('larrea', 'mercedes', 'friend', 0.5); tie('quesada', 'larrea', 'friend', 0.5); tie('sarria', 'chaviano', 'coworker', 0.3);
    tie('batista', 'tabernilla', 'comrade', 0.7); tie('ventura', 'batista', 'comrade', 0.4); tie('eutimio', 'guillermo', 'neighbor', 0.3); tie('tete', 'guillermo', 'neighbor', 0.2);
    for (const r of C.ROSTER) {
      const p = byId[r.id]; const pool = W.bySet[p.settlement];
      if (!pool || !pool.length || p.settlement === 'alegria') continue;
      let n = 0, g = 0;
      while (n < 4 && g++ < 40) { const q = W.people[pool[R.int(pool.length)]]; if (q.status === 'alive' && q.id !== p.id && C.ageOf(q) >= 14) { link(p, q, n < 2 ? 'friend' : 'neighbor', 0.35); n++; } }
    }
    W.roster = byId;
  }

  // THE PARTY. The authored Granma members plus young men from across the island who lean rebel, collected into one expedition. Everyone in the party knows two or three others.
  // the Granma party: authored members + converted young men from all over the island
  // Build the Granma party and its comrade edges; W.party holds their ids.
  function makeParty(R) {
    const party = [];
    for (const r of C.ROSTER) if (r.at === 'party') party.push(W.roster[r.id]);
    party.push(W.people[W.player]);
    const cand = W.people.filter((p) => p.status === 'alive' && p.sex === 'M' && !p.roster && !p._army && C.ageOf(p) >= 20 && C.ageOf(p) <= 34 && p.settlement !== 'alegria' && ['habana', 'santiago', 'manzanillo', 'bayamo', 'palmarito'].includes(p.settlement));
    cand.sort((a, b) => b.trueStance - a.trueStance);
    let n = 0;
    for (const p of cand) { if (n >= 16) break; if (R.chance(0.25)) continue; if (p.hh >= 0) { const h = W.houses[p.hh]; const i = h.members.indexOf(p.id); if (i >= 0) h.members.splice(i, 1); } C.moveTo(p, 'alegria'); p.mil = { side: 'rebel', rank: 'Soldado', squad: -1 }; p.side = 'rebel'; p.trueStance = p.stance = R.range(72, 98); p.conv = R.range(65, 95); p.exp = R.range(0, 5); p.look.sw = 1; party.push(p); n++; }
    // every rebel knows a few other rebels
    for (const a of party) for (let i = 0; i < 2; i++) { const b = party[R.int(party.length)]; if (b !== a) link(a, b, 'comrade', 0.5); }
    W.party = party.map((p) => p.id);
  }

  // ENTRY POINT.
  // ---------------- entry ----------------
  // Generate the whole world from a seed (deterministic): settlements in a fixed order, fates, finishing, garrisons, roles, roster, households, edges, party.
  C.genWorld = function (seed) {
    W.people.length = 0; W.houses.length = 0; W.bySet = {}; W.seed = seed; W.day = 0; W.nextEv = 1;
    const R = C.RNG(seed);
    for (const sid in C.SETTLEMENTS) { W.bySet[sid] = []; }
    const order = ['sierra', 'palmarito', 'cayo', 'manzanillo', 'bayamo', 'santiago', 'habana'];
    for (const sid of order) genSettlement(R, C.SETTLEMENTS[sid]);
    applyFates(R);
    for (const p of W.people) {
      if (p.look) continue;
      finishPerson(R, p, C.SETTLEMENTS[p.settlement] || C.SETTLEMENTS[p.home]);
    }
    makeGarrisons(R);
    ensureRoles(R);
    injectRoster(R);
    makeHouseholds(R);
    makeEdges(R);
    makeParty(R);
    // normalise statuses for rendering
    for (const p of W.people) { if (p.status !== 'alive' && p.status !== 'dead') p.hp = p.maxHp; }
    return W;
  };

  // KINSHIP GRAPH. Kin are DERIVED by traversing mother/father/spouse/kids — they are not stored. A weight 0..1 says how much a person would care what happens to the other.
  // ---------------- kinship graph ----------------
  // returns Map<id, {w, t}> of everyone who would care what happens to person p, weight 0..1
  // Weights by kin type: spouse and child 1.0, parent 0.9, sibling 0.75, grandparent/grandchild 0.5, aunt/niece 0.35, in-law 0.3, cousin 0.25.
  const KINW = { spouse: 1, child: 1, parent: 0.9, sibling: 0.75, grandparent: 0.5, grandchild: 0.5, aunt: 0.35, niece: 0.35, cousin: 0.25, inlaw: 0.3 };
  C.KINW = KINW;
  // Map<id,{w,t}> of every relative of p (spouse, children, parents, siblings, grandparents, aunts/uncles, cousins, grandchildren, in-laws, nieces/nephews).
  C.kinOf = function (p) {
    const out = new Map();
    const add = (id, t) => { if (id >= 0 && id !== p.id && !out.has(id)) out.set(id, { w: KINW[t], t }); };
    const P = W.people;
    if (p.spouse >= 0) add(p.spouse, 'spouse');
    p.kids.forEach((k) => add(k, 'child'));
    const par = [p.mother, p.father];
    par.forEach((x) => add(x, 'parent'));
    for (const x of par) if (x >= 0) {
      const q = P[x];
      q.kids.forEach((k) => add(k, 'sibling'));
      [q.mother, q.father].forEach((g) => add(g, 'grandparent'));
      for (const g of [q.mother, q.father]) if (g >= 0) P[g].kids.forEach((u) => { add(u, 'aunt'); P[u].kids.forEach((c) => add(c, 'cousin')); });
    }
    p.kids.forEach((k) => P[k].kids.forEach((g) => add(g, 'grandchild')));
    p.kids.forEach((k) => { const kk = P[k]; if (kk.spouse >= 0) add(kk.spouse, 'inlaw'); });
    if (p.spouse >= 0) { const s = P[p.spouse]; [s.mother, s.father].forEach((x) => add(x, 'inlaw')); }
    for (const x of par) if (x >= 0) P[x].kids.forEach((s) => P[s].kids.forEach((n) => add(n, 'niece')));
    return out;
  };
  // Weights of non-kin edge types in an event's audience. (Bonds earned in play use relWeight below.)
  const RELW = { friend: 0.4, compadre: 0.5, lover: 0.8, comrade: 0.5, coworker: 0.15, neighbor: 0.12, employer: 0.1, employee: 0.1, rival: -0.2 };
  // Weight of a non-kin edge in the audience of an event. A 'bond' edge (friendship earned in play, see bonds.js) scales
  // from 0.25 (just a friend) to 1.0 (a brother-in-arms): at full strength it counts exactly like a spouse or child.
  const relWeight = (r) => (r.t === 'bond' ? 0.25 + 0.75 * r.w : RELW[r.t]);
  // THE AUDIENCE OF AN EVENT: everyone who would care about what happens to p — kin, then non-kin edges, then friends-of-close-friends at 40% of the weight (second hop through ties of weight ≥ 0.5).
  // C.addEvent (sim.js) turns this map into memories, which turn into loyalty shifts.
  C.audienceOf = function (p) {
    const m = C.kinOf(p);
    for (const r of p.rel) { const w = relWeight(r); const cur = m.get(r.id); if (!cur || Math.abs(w) > Math.abs(cur.w)) m.set(r.id, { w, t: r.t }); }
    // friends-of-friends at half weight (second hop through close ties only)
    const first = [...m.entries()].filter(([, v]) => v.w >= 0.5 && v.t !== 'child');
    for (const [id, v] of first) { const q = W.people[id]; for (const r of q.rel) { const w = relWeight(r) * 0.4 * v.w; if (w > 0.05 && r.id !== p.id && !m.has(r.id)) m.set(r.id, { w, t: '2nd' }); } }
    return m;
  };
  // What q is to p, for display: a kin type, or an edge type, or null.
  C.relativeLabel = function (p, q) { // what is q to p
    const m = C.kinOf(p).get(q.id); if (m) return m.t;
    for (const r of p.rel) if (r.id === q.id) return r.t;
    return null;
  };
  // Spanish labels for relationship types (used by the inspector).
  C.relLabelEs = { spouse: 'cónyuge', child: 'hijo/a', parent: 'padre/madre', sibling: 'hermano/a', grandparent: 'abuelo/a', grandchild: 'nieto/a', aunt: 'tío/a', niece: 'sobrino/a', cousin: 'primo/a', inlaw: 'pariente político', friend: 'amigo/a', bond: 'compañero/a de armas', compadre: 'compadre', lover: 'pareja', comrade: 'camarada', coworker: 'compañero/a de trabajo', neighbor: 'vecino/a', employer: 'patrón', employee: 'empleado/a', rival: 'rival', '2nd': 'conocido/a' };
})();
