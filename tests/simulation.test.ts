import { describe, expect, it } from 'vitest';
import { CONFIG, WORLD } from '../src/config';
import { createJob } from '../src/fixtures';
import { command, actionReason, commandReason, getContextAction } from '../src/commands';
import { assertInvariants, finalChecks, mixingAllowed, recommendedWater, step, tankTotal, wallTotal } from '../src/simulation';
import { invoiceTotal } from '../src/events';
import { stationReason } from '../src/movement';
import type { Command, FixtureName, JobState, Materials, Target, Tool } from '../src/types';

function send(s: JobState, c: Command): boolean {
  const result = command(s, c);
  assertInvariants(s);
  return result;
}
function ticks(s: JobState, count: number): void {
  for (let i = 0; i < count; i++) {
    step(s);
    assertInvariants(s);
  }
}
function until(s: JobState, predicate: () => boolean, seconds = 900): void {
  const deadline = Math.ceil(seconds / CONFIG.step);
  for (let i = 0; i < deadline; i++) {
    if (predicate()) return;
    step(s);
    assertInvariants(s);
  }
  throw new Error(`Timed out at ${s.stage}, active=${s.active}, tool=${s.tool}, reason=${actionReason(s)}, materials=${JSON.stringify(s.materials)}`);
}
function start(fixture: FixtureName = 'normal'): JobState {
  const s = createJob(fixture);
  expect(send(s, { type: 'start' })).toBe(true);
  expect(getContextAction(s).command.type).toBe('openLid');
  expect(send(s, { type: 'interact' })).toBe(true);
  expect(getContextAction(s).command.type).toBe('connect');
  expect(send(s, { type: 'interact' })).toBe(true);
  ticks(s, 1);
  expect(s.stage).toBe('SCUM');
  return s;
}
/** Travel through the public movement commands, then settle before working. */
function walkTo(s: JobState, x: number): void {
  send(s, { type: 'stop' });
  const direction = s.player.x < x ? 'right' : 'left';
  expect(send(s, { type: 'move', direction, pressed: true })).toBe(true);
  until(s, () => direction === 'right' ? s.player.x >= x : s.player.x <= x, 10);
  expect(send(s, { type: 'move', direction, pressed: false })).toBe(true);
  ticks(s, 30);
  expect(s.player.grounded).toBe(true);
  expect(Math.abs(s.player.vx)).toBeLessThanOrEqual(5);
}
function activate(s: JobState, tool: Tool, target?: Target): void {
  send(s, { type: 'stop' });
  const station = tool === 'inlet' ? 'inlet' : 'hatch';
  if (stationReason(s, station)) walkTo(s, WORLD.stations[station].x);
  send(s, { type: 'selectTool', tool });
  if (target) send(s, { type: 'selectTarget', target });
  expect(actionReason(s)).toBeNull();
  expect(send(s, { type: 'toggleActive' })).toBe(true);
  expect(s.active).toBe(true);
}
function clearScum(s: JobState, allowClog = false): void {
  activate(s, 'vacuum', 'surface');
  until(s, () => s.wipes.status === (allowClog ? 'in_hose' : 'approaching'), 45);
  activate(s, 'wipes', 'surface');
  until(s, () => s.wipes.status === 'disposed', 4);
  activate(s, 'vacuum', 'surface');
  until(s, () => s.stage === 'INLET', 70);
}
function clearInlet(s: JobState): void {
  walkTo(s, WORLD.stations.inlet.x);
  expect(getContextAction(s).command.type).toBe('inspect');
  expect(send(s, { type: 'interact' })).toBe(true);
  expect(s.inlet.inspected).toBe(true);
  expect(send(s, { type: 'interact' })).toBe(true);
  expect(s.active).toBe(true);
  until(s, () => s.stage === 'DRAWDOWN', 15);
  expect(s.inlet.cleared).toBe(true);
  expect(s.materials.PW + s.materials.PS).toBeLessThanOrEqual(CONFIG.epsilon);
}
function complete(fixture: FixtureName, recover = false): JobState {
  const s = start(fixture);
  clearScum(s, recover);
  clearInlet(s);
  activate(s, 'vacuum', 'liquid');
  const goal = recover ? 40 : 2 * (s.materials.U + s.materials.M);
  until(s, () => s.materials.W <= goal, 300);
  send(s, { type: 'stop' });
  if (recover) {
    expect(s.materials.W).toBeLessThanOrEqual(40);
    expect(mixingAllowed(s)).toBe(false);
    expect(send(s, { type: 'continueMix' })).toBe(false);
    expect(s.stage).toBe('DRAWDOWN');
    activate(s, 'hose', 'liquid');
    until(s, () => s.materials.W >= 1.8 * (s.materials.U + s.materials.M), 120);
    send(s, { type: 'stop' });
    expect(s.materials.A).toBeGreaterThan(200);
  }
  expect(send(s, { type: 'continueMix' })).toBe(true);
  activate(s, 'mixer', 'bottom');
  until(s, () => s.stage === 'SLURRY', 100);
  expect(s.materials.U).toBeGreaterThan(0);
  expect(s.materials.U).toBeLessThanOrEqual(0.5);
  activate(s, 'vacuum', 'liquid');
  until(s, () => s.stage === 'WASH', 400);
  for (let i = 0; i < 4; i++) {
    activate(s, 'hose', `wall${i}` as Target);
    until(s, () => s.materials.walls[i] <= 0.01, 10);
  }
  activate(s, 'vacuum', 'liquid');
  until(s, () => s.stage === 'CLEANUP', 150);
  expect(s.active).toBe(false);
  expect(finalChecks(s).every(c => c.ok)).toBe(true);
  expect(send(s, { type: 'invoice' })).toBe(false);
  walkTo(s, WORLD.stations.truck.x);
  expect(getContextAction(s).command.type).toBe('stow');
  expect(send(s, { type: 'interact' })).toBe(true);
  expect(s.stowed).toBe(true);
  walkTo(s, WORLD.stations.hatch.x);
  expect(getContextAction(s).command.type).toBe('closeLid');
  expect(send(s, { type: 'interact' })).toBe(true);
  expect(s.lidClosed).toBe(true);
  expect(getContextAction(s).command.type).toBe('invoice');
  expect(send(s, { type: 'interact' })).toBe(true);
  expect(s.stage).toBe('INVOICE');
  return s;
}
/** Construct a conserved edge fixture; truck accounts retain every displaced unit. */
function accounts(s: JobState, edits: Partial<Materials>): void {
  Object.assign(s.materials, edits);
  const m = s.materials;
  m.CW = 550 + m.A - m.W - m.PW;
  m.CS = 290 - m.S - m.U - m.M - wallTotal(s) - m.PS;
  assertInvariants(s);
}


