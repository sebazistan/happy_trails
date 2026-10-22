// Live land reform: notice → survey → grant → sow → water → harvest, plus neglect (a deed without seed).
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false; C.policyInit();
    const P = C.partyPeople(); const a = P[1].actor; C.initInv(P[1]); P[1].inv.stake = 8; P[1].inv.hoe = 1; P[1].inv.seed = 6; P[1].inv.bucket = 1; P[1].inv.bwater = 1;
    const tg = { kind: 'ground', x: a.x + 10, y: a.y + 10, o: {} };
    out.noEstate = C.VERB.survey.check(a, tg, { size: 'one' });
    const owner = C.W.people.find((p) => p.fac === 'landowners' && p.status === 'alive'); const f0 = g.land.families;
    out.notice = C.land.notice(owner, 'together'); out.familiesAfterNotice = g.land.families - f0;
    out.surveyErr = C.VERB.survey.done(a, tg, { size: 'one' }); const par = C.thingsOf(s, 'parcel')[0]; out.parcel = !!par; out.stakes = C.thingsOf(s, 'stake').length;
    out.overlap = C.VERB.survey.done(a, tg, { size: 'half' });
    const pp = C.W.people.find((q) => q.fac === 'peasants' && q.status === 'alive'); const peon = pp ? { p: pp, side: 'civ', x: a.x + 12, y: a.y + 12, scene: s, dead: false } : null; out.peon = !!peon;
    if (peon) { peon.x = a.x + 12; peon.y = a.y + 12; out.grantErr = C.VERB.grant.done(a, { kind: 'actor', o: peon, x: peon.x, y: peon.y }); out.families = g.land.families - f0; out.state = par.d.state; }
    out.sowErr = C.VERB.sow.check(a, { o: par }); C.VERB.sow.done(a, { o: par, x: par.x, y: par.y }); out.crops = C.thingsOf(s, 'crop').length;
    for (let i = 0; i < 25; i++) { g.day++; g.weather.rain = 0.6; C.farmDaily(); }
    const crop = C.thingsOf(s, 'crop')[0]; out.ripe = +crop.d.g.toFixed(2); out.harvestErr = C.VERB.harvest.check(a, { o: crop });
    const n0 = C.thingsOf(s, 'crop').length; C.VERB.harvest.done(a, { o: crop }); out.cropsAfter = C.thingsOf(s, 'crop').length - n0;
    // drought stalls growth
    const c2 = C.thingsOf(s, 'crop')[0]; c2.d.g = 0.2; g.weather.rain = 0; for (let i = 0; i < 8; i++) { g.day++; C.farmDaily(); } out.droughtStall = c2.d.g < 0.6;
    return out;
  });
  console.log(JSON.stringify(r)); console.log('ERRORS', errors); await browser.close();
})();
