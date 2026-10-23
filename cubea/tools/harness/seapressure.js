// Sea pressure model: how often each event fires at different loads (cards auto-answered with the passive option).
const { open } = require('./common');
(async () => {
  const out = {}; let errs = [];
  for (const n of [82, 40, 12]) {
    const tot = { over: 0, leak: 0, storm: 0, sick: 0, plane: 0, rations: 0, flood: 0 }; const T = 6;
    for (let k = 0; k < T; k++) {
      const { browser, page, errors } = await open('?seed=' + (1956 + k) + '&auto=prologue'); await page.waitForTimeout(2200);
      const r = await page.evaluate((n) => { const g = C.G; g.paused = false; C.seaPeopleOverride = n; const t = []; let fl = 0; C.ui.card = (c) => { t.push(c.title); const d = c.choices[c.choices.length - 1]; d.fn && d.fn(); }; const lg = C.log; C.log = function (x) { if (/floods the hold/.test(x)) fl++; return lg.apply(this, arguments); };
        for (let i = 0; i < 3500 && g.sea.phase === 'cross'; i++) C.debug.update(1 / 20); return { t, fl }; }, n);
      for (const t of r.t) { if (/overboard/.test(t)) tot.over++; else if (/water/.test(t)) tot.leak++; else if (/Storm/.test(t)) tot.storm++; else if (/sea takes/.test(t)) tot.sick++; else if (/plane/.test(t)) tot.plane++; else if (/food/.test(t)) tot.rations++; }
      tot.flood += r.fl; errs = errs.concat(errors); await browser.close();
    }
    for (const k in tot) tot[k] = +(tot[k] / T).toFixed(2); out[n] = tot;
  }
  console.log(JSON.stringify(out)); console.log('ERRORS', errs);
})();
