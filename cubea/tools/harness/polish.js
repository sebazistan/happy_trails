// Polish: audio init, break/make camp round trip + exposure, feast + funeral, informer slip/watch/search, diary, guide, dev overlay.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(async () => {
    const g = C.G, s = g.scene, out = {}; g.paused = false; const P = C.partyPeople(); const a = P[1].actor; P.forEach((p) => { p.actor && (p.actor.stanceOv = 'hold'); p.hp = p.maxHp = 99999; });
    s.actors.filter((o) => o.side === 'army').forEach((o) => { o.x += 3000; });
    // audio
    try { C.snd.init(); C.snd.ambient(0.1); C.snd.pluck && C.snd.pluck(220); C.snd.guitar && C.snd.guitar("son", 3, 50); out.audio = 'ok'; } catch (e) { out.audio = 'ERR ' + e.message; }
    // camp round trip
    const n0 = (s.things || []).length; const gt = { kind: 'ground', x: a.x, y: a.y, o: { x: a.x, y: a.y } };
    out.breakCheck = C.VERB.break_camp.check(a, gt); C.VERB.break_camp.done(a, gt); out.thingsAfterBreak = (s.things || []).length + '/' + n0; out.packed = (g.packedCamp || []).length;
    out.makeCheck = C.VERB.make_camp.check(a, gt); C.VERB.make_camp.done(a, gt); out.thingsAfterMake = (s.things || []).length; out.packedLeft = (g.packedCamp || []).length;
    // exposure
    g.expo = { [s.sid]: 10 }; for (let h = 0; h < 30; h++) { g.min += 60; C.debug.syncClock(); C.debug.update(1 / 20); } out.exposure = C.campExposure(s);
    // feast
    const fire = C.thingsOf(s, 'fire')[0]; if (fire) { fire.d.lit = true; g.res.food = 40; g.res.lena = 20; const ft = { kind: 'thing', tk: 'fire', o: fire, x: fire.x, y: fire.y }; out.feastCheck = C.VERB.roast_pig.check(a, ft); C.VERB.roast_pig.done(a, ft); const h0 = P[2].mind ? P[2].mind.happiness : 0; g.min += 200; C.debug.syncClock(); for (let i = 0; i < 5; i++) C.debug.update(1 / 20); out.feastDone = !fire.d.feast; }
    // toast
    g.res.ron = (g.res.ron || 0) + 3; try { out.toastCheck = C.VERB.toast.check(a, gt); } catch (e) { out.toastCheck = 'ERR ' + e.message; }
    // suspects
    const inf = s.actors.find((o) => o.side === 'rebel' && !o.isPlayer && !o.dead); if (inf) { inf.p.informant = true; inf.p.revealed = false; const it = { kind: 'actor', o: inf, x: inf.x, y: inf.y };
      C.VERB.watch_man.done(a, it); out.watched = !!g.watched[inf.p.id]; let found = 0; for (let i = 0; i < 40; i++) { inf.p.revealed = false; C.VERB.search_kit.done(a, it); if (inf.p.revealed) found++; } out.searchFound = found;
      inf.p.revealed = false; g.hour = 23; g.min = Math.floor(g.min / 1440) * 1440 + 23 * 60; C.debug.syncClock(); for (let i = 0; i < 600; i++) C.debug.update(1 / 20); out.slipped = !!inf.slip || inf.p.revealed || 'no'; }
    // diary
    g.log.unshift({ t: g.min, day: g.day, text: 'Test event happened', kind: 'good' }); g.day++; C.diaryDaily(); out.diary = (g.diary || []).length; C.openDiary(); out.diaryOpen = document.getElementById('mbox').textContent.slice(0, 60); C.ui.closeModal();
    out.diaryTab = C.nbTabs.map((t) => t.id).join(',');
    // guide
    localStorage.removeItem('cubea_guided'); C.startGuide(true); out.guideStep0 = C.guide.i; C.endGuide(); out.guideOff = C.guide.off;
    // dev overlay
    C.toggleDev(true); out.dev = C.devText().split('\n')[0]; C.toggleDev(false);
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
