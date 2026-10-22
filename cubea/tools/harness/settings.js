// Settings and save/load: round-trip a game with camp things, a granted plot, a promise and an altered person; key rebinding translation.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(async () => {
    const g = C.G, s = g.scene, out = {}; g.paused = false;
    C.addThing(s, 'latrine', g.player.x + 30, g.player.y, { use: 3 }); g.res.food = 77; g.day = 9; C.initCreed(); g.creed.tierra = 0.5;
    const P = C.partyPeople()[2]; P.trueStance = 77; P.cr = null; C.crOf(P); const pid = P.id; C.promise(P, 'rifle', 20);
    out.saved = C.saveGame(1); const sv = JSON.parse(localStorage.getItem('cubea_save_1')); out.kb = Math.round(JSON.stringify(sv).length / 1024); out.changedPeople = Object.keys(sv.people).length;
    g.res.food = 1; g.day = 100; C.thingsOf(s, 'latrine').forEach((t) => C.removeThing(s, t));
    out.loaded = C.loadGame(1); const g2 = C.G;
    out.food = g2.res.food; out.day = g2.day; out.latrine = C.thingsOf(g2.scene, 'latrine').length; out.stance = C.P(pid).trueStance; out.creed = g2.creed.tierra; out.promise = g2.promises.filter((x) => x.kind === 'rifle').length;
    out.party = g2.scene.actors.filter((a) => a.squad >= 0).length;
    // simulate for a while after load: nothing should throw
    for (let i = 0; i < 400; i++) C.debug.update(1 / 20); out.ranOn = true;
    // key rebinding: x → u
    C.settings.keys = { x: 'u' }; C.applySettings(); const pl = C.G.player; pl.weapon = pl.weapon || { k: 'carbine' }; pl.weaponOut = false;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'u', bubbles: true })); out.drawnViaU = !!pl.weaponOut;
    pl.weaponOut = false; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true })); out.xSwallowed = !pl.weaponOut; C.settings.keys = {}; C.applySettings();
    return out;
  });
  console.log(JSON.stringify(r)); console.log('ERRORS', errors); await browser.close();
})();
