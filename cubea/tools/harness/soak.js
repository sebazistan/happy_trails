#!/usr/bin/env node
// Cubea harness: 120-day soak with random orders, travel, interactions and event choices; scans for crashes/NaNs
// Run:  node tools/harness/soak.js     (needs Playwright + Chromium; see common.js)
const { open } = require('./common');
(async () => {
  const { browser, page: p, errors: errs } = await open('?seed=1956&auto=sandbox');
  await p.waitForTimeout(1200);

  const res = await p.evaluate(async (DAYS) => {
    const g = C.debug.g; g.paused = true; g.unlocked.layer = 6; const log = { cards: 0, days: 0, travels: 0, interacts: 0, errors: [] };
    const R = Math.random;
    const wrap = (f, tag) => { try { return f(); } catch (e) { log.errors.push(tag + ': ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]); } };
    const clickCard = () => { let n = 0; while (g.modalOpen && n++ < 6) { const btns = [...document.querySelectorAll('#mbox .choice:not([disabled])')]; if (btns.length) { btns[(R() * btns.length) | 0].click(); log.cards++; log.titles = log.titles || {}; const t = (document.querySelector('#mbox h2') || {}).textContent; log.titles[t] = (log.titles[t] || 0) + 1; } else { C.ui.closeModal(); } } };
    C.ui.declarePlankFn = null;
    C.applyPreset(['historia', 'radical', 'moderate', 'order'][(R() * 4) | 0]);
    const squads = g.squads;
    for (let d = 0; d < DAYS; d++) {
      if (g.player) { g.player.p.hp = 9999; g.player.p.maxHp = 9999; } g.over = null;
      // gameplay for ~25 sim seconds
      wrap(() => {
        const s = g.scene;
        for (const sq of squads) sq.stance = ['follow', 'hold', 'ambush', 'scout', 'forage', 'harass', 'withdraw'][(R() * 7) | 0];
        g.policy.forage = ['pay', 'vale', 'take'][(R() * 3) | 0];
        const pl = g.player; if (pl && !pl.dead) {
          pl.weaponOut = R() < 0.5;
          C.commandAt(pl.x + (R() - 0.5) * 300, pl.y + (R() - 0.5) * 200, false);
          C.keys.w = R() < 0.5; C.keys.a = R() < 0.5; C.keys.s = R() < 0.3; C.keys.d = R() < 0.5;
        }
      }, 'orders');
      for (let i = 0; i < 25 * 20; i++) { wrap(() => C.debug.update(1 / 20), 'update'); if (g.modalOpen) clickCard(); }
      C.keys.w = C.keys.a = C.keys.s = C.keys.d = false;
      // interact with someone
      wrap(() => { const t = C.findInteract(); if (t && R() < 0.8) { C.ui.interact(t); log.interacts++; const opts = [...document.querySelectorAll('#mbox .choice:not([disabled])')]; if (opts.length) opts[(R() * opts.length) | 0].click(); clickCard(); } }, 'interact');
      // sometimes fight: spawn patrol
      if (R() < 0.25) wrap(() => C.spawnPatrol(g.scene, 5, 'test'), 'patrol');
      if (R() < 0.15) wrap(() => { C.airstrike(g.scene, g.player.x - 200, g.player.y - 50, g.player.x + 200, g.player.y + 50, 5); }, 'air');
      // travel sometimes
      if (R() < 0.12 && !g.over) wrap(() => { const dests = C.PLAYABLE.filter(x => x !== g.scene.sid); const dest = dests[(R() * dests.length) | 0]; C.travelTo(dest, 'foot', [0, 1, 2, 3].filter(() => R() < 0.7)); log.travels++; clickCard(); }, 'travel');
      // a day passes
      wrap(() => { C.advanceDays(1); }, 'advance');
      clickCard();
      if (g.player && g.player.dead && !g.over) { /* revive for the soak */ g.player.dead = false; g.player.p.status = 'alive'; g.player.p.hp = g.player.p.maxHp; g.scene.corpses = g.scene.corpses.filter(c => c !== g.player); if (!g.scene.actors.includes(g.player)) g.scene.actors.push(g.player); g.over = null; }
      if (g.over) { g.over = null; }
      log.days++;
    }
    // sanity: NaNs
    let nan = 0, worst = null;
    for (const q of C.W.people) { for (const k of ['stance', 'trueStance', 'conv', 'hp', 'stress', 'fear', 'morale']) if (!Number.isFinite(q[k])) { nan++; worst = worst || [q.id, k, q[k]]; } for (const k in q.needs) if (!Number.isFinite(q.needs[k])) { nan++; worst = worst || [q.id, 'needs.' + k, q.needs[k]]; } }
    log.nan = nan; log.worst = worst; log.day = g.day; log.scene = g.scene.sid;
    log.res = Object.fromEntries(Object.entries(g.res).map(([k, v]) => [k, Math.round(v)]));
    log.rep = g.rep; log.regime = g.regime; log.trust = Object.fromEntries(Object.entries(g.trust).map(([k, v]) => [k, +v.toFixed(2)])); log.support = g.supportMean;
    log.stats = g.stats; log.squads = squads.map(s => s.members.length); log.actors = g.scene.actors.length; log.events = g.events.length; log.queue = g.queue.length;
    return log;
  }, 120);
  console.log(JSON.stringify(res, null, 1).slice(0, 3500));
  console.log('ERRORS', errs.slice(0, 12));
  await browser.close();
})();
