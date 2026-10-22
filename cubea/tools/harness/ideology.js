// Ideology: speeches shift the creed and people; alignment moves loyalty; hypocrisy bites; sceptics resist; promises kept/broken; letters beat speeches.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false; C.initCreed();
    const P = C.partyPeople(); const me = g.player; const A = P.filter((p) => p.actor && p.id !== C.W.player).slice(0, 8);
    A.forEach((p, i) => { p.actor.x = me.x + 10 + i * 5; p.actor.y = me.y + 10; p.actor.sleeping = false; p.actor.inside = false; p.needs.hope = 70; });
    const al0 = A.map((p) => C.alignment(p)); out.cr0 = Object.values(g.creed).every((v) => v === 0);
    // a land speech three times
    for (let i = 0; i < 3; i++) C.VERB.speech.done(me, { kind: 'ground', x: me.x, y: me.y, o: {} }, { sp: 'sp_tierra' });
    out.creedTierra = +g.creed.tierra.toFixed(2); const al1 = A.map((p) => C.alignment(p));
    out.alignUp = +(al1.reduce((s, v) => s + v, 0) / al1.length - al0.reduce((s, v) => s + v, 0) / al0.length).toFixed(3);
    // a letter moves one person more than a speech does
    const t = A[0]; const before = t.cr.justicia; const q0 = A[1].cr.justicia;
    C.VERB.write_letter.done(me, { kind: 'actor', o: t.actor, x: 0, y: 0 }, { ax: 'justicia' }); C.VERB.speech.done(me, { kind: 'ground', x: me.x, y: me.y, o: {} }, { sp: 'sp_justicia' });
    out.letterVsSpeech = [+(t.cr.justicia - before).toFixed(3), +(A[1].cr.justicia - q0).toFixed(3)];
    // hypocrisy: preach justice, then ruin your reputation
    g.rep.justice = 5; const ts0 = A.map((p) => p.trueStance); C.creedDaily(); out.gap = +g.creedGap.toFixed(2);
    // promises: kept and broken
    const pr = C.promise(A[2], 'rifle', 2); C.promise(A[3], 'medicine', 2); C.promiseFulfil(A[3], 'medicine'); g.day += 3; C.creedDaily();
    out.promises = g.promises.filter((x) => x.kind === 'rifle' || x.kind === 'medicine').map((x) => x.kind + ':' + (x.paid ? 'kept' : x.broken ? 'broken' : 'open'));
    // voice options differ by state
    A[4].needs.food = 10; const o1 = C.voiceOptions(me, { o: A[4].actor }).map((o) => o.label); A[4].needs.food = 90; const o2 = C.voiceOptions(me, { o: A[4].actor }).map((o) => o.label);
    out.voiceDiffers = o1.length !== o2.length || o1.join() !== o2.join();
    // obedience bonus exists
    out.obeyBonus = +C.creedObedience(A[0]).toFixed(3);
    return out;
  });
  console.log(JSON.stringify(r)); console.log('ERRORS', errors); await browser.close();
})();
