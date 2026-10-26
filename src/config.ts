export const CONFIG = {
  step: 1 / 60, maxFrameDelta: 0.1, maxCatchupSteps: 6, epsilon: 1e-6,
  capacity: 1000, baseFlow: 2.8, hoseRate: 4, mixRate: 2, washRate: 2,
  inletClearRate: 2, inletReleaseSeconds: 0.8, wipeRemoveSeconds: 2, clogClearSeconds: 2.5,
  throttle: 0.8, airBreak: 0.15, waterMinimum: 1.5, waterBand: [1.8, 2.2],
  initialWalls: [12, 12, 8, 8], fees: { base_service: 450, excess_wipes: 75, inlet_clear: 50 },
} as const;
export const STAGES = ['SETUP','SCUM','INLET','DRAWDOWN','MIX','SLURRY','WASH','FINAL_PUMP','CLEANUP','INVOICE'] as const;
