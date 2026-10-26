import { CONFIG } from './config';
import type { FixtureName, JobState } from './types';
export function createJob(fixture: FixtureName = 'normal'): JobState {
  const seed = fixture === 'normal' ? 101 : 202;
  const strength = fixture === 'normal' ? 6 : 16;
  return {
    schemaVersion: 1, jobId: `yard-${seed}`, fixture, seed, rng: seed,
    tick: 0, elapsed: 0, stage: 'SETUP', tool: 'vacuum', target: 'surface',
    active: false, paused: false, started: false,
    materials: { W: 520, S: 80, U: 160, M: 0, CW: 0, CS: 0, PW: 30, PS: 10, A: 0, walls: [...CONFIG.initialWalls] },
    lidOpen: false, connected: false, stowed: false, lidClosed: false,
    throttle: CONFIG.throttle, airBreak: CONFIG.airBreak, heat: 0, bogged: false, load: 0, flow: 0,
    wipes: { status: 'waiting', count: fixture === 'normal' ? 5 : 8, disposed: 0, approach: 0, progress: 0, warningSeconds: fixture === 'normal' ? 3 : 1.5 },
    inlet: { inspected: false, strength, initialStrength: strength, cleared: false, releaseElapsed: 0, eventTick: null },
    initialSolids: 170, scumRemoved: 0, fees: [],
    events: [{ tick: 0, text: 'A fresh job. Open the lid, connect up, and let’s get to work.', kind: 'info' }],
    tutorial: { mixed: false, washed: false, phrase: false },
  };
}
