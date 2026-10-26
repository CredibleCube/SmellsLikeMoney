import { CONFIG } from './config';
import { actionReason } from './commands';
import { awardFee, emit } from './events';
import type { JobState, Stage } from './types';

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
export const wallTotal = (state: JobState): number => state.materials.walls.reduce((sum, value) => sum + value, 0);
export const tankTotal = (state: JobState): number => {
  const m = state.materials;
  return m.W + m.S + m.U + m.M + wallTotal(state);
};
export const mixingAllowed = (state: JobState): boolean => state.materials.W + 1e-9 >= CONFIG.waterMinimum * (state.materials.U + state.materials.M);
export const recommendedWater = (state: JobState): [number, number] => {
  const solids = state.materials.U + state.materials.M;
  return [CONFIG.waterBand[0] * solids, CONFIG.waterBand[1] * solids];
};
export function finalChecks(state: JobState): { label: string; ok: boolean; hint: string }[] {
  const m = state.materials;
  const wallPass = wallTotal(state) <= 2 + 1e-9 && m.walls.every((r, i) => r <= CONFIG.initialWalls[i] * 0.15 + 1e-9);
  return [
    { label: 'Inlet clear and empty', ok: state.inlet.cleared && m.PW <= 1e-9 && m.PS <= 1e-9, hint: 'Inspect and clear the inlet T; let its parcel empty.' },
    { label: 'All wipes disposed', ok: state.wipes.status === 'disposed' && state.wipes.disposed === state.wipes.count, hint: 'Stop suction and use Remove wipes / Clear hose.' },
    { label: 'Hose unclogged', ok: state.wipes.status !== 'in_hose', hint: 'Use the wipe tool to clear the hose.' },
    { label: 'Four walls rinsed', ok: wallPass, hint: 'Rinse every wall to at least 85%; leave no more than 2 residue units total.' },
    { label: 'Solids at 2 units or less', ok: m.S + m.U + m.M <= 2 + 1e-9, hint: 'Vacuum the suspended slurry; add water first if the mix is too dry.' },
    { label: 'Water at 5 units or less', ok: m.W <= 5 + 1e-9, hint: 'Vacuum the washdown water.' },
  ];
}

function transition(state: JobState, stage: Stage, message: string): void {
  state.stage = stage;
  state.active = false;
  state.flow = 0;
  emit(state, message, 'success');
  if (stage === 'INLET') { state.tool = 'inlet'; state.target = 'inlet'; }
  if (stage === 'DRAWDOWN') { state.tool = 'vacuum'; state.target = 'liquid'; }
  if (stage === 'SLURRY') { state.tool = 'vacuum'; state.target = 'liquid'; }
  if (stage === 'WASH') { state.tool = 'hose'; state.target = 'wall0'; }
}

function advance(state: JobState): void {
  const m = state.materials;
  if (state.stage === 'SETUP' && state.lidOpen && state.connected) {
    transition(state, 'SCUM', 'Connected. Vacuum the floating skum; watch for wipes.');
  } else if (state.stage === 'SCUM' && m.S <= 1 && state.wipes.status === 'disposed') {
    transition(state, 'INLET', 'Surface cleared. Inspect the inlet T before clearing it.');
  } else if (state.stage === 'INLET' && state.inlet.cleared && m.PW <= 1e-9 && m.PS <= 1e-9) {
    transition(state, 'DRAWDOWN', 'Inlet serviced. Draw water down toward the mixing band, then continue.');
  } else if (state.stage === 'MIX' && m.U <= 0.5) {
    state.tutorial.mixed = true;
    transition(state, 'SLURRY', 'Poop smoothie ready. Smells like money! Vacuum the mixed slurry.');
  } else if (state.stage === 'SLURRY' && m.W + m.M <= 10 && m.U <= 0.5 && m.S <= 1) {
    transition(state, 'WASH', 'Bulk pumping done. Rinse all four tank walls with the garden hose.');
  } else if ((state.stage === 'WASH' || state.stage === 'FINAL_PUMP') && finalChecks(state).every(check => check.ok)) {
    state.tutorial.washed = true;
    transition(state, 'CLEANUP', 'Tank clean! Tools are off. Stow the equipment and close the lid.');
  }
}

