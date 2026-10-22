// Recruits: volunteers appear at the camp edge, are questioned, vouched for, enlisted/turned away/sent home, and give up if ignored.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false; g.supportMean = 20; g.recruitQ = [];
    const P = C.partyPeople(); const a = P[1].actor; P.forEach((p) => p.actor && (p.actor.stanceOv = 'hold'));
    let days = 0; for (; days < 80 && !g.recruitQ.length; days++) C.recruitDaily(); out.daysUntilQueue = days; out.queued = g.recruitQ.length;
    for (let i = 0; i < 12 && g.recruitQ.length; i++) { C.recruitTick(s, 20); }
    const w = s.actors.find((q) => q.recruit); out.arrived = !!w;
    if (w) {
      const tg = { kind: 'actor', o: w, x: w.x, y: w.y };
      out.variants = C.VERB.interview.variants(tg).length + '+' + C.VERB.enlist.variants(tg).length;
      for (let i = 0; i < 400; i++) C.debug.update(1 / 20); out.nearGate = Math.hypot(w.recruit.tx - w.x, w.recruit.ty - w.y) < 30;
      C.VERB.interview.done(a, tg, { q: 'why' }); C.VERB.interview.done(a, tg, { q: 'vouch' }); C.VERB.interview.done(a, tg, { q: 'shoot' });
      g.res.guns = 1; const sq0 = g.squads.reduce((n, q) => n + q.members.length, 0); out.rifleCheck = C.VERB.enlist.check(a, tg, { how: 'rifle' }); C.VERB.enlist.done(a, tg, { how: 'rifle' }); out.joined = g.squads.reduce((n, q) => n + q.members.length, 0) - sq0; out.guns = g.res.guns;
    }
    // a second one: machete keeps the rifle; a third: sent home; a fourth: ignored for days
    const mk = () => { const p = C.W.people.find((q) => q.status === 'alive' && !q.mil && !q.roster && C.ageOf(q) > 18 && C.ageOf(q) < 40 && q.sex === 'M' && q.settlement === 'sierra' && !(q.actor && q.actor.recruit)); g.recruitQ.push(p.id); C.recruitTick(s, 20); const x = s.actors.find((o) => o.recruit && o.p === p); return x; };
    const m = mk(); g.res.guns = 2; C.VERB.enlist.done(a, { o: m }, { how: 'machete' }); out.gunsAfterMachete = g.res.guns; out.macheteWpn = m.p.wpn;
    const h = mk(); C.VERB.enlist.done(a, { o: h }, { how: 'eyes' }); out.helper = !!h.p.helper;
    const ig = mk(); g.min += 4 * 1440; C.debug.syncClock(); for (let i = 0; i < 40; i++) C.debug.update(1 / 20); out.gaveUp = !ig.recruit;
    for (let i = 0; i < 200; i++) C.debug.update(1 / 20); out.ran = true;
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
