import { CONFIG } from './config';
import type { Fee, GameEvent, JobState } from './types';

export function emit(state: JobState, text: string, kind: GameEvent['kind'] = 'info'): void {
  const last = state.events.at(-1);
  if (last?.text === text) return;
  state.events.push({ tick: state.tick, text, kind });
  if (state.events.length > 80) state.events.shift();
}

export function awardFee(state: JobState, key: Fee['key']): void {
  if (state.fees.some(fee => fee.key === key)) return;
  const labels: Record<Fee['key'], string> = {
    base_service: 'Base pumping service', excess_wipes: 'Excess wipe removal', inlet_clear: 'Inlet T clearing',
  };
  state.fees.push({ key, label: labels[key], amount: CONFIG.fees[key] });
}

export function invoiceTotal(state: JobState): number {
  return state.fees.reduce((sum, fee) => sum + fee.amount, 0);
}
