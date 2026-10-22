// Exercises inventory: capacity, eating, sharing with a neighbour, ration restriction and the disobedience it provokes.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G; g.paused = false; const P = C.partyPeople(); const out = {};
    P.forEach((p) => C.initInv(p));
    out.cap = Math.round(C.capacityOf(P[0]) * 10) / 10; out.load = Math.round(C.loadOf(P[0]) * 10) / 10;
    // eating from the pack
    P[0].needs.food = 20; P[0].inv.food = 3; for (let i = 0; i < 200; i++) C.debug.update(1 / 20);
    out.ate = P[0].needs.food > 40; out.pack0 = P[0].inv.food;
    // sharing: put P[1] next to P[2], P[1] has food, P[2] is starving and carries none
    const a1 = P[1].actor, a2 = P[2].actor; a2.x = a1.x + 10; a2.y = a1.y; P[1].inv.food = 5; P[2].inv.food = 0; P[2].needs.food = 10;
    a1.stanceOv = a2.stanceOv = 'hold'; for (let i = 0; i < 300; i++) C.debug.update(1 / 20);
    out.shared = P[2].inv.food > 0 || P[2].needs.food > 30;
    // restriction + disobedience: forbid food and water for P[3], make them starving and loyal-ish low
    const q = P[3]; q.rat = { f: 0, w: 0 }; q.needs.food = 8; q.needs.water = 8; q.inv.food = 2; q.inv.water = 2; q.trueStance = 5; let broke = 0;
    for (let i = 0; i < 600; i++) { C.debug.update(1 / 20); } out.broke = (q.stats && q.stats.brokeRation) || 0; out.qfood = Math.round(q.needs.food);
    // capacity limit: cannot overload
    out.added = C.invAdd(P[4], 'shell', 50);
    // transfer via stores
    g.res.food = 10; out.moved = C.transfer({ kind: 'stores' }, { kind: 'person', p: P[5] }, 'food', 5);
    return out;
  });
  console.log(JSON.stringify(r)); console.log('ERRORS', errors); await browser.close();
})();
