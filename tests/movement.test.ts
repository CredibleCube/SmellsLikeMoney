import { describe, expect, it } from 'vitest';
import { CONFIG, WORLD } from '../src/config';
import { createJob } from '../src/fixtures';
import { actionReason, command, commandReason, getContextAction } from '../src/commands';
import { clearMovement, stationReason } from '../src/movement';
import { assertInvariants, step } from '../src/simulation';
import type { Command, JobState, MoveDirection } from '../src/types';

function send(state: JobState, input: Command): boolean {
  const result = command(state, input);
  assertInvariants(state);
  return result;
}
function ticks(state: JobState, count: number): void {
  for (let i = 0; i < count; i++) {
    step(state);
    assertInvariants(state);
  }
}
function move(state: JobState, direction: MoveDirection, pressed = true): void {
  expect(send(state, { type: 'move', direction, pressed })).toBe(true);
}
function start(): JobState {
  const state = createJob();
  send(state, { type: 'start' });
  return state;
}
function beginPumping(): JobState {
  const state = start();
  send(state, { type: 'openLid' });
  send(state, { type: 'connect' });
  ticks(state, 1);
  expect(send(state, { type: 'toggleActive' })).toBe(true);
  ticks(state, 1);
  expect(state.active).toBe(true);
  return state;
}
function walkTo(state: JobState, target: number): void {
  const direction = state.player.x < target ? 'right' : 'left';
  move(state, direction);
  let tick = 0;
  while (direction === 'right' ? state.player.x < target : state.player.x > target) {
    ticks(state, 1);
    if (++tick > 600) throw new Error('Movement failed to reach the work station.');
  }
  move(state, direction, false);
  ticks(state, 30);
}

