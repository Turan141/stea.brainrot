import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { KinematicBody } from "../physics/KinematicBody.ts";

/** Anything the player can pick up and carry to the base. */
export interface Carryable {
  mesh: THREE.Object3D;
  value: number;
}

/**
 * Player entity: visual mesh + kinematic body + mutable stats (driven by the
 * upgrade system) + the carried stack. Movement logic lives in the controller.
 */
export class Player {
  readonly mesh: THREE.Group;
  readonly body: KinematicBody;
  readonly carried: Carryable[] = [];

  // Stats — defaults from config, overwritten each frame from upgrades.
  walkSpeed = CONFIG.player.walkSpeed;
  sprintSpeed = CONFIG.player.sprintSpeed;
  jumpSpeed = CONFIG.player.jumpSpeed;
  maxJumps = CONFIG.player.maxJumps;
  dashSpeed = CONFIG.player.dashSpeed;
  staminaMax = CONFIG.player.staminaMax;
  magnetRadius = 0;
  carryCapacity = 5;
  carrySpeedFactor = 1; // upgrade improves carry penalty (1 = no help)

  // Runtime state
  stamina = CONFIG.player.staminaMax;
  jumpsLeft = 0;
  dashTimer = 0;
  dashCooldown = 0;
  facing = 0; // yaw

  private placeholder: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    const { radius, height, color } = CONFIG.player;
    this.body = new KinematicBody(radius, height);
    this.mesh = new THREE.Group();

    const bodyMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, height - radius * 2, 8, 16),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
    );
    bodyMesh.position.y = height / 2;
    bodyMesh.castShadow = true;
    this.mesh.add(bodyMesh);

    // facing marker
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, height * 0.62, radius + 0.05);
    this.mesh.add(nose);
    this.placeholder = [bodyMesh, nose];

    scene.add(this.mesh);
  }

  /** Swap the placeholder capsule for a loaded character model. */
  setModel(model: THREE.Object3D) {
    for (const o of this.placeholder) this.mesh.remove(o);
    this.placeholder = [];
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = true;
    });
    this.mesh.add(model);
  }

  get position(): THREE.Vector3 {
    return this.body.position;
  }

  get isCarrying(): boolean {
    return this.carried.length > 0;
  }

  get isFull(): boolean {
    return this.carried.length >= this.carryCapacity;
  }

  get carriedValue(): number {
    let v = 0;
    for (const c of this.carried) v += c.value;
    return v;
  }

  /** Effective ground speed accounting for the carry penalty. */
  currentMaxSpeed(sprinting: boolean): number {
    const base = sprinting ? this.sprintSpeed : this.walkSpeed;
    if (this.carried.length === 0) return base;
    const penalty = Math.min(
      1 - CONFIG.player.carryMinFactor,
      CONFIG.player.carrySlowdownPerItem * this.carried.length * (2 - this.carrySpeedFactor)
    );
    return base * (1 - penalty);
  }

  pickUp(item: Carryable) {
    this.carried.push(item);
  }

  unloadAll(): Carryable[] {
    return this.carried.splice(0, this.carried.length);
  }

  /** Sync mesh transform to body + stack carried items above the head. */
  syncVisual() {
    this.mesh.position.copy(this.body.position);
    this.mesh.rotation.y = this.facing;

    const gap = 0.7;
    const startY = CONFIG.player.height + 0.4;
    for (let i = 0; i < this.carried.length; i++) {
      const m = this.carried[i].mesh;
      m.position.set(this.body.position.x, this.body.position.y + startY + i * gap, this.body.position.z);
      m.rotation.y += 0.04;
    }
  }
}
