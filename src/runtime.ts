import { CONFIG } from './config';

/** Fixed gameplay time, independent of rendering and wall-clock speed. */
export class FixedStepClock {
  private accumulator = 0;
  constructor(private readonly stepFn: (dt: number) => void) {}

  advance(delta: number, paused: boolean): number {
    if (paused) {
      this.reset();
      return 0;
    }
    if (!Number.isFinite(delta) || delta <= 0) return 0;
    this.accumulator += Math.min(delta, CONFIG.maxFrameDelta);
    let steps = 0;
    while (this.accumulator + 1e-12 >= CONFIG.step && steps < CONFIG.maxCatchupSteps) {
      this.stepFn(CONFIG.step);
      this.accumulator = Math.max(0, this.accumulator - CONFIG.step);
      steps += 1;
    }
    // Delayed frames must never create a persistent backlog.
    if (steps === CONFIG.maxCatchupSteps && this.accumulator >= CONFIG.step) {
      this.accumulator %= CONFIG.step;
    }
    return steps;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