describe('direct side-view movement', () => {
  it('spawns outside on the grass with no held keys, and waits until the job starts', () => {
    const state = createJob();
    expect(state.player).toMatchObject({ x: WORLD.startX, y: WORLD.groundY, vx: 0, vy: 0, grounded: true, crouching: false });
    expect(Object.values(state.player.input)).toEqual([false, false, false, false]);
    expect(send(state, { type: 'move', direction: 'right', pressed: true })).toBe(false);
    const before = structuredClone(state.player);
    ticks(state, 120);
    expect(state.player).toEqual(before);
  });

  it('accelerates continuously while a direction is held, animates stride, and clamps to the yard bounds', () => {
    const state = start();
    move(state, 'right');
    ticks(state, 1);
    expect(state.player.vx).toBeCloseTo(WORLD.acceleration * CONFIG.step, 10);
    expect(state.player.x).toBeGreaterThan(WORLD.startX);
    ticks(state, 59);
    expect(state.player.vx).toBe(WORLD.speed);
    expect(state.player.x).toBeGreaterThan(WORLD.startX + 150);
    expect(state.player.facing).toBe(1);
    expect(state.player.stride).toBeGreaterThan(0);
    ticks(state, 600);
    expect(state.player.x).toBe(WORLD.maxX);
    expect(state.player.y).toBe(WORLD.groundY);
    expect(state.player.vx).toBe(0);
    move(state, 'right', false);
    move(state, 'left');
    ticks(state, 600);
    expect(state.player.x).toBe(WORLD.minX);
    expect(state.player.facing).toBe(-1);
    expect(state.player.y).toBe(WORLD.groundY);
  });

  it('decelerates to a stable stop after release and cancels opposite held directions', () => {
    const state = start();
    move(state, 'right');
    ticks(state, 30);
    const before = state.player.x;
    move(state, 'right', false);
    ticks(state, 1);
    expect(state.player.vx).toBeGreaterThan(0);
    expect(state.player.vx).toBeLessThan(WORLD.speed);
    ticks(state, 30);
    expect(state.player.vx).toBe(0);
    expect(state.player.x).toBeGreaterThan(before);
    const stopped = state.player.x;
    ticks(state, 120);
    expect(state.player.x).toBe(stopped);
    move(state, 'left');
    move(state, 'right');
    ticks(state, 30);
    expect(state.player.x).toBe(stopped);
    expect(state.player.vx).toBe(0);
  });

  it('jumps in an arc and lands outside; holding up does not auto-hop on landing', () => {
    const state = start();
    move(state, 'up');
    ticks(state, 1);
    expect(state.player.grounded).toBe(false);
    expect(state.player.vy).toBeLessThan(0);
    expect(state.player.y).toBeLessThan(WORLD.groundY);
    ticks(state, 20);
    expect(state.player.y).toBeLessThan(WORLD.groundY - 60);
    ticks(state, 60);
    expect(state.player).toMatchObject({ y: WORLD.groundY, vy: 0, grounded: true });
    expect(state.player.input.up).toBe(true);
    ticks(state, 180);
    expect(state.player.y).toBe(WORLD.groundY);
    move(state, 'up', false);
    move(state, 'up');
    ticks(state, 1);
    expect(state.player.grounded).toBe(false);
  });

  it('crouches and moves more slowly; crouching prevents jump and tool use', () => {
    const state = beginPumping();
    move(state, 'down');
    move(state, 'right');
    ticks(state, 30);
    expect(state.player.crouching).toBe(true);
    expect(state.player.vx).toBe(WORLD.crouchSpeed);
    expect(state.active).toBe(false);
    expect(stationReason(state, 'hatch')).toMatch(/stand up/i);
    move(state, 'up');
    ticks(state, 1);
    expect(state.player.grounded).toBe(true);
    expect(state.player.y).toBe(WORLD.groundY);
    move(state, 'down', false);
    move(state, 'right', false);
    move(state, 'up', false);
    ticks(state, 30);
    expect(state.player.crouching).toBe(false);
    expect(stationReason(state, 'hatch')).toBeNull();
  });

  it('pauses mid-jump without catching up and accepts release commands while paused', () => {
    const state = start();
    move(state, 'right');
    move(state, 'up');
    ticks(state, 8);
    expect(state.player.grounded).toBe(false);
    send(state, { type: 'pause' });
    expect(Object.values(state.player.input).every(value => !value)).toBe(true);
    expect(send(state, { type: 'move', direction: 'up', pressed: false })).toBe(true);
    expect(send(state, { type: 'move', direction: 'right', pressed: true })).toBe(false);
    const before = structuredClone(state.player);
    ticks(state, 600);
    expect(state.player).toEqual(before);
    send(state, { type: 'resume' });
    expect(state.player.vx).toBe(0);
    expect(Object.values(state.player.input).every(value => !value)).toBe(true);
    ticks(state, 60);
    expect(state.player.y).toBe(WORLD.groundY);
    expect(state.player.grounded).toBe(true);
  });

  it('does not move in the completed invoice and reset restores the original player fixture', () => {
    const state = start();
    move(state, 'left');
    ticks(state, 45);
    send(state, { type: 'pause' });
    const fresh = createJob();
    expect(fresh.player).toEqual(createJob().player);
    expect(fresh.player.x).toBe(WORLD.startX);
    expect(fresh.player.stride).toBe(0);
    state.stage = 'INVOICE';
    state.paused = false;
    expect(send(state, { type: 'move', direction: 'right', pressed: true })).toBe(false);
    const before = structuredClone(state.player);
    ticks(state, 60);
    expect(state.player).toEqual(before);
  });

  it('walks, jumps, and crouches without creating or removing bulk materials', () => {
    const state = start();
    const materials = structuredClone(state.materials);
    move(state, 'right');
    ticks(state, 60);
    move(state, 'up');
    ticks(state, 60);
    move(state, 'up', false);
    move(state, 'right', false);
    move(state, 'down');
    move(state, 'left');
    ticks(state, 120);
    clearMovement(state);
    ticks(state, 60);
    expect(state.materials).toEqual(materials);
  });

  it('replays tick-indexed movement and interactions deterministically', () => {
    function replay(): JobState {
      const state = start();
      move(state, 'right'); ticks(state, 25);
      move(state, 'up'); ticks(state, 15);
      move(state, 'up', false); ticks(state, 40);
      move(state, 'right', false); ticks(state, 20);
      move(state, 'down'); ticks(state, 10);
      move(state, 'left'); ticks(state, 30);
      move(state, 'left', false); move(state, 'down', false); ticks(state, 30);
      send(state, { type: 'interact' }); ticks(state, 1);
      return state;
    }
    expect(replay()).toEqual(replay());
  });
});