describe('complete playable jobs', () => {
  it('finishes normal seed 101 from setup to the 575-credit invoice with real completion remainders', () => {
    const s = complete('normal');
    expect(invoiceTotal(s)).toBe(575);
    expect(s.fees.map(f => f.key).sort()).toEqual(['base_service', 'excess_wipes', 'inlet_clear']);
    expect(s.wipes.disposed).toBe(5);
    expect(s.materials.S + s.materials.U).toBeGreaterThan(0);
    expect(s.materials.S + s.materials.U + s.materials.M).toBeLessThanOrEqual(2);
    expect(s.materials.W).toBeLessThanOrEqual(5);
    expect(s.materials.CW).toBeGreaterThan(400);
    expect(s.materials.CS).toBeGreaterThan(250);
  });

  it('finishes challenge seed 202 after a real clog and deliberate drain to 40, with hose-water recovery', () => {
    const s = complete('challenge', true);
    expect(invoiceTotal(s)).toBe(575);
    expect(s.wipes.disposed).toBe(8);
    expect(s.materials.A).toBeGreaterThan(200);
    expect(s.fees.filter(f => f.key === 'excess_wipes')).toHaveLength(1);
  });

  it('replays the same seed and tick-indexed decisions to exactly the same state and invoice', () => {
    expect(complete('normal')).toEqual(complete('normal'));
  });

  it('never invoices an incomplete job, and fresh replay clears all job-specific progress', () => {
    const s = start();
    expect(send(s, { type: 'invoice' })).toBe(false);
    expect(send(s, { type: 'stow' })).toBe(false);
    expect(send(s, { type: 'closeLid' })).toBe(false);
    activate(s, 'vacuum');
    ticks(s, 100);
    send(s, { type: 'pause' });
    const fresh = createJob('normal');
    expect(fresh).toEqual(createJob('normal'));
    expect(fresh.tick).toBe(0);
    expect(fresh.elapsed).toBe(0);
    expect(fresh.fees).toEqual([]);
    expect(fresh.heat).toBe(0);
    expect(fresh.wipes.status).toBe('waiting');
    expect(fresh.paused).toBe(false);
    expect(fresh.active).toBe(false);
    expect(fresh.inlet.eventTick).toBeNull();
  });
});

