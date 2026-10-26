import { describe, expect, it } from 'vitest';
import { ARCADE, CONFIG } from '../src/config';
import { createJob } from '../src/fixtures';
import { actionReason, command, commandReason, getContextAction } from '../src/commands';
import { assertInvariants, step, wallTotal } from '../src/simulation';
import { invoiceTotal } from '../src/events';
import { awardWork, createWork, hotspots, materialSpots, wallSpots, workSpot } from '../src/work';
import type { Command, JobState, Materials, Target } from '../src/types';

function send(state: JobState, input: Command): boolean {
  const result = command(state, input);
  assertInvariants(state);
  return result;
}
function ticks(state: JobState, count: number): void {
  for (let tick = 0; tick < count; tick++) { step(state); assertInvariants(state); }
}
function start(): JobState {
  const state = createJob();
  expect(send(state, { type: 'start' })).toBe(true);
  expect(send(state, { type: 'interact' })).toBe(true);
  expect(send(state, { type: 'interact' })).toBe(true);
  ticks(state, 1);
  expect(state.stage).toBe('SCUM');
  return state;
}
/** Edge-fixture construction only: retained truck accounts close both ledgers. */
function accounts(state: JobState, edits: Partial<Materials>): void {
  Object.assign(state.materials, edits);
  const m = state.materials;
  m.CW = 550 + m.A - m.W - m.PW;
  m.CS = 290 - m.S - m.U - m.M - wallTotal(state) - m.PS;
  state.work = createWork(m);
  assertInvariants(state);
}
function begin(state: JobState, target?: Target): void {
  if (target) expect(send(state, { type: 'selectTarget', target })).toBe(true);
  expect(actionReason(state)).toBeNull();
  expect(send(state, { type: 'toggleActive' })).toBe(true);
}
function aim(state: JobState, x: number, y: number): void {
  expect(send(state, { type: 'aim', x, y })).toBe(true);
}
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('spatial cleanup partitions', () => {
  it('creates finite patches whose sums exactly project into every bulk source', () => {
    const state = createJob();
    expect(state.work.scum).toEqual([20, 20, 20, 20]);
    expect(state.work.settled).toEqual([40, 40, 40, 40]);
    expect(state.work.suspended).toEqual([0, 0, 0, 0]);
    expect(state.work.wallPatches).toHaveLength(4);
    expect(state.work.wallPatches.every(parts => parts.length === 3)).toBe(true);
    expect(sum(state.work.scum)).toBe(state.materials.S);
    expect(sum(state.work.settled)).toBe(state.materials.U);
    expect(sum(state.work.suspended)).toBe(state.materials.M);
    state.work.wallPatches.forEach((parts, index) => expect(sum(parts)).toBe(state.materials.walls[index]));
    assertInvariants(state);
  });

  it('rejects a partition mismatch, nonfinite patch, and negative patch rather than resetting materials', () => {
    for (const mutate of [
      (s: JobState) => { s.work.scum[0] += 1; },
      (s: JobState) => { s.work.suspended[0] = Number.NaN; },
      (s: JobState) => { s.work.wallPatches[0][0] = -1; },
    ]) {
      const state = createJob(); mutate(state);
      expect(() => assertInvariants(state)).toThrow();
    }
  });

  it('free aiming selects a generous local pocket and only that pocket loses skum', () => {
    const state = start();
    aim(state, 700, 430); // Any depth projects onto the proper skum intake band.
    expect(state.target).toBe('surface');
    const selected = state.work.aim.column;
    const before = [...state.work.scum];
    begin(state);
    ticks(state, 30);
    expect(state.work.scum[selected]).toBeLessThan(before[selected]);
    state.work.scum.forEach((amount, index) => { if (index !== selected) expect(amount).toBe(before[index]); });
    expect(sum(state.work.scum)).toBeCloseTo(state.materials.S, 10);
    expect(state.materials.CS).toBeCloseTo(80 - state.materials.S, 9);
  });

  it('an empty pocket retains active input with zero flow until aiming at a live pocket', () => {
    const state = start();
    state.wipes.status = 'disposed'; state.wipes.disposed = state.wipes.count;
    begin(state);
    ticks(state, 300);
    expect(state.stage).toBe('SCUM');
    expect(state.work.scum[0]).toBe(0);
    expect(state.active).toBe(true);
    expect(state.flow).toBe(0);
    const materialBefore = structuredClone(state.materials);
    ticks(state, 60);
    expect(state.materials).toEqual(materialBefore);
    const scoreBefore = state.work.score;
    expect(getContextAction(state).command.type).toBe('aimNext');
    expect(send(state, { type: 'interact' })).toBe(true);
    expect(state.active).toBe(true);
    const spot = workSpot(state);
    expect(spot.remaining).toBeGreaterThan(0);
    ticks(state, 1);
    expect(state.flow).toBeGreaterThan(0);
    expect(state.materials.S).toBeLessThan(materialBefore.S);
    expect(state.work.score).toBe(scoreBefore);
  });

  it('prioritizes stopping for the wipe warning over moving on from the first empty pocket', () => {
    const state = start(); begin(state);
    let elapsedTicks = 0;
    while (state.work.scum[0] > CONFIG.epsilon && elapsedTicks++ < 600) ticks(state, 1);
    expect(state.work.scum[0]).toBeLessThanOrEqual(CONFIG.epsilon);
    expect(state.wipes.status).toBe('approaching');
    expect(state.active).toBe(true);
    expect(getContextAction(state).command.type).toBe('stop');
    expect(send(state, { type: 'interact' })).toBe(true);
    expect(state.active).toBe(false);
    expect(getContextAction(state).label).toMatch(/remove wipes/i);
    expect(send(state, { type: 'interact' })).toBe(true);
    expect(state.tool).toBe('wipes');
    ticks(state, Math.ceil(CONFIG.wipeRemoveSeconds / CONFIG.step) + 1);
    expect(state.wipes.status).toBe('disposed');
    expect(state.work.clogs).toBe(0);
    expect(state.fees.filter(fee => fee.key === 'excess_wipes')).toHaveLength(1);
  });

  it('moving the reticle while working preserves activity and changes the actual source', () => {
    const state = start();
    begin(state);
    ticks(state, 10);
    const first = state.work.aim.column;
    const before = [...state.work.scum];
    aim(state, 850, 500);
    const second = state.work.aim.column;
    expect(second).not.toBe(first);
    expect(state.active).toBe(true);
    ticks(state, 10);
    expect(state.work.scum[first]).toBe(before[first]);
    expect(state.work.scum[second]).toBeLessThan(before[second]);
  });

  it('an explicitly invalid target remains visible and cannot bypass the shared tool guard', () => {
    const state = start();
    expect(send(state, { type: 'selectTarget', target: 'inlet' })).toBe(true);
    expect(state.target).toBe('inlet');
    expect(actionReason(state)).toMatch(/floating|surface|skum/i);
    const before = structuredClone(state.materials);
    expect(send(state, { type: 'toggleActive' })).toBe(false);
    ticks(state, 60);
    expect(state.materials).toEqual(before);
    expect(state.active).toBe(false);
    // Deliberate keyboard aiming is allowed to return to a valid intake.
    expect(send(state, { type: 'aimNext' })).toBe(true);
    expect(state.target).toBe('surface');
    begin(state); ticks(state, 1);
    expect(state.materials.S).toBeLessThan(before.S);
  });

  it('the valid bottom alias pumps the selected nonempty slurry cloud rather than a fallback empty column', () => {
    const state = start(); state.stage = 'SLURRY';
    accounts(state, { W: 300, M: 100, U: 0.4, S: 0.9 });
    state.work.suspended = [0, 0, 40, 60];
    assertInvariants(state);
    send(state, { type: 'selectTool', tool: 'vacuum' });
    expect(send(state, { type: 'selectTarget', target: 'bottom' })).toBe(true);
    expect(state.target).toBe('bottom');
    expect(state.work.aim.column).toBe(2);
    expect(workSpot(state)).toMatchObject({ kind: 'suspended', column: 2, remaining: 40 });
    const clouds = [...state.work.suspended];
    const before = structuredClone(state.materials);
    begin(state); ticks(state, 60);
    expect(state.flow).toBeGreaterThan(0);
    expect(state.work.suspended[2]).toBeLessThan(clouds[2]);
    expect(state.work.suspended[0]).toBe(0);
    expect(state.work.suspended[1]).toBe(0);
    expect(state.work.suspended[3]).toBe(clouds[3]);
    expect(before.M - state.materials.M).toBeCloseTo(clouds[2] - state.work.suspended[2], 9);
    expect(state.materials.W / state.materials.M).toBeCloseTo(3, 9);
    expect(state.materials.U).toBe(before.U);
  });

  it('mixing transfers a local settled clump into its matching suspended cloud, never directly to the truck', () => {
    const state = start();
    state.stage = 'MIX';
    send(state, { type: 'selectTool', tool: 'mixer' });
    aim(state, 700, 540);
    const column = state.work.aim.column;
    const before = structuredClone(state.materials);
    const settled = [...state.work.settled];
    begin(state);
    ticks(state, 60);
    expect(state.work.settled[column]).toBeCloseTo(settled[column] - CONFIG.mixRate, 8);
    expect(state.work.suspended[column]).toBeCloseTo(CONFIG.mixRate, 8);
    expect(state.materials.U).toBeCloseTo(before.U - CONFIG.mixRate, 8);
    expect(state.materials.M).toBeCloseTo(before.M + CONFIG.mixRate, 8);
    expect(state.materials.CW).toBe(before.CW);
    expect(state.materials.CS).toBe(before.CS);
  });

  it('local slurry exhaustion preserves the global water:solids ratio and can resume on another cloud', () => {
    const state = start();
    state.stage = 'SLURRY';
    accounts(state, { W: 300, M: 100, U: 0.4, S: 0.9 });
    send(state, { type: 'selectTool', tool: 'vacuum' });
    aim(state, 280, 440);
    begin(state);
    ticks(state, 1100);
    expect(state.work.suspended[0]).toBe(0);
    expect(state.active).toBe(true);
    expect(state.flow).toBe(0);
    expect(state.materials.M).toBeCloseTo(75, 8);
    expect(state.materials.W / state.materials.M).toBeCloseTo(3, 9);
    expect(state.materials.U).toBe(0.4);
    const oldWater = state.materials.W;
    send(state, { type: 'aimNext' }); ticks(state, 60);
    expect(state.materials.W).toBeLessThan(oldWater);
    expect(state.materials.W / state.materials.M).toBeCloseTo(3, 9);
  });

  it('washing removes one wall patch, adds metered water, and suspends all loosened residue', () => {
    const state = start(); state.stage = 'WASH';
    accounts(state, { W: 100, S: 0.9, U: 0.4, M: 20 });
    send(state, { type: 'selectTool', tool: 'hose' });
    const spot = wallSpots(state).find(value => value.target === 'wall0' && value.patch === 1)!;
    aim(state, spot.x, spot.y);
    const before = structuredClone(state.materials);
    const patches = structuredClone(state.work.wallPatches);
    const clouds = [...state.work.suspended];
    begin(state);
    ticks(state, 30);
    expect(state.work.wallPatches[0][1]).toBeCloseTo(patches[0][1] - CONFIG.washRate * 0.5, 8);
    expect(state.work.wallPatches[0][0]).toBe(patches[0][0]);
    expect(state.work.wallPatches[0][2]).toBe(patches[0][2]);
    expect(state.work.suspended[spot.column]).toBeCloseTo(clouds[spot.column] + CONFIG.washRate * 0.5, 8);
    expect(state.materials.M - before.M).toBeCloseTo(CONFIG.washRate * 0.5, 8);
    expect(state.materials.A - before.A).toBeCloseTo(CONFIG.hoseRate * 0.5, 8);
    expect(state.materials.W - before.W).toBeCloseTo(CONFIG.hoseRate * 0.5, 8);
  });

  it.each(['WASH', 'FINAL_PUMP'] as const)('explicit water filling in %s never silently selects a dirty wall', stage => {
    const state = start(); state.stage = stage;
    accounts(state, { W: 1, M: 4, U: 0.4, S: 0.9 });
    send(state, { type: 'selectTool', tool: 'hose' });
    send(state, { type: 'selectTarget', target: 'liquid' });
    expect(state.target).toBe('liquid');
    expect(workSpot(state).kind).toBe('water');
    const before = structuredClone(state.materials);
    begin(state); ticks(state, 60);
    expect(state.materials.W - before.W).toBeCloseTo(CONFIG.hoseRate, 8);
    expect(state.materials.A - before.A).toBeCloseTo(CONFIG.hoseRate, 8);
    expect(state.materials.M).toBe(before.M);
    expect(state.materials.walls).toEqual(before.walls);
  });

  it('keyboard next/reverse aiming reaches every wall patch and never uses random targets', () => {
    const state = start(); state.stage = 'WASH';
    send(state, { type: 'selectTool', tool: 'hose' });
    const startKey = workSpot(state).key;
    const visited = new Set([startKey]);
    for (let i = 0; i < 11; i++) { send(state, { type: 'aimNext' }); visited.add(workSpot(state).key); }
    expect(visited.size).toBe(12);
    send(state, { type: 'aimNext' }); expect(workSpot(state).key).toBe(startKey);
    send(state, { type: 'aimNext', reverse: true });
    expect(workSpot(state).key).toBe(wallSpots(state).at(-1)!.key);
    expect(hotspots(state)).toHaveLength(12);
  });

  it('refuses nonfinite aiming and clamps outside coordinates into safe, finite work targets', () => {
    const state = start();
    for (const input of [
      { type: 'aim', x: Number.NaN, y: 400 },
      { type: 'aim', x: 400, y: Number.POSITIVE_INFINITY },
    ] as Command[]) {
      expect(commandReason(state, input)).not.toBeNull();
      expect(send(state, input)).toBe(false);
    }
    aim(state, -10000, 10000);
    expect(Number.isFinite(state.work.aim.x)).toBe(true);
    expect(state.work.aim.column).toBe(0);
    expect(state.work.aim.x).toBeGreaterThanOrEqual(196);
    aim(state, 10000, -10000);
    expect(state.work.aim.column).toBe(3);
    expect(state.work.aim.x).toBeLessThanOrEqual(934);
  });
});

