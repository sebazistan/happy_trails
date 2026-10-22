// Workshop: benches built from the ground, making things at them, forge accidents, cooking into a pot and serving at mealtime, trading for food.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false; const R = g.res;
    const P = C.partyPeople(); const a = P[1].actor; C.initInv(P[1]); P.forEach((p) => p.actor && (p.actor.stanceOv = 'hold'));
    out.seeded = ['toolrack', 'barbacoa', 'woodpile', 'fire', 'marmita', 'banco'].every((k) => C.thingsOf(s, k).length);
    // build a forge and a press
    R.scrap = 30; R.lena = 10; R.money = 100; R.cloth = 6; const tg = (x, y) => ({ kind: 'ground', x, y, o: {} });
    out.forgeCheck = C.VERB.build_station.check(a, tg(a.x + 90, a.y + 90), { st: 'fragua' }); C.VERB.build_station.done(a, tg(a.x + 90, a.y + 90), { st: 'fragua' }); C.VERB.build_station.done(a, tg(a.x - 90, a.y + 90), { st: 'cosedora' });
    const forge = C.thingsOf(s, 'fragua')[0], sew = C.thingsOf(s, 'cosedora')[0]; out.scrapAfter = R.scrap;
    // make grenades (repeat to see accidents), bandage
    let made = 0, bad = 0, boomHp0 = P.reduce((t, p) => t + p.hp, 0); for (let i = 0; i < 25; i++) { R.scrap = 10; R.money = 50; R.lena = 5; const g0 = R.gren || 0; const e = C.VERB.make.done(a, { kind: 'thing', tk: 'fragua', o: forge, x: forge.x, y: forge.y }, { id: 'grenade' }); if (e) bad++; else made += (R.gren - g0) / 2; }
    out.grenadeBatches = made; out.accidentsOf25 = bad; out.noScrap = (R.scrap = 0, C.VERB.make.check(a, { tk: 'fragua', o: forge }, { id: 'grenade' }));
    R.cloth = 4; const m0 = R.med; C.VERB.make.done(a, { kind: 'thing', tk: 'cosedora', o: sew, x: sew.x, y: sew.y }, { id: 'bandage' }); out.medGain = R.med - m0;
    out.variants = C.VERB.make.variants({ tk: 'fragua' }).length;
    // kitchen: pot + lit fire, cook, mealtime serves people near the pot
    const pot = C.thingsOf(s, 'marmita')[0], fire = C.thingsOf(s, 'fire')[0]; out.noFire = C.VERB.cook.check(a, { o: pot }); fire.d.lit = true; fire.x = pot.x + 8; fire.y = pot.y; R.food = 40; C.VERB.cook.done(a, { o: pot }); out.serv = pot.d.serv; out.foodAfterCook = R.food;
    P.forEach((p, i) => { if (p.actor) { p.actor.x = pot.x + (i % 5) * 6; p.actor.y = pot.y + 20 + Math.floor(i / 5) * 6; p.needs.food = 40; p.rat = { f: 1, w: 1 }; } });
    const hope0 = P[2].needs.hope; C.mealTime(); out.servedFromPot = 8 - pot.d.serv; out.hotFed = P.filter((p) => p.hotFed === g.day).length; out.hopeUp = P[2].needs.hope >= hope0;
    // ladle to one person
    pot.d.serv = 3; pot.d.until = g.min + 100; a.x = pot.x + 10; a.y = pot.y + 10; const q = P[3].actor; q.p.needs.food = 30; C.VERB.ladle.done(a, { o: q }); out.ladled = q.p.needs.food > 60;
    // trade: barter a hoe, pay, vale, gift, gunpoint
    const civ = C.W.people.find((p) => p.fac === 'peasants' && p.status === 'alive'); civ.needs.food = 80; civ.sellCd = 0; const sa = { p: civ, side: 'civ', x: a.x + 8, y: a.y, scene: s, dead: false, bubble: null, isPlayer: false };
    P[1].inv.hoe = 1; const f0 = R.food; const got = C.tradeFood(a, sa, 'barter', 'hoe'); out.barterFood = R.food - f0; out.hoeLeft = P[1].inv.hoe;
    civ.sellCd = 0; R.money = 50; const m1 = R.money; C.tradeFood(a, sa, 'pay'); out.paid = m1 - R.money;
    civ.sellCd = 0; const v0 = R.vales; C.tradeFood(a, sa, 'vale'); out.vale = R.vales - v0;
    out.tradeVariants = C.VERB.trade.variants({ o: sa, kind: 'actor' }).map((x) => x.label).join(' | ');
    out.noBlackout = true; for (let i = 0; i < 300; i++) C.debug.update(1 / 20);
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
