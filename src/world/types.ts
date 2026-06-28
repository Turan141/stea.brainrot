import * as THREE from "three";

/** Axis-aligned box used for support surfaces, hazards and force regions. */
export class Box {
  /** Per-frame movement of this surface (moving platforms set these). */
  dx = 0;
  dz = 0;

  constructor(
    public cx: number,
    public cy: number,
    public cz: number,
    public hx: number,
    public hy: number,
    public hz: number
  ) {}

  get top(): number {
    return this.cy + this.hy;
  }

  containsXZ(x: number, z: number, margin = 0): boolean {
    return Math.abs(x - this.cx) <= this.hx + margin && Math.abs(z - this.cz) <= this.hz + margin;
  }

  /** Sphere (player) vs box overlap test. */
  intersectsSphere(p: THREE.Vector3, r: number): boolean {
    const dx = Math.max(Math.abs(p.x - this.cx) - this.hx, 0);
    const dy = Math.max(Math.abs(p.y - this.cy) - this.hy, 0);
    const dz = Math.max(Math.abs(p.z - this.cz) - this.hz, 0);
    return dx * dx + dy * dy + dz * dz <= r * r;
  }
}

export interface MovementModifier {
  windX: number;
  windZ: number;
  icy: boolean;
  jumpBoost: number; // upward velocity to apply this frame (jump pads)
}

/** A region the player must reach to capture a creature. */
export interface CapturePoint {
  position: THREE.Vector3;
  radius: number;
}

/** Implemented by every obstacle. Anything optional returns nothing. */
export interface Obstacle {
  update(dt: number, t: number): void;
  supports?(): Box[]; // standable tops (moving platforms move their box)
  hazards?(): Box[]; // touching = respawn
  windZones?(): { box: Box; x: number; z: number }[];
  iceZones?(): Box[];
  jumpPads?(): { box: Box; power: number }[];
}
