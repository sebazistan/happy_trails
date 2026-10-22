#!/usr/bin/env node
// Cubea harness: bots run the Alegria de Pio ambush with different tactics; reports survivors
// Run:  node tools/harness/bot_ambush.js     (needs Playwright + Chromium; see common.js)
const { open } = require('./common');
(async () => {
  const { browser, page: p, errors: errs } = await open('?seed=1956&auto=sandbox');
  await p.waitForTimeout(1200);

  const res = await p.evaluate((variants) => {
    const out = [];
    for (let trial = 0; trial < 6; trial++) {
      C.debug.startGame; C.beginGame; // noop
      C.newGame(1000 + trial, { foresight: 3 }); const g = C.G;
      const ids = C.W.party.filter((id) => id !== C.W.player);
      ids.forEach((id, i) => { const p = C.P(id); p.mil = p.mil || { side: 'rebel', rank: 'Soldado' }; p.side = 'rebel'; const sqi = i % 3 === 2 ? 2 : i % 2; g.squads[sqi].members.push(id); p.mil.squad = sqi; });
      for (const id of ids) C.moveTo(C.P(id), 'alegria');
      C.enterScene('alegria', { far: true }); g.player.weaponOut = true; g.paused = true;
      const s = g.scene; s.pro = { t: 0, waves: 0, plane: false, done: false };
      for (const a of s.actors) if (a.side === 'rebel') a.weaponOut = true;
      const pl = g.player; pl.p.hp = pl.p.maxHp = 130;
      const mode = trial % 3; // 0: run NW, 1: run NW + squads 'follow' + shoot at nearest, 2: hold then run
      let t = 0, done = false;
      // 'follow' squads, scattered start
      const tgt = { x: 16 * 16, y: 3 * 16 };
      for (let i = 0; i < 90 * 30 && !s.pro.done && !g.over; i++) {
        const dx = tgt.x - pl.x, dy = tgt.y - pl.y; const l = Math.hypot(dx, dy) || 1;
        // dodge: head towards NW target but sidestep around the MG on the north east by heading west first
        let mx = dx / l, my = dy / l; if (pl.y > 20 * 16 && pl.x > 20 * 16) { mx = -0.8; my = -0.6; }
        C.keys.a = mx < -0.3; C.keys.d = mx > 0.3; C.keys.w = my < -0.3; C.keys.s = my > 0.3; C.keys.Shift = mode !== 2 || t > 10;
        if (mode === 1) { const e = C.nearestEnemy(s, pl, 300); if (e && pl.weapon && pl.weapon.mag > 0) { C.tryFire(s, pl, e.x, e.y - 8); } }
        if (mode === 2 && t < 6) { C.keys.a = C.keys.d = C.keys.w = C.keys.s = false; const e = C.nearestEnemy(s, pl, 400); if (e) C.tryFire(s, pl, e.x, e.y - 8); }
        C.debug.update(1 / 30); t += 1 / 30; if (g.modalOpen) { done = true; break; }
      }
      C.keys.a = C.keys.d = C.keys.w = C.keys.s = C.keys.Shift = false;
      const alive = s.actors.filter(a => a.side === 'rebel' && !a.dead && !a.isPlayer).length;
      const dead = s.corpses.filter(a => a.side === 'rebel').length;
      out.push({ trial, mode, finished: s.pro.done, t: +t.toFixed(1), playerAlive: !pl.dead, rebelsAlive: alive, rebelsDead: dead, armyDead: s.corpses.filter(a => a.side === 'army').length, armyAlive: s.actors.filter(a => a.side === 'army' && !a.dead).length });
      g.modalOpen = false; g.pendingCard = null; document.getElementById('modal').style.display = 'none';
    }
    return out;
  });
  console.table(res); console.log(errs); await browser.close();
})();
