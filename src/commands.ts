import { CONFIG, WORLD } from './config';
import { emit, awardFee, invoiceTotal } from './events';
import { finalChecks, mixingAllowed, tankTotal } from './simulation';
import { clearMovement, stationReason, type Station } from './movement';
import { aimAt, aimNext, resetAim, workSpot } from './work';
import type { Command, JobState, MoveDirection, Target, Tool } from './types';

const knownTools: Tool[] = ['vacuum', 'wipes', 'inlet', 'mixer', 'hose'];
const knownDirections: MoveDirection[] = ['left','right','up','down'];
const knownTargets: Target[] = ['surface','liquid','inlet','bottom','wall0','wall1','wall2','wall3'];

export function toolReason(state: JobState, tool: Tool): string | null {
  if (!knownTools.includes(tool)) return 'Unknown tool.';
  if (!state.started) return 'Start the job first.';
  if (state.stage === 'SETUP') return 'Open the lid and connect the vacuum hose first.';
  if (state.stage === 'CLEANUP' || state.stage === 'INVOICE') return 'Pumping is complete. Stow tools and close the lid.';
  if (tool === 'vacuum') {
    if (state.stage === 'MIX') return 'Finish mixing before pumping the slurry.';
    if (state.stage === 'INLET' && !state.inlet.cleared) return 'Inspect and clear the inlet before pumping down.';
    return null;
  }
  if (tool === 'wipes') {
    if (state.wipes.status === 'disposed') return 'The finite wipe cluster has already been disposed.';
    if (state.wipes.status === 'waiting') return 'The wipes will appear after 20 units of skum are removed.';
    return state.stage === 'SCUM' ? null : 'Wipe handling belongs to the skum stage.';
  }
  if (tool === 'inlet') {
    if (state.stage !== 'INLET') return 'Clear the inlet after skum and wipes are removed.';
    if (state.inlet.cleared) return 'Inlet already clear. Wait for its parcel or pump down if full.';
    return null;
  }
  if (tool === 'mixer') return state.stage === 'MIX' ? null : 'Continue to the mixing stage before using the crust buster.';
  if (tool === 'hose') return ['DRAWDOWN','MIX','SLURRY','WASH','FINAL_PUMP'].includes(state.stage) ? null : 'The garden hose is available after inlet clearing.';
  return null;
}

export function actionReason(state: JobState): string | null {
  if (state.paused) return 'Job paused. Resume before using a tool.';
  const reason = toolReason(state, state.tool);
  if (reason) return reason;
  const location = stationReason(state, state.tool === 'inlet' ? 'inlet' : 'hatch');
  if (location) return location;
  const m = state.materials;
  if (state.tool === 'vacuum') {
    if (state.wipes.status === 'in_hose') return 'Stop pump and clear hose with the wipe tool.';
    if (state.throttle <= 0) return 'Raise the throttle above 0% to start suction.';
    if (state.stage === 'SCUM') {
      if (state.target !== 'surface') return 'Aim at the floating skum / surface.';
      if (m.S <= 0 || m.W <= 0) return 'Skum suction needs both skum and water. Remove any remaining wipes.';
    } else if (state.stage === 'INLET' || state.stage === 'DRAWDOWN') {
      if (state.target !== 'liquid') return 'Select the liquid body for water-only drawdown.';
      if (m.W <= 0) return 'No water remains. Add water with the garden hose.';
    } else {
      if (state.target !== 'liquid' && state.target !== 'bottom') return 'Select the liquid body or bottom for slurry suction.';
      if (m.W + m.M <= 0) return 'No suspended mixture remains. Rinse the walls next.';
      if (m.M > 0 && m.W + 1e-9 < CONFIG.waterMinimum * m.M && !finalChecks(state).every(check => check.ok)) return 'Mixture too dry: add water with the garden hose (at least 1.5× suspended solids).';
    }
  } else if (state.tool === 'wipes') {
    if (state.target !== 'surface') return 'Select the surface / wipe cluster.';
  } else if (state.tool === 'inlet') {
    if (!state.inlet.inspected) return 'Inspect the inlet T first.';
    if (state.target !== 'inlet') return 'Select the inlet T target.';
  } else if (state.tool === 'mixer') {
    if (state.target !== 'bottom') return 'Select the bottom solids for the crust buster.';
    if (!mixingAllowed(state)) return 'Not enough water to mix. Add water with the garden hose to at least 1.5× solids.';
    if (m.U <= 0.5) return 'Mixing is finished.';
  } else if (state.tool === 'hose') {
    const wallsAllowed = state.stage === 'WASH' || state.stage === 'FINAL_PUMP';
    if (state.target !== 'liquid' && !(wallsAllowed && state.target.startsWith('wall'))) return wallsAllowed ? 'Select a wall region to rinse, or liquid to add water.' : 'Select the liquid body to add water.';
    if (tankTotal(state) >= CONFIG.capacity - 1e-9) return 'Tank full. Switch to vacuum and pump down before adding more water.';
  }
  return null;
}

