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
  private weapon: THREE.Group | null = null;
  private slash: THREE.Mesh | null = null;
  private attackTimer = 0;
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

    this.buildWeapon();
    scene.add(this.mesh);
  }

  /**
   * A held weapon attached to the rig (not a bone — the character GLB is
   * static), positioned at the right hand. Rides the walk bob/lean for free.
   */
  private buildWeapon() {
    const w = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9c4d6, roughness: 0.4, metalness: 0.6 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.9 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x35c9ff, emissiveIntensity: 1.6, roughness: 0.3 });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 8), grip);
    handle.position.y = 0.2;
    w.add(handle);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), steel);
    w.add(pommel);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.12), steel);
    guard.position.y = 0.42;
    w.add(guard);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.85, 0.05), glow);
    blade.position.y = 0.88;
    w.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 4), glow);
    tip.position.y = 1.36;
    w.add(tip);

    w.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = true;
    });
    // held at the right hand, blade up and angled slightly outward/forward
    w.position.set(0.48, 0.66, 0.16);
    w.rotation.set(0.14, 0, -0.22);
    this.weapon = w;
    this.rig.add(w);

    // a slashing arc that flashes during a swing (hidden otherwise)
    const slash = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.6, 18, 1, -0.3, 2.0),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    slash.rotation.set(0, Math.PI / 2, 0); // vertical arc in front of the hero
    slash.position.set(0.4, 1.0, 0.5);
    slash.visible = false;
    this.slash = slash;
    this.rig.add(slash);
  }

  /** Show/hide the held weapon. */
  setWeaponVisible(v: boolean) {
    if (this.weapon) this.weapon.visible = v;
  }

  /** Trigger a sword swing (ignored if mid-swing). */
  attack() {
    if (this.attackTimer <= 0) this.attackTimer = 0.45;
  }

  get isAttacking(): boolean {
    return this.attackTimer > 0;
  }

  /** Animate the swing: wind-up → fast chop → recover, with a slash flash. */
  private updateWeapon(dt: number) {
    if (!this.weapon) return;
    const baseX = 0.14;
    const baseZ = -0.22;
    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      const p = 1 - this.attackTimer / 0.45; // 0..1
      let rx = baseX;
      if (p < 0.3) rx = baseX - 1.6 * (p / 0.3); // wind up (raise back)
      else if (p < 0.6) rx = baseX - 1.6 + 3.2 * ((p - 0.3) / 0.3); // chop down
      else rx = baseX + 1.6 - 1.6 * ((p - 0.6) / 0.4); // recover
      this.weapon.rotation.set(rx, 0, baseZ);
      if (this.slash) {
        const inSlash = p > 0.3 && p < 0.62;
        const sm = this.slash.material as THREE.MeshBasicMaterial;
        sm.opacity = inSlash ? 0.9 * (1 - (p - 0.3) / 0.32) : 0;
        this.slash.visible = sm.opacity > 0.03;
      }
    } else {
      const s = damp(12, dt);
      this.weapon.rotation.x += (baseX - this.weapon.rotation.x) * s;
      this.weapon.rotation.z += (baseZ - this.weapon.rotation.z) * s;
      if (this.slash) this.slash.visible = false;
    }
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
    this.updateWeapon(dt);

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
