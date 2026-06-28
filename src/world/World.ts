import * as THREE from "three";
import { ZoneManager } from "./ZoneManager.ts";
import { Box, type MovementModifier } from "./types.ts";
import type { Zone } from "./Zone.ts";
import { CONFIG } from "../config.ts";
import { grassTexture, plazaTexture } from "./textures.ts";
import { BaseBlockout } from "./BaseBlockout.ts";

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const STEP = 0.4; // how far above a surface the body can be and still land on it

/**
 * The playfield. Flat safe ground at y=0; obstacle courses (zones) layer
 * elevated platforms, hazards and force fields on top. Aggregates collision
 * queries the player physics needs each frame.
 */
export class World {
  readonly bounds: Bounds;
  readonly zoneManager: ZoneManager;
  private blockout!: BaseBlockout;

  /** Base structures the follow-camera should pull in front of (avoid occlusion). */
  get occluders(): THREE.Object3D[] {
    return this.blockout.obstacles;
  }

  /** Swap blockout placeholders for generated models where available. */
  applyBuildingModels(assets: { instance(id: string, targetSize: number): THREE.Object3D | null }) {
    this.blockout.applyModels(assets);
  }

  /** World position of a base building (for proximity interactions). */
  buildingPosition(id: string): THREE.Vector3 | null {
    return this.blockout.buildingPosition(id);
  }

  /** Support the player landed on this frame (for moving-platform ride). */
  lastSupport: Box | null = null;

  /** Walkable height of the home deck (0 until built). */
  private baseTop = 0;

  constructor(
    private scene: THREE.Scene,
    size = 240
  ) {
    const half = size / 2;
    this.bounds = { minX: -half, maxX: half, minZ: -half, maxZ: half };

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ map: grassTexture(size / 16), roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.buildBase();
    this.blockout = new BaseBlockout(this.scene);

    this.zoneManager = new ZoneManager(this.scene);
  }

  /**
   * Wide wooden home deck spanning the bottom of the field, with a stone rim.
   * Low enough (deckTop ≤ player step) to walk onto; registered as a standable
   * surface in {@link sampleGround} so the player stands on top of it.
   */
  private buildBase() {
    const { centerX, centerZ, halfWidth, halfDepth, deckTop } = CONFIG.base;
    const w = halfWidth * 2;
    const d = halfDepth * 2;
    this.baseTop = deckTop;

    // stone rim (slightly larger, forms a low curb around the deck)
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 2.4, deckTop + 0.2, d + 2.4),
      new THREE.MeshStandardMaterial({ color: 0x6a7486, roughness: 0.9 })
    );
    rim.position.set(centerX, (deckTop + 0.2) / 2 - 0.05, centerZ);
    rim.receiveShadow = true;
    this.scene.add(rim);

    // stone-plaza deck top (top face at y = deckTop)
    const deckMat = new THREE.MeshStandardMaterial({ map: plazaTexture(), roughness: 0.8 });
    (deckMat.map as THREE.Texture).repeat.set(w / 12, d / 12);
    const deckH = 0.6;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, deckH, d), deckMat);
    deck.position.set(centerX, deckTop - deckH / 2, centerZ);
    deck.receiveShadow = true;
    this.scene.add(deck);

    // glowing front edge line (faces the field, marks the drop-off zone)
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.1, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x4f8fff, emissive: 0x2f6fe0, emissiveIntensity: 1.2 })
    );
    edge.position.set(centerX, deckTop + 0.06, centerZ - halfDepth + 0.2);
    this.scene.add(edge);

    // corner posts for a framed look
    const postMat = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.8 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.4, 0.7), postMat);
        post.position.set(centerX + sx * (halfWidth - 0.6), deckTop + 1.2, centerZ + sz * (halfDepth - 0.6));
        post.castShadow = true;
        this.scene.add(post);
      }
    }
  }

  get zones(): Zone[] {
    return this.zoneManager.zones;
  }

  update(dt: number, t: number) {
    this.zoneManager.update(dt, t);
  }

  /** Highest standable surface under (x,z) at/below the body (ground = 0). */
  sampleGround(x: number, z: number, belowY: number): number {
    let best = 0;
    let support: Box | null = null;

    // the home deck is a standable raised surface
    const { centerX, centerZ, halfWidth, halfDepth } = CONFIG.base;
    if (
      this.baseTop > best &&
      this.baseTop <= belowY + STEP &&
      Math.abs(x - centerX) <= halfWidth &&
      Math.abs(z - centerZ) <= halfDepth
    ) {
      best = this.baseTop;
    }

    for (const zone of this.zones) {
      for (const o of zone.obstacles) {
        const sups = o.supports?.();
        if (!sups) continue;
        for (const b of sups) {
          if (b.containsXZ(x, z) && b.top <= belowY + STEP && b.top >= best) {
            best = b.top;
            support = b;
          }
        }
      }
    }
    this.lastSupport = support;
    return best;
  }

  /** Wind / ice / jump-pad effects at the player's position. */
  sampleModifiers(pos: THREE.Vector3, radius: number, grounded: boolean): MovementModifier {
    const mod: MovementModifier = { windX: 0, windZ: 0, icy: false, jumpBoost: 0 };
    for (const zone of this.zones) {
      for (const o of zone.obstacles) {
        const winds = o.windZones?.();
        if (winds) {
          for (const w of winds) {
            if (w.box.intersectsSphere(pos, radius)) {
              mod.windX += w.x;
              mod.windZ += w.z;
            }
          }
        }
        const ices = o.iceZones?.();
        if (ices) {
          for (const b of ices) if (b.intersectsSphere(pos, radius)) mod.icy = true;
        }
        if (grounded) {
          const pads = o.jumpPads?.();
          if (pads) {
            for (const p of pads) {
              if (p.box.containsXZ(pos.x, pos.z) && Math.abs(pos.y - p.box.top) < 0.6) {
                mod.jumpBoost = Math.max(mod.jumpBoost, p.power);
              }
            }
          }
        }
      }
    }
    return mod;
  }

  /** True if the player touches any active hazard. */
  checkHazard(pos: THREE.Vector3, radius: number): boolean {
    for (const zone of this.zones) {
      for (const o of zone.obstacles) {
        const hz = o.hazards?.();
        if (!hz) continue;
        for (const b of hz) if (b.intersectsSphere(pos, radius)) return true;
      }
    }
    return false;
  }
}
