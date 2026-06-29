import * as THREE from "three";
import type { Carryable } from "../player/Player.ts";
import type { CreatureDef } from "./types.ts";

export type CreatureState = "idle" | "carried" | "stored";

/**
 * A spawned creature instance. Wraps a loaded model, plays skeletal animation
 * if present, and carries a level that scales its passive income. Implements
 * Carryable so the player can pick it up and the base can store it.
 */
export class Creature implements Carryable {
  state: CreatureState = "idle";
  readonly baseIncome: number;
  level: number;

  private baseY = 0;
  private phase = 0;
  private label: THREE.Sprite | null = null;

  // wander-in-cage state (set via setPen when stored)
  private penCenter: THREE.Vector3 | null = null;
  private penHalf = 0;
  private wTarget = new THREE.Vector3();
  private wWait = 0;
  private wMoving = false;

  /** <1 for Arena clones (they earn less than a "real" captured creature). */
  cloneFactor: number;

  constructor(
    readonly def: CreatureDef,
    readonly mesh: THREE.Object3D,
    level = 1,
    cloneFactor = 1
  ) {
    this.baseIncome = def.income;
    this.level = level;
    this.cloneFactor = cloneFactor;
    this.phase = (def.seed % 100) / 10;
  }

  /** Leveled passive income (Lv1 = base, +50% of base per extra level). */
  get value(): number {
    return Math.round(this.baseIncome * (1 + (this.level - 1) * 0.5) * this.cloneFactor);
  }

  /** Cost to upgrade to the next level. */
  get upgradeCost(): number {
    return Math.max(1, Math.round(this.baseIncome * 12 * this.level));
  }

  setPosition(x: number, y: number, z: number) {
    this.baseY = y;
    this.mesh.position.set(x, y, z);
  }

  /** Confine the creature to a cage; it wanders within ±half of the center. */
  setPen(center: THREE.Vector3, half: number) {
    this.penCenter = center.clone();
    this.penHalf = half;
    this.baseY = center.y;
    this.mesh.position.set(center.x, center.y, center.z);
    this.pickWanderTarget();
    this.wWait = Math.random() * 1.5;
    this.wMoving = false;
  }

  private pickWanderTarget() {
    const c = this.penCenter!;
    this.wTarget.set(
      c.x + (Math.random() * 2 - 1) * this.penHalf,
      c.y,
      c.z + (Math.random() * 2 - 1) * this.penHalf
    );
  }

  levelUp() {
    this.level++;
    this.refreshLabel();
  }

  /** Show/refresh the "Lv N" label (called once the creature is on the base). */
  showLevelLabel() {
    this.refreshLabel();
  }

  private refreshLabel() {
    if (!this.label) {
      this.label = makeLabelSprite();
      this.label.position.y = 1.9;
      this.mesh.add(this.label);
    }
    drawLabel(this.label, `Lv ${this.level}`);
  }

  /** Idle bob + skeletal animation; wanders inside its cage when penned. */
  update(dt: number) {
    const mixer = this.mesh.userData.mixer as THREE.AnimationMixer | undefined;
    if (mixer) mixer.update(dt);

    this.phase += dt;
    if (this.state === "carried") return;

    if (this.state === "stored" && this.penCenter) {
      this.wander(dt);
      return;
    }
    this.mesh.position.y = this.baseY + Math.sin(this.phase * 2) * 0.12;
  }

  private wander(dt: number) {
    const pos = this.mesh.position;
    if (this.wMoving) {
      const dx = this.wTarget.x - pos.x;
      const dz = this.wTarget.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.15) {
        this.wMoving = false;
        this.wWait = 0.6 + Math.random() * 2.2; // pause between strolls
      } else {
        const speed = 1.3;
        pos.x += (dx / dist) * speed * dt;
        pos.z += (dz / dist) * speed * dt;
        // turn to face travel direction (smoothed)
        const want = Math.atan2(dx, dz);
        let diff = want - this.mesh.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.mesh.rotation.y += diff * Math.min(1, dt * 8);
      }
    } else {
      this.wWait -= dt;
      if (this.wWait <= 0) {
        this.pickWanderTarget();
        this.wMoving = true;
      }
    }
    // little hop while strolling, settle while idle
    const hop = this.wMoving ? Math.abs(Math.sin(this.phase * 8)) * 0.1 : 0;
    pos.y = this.baseY + hop;
  }
}

function makeLabelSprite(): THREE.Sprite {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
  sprite.scale.set(1.2, 0.45, 1);
  sprite.renderOrder = 998;
  return sprite;
}

function drawLabel(sprite: THREE.Sprite, text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 60;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(12,18,32,0.9)";
  ctx.beginPath();
  ctx.roundRect(6, 6, 148, 48, 12);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffd24b";
  ctx.stroke();
  ctx.fillStyle = "#ffd24b";
  ctx.font = "900 30px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 80, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  (sprite.material as THREE.SpriteMaterial).map?.dispose();
  (sprite.material as THREE.SpriteMaterial).map = tex;
  (sprite.material as THREE.SpriteMaterial).needsUpdate = true;
}
