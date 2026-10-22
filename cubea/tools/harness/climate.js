// Climate: seasonal temperatures, heat and cold strain, effects on accuracy/speed/reload for both sides, collapse, fuel, status words.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false;
    const at = (month, hour) => { const base = C.dateOf(g.day).getUTCMonth(); g.day += ((month - base) + 12) % 12 * 30; g.min = g.day * 1440 + hour * 60; C.debug.syncClock(); g.front = null; g.heatwave = null; g.weather.rain = 0; g.weather.fog = 0; const c = C.climate(); return { temp: +c.temp.toFixed(1), feels: +c.feels.toFixed(1) }; };
    out.janDawnSierra = at(0, 5.5); out.julNoonSierra = at(6, 14); out.julNoonSierraHumid = (() => { g.weather.rain = 0; const c = C.climate(); return +c.feels.toFixed(1); })();
    g.front = { until: g.min + 2000, drop: 8 }; g.weather.rain = 0.6; out.norteNight = (() => { g.min = Math.floor(g.min / 1440) * 1440 + 3 * 60; C.debug.syncClock(); const c = C.climate(); return { temp: +c.temp.toFixed(1), feels: +c.feels.toFixed(1) }; })();
    const P = C.partyPeople(); const a = P[1].actor; const army = s.actors.find((q) => q.side === 'army') || null; P.forEach((p) => p.actor && (p.actor.stanceOv = 'hold'));
    // a hot spell: exertion in the sun
    const hot = (feels) => { g.clim = { temp: feels - 3, feels, humid: 0.8, wind: 0.2, indoor: 28 }; };
    P[1].body = null; P[1].mind = null; C.initBody(P[1]); a.moving = true; a.running = false; a.inside = false; a.hide = false; g.weather.rain = 0; g.hour = 13; g.min = Math.floor(g.min / 1440) * 1440 + 13 * 60; const acc0 = C.accMod(a), spd0 = C.speedMod(a);
    let t = 0, coll = false; for (let i = 0; i < 4000 && !coll; i++) { hot(38); P[1].needs.water = 60; C.bodyTick(s, a, 0.05, 0.05 * 1.5); t += 0.05; coll = !!a.collapsed; } out.heatCollapseAfterGameMin = +(t * 1.5).toFixed(0); out.heatAccMod = [+acc0.toFixed(2), +C.accMod(a).toFixed(2)]; out.collapsed = coll;
    // cold and wet at night
    a.collapsed = 0; a.moving = false; P[1].body = null; C.initBody(P[1]); g.hour = 3; for (let i = 0; i < 3000; i++) { g.clim = { temp: 9, feels: 7, humid: 0.9, wind: 0.8, indoor: 20 }; g.weather.rain = 0.6; C.bodyTick(s, a, 0.05, 0.05 * 1.5); }
    const b = P[1].body; out.coldBody = { chill: Math.round(b.chill), wet: Math.round(b.wet), feet: Math.round(b.feet) }; out.coldMods = { acc: +C.accMod(a).toFixed(2), reload: +C.reloadMod(a).toFixed(2), speed: +C.speedMod(a).toFixed(2), alert: +C.alertMod(a).toFixed(2) };
    // the army suffers the same
    if (army) { C.initBody(army.p); army.p.body.heat = 80; army.p.body.chill = 0; out.armyAccHot = +C.accMod(army).toFixed(2); } else out.armyAccHot = 'no army here';
    // a fire warms; indoors warms
    P[2].body = null; C.initBody(P[2]); P[2].body.chill = 60; const a2 = P[2].actor; const f = C.addThing(s, 'fire', a2.x, a2.y, { lit: true }); for (let i = 0; i < 400; i++) { g.clim = { temp: 12, feels: 10, humid: 0.7, wind: 0.2, indoor: 20 }; C.bodyTick(s, a2, 0.05, 0.075); } out.chillByFire = Math.round(P[2].body.chill); C.removeThing(s, f);
    // fuel burn
    g.clim = { temp: 10, feels: 8, humid: 0.7, wind: 0.5, indoor: 20 }; g.weather.rain = 0.5; const cold = C.fuelMod(); g.clim = { temp: 25, feels: 25, humid: 0.5, wind: 0.2, indoor: 24 }; g.weather.rain = 0; out.fuelMod = [+cold.toFixed(3), +C.fuelMod().toFixed(3)];
    // status words: strong values only
    const q = P[3].actor; C.initBody(P[3]); P[3].needs.food = 60; P[3].needs.water = 70; P[3].needs.energy = 70; P[3].stress = 10; P[3].anger = 0; P[3].fear = 5; P[3].needs.hope = 60; P[3].body.heat = 5; P[3].body.chill = 0; P[3].body.wet = 0; P[3].mind.happiness = 55; P[3].mind.boredom = 5; P[3].body.sleepDebt = 2; P[3].body.hygiene = 70; P[3].hp = P[3].maxHp;
    out.wordsCalm = C.statesOf(q).map((x) => x.word); P[3].needs.food = 8; P[3].mind.happiness = 95; out.wordsStrong = C.statesOf(q).map((x) => x.word); out.popped = C.popStatus(q); out.bubble = q.sbub && q.sbub.text;
    out.tip = C.tipHtml.actor(s, q).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 420);
    // full run
    for (let i = 0; i < 400; i++) C.debug.update(1 / 20); out.ran = true;
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
