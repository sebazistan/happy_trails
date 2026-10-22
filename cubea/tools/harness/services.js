// Services: radio broadcasts, the sick bay (stretcher, cot, nursing, sick call), governing as places.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = C.G, s = g.scene, out = {}; g.paused = false; const R = g.res; C.policyInit();
    const P = C.partyPeople(); const a = P[1].actor; P.forEach((p) => p.actor && (p.actor.stanceOv = 'hold'));
    const tg = (x, y) => ({ kind: 'ground', x, y, o: {} });
    // radio
    R.scrap = 20; R.tools = 1; R.battery = 1; out.noRadio = C.VERB.build_service.check(a, tg(a.x + 60, a.y + 60), { k: 'radioset' }); C.VERB.build_service.done(a, tg(a.x + 60, a.y + 60), { k: 'radioset' });
    const radio = C.thingsOf(s, 'radioset')[0]; const rt = { kind: 'thing', tk: 'radioset', o: radio, x: radio.x, y: radio.y };
    out.plankVerbs = Object.keys(C.VERB).filter((k) => k.startsWith('announce_')).length; const heat0 = g.regime.heat;
    out.variants = C.VERB.announce_0.variants(rt).map((v) => v.label.slice(0, 50)); C.VERB.announce_0.done(a, rt, { i: 2 }); out.declared = g.platform.declared[0]; out.heatUp = g.regime.heat > heat0; out.onAir = C.VERB.announce_1.check(a, rt);
    radio.d.air = 0; C.VERB.announce_amnesty.done(a, rt, { l: 'all' }); out.amnesty = g.pol.amnesty; radio.d.air = 0;
    const lit = C.W.people.filter((p) => p.status === 'alive' && !p.mil).slice(0, 200); const before = lit.reduce((t, p) => t + (C.crOf(p).tierra || 0), 0); C.VERB.read_on_air.done(a, rt, { text: 'historia' }); out.tierraShift = +(lit.reduce((t, p) => t + C.crOf(p).tierra, 0) - before).toFixed(2);
    // sick bay
    const w = P[2].actor, b = P[3].actor, c3 = P[4].actor; P[2].hp = P[2].maxHp * 0.2; P[2].bleed = 0.6; w.x = a.x + 10; w.y = a.y; b.x = a.x + 14; b.y = a.y + 3;
    out.needTwo = (() => { const keep = [b.x, b.y]; b.x += 500; const e = C.VERB.carry_wounded.check(a, { kind: 'actor', o: w }); b.x = keep[0]; return e; })();
    R.cloth = 4; R.scrap = 10; C.VERB.build_service.done(a, tg(a.x + 90, a.y + 20), { k: 'camilla' }); const cot = C.thingsOf(s, 'camilla')[0];
    C.VERB.carry_wounded.done(a, { kind: 'actor', o: w }); out.carried = !!w.carried; out.bearerSlow = +C.speedMod(a).toFixed(2); a.x = cot.x - 12; b.x = cot.x - 8; for (let i = 0; i < 10; i++) C.debug.update(1 / 20);
    out.followsBearers = Math.hypot(w.x - (a.x + b.x) / 2, w.y - (a.y + b.y) / 2) < 12;
    a.x = cot.x - 10; a.y = cot.y; C.VERB.put_on_cot.done(a, { o: cot, x: cot.x, y: cot.y }); out.onCot = w.onCot === cot.id; const hp0 = P[2].hp; R.med = 3; C.VERB.nurse.done(a, { o: cot }); out.nurseGain = Math.round(P[2].hp - hp0); out.bleedAfter = P[2].bleed;
    P[2].hp = P[2].maxHp * 0.3; const hp1 = P[2].hp; for (let i = 0; i < 400; i++) C.debug.update(1 / 20); out.cotHeals = Math.round(P[2].hp - hp1);
    out.sickCallStep = JSON.stringify(C.PRESETS.find((p) => p.id === 'p_sickcall').steps[0].tgt); P[4].hp = P[4].maxHp * 0.5; const ref = C.resolveRef(s, a, { kind: 'actor', filter: 'hurt', mode: 'nearest' }, {}); out.sickRefFound = !!ref;
    // governing as places
    C.enterScene('habana', { far: true }); g.player.p.hp = g.player.p.maxHp = 99999; C.G.paused = false; C.beginGoverning(); if (C.ui.closeModal) C.ui.closeModal();
    const hs = C.G.scene; out.petitions = C.thingsOf(hs, 'petition').length; out.places = C.thingsOf(hs, 'petition').map((t) => t.d.label).slice(0, 3);
    const pt = C.thingsOf(hs, 'petition')[0]; out.auditCheck = C.VERB.hold_audience.check(g.player, { o: pt }); C.VERB.hold_audience.done(g.player, { o: pt }); out.cardOpen = !!C.G.modalOpen;
    // decide all eight via their cards
    let decided = 0; for (let i = 0; i < 8; i++) { C.G.modalOpen = false; if (C.G.gov.done[i]) continue; C.govDecide(i); const m = document.querySelector('#mbox .choice'); if (m) { m.click(); decided++; } }
    out.decided = decided; out.allDone = C.G.gov.done.every(Boolean); out.petitionsLeft = C.thingsOf(hs, 'petition').length;
    for (let i = 0; i < 200; i++) C.debug.update(1 / 20); out.ran = true;
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
