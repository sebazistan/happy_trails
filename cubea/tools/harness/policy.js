// Policy: mercy/surrender, prisoner handling, amnesty, land reform, forecast & poll.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, out = {}; g.paused = false; C.policyInit();
    out.sb0 = C.surrenderBonus(); C.noteMercy(2); out.sbMerciful = Math.round(C.surrenderBonus() * 100) / 100; C.noteMercy(-5); out.sbCruel = Math.round(C.surrenderBonus() * 100) / 100;
    C.setAmnesty('all'); out.sbAmnesty = Math.round(C.surrenderBonus() * 100) / 100;
    // prisoners: spawn an army actor, make him surrender, handle each way
    const s = g.scene, pl = g.player; const mk = () => { const a = C.armyActor(s, pl.x + 60, pl.y, 'rifle', 'idle'); a.surrendered = true; a.p.hp = 20; return a; };
    const a1 = mk(); out.treat = C.handlePrisoner(a1, 'treat'); const a2 = mk(); out.amn = C.handlePrisoner(a2, 'amnesty'); const a3 = mk(); out.det = C.handlePrisoner(a3, 'detain'); out.held = g.prisoners.length;
    const a4 = mk(); C.handlePrisoner(a4, 'execute'); out.amnestyVoided = g.pol.amnesty;
    for (let i = 0; i < 5; i++) { g.day++; C.policyDaily(); }
    // land
    const own = C.W.people.find((p) => p.status === 'alive' && p.fac === 'landowners'); const f0 = g.land.families; g.res.money = 500; C.land.seize(own, 'cooperative'); out.fam = g.land.families - f0;
    C.land.enact(30, 'bonds'); out.law = g.land.law; for (let i = 0; i < 30; i++) { g.day++; C.land.daily(); }
    // forecast & poll
    const t0 = performance.now(); const fc = C.forecastAll(); out.fcMs = Math.round(performance.now() - t0); out.fc = fc[0].map((x) => Math.round(x.overall * 10) / 10);
    g.res.money = 100; const poll = C.pollSettlement('palmarito', 20); out.poll = poll && [poll.n, Math.round(poll.pctRebel * 100)];
    return out;
  });
  console.log(JSON.stringify(r)); console.log('ERRORS', errors); await browser.close();
})();
