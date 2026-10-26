import { describe, expect, it } from 'vitest';
import { FixedStepClock } from '../src/runtime';
import { CONFIG } from '../src/config';

describe('fixed-step renderer clock', () => {
  it('runs only full fixed steps and preserves fractional render time', () => {
    const seen: number[] = [];
    const clock = new FixedStepClock(dt => seen.push(dt));
    expect(clock.advance(CONFIG.step * 0.5, false)).toBe(0);
    expect(clock.advance(CONFIG.step * 0.5, false)).toBe(1);
    expect(seen).toEqual([CONFIG.step]);
  });
  it('clamps a long frame and limits catch-up work', () => {
    let steps = 0;
    const clock = new FixedStepClock(() => steps++);
    expect(clock.advance(10, false)).toBe(CONFIG.maxCatchupSteps);
    expect(steps).toBe(CONFIG.maxCatchupSteps);
    expect(clock.advance(0, false)).toBe(0);
    expect(clock.advance(CONFIG.step, false)).toBe(1);
  });
  it('drops accumulated time during pause, preventing hidden-tab catch-up', () => {
    let steps = 0;
    const clock = new FixedStepClock(() => steps++);
    clock.advance(CONFIG.step * 0.5, false);
    expect(clock.advance(120, true)).toBe(0);
    expect(clock.advance(CONFIG.step * 0.5, false)).toBe(0);
    expect(steps).toBe(0);
    expect(clock.advance(CONFIG.step * 0.5, false)).toBe(1);
  });
  it('reset drops every partial frame and ignores invalid frame deltas', () => {
    let steps = 0;
    const clock = new FixedStepClock(() => steps++);
    clock.advance(CONFIG.step / 2, false);
    clock.reset();
    for (const value of [0, -1, NaN, Infinity]) expect(clock.advance(value, false)).toBe(0);
    expect(clock.advance(CONFIG.step / 2, false)).toBe(0);
    expect(steps).toBe(0);
  });
});
