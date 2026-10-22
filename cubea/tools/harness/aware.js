// Awareness: cone, hearing, town vs country judgement, covert pistol blends, reaction distributions, barred doors, meals, tooltip.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const out = {}; let g = C.G; g.paused = false;
    const sample = (scene, setup) => {
      const s = g.scene; const civs = s.actors.filter((a) => a.side === 'civ' && !a.dead && !a.inside).slice(0, 60); const pl = g.player; const counts = {};
      for (const a of civs) {
        pl.x = a.x + 70; pl.y = a.y; setup(pl); a.hd = 0; a.react = null; a.aw = { state: 'calm', cool: 0 };
        for (let k = 0; k < 4; k++) { a.aw.tt = 0; a.aw.cool = 0; C.civAware(s, a, 0.35); if (a.react) break; }
        const id = a.react ? a.react.id : 'none'; counts[id] = (counts[id] || 0) + 1;
      }
      return counts;
    };
    // country: bearded armed rebel
    const pl = g.player; pl.p.beard = true;
    out.sierraArmed = sample('sierra', (p) => { p.weapon = p.weapon || { k: 'rifle', mag: 5, spare: 10 }; p.weaponOut = true; p.covertNow = false; });
    // enter a town
    C.enterScene('manzanillo', { far: true }); g = C.G; g.paused = false; const s = g.scene;
    out.townPeople = s.actors.filter((a) => a.side === 'civ').length;
    out.townArmed = sample('town', (p) => { p.weapon = { k: 'rifle', mag: 5, spare: 10 }; p.weaponOut = true; p.covertNow = false; });
    // street clothes, hidden pistol: blends
    const civ = s.actors.find((a) => a.side === 'civ' && !a.inside); const P = g.player; P.x = civ.x + 60; P.y = civ.y; civ.hd = 0; P.weapon = { k: 'pistol', mag: 7, spare: 14 }; P.weaponOut = false; P.covertNow = true; P.p.beard = false; P.running = false; P.hide = false; P.exposed = 0; P.shooting = 0;
    let none = 0; for (let i = 0; i < 40; i++) if (C.readSubject(civ, P, s).kind === 'none') none++; out.pistolBlendsOf40 = none;
    // behind the observer: not seen
    civ.hd = Math.PI; civ.px = civ.x; civ.py = civ.y; civ.moving = false; P.x = civ.x + 90; P.weaponOut = true; civ.react = null; civ.aw = { state: 'calm', tt: 0, cool: 0 }; C.civAware(s, civ, 0.35); out.behindIgnored = !civ.react;
    // hearing: a shot near people makes some react
    P.weaponOut = false; let react = 0, n = 0; for (const a of s.actors.filter((q) => q.side === 'civ' && !q.inside).slice(0, 40)) { a.react = null; n++; } C.hearSound(s, P.x, P.y, 1, 'shot'); for (const a of s.actors) if (a.side === 'civ' && a.react) react++; out.shotReactions = react + '/' + n;
    // police alert path: force one civilian to alert and let it play
    const w = s.actors.find((q) => q.side === 'civ' && !q.inside); w.react = null; w.aw = { state: 'calm' }; const alert0 = s.alert; w.react = { id: 'alert_phone', t: 0, until: g.time + 60, at: { x: P.x, y: P.y }, phase: 0 };
    for (let i = 0; i < 1500 && w.react; i++) C.debug.update(1 / 20); out.alertRaised = s.alert > alert0;
    // barred door
    const home = s.blds.find((b) => b.tag === 'home' && b.door); const resident = s.actors.find((q) => q.side === 'civ'); home.lockUntil = g.min + 30; home.lockOwner = -5; out.lockedForOthers = C.lockedFor(home, resident); home.lockUntil = 0; out.openAfter = !C.lockedFor(home, resident);
    // meals: noon in the home eats
    const eater = s.actors.find((q) => q.side === 'civ' && C.W.houses[q.p.hh] && C.W.houses[q.p.hh].bld >= 0); const hb = s.blds[C.W.houses[eater.p.hh].bld]; eater.inside = true; eater.bld = hb.id; eater.p.needs.food = 20; g.min = Math.floor(g.min / 1440) * 1440 + 12.5 * 60; g.hour = 12.5; eater.p.mealDone = null; eater.nextPlan = g.min + 5;
    for (let i = 0; i < 4; i++) C.civAware && 0; C.debug.update(1 / 20); out.ate = eater.p.needs.food;
    // tooltip text
    const c2 = s.actors.find((q) => q.side === 'civ'); out.tip = C.tipHtml.actor(s, c2).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160);
    for (let i = 0; i < 600; i++) C.debug.update(1 / 20); out.ran = true;
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
