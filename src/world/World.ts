import * as THREE from "three";
import { ZoneManager } from "./ZoneManager.ts";
import { Box, type MovementModifier } from "./types.ts";
import type { Zone } from "./Zone.ts";

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

  /** Support the player landed on this frame (for moving-platform ride). */
  lastSupport: Box | null = null;

  constructor(
    private scene: THREE.Scene,
    size = 130
  ) {
    const half = size / 2;
    this.bounds = { minX: -half, maxX: half, minZ: -half, maxZ: half };

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: 0x121a30, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(size, size / 4, 0x2c3a5e, 0x1c2440);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    grid.position.y = 0.01;
    this.scene.add(grid);

    // Home base platform (visual anchor / safe area)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 12, 0.5, 32),
      new THREE.MeshStandardMaterial({ color: 0x1c2c4e, roughness: 0.8, emissive: 0x0c1830, emissiveIntensity: 0.4 })
    );
    base.position.set(0, 0.05, 8);
    base.receiveShadow = true;
    this.scene.add(base);

    this.zoneManager = new ZoneManager(this.scene);
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
