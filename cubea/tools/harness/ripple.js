#!/usr/bin/env node
// Cubea harness: kills one soldier and measures how the shock spreads through his family graph
// Run:  node tools/harness/ripple.js     (needs Playwright + Chromium; see common.js)
const { open } = require('./common');
(async () => {
  const { browser, page: p, errors: errs } = await open('?seed=1956&auto=sandbox');
  await p.waitForTimeout(1200);

  const out = await p.evaluate(() => {
    const g = C.debug.g; g.paused = true; g.unlocked.layer = 6;
    C.enterScene('palmarito', { far: true }); for (let i = 0; i < 20; i++) C.debug.update(0.05);
    const s = g.scene; const sold = s.actors.find(a => a.side === 'army' && !a.dead);
    const v = sold.p; const aud = C.audienceOf(v);
    const rows = [...aud.entries()].map(([id, o]) => ({ id, w: +o.w.toFixed(2), t: o.t, st: C.P(id).status, set: C.P(id).settlement, stance0: Math.round(C.P(id).trueStance) }));
    const before = rows.map(r => C.P(r.id).trueStance);
    const killer = g.player;
    C.die(sold, killer, 'bullet');
    const qlen = g.queue.length;
    // apply the delayed memories: advance 6 days of ticks
    for (let d = 0; d < 6; d++) { g.min += 1440; C.debug.syncClock(); C.dayTick(); }
    const after = rows.map(r => C.P(r.id).trueStance);
    const summary = rows.slice().map((r, i) => ({ rel: r.t, w: r.w, set: r.set, d: +(after[i] - before[i]).toFixed(1), mem: C.P(r.id).mem.length, conv: Math.round(C.P(r.id).conv) })).sort((a, b) => b.w - a.w);
    // the soldier's mother
    const mother = C.P(v.mother);
    // Compare: a random uninvolved person
    const others = C.W.people.filter(q => q.status === 'alive' && !aud.has(q.id) && q.settlement === 'palmarito').slice(0, 30);
    return { name: C.fullName(v), kin: C.kinOf(v).size, aud: aud.size, queued: qlen, top: summary.slice(0, 12), mother: { name: C.fullName(mother), status: mother.status, mem: mother.mem.map(m => m.text) }, news: g.news.slice(0, 2), log: g.log.slice(0, 3).map(l => l.text), mean_drop_kin: +(summary.filter(x => x.w >= 0.5).reduce((a, b) => a + b.d, 0) / Math.max(1, summary.filter(x => x.w >= 0.5).length)).toFixed(1), mean_drop_friends: +(summary.filter(x => x.w < 0.5).reduce((a, b) => a + b.d, 0) / Math.max(1, summary.filter(x => x.w < 0.5).length)).toFixed(1), rep: g.rep, stats: g.stats };
  });
  console.log(JSON.stringify(out, null, 1));
  console.log(errs);
  await browser.close();
})();
