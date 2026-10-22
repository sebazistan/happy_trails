/* CUBEA — captives.js : PRISONERS AS PEOPLE — taking, holding, questioning, trying, and letting go, in the world.

   A man who surrenders is no longer removed from the map and filed in a list. He stays a person on the ground:
   TAKE     verb on a surrendered or wounded soldier: disarm him; he follows whoever took him (or sits where he is tied).
   HOLD     tie him up (stay put) or march him on (follow); a stockade post gives the camp a place for it; guards are people:
            a captive with no rebel within ~110 px for half a minute tries to run, and sometimes gets away (heat +, a soldier who
            knows where your camp is).
   FEED     captives eat the camp's food (a verb to hand them a ration, a daily cost otherwise).
   QUESTION verb with four approaches: ask politely, offer food and a cigarette, press him, beat him. Each yields different
            intelligence (the army's positions are marked on your map), different chances of the truth, a different conscience:
            beating a prisoner is an atrocity in the ledger of justice, fear and mercy, and your own people see it.
   TRY      a trial at a tribunal table (or on the spot): the people nearby gather, charges are heard, and the audience's own values
            (justicia vs disciplina, from ideology.js) decide. A tried man's execution costs far less in mercy and justice than a
            summary shooting, and an acquittal gains more. Informers are tried the same way.
   RELEASE  verbs: let him go under amnesty, treat and free him, exchange him through the Red Cross, or have him shot. A
            released man WALKS to the nearest road out of the scene and is gone; he remembers.
   g.prisoners (ids) stays in sync for the older event cards and daily upkeep.
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, T = C.T;
  const rnd = Math.random;
  const A = () => C.ai;

  // TUNE ---------------------------------------------------------------------------------------------------------------
  const TUNE = {
    escapeAfter: 28, escapeChance: 0.012,      // seconds unguarded before he might bolt; per-second chance after
    guardRange: 110, followDist: 36, trial: { gather: 150, secs: 24 }, interrogate: { dur: 26 },
    memoryBeat: 0.9,                           // how much worse a beating is than an execution for conscience (justice −)
  };
  C.CAPTIVE_TUNE = TUNE;
  const inv = (a) => C.initInv(a.p);

  // THE STOCKADE (a thing): a post and a rope ring where captives are kept
  C.THINGS.estacada = { n: 'Stockade post', draw(c, t) { c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(t.x, t.y + 2, 9, 3, 0, 0, 6.3); c.fill(); c.strokeStyle = 'rgb(96,72,48)'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(t.x, t.y + 2); c.lineTo(t.x, t.y - 12); c.stroke(); c.strokeStyle = 'rgb(176,150,100)'; c.lineWidth = 1; c.beginPath(); c.arc(t.x, t.y - 5, 5, 0, 6.3); c.stroke(); c.strokeStyle = 'rgba(96,72,48,.8)'; c.lineWidth = 1.2; c.beginPath(); c.arc(t.x, t.y + 1, 14, 0, 6.3); c.setLineDash([2, 3]); c.stroke(); c.setLineDash([]); } };
  C.THINGS.tribunal = { n: 'Tribunal table', draw(c, t) { c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(t.x, t.y + 2, 11, 3.4, 0, 0, 6.3); c.fill(); c.fillStyle = 'rgb(84,62,40)'; c.fillRect(t.x - 9, t.y - 1, 1.6, 5); c.fillRect(t.x + 7.4, t.y - 1, 1.6, 5); c.fillStyle = 'rgb(122,92,60)'; c.fillRect(t.x - 10, t.y - 5, 20, 4); c.fillStyle = 'rgb(236,226,196)'; c.fillRect(t.x - 5, t.y - 7, 6, 2.4); c.fillStyle = 'rgb(170,40,40)'; c.fillRect(t.x + 3, t.y - 8, 2.4, 3); } };
  C.registerVerb({ id: 'raise_stockade', n: 'Set up a stockade post / tribunal table', icon: '⛓', kinds: ['ground'], reach: 16, dur: 10,
    variants: () => [{ param: { k: 'estacada' }, label: 'Set up a stockade post (2 scrap)' }, { param: { k: 'tribunal' }, label: 'Set up a tribunal table (2 scrap)' }],
    check: (a, tg, p) => (G().res.scrap < 2 ? 'Needs 2 scrap.' : C.nearestThing(a.scene, tg.x, tg.y, null, 14) ? 'Something is in the way.' : null),
    done: (a, tg, p) => { G().res.scrap -= 2; C.addThing(a.scene, p.k, tg.x, tg.y, {}); return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // TAKING AND HOLDING
  // ------------------------------------------------------------------------------------------------------------------
  const isCaptive = (a) => !!a.captive;
  C.captureActor = function (a, keeper) {
    const g = G(), p = a.p; C.policyInit && C.policyInit(); if (a.captive) return true;
    if (g.prisoners.length >= 8) { C.ui.toast('You cannot hold more than eight prisoners'); return false; }
    if (a.weapon) C.dropWeapon(a); a.surrendered = true; a.weaponOut = false; a.order = null; a.path = null; a.brain.mode = 'idle';
    a.captive = { keeper, since: g.time, free: 0, tied: false, fedDay: g.day }; p.status = 'jailed'; p.note = 'Held by the rebels.'; g.prisoners.push(p.id);
    C.log(`${C.tagName(p)} is taken prisoner.`, 'info'); return true;
  };
  const keep = (p) => { const g = G(); g.prisoners = g.prisoners.filter((x) => x !== p.id); };
  C.registerVerb({ id: 'capture', n: 'Take him prisoner', icon: '🪢', kinds: ['actor'], reach: 22, dur: 6,
    check: (a, tg) => { const q = tg.o; if (q.side !== 'army' || q.dead) return 'Not an enemy soldier.'; if (q.captive) return 'Already your prisoner.'; if (!q.surrendered && q.p.hp > q.p.maxHp * 0.4) return 'He is still fighting.'; return null; },
    done: (a, tg) => (C.captureActor(tg.o, a) ? null : 'You cannot hold more.') });
  C.registerVerb({ id: 'tie_up', n: 'Tie him here / march him on', icon: '🪢', kinds: ['actor'], reach: 22, dur: 3,
    check: (a, tg) => (!tg.o.captive ? 'Not a prisoner.' : null),
    done: (a, tg) => { const c = tg.o.captive; c.tied = !c.tied; c.keeper = a; c.spot = { x: tg.o.x, y: tg.o.y }; C.say(tg.o, c.tied ? '…' : 'Voy, voy.', '#444', 2); return null; } });
  C.registerVerb({ id: 'feed_captive', n: 'Give him a ration', icon: '🍚', kinds: ['actor'], reach: 22, dur: 3,
    check: (a, tg) => (!tg.o.captive ? 'Not a prisoner.' : (inv(a).food || 0) < 1 && G().res.food < 1 ? 'No food to give.' : null),
    done: (a, tg) => { if (!C.invTake(a.p, 'food', 1)) G().res.food--; const p = tg.o.p; p.needs.food = clamp(p.needs.food + 30, 0, 100); p.trueStance += 2; p.needs.dignity = clamp(p.needs.dignity + 3, 0, 100); tg.o.captive.fedDay = G().day; C.say(tg.o, 'Gracias.', '#1d5b2a', 2); return null; } });

  /** One frame for a captive (called from ai.js armyUpdate before anything else). Returns true if he is a captive. */
  C.captiveUpdate = function (s, a, dt) {
    const c = a.captive; if (!c) return false; const g = G(); a.weaponOut = false; a.working = false;
    // released: walk to the road and out
    if (c.release) {
      if (!c.exit) { let best = null, bd = 1e9; for (const e of s.exits) { const ex = (e.x + e.w / 2) * T, ey = (e.y + e.h / 2) * T, d = Math.hypot(ex - a.x, ey - a.y); if (d < bd) { bd = d; best = { x: ex, y: ey }; } } c.exit = best || { x: s.spawn.x, y: s.spawn.y }; A().setPath(s, a, c.exit.x, c.exit.y); }
      const done = A().followPath(s, a, dt, a.speed * A().terrainSpeed(s, a) * 0.9); if (done || Math.hypot(c.exit.x - a.x, c.exit.y - a.y) < 14) { const how = c.release; a.captive = null; keep(a.p); G().prisoners = G().prisoners.filter((x) => x !== a.p.id); C.handlePrisoner(a, how); }
      return true;
    }
    if (c.escaped) { const done = A().followPath(s, a, dt, a.speed * 1.5 * A().terrainSpeed(s, a)); if (done) { a.gone = true; const i = s.actors.indexOf(a); if (i >= 0) s.actors.splice(i, 1); keep(a.p); a.p.status = 'away'; g.regime.heat = Math.min(100, g.regime.heat + 1); C.log(`${C.tagName(a.p)} escaped. He knows where your camp is.`, 'warn'); } a.running = true; return true; }
    // guards
    const guard = s.actors.some((q) => !q.dead && (q.side === 'rebel' || q.isPlayer) && !q.captive && Math.hypot(q.x - a.x, q.y - a.y) < TUNE.guardRange);
    c.free = guard ? Math.max(0, c.free - dt * 2) : c.free + dt;
    if (c.free > TUNE.escapeAfter && rnd() < TUNE.escapeChance * dt * 60 / 60) { c.escaped = true; c.tied = false; let best = null, bd = 1e9; for (const e of s.exits) { const ex = (e.x + e.w / 2) * T, ey = (e.y + e.h / 2) * T, d = Math.hypot(ex - a.x, ey - a.y); if (d < bd) { bd = d; best = { x: ex, y: ey }; } } if (best) A().setPath(s, a, best.x, best.y); C.say(a, '¡Corre!', '#7a1d1d', 2); return true; }
    if (c.tied) { a.moving = false; return true; }
    const k = c.keeper && !c.keeper.dead && c.keeper.scene === s ? c.keeper : s.actors.find((q) => !q.dead && (q.isPlayer)) || null; if (!k) { a.moving = false; return true; }
    const d = Math.hypot(k.x - a.x, k.y - a.y); if (d > TUNE.followDist) { if (!a.path || (a.repT = (a.repT || 0) - dt) <= 0) { a.repT = 1; A().setPath(s, a, k.x, k.y + 6); } A().followPath(s, a, dt, a.speed * A().terrainSpeed(s, a) * 0.9); } else a.moving = false;
    return true;
  };

  // ------------------------------------------------------------------------------------------------------------------
  // QUESTIONING
  // ------------------------------------------------------------------------------------------------------------------
  C.registerVerb({ id: 'interrogate', n: 'Question him', icon: '❓', kinds: ['actor'], reach: 24, dur: TUNE.interrogate.dur,
    variants: () => [{ param: { how: 'ask' }, label: 'Ask politely' }, { param: { how: 'kind' }, label: 'Offer food and a cigarette' }, { param: { how: 'press' }, label: 'Press him (threaten)' }, { param: { how: 'beat' }, label: 'Beat him (a crime)' }],
    check: (a, tg) => (!tg.o.captive ? 'He must be your prisoner.' : null),
    done: (a, tg, p) => {
      const g = G(), s = a.scene, q = tg.o, qp = q.p; const how = p.how; q.captive.questioned = (q.captive.questioned || 0) + 1;
      const willing = clamp(0.25 + (qp.trueStance + 50) / 200 * -0.2 + (how === 'kind' ? 0.3 : 0) + (how === 'press' ? 0.2 : 0) + (how === 'beat' ? 0.35 : 0) - (qp.traits.includes('stoic') ? 0.2 : 0) - (qp.morale > 65 ? 0.12 : 0) + (qp.needs.food < 35 && how === 'kind' ? 0.2 : 0) - (q.captive.questioned > 2 ? 0.15 : 0), 0.05, 0.92);
      const truthful = how === 'beat' ? 0.55 : how === 'press' ? 0.7 : how === 'kind' ? 0.9 : 0.8;
      if (how === 'kind') { if (!C.invTake(a.p, 'food', 1)) { if (g.res.food >= 1) g.res.food--; } qp.needs.food = clamp(qp.needs.food + 25, 0, 100); qp.trueStance += 3; }
      if (how === 'press') { qp.fear = clamp(qp.fear + 20, 0, 100); g.rep.fear = clamp(g.rep.fear + 1, 0, 100); }
      if (how === 'beat') { C.hurt(q, 12 + rnd() * 10, a, 0, 'beating'); g.rep.justice = clamp(g.rep.justice - TUNE.memoryBeat * 6, 0, 100); g.rep.fear = clamp(g.rep.fear + 5, 0, 100); C.noteMercy && C.noteMercy(-1.4); g.rep.discipline = clamp(g.rep.discipline - 1, 0, 100); for (const o of s.actors) if (!o.dead && (o.side === 'rebel') && !o.captive && Math.hypot(o.x - a.x, o.y - a.y) < 200) { o.p.mind && (o.p.mind.trauma = Math.min(100, (o.p.mind.trauma || 0) + 4)); if (o.p.traits.includes('idealist') || (o.p.cr && o.p.cr.justicia > 0.4)) { o.p.trueStance -= 2; C.say(o, 'Eso no está bien…', '#7a1d1d', 3); } } C.addEvent({ type: 'beating', victim: qp, perpSide: 'rebel', val: -1, sev: 34, pub: 0.3, x: q.x, y: q.y, scene: s, settlement: s.sid, text: `Rebels beat the prisoner ${C.tagName(qp)}`, memText: 'The rebels beat our captured soldier' }); }
      if (rnd() > willing) { C.say(q, how === 'beat' ? '…no sé nada.' : 'No voy a decir nada.', '#444', 3); C.log(`${C.tagName(qp)} told you nothing.`, 'info'); return null; }
      s.spotted = s.spotted || []; let n = 0; const lie = rnd() > truthful;
      for (const o of s.actors) if (o.side === 'army' && !o.dead && !o.captive) { const x = o.x + (lie ? (rnd() - 0.5) * 380 : 0), y = o.y + (lie ? (rnd() - 0.5) * 380 : 0); s.spotted.push({ x, y, t: 24 }); n++; }
      C.say(q, 'Hay guardias por allá…', '#444', 3); C.log(`${C.tagName(qp)} talks: ${n} positions marked${lie ? ' (some of it was a lie, you will find)' : ''}.`, lie ? 'warn' : 'good');
      if (how !== 'beat' && how !== 'press' && qp.trueStance > -20 && rnd() < 0.12) { qp.trueStance += 12; C.log(`${C.tagName(qp)} says he has had enough of fighting for Batista.`, 'info'); }
      return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // RELEASE, EXCHANGE, EXECUTION (the old rules, now carried out by a person walking away or a verdict)
  // ------------------------------------------------------------------------------------------------------------------
  C.registerVerb({ id: 'free_captive', n: 'Let him go…', icon: '🕊', kinds: ['actor'], reach: 24, dur: 5,
    variants: () => [{ param: { how: 'amnesty' }, label: 'Release him under amnesty' }, { param: { how: 'treat' }, label: 'Treat his wounds and free him (1 medicine)' }, { param: { how: 'exchange' }, label: 'Exchange him through the Red Cross' }],
    check: (a, tg, p) => { if (!tg.o.captive) return 'He is not a prisoner.'; if (p && p.how === 'treat' && G().res.med < 1) return 'No medicine to spare.'; return null; },
    done: (a, tg, p) => { const c = tg.o.captive; if (p.how === 'treat') { G().res.med--; tg.o.p.hp = tg.o.p.maxHp; tg.o.p.bleed = 0; } c.release = p.how === 'treat' ? 'amnesty' : p.how; c.tied = false; C.say(tg.o, 'Gracias, compañero.', '#1d5b2a', 3); if (p.how === 'treat') { C.noteMercy && C.noteMercy(1.0); G().stats.treated = (G().stats.treated || 0) + 1; } return null; } });
  C.registerVerb({ id: 'execute_captive', n: 'Have him shot', icon: '⚰', kinds: ['actor'], reach: 24, dur: 6,
    check: (a, tg) => (!tg.o.captive ? 'He is not a prisoner.' : null),
    done: (a, tg) => { const q = tg.o; q.captive = null; keep(q.p); C.handlePrisoner(q, 'execute'); return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // THE TRIAL
  // ------------------------------------------------------------------------------------------------------------------
  C.registerVerb({ id: 'try', n: 'Hold a trial', icon: '⚖', kinds: ['actor', 'thing:tribunal'], reach: 60, dur: TUNE.trial.secs,
    variants: (tg) => (tg.kind === 'actor' ? [{ param: { at: 'here' }, label: 'Try him here, before whoever is near' }] : []),
    check: (a, tg, p) => { if (tg.kind === 'thing') { const q = a.scene.actors.find((o) => o.captive && Math.hypot(o.x - tg.x, o.y - tg.y) < 140); return q ? null : 'No prisoner beside the table.'; } const q = tg.o; if (!q.captive && !(q.p.informant && q.p.revealed)) return 'Only a prisoner or an unmasked informer can be tried.'; return null; },
    start: (a, tg) => { const s = a.scene, at = tg.kind === 'thing' ? tg : { x: tg.x, y: tg.y }; C.say(a, 'Que se oiga el caso.', '#222', 4); for (const o of s.actors) if (!o.dead && !o.inside && o.side !== 'army' && !o.captive && o !== a && Math.hypot(o.x - at.x, o.y - at.y) < TUNE.trial.gather * 2.2 && !o.react) { o.react = { id: 'gather', t: 0, until: G().time + TUNE.trial.secs + 4, at: { x: at.x, y: at.y }, subj: null, phase: 1 }; if (o.aw) o.aw.state = 'curious'; } },
    done: (a, tg) => {
      const g = G(), s = a.scene; const at = tg.kind === 'thing' ? tg : { x: tg.x, y: tg.y };
      const q = tg.kind === 'thing' ? s.actors.find((o) => o.captive && Math.hypot(o.x - tg.x, o.y - tg.y) < 140) : tg.o; if (!q) return 'The accused is gone.';
      const aud = s.actors.filter((o) => !o.dead && !o.inside && o !== q && o.side !== 'army' && Math.hypot(o.x - at.x, o.y - at.y) < TUNE.trial.gather * 2.4);
      let mercy = 0, sev = 0; for (const o of aud) { const cr = C.crOf(o.p); mercy += cr.justicia - cr.disciplina * 0.3 + (o.p.traits.includes('devout') ? 0.15 : 0); sev += o.p.anger / 100 + (o.p.trueStance < 0 ? 0 : 0); }
      const n = Math.max(1, aud.length), qp = q.p;
      const guilt = qp.informant ? 0.85 : (qp.crime || (rnd() < 0.3 ? 0.7 : 0.15)); const crimeNote = qp.informant ? 'selling you out' : guilt > 0.5 ? 'abusing peasants' : 'being a soldier of the regime';
      const score = guilt * 1.4 - mercy / n * 0.8 + sev / n * 0.5 + (rnd() - 0.5) * 0.5;      // >0.55 = guilty and condemned
      const condemn = score > 0.55 && guilt > 0.5;
      C.log(`Trial of ${C.tagName(qp)}, accused of ${crimeNote}, before ${aud.length} people: ${condemn ? 'GUILTY — condemned.' : 'not condemned.'}`, condemn ? 'warn' : 'good');
      if (condemn) { q.captive = null; keep(qp); const jb = g.rep.justice, nm = C.noteMercy ? C.noteMercy : () => 0; C.handlePrisoner(q, 'execute'); g.rep.justice = clamp(jb - 4 + 0, 0, 100); g.rep.fear = clamp(g.rep.fear - 5, 0, 100); C.adjustRep('honesty', 1); C.say(a, 'Se ha hecho justicia, por la ley.', '#222', 4); }
      else { if (q.captive) { q.captive.release = 'amnesty'; q.captive.tied = false; } g.rep.justice = clamp(g.rep.justice + 3, 0, 100); C.say(a, 'No hay pruebas. Queda libre.', '#222', 4); if (qp.informant) { qp.informant = false; qp.revealed = false; } }
      for (const o of aud) { if (o.react && o.react.id === 'gather') o.react.until = 0; const cr = C.crOf(o.p), sided = condemn ? cr.disciplina - cr.justicia : cr.justicia - cr.disciplina; o.p.trueStance += sided > 0.3 ? 1 : sided < -0.3 ? -1 : 0; if (o.side === 'rebel' && sided < -0.3) C.say(o, condemn ? 'Demasiado…' : 'Debieron fusilarlo.', '#7a1d1d', 3); }
      return null; } });
})();
