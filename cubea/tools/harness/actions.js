// Exercises the action recorder/macro engine: a successful chain (take feed → feed trough), a failing chain (no bucket →
// speak reason → walk back to the start), the DIST goto mode, and the routine scheduler.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false;
    const P = C.partyPeople(); const p = P[1], a = p.actor; C.initInv(p);
    for (const q of P) if (q !== p && q.actor) { q.actor.stanceOv = 'hold'; }
    a.stanceOv = 'hold'; a.order = null;
    const sx = a.x, sy = a.y; p.inv.bucket = 0; p.inv.feed = 0; g.res.feed = 6;
    const rack = C.addThing(s, 'barbacoa', sx + 60, sy, { fill: 1 }), trough = C.addThing(s, 'trough', sx + 60, sy + 40, {});
    // 1. success: walk 60px right (dist), take 2 pig feed from the rack, feed the trough
    const ok = { id: 'ok', name: 'Feed trough', home: false, repeat: 1, steps: [
      { t: 'goto', mode: 'dist', dx: 40, dy: 0 },
      { t: 'verb', v: 'take', param: { item: 'feed', n: 2 }, tgt: { kind: 'thing', tk: 'barbacoa', mode: 'nearest' } },
      { t: 'verb', v: 'feed', tgt: { kind: 'thing', tk: 'trough', mode: 'nearest' } }] };
    C.giveMacro(a, ok, { force: true });
    for (let i = 0; i < 1200 && a.order; i++) C.debug.update(1 / 20);
    out.okDone = !a.order; out.trough = trough.d.feed || 0; out.feedLeft = p.inv.feed;
    // 2. failure: needs a bucket we do not have → stops with reason and walks back to the start
    const bad = { id: 'bad', name: 'Water pigs', home: true, repeat: 1, steps: [
      { t: 'goto', mode: 'dist', dx: 0, dy: 70 },
      { t: 'verb', v: 'give_water', tgt: { kind: 'thing', tk: 'trough', mode: 'nearest' } }] };
    const bx = a.x, by = a.y; C.giveMacro(a, bad, { force: true }); const o = a.order;
    for (let i = 0; i < 1600 && a.order; i++) C.debug.update(1 / 20);
    out.err = o && o.err; out.backHome = Math.hypot(a.x - bx, a.y - by) < 25; out.ended = !a.order;
    // 3. missing target: no such thing → clear error
    const lost = { id: 'lost', name: 'Sack', home: true, repeat: 1, steps: [{ t: 'verb', v: 'take', param: { item: 'food', n: 1 }, tgt: { kind: 'thing', tk: 'sack', mode: 'nearest' } }] };
    C.giveMacro(a, lost, { force: true }); const o3 = a.order; for (let i = 0; i < 400 && a.order; i++) C.debug.update(1 / 20); out.err3 = o3 && o3.err;
    // 4. record via API
    g.sel = [p.id]; C.recStart(); C.recGoto(a.x + 30, a.y); C.recStop(true); out.saved = g.macros.length;
    return out;
  });
  console.log(JSON.stringify(r)); console.log('ERRORS', errors); await browser.close();
})();
