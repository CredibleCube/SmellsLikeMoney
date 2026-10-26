import type { Command, JobState, MoveDirection, Tool } from './types';

const TOOLS: Tool[] = ['vacuum', 'wipes', 'inlet', 'mixer', 'hose'];
const MOVEMENT_KEYS: Record<string, MoveDirection> = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
};
const DIRECTIONS: MoveDirection[] = ['left', 'right', 'up', 'down'];
const NATIVE_CONTROLS = 'input, select, textarea, button, a, summary, dialog, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="button"], [role="dialog"]';

export interface KeyboardBinding {
  /** Release movement without waiting for keyup, including an input-focus change. */
  clear(): void;
  releaseMovement(): void;
  dispose(): void;
}

function codeFor(event: KeyboardEvent): string {
  if (event.code) return event.code;
  if (/^[a-z]$/i.test(event.key)) return `Key${event.key.toUpperCase()}`;
  return event.key === ' ' ? 'Space' : event.key;
}

/** Held movement belongs to gameplay; native controls retain their own keys. */
export function bindKeyboard(
  element: HTMLElement,
  send: (cmd: Command) => void,
  onPause: () => void,
  getState: () => JobState,
): KeyboardBinding {
  const held = new Set<string>();
  const boostHeld = new Set<string>();
  let boostPublished = false;
  const published: Record<MoveDirection, boolean> = { left: false, right: false, up: false, down: false };

  const publishDirection = (direction: MoveDirection): void => {
    const pressed = [...held].some(code => MOVEMENT_KEYS[code] === direction);
    if (published[direction] === pressed) return;
    published[direction] = pressed;
    send({ type: 'move', direction, pressed });
  };
  const releaseMovement = (): void => {
    held.clear();
    for (const direction of DIRECTIONS) {
      const wasPressed = published[direction] || getState().player.input[direction];
      published[direction] = false;
      if (wasPressed) send({ type: 'move', direction, pressed: false });
    }
  };
  const releaseBoost = (): void => {
    boostHeld.clear();
    const wasBoosting = boostPublished || getState().work.boost;
    boostPublished = false;
    if (wasBoosting) send({ type: 'setBoost', pressed: false });
  };
  const clear = (): void => { releaseMovement(); releaseBoost(); };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(NATIVE_CONTROLS)) return;
    if (target && target !== document.body && target !== element && !element.contains(target)) return;
    const state = getState();
    if (!state.started || state.stage === 'INVOICE') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!event.repeat) { clear(); onPause(); }
      return;
    }
    if (state.paused) return;
    const code = codeFor(event);
    const direction = MOVEMENT_KEYS[code];
    if (direction) {
      event.preventDefault();
      // Ignore repeats after a pause/reset until the physical key is released.
      if (event.repeat) return;
      releaseBoost();
      held.add(code);
      publishDirection(direction);
      return;
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      event.preventDefault();
      if (event.repeat) return;
      boostHeld.add(code);
      if (!boostPublished) { boostPublished = true; send({ type: 'setBoost', pressed: true }); }
      return;
    }
    if (code === 'Space') {
      event.preventDefault();
      if (!event.repeat) { releaseMovement(); send({ type: 'toggleActive' }); }
      return;
    }
    if (code === 'KeyE') {
      event.preventDefault();
      if (!event.repeat) { releaseMovement(); send({ type: 'interact' }); }
      return;
    }
    const number = Number(event.key);
    if (Number.isInteger(number) && number >= 1 && number <= TOOLS.length) {
      event.preventDefault();
      if (!event.repeat) { clear(); send({ type: 'selectTool', tool: TOOLS[number - 1] }); }
      return;
    }
    if (code === 'KeyQ') {
      event.preventDefault();
      if (event.repeat) return;
      releaseMovement();
      send({ type: 'aimNext', reverse: event.shiftKey });
    }
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    const code = codeFor(event);
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      boostHeld.delete(code);
      if (!boostHeld.size && boostPublished) { boostPublished = false; send({ type: 'setBoost', pressed: false }); }
      return;
    }
    const direction = MOVEMENT_KEYS[code];
    if (!direction || !held.delete(code)) return;
    // Keyup must release a held direction even after focus moved to a button.
    publishDirection(direction);
  };
  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(NATIVE_CONTROLS)) {
      // These gameplay buttons deliberately manage boost/aim themselves. A
      // mouse focus event must not flip boost before its toggle reads state.
      if (target.closest('#boost, #next-spot, #interact, #activate')) releaseMovement();
      else clear();
    }
  };
  const onVisibilityChange = (): void => { if (document.hidden) clear(); };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('focusin', onFocusIn);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', onVisibilityChange);
  return {
    clear,
    releaseMovement,
    dispose: () => {
      clear();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
