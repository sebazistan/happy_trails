// Shared launcher for the Cubea test harnesses. Requires Playwright:  npm i -D playwright   (or a global install)
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright')); }
const INDEX = 'file://' + path.resolve(__dirname, '..', '..', 'index.html');
async function open(query, viewport) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: viewport || { width: 1300, height: 800 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
  await page.goto(INDEX + (query || ''));
  return { browser, page, errors };
}
module.exports = { open, INDEX };
