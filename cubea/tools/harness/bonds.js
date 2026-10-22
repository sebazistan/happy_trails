// Bonds: friendship grows with proximity, faster in combat; strong bonds weigh like family in the audience of events.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G; g.paused = false; g.minPerSec = 6; const P = C.partyPeople(); const out = {};
    const [a, b, c] = [P[0], P[1], P[2]]; const A = [a.actor, b.actor, c.actor]; A.forEach((x) => { x.stanceOv = 'hold'; }); b.actor.x = a.actor.x + 12; b.actor.y = a.actor.y; c.actor.x = a.actor.x + 400; c.actor.y = a.actor.y + 400;
    for (let i = 0; i < 400; i++) C.debug.update(1 / 20);
    out.calm = Math.round(C.bondOf(a, b)); out.far = Math.round(C.bondOf(a, c));
    // combat boost: mark both as exposed each step
    const d = P[3], e = P[4]; e.actor.x = d.actor.x + 12; e.actor.y = d.actor.y; d.actor.stanceOv = e.actor.stanceOv = 'hold';
    for (let i = 0; i < 400; i++) { d.actor.exposed = 2; e.actor.exposed = 2; C.debug.update(1 / 20); }
    out.combat = Math.round(C.bondOf(d, e));
    // family-strength: force a bond to 100 and compare audience weight
    C.bondEvent(a, b, 'saved', 20); const aud = C.audienceOf(a); out.audW = aud.get(b.id) && aud.get(b.id).w; out.label = C.bondLabel(C.bondOf(a, b));
    return out;
  });
  console.log(JSON.stringify(r)); console.log('ERRORS', errors); await browser.close();
})();
