import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { KinematicBody } from "../physics/KinematicBody.ts";
import { damp } from "../utils/math.ts";

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

  // The visual sits inside `rig` (a child of mesh), so we can apply a
  // procedural walk (bob / sway / lean) without disturbing the body transform.
  private readonly rig: THREE.Group;
  private placeholder: THREE.Object3D[] = [];
  private walkPhase = 0;
  private idleT = 0;
  private animBob = 0;
  private animSway = 0;
  private animLean = 0;

  constructor(scene: THREE.Scene) {
    const { radius, height, color } = CONFIG.player;
    this.body = new KinematicBody(radius, height);
    this.mesh = new THREE.Group();
    this.rig = new THREE.Group();
    this.mesh.add(this.rig);

    const bodyMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, height - radius * 2, 8, 16),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
    );
    bodyMesh.position.y = height / 2;
    bodyMesh.castShadow = true;
    this.rig.add(bodyMesh);

    // facing marker
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, height * 0.62, radius + 0.05);
    this.rig.add(nose);
    this.placeholder = [bodyMesh, nose];

    scene.add(this.mesh);
  }

  /** Swap the placeholder capsule for a loaded character model. */
  setModel(model: THREE.Object3D) {
    for (const o of this.placeholder) this.rig.remove(o);
    this.placeholder = [];
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = true;
    });
    this.rig.add(model);
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
  syncVisual(dt = 0) {
    this.mesh.position.copy(this.body.position);
    this.mesh.rotation.y = this.facing;
    this.animateLocomotion(dt);

    const gap = 0.7;
    const startY = CONFIG.player.height + 0.4;
    for (let i = 0; i < this.carried.length; i++) {
      const m = this.carried[i].mesh;
      m.position.set(this.body.position.x, this.body.position.y + startY + i * gap, this.body.position.z);
      m.rotation.y += 0.04;
    }
  }

  /**
   * Procedural walk cycle applied to the rig (works on any static model): a
   * speed-scaled stride drives a vertical bob, a left/right roll and a forward
   * lean; when idle it eases to a gentle breathing bob. All targets are damped
   * so starts/stops blend smoothly.
   */
  private animateLocomotion(dt: number) {
    if (dt <= 0) return;
    const hv = Math.hypot(this.body.velocity.x, this.body.velocity.z);
    const k = Math.min(hv / this.walkSpeed, 1.4); // 0..~1.4 (sprint overshoots)
    const moving = k > 0.06 && this.body.grounded;

    let bob = 0;
    let sway = 0;
    let lean = 0;
    if (moving) {
      // cadence rises with speed; vertical bob is double-frequency (two per stride)
      this.walkPhase += dt * (5 + hv * 1.1);
      bob = 0.075 * k * Math.abs(Math.sin(this.walkPhase));
      sway = 0.11 * k * Math.sin(this.walkPhase);
      lean = 0.16 * k + 0.04 * k * Math.sin(this.walkPhase * 2);
    } else if (!this.body.grounded) {
      lean = 0.12; // slight forward tuck while airborne
    } else {
      this.idleT += dt;
      bob = 0.018 * Math.sin(this.idleT * 2.2); // breathing
    }

    const s = damp(11, dt);
    this.animBob += (bob - this.animBob) * s;
    this.animSway += (sway - this.animSway) * s;
    this.animLean += (lean - this.animLean) * s;

    this.rig.position.y = this.animBob;
    this.rig.rotation.z = this.animSway;
    this.rig.rotation.x = this.animLean;
  }
}
