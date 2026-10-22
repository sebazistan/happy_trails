/* CUBEA — recruits.js : VOLUNTEERS WALK INTO CAMP; YOU DECIDE AT THE EDGE OF IT.

   Recruitment used to be one menu line on a civilian. Now people come. Sympathisers who asked to join on the road (aware.js
   "wants to join"), and others the news of the rebels reaches, arrive at the camp's edge over the following days, in twos and
   threes, and stand there waiting. Each one is a person with a trade, a village, a reason and — sometimes — an employer.
   Waiting more than three days, they go home disappointed (a little sympathy lost).

   VERBS on a waiting volunteer
     question: ask why he came (reveals his reason and his convictions in words) · ask who vouches for him (a rebel who knows him
               lowers the chance that he is an informer to almost nothing) · test him with a rifle (reveals experience)
     decide:   enlist him with a rifle (uses one of the scarce rifles; resentment among the veterans), with a machete, or send him home
               as your eyes in his village (a covert helper), or turn him away kindly.
   Informers do apply: a man planted by the army has a smoother story than an honest one, and holes show if you ask well.
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, T = C.T;
  const rnd = Math.random;
  const TUNE = { base: 0.12, perFriend: 0.01, supportW: 0.002, maxWaiting: 6, patienceDays: 3, informerRate: 0.06, tells: { skilled: 0.6, plain: 0.3, vouched: 0.05 } };
  C.RECRUIT_TUNE = TUNE;
  const inv = (a) => C.initInv(a.p);
  const REASONS = { tierra: 'wants land of his own', justicia: 'cannot stand what the Guard has done', patria: 'says Cuba must be free of the foreigner', disciplina: 'wants to serve something that has order', fe: 'says it is a Christian duty to stop the killing', igualdad: 'wants a country where no one is looked down on' };
  const reasonOf = (p) => { const cr = C.crOf(p); let best = 'justicia', bv = -9; for (const k in cr) if (cr[k] > bv) { bv = cr[k]; best = k; } return REASONS[best]; };

  // ------------------------------------------------------------------------------------------------------------------
  // THEY COME
  // ------------------------------------------------------------------------------------------------------------------
  /** Once a day: decide who is on the road to camp. */
  C.recruitDaily = function () {
    const g = G(); if (!g.squads) return; g.recruitQ = g.recruitQ || []; if (g.recruitQ.length >= TUNE.maxWaiting) return;
    const friends = C.squadPeople ? C.squadPeople().length : 10; const sup = g.supportMean || 0;
    if (rnd() > clamp(TUNE.base + sup * TUNE.supportW + friends * TUNE.perFriend * 0.3 - (g.rep.fear > 50 ? 0.06 : 0) + (g.rep.justice > 60 ? 0.04 : 0), 0.02, 0.5)) return;
    const asked = C.W.people.filter((p) => p.status === 'alive' && p.wantsJoin !== undefined && !p.mil && g.day - p.wantsJoin < 20 && !g.recruitQ.includes(p.id));
    let cand = asked.length ? asked : C.W.people.filter((p) => p.status === 'alive' && !p.mil && !p.roster && p.trueStance > 25 && C.ageOf(p) >= 16 && C.ageOf(p) <= 45 && (p.sex === 'M' || (g.platform.declared[6] && g.platform.pub[6] >= 1)) && ['sierra', 'palmarito', 'cayo', 'alegria', 'manzanillo', 'bayamo'].includes(p.settlement));
    if (!cand.length) return; const p = cand[(rnd() * cand.length) | 0];
    if (p.trueStance < 40 && rnd() < 0.5) p.informant = p.informant || (rnd() < TUNE.informerRate * 4);       // the army plants men among the keen
    g.recruitQ.push(p.id);
  };
  /** Per frame in the Sierra: those on the road appear at the camp's edge, one at a time. */
  let spawnT = 0;
  C.recruitTick = function (s, dt) {
    const g = G(); if (s.sid !== 'sierra' || !s.camp || !g.recruitQ || !g.recruitQ.length) return; spawnT -= dt; if (spawnT > 0) return; spawnT = 6 + rnd() * 10;
    const id = g.recruitQ.shift(), p = C.P(id); if (!p || p.status !== 'alive' || p.mil) return;
    const q = s.nearFree(Math.floor((s.camp.x * T - 260) / T), Math.floor((s.camp.y * T + 40 + (rnd() - 0.5) * 80) / T), 8); if (!q) return;
    if (p.settlement !== 'sierra') C.moveTo(p, 'sierra'); const a = C.makeActor(s, p, q.x * T + 8, q.y * T + 8); a.side = 'civ'; a.speed = 36; a.recruit = { since: g.day, tx: s.camp.x * T - 60 + (rnd() - 0.5) * 70, ty: s.camp.y * T + 70 + (rnd() - 0.5) * 50 };
    p.wantsJoin = g.day; s.actors.push(a); C.log(`${C.tagName(p)} has come to the camp asking to join.`, 'info');
  };
  /** A waiting volunteer's behaviour (called from aware.js before everything else). Returns true if it owns the frame. */
  C.recruitBehave = function (s, a, dt) {
    const r = a.recruit, g = G(); if (!r) return false;
    if (g.day - r.since > TUNE.patienceDays) { a.recruit = null; a.p.trueStance -= 3; a.p.wantsJoin = undefined; a.task = null; C.say(a, 'Mejor me voy…', '#444', 3); C.log(`${C.tagName(a.p)} gave up waiting and went home.`, 'info'); return false; }
    const d = Math.hypot(r.tx - a.x, r.ty - a.y); if (d > 14) { if (!a.path || (a.repT = (a.repT || 0) - dt) <= 0) { a.repT = 1.5; C.ai.setPath(s, a, r.tx, r.ty); } C.ai.followPath(s, a, dt, a.speed * 0.9 * C.ai.terrainSpeed(s, a)); } else { a.moving = false; if (rnd() < dt * 0.05) C.say(a, ['¿Necesitan un hombre más?', 'Vengo a ayudar.', 'Dicen que aquí se pelea por la tierra.'][(rnd() * 3) | 0], '#222', 3); }
    return true;
  };

  // ------------------------------------------------------------------------------------------------------------------
  // THE INTERVIEW
  // ------------------------------------------------------------------------------------------------------------------
  const waiting = (tg) => tg.o && tg.o.recruit;
  const informerTell = (a, tg, level) => { const p = tg.o.p; if (!p.informant) return false; return rnd() < level; };
  C.registerVerb({ id: 'interview', n: 'Question the volunteer', icon: '🗣', kinds: ['actor'], reach: 26, dur: 12,
    variants: (tg) => (tg.o && tg.o.recruit ? [{ param: { q: 'why' }, label: 'Ask why he came' }, { param: { q: 'vouch' }, label: 'Ask who vouches for him' }, { param: { q: 'shoot' }, label: 'Test him with a rifle' }] : []),
    check: (a, tg) => (!waiting(tg) ? 'He is not waiting to join.' : null),
    done: (a, tg, p) => {
      const v = tg.o.p, name = C.tagName(v), occ = (C.OCC[v.occ] || {}).n || v.occ; const skilledI = a.p.traits.includes('cautious') || a.p.occ === 'abogado' || a.p.roster === 'anselmo';
      if (p.q === 'why') { C.log(`${name}, ${C.ageOf(v)}, ${occ.toLowerCase()}${v.literate ? ', can read' : ', cannot read'}: ${reasonOf(v)}.`, 'info'); if (informerTell(a, tg, skilledI ? TUNE.tells.skilled : TUNE.tells.plain)) { C.log(`His story has holes — something in it does not sit right.`, 'warn'); C.say(a, 'Hmm…', '#7a1d1d', 3); tg.o.recruit.suspect = true; } else C.say(tg.o, 'Es la verdad, jefe.', '#444', 2.6); }
      if (p.q === 'vouch') { const kin = C.squadPeople().filter((q2) => C.bondOf(v, q2) > 0 || (v.rel || []).some((e) => e && (e.id === q2.id || e.to === q2.id))); if (kin.length) { tg.o.recruit.vouched = kin[0].id; C.log(`${C.tagName(kin[0])} knows ${name} and vouches for him.`, 'good'); } else { C.log(`Nobody in the column knows ${name}.`, 'info'); if (informerTell(a, tg, TUNE.tells.plain)) { tg.o.recruit.suspect = true; C.log('He is vague about who his people are.', 'warn'); } } }
      if (p.q === 'shoot') { const e = v.exp; C.log(`${name} ${e > 40 ? 'shoots like a man who has done it before' : e > 15 ? 'handles a rifle passably' : 'has hardly held a rifle'} (experience ~${Math.round(e)}).`, 'info'); }
      return null; } });

  // ------------------------------------------------------------------------------------------------------------------
  // THE DECISION
  // ------------------------------------------------------------------------------------------------------------------
  C.registerVerb({ id: 'enlist', n: 'Decide about the volunteer', icon: '✍', kinds: ['actor'], reach: 26, dur: 6,
    variants: (tg) => (tg.o && tg.o.recruit ? [{ param: { how: 'rifle' }, label: 'Enlist him with a rifle' }, { param: { how: 'machete' }, label: 'Enlist him with a machete' }, { param: { how: 'eyes' }, label: 'Send him home as your eyes' }, { param: { how: 'no' }, label: 'Turn him away, kindly' }] : []),
    check: (a, tg, p) => { if (!waiting(tg)) return 'He is not waiting to join.'; if (p && p.how === 'rifle' && G().res.guns < 1) return 'You have no rifle to give.'; return null; },
    done: (a, tg, p) => {
      const g = G(), s = a.scene, q = tg.o, v = q.p, name = C.tagName(v); const r = q.recruit; q.recruit = null; v.wantsJoin = undefined;
      if (p.how === 'no') { v.trueStance -= 1; C.say(q, 'Entiendo. Que Dios los acompañe.', '#444', 3); q.task = null; return null; }
      if (p.how === 'eyes') { v.covert = true; v.helper = g.day; v.trueStance = Math.max(v.trueStance, 45); q.task = null; C.log(`${name} goes home to keep his eyes open for you.`, 'info'); if (v.informant) { C.log(`(You will wonder, later, whose eyes they were.)`, 'warn'); } return null; }
      const gunsBefore = g.res.guns; C.recruit(v, v.exp || 0, false); if (p.how === 'machete') { v.wpn = 'machete'; g.res.guns = gunsBefore; }
      const mate = s.actors.find((o) => o.side === 'rebel' && !o.dead && o !== q && Math.hypot(o.x - a.x, o.y - a.y) < 90); if (mate && C.bondEvent) C.bondEvent(v, mate.p, 'shared', 1.5);
      if (r.vouched) { const w = C.P(r.vouched); if (w) { C.bondEvent && C.bondEvent(v, w, 'shared', 3); v.trueStance += 6; } }
      C.log(`${name} enlists${p.how === 'rifle' ? ' with a rifle' : ' with a machete'}.`, 'good'); C.say(v.actor || q, '¡A sus órdenes!', '#1d5b2a', 3); return null; } });

  // the ones who tried to give up
  C.recruitGone = function () {};
})();