export function commandReason(state: JobState, cmd: Command): string | null {
  if (cmd.type === 'move') {
    if (!knownDirections.includes(cmd.direction) || typeof cmd.pressed !== 'boolean') return 'Unknown movement input.';
    if (!cmd.pressed) return null;
    if (!state.started) return 'Start the job first.';
    if (state.paused) return 'Resume the job first.';
    return state.stage === 'INVOICE' ? 'This job is complete. Replay for another run.' : null;
  }
  if (cmd.type === 'setBoost') {
    if (typeof cmd.pressed !== 'boolean') return 'Unknown boost input.';
    if (!cmd.pressed) return null;
    if (!state.started || state.paused || state.stage === 'INVOICE') return 'Resume a running job to boost.';
    return state.tool === 'vacuum' ? null : 'Boost is available on the vacuum pump.';
  }
  if (cmd.type === 'start') return state.started ? 'The job is already started.' : null;
  if (cmd.type === 'pause' || cmd.type === 'resume' || cmd.type === 'stop') return null;
  if (cmd.type === 'setThrottle' || cmd.type === 'setAirBreak') return Number.isFinite(cmd.value) ? null : 'Use a finite slider value.';
  if (!state.started) return 'Start the job first.';
  if (cmd.type === 'selectTarget') return knownTargets.includes(cmd.target) ? null : 'Unknown target.';
  if (cmd.type === 'selectTool') return toolReason(state, cmd.tool);
  if (state.paused) return 'Resume the job first.';
  if (cmd.type === 'aim') return Number.isFinite(cmd.x) && Number.isFinite(cmd.y) ? null : 'Aim coordinates must be finite.';
  if (cmd.type === 'aimNext') return null;
  if (cmd.type === 'interact') return getContextAction(state).reason;
  if (cmd.type === 'toggleActive') return state.active ? null : actionReason(state);
  if (cmd.type === 'openLid') return state.stage === 'SETUP' && !state.lidOpen ? stationReason(state, 'hatch') : 'The lid is already open or the job has moved on.';
  if (cmd.type === 'connect') return state.stage === 'SETUP' && state.lidOpen && !state.connected ? stationReason(state, 'hatch') : 'Open the lid before connecting the hose.';
  if (cmd.type === 'inspect') return state.stage === 'INLET' && !state.inlet.inspected ? stationReason(state, 'inlet') : 'Inspect the inlet during the inlet stage.';
  if (cmd.type === 'continueMix') {
    if (state.stage !== 'DRAWDOWN') return 'Draw down the water before continuing to mixing.';
    if (stationReason(state, 'hatch')) return stationReason(state, 'hatch');
    return mixingAllowed(state) ? null : 'Not enough water: add water with the garden hose until the 1.5× minimum is met.';
  }
  if (cmd.type === 'sayPhrase') return ['MIX','SLURRY','WASH','FINAL_PUMP','CLEANUP','INVOICE'].includes(state.stage) ? null : 'Make the poop smoothie first.';
  if (cmd.type === 'stow') {
    if (state.stage !== 'CLEANUP' || !finalChecks(state).every(check => check.ok)) return 'Finish the tank cleanup checks before stowing.';
    if (state.active) return 'Stop all tools before stowing.';
    return state.stowed ? 'Tools are already stowed.' : stationReason(state, 'truck');
  }
  if (cmd.type === 'closeLid') return state.stage === 'CLEANUP' && state.stowed && !state.lidClosed && !state.active ? stationReason(state, 'hatch') : 'Stow the tools before closing the lid.';
  if (cmd.type === 'invoice') return state.stage === 'CLEANUP' && state.stowed && state.lidClosed && !state.active && finalChecks(state).every(check => check.ok) ? stationReason(state, 'hatch') : 'Finish cleanup, stow tools, and close the lid before issuing the invoice.';
  return 'Unknown command.';
}

