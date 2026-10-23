// Landing as a played firefight at three risk levels. The player walks north; the fight is simulated; the outcome comes from the bullets.
const { open } = require('./common');
(async () => {
  for (const [name, th] of [['quiet', 0.1], ['contact', 0.6], ['heavy', 1.4]]) {
    const { browser, page, errors } = await open('?seed=1956&auto=prologue'); await page.waitForTimeout(2300);
    const r = await page.evaluate((th) => {
      const g = C.G, o = {}; g.paused = false; C.ui.playLanding = true; C.ui.liveCards = true; if (C.ui.closeModal) C.ui.closeModal();
      const S = g.sea; for (const k in S.threat) S.threat[k] = th; S.alert = 0; S.t = 24 * 7 + 1; for (let i = 0; i < 5; i++) C.debug.update(1 / 20);   // approach starts
      if (C.ui.closeModal) { g.modalOpen = false; document.getElementById('modal').style.display = 'none'; }
      const st = C.LANDING_SITES.find((q) => q.id === 'playa'); S.veh.x = st.wx; S.veh.y = st.wy + 40; S.veh.spd = 20; C.debug.update(0.02); C.seaLand();
      const L = S.landing; o.phase = S.phase; o.hostiles = L && L.hostiles.length; o.extras = L && L.extras.length; o.named0 = L && L.named; o.sceneActors = g.scene.actors.length;
      C.partyPeople && 0; const pl = g.player; pl.hp = 99999 * 0 + pl.hp; let frames = 0, maxBul = 0;
      for (let i = 0; i < 20 * 200 && g.sea && g.sea.landing && !g.over; i++) { C.debug.keys.w = pl.y > (st.cy - 24) * 16 - 4; C.debug.update(1 / 20); frames++; maxBul = Math.max(maxBul, g.scene.bullets ? g.scene.bullets.length : 0); }
      o.frames = frames; o.maxBullets = maxBul; o.scene = g.scene.sid; o.over = g.over && g.over.cause; o.flags = g.flags.landing; o.party = C.squadPeople().length; o.res = g.res.ammo; return o;
    }, th);
    console.log(name, JSON.stringify(r)); console.log('  ERRORS', errors); await browser.close();
  }
})();
