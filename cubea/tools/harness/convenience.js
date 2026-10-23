// Convenience: verb ranking and repeat, duty board assigning the least-busy rested person, waiting that ends by itself, auto-slow on contact.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false; const P = C.partyPeople(); const a = P[1].actor; P.forEach((p) => p.actor && (p.actor.stanceOv = 'hold'));
    // repeat: use 'speech' a few times, rank rises, middle-click path repeats on a target
    const tgt = { kind: 'ground', x: a.x, y: a.y, o: { x: a.x, y: a.y } }; const v = C.verbsFor(tgt).find((q) => q.id === 'speech' && q.param.sp === 'sp_tierra');
    for (let i = 0; i < 3; i++) C.doVerb(v, tgt, v.param); out.rank = C.verbRank('speech'); const n0 = g.log.length; g.paused = false; out.repeated = C.repeatVerb(a.x, a.y);
    // wheel order: speech should now sit ahead of verbs never used
    C.openWheel(400, 300); const first = [...document.querySelectorAll('#wheel .vb')].slice(0, 3).map((x) => x.textContent.slice(0, 20)); out.wheelFirst = first; C.closeWheel();
    // duty board
    const board = C.thingsOf(s, 'pizarra')[0]; const bt = { kind: 'thing', tk: 'pizarra', o: board, x: board.x, y: board.y };
    out.pinVariants = C.VERB.pin_duty.variants(bt).length; C.VERB.pin_duty.done(a, bt, { mid: 'p_feedpigs' }); out.duties = board.d.duties.length; out.dupe = C.VERB.pin_duty.check(a, bt, { mid: 'p_feedpigs' });
    P.forEach((p, i) => { if (p.actor) { p.actor.order = null; p.actor.x = board.x + (i % 6) * 8; p.actor.y = board.y + 30; p.dutyCount = i < 3 ? 5 : 0; p.needs.energy = 80; p.needs.food = 80; p.hp = p.maxHp; } });
    P[4].needs.energy = 10; // too tired
    g.min = Math.floor(g.min / 1440) * 1440 + 6 * 60 - 1; C.debug.syncClock(); for (let i = 0; i < 80; i++) C.debug.update(1 / 20); out.assigned = P.filter((p) => p.actor && p.actor.order && p.actor.order.type === 'macro').map((p) => p.dutyCount).join(',');
    C.VERB.unpin_duty.done(a, bt, { mid: 'p_feedpigs' }); out.afterUnpin = board.d.duties.length;
    // waiting
    s.alert = 0; g.combatT = 0; s.actors.filter((o) => o.side === 'army').forEach((o) => { o.x += 3000; }); const m0 = g.min; C.VERB.wait_here.done(a, tgt, { until: 'hour' }); out.waiting = !!g.waiting; for (let i = 0; i < 300 && g.waiting; i++) C.debug.update(1 / 20); out.waitedMin = Math.round(g.min - m0); out.waitEnded = !g.waiting;
    C.VERB.wait_here.done(a, tgt, { until: 12 }); g.combatT = 5; C.debug.update(1 / 20); out.waitInterrupted = !g.waiting; g.combatT = 0;
    // auto-slow
    g.speed = 4; g.combatT = 0; C.debug.update(1 / 20); g.combatT = 6; C.debug.update(1 / 20); out.speedAfterContact = g.speed;
    for (let i = 0; i < 200; i++) C.debug.update(1 / 20); out.ran = true;
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