function releaseInlet(state: JobState, dt: number): void {
  const m = state.materials;
  if (!state.inlet.cleared || (m.PW <= 0 && m.PS <= 0)) return;
  const free = Math.max(0, CONFIG.capacity - tankTotal(state));
  const parcel = m.PW + m.PS;
  const amount = Math.min(parcel, free, 40 / CONFIG.inletReleaseSeconds * dt);
  if (amount <= 0) return;
  const water = amount * m.PW / parcel;
  const solids = amount - water;
  m.PW -= water; m.PS -= solids;
  m.W += water; m.U += solids;
  state.inlet.releaseElapsed += dt;
  // Floating-point residue is transferred, never discarded.
  if (m.PW + m.PS < 1e-10) {
    m.W += m.PW; m.U += m.PS; m.PW = 0; m.PS = 0;
  }
}

function vacuum(state: JobState, dt: number): void {
  const m = state.materials;
  const mode = state.stage === 'SCUM' ? 'scum' : state.stage === 'DRAWDOWN' || state.stage === 'INLET' ? 'water' : 'slurry';
  const fraction = mode === 'scum' ? 0.75 : mode === 'water' ? 0 : m.W + m.M > 0 ? m.M / (m.W + m.M) : 0;
  const load = state.throttle * (1 - state.airBreak) * (1 + 0.35 * fraction);
  state.load = load;
  const heatBefore = state.heat;
  state.heat = clamp(state.heat + (load > 0.98 ? 40 : -25) * dt, 0, 100);
  if (heatBefore < 40 && state.heat >= 40) emit(state, 'Pump straining. Open the air break a little or lower throttle.', 'warning');
  if (!state.bogged && state.heat >= 80) {
    state.bogged = true;
    emit(state, 'Pump bogged. Lower throttle, add an air break, or stop to cool it.', 'warning');
  }
  if (state.bogged && state.heat <= 30) {
    state.bogged = false;
    emit(state, 'Pump recovered. A little air keeps it happy.', 'success');
  }
  const efficiency = clamp(1 - 2 * Math.max(0, state.airBreak - 0.25), 0.2, 1);
  const request = CONFIG.baseFlow * state.throttle * efficiency * (state.bogged ? 0.35 : 1) * dt;
  let removed = 0;
  if (mode === 'scum') {
    const total = Math.min(request, m.S / 0.75, m.W / 0.25);
    const solids = Math.min(m.S, total * 0.75), water = Math.min(m.W, total * 0.25);
    m.S -= solids; m.W -= water; m.CS += solids; m.CW += water;
    state.scumRemoved += solids;
    removed = total;
    if (state.wipes.status === 'waiting' && state.scumRemoved >= 20) {
      state.wipes.status = 'approaching';
      emit(state, `${state.wipes.count} wipes approaching! Stop suction and remove them, or the hose will clog.`, 'warning');
    }
    if (state.wipes.status === 'approaching') {
      state.wipes.approach += dt;
      if (state.wipes.approach + 1e-9 >= state.wipes.warningSeconds) {
        state.wipes.status = 'in_hose'; state.active = false;
        emit(state, 'Hose clogged! Bulk material is safe. Stop pump and clear hose with the wipe tool.', 'warning');
      }
    }
  } else if (mode === 'water') {
    removed = Math.min(request, m.W);
    m.W -= removed; m.CW += removed;
  } else {
    const total = m.W + m.M;
    removed = Math.min(request, total);
    const water = removed === total ? m.W : total > 0 ? removed * m.W / total : 0;
    const solids = removed === total ? m.M : Math.min(m.M, removed - water);
    m.W -= water; m.M -= solids; m.CW += water; m.CS += solids;
  }
  state.flow = state.wipes.status === 'in_hose' ? 0 : removed / dt;
}