export function command(state: JobState, cmd: Command): boolean {
  // Using a tool deliberately plants the worker's feet before range checks.
  // Airborne feet remain airborne, so this cannot bypass the outside guard.
  if (cmd.type === 'toggleActive' || cmd.type === 'interact') clearMovement(state);
  const reason = commandReason(state, cmd);
  if (reason) { emit(state, reason, 'warning'); return false; }
  switch (cmd.type) {
    case 'move': {
      const p = state.player;
      if (cmd.direction === 'up' && cmd.pressed && !p.input.up) p.jumpQueued = true;
      p.input[cmd.direction] = cmd.pressed;
      if (cmd.pressed) { state.active = false; state.flow = 0; state.work.boost = false; }
      break;
    }
    case 'aim': aimAt(state, cmd.x, cmd.y); break;
    case 'aimNext': aimNext(state, !!cmd.reverse); break;
    case 'setBoost': state.work.boost = cmd.pressed; break;
    case 'interact': {
      const context = getContextAction(state);
      if (context.command.type === 'toggleActive') {
        const plan = contextTool(state);
        if (state.tool !== plan.tool && !command(state, { type: 'selectTool', tool: plan.tool })) return false;
        if (state.target !== plan.target && !command(state, { type: 'selectTarget', target: plan.target })) return false;
      }
      return command(state, context.command);
    }
    case 'start': clearMovement(state); state.started = true; state.paused = false; emit(state, 'First things first: open the lid and connect the vacuum hose.'); break;
    case 'selectTool': {
      clearMovement(state);
      state.active = false; state.flow = 0; state.work.boost = false; state.tool = cmd.tool;
      state.target = cmd.tool === 'vacuum' ? state.stage === 'SCUM' ? 'surface' : 'liquid' : cmd.tool === 'wipes' ? 'surface' : cmd.tool === 'inlet' ? 'inlet' : cmd.tool === 'mixer' ? 'bottom' : state.stage === 'WASH' || state.stage === 'FINAL_PUMP' ? 'wall0' : 'liquid';
      resetAim(state);
      break;
    }
    case 'selectTarget': clearMovement(state); state.active = false; state.flow = 0; state.work.boost = false; state.target = cmd.target; resetAim(state); break;
    case 'setThrottle': state.throttle = Math.min(1, Math.max(0, cmd.value)); break;
    case 'setAirBreak': state.airBreak = Math.min(1, Math.max(0, cmd.value)); break;
    case 'toggleActive':
      clearMovement(state);
      state.active = !state.active;
      if (!state.active) { state.flow = 0; state.work.boost = false; }
      else emit(state, `${state.tool === 'vacuum' ? 'Vacuum running' : state.tool === 'mixer' ? 'Crust buster spinning' : state.tool === 'hose' ? 'Hose spraying' : 'Tool working'}. Sweep across dirty spots; Q selects the next one.`);
      if (state.active && state.tool === 'hose' && state.target.startsWith('wall') && state.stage === 'FINAL_PUMP') state.stage = 'WASH';
      if (state.active && state.tool === 'vacuum' && state.stage === 'WASH') state.stage = 'FINAL_PUMP';
      break;
    case 'stop': state.active = false; state.flow = 0; state.work.boost = false; break;
    case 'pause': clearMovement(state); state.paused = true; state.active = false; state.flow = 0; state.work.boost = false; break;
    case 'resume': clearMovement(state); state.paused = false; state.active = false; state.flow = 0; state.work.boost = false; break;
    case 'openLid': state.lidOpen = true; emit(state, 'Lid open. Stay outside the tank. Connect the vacuum hose.'); break;
    case 'connect': state.connected = true; emit(state, 'Vacuum hose connected.'); break;
    case 'inspect': state.inlet.inspected = true; emit(state, `Inlet T inspected: blockage strength ${state.inlet.initialStrength}. Use the inlet clearing tool.`); break;
    case 'continueMix': clearMovement(state); state.active = false; state.flow = 0; state.stage = 'MIX'; state.work.boost = false; state.tool = 'mixer'; state.target = 'bottom'; resetAim(state); emit(state, 'Mix the settled solids with the crust buster. Keep enough water in the tank.'); break;
    case 'sayPhrase': state.tutorial.phrase = true; emit(state, 'Smells like money!', 'success'); break;
    case 'stow': clearMovement(state); state.stowed = true; state.connected = false; emit(state, 'Tools stowed. Close the lid to finish the job.', 'success'); break;
    case 'closeLid': clearMovement(state); state.lidClosed = true; state.lidOpen = false; emit(state, 'Lid closed. Ready for the fictional invoice.', 'success'); break;
    case 'invoice': clearMovement(state); state.stage = 'INVOICE'; awardFee(state, 'base_service'); emit(state, `Job complete. ${invoiceTotal(state)} fictional credits. A little dirty work, done right.`, 'success'); break;
  }
  return true;
}

