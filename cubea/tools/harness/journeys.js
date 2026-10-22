// Journeys: the road scene, time acceleration, arrival, checkpoint card, vehicle trip, mule train, courier on foot.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, out = {}; g.paused = false; const mps0 = g.minPerSec;
    C.travelTo('palmarito', 'foot', [0, 1, 2, 3]); let s = g.scene;
    out.scene = s.type; out.widthTiles = s.tw; out.timeMul = +(g.minPerSec / mps0).toFixed(1); out.party = s.actors.filter((a) => a.side === 'rebel' && !a.dead).length; out.walkers = s.actors.filter((a) => a.roadWalker).length; out.carts = s.vehicles.filter((v) => v.type === 'carreton').length; out.incident = s.road.incident || 'none';
    const pl = g.player; pl.p.hp = pl.p.maxHp = 99999; const t0 = g.min; for (let i = 0; i < 400; i++) C.debug.update(1 / 20); out.gameMinPer20s = Math.round(g.min - t0);
    // a checkpoint on demand
    if (!s.road.check) { const q = { x: pl.x + 150, y: pl.y }; C.addThing(s, 'barrera', q.x, q.y, {}); s.road.check = { x: q.x, y: q.y, done: false }; for (let i = 0; i < 3; i++) { const sol = C.armyActor(s, q.x + 30 + i * 12, q.y + (i - 1) * 12, 'rifle'); sol.brain.mode = 'guard'; sol.checkpoint = true; } }
    pl.x = s.road.check.x - 60; pl.y = s.road.check.y; pl.weaponOut = false; g.modalOpen = false; C.journeyTick(s, 0.05); out.checkpointCard = !!g.modalOpen || !!g.pendingCard; if (C.ui.closeModal) C.ui.closeModal(); s.road.check.done = true;
    // walk to the east end: arrive
    const east = s.exits.find((e) => e.dest === 'palmarito'); pl.x = (east.x + 1) * C.T; pl.y = (east.y + east.h / 2) * C.T; g.exitPrompt = false; C.debug.update(1 / 20); for (let i = 0; i < 20; i++) C.debug.update(1 / 20);
    out.arrived = g.scene.sid; out.timeRestored = Math.abs(g.minPerSec - mps0) < 0.01; out.partyArrived = g.scene.actors.filter((a) => a.side === 'rebel' && !a.dead).length;
    // a vehicle trip
    const jeep = C.addVehicle(g.scene, 'jeep', g.player.x + 30, g.player.y, 0, { fuel: 38 }); C.enterVehicle(g.player, jeep); g.vehicle = jeep; C.vState(jeep); const f0 = jeep.fuel;
    C.travelTo('manzanillo', 'vehicle', [0]); out.vehScene = g.scene.type; out.inJeep = g.vehicle === jeep && g.scene.vehicles.includes(jeep); out.vehWidth = g.scene.tw;
    const s2 = g.scene; const e2 = s2.exits.find((e) => e.dest === 'manzanillo'); g.player.x = (e2.x + 1) * C.T; g.player.y = (e2.y + 4) * C.T; jeep.x = g.player.x; jeep.y = g.player.y; g.exitPrompt = false; for (let i = 0; i < 30; i++) C.debug.update(1 / 20);
    out.vehArrived = g.scene.sid; out.fuelUsed = +(f0 - jeep.fuel).toFixed(1);
    // a mule train arrives at the Sierra camp
    C.enterScene('sierra', { far: true }); g.player.p.hp = g.player.p.maxHp = 99999; const sj = g.scene; g.muleQ = [{ food: 10, ammo: 5, med: 1, lost: false }]; const food0 = g.res.food; for (let i = 0; i < 3500 && !(sj.mule && sj.mule.arrived); i++) C.debug.update(1 / 20); out.muleArrived = !!(sj.mule && sj.mule.arrived); out.foodGain = g.res.food - food0;
    // a courier comes in on foot and hands over the money
    g.courierQ = []; const carrier = C.W.people.find((p) => p.fac === 'workers' && p.status === 'alive'); C.courierArrives(carrier.id, 120); const m0 = g.res.money; for (let i = 0; i < 200; i++) C.debug.update(1 / 20); const cour = sj.actors.find((a) => a.courier); out.courierSpawned = !!cour; if (cour) { for (let i = 0; i < 600; i++) C.debug.update(1 / 20); C.VERB.receive_funds.done(g.player, { o: cour }); out.pesosGained = g.res.money - m0; }
    for (let i = 0; i < 200; i++) C.debug.update(1 / 20); out.ran = true;
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