describe('material accounting and tool guards', () => {
  it('starts with conserved water and solids, correct walls and finite pending parcel', () => {
    const s = createJob();
    assertInvariants(s);
    expect(tankTotal(s)).toBe(800);
    expect(wallTotal(s)).toBe(40);
    expect(s.materials.walls).toEqual([12, 12, 8, 8]);
    expect(s.materials.PW).toBe(30);
    expect(s.materials.PS).toBe(10);
  });

  it('scum suction transfers 75% scum and 25% water, scaling both when a source is exhausted', () => {
    const s = start();
    accounts(s, { W: 0.001 });
    const before = structuredClone(s.materials);
    activate(s, 'vacuum', 'surface');
    ticks(s, 1);
    expect(before.W - s.materials.W).toBeCloseTo(0.001, 10);
    expect(before.S - s.materials.S).toBeCloseTo(0.003, 10);
    ticks(s, 60);
    expect(s.materials.W).toBe(0);
    expect(s.materials.S).toBeCloseTo(before.S - 0.003, 10);
    expect(s.materials.CW - before.CW).toBeCloseTo(0.001, 10);
  });

  it('liquid and slurry vacuum never extracts unmixed settled solids or wall residue', () => {
    const s = start();
    s.stage = 'DRAWDOWN';
    const unmixed = s.materials.U;
    const walls = [...s.materials.walls];
    activate(s, 'vacuum', 'liquid');
    ticks(s, 120);
    expect(s.materials.U).toBe(unmixed);
    expect(s.materials.walls).toEqual(walls);
    s.stage = 'SLURRY';
    accounts(s, { M: 30, S: 0, U: 160 });
    activate(s, 'vacuum', 'bottom');
    ticks(s, 120);
    expect(s.materials.U).toBe(unmixed);
    expect(s.materials.walls).toEqual(walls);
  });

  it('slurry suction preserves the W:M ratio and transfers each component to the proper truck account', () => {
    const s = start();
    s.stage = 'SLURRY';
    accounts(s, { W: 300, S: 0, U: 0.4, M: 100 });
    const before = structuredClone(s.materials);
    activate(s, 'vacuum', 'liquid');
    ticks(s, 240);
    expect(s.materials.W / s.materials.M).toBeCloseTo(3, 10);
    expect(s.materials.CW - before.CW).toBeCloseTo(before.W - s.materials.W, 9);
    expect(s.materials.CS - before.CS).toBeCloseTo(before.M - s.materials.M, 9);
  });

  it('refuses dry slurry even for small final amounts and enables add-water recovery', () => {
    const s = start();
    s.stage = 'FINAL_PUMP';
    accounts(s, { W: 0.2, S: 0.9, U: 0.4, M: 1 });
    send(s, { type: 'selectTool', tool: 'vacuum' });
    send(s, { type: 'selectTarget', target: 'liquid' });
    expect(actionReason(s)).not.toBeNull();
    expect(send(s, { type: 'toggleActive' })).toBe(false);
    const before = structuredClone(s.materials);
    ticks(s, 60);
    expect(s.materials).toEqual(before);
    activate(s, 'hose', 'liquid');
    ticks(s, 60);
    expect(s.materials.W).toBeGreaterThan(1.5);
    expect(s.materials.A).toBeCloseTo(4, 8);
    activate(s, 'vacuum', 'liquid');
    ticks(s, 1);
    expect(s.materials.M).toBeLessThan(1);
  });

  it('mixing uses the exact minimum, recommended band and a zero-solids division guard', () => {
    const s = start();
    s.stage = 'DRAWDOWN';
    accounts(s, { W: 240, U: 160, M: 0 });
    expect(mixingAllowed(s)).toBe(true);
    expect(recommendedWater(s)).toEqual([288, 352]);
    accounts(s, { W: 240 - 0.001 });
    expect(mixingAllowed(s)).toBe(false);
    expect(send(s, { type: 'continueMix' })).toBe(false);
    accounts(s, { W: 0, U: 0, M: 0 });
    expect(mixingAllowed(s)).toBe(true);
    expect(recommendedWater(s)).toEqual([0, 0]);
  });

  it('the crust buster cannot run outside MIX and cannot move material with too little water', () => {
    const s = start();
    const before = structuredClone(s.materials);
    expect(send(s, { type: 'selectTool', tool: 'mixer' })).toBe(false);
    ticks(s, 120);
    expect(s.materials).toEqual(before);
    s.stage = 'MIX';
    accounts(s, { W: 40 });
    send(s, { type: 'selectTool', tool: 'mixer' });
    expect(actionReason(s)).not.toBeNull();
    expect(send(s, { type: 'toggleActive' })).toBe(false);
    ticks(s, 120);
    expect(s.materials.U).toBe(160);
  });

  it('hose fill is metered and capped at capacity without losing water', () => {
    const s = start();
    s.stage = 'DRAWDOWN';
    accounts(s, { W: 719.99, A: 300 });
    expect(tankTotal(s)).toBeCloseTo(999.99, 8);
    const beforeA = s.materials.A;
    activate(s, 'hose', 'liquid');
    ticks(s, 120);
    expect(tankTotal(s)).toBeCloseTo(1000, 7);
    expect(s.materials.A - beforeA).toBeCloseTo(0.01, 7);
    expect(s.materials.W).toBeCloseTo(720, 7);
  });

  it('wall washing adds metered water and converts residue, and both pause at full capacity', () => {
    const s = start();
    s.stage = 'WASH';
    accounts(s, { W: 100, S: 0.9, U: 0.4, M: 20 });
    const before = structuredClone(s.materials);
    activate(s, 'hose', 'wall0');
    ticks(s, 60);
    expect(s.materials.walls[0]).toBeCloseTo(before.walls[0] - 2, 8);
    expect(s.materials.M).toBeCloseTo(before.M + 2, 8);
    expect(s.materials.W).toBeCloseTo(before.W + 4, 8);
    expect(s.materials.A).toBeCloseTo(before.A + 4, 8);
    send(s, { type: 'stop' });
    accounts(s, { W: 1000 - s.materials.S - s.materials.U - s.materials.M - wallTotal(s), A: 1000 });
    const full = structuredClone(s.materials);
    send(s, { type: 'toggleActive' });
    ticks(s, 120);
    expect(s.materials).toEqual(full);
  });

  it('retains the finite inlet parcel at capacity and releases it once as space becomes available', () => {
    const s = start();
    s.stage = 'INLET';
    s.wipes.status = 'disposed';
    s.wipes.disposed = s.wipes.count;
    accounts(s, { W: 800, S: 0, A: 300 });
    s.inlet.inspected = true;
    activate(s, 'inlet', 'inlet');
    until(s, () => s.inlet.cleared, 5);
    ticks(s, 120);
    expect(s.stage).toBe('INLET');
    expect(s.materials.PW + s.materials.PS).toBeCloseTo(40, 8);
    activate(s, 'vacuum', 'liquid');
    until(s, () => s.stage === 'DRAWDOWN', 30);
    expect(s.materials.PW + s.materials.PS).toBeLessThanOrEqual(CONFIG.epsilon);
    expect(s.materials.U).toBeCloseTo(170, 8);
    expect(s.fees.filter(f => f.key === 'inlet_clear')).toHaveLength(1);
    ticks(s, 120);
    expect(s.materials.U).toBeCloseTo(170, 8);
    expect(send(s, { type: 'inspect' })).toBe(false);
  });

  it('requires weighted regional wall thresholds as well as the total threshold', () => {
    const s = start();
    s.stage = 'FINAL_PUMP';
    s.wipes.status = 'disposed';
    s.wipes.disposed = s.wipes.count;
    s.inlet.cleared = true;
    accounts(s, { W: 1, S: 0.9, U: 0.4, M: 0.1, PW: 0, PS: 0, walls: [0, 0, 1.5, 0] });
    expect(wallTotal(s)).toBeLessThanOrEqual(2);
    expect(finalChecks(s).every(c => c.ok)).toBe(false);
    accounts(s, { walls: [0, 0, 1.1, 0] });
    expect(finalChecks(s).every(c => c.ok)).toBe(true);
  });

  it('rejects nonfinite or negative material accounts during invariant validation', () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const s = createJob();
      s.materials.W = value;
      expect(() => assertInvariants(s)).toThrow();
    }
  });
});

