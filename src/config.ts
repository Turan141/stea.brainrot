/**
 * Central tunables. Plain (non-`as const`) object so values stay `number`
 * and can be mutated/derived freely by systems.
 */
export const CONFIG = {
  render: {
    fov: 60,
    near: 0.1,
    far: 600,
    pixelRatioCap: 2,
    background: 0x0b0f1a,
    fog: { color: 0x0b0f1a, near: 70, far: 220 },
    shadowMapSize: 2048,
  },

  physics: {
    gravity: 38, // units/s^2 (snappy, arcade-y)
    maxFallSpeed: 60,
    groundEpsilon: 0.02,
  },

  player: {
    radius: 0.6,
    height: 1.7,
    color: 0x4fa3ff,

    walkSpeed: 9,
    sprintSpeed: 16,
    carrySlowdownPerItem: 0.08, // each carried creature slows you (capped)
    carryMinFactor: 0.45, // never slower than this fraction of walk speed
    accel: 60, // ground acceleration toward target velocity
    airAccel: 18,
    friction: 12,

    jumpSpeed: 14,
    maxJumps: 1, // +1 when double-jump upgrade owned
    dashSpeed: 34,
    dashDuration: 0.16,
    dashCooldown: 0.9,

    staminaMax: 100,
    sprintDrain: 28, // per second
    dashCost: 25,
    staminaRegen: 22, // per second when not sprinting
  },

  camera: {
    distance: 14,
    height: 9,
    lerp: 8,
    lookLerp: 10,
  },

  base: {
    incomeRatePerValue: 0.5, // $/sec per unit of stored creature value
    gridCols: 6,
    gridGap: 1.8,
    autosaveInterval: 5,
  },

  capture: {
    respawnDelay: 1.0, // seconds after a creature is taken before next appears
    bobHeight: 0.25,
  },
};

export type Config = typeof CONFIG;
