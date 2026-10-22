// Morale boosters: the guitar (safe vs unsafe, effects, request, army hears), coffee, cigars, rum, dominoes, pelota, mail.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false; const R = g.res;
    const P = C.partyPeople(); P.forEach((p) => p.actor && (p.actor.stanceOv = 'hold'));
    const gp = P.find((p) => p.inv && p.inv.guitar > 0); out.guitarCarrier = !!gp; out.guitarWeight = C.ITEMS.guitar.w;
    const a = gp.actor; const crowd = P.filter((p) => p !== gp).slice(0, 8); crowd.forEach((p, i) => { p.actor.x = a.x + 15 + i * 6; p.actor.y = a.y + 8; C.initBody(p); p.mind.happiness = 40; p.mind.boredom = 70; p.mind.grief = 30; p.stress = 40; });
    s.alert = 0; g.combatT = 0; g.regime.heat = 10; s.actors.filter((o) => o.side === 'army').forEach((o) => { o.x += 2000; });
    out.safe = C.safeToPlay(s, a); const tg = { kind: 'actor', o: a, x: a.x, y: a.y };
    // unsafe cases
    s.alert = 0.8; out.unsafeAlert = C.safeToPlay(s, a); s.alert = 0; g.regime.heat = 90; out.unsafeHeat = C.safeToPlay(s, a); g.regime.heat = 10;
    out.refuses = (s.alert = 0.8, C.VERB.request_song.check(P[2].actor, tg, { song: 'son' })); s.alert = 0;
    // request: effects over time
    const before = crowd.map((p) => p.mind.happiness + (100 - p.mind.boredom) + (100 - p.mind.grief)).reduce((x, y) => x + y, 0);
    C.VERB.request_song.done(P[2].actor, tg, { song: 'bolero' }); out.playing = !!a.playing; for (let i = 0; i < 700; i++) C.debug.update(1 / 20);
    const after = crowd.map((p) => p.mind.happiness + (100 - p.mind.boredom) + (100 - p.mind.grief)).reduce((x, y) => x + y, 0); out.moodGain = Math.round(after - before); out.songEnded = !a.playing;
    // trouble: soldiers within earshot while playing -> stops and army comes
    const army = s.actors.find((o) => o.side === 'army'); if (army) { army.x = a.x + 200; army.y = a.y; army.inside = false; army.brain.mode = 'patrol'; C.VERB.request_song.done(P[2].actor, tg, { song: 'son' }); a.playing = { until: g.time + 60, song: 'son', nextLine: 0, asked: false }; for (let i = 0; i < 20; i++) C.debug.update(1 / 20); out.stoppedForArmy = !a.playing; }
    // coffee
    const fire = C.addThing(s, 'fire', a.x + 20, a.y + 20, { lit: true }); R.cafe = 3; const cup = P[3].actor; cup.x = fire.x + 5; cup.y = fire.y; cup.p.needs.energy = 40; C.VERB.brew_coffee.done(a, { o: fire }); out.cups = fire.d.coffee; C.VERB.pour_coffee.done(a, { o: cup }); out.energyUp = cup.p.needs.energy - 40;
    // cigars, rum
    R.tabaco = 5; const t0 = P[4].stress; P[4].stress = 50; C.VERB.share_cigar.done(a, { o: P[4].actor }, { all: true }); out.cigarStress = P[4].stress; out.tabacoLeft = R.tabaco;
    R.ron = 2; const acc0 = C.accMod(P[5].actor); const disc0 = g.rep.discipline; C.VERB.pour_rum.done(a, { o: P[5].actor }, { all: false }); out.rumAcc = [+acc0.toFixed(2), +C.accMod(P[5].actor).toFixed(2)]; out.rumDiscipline = +(g.rep.discipline - disc0).toFixed(2);
    // dominoes, pelota, mail
    R.domino = 1; C.VERB.play_dominoes.done(a, { o: P[6].actor }); R.pelota = 1; out.ballCheck = C.VERB.play_ball.check(a, { kind: 'ground' }); C.VERB.play_ball.done(a, { kind: 'ground' });
    R.carta = 6; let bad = 0; const g0 = P.reduce((t, p) => t + (p.mind ? p.mind.grief : 0), 0); C.VERB.hand_out_mail.done(a, { kind: 'ground' }); out.lettersLeft = R.carta;
    // supply trains bring comforts
    C.moraleDeliver({ cafe: 3, tabaco: 4, ron: 1, carta: 5 }); out.cartaNow = R.carta; out.tip = C.tipHtml.actor(s, a).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(-90);
    for (let i = 0; i < 300; i++) C.debug.update(1 / 20); out.ran = true;
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
