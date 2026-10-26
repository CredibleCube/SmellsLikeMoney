import { WORLD } from './config';
import type { JobState } from './types';

export type Station = keyof typeof WORLD.stations;

/** Release every held direction without teleporting or cancelling a jump in flight. */
export function clearMovement(state: JobState): void {
  const p = state.player;
  p.input.left = false; p.input.right = false; p.input.up = false; p.input.down = false;
  p.jumpQueued = false; p.vx = 0; p.crouching = false;
}

/** Pure, deterministic side-view movement. Feet always land on the outside path. */
export function updatePlayer(state: JobState, dt: number): void {
  const p = state.player;
  p.crouching = p.grounded && p.input.down;
  const direction = Number(p.input.right) - Number(p.input.left);
  const target = direction * (p.crouching ? WORLD.crouchSpeed : WORLD.speed);
  const change = WORLD.acceleration * dt;
  p.vx += Math.max(-change, Math.min(change, target - p.vx));
  if (direction) p.facing = direction < 0 ? -1 : 1;
  if (p.jumpQueued && p.grounded && !p.crouching) {
    p.vy = -WORLD.jumpSpeed; p.grounded = false;
  }
  // Each key-down is one jump request. Holding W does not auto-hop on landing.
  p.jumpQueued = false;
  const previousX = p.x;
  p.x = Math.min(WORLD.maxX, Math.max(WORLD.minX, p.x + p.vx * dt));
  if ((p.x === WORLD.minX && p.vx < 0) || (p.x === WORLD.maxX && p.vx > 0)) p.vx = 0;
  p.stride += Math.abs(p.x - previousX) * 0.09;
  if (!p.grounded) {
    p.vy += WORLD.gravity * dt;
    p.y += p.vy * dt;
    if (p.y >= WORLD.groundY) {
      p.y = WORLD.groundY; p.vy = 0; p.grounded = true;
    }
  } else {
    p.y = WORLD.groundY; p.vy = 0;
  }
}

/** Shared world guard for keys, mouse, buttons, and automated command clients. */
export function stationReason(state: JobState, station: Station): string | null {
  const p = state.player, place = WORLD.stations[station];
  if (!p.grounded || p.jumpQueued) return 'Land on the outside path before using a tool.';
  if (p.crouching || p.input.down) return 'Stand up before using a tool.';
  if (p.input.left || p.input.right || Math.abs(p.vx) > 5) return 'Release movement keys and stand still to use a tool.';
  if (Math.abs(p.x - place.x) > place.radius) {
    return `Walk ${p.x < place.x ? 'right' : 'left'} to the ${place.label}. Use A/D or ←/→, then press E.`;
  }
  return null;
}
