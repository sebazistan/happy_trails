// Situations: live banner, no pause, key answer, timeout default, notice, queue, modal whitelist, narrow-screen log.
const { open } = require('./common');
(async () => {
  const { browser, page, errors } = await open('?seed=1956&auto=sandbox', { width: 1300, height: 800 });
  await page.waitForTimeout(2000);
  const out = {};
  const mk = () => page.evaluate(() => { C.ui.liveCards = true; window.__r = []; C.G.paused = false; C.G.speed = 3; const c = { title: 'Man overboard!', icon: '🌊', secs: 3, headline: 'Pepe went into the dark water.', body: 'Long text. More.', choices: [{ label: 'Go back', sub: 'costs time', fn: () => __r.push('back') }, { label: 'Continue on course', fn: () => __r.push('on') }] }; C.ui.card(c); C.ui.card({ title: 'Second thing', body: 'A notice.', choices: [{ label: 'OK', fn: () => __r.push('n') }] }); });
  await mk(); out.shown = await page.evaluate(() => ({ vis: getComputedStyle(document.getElementById('sit')).display, txt: document.getElementById('sit').innerText.replace(/\s+/g, ' '), modal: C.G.modalOpen, speed: C.G.speed, queued: C.situation.queue.length }));
  const m0 = await page.evaluate(() => C.G.min); await page.waitForTimeout(800); out.timeAdvanced = await page.evaluate((m) => C.G.min > m, m0);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-happy-trails/5271b11d-7ccc-5617-b1c0-133768cad38b/scratchpad/sit_desktop.png' });
  await page.keyboard.press('1'); await page.waitForTimeout(200); out.afterKey = await page.evaluate(() => ({ r: __r.slice(), next: document.getElementById('sit').innerText.replace(/\s+/g, ' ').slice(0, 40) }));
  await page.waitForTimeout(10500); out.afterNotice = await page.evaluate(() => ({ r: __r.slice(), vis: getComputedStyle(document.getElementById('sit')).display }));
  await page.evaluate(() => { __r.length = 0; C.ui.card({ title: 'Timeout test', secs: 1.2, body: 'x.', choices: [{ label: 'Act now', fn: () => __r.push('act') }, { label: 'Hold your course', fn: () => __r.push('hold') }] }); }); await page.waitForTimeout(2200); out.timeout = await page.evaluate(() => __r.slice());
  await page.evaluate(() => { C.ui.card({ title: 'Havana, January 1959', body: 'x', choices: [{ label: 'Go', fn() { } }] }); }); out.modalForBig = await page.evaluate(() => C.G.modalOpen); await page.evaluate(() => C.ui.closeModal());
  await page.setViewportSize({ width: 345, height: 770 }); await page.evaluate(() => { for (let i = 0; i < 5; i++) C.log('Line ' + i + ' of a log that must stay readable on a phone.', 'info'); C.ui.card({ title: 'Phone', body: 'Short.', choices: [{ label: 'A', fn() { } }, { label: 'B', fn() { } }] }); }); await page.waitForTimeout(400);
  out.logW = await page.evaluate(() => Math.round(document.getElementById('log').getBoundingClientRect().width));
  await page.screenshot({ path: '/tmp/claude-0/-home-user-happy-trails/5271b11d-7ccc-5617-b1c0-133768cad38b/scratchpad/sit_phone.png' });
  console.log(JSON.stringify(out, null, 1)); console.log('ERRORS', errors); await browser.close();
})();
