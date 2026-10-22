// Camp life: foul ground and dysentery without a latrine, a full latrine, spoilage on the ground vs a rack, fire fuel, smoke, watch, school, bedless sleepers.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false;
    const ppl = s.actors.filter((a) => (a.side === 'rebel' || a.isPlayer) && !a.dead); out.people = ppl.length;
    const cx = ppl[0].x, cy = ppl[0].y; ppl.forEach((a, i) => { a.x = cx + (i % 4) * 8; a.y = cy + Math.floor(i / 4) * 8; a.stanceOv = 'hold'; });
    const step = (hours) => { for (let i = 0; i < hours; i++) { g.hour = (g.hour + 1) % 24; if (g.hour === 0) g.day++; C.campTick(s, 60); } };
    // no latrine: ground fouls
    g.res.food = 120; g.res.lena = 6; step(48); out.foulNoLatrine = +(s.foul || 0).toFixed(2); out.spoiled = g.res.food;
    out.statsA = C.campStats(s);
    // dig a latrine near, rack for the food, hammocks, a fire, a post, a board
    const L = C.addThing(s, 'latrine', cx, cy, { use: 0 }); C.addThing(s, 'barbacoa', cx + 20, cy, {}); C.addThing(s, 'barbacoa', cx + 40, cy, {}); C.addThing(s, 'barbacoa', cx + 60, cy, {});
    const F = C.addThing(s, 'fire', cx + 10, cy + 20, { lit: false }); C.addThing(s, 'posta', cx + 30, cy + 30, {}); C.addThing(s, 'pizarra', cx - 20, cy, {});
    for (let i = 0; i < 3; i++) C.addThing(s, 'hammock', cx + i * 10, cy - 20, {});
    g.hour = 10; step(30); out.latrineUse = L.d.use;
    // fire: needs wood, burns fuel, daylight smoke raises heat
    const h0 = g.regime.heat; F.d.lit = true; g.hour = 8; g.res.lena = 5; step(2); out.fireOutAfterMeal = !F.d.lit; out.heatUp = g.regime.heat > h0; out.lenaLeft = g.res.lena;
    // watch: a sentry on the post covers the night
    const w = ppl[1]; w.onWatch = true; g.hour = 21; step(2); out.cover = s.nightCover;
    // school: teach
    const tch = ppl[0]; C.invAdd(tch.p, 'primer', 1); const stu = ppl.find((q) => q !== tch && !q.p.literate); if (stu) { stu.x = cx - 15; stu.y = cy; const V = C.VERB.teach; const before = stu.p.lit || 0; V.done(tch, { kind: 'thing', tk: 'pizarra', o: C.thingsOf(s, 'pizarra')[0], x: cx - 20, y: cy }); out.lesson = (stu.p.lit || 0) - before; } else out.lesson = 'no illiterate in party';
    // bedless: 3 hammocks for N people
    out.bedsShort = C.campStats(s).bedsShort;
    // verbs refuse without tools
    const bare = ppl[2]; C.initInv(bare.p); bare.p.inv.hoe = 0; bare.p.inv.axe = 0; out.digRefused = C.VERB.dig_latrine.check(bare, { x: cx + 200, y: cy + 200 });
    return out;
  });
  console.log(JSON.stringify(r)); console.log('ERRORS', errors); await browser.close();
})();