function work(state: JobState, dt: number): void {
  const m = state.materials;
  if (state.tool === 'vacuum') { vacuum(state, dt); return; }
  if (state.tool === 'wipes') {
    state.wipes.progress += dt;
    const duration = state.wipes.status === 'in_hose' ? CONFIG.clogClearSeconds : CONFIG.wipeRemoveSeconds;
    if (state.wipes.progress + 1e-9 >= duration) {
      state.wipes.progress = duration;
      state.wipes.disposed = state.wipes.count;
      state.wipes.status = 'disposed'; state.active = false;
      if (state.wipes.disposed >= 4) awardFee(state, 'excess_wipes');
      emit(state, `All ${state.wipes.disposed} wipes disposed. Excess-wipes fee +${CONFIG.fees.excess_wipes} credits, once for this job.`, 'success');
    }
  } else if (state.tool === 'inlet') {
    state.inlet.strength = Math.max(0, state.inlet.strength - CONFIG.inletClearRate * dt);
    if (state.inlet.strength <= 1e-9) {
      state.inlet.strength = 0; state.inlet.cleared = true;
      state.inlet.eventTick = state.tick; state.active = false;
      awardFee(state, 'inlet_clear');
      emit(state, `MONEY SHOT! Inlet clear. One finite incoming parcel; inlet fee +${CONFIG.fees.inlet_clear} credits.`, 'success');
    }
  } else if (state.tool === 'mixer') {
    const amount = Math.min(m.U, CONFIG.mixRate * dt);
    m.U -= amount; m.M += amount;
    state.flow = amount / dt;
  } else if (state.tool === 'hose') {
    const free = Math.max(0, CONFIG.capacity - tankTotal(state));
    const water = Math.min(free, CONFIG.hoseRate * dt);
    m.W += water; m.A += water;
    state.flow = water / dt;
    if (state.target.startsWith('wall') && (state.stage === 'WASH' || state.stage === 'FINAL_PUMP')) {
      const index = Number(state.target.slice(-1));
      const residue = Math.min(m.walls[index], CONFIG.washRate * dt * (water / (CONFIG.hoseRate * dt)));
      m.walls[index] -= residue; m.M += residue;
      if (wallTotal(state) <= 2 && m.walls.every((r, i) => r <= CONFIG.initialWalls[i] * 0.15)) state.tutorial.washed = true;
    }
  }
}

export function step(state: JobState, dt: number = CONFIG.step): void {
  if (!state.started || state.paused || state.stage === 'INVOICE' || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, CONFIG.maxFrameDelta);
  state.tick += 1;
  state.elapsed += dt;
  state.flow = 0;
  const pumping = state.active && state.tool === 'vacuum' && !actionReason(state);
  if (!pumping) {
    state.load = 0;
    state.heat = Math.max(0, state.heat - 25 * dt);
    if (state.bogged && state.heat <= 30) {
      state.bogged = false;
      emit(state, 'Pump recovered. Ready when you are.', 'success');
    }
  }
  if (state.active) {
    const reason = actionReason(state);
    if (reason) {
      state.active = false;
      emit(state, reason, 'warning');
    } else work(state, dt);
  }
  releaseInlet(state, dt);
  advance(state);
}

export function assertInvariants(state: JobState): void {
  const m = state.materials;
  const numbers = [m.W,m.S,m.U,m.M,m.CW,m.CS,m.PW,m.PS,m.A,...m.walls,state.heat,state.elapsed,state.flow,state.load,state.throttle,state.airBreak,state.tick,state.seed,state.rng,state.scumRemoved,state.initialSolids,state.inlet.strength,state.inlet.initialStrength,state.inlet.releaseElapsed,state.wipes.progress,state.wipes.approach,state.wipes.warningSeconds,state.wipes.count,state.wipes.disposed,...state.fees.map(fee => fee.amount)];
  if (numbers.some(value => !Number.isFinite(value) || value < -CONFIG.epsilon)) throw new Error('Nonfinite or negative simulation quantity');
  const water = m.W + m.CW + m.PW;
  const solids = m.S + m.U + m.M + wallTotal(state) + m.CS + m.PS;
  if (Math.abs(water - (550 + m.A)) > CONFIG.epsilon) throw new Error(`Water ledger mismatch: ${water} vs ${550 + m.A}`);
  if (Math.abs(solids - 290) > CONFIG.epsilon) throw new Error(`Solids ledger mismatch: ${solids} vs 290`);
  if (tankTotal(state) > CONFIG.capacity + CONFIG.epsilon) throw new Error('Tank capacity exceeded');
  if (state.wipes.disposed > state.wipes.count) throw new Error('Wipe duplication');
  if (new Set(state.fees.map(fee => fee.key)).size !== state.fees.length) throw new Error('Duplicate invoice fee');
}
