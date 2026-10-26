import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const file = resolve(process.argv[2] || 'release/Smells-Like-Money.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  // Local-file and sandboxed browser contexts may deny preference storage.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage unavailable for acceptance check', 'SecurityError'); } });
  });
  await page.clock.install();
  const fileNavigation = process.env.STANDALONE_FILE_CHECK === '1';
  // The cloud Chromium administrator blocks file:// navigation. Loading the
  // exact document into an opaque-origin page still exercises the complete
  // embedded production bundle with internet disabled and storage unavailable.
  if (fileNavigation) await page.goto(pathToFileURL(file).href);
  else await page.setContent(await readFile(file, 'utf8'), { waitUntil: 'load' });
  await page.waitForSelector('[data-fixture="normal"]');
  assert.equal(await page.evaluate(() => typeof window.__game), 'undefined');
  await page.locator('[data-fixture="normal"]').click();
  await page.keyboard.press('e');
  await page.keyboard.press('e');
  await page.clock.runFor(150);
  assert.equal(await page.locator('#stage-title').textContent(), 'Skim a little off the top.');
  await page.locator('#activate').click();
  await page.clock.runFor(2500);
  assert(Number(await page.locator('#mat-S').textContent()) < 79);
  assert(Number(await page.locator('#mat-truck').textContent().then(text => text.split(' ')[0])) > 0);
  await page.locator('#pause').click();
  const time = await page.locator('#elapsed').textContent();
  await page.clock.fastForward(60_000);
  assert.equal(await page.locator('#elapsed').textContent(), time);
  await page.locator('#pause-motion').click();
  assert.equal(await page.locator('#pause-motion').getAttribute('aria-pressed'), 'true');
  await page.locator('#resume').click();
  assert.match(await page.locator('#activate').textContent(), /Start vacuum/);
  await page.locator('#scene').focus();
  await page.keyboard.down('d');
  await page.clock.runFor(150);
  assert.equal(await page.locator('#player-status').textContent(), 'ON THE MOVE');
  await page.keyboard.up('d');
  await page.clock.runFor(300);
  await page.keyboard.press('w');
  await page.clock.runFor(150);
  assert.equal(await page.locator('#player-status').textContent(), 'AIRBORNE');
  await page.clock.runFor(1000);
  await page.keyboard.down('s');
  await page.clock.runFor(150);
  assert.equal(await page.locator('#player-status').textContent(), 'CROUCHED');
  await page.keyboard.up('s');
  await page.clock.runFor(150);
  assert.equal(await page.locator('#player-status').textContent(), 'READY TO WORK');
  await page.keyboard.press('Space');
  await page.clock.runFor(500);
  assert.match(await page.locator('#activate').textContent(), /Stop vacuum/);
  const firstSpot=await page.locator('#spot-label').textContent();
  await page.keyboard.press('q');
  assert.notEqual(await page.locator('#spot-label').textContent(),firstSpot);
  assert.match(await page.locator('#activate').textContent(), /Stop vacuum/);
  await page.locator('#boost').click();
  assert.equal(await page.locator('#boost').getAttribute('aria-pressed'),'true');
  await page.locator('#boost').click();
  assert.equal(await page.locator('#boost').getAttribute('aria-pressed'),'false');
  await page.keyboard.press('Space');
  const external = requests.filter(url => !url.startsWith('file:') && !url.startsWith('data:'));
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  const report = {
    source: 'Self-contained production HTML; internet offline; storage deliberately denied',
    documentTransport: fileNavigation ? 'file://' : 'about:blank setContent (exact HTML bytes)',
    limitation: fileNavigation ? null : 'Cloud Chromium blocks file:// by administrator policy; direct local-file navigation remains a user-browser check.',
    titleAndSetup: true, suctionTransfersMaterial: true, pauseAndResume: true,
    keyboard: true, directMovement: true, spatialAim: true, boostToggle: true, settingsWithUnavailableStorage: true, productionBridgeAbsent: true,
    externalRequests: external, browserErrors: errors,
  };
  await writeFile('evidence/standalone-report.json', JSON.stringify(report, null, 2));
  await page.screenshot({ path: 'evidence/14-standalone-file.png', fullPage: true });
  console.log(report);
} finally {
  await browser.close();
}