function defaultTarget(state: JobState, tool: Tool): Target {
  if (tool === state.tool) return state.target;
  return tool === 'vacuum' ? state.stage === 'SCUM' ? 'surface' : 'liquid'
    : tool === 'wipes' ? 'surface' : tool === 'inlet' ? 'inlet' : tool === 'mixer' ? 'bottom'
    : state.stage === 'WASH' || state.stage === 'FINAL_PUMP' ? 'wall0' : 'liquid';
}
function contextTool(state: JobState): { tool: Tool; target: Target } {
  const m = state.materials;
  let tool = state.tool;
  if (state.stage === 'SCUM') tool = state.wipes.status === 'approaching' || state.wipes.status === 'in_hose' ? 'wipes' : 'vacuum';
  else if (state.stage === 'INLET') tool = state.inlet.cleared ? 'vacuum' : 'inlet';
  else if (state.stage === 'DRAWDOWN') return { tool: m.W + 1e-9 < CONFIG.waterMinimum * (m.U + m.M) ? 'hose' : 'vacuum', target: 'liquid' };
  else if (state.stage === 'MIX') tool = mixingAllowed(state) ? 'mixer' : 'hose';
  else if (state.stage === 'SLURRY') tool = m.W + 1e-9 < CONFIG.waterMinimum * m.M ? 'hose' : 'vacuum';
  else if (state.stage === 'WASH' || state.stage === 'FINAL_PUMP') {
    tool = state.tool === 'vacuum' || state.tool === 'hose' ? state.tool : 'hose';
    if (tool === 'vacuum' && m.W + 1e-9 < CONFIG.waterMinimum * m.M && !finalChecks(state).every(c => c.ok)) return { tool: 'hose', target: 'liquid' };
  }
  return { tool, target: defaultTarget(state, tool) };
}

