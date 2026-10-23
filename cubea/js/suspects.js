/* CUBEA — suspects.js : AN INFORMER BEHAVES LIKE ONE — and you can catch him at it.

   The army plants men among the rebels (and recruits some you trusted). Nothing flags them. They do things: slip out of camp at night
   and come back before dawn; ask questions about numbers, rifles and routes that a comrade would not; hang about when the leaders talk.
   Anyone who sees it notes it. A man seen more than once is a SUSPECT, and the camp knows it (hover him). Then you can act, with verbs:
     have him watched (a sentry's eye on him: if he slips out he is caught in the act) · ask him directly (a liar may slip; an honest man
     is hurt) · search his kit (a coded note, a map, a stranger's pesos — or nothing, and a good man shamed).
   A revealed informer can be tried (captives.js: Hold a trial) or dealt with as you choose; one you wrongly accuse remembers.
   TUNE: numbers in the TUNE block.
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp, T = C.T;
  const rnd = Math.random;
  const TUNE = { slipChance: 0.0035, slipSecs: 40, see: 240, ask: 0.0015, asks: ['¿Cuántos fusiles quedan?', '¿Hacia dónde vamos mañana?', '¿Cuándo llega el próximo envío?', '¿Quién cuida el polvorín de noche?', '¿Cuántos somos de verdad?'], suspect: 2, search: { base: 0.7, suspect: 0.15 }, ask_slip: 0.25 };
  C.SUSPECT_TUNE = TUNE;
  const A = () => C.ai;
  const sus = (p) => ((G().suspects || {})[p.id] || 0);
  const note = (p, w, who) => { const g = G(); g.suspects = g.suspects || {}; const was = g.suspects[p.id] || 0; g.suspects[p.id] = was + w; if (was < TUNE.suspect && g.suspects[p.id] >= TUNE.suspect) C.log(`People are starting to talk about ${C.tagName(p)}. Something is wrong there.`, 'warn'); };
  const witnesses = (s, a, r) => s.actors.filter((q) => !q.dead && q !== a && (q.side === 'rebel' || q.isPlayer) && !q.sleeping && Math.hypot(q.x - a.x, q.y - a.y) < r && (q.onWatch || q.alert !== false));
  /** Per frame, in a camp scene: informers act like informers. */
  C.suspectTick = function (s, dt) {
    const g = G(); if (s.sid !== 'sierra') return; const night = g.hour >= 22 || g.hour < 4.2;
    for (const a of s.actors) {
      if (a.dead || a.side !== 'rebel' || !a.p.informant || a.p.revealed || a.captive) continue;
      if (a.slip) { const sl = a.slip; if (sl.phase === 'out') { if (!a.path || a.pi >= a.path.length) { sl.phase = 'wait'; sl.t = 0; a.moving = false; } else { A().followPath(s, a, dt, a.speed * 0.8); } } else if (sl.phase === 'wait') { sl.t += dt; a.moving = false; if (sl.t > TUNE.slipSecs) { sl.phase = 'back'; A().setPath(s, a, sl.home.x, sl.home.y); } } else { if (A().followPath(s, a, dt, a.speed * 0.8)) { a.slip = null; } }
        if (!sl.seenBy) sl.seenBy = []; for (const w of witnesses(s, a, TUNE.see)) { if (sl.seenBy.includes(w.id)) continue; sl.seenBy.push(w.id); const watched = (g.watched || {})[a.p.id] > g.day; note(a.p, watched ? 3 : 1); C.log(`${C.tagName(w.p)} saw ${C.tagName(a.p)} outside the camp in the night.`, 'warn'); if (watched) { a.p.revealed = true; C.log(`Caught in the act: ${C.tagName(a.p)} was meeting someone outside the camp. He is an informer.`, 'bad'); a.slip = null; } }
        continue; }
      if (a.order || a.sleeping || a.inside || a.moving) continue;
      if (night && rnd() < TUNE.slipChance * dt * 60) { const ex = s.exits[0]; const tx = ex ? (ex.x + ex.w / 2) * T : s.spawn.x, ty = ex ? (ex.y + ex.h / 2) * T : s.spawn.y; const far = { x: a.x + (tx - a.x) * 0.6, y: a.y + (ty - a.y) * 0.6 }; if (A().setPath(s, a, far.x, far.y)) a.slip = { phase: 'out', home: { x: a.x, y: a.y }, t: 0 }; }
      else if (!night && rnd() < TUNE.ask * dt * 60) { const ws = witnesses(s, a, 70); if (ws.length) { C.say(a, TUNE.asks[(rnd() * TUNE.asks.length) | 0], '#222', 4); for (const w of ws) if (w.p.traits.includes('cautious') || w.p.roster === 'anselmo' || rnd() < 0.3) note(a.p, 0.5); } }
    }
  };
  C.registerVerb({ id: 'watch_man', n: 'Have him watched', icon: '👁', kinds: ['actor'], reach: 30, dur: 3,
    check: (a, tg) => (tg.o.side !== 'rebel' ? 'Only your own people.' : null),
    done: (a, tg) => { const g = G(); g.watched = g.watched || {}; g.watched[tg.o.p.id] = g.day + 4; C.log(`A sentry is told to keep an eye on ${C.tagName(tg.o.p)} for four days.`, 'info'); return null; } });
  C.registerVerb({ id: 'ask_him', n: 'Ask him directly', icon: '🗣', kinds: ['actor'], reach: 30, dur: 10,
    check: (a, tg) => (tg.o.side !== 'rebel' ? 'Only your own people.' : null),
    done: (a, tg) => { const p = tg.o.p; if (p.informant && !p.revealed) { const slip = TUNE.ask_slip + sus(p) * 0.1 + (a.p.roster === 'anselmo' ? 0.2 : 0); if (rnd() < slip) { p.revealed = true; C.say(tg.o, '…yo… me obligaron.', '#7a1d1d', 4); C.log(`${C.tagName(p)} breaks under your questions: he has been reporting to the army.`, 'bad'); } else { C.say(tg.o, 'Jefe, ¿cómo puede pensar eso de mí?', '#444', 4); note(p, 0.3); } } else { p.trueStance -= 3; p.needs.dignity = clamp(p.needs.dignity - 6, 0, 100); C.say(tg.o, 'Después de todo lo que hemos pasado…', '#7a1d1d', 4); if (C.bondEvent) C.bondEvent(a.p, p, 'fought', -2); } return null; } });
  C.registerVerb({ id: 'search_kit', n: 'Search his kit', icon: '🎒', kinds: ['actor'], reach: 30, dur: 12,
    check: (a, tg) => (tg.o.side !== 'rebel' ? 'Only your own people.' : null),
    done: (a, tg) => { const g = G(), p = tg.o.p; if (p.informant && !p.revealed && rnd() < TUNE.search.base + sus(p) * TUNE.search.suspect) { p.revealed = true; C.log(`In ${C.tagName(p)}'s kit: a coded note, a sketch of the camp, and pesos that are not his. He is an informer.`, 'bad'); } else if (p.informant && !p.revealed) { C.log(`Nothing in ${C.tagName(p)}'s kit — he was careful.`, 'info'); } else { p.trueStance -= 6; p.needs.dignity = clamp(p.needs.dignity - 10, 0, 100); g.rep.justice = clamp(g.rep.justice - 1, 0, 100); C.say(tg.o, 'Jefe…', '#7a1d1d', 3); C.log(`You searched an honest man's kit. ${C.tagName(p)} will remember it.`, 'warn'); } return null; } });
  const te = C.tipExtra; C.tipExtra = function (s, a) { let h = te ? te(s, a) : ''; const n = a.side === 'rebel' ? sus(a.p) : 0; if (n >= 1) h += `<br><span class="st" style="background:rgba(200,120,60,.35)">${n >= TUNE.suspect ? 'people suspect him' : 'was noticed — odd behaviour'}</span>`; if (a.p.revealed && a.p.informant) h += '<br><span class="st" style="background:rgba(200,60,50,.45)">known informer</span>'; return h; };
})();
