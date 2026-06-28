import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { clamp, damp, lerpAngle } from "../utils/math.ts";
import type { Input } from "../engine/Input.ts";
import type { Player } from "./Player.ts";
import type { MovementModifier } from "../world/types.ts";

/**
 * Translates input into movement: camera-relative steering, acceleration,
 * sprint (stamina-gated, disabled while carrying), jump + double jump, dash.
 */
export class PlayerController {
  private move2 = new THREE.Vector2();
  private fwd = new THREE.Vector3();
  private right = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private dashDir = new THREE.Vector3(0, 0, 1);

  /** Set true once the dash upgrade is owned. */
  dashUnlocked = false;

  update(dt: number, input: Input, player: Player, camera: THREE.Camera, mod: MovementModifier) {
    const body = player.body;

    // Camera-relative basis on the XZ plane
    camera.getWorldDirection(this.fwd);
    this.fwd.y = 0;
    this.fwd.normalize();
    this.right.set(-this.fwd.z, 0, this.fwd.x); // screen-right on the XZ plane

    input.moveVector(this.move2);
    const hasInput = this.move2.lengthSq() > 0.0001;

    this.desired.set(0, 0, 0);
    if (hasInput) {
      this.desired.addScaledVector(this.fwd, this.move2.y);
      this.desired.addScaledVector(this.right, this.move2.x);
      this.desired.normalize();
    }

    // Sprint gating
    const wantSprint = input.isDown("sprint") && hasInput && !player.isCarrying && player.stamina > 1;
    const sprinting = wantSprint;
    const maxSpeed = player.currentMaxSpeed(sprinting);

    // Dash trigger
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    if (
      input.justPressed("dash") &&
      this.dashUnlocked &&
      player.dashTimer <= 0 &&
      player.dashCooldown <= 0 &&
      player.stamina >= CONFIG.player.dashCost
    ) {
      player.dashTimer = CONFIG.player.dashDuration;
      player.dashCooldown = CONFIG.player.dashCooldown;
      player.stamina -= CONFIG.player.dashCost;
      this.dashDir.copy(hasInput ? this.desired : this.fwd).normalize();
    }

    // Horizontal velocity
    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      body.velocity.x = this.dashDir.x * player.dashSpeed;
      body.velocity.z = this.dashDir.z * player.dashSpeed;
    } else {
      let accel = body.grounded ? CONFIG.player.accel : CONFIG.player.airAccel;
      let friction = CONFIG.player.friction;
      if (mod.icy) {
        accel *= 0.35; // sluggish to change direction
        friction *= 0.12; // and very slippery
      }
      const targetX = this.desired.x * maxSpeed;
      const targetZ = this.desired.z * maxSpeed;
      if (hasInput) {
        body.velocity.x += (targetX - body.velocity.x) * clamp(accel * dt, 0, 1);
        body.velocity.z += (targetZ - body.velocity.z) * clamp(accel * dt, 0, 1);
      } else if (body.grounded) {
        const f = 1 - clamp(friction * dt, 0, 1);
        body.velocity.x *= f;
        body.velocity.z *= f;
      }
    }

    // Wind pushes regardless of input / grounded state
    body.velocity.x += mod.windX * dt;
    body.velocity.z += mod.windZ * dt;

    // Jump + double jump
    if (body.grounded) player.jumpsLeft = player.maxJumps;
    if (input.justPressed("jump") && player.jumpsLeft > 0) {
      body.velocity.y = player.jumpSpeed;
      player.jumpsLeft--;
      body.grounded = false;
    }

    // Stamina
    if (sprinting) {
      player.stamina = clamp(player.stamina - CONFIG.player.sprintDrain * dt, 0, player.staminaMax);
    } else {
      player.stamina = clamp(player.stamina + CONFIG.player.staminaRegen * dt, 0, player.staminaMax);
    }

    // Facing follows horizontal velocity
    const hv = Math.hypot(body.velocity.x, body.velocity.z);
    if (hv > 0.5) {
      const target = Math.atan2(body.velocity.x, body.velocity.z);
      player.facing = lerpAngle(player.facing, target, damp(14, dt));
    }
  }
}
