#!/usr/bin/env node
// Cubea harness: 90-day foraging-policy calibration: pay vs owe vs take
// Run:  node tools/harness/calibrate.js     (needs Playwright + Chromium; see common.js)
const { open } = require('./common');
(async () => {
  const { browser, page: p, errors: errs } = await open('?seed=1956&auto=sandbox');
  await p.waitForTimeout(1200);

  const out = await p.evaluate(() => {
    const results = {};
    for (const mode of ['pay', 'vale', 'take', 'mixed']) {
      C.beginGame && 0; C.newGame(4242, { foresight: 3 });
      const g = C.G;
      g.unlocked.layer = 6; const sq = g.squads[0]; C.W.party.slice(1, 29).forEach((id, i) => { const q = C.P(id); q.mil = { side: 'rebel', rank: 'Soldado', squad: 0 }; q.side = 'rebel'; C.moveTo(q, 'sierra'); g.squads[0].members.push(id); });
      C.enterScene('palmarito', { far: true, campSpawn: false });
      g.paused = true; const s = g.scene;
      for (let i = 0; i < 30; i++) C.debug.update(0.05);
      g.res.money = 600; g.res.food = 10;
      const pe = C.W.people.filter(q => q.settlement === 'palmarito' && q.status === 'alive' && C.ageOf(q) >= 15);
      const stats0 = pe.reduce((a, q) => a + q.trueStance, 0) / pe.length;
      const rebel = s.actors.find(a => a.side === 'rebel' && !a.isPlayer);
      let eaten = 0;
      for (let day = 0; day < 90; day++) {
        // the troop needs ~28*3 = 84 food/day; forage ~8 transactions a day
        const need = g.squads[0].members.length * 3;
        let got = 0; const before = g.res.food;
        const villagers = s.actors.filter(a => a.side === 'civ' && !a.inside && a.p.cls <= 2);
        for (let k = 0; k < 9 && villagers.length; k++) {
          const v = villagers[(Math.random() * villagers.length) | 0]; v.p.needs.food = Math.max(v.p.needs.food, 50);
          const m = mode === 'mixed' ? (k % 3 === 0 ? 'take' : 'pay') : mode;
          C.forageTransactionDirect(v, m, 6);
        }
        g.res.food = Math.max(0, g.res.food - need * 0.1); g.res.money += 8; // some donations arrive
        g.min += 1440; C.debug.syncClock(); C.dayTick();
      }
      const stats1 = pe.reduce((a, q) => a + q.trueStance, 0) / pe.length;
      const peas = pe.filter(q => q.fac === 'peasants'); const sp = peas.reduce((a, q) => a + q.trueStance, 0) / peas.length;
      const fr = C.factionTable();
      results[mode] = { village_mean_before: +stats0.toFixed(1), village_mean_after: +stats1.toFixed(1), peasants_after: +sp.toFixed(1), rep: { fear: +g.rep.fear.toFixed(0), justice: +g.rep.justice.toFixed(0), honesty: +g.rep.honesty.toFixed(0) }, money: Math.round(g.res.money), vales: Math.round(g.res.vales), food_in_stock: Math.round(g.res.food), trustPeasants: +g.trust.peasants.toFixed(2), allSupport: +g.supportMean.toFixed(1), events: g.events.length };
    }
    return results;
  });
  console.log(JSON.stringify(out, null, 1)); console.log(errs); await browser.close();
})();
