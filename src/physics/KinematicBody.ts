import * as THREE from "three";
import { CONFIG } from "../config.ts";

/**
 * Lightweight kinematic body: integrates velocity under gravity and resolves
 * against a per-frame ground height (sampled from the World). No rigid-body
 * library — arcade platformer feel, fully deterministic.
 */
export class KinematicBody {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  grounded = false;

  /** Ground height under the body this frame (set by the World each step). */
  groundY = 0;

  constructor(
    public radius: number,
    public height: number
  ) {}

  /** Apply gravity + integrate. Horizontal velocity is set by the controller. */
  integrate(dt: number) {
    this.velocity.y -= CONFIG.physics.gravity * dt;
    if (this.velocity.y < -CONFIG.physics.maxFallSpeed) {
      this.velocity.y = -CONFIG.physics.maxFallSpeed;
    }
    this.position.addScaledVector(this.velocity, dt);
    this.resolveGround();
  }

  private resolveGround() {
    const floor = this.groundY;
    if (this.position.y <= floor + CONFIG.physics.groundEpsilon) {
      this.position.y = floor;
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
  }

  /** Clamp position into an axis-aligned XZ rectangle (arena/zone bounds). */
  clampXZ(minX: number, maxX: number, minZ: number, maxZ: number) {
    const r = this.radius;
    this.position.x = THREE.MathUtils.clamp(this.position.x, minX + r, maxX - r);
    this.position.z = THREE.MathUtils.clamp(this.position.z, minZ + r, maxZ - r);
  }
}