describe('wipes, heat, pause, and command safety', () => {
  it('telegraphs the finite cluster at 20 scum removed, pauses its approach and permits avoiding a clog', () => {
    const s = start();
    activate(s, 'vacuum');
    until(s, () => s.wipes.status === 'approaching', 30);
    expect(s.scumRemoved).toBeGreaterThanOrEqual(20);
    expect(s.wipes.disposed).toBe(0);
    send(s, { type: 'stop' });
    const approach = s.wipes.approach;
    ticks(s, 300);
    expect(s.wipes.approach).toBe(approach);
    activate(s, 'wipes');
    until(s, () => s.wipes.status === 'disposed', 3);
    expect(s.wipes.disposed).toBe(5);
    expect(s.fees.filter(f => f.key === 'excess_wipes')).toHaveLength(1);
    expect(send(s, { type: 'toggleActive' })).toBe(false);
    for (let i = 0; i < 10; i++) send(s, { type: 'selectTool', tool: 'wipes' });
    ticks(s, 300);
    expect(s.wipes.disposed).toBe(5);
    expect(s.fees.filter(f => f.key === 'excess_wipes')).toHaveLength(1);
  });

  it('clogs with zero flow, retains all material and can clear once without duplicate disposal or fees', () => {
    const s = start('challenge');
    activate(s, 'vacuum');
    until(s, () => s.wipes.status === 'in_hose', 30);
    expect(s.flow).toBe(0);
    const clogged = structuredClone(s.materials);
    ticks(s, 300);
    expect(s.materials).toEqual(clogged);
    activate(s, 'wipes');
    ticks(s, 60);
    expect(s.wipes.status).toBe('in_hose');
    until(s, () => s.wipes.status === 'disposed', 3);
    expect(s.wipes.disposed).toBe(8);
    const disposed = s.wipes.disposed;
    send(s, { type: 'selectTool', tool: 'vacuum' });
    send(s, { type: 'selectTool', tool: 'wipes' });
    send(s, { type: 'toggleActive' });
    ticks(s, 300);
    expect(s.wipes.disposed).toBe(disposed);
    expect(s.fees.filter(f => f.key === 'excess_wipes')).toHaveLength(1);
  });

  it('warns on heat, bogs at high load, reduces throughput and cools to recovery while stopped', () => {
    const s = start();
    send(s, { type: 'setThrottle', value: 1 });
    send(s, { type: 'setAirBreak', value: 0 });
    activate(s, 'vacuum');
    ticks(s, 61);
    expect(s.heat).toBeGreaterThanOrEqual(40);
    expect(s.load).toBeCloseTo(1.2625, 8);
    expect(s.events.some(e => /strain|heat|air break|bog/i.test(e.text))).toBe(true);
    until(s, () => s.bogged, 3);
    expect(s.heat).toBeGreaterThanOrEqual(80);
    ticks(s, 1);
    expect(s.flow).toBeCloseTo(2.8 * 0.35, 6);
    send(s, { type: 'stop' });
    const before = structuredClone(s.materials);
    until(s, () => !s.bogged, 5);
    expect(s.heat).toBeLessThanOrEqual(30);
    expect(s.materials).toEqual(before);
  });

  it('excessive air break trades flow for load relief', () => {
    const s = start();
    send(s, { type: 'setThrottle', value: 1 });
    send(s, { type: 'setAirBreak', value: 0.5 });
    activate(s, 'vacuum');
    ticks(s, 1);
    expect(s.flow).toBeCloseTo(1.4, 6);
    expect(s.load).toBeCloseTo(0.63125, 6);
    expect(s.heat).toBe(0);
  });

  it('tool and target switches stop activity and pause freezes every gameplay timer until explicit resume', () => {
    const s = start();
    activate(s, 'vacuum');
    ticks(s, 100);
    send(s, { type: 'selectTarget', target: 'liquid' });
    expect(s.active).toBe(false);
    send(s, { type: 'selectTarget', target: 'surface' });
    send(s, { type: 'toggleActive' });
    expect(s.active).toBe(true);
    send(s, { type: 'pause' });
    expect(s.active).toBe(false);
    expect(s.paused).toBe(true);
    const paused = structuredClone(s);
    ticks(s, 600);
    expect(s).toEqual(paused);
    expect(send(s, { type: 'toggleActive' })).toBe(false);
    send(s, { type: 'resume' });
    expect(s.active).toBe(false);
    ticks(s, 1);
    expect(s.tick).toBe(paused.tick + 1);
  });

  it('wrong-stage and out-of-order commands have a visible reason and cannot bypass guards', () => {
    const s = createJob();
    for (const c of [{ type: 'inspect' }, { type: 'continueMix' }, { type: 'stow' }, { type: 'invoice' }] as Command[]) {
      expect(commandReason(s, c)).not.toBeNull();
      expect(send(s, c)).toBe(false);
    }
    expect(s.stage).toBe('SETUP');
    expect(s.materials).toEqual(createJob().materials);
  });
});
