// Pack window: open it, drag a ration to a neighbour, drag a canteen to the ground; checks counts afterwards.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => { const g = C.G; g.paused = false; const P = C.partyPeople(); const a = P[0].actor, b = P[1].actor; b.x = a.x + 14; b.y = a.y; a.stanceOv = b.stanceOv = 'hold'; C.initInv(P[0]); C.initInv(P[1]); P[0].inv.food = 4; P[1].inv.food = 0; C.openPack(P[0]); return { a: P[0].id, b: P[1].id }; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-happy-trails/5271b11d-7ccc-5617-b1c0-133768cad38b/scratchpad/pack1.png' });
  await page.dragAndDrop('#pack [data-from="self"][data-k="food"]', '#pack [data-pid="' + info.b + '"]');
  await page.waitForTimeout(200);
  const r = await page.evaluate((i) => ({ a: C.P(i.a).inv.food, b: C.P(i.b).inv.food }), info);
  await page.dragAndDrop('#pack [data-from="self"][data-k="water"]', '#pack [data-to="ground"]');
  await page.waitForTimeout(200);
  const r2 = await page.evaluate((i) => ({ water: C.P(i.a).inv.water, ground: C.G.scene.items.filter(it => it.k === 'water').length }), info);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-happy-trails/5271b11d-7ccc-5617-b1c0-133768cad38b/scratchpad/pack2.png' });
  console.log(JSON.stringify({ r, r2 })); console.log('ERRORS', errors); await browser.close();
})();
