// Hunting: fauna table accuracy, habitat spawns, bird flush, carcass → dress → fresh meat → rot / smoke, snares, wounded boar charges, blood trail.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false;
    out.species = Object.keys(C.ANIMALS).filter((k) => C.ANIMALS[k].wild).join(',');
    const cnt = {}; s.animals.forEach((a) => { cnt[a.k] = (cnt[a.k] || 0) + 1; }); out.sierra = cnt;
    const P = C.partyPeople(); const a = P[1].actor; C.initInv(P[1]); P.forEach((p) => p.actor && (p.actor.stanceOv = 'hold'));
    // a quail beside us flushes
    const q = { k: 'codorniz', def: C.ANIMALS.codorniz, x: a.x + 20, y: a.y, hx: a.x + 20, hy: a.y, face: 1, anim: 0, moving: false, dead: false, wait: 5, hp: 30, hpMax: 30, tx: a.x + 20, ty: a.y, wild: true };
    s.animals.push(q); g.hour = 12; a.moving = true; C.huntUpdate(s, 0.05); out.flushed = q.flee > 0;
    // a boar killed -> carcass (no auto food) -> dress -> fresh meat
    const b = { k: 'boar', def: C.ANIMALS.boar, x: a.x + 10, y: a.y, hx: a.x + 10, hy: a.y, face: 1, anim: 0, moving: false, dead: true, deadT: g.time, wait: 5, hp: 0, hpMax: 45, wild: true }; s.animals.push(b);
    const items0 = s.items.length; const f0 = P[1].inv.food || 0; out.dressCheck = C.VERB.dress.check(a, { o: b }); C.VERB.dress.done(a, { o: b, x: b.x, y: b.y });
    out.gotMeat = (P[1].inv.food || 0) + (g.res.fresh || 0) - f0; out.fresh = P[1].fresh || 0 + 0; out.carcassGone = s.animals.indexOf(b) < 0;
    // rot after the day passes
    g.time += 3600 * 0.5; for (let i = 0; i < 12; i++) C.huntTick(s, 60); out.afterRot = (P[1].fresh || 0) + (g.res.fresh || 0);
    // smoking cures
    P[1].fresh = 5; P[1].freshT = g.time; const rack = C.addThing(s, 'barbacoa', a.x, a.y, {}), fire = C.addThing(s, 'fire', a.x + 10, a.y, { lit: true }); g.res.lena = 4; out.smokeCheck = C.VERB.smoke_meat.check(a, { x: rack.x, y: rack.y, o: rack }); C.VERB.smoke_meat.done(a, { o: rack }); out.freshAfterSmoke = P[1].fresh;
    // snare catches small night game
    g.hour = 22; const sn = C.addThing(s, 'snare', a.x + 40, a.y + 40, {}); const hu = { k: 'hutia', def: C.ANIMALS.hutia, x: a.x + 50, y: a.y + 40, hx: a.x + 50, hy: a.y + 40, face: 1, anim: 0, moving: false, dead: false, wait: 5, hp: 30, hpMax: 30, wild: true }; s.animals.push(hu);
    for (let i = 0; i < 60 && !sn.d.catch; i++) C.huntTick(s, 60); out.snared = sn.d.catch; if (sn.d.catch) { C.VERB.check_snare.done(a, { o: sn }); out.afterCheck = sn.d.catch; }
    // wounded boar charges and hurts
    const wb = { k: 'boar', def: C.ANIMALS.boar, x: a.x + 60, y: a.y, hx: a.x + 60, hy: a.y, face: 1, anim: 0, moving: false, dead: false, wait: 5, hp: 30, hpMax: 45, tx: 0, ty: 0, wild: true }; s.animals.push(wb);
    const hp0 = P.reduce((t, p) => t + p.hp, 0); for (let i = 0; i < 100; i++) C.huntUpdate(s, 0.05); out.charged = P.reduce((t, p) => t + p.hp, 0) < hp0;
    // fish needs a line
    P[1].inv.line = 0; out.fishCheck = C.VERB.fish.check(a); P[1].inv.line = 1; out.fishOK = C.VERB.fish.check(a);
    // soak after
    for (let i = 0; i < 300; i++) C.debug.update(1 / 20); out.ran = true;
    return out;
  });
  console.log(JSON.stringify(r)); console.log('ERRORS', errors); await browser.close();
})();