describe('useful context and recovery choices', () => {
  it('E pumps above the mixing band, fills below the minimum, and continues from a healthy band', () => {
    const state = start(); state.stage = 'DRAWDOWN';
    send(state, { type: 'selectTool', tool: 'vacuum' });
    expect(getContextAction(state).command.type).toBe('toggleActive');
    expect(getContextAction(state).label).toMatch(/draw|pump|vacuum/i);
    expect(send(state, { type: 'interact' })).toBe(true);
    expect(state.active).toBe(true);
    expect(state.tool).toBe('vacuum');
    send(state, { type: 'stop' });
    accounts(state, { W: 40 });
    expect(getContextAction(state).label).toMatch(/water|fill/i);
    expect(send(state, { type: 'interact' })).toBe(true);
    expect(state.active).toBe(true);
    expect(state.tool).toBe('hose');
    ticks(state, 60);
    expect(state.materials.W).toBeGreaterThan(40);
    send(state, { type: 'stop' });
    accounts(state, { W: 320 });
    expect(getContextAction(state).command.type).toBe('continueMix');
    expect(send(state, { type: 'interact' })).toBe(true);
    expect(state.stage).toBe('MIX');
  });
});

describe('optional pressure and finite arcade rewards', () => {
  it('boost increases flow and load without changing conservation, then releases on movement or pause', () => {
    const state = start(); begin(state); ticks(state, 1);
    const baseline = state.flow;
    const baselineLoad = state.load;
    expect(send(state, { type: 'setBoost', pressed: true })).toBe(true);
    ticks(state, 1);
    expect(state.flow).toBeCloseTo(baseline * ARCADE.boostFlow, 8);
    expect(state.load).toBeCloseTo(baselineLoad * ARCADE.boostLoad, 8);
    send(state, { type: 'move', direction: 'right', pressed: true });
    expect(state.active).toBe(false);
    expect(state.work.boost).toBe(false);
    send(state, { type: 'move', direction: 'right', pressed: false });
    ticks(state, 30);
    begin(state); send(state, { type: 'setBoost', pressed: true });
    send(state, { type: 'pause' });
    expect(state.work.boost).toBe(false);
    expect(send(state, { type: 'setBoost', pressed: true })).toBe(false);
    expect(send(state, { type: 'setBoost', pressed: false })).toBe(true);
  });

  it('a held boost can heat and bog the pump, and stopping recovers every material account intact', () => {
    const state = start(); begin(state);
    send(state, { type: 'setBoost', pressed: true });
    ticks(state, 125);
    expect(state.bogged).toBe(true);
    expect(state.work.bogs).toBe(1);
    const score = state.work.score;
    send(state, { type: 'stop' });
    const before = structuredClone(state.materials);
    ticks(state, 240);
    expect(state.bogged).toBe(false);
    expect(state.heat).toBe(0);
    expect(state.materials).toEqual(before);
    expect(state.work.score).toBe(score);
  });

  it('only actual first-time pocket clears score; retries and revisits cannot farm points or invoice fees', () => {
    const state = start(); state.wipes.status = 'disposed'; state.wipes.disposed = state.wipes.count;
    begin(state); ticks(state, 300);
    expect(state.work.score).toBe(ARCADE.patchPoints);
    expect(state.work.cleared).toContain('scum-0');
    const score = state.work.score;
    aim(state, 288, 400); ticks(state, 300);
    send(state, { type: 'stop' }); begin(state); ticks(state, 300);
    expect(state.work.score).toBe(score);
    expect(state.work.cleared.filter(key => key === 'scum-0')).toHaveLength(1);
    expect(invoiceTotal(state)).toBe(0);
  });

  it('chains finite unique targets within the combo window, caps combos, and expires only with active game time', () => {
    const state = start();
    for (let index = 0; index < ARCADE.comboCap + 3; index++) {
      awardWork(state, `test-${index}`, 'PATCH CLEAR', 300, 400);
      ticks(state, 10);
    }
    expect(state.work.combo).toBe(ARCADE.comboCap);
    expect(state.work.bestCombo).toBe(ARCADE.comboCap);
    const points = state.work.score;
    awardWork(state, 'test-0', 'PATCH CLEAR', 300, 400);
    expect(state.work.score).toBe(points);
    send(state, { type: 'pause' }); ticks(state, 1000); send(state, { type: 'resume' });
    awardWork(state, 'after-pause', 'PATCH CLEAR', 300, 400);
    expect(state.work.combo).toBe(ARCADE.comboCap);
    ticks(state, Math.ceil(ARCADE.comboSeconds / CONFIG.step) + 1);
    awardWork(state, 'after-window', 'PATCH CLEAR', 300, 400);
    expect(state.work.combo).toBe(1);
    expect(state.work.bestCombo).toBe(ARCADE.comboCap);
  });

  it('crew bolts require a jump, are optional, and award once without creating materials', () => {
    const state = start();
    const materials = structuredClone(state.materials);
    ticks(state, 120);
    expect(state.work.collectibles).toEqual([false, false, false]);
    send(state, { type: 'move', direction: 'up', pressed: true }); ticks(state, 30);
    expect(state.work.collectibles).toEqual([false, true, false]);
    expect(state.work.score).toBe(ARCADE.pickupPoints);
    send(state, { type: 'move', direction: 'up', pressed: false }); ticks(state, 90);
    send(state, { type: 'move', direction: 'up', pressed: true }); ticks(state, 90);
    expect(state.work.score).toBe(ARCADE.pickupPoints);
    expect(state.materials).toEqual(materials);
    expect(state.fees).toEqual([]);
    const fresh = createJob();
    expect(fresh.work).toEqual(createWork(fresh.materials));
    expect(fresh.work.score).toBe(0);
    expect(fresh.work.boost).toBe(false);
  });
});
