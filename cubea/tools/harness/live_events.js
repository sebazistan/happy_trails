// Live events: sea spots (overboard lifebuoy via E at the stern, leak, passive timeout) and the road ambush.
const { open } = require('./common');
(async () => {
  let { browser, page, errors } = await open('?seed=1956&auto=prologue');
  await page.waitForTimeout(2500);
  const out = {};
  await page.evaluate(() => { C.ui.liveCards = true; if (C.ui.closeModal) C.ui.closeModal(); C.G.paused = false; });
  out.sea = await page.evaluate(() => !!(C.G.sea && C.G.sea.active));
  // jump to day 3 (DAY_LEN 8 s)
  await page.evaluate(() => { C.SEA_EVENTS.over.run(C.squadPeople().find((p) => !p.roster)); });
  out.sit = await page.evaluate(() => { const a = C.situation.active; return a ? { title: a.c.title, spots: a.c.spots.map((s) => s.label), choices: a.c.choices.map((c) => c.label), modal: C.G.modalOpen } : null; });
  // walk to the stern and press E
  await page.evaluate(() => { const g = C.G, v = g.sea.veh, d = g.player.deck; d.u = -25; d.w = 0; g.player.x = v.x; g.player.y = v.y + 25; });
  await page.waitForTimeout(200); await page.screenshot({ path: '/tmp/claude-0/-home-user-happy-trails/5271b11d-7ccc-5617-b1c0-133768cad38b/scratchpad/sea_spot.png' });
  await page.keyboard.press('e'); await page.waitForTimeout(300);
  out.afterE = await page.evaluate(() => ({ active: !!C.situation.active, log: C.G.log.slice(0, 3).map((l) => l.text.slice(0, 70)) }));
  // passive timeout: the storm day
  await page.evaluate(() => { C.SEA_EVENTS.storm.run(); });
  out.storm = await page.evaluate(() => { const a = C.situation.active; if (!a) return null; a.left = 0.2; return a.c.title; });
  await page.waitForTimeout(700); out.stormResolved = await page.evaluate(() => !C.situation.active);
  console.log(JSON.stringify(out, null, 1)); console.log('ERRORS', errors); await browser.close();

  // ---- road ambush
  ({ browser, page, errors } = await open('?seed=1956&auto=sandbox'));
  await page.waitForTimeout(2000);
  const r = await page.evaluate(async () => {
    const o = {}; const g = C.G; C.ui.liveCards = true; g.paused = false; C.partyPeople().forEach((p) => { p.hp = p.maxHp = 99999; });
    C.startAmbush('palmarito'); const s = g.scene; s.actors.filter((a) => a.side === 'rebel').slice(0, 10).forEach((a) => C.giveWeapon(a, 'rifle')); o.scene = s.type; o.stage = s.ambush.stage; o.soldiers = s.ambush.soldiers.length; o.rebels = s.actors.filter((a) => a.side === 'rebel' && !a.isPlayer).length;
    o.stances = [...new Set(s.actors.filter((a) => a.side === 'rebel' && !a.isPlayer).map((a) => a.stanceOv))].join(',');
    const f0 = g.res.food; const x0 = s.ambush.truck.x; for (let i = 0; i < 100; i++) C.debug.update(1 / 20); o.truckMoved = Math.round(s.ambush.truck.x - x0);
    for (let i = 0; i < 1500 && s.ambush.stage === 'wait'; i++) C.debug.update(1 / 20); o.stageAfterWait = s.ambush.stage;
    for (let i = 0; i < 3000 && s.ambush.stage === 'fight'; i++) C.debug.update(1 / 20); o.final = s.ambush.stage; o.alive = s.ambush.soldiers.filter((a) => !a.dead).length; o.foodGain = g.res.food - f0;
    return o;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
