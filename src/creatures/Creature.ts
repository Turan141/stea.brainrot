import * as THREE from "three";
import type { Carryable } from "../player/Player.ts";
import type { CreatureDef } from "./types.ts";

export type CreatureState = "idle" | "carried" | "stored";

/**
 * A spawned creature instance. Wraps a loaded model and adds idle motion.
 * Implements Carryable so the player can pick it up and the base can store it.
 */
export class Creature implements Carryable {
  state: CreatureState = "idle";
  readonly value: number;
  private baseY = 0;
  private phase = 0;

  constructor(
    readonly def: CreatureDef,
    readonly mesh: THREE.Object3D
  ) {
    this.value = def.income;
    this.phase = (def.seed % 100) / 10;
  }

  setPosition(x: number, y: number, z: number) {
    this.baseY = y;
    this.mesh.position.set(x, y, z);
  }

  /** Idle bob + slow spin while sitting in the world or on a pedestal. */
  update(dt: number) {
    this.phase += dt;
    if (this.state === "carried") return;
    this.mesh.position.y = this.baseY + Math.sin(this.phase * 2) * 0.18;
    this.mesh.rotation.y += dt * 0.6;
  }
}