export interface ContextAction {
  command: Command;
  label: string;
  hint: string;
  station: Station;
  x: number;
  reason: string | null;
}

/** The same contextual action powers the in-world E prompt and HTML alternative. */
export function getContextAction(state: JobState): ContextAction {
  let next: Command = { type: 'toggleActive' };
  let label = 'Use tool';
  let station: Station = 'hatch';
  let reason: string | null;
  if (!state.started) {
    return { command: { type: 'start' }, label: 'Start job', hint: 'Clock in to take control of the worker.', station, x: WORLD.stations[station].x, reason: 'Start the job first.' };
  }
  if (state.stage === 'INVOICE') return { command: { type: 'invoice' }, label: 'Job complete', hint: 'Replay to take another job.', station, x: WORLD.stations[station].x, reason: 'This job is complete.' };
  if (state.active) {
    const spot = workSpot(state);
    next = { type: 'stop' }; label = 'Stop tool'; station = state.tool === 'inlet' ? 'inlet' : 'hatch';
    const wipeWarning = state.stage === 'SCUM' && state.wipes.status === 'approaching';
    if (!wipeWarning && spot.remaining <= CONFIG.epsilon && ['scum','settled','suspended','wall'].includes(spot.kind)) { next = { type: 'aimNext' }; label = 'Next dirty spot'; }
  }
  else if (state.stage === 'SETUP') { next = { type: state.lidOpen ? 'connect' : 'openLid' }; label = state.lidOpen ? 'Connect hose' : 'Open tank lid'; }
  else if (state.stage === 'INLET' && !state.inlet.inspected) { next = { type: 'inspect' }; label = 'Inspect inlet T'; station = 'inlet'; }
  else if (state.stage === 'DRAWDOWN') {
    const solids = state.materials.U + state.materials.M;
    const tooDry = state.materials.W + 1e-9 < CONFIG.waterMinimum * solids;
    const tooHigh = state.materials.W > CONFIG.waterBand[1] * solids && solids > 0;
    if (!tooDry && !tooHigh) { next = { type: 'continueMix' }; label = 'Continue to mixing'; }
    else {
      const tool: Tool = tooDry ? 'hose' : 'vacuum';
      label = tooDry ? 'Add water to recover' : 'Draw down toward the band';
      const preview = { ...state, tool, target: 'liquid' as Target };
      reason = actionReason(preview);
      return { command: { type: 'toggleActive' }, label, station, x: WORLD.stations.hatch.x, reason, hint: reason || `E: ${label}. Space stops the tool.` };
    }
  }
  else if (state.stage === 'CLEANUP') {
    next = { type: !state.stowed ? 'stow' : !state.lidClosed ? 'closeLid' : 'invoice' };
    label = !state.stowed ? 'Stow tools' : !state.lidClosed ? 'Close tank lid' : 'Issue invoice';
    station = !state.stowed ? 'truck' : 'hatch';
  } else {
    const plan = contextTool(state);
    station = plan.tool === 'inlet' ? 'inlet' : 'hatch';
    label = plan.tool === 'wipes' ? state.wipes.status === 'in_hose' ? 'Clear hose' : 'Remove wipes'
      : plan.tool === 'inlet' ? 'Clear inlet T' : plan.tool === 'mixer' ? 'Start crust buster'
      : plan.tool === 'hose' ? plan.target.startsWith('wall') ? 'Rinse aimed wall' : 'Add water'
      : state.stage === 'SCUM' ? 'Vacuum skum' : 'Vacuum liquid / slurry';
    const preview = { ...state, tool: plan.tool, target: plan.target };
    reason = actionReason(preview);
    return { command: next, label, station, x: WORLD.stations[station].x, reason, hint: reason || `E: ${label}. Mouse aims; Space operates the selected tool.` };
  }
  reason = commandReason(state, next);
  return { command: next, label, station, x: WORLD.stations[station].x, reason, hint: reason || `E: ${label}.` };
}
