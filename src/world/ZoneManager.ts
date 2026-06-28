import * as THREE from "three";
import { Zone } from "./Zone.ts";
import {
  StaticPlatform,
  MovingPlatform,
  DisappearingPlatform,
  RotatingBeam,
  SwingingHammer,
  Spikes,
  Laser,
  JumpPad,
  WindZone,
  IceZone,
} from "./obstacles.ts";

/**
 * Builds the concrete zones. Each is a progressively harder course that climbs
 * to an elevated capture pad. The ground is safe; difficulty comes from hazards
 * (respawn on touch) and the vertical traversal needed to reach the pad.
 */
export class ZoneManager {
  readonly zones: Zone[] = [];

  constructor(scene: THREE.Scene) {
    this.zones.push(this.buildZone1());
    this.zones.push(this.buildZone2());
    this.zones.push(this.buildZone3());
    for (const z of this.zones) scene.add(z.group);
  }

  update(dt: number, t: number) {
    for (const z of this.zones) z.update(dt, t);
  }

  // --- Zone 1: Sunny Steps (level 1) ---
  private buildZone1(): Zone {
    const z = new Zone("zone-1", "Sunny Steps", 1, 1, new THREE.Vector3(0, 0, -14), new THREE.Vector3(0, 4.5, -34));
    const g = z.group;

    z.add(new Spikes(g, 0, -20, 5, 3));
    z.add(new JumpPad(g, -4, 0.25, -20, 18));
    // climbing steps to the pad
    z.add(new StaticPlatform(g, 0, 1, -24, 6, 4));
    z.add(new StaticPlatform(g, 0, 2.2, -28, 5, 4, true)); // narrow bridge
    z.add(new SwingingHammer(g, 0, 5.5, -28, 5, 1.4, 1.0));
    z.add(new StaticPlatform(g, 0, 3.4, -31, 5, 3));
    z.add(new StaticPlatform(g, 0, 4.5, -34, 6, 6)); // pad platform
    return z;
  }

  // --- Zone 2: Frost Gauntlet (level 2) ---
  private buildZone2(): Zone {
    const z = new Zone("zone-2", "Frost Gauntlet", 2, 2, new THREE.Vector3(-26, 0, 0), new THREE.Vector3(-50, 5, 0));
    const g = z.group;

    z.add(new IceZone(g, -32, 0.4, 0, 10, 8));
    z.add(new Laser(g, -32, 1.4, 0, 8, 2.2, 0));
    z.add(new Laser(g, -38, 2.0, 0, 8, 2.2, 1.1));
    z.add(new DisappearingPlatform(g, -40, 1.5, 0, 2.2, 0, 5, 5));
    z.add(new MovingPlatform(g, new THREE.Vector3(-44, 2.5, -4), new THREE.Vector3(-44, 2.5, 4), 0.5, 4, 4));
    z.add(new StaticPlatform(g, -47, 3.5, 0, 5, 5));
    z.add(new SwingingHammer(g, -47, 7, 0, 6, 1.8, 1.1));
    z.add(new StaticPlatform(g, -50, 5, 0, 6, 6));
    return z;
  }

  // --- Zone 3: Storm Spire (level 3) ---
  private buildZone3(): Zone {
    const z = new Zone("zone-3", "Storm Spire", 3, 3, new THREE.Vector3(26, 0, 0), new THREE.Vector3(52, 7, 0));
    const g = z.group;

    z.add(new WindZone(g, 34, 3, 0, 10, 6, 12, 0, 6));
    z.add(new RotatingBeam(g, 34, 1.2, 0, 10, 1.4));
    z.add(new JumpPad(g, 38, 0.25, 0, 24));
    z.add(new MovingPlatform(g, new THREE.Vector3(42, 3, 0), new THREE.Vector3(42, 6, 0), 0.45, 4, 4));
    z.add(new DisappearingPlatform(g, 46, 5.5, 0, 1.8, 0.4, 4, 4));
    z.add(new RotatingBeam(g, 49, 6, 0, 7, -1.8));
    z.add(new StaticPlatform(g, 52, 7, 0, 6, 6));
    return z;
  }
}
