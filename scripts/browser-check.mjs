import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Actual UI commands; only simulated time is accelerated. The development-only
// harness calls the same fixed simulation step and checks both material ledgers.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173';
const evidenceDir = new URL('../evidence/', import.meta.url);
await mkdir(evidenceDir, { recursive: true });
let server;
let browser;
const checks = [];
const failures = [];
const log = (name, detail = '') => {
  checks.push({ name, detail });
  console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function reachable() {
  try { return (await fetch(baseURL)).ok; } catch { return false; }
}
if (!(await reachable())) {
  server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
    cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, npm_config_cache: '/tmp/smells-npm-cache' },
  });
  let output = '';
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });
  for (let attempt = 0; attempt < 100 && !(await reachable()); attempt++) await delay(100);
  assert(await reachable(), `Development server did not become ready: ${output}`);
}
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1120 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} at ${message.location().url}`); });
  await page.clock.install();
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__game));
  const snapshot = () => page.evaluate(() => window.__game.snapshot());
  const advance = seconds => page.evaluate(seconds => window.__game.advance(seconds), seconds);
  let keyboard = true;
  const activate = async selector => {
    const locator = page.locator(selector);
    await locator.waitFor({ state: 'visible' });
    if (keyboard) { await locator.focus(); await locator.press('Enter'); }
    else await locator.click();
  };
  const cmd = name => activate(`[data-command="${name}"]`);
  const shot = async name => {
    await page.screenshot({ path: new URL(name, evidenceDir).pathname, fullPage: true, animations: 'disabled' });
  };
  const target = async value => {
    const selector = page.locator('#target');
    if (!keyboard) { await selector.selectOption(value); return; }
    const values = await selector.locator('option').evaluateAll(options => options.map(option => option.value));
    assert(values.includes(value), `Missing target option ${value}`);
    await selector.focus();
    await selector.press('Home');
    for (let i = 0; i < values.indexOf(value); i++) await selector.press('ArrowDown');
    await selector.press('Enter');
    assert.equal(await selector.inputValue(), value);
  };
  const tool = async name => {
    if ((await snapshot()).tool !== name) await activate(`[data-tool="${name}"]`);
  };
  const run = async () => { if (!(await snapshot()).active) await activate('#activate'); };
  const stop = async () => { if ((await snapshot()).active) await activate('#activate'); };
  const until = async (predicate, limit = 1200, batch = 1) => {
    for (let elapsed = 0; elapsed <= limit; elapsed += batch) {
      const state = await snapshot();
      if (predicate(state)) return state;
      if (elapsed === limit) break;
      await advance(Math.min(batch, limit - elapsed));
    }
    throw new Error(`Timed out after ${limit}s; state ${JSON.stringify(await snapshot())}`);
  };
  const setRange = async (id, value) => {
    // Native keyboard range input: Home starts at 0, then arrows apply the
    // element's configured step, avoiding direct game-state mutation.
    const locator = page.locator(id);
    await locator.focus();
    await locator.press('Home');
    const step = Number(await locator.getAttribute('step') || 1);
    for (let i = 0; i < Math.round(value / step); i++) await locator.press('ArrowRight');
    assert.equal(Number(await locator.inputValue()), value);
  };
  const start = async fixture => {
    await activate(`[data-fixture="${fixture}"]`);
    await cmd('openLid');
    await cmd('connect');
    await advance(0.1);
    assert.equal((await snapshot()).stage, 'SCUM');
  };
  const finishFromInlet = async ({ challenge, capture }) => {
    await cmd('inspect');
    await tool('inlet');
    await run();
    await advance(challenge ? 8.05 : 3.05);
    let state = await snapshot();
    assert(state.inlet.cleared, 'Inlet must be cleared');
    if (capture) await shot('04-inlet.png');
    await until(s => s.stage === 'DRAWDOWN', 10, 0.1);
    await tool('vacuum');
    await run();
    const desiredWater = challenge ? 40 : 340;
    await until(s => s.materials.W <= desiredWater, 400, 1);
    await stop();
    if (challenge) {
      state = await snapshot();
      assert(state.materials.W < 40.1);
      const continueButton = page.locator('[data-command="continueMix"]');
      assert(await continueButton.isDisabled(), 'Dry mixing must be disabled with a reason');
      const before = state.materials.U;
      await tool('hose');
      await target('liquid');
      await run();
      await until(s => s.materials.W >= 1.5 * (s.materials.U + s.materials.M), 100, 0.5);
      await stop();
      state = await snapshot();
      assert.equal(state.materials.U, before, 'Hose fill must not mix settled solids');
      assert(state.materials.A > 200, 'Challenge must recover by adding actual water');
      // Fill to recommended band as a player would; minimum alone is also valid.
      await run();
      await until(s => s.materials.W >= 1.8 * (s.materials.U + s.materials.M), 30, 0.5);
      await stop();
      log('Challenge dry-tank recovery', `Drained to 40; added ${state.materials.A.toFixed(1)} units before mixing`);
      await shot('09-water-recovery.png');
    }
    await cmd('continueMix');
    assert.equal((await snapshot()).stage, 'MIX');
    await tool('mixer');
    await run();
    await advance(30);
    if (capture) await shot('05-mixing.png');
    await cmd('sayPhrase');
    await until(s => s.stage === 'SLURRY', 100, 5);
    await tool('vacuum');
    await run();
    await until(s => s.stage === 'WASH', 500, 10);
    await tool('hose');
    if (challenge) {
      const bounds = await page.locator('#scene').boundingBox();
      assert(bounds);
      await page.mouse.click(bounds.x + bounds.width * 211 / 1100, bounds.y + bounds.height * 450 / 660);
      assert.equal((await snapshot()).target, 'wall0');
      await page.mouse.click(bounds.x + bounds.width * 750 / 1100, bounds.y + bounds.height * 550 / 660);
      assert.equal((await snapshot()).target, 'wall3');
      log('Mouse aims at broad side and floor wall regions');
    }
    for (let region = 0; region < 4; region++) {
      await target(`wall${region}`);
      await run();
      if (region === 0 && capture) { await advance(2); await shot('06-washing.png'); }
      await until(s => s.materials.walls[region] <= 0.05, 10, 0.5);
    }
    await stop();
    await tool('vacuum');
    await target('liquid');
    await run();
    await until(s => s.stage === 'CLEANUP', 160, 1);
    state = await snapshot();
    assert(!state.active);
    assert(state.materials.W <= 5);
    assert(state.materials.S + state.materials.U + state.materials.M <= 2);
    await cmd('stow');
    await cmd('closeLid');
    await cmd('invoice');
    state = await snapshot();
    assert.equal(state.stage, 'INVOICE');
    assert.equal(state.fees.reduce((sum, fee) => sum + fee.amount, 0), 575);
    assert.equal(new Set(state.fees.map(fee => fee.key)).size, 3);
    assert.equal(state.wipes.disposed, challenge ? 8 : 5);
    assert.equal(state.materials.PW + state.materials.PS, 0);
    log(challenge ? 'Recovery challenge to invoice' : 'Normal job to invoice, keyboard only', `${state.elapsed.toFixed(1)} active seconds; 575 fictional credits`);
    if (capture) await shot('07-invoice.png');
    else await shot('10-challenge-invoice.png');
    return state;
  };

  await shot('01-start.png');
  await page.keyboard.press('Tab');
  assert(await page.locator('.brand').evaluate(element => document.activeElement === element));
  const focusStyle = await page.locator('.brand').evaluate(element => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
  });
  assert.notEqual(focusStyle.style, 'none');
  assert(focusStyle.width >= 2);
  await page.keyboard.press('Tab');
  assert(await page.locator('#help').evaluate(element => document.activeElement === element));
  await page.keyboard.press('Enter');
  assert(await page.locator('#help-dialog').isVisible());
  await page.keyboard.press('Escape');
  assert(!(await page.locator('#help-dialog').isVisible()));
  log('Native Tab order, visible focus ring, and keyboard help dialog');
  await start('normal');
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  assert((await snapshot()).active);
  const beforeRealFrames = (await snapshot()).elapsed;
  await page.clock.runFor(500);
  const frameDelta = (await snapshot()).elapsed - beforeRealFrames;
  assert(frameDelta >= 0.4 && frameDelta <= 0.65, `Unexpected real rAF delta ${frameDelta}`);
  await page.keyboard.press('1');
  assert(!(await snapshot()).active, 'Tool selection must stop activity');
  await page.locator('#throttle').focus();
  await page.keyboard.press('Space');
  assert(!(await snapshot()).active, 'Native range focus must not start a tool');
  log('Fixed-step browser frames, Space shortcut, tool switch stop, native-control guard');
  await page.locator('#scene').focus();
  await page.keyboard.press('Escape');
  let pausedState = await snapshot();
  assert(pausedState.paused && !pausedState.active);
  await advance(20);
  assert.equal((await snapshot()).tick, pausedState.tick);
  for (const id of ['pause-mute', 'pause-motion', 'pause-scale']) {
    const button = page.locator(`#${id}`);
    const before = await button.getAttribute('aria-pressed');
    assert(['true', 'false'].includes(before));
    await activate(`#${id}`);
    assert.notEqual(await button.getAttribute('aria-pressed'), before);
    await activate(`#${id}`);
    assert.equal(await button.getAttribute('aria-pressed'), before);
    assert.equal((await snapshot()).tick, pausedState.tick);
  }
  log('Mute, motion, and UI scale remain usable inside the paused modal');
  await activate('#resume');
  assert(!(await snapshot()).paused && !(await snapshot()).active);
  log('Pause/resume freezes simulation and releases tools');

  await activate('#help');
  assert(await page.locator('#help-dialog').isVisible());
  await activate('#close-help');
  if ((await snapshot()).paused) await activate('#resume');
  log('Help opens and closes with keyboard controls');

  await run();
  await advance(8);
  await shot('02-scum.png');
  await page.setViewportSize({ width: 720, height: 1000 });
  await page.clock.runFor(50);
  assert(await page.locator('#activate').isVisible());
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  await shot('12-narrow-controls.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(50);
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  const smallButtons = await page.locator('button').evaluateAll(buttons => buttons
    .filter(button => button.getClientRects().length && !button.disabled)
    .map(button => ({ id: button.id || button.dataset.tool || button.textContent, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height }))
    .filter(button => button.width < 43.9 || button.height < 43.9));
  assert.deepEqual(smallButtons, [], `Action targets below 44px: ${JSON.stringify(smallButtons)}`);
  await shot('13-390px-controls.png');
  log('390px active layout has no overflow and enabled buttons are at least 44px');
  await page.setViewportSize({ width: 1440, height: 1120 });
  await page.clock.runFor(50);
  log('720px active controls remain usable without horizontal overflow');
  await page.locator('#scene').focus();
  await page.keyboard.press('Escape');
  const beforeCancel = (await snapshot()).tick;
  await activate('#restart');
  assert(await page.locator('#restart-dialog').isVisible());
  await activate('#cancel-restart');
  assert.equal((await snapshot()).tick, beforeCancel);
  await activate('#resume');
  await run();
  log('Restart requires confirmation; cancel preserves progress');
  await until(s => s.wipes.status === 'approaching', 10, 0.1);
  await shot('03-wipes.png');
  await stop();
  const approachBefore = (await snapshot()).wipes.approach;
  await advance(2);
  assert.equal((await snapshot()).wipes.approach, approachBefore);
  await tool('wipes');
  await run();
  await advance(2.1);
  assert.equal((await snapshot()).wipes.status, 'disposed');
  log('Wipe warning, stopped timer, and avoided clog');
  await tool('vacuum');
  await run();
  await until(s => s.stage === 'INLET', 100, 5);
  const normal = await finishFromInlet({ challenge: false, capture: true });

  // A completed invoice offers a fresh replay with the original fixture.
  await activate('#replay');
  const reset = await snapshot();
  assert.equal(reset.materials.W, 520);
  assert.equal(reset.materials.S, 80);
  assert.equal(reset.fees.length, 0);
  assert.equal(reset.wipes.status, 'waiting');
  assert.equal(reset.stage, 'SETUP');
  log('Invoice replay resets the fixture and job ledger');
  await cmd('openLid');
  await cmd('connect');
  await advance(0.1);
  await run();
  await advance(5);
  assert((await snapshot()).scumRemoved > 0);
  await page.locator('#scene').focus();
  await page.keyboard.press('Escape');
  await activate('#restart');
  await activate('#confirm-restart');
  const confirmedReset = await snapshot();
  assert.equal(confirmedReset.stage, 'SETUP');
  assert.equal(confirmedReset.seed, 101);
  assert.equal(confirmedReset.materials.W, 520);
  assert.equal(confirmedReset.materials.S, 80);
  assert.equal(confirmedReset.scumRemoved, 0);
  assert.equal(confirmedReset.fees.length, 0);
  assert.equal(confirmedReset.wipes.status, 'waiting');
  assert.equal(confirmedReset.wipes.approach, 0);
  assert.equal(confirmedReset.wipes.progress, 0);
  assert.equal(confirmedReset.heat, 0);
  assert(!confirmedReset.bogged && !confirmedReset.active && !confirmedReset.paused);
  assert(!confirmedReset.inlet.cleared && !confirmedReset.lidOpen && !confirmedReset.connected);
  assert(confirmedReset.elapsed < 1);
  log('Confirm restart after suction resets materials, timers, events, and fees');

  // Reload returns to title: this prototype intentionally has no mid-job save.
  await page.reload({ waitUntil: 'networkidle' });
  assert(!(await snapshot()).started);
  keyboard = false;
  await start('challenge');
  if (await page.locator('#mute').getAttribute('aria-pressed') === 'true') await activate('#mute');
  await setRange('#throttle', 100);
  await setRange('#air-break', 0);
  await run();
  await advance(2.1);
  let state = await snapshot();
  assert(state.bogged && state.heat >= 80);
  assert(state.flow < 1.1, 'Bogging should reduce flow to 35%');
  await activate('#mute');
  assert.equal(await page.locator('#mute').getAttribute('aria-pressed'), 'true');
  log('Unmute before pumping and mute during active pumping');
  await stop();
  await advance(3);
  assert(!(await snapshot()).bogged);
  await setRange('#throttle', 80);
  await setRange('#air-break', 15);
  log('High-load bogging, reduced throughput, and stopped-pump recovery');

  // Dispatch the browser lifecycle events to verify the registered handlers.
  // This is explicit lifecycle emulation, not a claim about a physical tab.
  await run();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  pausedState = await snapshot();
  assert(pausedState.paused && !pausedState.active);
  await advance(30);
  assert.equal((await snapshot()).tick, pausedState.tick);
  await activate('#resume');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  pausedState = await snapshot();
  assert(pausedState.paused);
  await page.clock.runFor(1000);
  assert.equal((await snapshot()).tick, pausedState.tick);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await activate('#resume');
  assert(!(await snapshot()).active);
  log('Emulated focus loss / hidden tab pauses with no catch-up');

  await run();
  await until(s => s.wipes.status === 'in_hose', 30, 0.25);
  assert.equal((await snapshot()).flow, 0);
  await shot('08-challenge-clog.png');
  await tool('wipes');
  await run();
  await advance(2.6);
  assert.equal((await snapshot()).wipes.disposed, 8);
  await tool('vacuum');
  await run();
  await until(s => s.stage === 'INLET', 100, 5);
  const challenge = await finishFromInlet({ challenge: true, capture: false });

  // Preferences must remain usable independently of gameplay, including invoice.
  await activate('#mute');
  const mute = await page.locator('#mute').getAttribute('aria-pressed');
  assert(['true', 'false'].includes(mute));
  await activate('#mute');
  assert.notEqual(await page.locator('#mute').getAttribute('aria-pressed'), mute);
  await activate('#motion');
  const motion = await page.locator('#motion').getAttribute('aria-pressed');
  assert.equal(motion, 'true');
  assert(await page.locator('body').evaluate(body => body.classList.contains('reduced-motion')));
  await activate('#scale');
  assert.equal(await page.locator('#scale').getAttribute('aria-pressed'), 'true');
  log('Mute and reduced-motion controls remain available');

  await page.setViewportSize({ width: 720, height: 1000 });
  await page.clock.runFor(50);
  assert(await page.locator('#scene').isVisible());
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  assert(!overflow, 'Narrow layout must not overflow horizontally');
  await shot('11-narrow-layout.png');
  log('720px responsive layout without horizontal overflow');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.runFor(50);
  assert(await page.locator('#help').isVisible());
  log('1280px desktop header settings available');
  const deniedPage = await context.newPage();
  const deniedErrors = [];
  deniedPage.on('pageerror', error => deniedErrors.push(String(error)));
  await deniedPage.addInitScript(() => {
    class DeniedAudioContext { constructor() { throw new DOMException('Audio denied for acceptance check', 'NotAllowedError'); } }
    window.AudioContext = DeniedAudioContext;
    window.webkitAudioContext = DeniedAudioContext;
    if (window.speechSynthesis) window.speechSynthesis.speak = () => { throw new Error('Speech unavailable for acceptance check'); };
  });
  await deniedPage.goto(baseURL, { waitUntil: 'networkidle' });
  await deniedPage.locator('[data-fixture="normal"]').click();
  await deniedPage.locator('[data-command="openLid"]').click();
  await deniedPage.locator('[data-command="connect"]').click();
  await deniedPage.evaluate(() => window.__game.advance(0.1));
  if (await deniedPage.locator('#mute').getAttribute('aria-pressed') === 'true') await deniedPage.locator('#mute').click();
  await deniedPage.locator('#activate').click();
  await deniedPage.evaluate(() => window.__game.advance(2));
  const deniedState = await deniedPage.evaluate(() => window.__game.snapshot());
  assert(deniedState.active && deniedState.materials.S < 80);
  assert.deepEqual(deniedErrors, []);
  await deniedPage.close();
  log('Denied audio context remains playable without uncaught exceptions');
  assert.deepEqual(errors, [], `Browser errors: ${errors.join('\n')}`);
  log('No uncaught browser exceptions or console errors');

  await rm(new URL('browser-failure.json', evidenceDir), { force: true });
  await writeFile(new URL('browser-report.json', evidenceDir), JSON.stringify({
    generatedAt: new Date().toISOString(), baseURL, checks, failures,
    method: 'DOM keyboard and mouse controls; development-only fixed-step time acceleration, no state edits; lifecycle events explicitly emulated.',
    normal: { elapsed: normal.elapsed, fees: normal.fees, materials: normal.materials },
    challenge: { elapsed: challenge.elapsed, fees: challenge.fees, materials: challenge.materials },
    limitations: ['Synthesized audio output is headless; audible quality and a physical hidden-tab transition require a human browser check.'],
  }, null, 2));
} catch (error) {
  failures.push(String(error));
  await writeFile(new URL('browser-failure.json', evidenceDir), JSON.stringify({ checks, failures }, null, 2));
  throw error;
} finally {
  await browser?.close();
  if (server) server.kill('SIGTERM');
}
