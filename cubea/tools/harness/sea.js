const { open } = require('./common');
(async () => {
  const results = {};
  for (let run = 0; run < 6; run++) {
    const { browser, page, errors } = await open('?seed=1956&auto=prologue');
    await page.waitForTimeout(2500);
    for (let k = 0; k < 60; k++) {
      const open_ = await page.evaluate(() => C.G.modalOpen);
      if (open_) { await page.click('.choice'); await page.waitForTimeout(60); continue; }
      const ph = await page.evaluate(() => { const g = C.G; for (let i = 0; i < 40 * 3; i++) C.debug.update(1 / 40); return g.sea && g.sea.phase; });
      if (ph === 'approach') break;
    }
    const sites = ['cabo', 'coloradas', 'playa', 'rio'];
    const site = sites[run % 4];
    await page.evaluate(() => { const g = C.G; g.modalOpen = false; document.getElementById('modal').style.display = 'none'; });
    await page.evaluate((id) => { const g = C.G, S = g.sea, st = C.LANDING_SITES.find(q => q.id === id); S.veh.x = st.wx; S.veh.y = st.wy + 40; S.veh.spd = 20; C.debug.update(0.02); C.seaLand(); }, site);
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => ({ title: document.querySelector('#mbox h2') && document.querySelector('#mbox h2').textContent, flags: C.G.flags.landing, over: C.G.over }));
    console.log(site, JSON.stringify(info));
    if (info.title) { await page.click('.choice'); await page.waitForTimeout(500); }
    const after = await page.evaluate(() => ({ scene: C.G.scene.sid, party: C.squadPeople().length, over: C.G.over, modal: C.G.modalOpen }));
    console.log('  after', JSON.stringify(after), errors.slice(0, 3));
    if (after.scene === 'alegria') { await page.click('.choice').catch(() => {}); await page.evaluate(() => { for (let i = 0; i < 40 * 20; i++) C.debug.update(1 / 40); }); console.log('  alegria ok; army', await page.evaluate(() => C.G.scene.actors.filter(a => a.side === 'army').length), errors.slice(0, 3)); }
    await browser.close();
  }
})();
