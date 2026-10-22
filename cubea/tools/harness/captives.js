// Captives: take, tie, march, feed, question (4 ways), escape without guards, release walking out, trial verdicts, stockade.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false; C.policyInit();
    const P = C.partyPeople(); const a = P[1].actor; P.forEach((p) => p.actor && (p.actor.stanceOv = 'hold'));
    const mk = () => { const q = C.armyActor(s, a.x + 25, a.y + 5, 'rifle'); q.surrendered = true; return q; };
    const tg = (q) => ({ kind: 'actor', o: q, x: q.x, y: q.y });
    let q = mk(); out.captureCheck = C.VERB.capture.check(a, tg(q)); C.VERB.capture.done(a, tg(q)); out.isCaptive = !!q.captive; out.prisoners = g.prisoners.length; out.disarmed = !q.weapon;
    // follows the keeper
    a.x += 120; for (let i = 0; i < 400; i++) C.debug.update(1 / 20); out.followed = Math.hypot(q.x - a.x, q.y - a.y) < 80;
    // tie up: stays
    C.VERB.tie_up.done(a, tg(q)); const px = q.x; a.x += 150; for (let i = 0; i < 200; i++) C.debug.update(1 / 20); out.stayedTied = Math.abs(q.x - px) < 6; a.x -= 150;
    // feed
    q.p.needs.food = 20; g.res.food = 5; C.VERB.feed_captive.done(a, tg(q)); out.fed = q.p.needs.food > 40;
    // questioning: four approaches
    const res = {}; for (const how of ['ask', 'kind', 'press', 'beat']) { let talked = 0; const j0 = g.rep.justice; for (let i = 0; i < 30; i++) { const qq = mk(); C.captureActor(qq, a); qq.p.trueStance = -30; qq.p.hp = qq.p.maxHp; qq.p.morale = 50; s.spotted = []; g.res.food = 9; C.VERB.interrogate.done(a, tg(qq), { how }); if (s.spotted.length) talked++; g.prisoners = g.prisoners.filter((x) => x !== qq.p.id); qq.captive = null; qq.dead = true; } res[how] = talked + '/30'; } out.talked = res; out.justiceAfterBeating = g.rep.justice;
    // escape: a captive far from every rebel bolts
    const e = mk(); C.captureActor(e, a); e.captive.tied = true; P.forEach((p) => { if (p.actor) { p.actor.x += 600; } }); g.player.x += 600; let esc = false; for (let i = 0; i < 4000 && !esc; i++) { C.debug.update(1 / 20); esc = !!(e.captive && e.captive.escaped); } out.escapedWithoutGuards = esc;
    P.forEach((p) => { if (p.actor) p.actor.x -= 600; }); g.player.x -= 600; e.captive = null; e.dead = true;
    // release: walks out of the scene
    const f = mk(); C.captureActor(f, a); C.VERB.free_captive.done(a, tg(f), { how: 'amnesty' }); let gone = false; for (let i = 0; i < 12000 && !gone; i++) { C.debug.update(1 / 20); gone = f.gone || s.actors.indexOf(f) < 0; } out.walkedOut = gone; out.status = f.p.status;
    // trial: sample verdicts for a guilty informer with a stern crowd vs a merciful one
    const verdict = (justicia, disciplina, informer) => { let cond = 0; for (let i = 0; i < 20; i++) { const x = mk(); C.captureActor(x, a); x.p.informant = informer; x.p.revealed = informer; for (const q2 of s.actors) if (!q2.dead && q2.side === 'rebel') { const cr = C.crOf(q2.p); cr.justicia = justicia; cr.disciplina = disciplina; } const ex = g.stats.executed; C.VERB.try.done(a, tg(x)); if (g.stats.executed > ex) cond++; g.prisoners = g.prisoners.filter((z) => z !== x.p.id); x.captive = null; x.dead = true; } return cond + '/20'; };
    out.sternCrowd = verdict(-0.6, 0.9, true); out.mercifulCrowd = verdict(0.9, -0.3, false);
    out.stockade = (() => { g.res.scrap = 5; C.VERB.raise_stockade.done(a, tg({ x: a.x + 80, y: a.y + 80 }), { k: 'estacada' }); return C.thingsOf(s, 'estacada').length; })();
    for (let i = 0; i < 300; i++) C.debug.update(1 / 20); out.ran = true;
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
