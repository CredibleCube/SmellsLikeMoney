export type Stage = 'SETUP' | 'SCUM' | 'INLET' | 'DRAWDOWN' | 'MIX' | 'SLURRY' | 'WASH' | 'FINAL_PUMP' | 'CLEANUP' | 'INVOICE';
export type Tool = 'vacuum' | 'wipes' | 'inlet' | 'mixer' | 'hose';
export type Target = 'surface' | 'liquid' | 'inlet' | 'bottom' | 'wall0' | 'wall1' | 'wall2' | 'wall3';
export type FixtureName = 'normal' | 'challenge';
export type WipeStatus = 'waiting' | 'approaching' | 'in_hose' | 'disposed';
export interface Materials { W: number; S: number; U: number; M: number; CW: number; CS: number; PW: number; PS: number; A: number; walls: number[]; }
export interface Fee { key: 'base_service' | 'excess_wipes' | 'inlet_clear'; label: string; amount: number; }
export interface GameEvent { tick: number; text: string; kind: 'info' | 'warning' | 'success'; }
export interface JobState {
  schemaVersion: 1; jobId: string; fixture: FixtureName; seed: number; rng: number;
  tick: number; elapsed: number; stage: Stage; tool: Tool; target: Target;
  active: boolean; paused: boolean; started: boolean;
  materials: Materials;
  lidOpen: boolean; connected: boolean; stowed: boolean; lidClosed: boolean;
  throttle: number; airBreak: number; heat: number; bogged: boolean; load: number; flow: number;
  wipes: { status: WipeStatus; count: number; disposed: number; approach: number; progress: number; warningSeconds: number; };
  inlet: { inspected: boolean; strength: number; initialStrength: number; cleared: boolean; releaseElapsed: number; eventTick: number | null; };
  initialSolids: number; scumRemoved: number; fees: Fee[]; events: GameEvent[];
  tutorial: { mixed: boolean; washed: boolean; phrase: boolean };
}
export type Command =
  | { type: 'start' }
  | { type: 'selectTool'; tool: Tool }
  | { type: 'selectTarget'; target: Target }
  | { type: 'setThrottle'; value: number }
  | { type: 'setAirBreak'; value: number }
  | { type: 'toggleActive' }
  | { type: 'stop' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'openLid' }
  | { type: 'connect' }
  | { type: 'inspect' }
  | { type: 'continueMix' }
  | { type: 'sayPhrase' }
  | { type: 'stow' }
  | { type: 'closeLid' }
  | { type: 'invoice' };
