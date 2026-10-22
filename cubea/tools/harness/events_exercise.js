#!/usr/bin/env node
// Cubea harness: runs every event definition and anchor and every choice; renders every card and end screen
// Run:  node tools/harness/events_exercise.js     (needs Playwright + Chromium; see common.js)
const { open } = require('./common');
(async () => {
  const { browser, page: p, errors: errs } = await open('?seed=1956&auto=sandbox');
  await p.waitForTimeout(1200);

  const out = await p.evaluate(() => {
    const g = C.debug.g; g.paused = true; g.unlocked.layer = 6; g.day = 130; C.debug.syncClock && 0; g.res.money = 500; g.res.med = 20; g.res.food = 80; g.res.ammo = 200; g.foresight = 9;
    const log = { defs: [], anchors: [], errors: [] };
    const tryf = (tag, f) => { try { return f(); } catch (e) { log.errors.push(tag + ' :: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1].trim()); } };
    // make sure there is an informant for hint event
    const ev = C.W.roster.eutimio; ev.status = 'alive'; ev.settlement = 'sierra';
    for (const d of C.story.defs) {
      const w = tryf(d.id + '.w', () => d.w(g)); let nChoices = 0, shown = false;
      for (let rep = 0; rep < 2; rep++) {
        const card = tryf(d.id + '.run', () => d.run(g));
        if (card) {
          shown = true; if (card.onShow) tryf(d.id + '.onShow', () => card.onShow());
          card.choices.forEach((ch, i) => { tryf(d.id + '.choice' + i, () => { ch.fn && ch.fn(); nChoices++; }); });
          tryf(d.id + '.render', () => { C.ui.card(card); document.querySelector('#mbox').innerHTML.length; C.ui.closeModal(); });
        }
      }
      log.defs.push([d.id, d.cat, Math.round(w * 10) / 10, shown, nChoices]);
      g.modalOpen = false; g.pendingCard = null;
    }
    for (const a of C.story.anchors) {
      const card = tryf(a.id + '.run', () => a.run(g));
      let n = 0;
      if (card) { card.choices.forEach((ch, i) => tryf(a.id + '.choice' + i, () => { ch.fn && ch.fn(); if (card.after) card.after(); n++; })); tryf(a.id + '.render', () => { C.ui.card(card); C.ui.closeModal(); }); }
      log.anchors.push([a.id, !!card, n]); g.modalOpen = false; g.pendingCard = null;
    }
    // end screens
    for (const k of ['victory', 'dead', 'collapse', 'timeout']) { g.over = null; tryf('end.' + k, () => { C.ui.showEnd(k); C.ui.closeModal(); g.modalOpen = false; }); }
    g.over = null;
    // every talk menu variety: roster people etc
    const sc = C.getScene('palmarito'); 
    return log;
  });
  console.log(JSON.stringify(out.defs));
  console.log(JSON.stringify(out.anchors));
  console.log('ERR in handlers', out.errors);
  console.log('PAGE ERRORS', errs.slice(0, 10));
  await browser.close();
})();
