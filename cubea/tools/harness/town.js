// Town life: building variety, trades, population, traffic, mounts, schedules through the day, performance.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const res = {}; const g = C.G; g.paused = false;
    for (const sid of ['manzanillo', 'bayamo', 'santiago', 'habana', 'palmarito']) {
      C.enterScene(sid, { far: true }); const s = C.G.scene; C.G.paused = false; C.G.over = null; s.actors = s.actors.filter((a) => a.side !== 'army');   // keep the army out of this test: shouts and arrests panic the street const pl = C.G.player; pl.p.hp = pl.p.maxHp = 99999; pl.weaponOut = false;
      const civs = s.actors.filter((a) => a.side === 'civ'), blds = {}, occ = {};
      s.blds.forEach((b) => { blds[b.key] = (blds[b.key] || 0) + 1; }); civs.forEach((a) => { occ[a.p.occ] = (occ[a.p.occ] || 0) + 1; });
      const veh = {}; s.vehicles.forEach((v) => { veh[v.type] = (veh[v.type] || 0) + 1; });
      const t0 = performance.now(); for (let i = 0; i < 60; i++) C.debug.update(1 / 20); const ms = (performance.now() - t0) / 60;
      const mounted = s.actors.filter((a) => a.mount).length, driving = s.vehicles.filter((v) => v.driving).length;
      // schedule snapshots: how many civilians are indoors at 3am, 10am, 1pm, 9pm
      const snap = {}; for (const h of [3, 10, 13, 21]) { C.G.min += ((h * 60 - (C.G.min % 1440)) + 1440) % 1440; C.debug.syncClock(); for (let i = 0; i < 1100; i++) C.debug.update(1 / 10); const act = s.actors.filter((a) => a.side === 'civ' && !a.dead); snap[h] = Math.round(100 * act.filter((a) => a.inside).length / act.length) + '% in'; }
      const withWork = civs.filter((a) => C.workplaceOf(s, a)).length;
      res[sid] = { civs: civs.length, buildingKinds: Object.keys(blds).length, occKinds: Object.keys(occ).length, newBld: ['restaurante', 'panaderia', 'carniceria', 'mercado', 'taller', 'correos', 'bar', 'escuela', 'hospital', 'ayuntamiento', 'gasolinera'].filter((k) => blds[k]).join(','), veh, driving, mounted, ms: +ms.toFixed(1), snap, workShare: Math.round(100 * withWork / civs.length) + '%' };
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
