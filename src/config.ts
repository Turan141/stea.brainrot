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
    distance: 10.5, // closer third-person framing
    height: 7.5,
    lerp: 8,
    lookLerp: 10,
  },

  base: {
    centerX: 0,
    centerZ: 92, // player base: a deck filling the near (+Z) bottom of the larger field
    halfWidth: 72, // platform spans x ∈ [-72, 72]
    halfDepth: 28, // platform spans z ∈ [64, 120] — reaches the bottom edge
    deckTop: 0.3, // walkable height of the deck surface (≤ player step height)
    incomeRatePerValue: 0.5, // $/sec per unit of stored creature value
    softCapCount: 8, // first N creatures (by value) pay full income…
    overCapFactor: 0.4, // …each beyond that pays only this fraction (push active play)
    // creature pens: 4 quadrant clusters around a plus-shaped avenue, one
    // creature per cage. maxCapacity = 4 * quadCols * quadRows.
    maxCapacity: 16,
    quadCols: 2, // cages per quadrant along x
    quadRows: 2, // cages per quadrant along z
    cageCell: 7, // spacing between cage centers within a quadrant
    pathHalf: 3.6, // half-width of the central + cross avenues
    penHalf: 1.0, // half-extent of the wander area inside a cage
    sellPriceFactor: 12, // sell refund = round(creature.value * this)
    autosaveInterval: 5,
  },

  // NPC rival bases flank the avenue (wired in D3; visual placeholders now)
  rivals: [
    { id: "rival-a", x: -28, z: 4 },
    { id: "rival-b", x: 28, z: 4 },
  ],

  capture: {
    respawnDelay: 1.0, // seconds after a creature is taken before next appears
    bobHeight: 0.25,
  },

  avenue: {
    halfWidth: 7, // gate / entrance width reference (x half-width)
  },

  // Horizontal "parade" road in front of the base: creatures spawn at the left,
  // walk right past the gate, and despawn at the right end.
  parade: {
    z: 56, // sits in front of the base (front wall at z≈64), outside the walls
    halfLen: 64, // road spans x ∈ [-64, 64]
    width: 6, // z-depth of the lane
    margin: 3, // spawn/despawn distance past each end
  },

  // Splice Lab (fusion). Burn 2 parents + Gene Cells → a new hybrid after a
  // cooldown. Child element by the fusion matrix; rarity can gamble up.
  fusion: {
    costGene: 3, // Gene Cells per splice
    cooldownSec: 30, // lab busy time
    startingGene: 6, // granted on a fresh save
    geneOnSell: 1, // Gene Cells earned when selling a creature
    geneOnCapture: 1, // … and when delivering a captured creature
    upChanceBase: 0.22, // base chance the child rises one rarity
    upChancePerPity: 0.06, // added per consecutive no-up splice
    interactRadius: 4.5,
  },

  conveyor: {
    speed: 2.2, // units/sec capsules travel
    spawnInterval: 3.5, // seconds between new offers
    maxOffers: 4, // capsules on the belt at once
    priceFactor: 25, // price = round(income * priceFactor)
    interactRadius: 3.4, // how close to buy (reach the parade lane from the base side)
    pityAfter: 6, // offers without a rare+ before one is forced
  },
};

export type Config = typeof CONFIG;
