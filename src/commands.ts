import { CONFIG } from './config';
import { emit, awardFee, invoiceTotal } from './events';
import { finalChecks, mixingAllowed, tankTotal } from './simulation';
import type { Command, JobState, Target, Tool } from './types';

const knownTools: Tool[] = ['vacuum', 'wipes', 'inlet', 'mixer', 'hose'];
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
  if (cmd.type === 'start') return state.started ? 'The job is already started.' : null;
  if (cmd.type === 'pause' || cmd.type === 'resume' || cmd.type === 'stop') return null;
  if (cmd.type === 'setThrottle' || cmd.type === 'setAirBreak') return Number.isFinite(cmd.value) ? null : 'Use a finite slider value.';
  if (!state.started) return 'Start the job first.';
  if (cmd.type === 'selectTarget') return knownTargets.includes(cmd.target) ? null : 'Unknown target.';
  if (cmd.type === 'selectTool') return toolReason(state, cmd.tool);
  if (state.paused) return 'Resume the job first.';
  if (cmd.type === 'toggleActive') return state.active ? null : actionReason(state);
  if (cmd.type === 'openLid') return state.stage === 'SETUP' && !state.lidOpen ? null : 'The lid is already open or the job has moved on.';
  if (cmd.type === 'connect') return state.stage === 'SETUP' && state.lidOpen && !state.connected ? null : 'Open the lid before connecting the hose.';
  if (cmd.type === 'inspect') return state.stage === 'INLET' && !state.inlet.inspected ? null : 'Inspect the inlet during the inlet stage.';
  if (cmd.type === 'continueMix') {
    if (state.stage !== 'DRAWDOWN') return 'Draw down the water before continuing to mixing.';
    return mixingAllowed(state) ? null : 'Not enough water: add water with the garden hose until the 1.5× minimum is met.';
  }
  if (cmd.type === 'sayPhrase') return ['MIX','SLURRY','WASH','FINAL_PUMP','CLEANUP','INVOICE'].includes(state.stage) ? null : 'Make the poop smoothie first.';
  if (cmd.type === 'stow') {
    if (state.stage !== 'CLEANUP' || !finalChecks(state).every(check => check.ok)) return 'Finish the tank cleanup checks before stowing.';
    if (state.active) return 'Stop all tools before stowing.';
    return state.stowed ? 'Tools are already stowed.' : null;
  }
  if (cmd.type === 'closeLid') return state.stage === 'CLEANUP' && state.stowed && !state.lidClosed && !state.active ? null : 'Stow the tools before closing the lid.';
  if (cmd.type === 'invoice') return state.stage === 'CLEANUP' && state.stowed && state.lidClosed && !state.active && finalChecks(state).every(check => check.ok) ? null : 'Finish cleanup, stow tools, and close the lid before issuing the invoice.';
  return 'Unknown command.';
}

export function command(state: JobState, cmd: Command): boolean {
  const reason = commandReason(state, cmd);
  if (reason) { emit(state, reason, 'warning'); return false; }
  switch (cmd.type) {
    case 'start': state.started = true; state.paused = false; emit(state, 'First things first: open the lid and connect the vacuum hose.'); break;
    case 'selectTool': {
      state.active = false; state.flow = 0; state.tool = cmd.tool;
      state.target = cmd.tool === 'vacuum' ? state.stage === 'SCUM' ? 'surface' : 'liquid' : cmd.tool === 'wipes' ? 'surface' : cmd.tool === 'inlet' ? 'inlet' : cmd.tool === 'mixer' ? 'bottom' : state.stage === 'WASH' || state.stage === 'FINAL_PUMP' ? 'wall0' : 'liquid';
      break;
    }
    case 'selectTarget': state.active = false; state.flow = 0; state.target = cmd.target; break;
    case 'setThrottle': state.throttle = Math.min(1, Math.max(0, cmd.value)); break;
    case 'setAirBreak': state.airBreak = Math.min(1, Math.max(0, cmd.value)); break;
    case 'toggleActive':
      state.active = !state.active;
      if (!state.active) state.flow = 0;
      if (state.active && state.tool === 'hose' && state.target.startsWith('wall') && state.stage === 'FINAL_PUMP') state.stage = 'WASH';
      if (state.active && state.tool === 'vacuum' && state.stage === 'WASH') state.stage = 'FINAL_PUMP';
      break;
    case 'stop': state.active = false; state.flow = 0; break;
    case 'pause': state.paused = true; state.active = false; state.flow = 0; break;
    case 'resume': state.paused = false; state.active = false; state.flow = 0; break;
    case 'openLid': state.lidOpen = true; emit(state, 'Lid open. Stay outside the tank. Connect the vacuum hose.'); break;
    case 'connect': state.connected = true; emit(state, 'Vacuum hose connected.'); break;
    case 'inspect': state.inlet.inspected = true; emit(state, `Inlet T inspected: blockage strength ${state.inlet.initialStrength}. Use the inlet clearing tool.`); break;
    case 'continueMix': state.active = false; state.flow = 0; state.stage = 'MIX'; state.tool = 'mixer'; state.target = 'bottom'; emit(state, 'Mix the settled solids with the crust buster. Keep enough water in the tank.'); break;
    case 'sayPhrase': state.tutorial.phrase = true; emit(state, 'Smells like money!', 'success'); break;
    case 'stow': state.stowed = true; state.connected = false; emit(state, 'Tools stowed. Close the lid to finish the job.', 'success'); break;
    case 'closeLid': state.lidClosed = true; state.lidOpen = false; emit(state, 'Lid closed. Ready for the fictional invoice.', 'success'); break;
    case 'invoice': state.stage = 'INVOICE'; awardFee(state, 'base_service'); emit(state, `Job complete. ${invoiceTotal(state)} fictional credits. A little dirty work, done right.`, 'success'); break;
  }
  return true;
}
