// Notebook tabs and lens keys.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox');
  await page.waitForTimeout(2200);
  const out = {};
  await page.keyboard.press('j'); await page.waitForTimeout(300);
  out.tabsOnJournal = await page.evaluate(() => [...document.querySelectorAll('#mbox .nbtabs button')].map((b) => b.textContent + (b.classList.contains('on') ? '*' : '')).join(','));
  for (const t of ['Map', 'Manifesto', 'Factions', 'Camp', 'Help', 'Journal']) { await page.evaluate((t) => [...document.querySelectorAll('#mbox .nbtabs button')].find((b) => b.textContent === t).click(), t); await page.waitForTimeout(150); out['tab_' + t] = await page.evaluate(() => (document.querySelector('#mbox .nbtabs button.on') || {}).textContent + ' | ' + document.querySelector('#mbox').textContent.slice(0, 50).replace(/\s+/g, ' ')); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  out.visibleButtons = await page.evaluate(() => ['bNote', 'bMap', 'bMan', 'bFac', 'bJour', 'bBase', 'bHelp'].map((i) => i + ':' + (document.getElementById(i) && getComputedStyle(document.getElementById(i)).display !== 'none')).join(' '));
  await page.evaluate(() => { const b = document.getElementById('bNote'); b && b.click(); }); await page.waitForTimeout(200); out.noteBtnOpens = await page.evaluate(() => !!document.querySelector('#mbox .nbtabs')); await page.keyboard.press('Escape');
  await page.evaluate(() => { C.G.paused = true; }); await page.waitForTimeout(100);
  // lenses
  out.lenses = await page.evaluate(() => C.LENSES.map((l) => l.id).join(','));
  await page.keyboard.down('l'); await page.waitForTimeout(400);
  out.holdOn = await page.evaluate(() => C.lens.on);
  for (let i = 0; i < 10; i++) { await page.evaluate((i) => { C.lens.i = i; }, i); await page.waitForTimeout(120); if (i === 0 || i === 7) await page.screenshot({ path: `/tmp/claude-0/-home-user-happy-trails/5271b11d-7ccc-5617-b1c0-133768cad38b/scratchpad/lens${i}.png` }); }
  await page.keyboard.up('l'); await page.waitForTimeout(200); out.releasedOff = await page.evaluate(() => !C.lens.on);
  await page.keyboard.press('l'); await page.waitForTimeout(100); out.tapCycled = await page.evaluate(() => C.lens.i);
  console.log(JSON.stringify(out, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
