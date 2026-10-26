import type { Command, JobState, Target, Tool } from './types';

const TOOLS: Tool[] = ['vacuum', 'wipes', 'inlet', 'mixer', 'hose'];

function targetsFor(state: JobState): Target[] {
  switch (state.tool) {
    case 'wipes': return ['surface'];
    case 'inlet': return ['inlet'];
    case 'mixer': return ['bottom'];
    case 'hose': return state.stage === 'WASH' || state.stage === 'FINAL_PUMP'
      ? ['liquid', 'wall0', 'wall1', 'wall2', 'wall3'] : ['liquid'];
    case 'vacuum': return state.stage === 'SCUM' ? ['surface'] : ['liquid', 'bottom'];
  }
}

/** Native controls keep all their own keyboard behavior, including Space/arrows. */
export function bindKeyboard(
  element: HTMLElement,
  send: (cmd: Command) => void,
  onPause: () => void,
  getState: () => JobState,
): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, select, textarea, button, a, summary, dialog, [contenteditable="true"], [role="slider"], [role="button"], [role="dialog"]')) return;
    if (target && target !== document.body && target !== element && !element.contains(target)) return;
    const state = getState();
    if (!state.started || state.stage === 'INVOICE') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!event.repeat) onPause();
      return;
    }
    if (state.paused) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) send({ type: 'toggleActive' });
      return;
    }
    const number = Number(event.key);
    if (Number.isInteger(number) && number >= 1 && number <= TOOLS.length) {
      event.preventDefault();
      if (!event.repeat) send({ type: 'selectTool', tool: TOOLS[number - 1] });
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const targets = targetsFor(state);
      const index = Math.max(0, targets.indexOf(state.target));
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      send({ type: 'selectTarget', target: targets[(index + direction + targets.length) % targets.length] });
    }
  };
  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}
