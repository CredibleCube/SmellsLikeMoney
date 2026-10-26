import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173';
const evidenceDir = new URL('../evidence/', import.meta.url);
await mkdir(evidenceDir, { recursive: true });
const checks = [];
const failures = [];
let browser;
let server;
const log = (name, detail = '') => { checks.push({ name, detail }); console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function reachable() { try { return (await fetch(baseURL)).ok; } catch { return false; } }
if (!(await reachable())) {
  server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
    cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, npm_config_cache: '/tmp/smells-npm-cache' },
  });
  let output = '';
  server.stdout.on('data', data => { output += data; });
  server.stderr.on('data', data => { output += data; });
  for (let i = 0; i < 100 && !(await reachable()); i++) await delay(100);
  assert(await reachable(), `Vite failed to start: ${output}`);
}
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
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
  const key = async name => { await focus(); await page.keyboard.press(name); };
  const click = selector => page.locator(selector).click();
  const shot = name => page.screenshot({ path: new URL(name, evidenceDir).pathname, fullPage: true, animations: 'disabled' });
  const fire = async () => { if (!(await snapshot()).active) await key('Space'); };
  const stop = async () => { if ((await snapshot()).active) await key('Space'); };
  const tool = async name => { if ((await snapshot()).tool !== name) await click(`[data-tool="${name}"]`); };
  const travel = async destination => {
    await stop(); await focus();
    const start = await snapshot();
    const name = destination > start.player.x ? 'd' : 'a';
    await page.keyboard.down(name);
    for (let i = 0; i < 150; i++) {
      const state = await snapshot();
      if (Math.abs(state.player.x - destination) <= 16 || (destination - start.player.x) * (destination - state.player.x) < 0) break;
      await advance(0.05);
    }
    await page.keyboard.up(name);
    await advance(0.25);
    assert(Math.abs((await snapshot()).player.x - destination) <= 35);
  };
  let aimActions = 0;
  const sweepIfEmpty = async state => {
    if (!state.active) return;
    const col = state.work.aim.column;
    const local = state.tool === 'mixer' ? state.work.settled[col]
      : state.tool === 'vacuum' && state.stage === 'SCUM' ? state.work.scum[col]
      : state.tool === 'vacuum' && ['SLURRY','WASH','FINAL_PUMP'].includes(state.stage) ? state.work.suspended[col] : null;
    if (local !== null && local <= 1e-6) { await key('q'); aimActions++; }
  };
  const until = async (predicate, limit = 300, batch = 0.25, sweep = false) => {
    for (let time = 0; time < limit; time += batch) {
      const state = await snapshot();
      if (predicate(state)) return state;
      if (sweep) await sweepIfEmpty(state);
      await advance(batch);
    }
    throw new Error(`Timeout: ${JSON.stringify(await snapshot())}`);
  };
  const point = async (x, y, action = 'move') => {
    const box = await page.locator('#scene').boundingBox();
    assert(box);
    const px = box.x + box.width * x / 1100;
    const py = box.y + box.height * y / 660;
    if (action === 'click') await page.mouse.click(px, py);
    else await page.mouse.move(px, py);
    await advance(0); // Flush the real queued pointer event through the shared input path.
  };

  await click('[data-fixture="normal"]');
  await focus();
  const initial = await snapshot();
  // Jumping is optional and produces unpriced score, never bulk material or fees.
  for (const destination of [650, 180, 1000]) {
    await travel(destination);
    await page.keyboard.down('w');
    await advance(0.2);
    if (destination === 650) await shot('20-crew-bolt-jump.png');
    await advance(0.2);
    await page.keyboard.up('w');
    await advance(0.6);
  }
  let state = await snapshot();
  assert(state.work.collectibles.every(Boolean));
  assert(state.work.score >= 600);
  const pickupScore = state.work.score;
  await page.keyboard.down('w'); await advance(0.4); await page.keyboard.up('w'); await advance(0.6);
  assert.equal((await snapshot()).work.score, pickupScore);
  assert.deepEqual((await snapshot()).materials, initial.materials);
  assert.equal((await snapshot()).fees.length, 0);
  log('Three optional jump bolts award unique score without material or invoice changes');

  await travel(745);
  await key('e'); await key('e'); await advance(0.1);
  assert.equal((await snapshot()).stage, 'SCUM');
  const compact = [];
  for (const selector of ['#scene', '#interact', '#activate', '[data-tool="hose"]']) {
    const box = await page.locator(selector).boundingBox();
    assert(box && box.y >= 0 && box.y + box.height <= 901, `${selector} must fit the 1440×900 default play view: ${JSON.stringify(box)}`);
    compact.push({ selector, ...box });
  }
  if (await page.locator('#advanced-controls').count()) assert(!(await page.locator('#advanced-controls').evaluate(element => element.open)));
  log('Scene, context action, tool-use button, and toolbelt fit the default desktop view');
  await fire();
  const firstColumn = (await snapshot()).work.aim.column;
  await until(s => s.work.scum[firstColumn] <= 1e-6, 10, 0.05);
  const exhausted = await snapshot();
  await advance(0.5);
  state = await snapshot();
  assert.equal(state.materials.S, exhausted.materials.S);
  assert.equal(state.flow, 0);
  assert(state.active && state.work.scum.filter(n => n > 1e-6).length === 3);
  await shot('19-active-cleanup-hud.png');
  log('A fixed suction spot exhausts locally and cannot clear the other three skum pockets');
  await stop();
  await key('e'); await advance(2.1);
  assert.equal((await snapshot()).wipes.status, 'disposed');
  await tool('vacuum');
  const beforeQ = (await snapshot()).work.aim.column;
  await key('q');
  assert.notEqual((await snapshot()).work.aim.column, beforeQ);
  await fire();
  const beforeLocal = await snapshot();
  await advance(0.3);
  state = await snapshot();
  const aimedColumn = beforeLocal.work.aim.column;
  assert(state.work.scum[aimedColumn] < beforeLocal.work.scum[aimedColumn]);
  beforeLocal.work.scum.forEach((amount, column) => { if (column !== aimedColumn) assert.equal(state.work.scum[column], amount); });
  log('Q changes the aimed dirty pocket; vacuum changes only that local pocket');

  const normalFlow = state.flow;
  await page.keyboard.down('Shift');
  assert((await snapshot()).work.boost);
  await advance(0.25);
  state = await snapshot();
  assert(state.flow > normalFlow * 1.4 && state.heat > 0);
  await advance(0.9);
  const boostColumn = (await snapshot()).work.aim.column;
  await key('q');
  state = await snapshot();
  assert(state.active && state.work.boost && state.work.aim.column !== boostColumn, 'Aiming while Shift is held must preserve active boosted work');
  const beforeNextButton = state.work.aim.column;
  await click('#next-spot');
  state = await snapshot();
  assert(state.active && state.work.boost && state.work.aim.column !== beforeNextButton, 'The next-spot button preserves active boosted work');
  await advance(1.05);
  state = await snapshot();
  assert(state.bogged && state.work.bogs >= 1 && state.flow < normalFlow * 0.7);
  await shot('21-boost-and-bog.png');
  await page.keyboard.up('Shift');
  assert(!(await snapshot()).work.boost);
  await stop(); await advance(3);
  assert(!(await snapshot()).bogged);
  const boostButton = page.locator('#boost');
  await boostButton.click(); assert((await snapshot()).work.boost);
  await boostButton.click(); assert(!(await snapshot()).work.boost);
  const advanced = page.locator('#advanced-controls');
  if (await advanced.count() && !(await advanced.evaluate(element => element.open))) await advanced.locator('summary').click();
  await boostButton.click(); assert((await snapshot()).work.boost);
  await page.locator('#throttle').focus();
  assert(!(await snapshot()).work.boost, 'Native slider focus releases the latched boost');
  if (await advanced.count() && await advanced.evaluate(element => element.open)) await advanced.locator('summary').click();
  await focus();
  log('Held Shift and button boost increase flow, build heat, bog recoverably, and release without a stuck boost');

  await tool('vacuum'); await fire();
  await until(s => s.stage === 'INLET', 100, 0.25, true);
  await travel(925); await key('e'); await key('e');
  await until(s => s.stage === 'DRAWDOWN', 12, 0.1);
  await travel(745); await tool('vacuum'); await fire();
  await until(s => s.materials.W <= 340, 80, 0.25); await stop();
  await key('e'); assert.equal((await snapshot()).stage, 'MIX');
  await fire(); await until(s => s.stage === 'SLURRY', 80, 0.25, true);
  await fire(); await until(s => s.stage === 'WASH', 150, 0.25, true);

  await tool('hose');
  await point(210, 395, 'click');
  state = await snapshot(); assert(state.active && state.target === 'wall0' && state.work.aim.patch === 0);
  const wallBefore = structuredClone(state.work.wallPatches);
  await advance(0.25);
  state = await snapshot();
  assert(state.work.wallPatches[0][0] < wallBefore[0][0]);
  assert.equal(state.work.wallPatches[0][1], wallBefore[0][1]);
  await point(210, 455);
  state = await snapshot(); assert(state.active && state.work.aim.patch === 1);
  const firstPatchLeft = state.work.wallPatches[0][0];
  await advance(0.25);
  state = await snapshot();
  assert(state.work.wallPatches[0][1] < wallBefore[0][1]);
  assert.equal(state.work.wallPatches[0][0], firstPatchLeft);
  await point(210, 515);
  await advance(0.25);
  state = await snapshot();
  assert(state.active && state.work.aim.patch === 2 && state.work.wallPatches[0][2] < wallBefore[0][2]);
  for (let wall = 1; wall < 4; wall++) assert.deepEqual(state.work.wallPatches[wall], wallBefore[wall]);
  await shot('22-local-wall-cleaning.png');
  log('Continuous pointer aiming moves active spray across three local wall patches without cleaning neighboring walls');
  await point(210, 395);
  await until(s => s.work.wallPatches[0][0] <= 1e-6, 2, 0.05);
  const clearedScore = (await snapshot()).work.score;
  const clearCount = (await snapshot()).work.cleared.filter(key => key === 'wall-0-0').length;
  assert.equal(clearCount, 1);
  await advance(0.3);
  assert.equal((await snapshot()).work.score, clearedScore);
  assert.equal((await snapshot()).work.cleared.filter(key => key === 'wall-0-0').length, 1);
  log('Cleared-patch points are awarded once; spraying a clean patch cannot farm score');

  for (let wall = 0; wall < 4; wall++) {
    for (let patch = 0; patch < 3; patch++) {
      if ((await snapshot()).work.wallPatches[wall][patch] <= 1e-6) continue;
      const x = wall < 2 ? wall === 0 ? 210 : 921 : (wall === 2 ? 220 : 572) + (patch + 0.5) * 340 / 3;
      const y = wall < 2 ? 365 + (patch + 0.5) * 60 : 552;
      await point(x, y);
      await fire();
      await until(s => s.work.wallPatches[wall][patch] <= 1e-6, 3, 0.05);
    }
  }
  await stop(); await tool('vacuum'); await fire();
  await until(s => s.stage === 'CLEANUP', 80, 0.25, true);
  await travel(495); await key('e'); await travel(745); await key('e'); await key('e');
  const final = await snapshot();
  assert.equal(final.stage, 'INVOICE');
  assert.equal(final.fees.reduce((sum, fee) => sum + fee.amount, 0), 575);
  assert(final.work.score > pickupScore && final.work.bestCombo >= 2);
  assert.equal(new Set(final.work.cleared).size, final.work.cleared.length);
  await shot('23-arcade-invoice.png');
  log('Active aiming, boosts, pickups, and patch combos finish at an unchanged 575-credit invoice', `${final.elapsed.toFixed(1)} active seconds; ${final.work.score} unpriced points; ${aimActions} keyboard aim changes`);
  assert.deepEqual(errors, []);
  log('No uncaught browser exceptions or console errors');
  await rm(new URL('arcade-browser-failure.json', evidenceDir), { force: true });
  await writeFile(new URL('arcade-browser-report.json', evidenceDir), JSON.stringify({
    generatedAt: new Date().toISOString(), checks, failures, errors, compact,
    method: 'Native WASD/Shift/Q/Space/E and real pointer movement; read-only snapshots; development bridge advances fixed simulation time and asserts ledgers every tick.',
    final: { elapsed: final.elapsed, score: final.work.score, bestCombo: final.work.bestCombo, aimActions, fees: final.fees, materials: final.materials },
  }, null, 2));
} catch (error) {
  failures.push(String(error));
  await writeFile(new URL('arcade-browser-failure.json', evidenceDir), JSON.stringify({ checks, failures }, null, 2));
  throw error;
} finally {
  await browser?.close();
  if (server) server.kill('SIGTERM');
}
