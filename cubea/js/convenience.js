/* CUBEA — convenience.js : THE SMALL KINDNESSES — the wheel remembers you, the blackboard runs the camp, time looks after itself.

   • THE WHEEL LEARNS    verbs you use most come first in the ring (kept between sessions); MIDDLE-CLICK a target to do again whatever
                         you did last (the same verb, same variant) on it, without opening the wheel.
   • THE DUTY BOARD      a blackboard in camp carries the camp's standing duties. Verb "Pin a duty" (on the blackboard) lists every saved
                         and preset action with its usual hour; each day, at that hour, the board picks whoever has done the fewest
                         duties lately — and is rested, fed and idle — and gives them the action. A refusal or failure is spoken and
                         logged like any action's. "Take a duty down" removes it. No roster screen.
   • TIME LOOKS AFTER ITSELF   (1) on contact the clock drops to normal speed (setting: "Slow down when the shooting starts");
                         (2) the verb "Wait here" on the ground: until noon, dusk, dawn or an hour — time runs fast and stops by itself
                         when anything happens (shots, soldiers, someone hurt, a stranger at the camp).
*/
(function () {
  'use strict';
  const C = window.C, G = () => C.G, clamp = C.clamp;
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };

  // ------------------------------------------------------------------------------------------------------------------
  // THE WHEEL LEARNS
  // ------------------------------------------------------------------------------------------------------------------
  let use = {}; try { use = JSON.parse(LS.get('cubea_verbuse') || '{}'); } catch (e) { use = {}; }
  let last = null;
  C.verbRank = (id) => use[id] || 0;
  const dv = C.doVerb; C.doVerb = function (v, tg, param) { use[v.id] = (use[v.id] || 0) + 1; last = { id: v.id, param: JSON.stringify(param === undefined ? null : param) }; if ((use[v.id] % 5) === 0) LS.set('cubea_verbuse', JSON.stringify(use)); return dv.apply(this, arguments); };
  /** Do the last thing again to whatever is at (wx, wy). */
  C.repeatVerb = function (wx, wy) {
    if (!last) { C.ui.toast('Nothing to repeat yet — use the wheel (Q) first'); return false; }
    for (const tg of C.targetsAt(wx, wy)) { const vs = C.verbsFor(tg).filter((v) => v.id === last.id); if (!vs.length) continue; const exact = vs.find((v) => JSON.stringify(v.param === undefined ? null : v.param) === last.param) || vs[0]; const why = exact.check ? exact.check((C.actorsForVerb()[0] || G().player), tg, exact.param) : null; if (why) { C.ui.toast(why); return true; } C.doVerb(exact, tg, exact.param); return true; }
    C.ui.toast('That does not apply here'); return false;
  };
  document.addEventListener('DOMContentLoaded', () => { const cv = document.getElementById('game'); if (cv) cv.addEventListener('mousedown', (e) => { if (e.button !== 1) return; e.preventDefault(); const g = G(); if (!g || !g.scene || g.modalOpen) return; const m = C.mouse; if (m && m.wx !== undefined) C.repeatVerb(m.wx, m.wy); }); });

  // ------------------------------------------------------------------------------------------------------------------
  // THE DUTY BOARD
  // ------------------------------------------------------------------------------------------------------------------
  const HOURS = { p_feedpigs: 6, p_waterpigs: 7, p_wood: 8, p_cook: 5, p_watch: 22, p_lesson: 16, p_sickcall: 9, p_snares: 6, p_fish: 5, p_dress: 8, p_smoke: 10 };
  const allMacros = () => (C.PRESETS || []).concat(G().macros || []);
  const hourOf = (m) => m.hour !== undefined ? m.hour : (HOURS[m.id] !== undefined ? HOURS[m.id] : 8);
  const fmt = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  C.registerVerb({ id: 'pin_duty', n: 'Pin a duty', icon: '📌', kinds: ['thing:pizarra'], reach: 30, dur: 4,
    variants: () => allMacros().map((m) => ({ param: { mid: m.id }, label: `${m.name} (daily at ${fmt(hourOf(m))})` })),
    check: (a, tg, p) => { if (!p) return null; const d = (tg.o.d.duties = tg.o.d.duties || []); return d.some((x) => x.mid === p.mid) ? 'Already on the board.' : null; },
    done: (a, tg, p) => { const m = allMacros().find((x) => x.id === p.mid); (tg.o.d.duties = tg.o.d.duties || []).push({ mid: p.mid, h: hourOf(m) }); C.log(`Pinned to the board: "${m.name}" daily at ${fmt(hourOf(m))}.`, 'good'); C.say(a, 'Anotado.', '#222', 2.4); return null; } });
  C.registerVerb({ id: 'unpin_duty', n: 'Take a duty down', icon: '🧹', kinds: ['thing:pizarra'], reach: 30, dur: 3,
    variants: (tg) => (tg.o.d.duties || []).map((x) => { const m = allMacros().find((y) => y.id === x.mid); return { param: { mid: x.mid }, label: `${m ? m.name : x.mid} (${fmt(x.h)})` }; }),
    check: (a, tg) => ((tg.o.d.duties || []).length ? null : 'The board is empty.'),
    done: (a, tg, p) => { tg.o.d.duties = (tg.o.d.duties || []).filter((x) => x.mid !== p.mid); return null; } });
  C.registerVerb({ id: 'read_board', n: 'Read the board', icon: '📋', kinds: ['thing:pizarra'], reach: 40, dur: 1,
    done: (a, tg) => { const d = tg.o.d.duties || []; C.log(d.length ? 'On the board: ' + d.map((x) => { const m = allMacros().find((y) => y.id === x.mid); return `${m ? m.name : x.mid} ${fmt(x.h)}`; }).join(' · ') : 'The board is empty.', 'info'); return null; } });
  let lastHour = -1;
  C.dutyTick = function (s) {
    const g = G(), h = Math.floor(g.hour * 4) / 4; if (h === lastHour) return; lastHour = h;
    for (const b of C.thingsOf(s, 'pizarra')) for (const d of (b.d.duties || [])) {
      if (Math.abs(d.h - h) > 0.01 || d.lastDay === g.day) continue; d.lastDay = g.day; const m = allMacros().find((x) => x.id === d.mid); if (!m) continue;
      const cands = s.actors.filter((a) => !a.dead && a.side === 'rebel' && a.squad >= 0 && !a.order && !a.inside && !a.captive && !a.sleeping && a.p.needs.energy > 25 && a.p.needs.food > 20 && a.p.hp > a.p.maxHp * 0.6 && !(a.p.ill) && !a.onWatch && !a.playing).sort((x, y) => (x.p.dutyCount || 0) - (y.p.dutyCount || 0) || x.p.needs.energy - y.p.needs.energy);
      const who = cands[0]; if (!who) { C.log(`Nobody was free for "${m.name}".`, 'warn'); continue; }
      who.p.dutyCount = (who.p.dutyCount || 0) + 1; C.giveMacro(who, m, { force: false, quiet: false }); C.log(`The board gives "${m.name}" to ${C.tagName(who.p)}.`, 'info');
    }
  };

  // ------------------------------------------------------------------------------------------------------------------
  // TIME LOOKS AFTER ITSELF
  // ------------------------------------------------------------------------------------------------------------------
  let prevCombat = 0;
  C.timeTick = function (s, dt) {
    const g = G(); if (!g) return; const slow = !(C.settings && C.settings.autoSlow === false);
    if (slow && g.combatT > 0 && prevCombat <= 0 && g.speed > 1) { g.speed = 1; if (C.ui.syncSpeed) C.ui.syncSpeed(); C.ui.toast('Contact — back to normal speed'); }
    prevCombat = g.combatT;
    const w = g.waiting; if (w) {
      const army = s.actors.some((a) => a.side === 'army' && !a.dead && !a.inside && C.visible(a) && Math.hypot(a.x - g.player.x, a.y - g.player.y) < 420), hurt = s.actors.some((a) => !a.dead && a.side === 'rebel' && a.lastHit > g.time - 3);
      const stranger = s.actors.some((a) => a.recruit || a.courier);
      if (g.min >= w.until) { g.waiting = null; C.log('You have waited.', 'info'); } else if (g.combatT > 0 || army || hurt || s.alert > 0.35 || g.modalOpen || stranger) { g.waiting = null; C.ui.toast('Waiting ends — something is happening'); }
    }
  };
  C.registerVerb({ id: 'wait_here', n: 'Wait here', icon: '⏳', kinds: ['ground'], reach: 9999, dur: 0.5,
    variants: () => [{ param: { until: 'hour' }, label: 'Wait an hour' }, { param: { until: 12 }, label: 'Wait until noon' }, { param: { until: 17.5 }, label: 'Wait until dusk' }, { param: { until: 6.5 }, label: 'Wait until dawn' }],
    check: (a) => { const g = G(); return g.combatT > 0 ? 'Not with shooting going on.' : null; },
    done: (a, tg, p) => { const g = G(); const day = Math.floor(g.min / 1440); let target; if (p.until === 'hour') target = g.min + 60; else { target = day * 1440 + p.until * 60; if (target <= g.min + 5) target += 1440; } g.waiting = { until: target }; C.ui.toast(`Waiting until ${fmt((target % 1440) / 60)} — it stops by itself if anything happens`); return null; } });
  // the clock runs fast while waiting
  C.waitMul = () => (G() && G().waiting ? 10 : 1);
})();
