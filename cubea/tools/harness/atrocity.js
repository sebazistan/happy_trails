// Exercises the army atrocity tick, the offender-punishment dilemma and arming resentment.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(1500);
  const out = await page.evaluate(() => {
    const C = window.C, g = C.G, r = {};
    g.regime.heat = 60;
    for (let i = 0; i < 120; i++) { g.day++; C.atrocityTick(); }
    r.atrocities = JSON.stringify(g.stats.atrocities);
    r.recent = g.recentAtrocity && g.recentAtrocity.text;
    const rebs = C.squadPeople().filter((p) => p.id !== C.W.player);
    r.squad = rebs.length;
    const res = {};
    for (const m of ['squad', 'martial', 'private', 'ignore']) {
      const cand = rebs[rebs.length - 1 - Object.keys(res).length]; if (!cand) break;
      const vic = C.W.people.find((p) => p.sex === 'F' && p.status === 'alive');
      try { C.punishOffender(cand, vic, 'sierra', 'abuse', m); res[m] = cand.status; } catch (e) { res[m] = 'ERR ' + e.message; }
    }
    r.punish = res;
    g.res.guns = 2; const q = rebs.find((p) => p.status === 'alive'); r.arm = q ? C.armSoldier(q) : 'none';
    return r;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('ERRORS', errors);
  await browser.close();
})();
