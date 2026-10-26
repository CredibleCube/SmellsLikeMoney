import { ARCADE, CONFIG } from './config';
import { emit } from './events';
import type { JobState, Materials, Target, WorkState } from './types';

export const WORK_AREA = { left: 196, right: 934, top: 337, bottom: 565, scale: 0.22 } as const;
export interface WorkSpot {
  key: string; label: string; x: number; y: number; remaining: number; initial: number;
  kind: string; column: number; patch: number; target: Target;
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const partition = (amount: number, count: number) => {
  const result = Array.from({ length: count }, () => amount / count);
  result[count - 1] = amount - result.slice(0, -1).reduce((sum, n) => sum + n, 0);
  return result;
};
export function createWork(materials: Materials): WorkState {
  return {
    aim: { x: 288.25, y: 390, column: 0, patch: 0 },
    scum: partition(materials.S, ARCADE.columns), settled: partition(materials.U, ARCADE.columns),
    suspended: partition(materials.M, ARCADE.columns), wallPatches: materials.walls.map(n => partition(n, ARCADE.patchesPerWall)),
    cleared: [], score: 0, combo: 0, bestCombo: 0, lastClearTick: null,
    boost: false, clogs: 0, bogs: 0, waterRecovery: false,
    collectibles: ARCADE.collectibles.map(() => false), lastReward: null,
  };
}
export function columnAt(x: number): number {
  return clamp(Math.floor((x - WORK_AREA.left) / (WORK_AREA.right - WORK_AREA.left) * ARCADE.columns), 0, ARCADE.columns - 1);
}
const columnX = (column: number) => WORK_AREA.left + (column + 0.5) * (WORK_AREA.right - WORK_AREA.left) / ARCADE.columns;
export function materialSpots(state: JobState, kind: 'scum' | 'settled' | 'suspended'): WorkSpot[] {
  const m = state.materials;
  const floor = WORK_AREA.bottom;
  const liquidTop = floor - (m.U + m.W + m.M) * WORK_AREA.scale;
  return state.work[kind].map((remaining, column) => {
    const target: Target = kind === 'scum' ? 'surface' : kind === 'settled' ? 'bottom' : 'liquid';
    const y = kind === 'scum' ? liquidTop - Math.max(4, remaining * WORK_AREA.scale * 2)
      : kind === 'settled' ? floor - Math.max(10, remaining * WORK_AREA.scale * 2)
      : (liquidTop + floor - m.U * WORK_AREA.scale) / 2;
    const initial = kind === 'scum' ? 20 : kind === 'settled' ? column === 3 ? 50 : 40 : 50;
    return { key: `${kind}-${column}`, label: `${kind === 'scum' ? 'Skum pocket' : kind === 'settled' ? 'Crust clump' : 'Slurry cloud'} ${column + 1}`, x: columnX(column), y: clamp(y, 345, 555), remaining, initial, kind, column, patch: 0, target };
  });
}
export function wallSpots(state: JobState): WorkSpot[] {
  return state.work.wallPatches.flatMap((parts, wall) => parts.map((remaining, patch) => {
    const x = wall < 2 ? wall === 0 ? 210 : 921 : (wall === 2 ? 220 : 572) + (patch + 0.5) * 340 / ARCADE.patchesPerWall;
    const y = wall < 2 ? 365 + (patch + 0.5) * 180 / ARCADE.patchesPerWall : 552;
    return { key: `wall-${wall}-${patch}`, label: `${['Left wall', 'Right wall', 'Floor left', 'Floor right'][wall]} · patch ${patch + 1}`, x, y, remaining, initial: CONFIG.initialWalls[wall] / ARCADE.patchesPerWall, kind: 'wall', column: columnAt(x), patch, target: `wall${wall}` as Target };
  }));
}
/** Relevant targets are generous sectors, with keyboard access to every dirty spot. */
export function hotspots(state: JobState): WorkSpot[] {
  const m = state.materials;
  if (state.tool === 'wipes') return [{ key: 'wipes', label: state.wipes.status === 'in_hose' ? 'Hose clog' : 'Wipe cluster', x: 660, y: 390, remaining: state.wipes.count - state.wipes.disposed, initial: state.wipes.count, kind: 'wipes', column: 2, patch: 0, target: 'surface' }];
  if (state.tool === 'inlet') return [{ key: 'inlet', label: 'Inlet blockage', x: 906, y: 383, remaining: state.inlet.strength, initial: state.inlet.initialStrength, kind: 'inlet', column: 3, patch: 0, target: 'inlet' }];
  if (state.tool === 'mixer') return materialSpots(state, 'settled');
  if (state.tool === 'vacuum') {
    if (state.stage === 'SCUM') return materialSpots(state, 'scum');
    if (state.stage === 'SLURRY' || state.stage === 'WASH' || state.stage === 'FINAL_PUMP') {
      if (m.M > CONFIG.epsilon) return materialSpots(state, 'suspended');
    }
    return [{ key: 'water', label: 'Water drawdown', x: state.work.aim.x, y: clamp(565 - (m.U + m.W * 0.5) * 0.22, 355, 552), remaining: m.W, initial: 520, kind: 'water', column: state.work.aim.column, patch: 0, target: 'liquid' }];
  }
  if (state.tool === 'hose' && ['WASH', 'FINAL_PUMP'].includes(state.stage)) return wallSpots(state);
  return [{ key: 'fill', label: 'Add water', x: 550, y: 440, remaining: Math.max(0, 1.8 * (m.U + m.M) - m.W), initial: 300, kind: 'water', column: 1, patch: 0, target: 'liquid' }];
}
export function workSpot(state: JobState): WorkSpot {
  if (state.tool === 'hose' && state.target === 'liquid') {
    const m = state.materials;
    return { key: 'fill', label: 'Add water', x: state.work.aim.x, y: state.work.aim.y, remaining: Math.max(0, 1.8 * (m.U + m.M) - m.W), initial: 300, kind: 'water', column: state.work.aim.column, patch: 0, target: 'liquid' };
  }
  const spots = hotspots(state);
  if (state.target.startsWith('wall')) {
    return wallSpots(state).find(spot => spot.target === state.target && spot.patch === state.work.aim.patch)!;
  }
  return spots.find(spot => spot.column === state.work.aim.column && (spot.target === state.target
    || (state.tool === 'vacuum' && state.target === 'bottom' && spot.kind === 'suspended'))) || spots[0];
}
function setSpot(state: JobState, spot: WorkSpot): void {
  state.target = spot.target;
  state.work.aim = { x: spot.x, y: spot.y, column: spot.column, patch: spot.patch };
}
/** Select an initial live spot only on explicit tool/stage changes, never during work. */
export function resetAim(state: JobState): void {
  if (state.tool === 'hose' && state.target === 'liquid') {
    state.work.aim = { x: 550, y: 440, column: 1, patch: 0 };
    return;
  }
  const spots = hotspots(state);
  const explicitTarget = state.target;
  const sameTarget = spots.filter(spot => spot.target === state.target);
  const candidates = sameTarget.length ? sameTarget : spots;
  setSpot(state, candidates.find(spot => spot.remaining > CONFIG.epsilon) || candidates[0]);
  // A DOM/command target selection must remain explicit so the shared guard
  // can explain invalid choices; only deliberate pointer/next-spot aim assists.
  if (!sameTarget.length) state.target = explicitTarget;
}
export function aimAt(state: JobState, x: number, y: number): void {
  const column = columnAt(x);
  const spots = hotspots(state);
  if (state.tool === 'hose' && ['WASH', 'FINAL_PUMP'].includes(state.stage)) {
    let target: Target = 'liquid';
    if (x < 267) target = 'wall0';
    else if (x > 866) target = 'wall1';
    else if (y > 510) target = x < 565 ? 'wall2' : 'wall3';
    if (target !== 'liquid') {
      const candidates = wallSpots(state).filter(spot => spot.target === target);
      const spot = candidates.reduce((best, candidate) => Math.hypot(candidate.x - x, candidate.y - y) < Math.hypot(best.x - x, best.y - y) ? candidate : best);
      setSpot(state, spot);
      // The reticle and spray can move within each forgiving patch sector.
      state.work.aim.x = clamp(x, 202, 928); state.work.aim.y = clamp(y, 345, 556);
      return;
    }
    state.target = 'liquid';
    state.work.aim = { x: clamp(x, 202, 928), y: clamp(y, 345, 556), column, patch: 0 };
    return;
  }
  const candidate = spots.find(spot => spot.column === column) || spots[0];
  setSpot(state, candidate);
  if (candidate.kind === 'scum' || candidate.kind === 'settled' || candidate.kind === 'suspended') state.work.aim.x = clamp(x, 202, 928);
}
export function aimNext(state: JobState, reverse = false): void {
  const spots = hotspots(state);
  const dirty = spots.filter(spot => spot.remaining > CONFIG.epsilon);
  const choices = dirty.length ? dirty : spots;
  const current = workSpot(state);
  const index = choices.findIndex(spot => spot.key === current.key);
  const next = index < 0 ? reverse ? choices.length - 1 : 0 : (index + (reverse ? -1 : 1) + choices.length) % choices.length;
  setSpot(state, choices[next]);
}
/** Points are separate from the fictional fee ledger and unique per job target. */
export function awardWork(state: JobState, key: string, label: string, x: number, y: number, points: number = ARCADE.patchPoints): void {
  const work = state.work;
  if (work.cleared.includes(key)) return;
  work.cleared.push(key);
  const withinCombo = work.lastClearTick !== null && (state.tick - work.lastClearTick) * CONFIG.step <= ARCADE.comboSeconds;
  work.combo = withinCombo ? Math.min(ARCADE.comboCap, work.combo + 1) : 1;
  work.bestCombo = Math.max(work.bestCombo, work.combo);
  work.lastClearTick = state.tick;
  const earned = points * work.combo;
  work.score += earned;
  work.lastReward = { tick: state.tick, text: `${label} +${earned}${work.combo > 1 ? ` · ${work.combo}× COMBO` : ''}`, x, y };
  emit(state, work.lastReward.text, 'success');
}
export function collectCrewTokens(state: JobState): void {
  if (state.player.grounded) return;
  const p = state.player;
  ARCADE.collectibles.forEach((token, index) => {
    if (state.work.collectibles[index]) return;
    const centerY = p.y - (p.crouching ? 25 : 43);
    if (Math.abs(p.x - token.x) <= 34 && Math.abs(centerY - token.y) <= 33) {
      state.work.collectibles[index] = true;
      awardWork(state, `token-${index}`, 'CREW BOLT', token.x, token.y, ARCADE.pickupPoints);
    }
  });
}
