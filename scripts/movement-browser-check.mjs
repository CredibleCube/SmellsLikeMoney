import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Every gameplay command below comes from visible controls or real key events.
// The development bridge advances only the shared fixed-step simulation clock.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173';
const evidenceDir = new URL('../evidence/', import.meta.url);
await mkdir(evidenceDir, { recursive: true });
let server;
let browser;
const checks = [];
const failures = [];
const log = name => { checks.push(name); console.log(`PASS ${name}`); };
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function reachable() { try { return (await fetch(baseURL)).ok; } catch { return false; } }
if (!(await reachable())) {
  server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
    cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, npm_config_cache: '/tmp/smells-npm-cache' },
  });
  let output = '';
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });
  for (let i = 0; i < 100 && !(await reachable()); i++) await delay(100);
  assert(await reachable(), `Vite failed to start: ${output}`);
}
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.clock.install();
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__game));
  const snapshot = () => page.evaluate(() => window.__game.snapshot());
  const advance = seconds => page.evaluate(seconds => window.__game.advance(seconds), seconds);
  const focus = () => page.locator('#scene').focus();
  const shot = name => page.screenshot({ path: new URL(name, evidenceDir).pathname, fullPage: true, animations: 'disabled' });
  const setAdvanced = async open => {
    const details = page.locator('#advanced-controls');
    if (!(await details.count()) || await details.evaluate(element => element.open) === open) return;
    await details.locator('summary').first().click();
    assert.equal(await details.evaluate(element => element.open), open);
  };
  const inputsReleased = state => Object.values(state.player.input).every(value => value === false);
  const travel = async destination => {
    await focus();
    const before = await snapshot();
    const key = destination >= before.player.x ? 'd' : 'a';
    await page.keyboard.down(key);
    for (let i = 0; i < 160; i++) {
      const state = await snapshot();
      if (Math.abs(state.player.x - destination) <= 16 || (destination - before.player.x) * (destination - state.player.x) < 0) break;
      await advance(0.05);
    }
    await page.keyboard.up(key);
    await advance(0.3);
    assert(Math.abs((await snapshot()).player.x - destination) <= 35);
  };
  await page.locator('[data-fixture="normal"]').click();
  await focus();
  const spawn = await snapshot();
  assert.equal(spawn.player.x, 650);
  assert.equal(spawn.player.y, 278);
  assert(spawn.player.grounded && inputsReleased(spawn));

  await page.keyboard.down('d');
  await advance(0.4);
  let state = await snapshot();
  assert(state.player.x > spawn.player.x + 30 && state.player.vx > 0 && state.player.facing === 1);
  await page.keyboard.up('d');
  await advance(0.3);
  assert(Math.abs((await snapshot()).player.vx) < 0.01);
  const rightX = (await snapshot()).player.x;
  await page.keyboard.down('a');
  await advance(0.4);
  state = await snapshot();
  assert(state.player.x < rightX - 30 && state.player.facing === -1);
  await page.keyboard.up('a');
  await advance(0.3);
  log('WASD left/right hold, release, facing, and acceleration');

  await page.keyboard.down('ArrowRight');
  await advance(0.25);
  const arrowX = (await snapshot()).player.x;
  await page.keyboard.down('d');
  await page.keyboard.up('ArrowRight');
  await advance(0.25);
  state = await snapshot();
  assert(state.player.input.right && state.player.x > arrowX + 20);
  await page.keyboard.up('d');
  await advance(0.3);
  assert(inputsReleased(await snapshot()));
  log('Arrow movement aliases remain held until every alias is released');

  const jumpStart = (await snapshot()).player.x;
  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await advance(0.2);
  state = await snapshot();
  assert(!state.player.grounded && state.player.y < 250 && state.player.x > jumpStart + 10);
  await page.keyboard.up('d');
  await shot('15-platformer-jump.png');
  await advance(1.4);
  state = await snapshot();
  assert(state.player.grounded && Math.abs(state.player.y - 278) < 0.001);
  assert(state.player.input.up, 'Holding jump does not auto-repeat after landing');
  await page.keyboard.up('w');
  await page.keyboard.down('ArrowUp');
  await advance(0.15);
  assert(!(await snapshot()).player.grounded);
  await page.keyboard.up('ArrowUp');
  await advance(1);
  assert((await snapshot()).player.grounded);
  log('W and Up jump with gravity, landing, and no automatic bunny hopping');


  await page.keyboard.down('w');
  await advance(0.05);
  await page.keyboard.up('w');
  let shortJumpTop = (await snapshot()).player.y;
  for (let i = 0; i < 50; i++) {
    const sample = await snapshot();
    shortJumpTop = Math.min(shortJumpTop, sample.player.y);
    if (sample.player.grounded) break;
    await advance(1 / 60);
  }
  assert((await snapshot()).player.grounded);
  await page.keyboard.down('w');
  await advance(0.4);
  state = await snapshot();
  assert(state.player.y < shortJumpTop - 20, 'Holding jump must rise higher than an early key release');
  await page.keyboard.up('w');
  for (let i = 0; i < 60; i++) {
    state = await snapshot();
    if (!state.player.grounded && state.player.vy > 0 && state.player.y >= 246) break;
    await advance(1 / 60);
  }
  assert(!state.player.grounded && state.player.vy > 0);
  await page.keyboard.down('ArrowUp');
  state = await snapshot();
  assert(!state.player.grounded && state.player.jumpBuffer > 0, 'Jump pressed just before landing is buffered in the air');
  await advance(0.12);
  state = await snapshot();
  assert(!state.player.grounded && state.player.vy < 0 && state.player.y < 270, 'Buffered jump must launch immediately after landing');
  await page.keyboard.up('ArrowUp');
  await advance(1);
  assert((await snapshot()).player.grounded);
  log('Tap/hold variable jump height and a native Up press buffered just before landing');

  await page.keyboard.down('s');
  await advance(0.1);
  assert((await snapshot()).player.crouching);
  const duckX = (await snapshot()).player.x;
  await page.keyboard.down('d');
  await advance(0.4);
  state = await snapshot();
  assert(state.player.crouching && Math.abs(state.player.vx) <= 65.01);
  assert(state.player.x - duckX < 30);
  await shot('16-crouch-and-aim.png');
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  await advance(0.3);
  await page.keyboard.down('ArrowDown');
  await advance(0.1);
  assert((await snapshot()).player.crouching);
  await page.keyboard.up('ArrowDown');
  await advance(0.1);
  assert(!(await snapshot()).player.crouching);
  log('S and Down crouch, with slower directional movement');

  await page.keyboard.down('a');
  await advance(10);
  await page.keyboard.up('a');
  await advance(0.3);
  assert.equal((await snapshot()).player.x, 58);
  await page.keyboard.press('e');
  assert(!(await snapshot()).lidOpen, 'Out-of-range E cannot open the hatch');
  await page.keyboard.down('d');
  await advance(10);
  await page.keyboard.up('d');
  await advance(0.3);
  assert.equal((await snapshot()).player.x, 1042);
  assert.equal((await snapshot()).player.y, 278);
  assert.deepEqual((await snapshot()).materials, spawn.materials);
  log('World boundaries, outside-only ground, spatial interaction guard, and unchanged material ledger');

  await travel(745);
  await page.keyboard.press('e');
  assert((await snapshot()).lidOpen);
  await page.keyboard.press('e');
  await advance(0.1);
  assert.equal((await snapshot()).stage, 'SCUM');
  assert(inputsReleased(await snapshot()));
  await shot('17-context-interaction.png');
  log('Nearby E context opens the hatch and connects the hose through normal stage guards');


  // Clicking a gameplay control should hand movement straight back to the
  // arena; the player must not have to click the canvas to unstick WASD.
  for (const selector of ['#interact', '#activate', '[data-tool="vacuum"]']) {
    await page.locator(selector).click();
    assert(await page.locator('#scene').evaluate(canvas => document.activeElement === canvas), `${selector} must return focus to the arena`);
    const beforeButtonMove = (await snapshot()).player.x;
    await page.keyboard.down('d');
    await advance(0.15);
    assert((await snapshot()).player.x > beforeButtonMove + 5, `D should work immediately after clicking ${selector}`);
    await page.keyboard.up('d');
    await advance(0.3);
  }
  log('Clicked context, tool-use, and toolbelt controls immediately return WASD focus to the arena');

  await focus();
  await page.keyboard.down('d');
  await advance(0.15);
  assert((await snapshot()).player.input.right);
  await setAdvanced(true);
  await page.locator('#throttle').focus();
  assert(inputsReleased(await snapshot()), 'Native control focus releases held movement');
  await page.keyboard.up('d');
  await advance(0.3);
  const nativeX = (await snapshot()).player.x;
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('w');
  await page.keyboard.press('a');
  await advance(0.3);
  assert.equal((await snapshot()).player.x, nativeX);
  assert((await snapshot()).player.grounded && inputsReleased(await snapshot()));
  await page.locator('#target').focus();
  await page.keyboard.press('ArrowDown');
  await advance(0.2);
  assert.equal((await snapshot()).player.x, nativeX);
  await page.locator('#target').selectOption('surface');
  await setAdvanced(false);
  await focus();
  await page.keyboard.press('q');
  assert.equal((await snapshot()).target, 'surface');
  log('Sliders/selects keep native arrows and letters; Q aims without walking');

  await travel(745);
  await focus();
  await page.keyboard.press('Space');
  await advance(0.3);
  assert((await snapshot()).active);
  await page.keyboard.down('a');
  assert(!(await snapshot()).active, 'Walking immediately stops the active tool');
  const beforeWalk = (await snapshot()).materials;
  await advance(0.2);
  assert.deepEqual((await snapshot()).materials, beforeWalk);
  await page.keyboard.press('Space');
  state = await snapshot();
  assert(state.active && state.player.vx === 0 && inputsReleased(state), 'Space brakes the worker before firing without a dead press');
  await page.keyboard.up('a');
  await advance(0.3);
  assert((await snapshot()).materials.S < beforeWalk.S);
  await page.keyboard.press('Space');
  log('Walking stops work; Space brakes and fires immediately from a valid station');

  const canvasBounds = await page.locator('#scene').boundingBox();
  assert(canvasBounds);
  const aimX = canvasBounds.x + canvasBounds.width * 510 / 1100;
  const aimY = canvasBounds.y + canvasBounds.height * 405 / 660;
  await page.mouse.click(aimX, aimY);
  state = await snapshot();
  assert(state.active && state.target === 'surface', 'Clicking the floating layer aims and starts the tool');
  const clickScum = state.materials.S;
  await advance(0.3);
  assert((await snapshot()).materials.S < clickScum);
  await shot('18-direct-tool-aim.png');
  await page.mouse.click(aimX, aimY);
  assert(!(await snapshot()).active, 'Clicking the same active target stops the tool');
  log('Mouse click aims and fires in the scene; a second click stops the active target');

  await page.keyboard.down('d');
  await advance(0.1);
  await page.keyboard.press('Escape');
  state = await snapshot();
  assert(state.paused && !state.active && inputsReleased(state));
  const pausedPlayer = state.player;
  const pausedTick = state.tick;
  await advance(5);
  assert.equal((await snapshot()).tick, pausedTick);
  assert.deepEqual((await snapshot()).player, pausedPlayer);
  await page.keyboard.up('d');
  await page.locator('#resume').click();
  await advance(0.5);
  assert(inputsReleased(await snapshot()));
  assert.equal((await snapshot()).player.x, pausedPlayer.x);
  log('Pause freezes physics and resumes with every direction released');

  await focus();
  await page.keyboard.down('a');
  await advance(0.1);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert((await snapshot()).paused && inputsReleased(await snapshot()));
  await page.keyboard.up('a');
  await page.locator('#resume').click();
  await advance(0.2);
  await focus();
  await page.keyboard.down('d');
  await advance(0.1);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert((await snapshot()).paused && inputsReleased(await snapshot()));
  await page.keyboard.up('d');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.locator('#resume').click();
  log('Emulated blur and hidden-tab events release movement and require explicit resume');

  await focus();
  await page.keyboard.press('Escape');
  await page.locator('#restart').click();
  await page.locator('#confirm-restart').click();
  state = await snapshot();
  assert.equal(state.stage, 'SETUP');
  assert.equal(state.player.x, 650);
  assert.equal(state.player.y, 278);
  assert.equal(state.player.vx, 0);
  assert.equal(state.player.vy, 0);
  assert(state.player.grounded && !state.player.crouching && inputsReleased(state));
  assert.deepEqual(state.materials, spawn.materials);
  assert.equal(state.fees.length, 0);
  log('Confirmed restart restores spawn, physics, inputs, tools, and material accounts');

  assert.deepEqual(errors, []);
  log('No uncaught browser exceptions or console errors');
  await rm(new URL('movement-browser-failure.json', evidenceDir), { force: true });
  await writeFile(new URL('movement-browser-report.json', evidenceDir), JSON.stringify({
    generatedAt: new Date().toISOString(), checks, failures, errors,
    method: 'Real WASD/arrows/E/Space/Q key events and visible native controls; fixed-step time acceleration only; focus/visibility handlers explicitly emulated.',
  }, null, 2));
} catch (error) {
  failures.push(String(error));
  await writeFile(new URL('movement-browser-failure.json', evidenceDir), JSON.stringify({ checks, failures }, null, 2));
  throw error;
} finally {
  await browser?.close();
  if (server) server.kill('SIGTERM');
}