describe('in-world work stations and context interaction', () => {
  it('stops tools immediately when walking or jumping and requires a stationary outside work position', () => {
    const state = beginPumping();
    const materials = structuredClone(state.materials);
    move(state, 'right');
    expect(state.active).toBe(false);
    expect(state.flow).toBe(0);
    expect(actionReason(state)).toMatch(/movement|stand still/i);
    expect(send(state, { type: 'toggleActive' })).toBe(false);
    ticks(state, 30);
    expect(state.materials).toEqual(materials);
    move(state, 'right', false);
    ticks(state, 30);
    expect(send(state, { type: 'toggleActive' })).toBe(true);
    move(state, 'up');
    expect(state.active).toBe(false);
    ticks(state, 1);
    expect(actionReason(state)).toMatch(/land/i);
    expect(send(state, { type: 'toggleActive' })).toBe(false);
  });

  it('cannot operate from across the yard and can recover by walking into the marked work zone', () => {
    const state = beginPumping();
    move(state, 'left');
    ticks(state, 180);
    move(state, 'left', false);
    ticks(state, 30);
    expect(actionReason(state)).toMatch(/walk right.*hatch/i);
    expect(send(state, { type: 'toggleActive' })).toBe(false);
    walkTo(state, WORLD.stations.hatch.x);
    expect(stationReason(state, 'hatch')).toBeNull();
    expect(send(state, { type: 'toggleActive' })).toBe(true);
  });

  it('uses E for setup and requires a real walk to inspect and clear the inlet', () => {
    const state = start();
    expect(getContextAction(state)).toMatchObject({ station: 'hatch', command: { type: 'openLid' }, reason: null });
    expect(send(state, { type: 'interact' })).toBe(true);
    expect(getContextAction(state).command.type).toBe('connect');
    expect(send(state, { type: 'interact' })).toBe(true);
    ticks(state, 1);
    expect(state.stage).toBe('SCUM');
    state.stage = 'INLET';
    expect(getContextAction(state)).toMatchObject({ station: 'inlet', command: { type: 'inspect' } });
    expect(commandReason(state, { type: 'inspect' })).toMatch(/walk right.*inlet/i);
    expect(send(state, { type: 'interact' })).toBe(false);
    expect(state.inlet.inspected).toBe(false);
    walkTo(state, WORLD.stations.inlet.x);
    expect(send(state, { type: 'interact' })).toBe(true);
    expect(state.inlet.inspected).toBe(true);
    expect(send(state, { type: 'interact' })).toBe(true);
    expect(state.tool).toBe('inlet');
    expect(state.active).toBe(true);
    ticks(state, 300);
    expect(state.inlet.cleared).toBe(true);
    expect(state.materials.PW + state.materials.PS).toBe(0);
  });

  it('clears held movement on tool selection without cancelling a jump in flight', () => {
    const state = beginPumping();
    move(state, 'right'); move(state, 'up'); ticks(state, 4);
    const vy = state.player.vy;
    const y = state.player.y;
    expect(send(state, { type: 'selectTool', tool: 'vacuum' })).toBe(true);
    expect(state.active).toBe(false);
    expect(state.player.vx).toBe(0);
    expect(Object.values(state.player.input).every(value => !value)).toBe(true);
    expect(state.player.vy).toBe(vy);
    ticks(state, 1);
    expect(state.player.y).toBeLessThan(y);
    expect(state.player.vy).toBeGreaterThan(vy);
  });
});
