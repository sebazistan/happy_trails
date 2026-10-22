// Period weapons: BAR, carbine, bazooka (rocket, backblast, vehicle kill) and the mortar crew order.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false; const P = C.partyPeople();
    // ---- bazooka vs an army truck
    g.heavy = { bazooka: 1, mortar: 1 }; g.res.rocket = 3; g.res.shell = 6;
    const bz = P[0], ally = P[1];
    C.armSoldier(bz, 'bazooka'); C.initInv(bz); bz.inv.rocket = 2; const a = bz.actor; a.weapon.mag = 1; a.weapon.spare = 2;
    const tx = a.x + 160, ty = a.y; const truck = C.addVehicle(s, 'armytruck', tx, ty, 0, { fuel: 40 }); const hp0 = truck.hp;
    ally.actor.x = a.x - 14; ally.actor.y = a.y; const hpAlly = ally.hp;      // standing in the backblast
    C.tryFire(s, a, tx, ty); for (let i = 0; i < 160; i++) C.debug.update(1 / 40);
    out.truckHp = [hp0, Math.round(truck.hp)]; out.wreck = truck.wreck; out.backblast = Math.round(hpAlly - ally.hp);
    // ---- mortar: gunner + crew
    const gun = P[2], crew = P[3]; C.armSoldier(gun, 'mortar'); C.initInv(gun); C.initInv(crew); crew.inv.shell = 3; gun.inv.shell = 1;
    crew.actor.x = gun.actor.x + 10; crew.actor.y = gun.actor.y;
    C.setSel([gun.id, crew.id]); const before = s.decals.filter((d) => d.k === 'crater').length;
    C.issue({ type: 'mortar', x: gun.actor.x + 260, y: gun.actor.y + 20 });
    for (let i = 0; i < 40 * 30; i++) C.debug.update(1 / 40);
    out.craters = s.decals.filter((d) => d.k === 'crater').length - before; out.shellsLeft = [gun.inv.shell, crew.inv.shell];
    // ---- loads
    out.cap = Math.round(C.capacityOf(gun)); out.load = Math.round(C.loadOf(gun)); out.slow = Math.round(gun.actor.loadK * 100) / 100;
    // ---- all weapons usable
    out.weapons = Object.keys(C.WEAPONS).length;
    return out;
  });
  console.log(JSON.stringify(r)); console.log('ERRORS', errors); await browser.close();
})();
