export const CONFIG = {
  step: 1 / 60, maxFrameDelta: 0.1, maxCatchupSteps: 6, epsilon: 1e-6,
  capacity: 1000, baseFlow: 9, hoseRate: 12, mixRate: 8, washRate: 6,
  inletClearRate: 2, inletReleaseSeconds: 0.8, wipeRemoveSeconds: 2, clogClearSeconds: 2.5,
  throttle: 0.8, airBreak: 0.15, waterMinimum: 1.5, waterBand: [1.8, 2.2],
  initialWalls: [12, 12, 8, 8], fees: { base_service: 450, excess_wipes: 75, inlet_clear: 50 },
} as const;
export const ARCADE = {
  columns: 4, patchesPerWall: 3, boostFlow: 1.6, boostLoad: 1.3,
  comboSeconds: 6, comboCap: 5, patchPoints: 100, pickupPoints: 200,
  jumpBuffer: 0.12, jumpReleaseVelocity: -160,
  collectibles: [{ x: 180, y: 169 }, { x: 650, y: 169 }, { x: 1000, y: 169 }],
} as const;
export const STAGES = ['SETUP','SCUM','INLET','DRAWDOWN','MIX','SLURRY','WASH','FINAL_PUMP','CLEANUP','INVOICE'] as const;
export const WORLD = {
  width: 1100, height: 660, groundY: 278, minX: 58, maxX: 1042,
  startX: 650, speed: 175, crouchSpeed: 65, acceleration: 1200,
  gravity: 1050, jumpSpeed: 400,
  stations: {
    hatch: { x: 745, radius: 155, label: 'tank hatch' },
    inlet: { x: 925, radius: 120, label: 'inlet T' },
    truck: { x: 495, radius: 135, label: 'truck' },
  },
} as const;
