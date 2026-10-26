import { describe, expect, it } from 'vitest';
import { CONFIG, WORLD } from '../src/config';
import { createJob } from '../src/fixtures';
import { clearMovement, stationReason, updatePlayer } from '../src/movement';

function advance(state: ReturnType<typeof createJob>, count: number): void {
  for (let tick = 0; tick < count; tick++) updatePlayer(state, CONFIG.step);
}

describe('forgiving jump input', () => {
  it('buffers a fresh jump just before landing and consumes it once', () => {
    const state = createJob();
    Object.assign(state.player, { y: WORLD.groundY - 8, vy: 150, grounded: false, jumpQueued: true });
    state.player.input.up = true;
    advance(state, 3);
    expect(state.player.grounded).toBe(false);
    expect(state.player.vy).toBe(-WORLD.jumpSpeed);
    expect(state.player.jumpBuffer).toBe(0);
    advance(state, 5);
    expect(state.player.y).toBeLessThan(WORLD.groundY - 20);
    advance(state, 180);
    expect(state.player.grounded).toBe(true);
    expect(state.player.y).toBe(WORLD.groundY);
    expect(state.player.input.up).toBe(true);
    advance(state, 60);
    expect(state.player.y).toBe(WORLD.groundY);
  });

  it('expires an early airborne request instead of unexpectedly jumping much later', () => {
    const state = createJob();
    Object.assign(state.player, { y: WORLD.groundY - 100, vy: 0, grounded: false, jumpQueued: true });
    state.player.input.up = true;
    advance(state, 40);
    expect(state.player.grounded).toBe(true);
    expect(state.player.y).toBe(WORLD.groundY);
    expect(state.player.jumpBuffer).toBe(0);
    expect(state.player.vy).toBe(0);
  });

  it('makes a released tap jump visibly lower than a held jump', () => {
    function apex(holdTicks: number): number {
      const state = createJob();
      state.player.jumpQueued = true;
      state.player.input.up = true;
      let top: number = WORLD.groundY;
      for (let tick = 0; tick < 90; tick++) {
        if (tick === holdTicks) state.player.input.up = false;
        advance(state, 1);
        top = Math.min(top, state.player.y);
      }
      expect(state.player.grounded).toBe(true);
      return top;
    }
    const tap = apex(1);
    const held = apex(60);
    expect(WORLD.groundY - tap).toBeGreaterThan(10);
    expect(WORLD.groundY - held).toBeGreaterThan(60);
    expect(tap - held).toBeGreaterThan(40);
  });

  it('does not store a duck-jump that unexpectedly fires when duck is released', () => {
    const state = createJob();
    state.player.input.down = true;
    state.player.input.up = true;
    state.player.jumpQueued = true;
    advance(state, 1);
    expect(state.player.crouching).toBe(true);
    expect(state.player.jumpBuffer).toBe(0);
    state.player.input.down = false;
    advance(state, 60);
    expect(state.player.grounded).toBe(true);
    expect(state.player.y).toBe(WORLD.groundY);
  });

  it('clears pending landing jumps and movement without changing an airborne frame', () => {
    const state = createJob();
    Object.assign(state.player, { x: 760, y: 240, vx: 100, vy: -250, grounded: false, jumpQueued: true, jumpBuffer: 0.08 });
    state.player.input.up = true;
    state.player.input.right = true;
    clearMovement(state);
    expect(state.player).toMatchObject({ x: 760, y: 240, vx: 0, vy: -250, grounded: false, jumpQueued: false, jumpBuffer: 0 });
    expect(Object.values(state.player.input).every(value => !value)).toBe(true);
    expect(createJob().player.jumpBuffer).toBe(0);
  });

  it('allows an atomic stop-and-use attempt in range while retaining air, duck, and range guards', () => {
    const state = createJob();
    state.player.vx = WORLD.speed;
    state.player.input.right = true;
    expect(stationReason(state, 'hatch')).toBeNull();
    state.player.grounded = false;
    expect(stationReason(state, 'hatch')).toMatch(/land/i);
    state.player.grounded = true;
    state.player.input.down = true;
    expect(stationReason(state, 'hatch')).toMatch(/stand up/i);
    state.player.input.down = false;
    state.player.x = WORLD.minX;
    expect(stationReason(state, 'hatch')).toMatch(/walk right/i);
  });
});
