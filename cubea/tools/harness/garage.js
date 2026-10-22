// Vehicles: period draw, overheating, faults and repairs (right part vs improvised vs garage-only), cargo, trunk people, driver orders.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(async () => {
    const g = C.G, s = g.scene, out = {}; g.paused = false;
    const P = C.partyPeople(); const a = P[1].actor, b = P[2].actor; P.forEach((p) => p.actor && (p.actor.stanceOv = 'hold'));
    const v = C.addVehicle(s, 'car', a.x + 30, a.y, 0, { fuel: 50 }); C.vState(v); out.cap = v.def.cap; out.model = v.def.n;
    // 1. overheating: drive hard in the heat with a bad hose
    g.hour = 14; g.min = Math.floor(g.min / 1440) * 1440 + 14 * 60; v.driver = a; a.inVeh = v; v.spd = 190; v.driving = false; let t = 0;
    v.faults.push({ id: 'hose', n: 'burst radiator hose', known: true, t: g.time });
    for (let i = 0; i < 2400 && !v.c.stall; i++) { v.spd = 190; C.vehTick(s, v, 0.05); t += 0.05; } out.overheatedAfterSec = +t.toFixed(0); out.stall = v.c.stall; out.blocked = C.vehBlocked(v);
    // 2. cool down with the hood open
    v.spd = 0; v.hood = true; for (let i = 0; i < 4000 && v.c.stall; i++) C.vehTick(s, v, 0.05); out.cooled = !v.c.stall;
    // 3. repair: no hose in stock → improvised → fails or holds; with hose → fixed
    P[1].inv = P[1].inv || {}; C.initInv(P[1]); g.res.hose = 0; g.res.scrap = 3; const tg = { kind: 'vehicle', o: v, x: v.x, y: v.y };
    out.variants = C.VERB.repair.variants(tg).map((x) => x.label).slice(0, 3);
    out.needHose = C.VERB.repair.check(a, tg, { fault: 'hose', fix: 0 }); g.res.hose = 2; out.canFit = C.VERB.repair.check(a, tg, { fault: 'hose', fix: 0 });
    let fixed = 0; for (let i = 0; i < 12; i++) { v.faults = [{ id: 'hose', n: 'x', known: true, t: 0 }]; g.res.hose = 2; const e = C.VERB.repair.done(a, tg, { fault: 'hose', fix: 0 }); if (!v.faults.length) fixed++; } out.fittedHoseFixedOf12 = fixed;
    // improvised belt (45%) vs spare belt (95%)
    let imp = 0; for (let i = 0; i < 40; i++) { v.faults = [{ id: 'belt', n: 'x', known: true, t: 0 }]; g.res.scrap = 3; C.VERB.repair.done(a, tg, { fault: 'belt', fix: 1 }); if (!v.faults.length) imp++; } out.improvisedBeltOf40 = imp;
    // garage-only faults refuse on the road
    v.faults = [{ id: 'gasket', n: 'x', known: true, t: 0 }]; out.gasketRoadside = C.VERB.repair.check(a, tg, { fault: 'gasket', fix: 0 });
    v.faults = []; v.tires[1] = 0.05; g.res.patch = 1; out.flat = C.VERB.repair.check(a, tg, { fault: 'flat', fix: 0, tire: 1 }); C.VERB.repair.done(a, tg, { fault: 'flat', fix: 1, tire: 1 }); out.tireAfterSpare = v.tires[1];
    // 4. cargo
    C.invAdd(P[1], 'food', 5); const f0 = P[1].inv.food; C.VERB.stow.done(a, tg, { item: 'food' }); out.cargoFood = v.cargo.food; out.loadWeight = +C.vehLoad(v).toFixed(1);
    C.VERB.unstow.done(a, tg, { item: '*' }); out.cargoAfter = Object.values(v.cargo).reduce((x, y) => x + y, 0);
    // 5. people in the trunk and a checkpoint search
    b.x = a.x + 5; b.y = a.y; v.x = a.x + 10; v.y = a.y; out.trunkCheck = C.VERB.load_person.check(a, { kind: 'actor', o: b }, { where: 'trunk' }); C.VERB.load_person.done(a, { kind: 'actor', o: b }, { where: 'trunk' }); out.trunk = v.trunk.length; out.search = C.checkpointSearch(v);
    C.VERB.unload_people.done(a, tg); out.trunkAfter = v.trunk.length;
    // 6. driver orders: a jeep with an NPC driver goes where sent
    const j = C.addVehicle(s, 'jeep', a.x + 60, a.y + 40, 0, { fuel: 30 }); C.vState(j); j.ambientSafe = true; const d = P[3].actor; d.x = j.x; d.y = j.y; C.enterVehicle(d, j); d.inVeh = j; let dest = null, bd = 1e9; for (let ty = 0; ty < s.th; ty++) for (let tx = 0; tx < s.tw; tx++) { const tt = s.get(tx, ty); if (tt === C.TILE.ROAD || tt === C.TILE.TRAIL) { const dd = Math.hypot(tx * C.T - j.x, ty * C.T - j.y); if (dd > 150 && dd < bd) { bd = dd; dest = { x: tx * C.T + 8, y: ty * C.T + 8 }; } } } out.dest = dest && Math.round(bd); j.x = dest.x - 60; j.y = dest.y; j.order = { x: dest.x, y: dest.y, t: 0 }; const x0 = j.x;
    for (let i = 0; i < 1200 && j.order; i++) C.debug.update(1 / 20); out.jeepMoved = Math.round(j.x - x0); out.jeepWhy = C.vehBlocked(j); out.jeepFaults = j.faults.map((q) => q.id); out.jeepDrv = !!j.driver; out.jeepSpd = j.spd; out.jeepRoute = j.route && j.route.length; out.jeepRi = j.ri; out.jeepOrder = JSON.stringify(j.order); out.carHp = v.hp; out.carBurn = v.burning; out.jeepArrived = !j.order;
    // 7. tooltip text for a vehicle
    out.tip = C.tipHtml.vehicle(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (let i = 0; i < 300; i++) C.debug.update(1 / 20); out.ran = true;
    return out;
  });
  await page.waitForTimeout(600);
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
