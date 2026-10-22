/* CUBEA — ideology.js : CREED, TEXTS, SPEECH, PROMISES — what the revolution says, and what that does to the people who hear it.

   THE MODEL
   • Six values, each -1 … +1, for every person (p.cr):
       patria      the nation and its sovereignty (Martí; anti-intervention)       tierra     land and the dignity of the poor
       justicia    law, mercy and a clean hand (against vengeance)                 disciplina order, obedience, sacrifice
       fe          religion and tradition (the Virgen de la Caridad, the village)  igualdad  race, women and the humble as equals
     A person's starting values come from class, faction, occupation and the ordinary scatter of any village.
   • The CREED (g.creed) is what YOU have been saying: a running, weighted average of the values of every text you have
     read, speech you have given, and promise you have made. It is hand-tailored by what you choose to say, not a slider.
   • The DEEDS (C.deedsOf) are what you have been doing: justice and discipline reputation, land actually granted, etc.
   • ALIGNMENT is how close a person's values are to the creed. The GAP between creed and deeds is hypocrisy, and
     people notice it exactly where they are stung: a soldier who was told "we do not shoot prisoners" and watched one shot.

   WHAT IT DOES TO TROOPS (C.creedDaily, C.creedObedience)
     alignment ↑  → loyalty ↑, hope ↑, obedience ↑ (more if disciplina is high), friendships form faster (shared words)
     zeal (p.zeal 0-100, built by repeated, emotional, aligned words) → braver under fire, harsher to prisoners and doubters;
          zealots quarrel with the lukewarm and the sceptical, and a gap between word and deed shatters them hardest
     sceptics (educated, literate, older) resist propaganda — a pamphlet bounces off; a letter that treats them as an equal doesn't
     hypocrisy → disillusion: loyalty and zeal drop, desertion risk rises, and people say so out loud

   HOW WORDS ARE DELIVERED (all physical, all verbs — no "advance ideology" button)
     read_aloud   at a fire or blackboard: those listening within earshot hear a TEXT (literacy not needed)
     speech       a address to everyone nearby, with an emphasis you choose (variants), costs voice and time, rewards an audience
     pamphlet     hand one to a literate person (they read it later alone; sceptics weigh it), or nail one up (a poster that works on passers-by)
     letter       to one person, tailored to their need: far stronger than a speech, and it takes an evening
     speak/promise  individual lines on the wheel whose options CHANGE with the listener's state (hungry, wounded, afraid, grieving…)

   PROMISES   C.promise(p, kind, days) → ledger entry; fulfilled by deeds (grant a plot, give a rifle, treat, free a prisoner);
              broken on the due date → a negative memory along their family edges and a hit to honesty.

   TUNE: numbers in the TUNE block. This file registers verbs and writes to g.creed, p.cr, p.zeal, g.promises.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp;
  const AX = ['patria', 'tierra', 'justicia', 'disciplina', 'fe', 'igualdad'];
  C.CREED_AXES = AX;

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    gainRead: 0.10, gainSpeech: 0.06, gainLetter: 0.30, gainPoster: 0.03, gainPamph: 0.14,     // base drift toward a text per exposure
    sceptic: 0.6,              // how much a sceptic's gain is cut
    zealGain: 6, zealDecay: 0.4,
    alignLoyal: 0.5,           // loyalty (trueStance) per day at perfect alignment
    obeyDisc: 0.12,            // obedience bonus at full alignment with a disciplinarian creed
    hypoDrop: 0.5,             // loyalty/zeal loss per day per unit of creed-deed gap (0..1)
    earshot: 90,               // px for a speech or reading
    creedMemory: 0.15,         // how fast the creed follows what you say (0..1 per text)
  };
  C.CREED_TUNE = TUNE;

  // ------------------------------------------------------------------------------------------------------------------
  // TEXTS: the library. v = value vector (any axes omitted = 0). The real titles are real; what each one *does* in the game is
  // our reading of its themes, not a quotation. {lit:true} = needs the listener to hold the paper; reading aloud works for all.
  // ------------------------------------------------------------------------------------------------------------------
  C.TEXTS = {
    marti_nuestra: { n: 'Martí — "Nuestra América"', v: { patria: 1, igualdad: 0.6, tierra: 0.3 }, tone: 'poetic', len: 1 },
    marti_versos:  { n: 'Martí — Versos sencillos', v: { patria: 0.6, justicia: 0.5, fe: 0.3 }, tone: 'poetic', len: 1 },
    historia:      { n: 'Fidel — "La historia me absolverá"', v: { tierra: 1, justicia: 0.6, patria: 0.6, igualdad: 0.5 }, tone: 'forensic', len: 2 },
    manifiesto:    { n: 'The Sierra Maestra Manifesto', v: { patria: 0.7, justicia: 0.6, tierra: 0.3 }, tone: 'civic', len: 1 },
    cubano_libre:  { n: 'El Cubano Libre (news-sheet)', v: { patria: 0.4, disciplina: 0.4 }, tone: 'martial', len: 1 },
    cartilla:      { n: 'Cartilla (primer) with civic lessons', v: { igualdad: 0.5, justicia: 0.3, disciplina: 0.2 }, tone: 'plain', len: 1 },
    reglamento:    { n: 'Rules of the column', v: { disciplina: 1, justicia: 0.5 }, tone: 'martial', len: 1 },
    sermon:        { n: 'Words of the village priest', v: { fe: 1, justicia: 0.4 }, tone: 'plain', len: 1 },
    venganza:      { n: 'A call for vengeance', v: { disciplina: 0.3, justicia: -0.9, patria: 0.3 }, tone: 'fiery', len: 1 },
  };
  // Speeches: emphasis variants chosen at the wheel. Each speaks to one or two values.
  C.SPEECHES = [
    { id: 'sp_patria', label: 'Speak of the nation', v: { patria: 1 }, line: 'Cuba is ours — not Washington’s, not Batista’s.' },
    { id: 'sp_tierra', label: 'Speak of the land', v: { tierra: 1, igualdad: 0.3 }, line: 'The man who works the soil should hold the deed.' },
    { id: 'sp_justicia', label: 'Speak of mercy and law', v: { justicia: 1 }, line: 'We are not what we are fighting. We do not shoot the helpless.' },
    { id: 'sp_disciplina', label: 'Speak of discipline', v: { disciplina: 1 }, line: 'A column that argues in the dark gets buried in the morning.' },
    { id: 'sp_fe', label: 'Speak of faith and home', v: { fe: 1 }, line: 'The Virgen watches the mountains too.' },
    { id: 'sp_igualdad', label: 'Speak of equality', v: { igualdad: 1 }, line: 'Black, white, man or woman — the same bullet, the same bread.' },
    { id: 'sp_sacrificio', label: 'Rally them to sacrifice', v: { disciplina: 0.8, patria: 0.6 }, line: 'Tonight is hard so that our children’s nights are not.', zeal: 2 },
  ];

  // ------------------------------------------------------------------------------------------------------------------
  // PERSONAL VALUES: seeded from faction/class/occupation; stable, lazily created.
  // ------------------------------------------------------------------------------------------------------------------
  const FAC_BASE = { peasants: { tierra: 0.5, fe: 0.3 }, workers: { igualdad: 0.3, justicia: 0.2 }, students: { patria: 0.4, justicia: 0.4, fe: -0.2 }, middle: { justicia: 0.2, fe: 0.1 }, church: { fe: 0.8, justicia: 0.3 }, elite: { disciplina: 0.3, tierra: -0.5 }, landowners: { tierra: -0.7, disciplina: 0.3 }, army: { disciplina: 0.6, patria: 0.2 } };
  C.crOf = function (p) {
    if (p.cr) return p.cr;
    const base = FAC_BASE[p.fac] || {}; const h = C.hash ? C.hash(p.id) : (Number(p.id) * 2654435761) >>> 0; const cr = {};
    AX.forEach((k, i) => { const jitter = (((h >>> (i * 4)) & 15) / 15 - 0.5) * 0.9; cr[k] = clamp((base[k] || 0) + jitter, -1, 1); });
    p.cr = cr; if (p.zeal == null) p.zeal = 0; return cr;
  };
  const dot = (a, b) => { let s = 0, n = 0; for (const k of AX) { const w = Math.abs(b[k] || 0); if (!w) continue; s += (a[k] || 0) * Math.sign(b[k]) * w; n += w; } return n ? s / n : 0; };
  /** -1…+1: how closely a person's values match the creed you preach. */
  C.alignment = function (p) { const g = G(); C.initCreed(); return dot(C.crOf(p), g.creed); };
  C.initCreed = function () { const g = G(); if (!g.creed) { g.creed = {}; AX.forEach((k) => { g.creed[k] = 0; }); g.said = {}; } return g.creed; };

  /** What you have done, on the same six axes, scaled -1…+1 (the proxies are documented in docs/IDEOLOGY.md). */
  C.deedsOf = function () {
    const g = G(), r = g.rep, L = g.land || {};
    return { patria: clamp(((g.mood || 0) * 0.05) + (100 - (g.regime ? g.regime.usSupport : 50)) / 100 - 0.2, -1, 1), tierra: clamp((L.families || 0) / 25 - 0.2, -1, 1), justicia: clamp((r.justice - 50) / 40, -1, 1), disciplina: clamp((r.discipline - 50) / 40, -1, 1), fe: 0, igualdad: g.flags && g.flags.racialEq ? 0.5 : 0 };
  };
  /** 0…1: how much you preach what you do not practise (only the axes you have been loud about count). */
  C.creedGap = function () {
    const g = G(); C.initCreed(); const d = C.deedsOf(); let s = 0, n = 0;
    for (const k of AX) { const said = g.creed[k]; if (said <= 0.15) continue; const gap = Math.max(0, said - d[k]) / 2; s += gap * said; n += said; }
    return n ? clamp(s / n * 1.6, 0, 1) : 0;
  };

  // ------------------------------------------------------------------------------------------------------------------
  // EXPOSURE: how one person takes a text. Returns the change in alignment, for the log and the tests.
  // ------------------------------------------------------------------------------------------------------------------
  const sceptic = (p) => (p.literate ? 0.35 : 0) + (p.cls >= 3 ? 0.25 : 0) + (p.fac === 'students' ? 0.2 : 0);
  C.expose = function (p, vec, gain, o) {
    o = o || {}; const cr = C.crOf(p), before = C.alignment(p);
    const g = G(); const trust = (o.speaker && C.bondOf ? C.bondOf(o.speaker, p) : 0) * 0.002;
    const receptive = clamp(0.4 + p.needs.hope / 200 + (p.needs.food < 30 ? -0.1 : 0) + trust, 0.15, 1.1);
    const sc = 1 - Math.min(0.9, sceptic(p)) * (o.personal ? 0.15 : TUNE.sceptic);
    for (const k of AX) { const t = vec[k]; if (!t) continue; cr[k] = clamp(cr[k] + (t - cr[k]) * gain * receptive * sc * Math.abs(t), -1, 1); }
    p.zeal = clamp((p.zeal || 0) + (o.zeal != null ? o.zeal : TUNE.zealGain * gain * 4) * receptive * (before > -0.1 ? 1 : 0.2), 0, 100);
    return C.alignment(p) - before;
  };
  /** Fold what you just said into the creed (so what troops compare against your deeds is what you actually said). */
  function say(vec, mult) { const g = G(); C.initCreed(); for (const k of AX) { const t = vec[k] || 0; if (!t) continue; g.creed[k] = clamp(g.creed[k] + (t * (mult || 1) - g.creed[k]) * TUNE.creedMemory * Math.abs(t), -1, 1); } }
  const listeners = (a, r) => a.scene.actors.filter((q) => q !== a && !q.dead && !q.inside && !q.sleeping && Math.hypot(q.x - a.x, q.y - a.y) < (r || TUNE.earshot));

  // ------------------------------------------------------------------------------------------------------------------
  // VERBS
  // ------------------------------------------------------------------------------------------------------------------
  const inv = (a) => C.initInv(a.p);
  const has = (a, k, n) => (inv(a)[k] || 0) >= (n || 1);
  const textVariants = () => Object.keys(C.TEXTS).map((id) => ({ param: { text: id }, label: 'Read: ' + C.TEXTS[id].n }));

  C.registerVerb({ id: 'read_aloud', n: 'Read aloud', icon: '📖', kinds: ['thing:fire', 'thing:pizarra'], reach: 30, dur: 12, variants: textVariants,
    check: (a, tg, p) => (!a.p.literate ? 'You must be able to read to read aloud.' : null),
    done: (a, tg, p) => { const T = C.TEXTS[p.text], L = listeners(a); let n = 0; for (const q of L) { C.expose(q.p, T.v, TUNE.gainRead, { speaker: a.p }); n++; } say(T.v, 0.8); C.say(a, T.n.split('—').pop().trim().slice(0, 28) + '…', '#222', 3); C.log(`${C.tagName(a.p)} read “${T.n}” aloud to ${n}.`, 'info'); return n ? null : 'Nobody was listening.'; } });

  C.registerVerb({ id: 'speech', n: 'Address them', icon: '📢', kinds: ['actor', 'ground'], reach: 40, dur: 10,
    variants: () => C.SPEECHES.map((s) => ({ param: { sp: s.id }, label: s.label })),
    check: (a) => (a.p.needs.energy < 15 ? 'Too exhausted to speak.' : null),
    done: (a, tg, p) => { const S = C.SPEECHES.find((x) => x.id === p.sp), L = listeners(a, 110); let n = 0; for (const q of L) { C.expose(q.p, S.v, TUNE.gainSpeech * (1 + Math.min(L.length, 12) * 0.05), { speaker: a.p, zeal: (S.zeal || 1) * 3 }); n++; } say(S.v, 0.9); C.say(a, S.line, '#222', 4.5); C.log(`${C.tagName(a.p)} spoke to ${n}: ${S.label.toLowerCase()}.`, 'info'); if (n) a.p.needs.energy = clamp(a.p.needs.energy - 3, 0, 100); return n ? null : 'Nobody was there to hear.'; } });

  C.registerVerb({ id: 'give_pamphlet', n: 'Hand a pamphlet', icon: '📃', kinds: ['actor'], reach: 20, dur: 3,
    variants: () => ['historia', 'manifiesto', 'cartilla', 'cubano_libre', 'reglamento'].map((id) => ({ param: { text: id }, label: 'Hand: ' + C.TEXTS[id].n })),
    check: (a, tg) => (!has(a, 'pamph') ? 'No pamphlets in the pack.' : tg.o.isPlayer ? 'Hand it to someone else.' : !tg.o.p.literate ? 'They cannot read — read it to them instead.' : null),
    done: (a, tg, p) => { inv(a).pamph--; const T = C.TEXTS[p.text]; const d = C.expose(tg.o.p, T.v, TUNE.gainPamph, { speaker: a.p }); say(T.v, 0.5); C.say(tg.o, d > 0.02 ? 'Lo voy a leer esta noche.' : 'Hm. Papel…', '#222', 3); return null; } });

  C.registerVerb({ id: 'post_poster', n: 'Nail up a poster', icon: '🪧', kinds: ['ground'], reach: 14, dur: 5,
    variants: () => ['historia', 'manifiesto', 'cubano_libre', 'cartilla'].map((id) => ({ param: { text: id }, label: 'Poster: ' + C.TEXTS[id].n })),
    check: (a) => (!has(a, 'pamph') ? 'No pamphlets to post.' : null),
    done: (a, tg, p) => { inv(a).pamph--; C.addThing(a.scene, 'cartel', tg.x, tg.y, { text: p.text }); return null; } });

  C.registerVerb({ id: 'write_letter', n: 'Write them a letter', icon: '✉', kinds: ['actor'], reach: 30, dur: 24,
    variants: () => AX.map((k) => ({ param: { ax: k }, label: 'Letter about ' + k })),
    check: (a, tg) => (!a.p.literate ? 'You must be able to write.' : !tg.o.p.literate ? 'They cannot read it.' : tg.o.isPlayer ? 'To yourself?' : null),
    done: (a, tg, p) => { const vec = { [p.ax]: 1 }; const q = tg.o.p; const d = C.expose(q, vec, TUNE.gainLetter, { speaker: a.p, personal: true, zeal: 4 }); say(vec, 0.6); C.bondEvent && C.bondEvent(a.p, q, 'shared', 1.5); q.needs.hope = clamp(q.needs.hope + 4, 0, 100); C.log(`${C.tagName(a.p)} wrote to ${C.tagName(q)} about ${p.ax}${d > 0.05 ? ' — it landed' : ''}.`, 'good'); return null; } });

  // Posters work on the passers-by: each day people near a cartel drift a little toward its text (see creedDaily).

  // ------------------------------------------------------------------------------------------------------------------
  // THE PROMISE LEDGER AND THE VOICE (what you say to ONE person; the options depend on who they are and how they are)
  // ------------------------------------------------------------------------------------------------------------------
  /** Make a promise. kind: land | rifle | medicine | release | rest | pay. Returns the entry. */
  C.promise = function (p, kind, days) {
    const g = G(); const e = { kind, day: g.day, due: g.day + (days || 14), who: p.id, paid: false, broken: false };
    g.promises.push(e); C.log(`You promised ${C.tagName(p)}: ${kind}${days ? ` (within ${days} days)` : ''}.`, 'info'); return e;
  };
  /** Called by the verbs that deliver (grant, give a rifle, treat…). Marks the oldest open promise of that kind kept. */
  C.promiseFulfil = function (p, kind) {
    const g = G(); const e = g.promises.find((x) => x.who === p.id && x.kind === kind && !x.paid && !x.broken); if (!e) return false;
    e.paid = true; C.adjustRep('honesty', 3); p.needs.hope = clamp(p.needs.hope + 10, 0, 100); p.trueStance += 4; C.log(`You kept your promise to ${C.tagName(p)}.`, 'good'); return true;
  };
  function promiseDaily(g) {
    for (const e of g.promises) {
      if (e.paid || e.broken || e.kind === 'vale' || g.day < e.due) continue;
      if (e.kind === 'rest') { const r = C.P(e.who); if (r && r.needs.energy > 50) { e.paid = true; continue; } }
      e.broken = true; const q = C.P(e.who) || C.W.people.find((x) => x.id === e.who); if (!q) continue;
      C.adjustRep('honesty', -6); q.trueStance -= 8; q.needs.hope = clamp(q.needs.hope - 12, 0, 100);
      C.addEvent({ type: 'promise_broken', victim: q, perpSide: 'rebel', val: -1, sev: 30, pub: 0.25, x: 0, y: 0, settlement: q.settlement, text: `${C.tagName(q)} was promised ${e.kind} and got nothing`, memText: `They promised me ${e.kind} and did not keep their word` });
      C.log(`Your promise of ${e.kind} to ${C.tagName(q)} lapsed unkept.`, 'bad');
    }
  }

  /** The lines you can say to this person NOW. The list depends on their state — the point is that it is never the same menu twice. */
  C.voiceOptions = function (a, tg) {
    const q = tg.o.p, out = [], n = q.needs, rebel = tg.o.side === 'rebel';
    const L = (id, label, fx) => out.push({ param: { id }, label, fx });
    if (rebel) {
      if (n.food < 35) L('eat', 'Eat first. That’s an order.', (me, o) => { o.p.needs.hope += 2; });
      if (n.energy < 30) L('rest', 'Promise them rest', (me, o) => { C.promise(o.p, 'rest', 3); });
      if (q.hp < q.maxHp * 0.5) L('hold', 'Hold on — help is coming', (me, o) => { o.p.needs.hope += 5; C.bondEvent && C.bondEvent(me.p, o.p, 'shared', 0.5); });
      if (n.hope < 40) L('hope', 'Tell them why they are here', (me, o) => { C.expose(o.p, G().creed, 0.12, { speaker: me.p, personal: true }); o.p.needs.hope += 6; });
      if (!tg.o.weapon) L('rifle', 'Promise them a rifle', (me, o) => { C.promise(o.p, 'rifle', 10); });
      L('praise', 'Praise them before the others', (me, o) => { o.p.needs.hope += 5; o.p.zeal = clamp((o.p.zeal || 0) + 4, 0, 100); });
      L('rebuke', 'Rebuke them', (me, o) => { o.p.needs.hope -= 3; o.p.trueStance -= 1; G().rep.discipline += 0.5; });
      L('ask', 'Ask what they think', (me, o) => { C.bondEvent && C.bondEvent(me.p, o.p, 'shared', 1); o.p.trueStance += 1.5; if (C.alignment(o.p) < -0.2) C.say(o, 'Honestly? Not all of it sits right.', '#222', 4); });
    } else {
      L('landp', 'Promise land', (me, o) => { C.promise(o.p, 'land', 20); o.p.needs.hope += 8; });
      L('seedp', 'Promise seed and a hoe', (me, o) => { C.promise(o.p, 'seed', 10); o.p.needs.hope += 5; });
      L('medp', 'Promise medicine for the sick', (me, o) => { C.promise(o.p, 'medicine', 8); o.p.needs.hope += 4; });
      L('reassure', 'Reassure them: we do not harm the poor', (me, o) => { C.expose(o.p, { justicia: 1 }, 0.1, { speaker: me.p, personal: true }); });
    }
    return out;
  };
  C.registerVerb({ id: 'speak', n: 'Say…', icon: '💬', kinds: ['actor'], reach: 26, dur: 3,
    variants: (tg) => (tg.o && tg.o.p && !tg.o.isPlayer ? C.voiceOptions(C.G.player, tg).map((o) => ({ param: o.param, label: o.label })) : []),
    check: (a, tg) => (tg.o.isPlayer ? 'Talk to someone else.' : null),
    done: (a, tg, p) => { const opt = C.voiceOptions(a, tg).find((o) => o.param.id === p.id); if (!opt) return 'They are no longer in that state.'; opt.fx(a, tg.o); C.say(a, opt.label.replace(/^Promise /, 'I promise: ').replace(/\.$/, ''), '#222', 3); return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // DAILY: alignment → loyalty, hope; zeal; hypocrisy; posters; broken promises
  // ------------------------------------------------------------------------------------------------------------------
  C.creedDaily = function () {
    const g = G(); if (!g.squads) return; C.initCreed(); promiseDaily(g);
    const gap = C.creedGap(); g.creedGap = gap;
    const ids = g.squads.flatMap((s) => s.members); const s = g.scene;
    for (const id of ids) {
      const p = C.P(id); if (!p || p.status !== 'alive') continue; const al = C.alignment(p);
      p.trueStance = clamp(p.trueStance + al * TUNE.alignLoyal - gap * TUNE.hypoDrop * (p.zeal > 40 ? 1.8 : 1), -100, 100);
      p.needs.hope = clamp(p.needs.hope + al * 0.5 - gap * 0.8, 0, 100);
      p.zeal = clamp((p.zeal || 0) - TUNE.zealDecay - gap * 3, 0, 100);
      if (gap > 0.35 && p.zeal > 30 && Math.random() < 0.15) { const a = p.actor; if (a) C.say(a, 'They said one thing and did another…', '#7a1d1d', 4); }
      else if (al > 0.5 && Math.random() < 0.08 && p.actor) C.say(p.actor, ['“La patria es de todos.”', '“Tierra para el que la trabaja.”', '“Ni un paso atrás.”'][(Math.random() * 3) | 0], '#1d5b2a', 4);
    }
    // posters: those who live near one drift toward its text
    if (s && s.things) for (const t of s.things) if (t.k === 'cartel' && t.d.text) for (const a of s.actors) if (!a.dead && Math.hypot(a.x - t.x, a.y - t.y) < 60) C.expose(a.p, C.TEXTS[t.d.text].v, TUNE.gainPoster);
    // friction: zealots and sceptics in the same squad quarrel (cost to friendship)
    for (const sq of g.squads) { const ms = sq.members.map(C.P).filter((p) => p && p.status === 'alive'); const z = ms.filter((p) => p.zeal > 60), c = ms.filter((p) => C.alignment(p) < -0.2); if (z.length && c.length && Math.random() < 0.25) { const a = z[(Math.random() * z.length) | 0], b = c[(Math.random() * c.length) | 0]; if (a.actor) C.say(a.actor, 'Whoever is not with us is against us!', '#7a1d1d', 4); if (C.bondEvent) C.bondEvent(a, b, 'fought', -3); } }
  };
  /** Obedience bonus used by ai.js: aligned troops follow a disciplined creed; a hypocritical creed erodes it. */
  C.creedObedience = function (p) { const g = G(); if (!g.creed) return 0; const al = C.alignment(p); return al * TUNE.obeyDisc * (0.5 + Math.max(0, g.creed.disciplina)) - (g.creedGap || 0) * 0.1; };
  /** Inspector lines for a person. */
  C.creedLines = function (p) { C.initCreed(); const cr = C.crOf(p); const al = C.alignment(p); return { values: AX.map((k) => ({ k, v: cr[k] })), alignment: al, zeal: Math.round(p.zeal || 0), sceptic: sceptic(p) > 0.5 }; };

  // ------------------------------------------------------------------------------------------------------------------
  // THE CREED PANEL (Y): what you have said vs what you have done, how your people stand, and the promises you owe.
  // ------------------------------------------------------------------------------------------------------------------
  const cs = document.createElement('style');
  cs.textContent = '#creed{position:fixed;left:50%;top:70px;transform:translateX(-50%);width:min(520px,94vw);z-index:6;display:none;padding:10px 14px}#creed h3{margin:6px 0 4px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--gold)}#creed .bar{display:flex;align-items:center;gap:6px;font-size:12px;margin:5px 0;min-height:20px;line-height:1.3}#creed .bar>div.t+div.t{margin-left:-2px}#creed .bar b{width:78px;font-weight:500}#creed .t{flex:1;height:8px;background:rgba(255,255,255,.08);border-radius:4px;position:relative}#creed .t i{position:absolute;top:0;bottom:0;border-radius:4px}';
  document.head.appendChild(cs);
  function creedPanel() {
    const g = G(); let el = document.getElementById('creed'); if (!el) { el = document.createElement('div'); el.id = 'creed'; el.className = 'panel'; document.body.appendChild(el); }
    if (el.style.display === 'block') { el.style.display = 'none'; return; }
    C.initCreed(); const d = C.deedsOf(); const ppl = g.squads.flatMap((s) => s.members).map(C.P).filter((p) => p && p.status === 'alive');
    const avg = ppl.length ? ppl.reduce((s, p) => s + C.alignment(p), 0) / ppl.length : 0, zeal = ppl.length ? ppl.reduce((s, p) => s + (p.zeal || 0), 0) / ppl.length : 0;
    const bar = (v, col) => `<div class="t"><i style="left:${v < 0 ? 50 + v * 50 : 50}%;width:${Math.abs(v) * 50}%;background:${col}"></i></div>`;
    const open = g.promises.filter((p) => p.kind !== 'vale' && !p.paid && !p.broken);
    el.innerHTML = `<h3>What you say (gold) and what you do (green)</h3>${AX.map((k) => `<div class="bar"><b>${k}</b>${bar(g.creed[k], '#e8c36a')}${bar(d[k], '#7fd07a')}</div>`).join('')}
      <h3>Your people</h3><div style="font-size:12px">Agree with you: <b>${Math.round((avg + 1) * 50)}%</b> · zeal: <b>${Math.round(zeal)}</b> · word-vs-deed gap: <b>${Math.round((g.creedGap || 0) * 100)}%</b>${(g.creedGap || 0) > 0.35 ? ' <span style="color:#e57">— they are noticing</span>' : ''}</div>
      <h3>Promises you owe</h3><div style="font-size:12px">${open.length ? open.map((p) => `${C.tagName(C.P(p.who) || { first: '?', last: '' })}: ${p.kind} (${Math.max(0, p.due - g.day)} d)`).join('<br>') : 'None.'}</div>
      <div style="font-size:11px;opacity:.6;margin-top:6px">Say things with the wheel (Q) on people or ground; read at a fire or board; nail up posters. Y closes this.</div>`;
    el.style.display = 'block';
  }
  window.addEventListener('keydown', (e) => { const g = G(); if (!g || !g.scene || g.over || g.modalOpen || e.__cubea === undefined && false) return; if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return; if (e.key === 'y' || e.key === 'Y') creedPanel(); });
  C.openCreed = creedPanel;
})();
