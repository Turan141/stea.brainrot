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

  /**
   * Decorate a zone: a themed entrance pad on the ground, a glowing capture
   * ring at the goal platform and a tall light beam so the goal reads from afar.
   */
  private decorate(z: Zone, entrance: THREE.Vector3, pad: THREE.Vector3, color: number) {
    const g = z.group;
    const c = new THREE.Color(color);

    // entrance arena disc + emissive outline
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(8, 40),
      new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.4), roughness: 0.8 })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(entrance.x, 0.03, entrance.z);
    disc.receiveShadow = true;
    g.add(disc);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(8, 0.18, 8, 48),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(entrance.x, 0.05, entrance.z);
    g.add(ring);

    // glowing capture ring hovering over the goal platform
    const goal = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.12, 8, 32),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4 })
    );
    goal.rotation.x = -Math.PI / 2;
    goal.position.set(pad.x, pad.y + 0.9, pad.z);
    g.add(goal);

    // tall translucent light beam at the goal
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 40, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.set(pad.x, pad.y + 20, pad.z);
    g.add(beam);
  }

  update(dt: number, t: number) {
    for (const z of this.zones) z.update(dt, t);
  }

  // --- Zone C (center, far): Sunny Steps (level 1) ---
  private buildZone1(): Zone {
    const z = new Zone("zone-1", "Sunny Steps", 1, 1, new THREE.Vector3(0, 0, -26), new THREE.Vector3(0, 4.5, -44));
    const g = z.group;

    z.add(new Spikes(g, 0, -30, 5, 3));
    z.add(new JumpPad(g, -4, 0.25, -30, 18));
    z.add(new StaticPlatform(g, 0, 1, -34, 6, 4));
    z.add(new StaticPlatform(g, 0, 2.2, -38, 5, 4, true)); // narrow bridge
    z.add(new SwingingHammer(g, 0, 5.5, -38, 5, 1.4, 1.0));
    z.add(new StaticPlatform(g, 0, 3.4, -41, 5, 3));
    z.add(new StaticPlatform(g, 0, 4.5, -44, 6, 6)); // pad platform
    this.decorate(z, new THREE.Vector3(0, 0, -26), new THREE.Vector3(0, 4.5, -44), 0xffce4f);
    return z;
  }

  // --- Zone L (left): Frost Gauntlet (level 2) ---
  private buildZone2(): Zone {
    const z = new Zone("zone-2", "Frost Gauntlet", 2, 2, new THREE.Vector3(-22, 0, -24), new THREE.Vector3(-48, 5, -28));
    const g = z.group;

    z.add(new IceZone(g, -30, 0.4, -26, 10, 8));
    z.add(new Laser(g, -30, 1.4, -26, 8, 2.2, 0));
    z.add(new Laser(g, -36, 2.0, -26, 8, 2.2, 1.1));
    z.add(new DisappearingPlatform(g, -39, 1.5, -26, 2.2, 0, 5, 5));
    z.add(new MovingPlatform(g, new THREE.Vector3(-43, 2.5, -31), new THREE.Vector3(-43, 2.5, -23), 0.5, 4, 4));
    z.add(new StaticPlatform(g, -45, 3.5, -28, 5, 5));
    z.add(new SwingingHammer(g, -45, 7, -28, 6, 1.8, 1.1));
    z.add(new StaticPlatform(g, -48, 5, -28, 6, 6));
    this.decorate(z, new THREE.Vector3(-30, 0, -26), new THREE.Vector3(-48, 5, -28), 0x6fd0ff);
    return z;
  }

  // --- Zone R (right): Storm Spire (level 3) ---
  private buildZone3(): Zone {
    const z = new Zone("zone-3", "Storm Spire", 3, 3, new THREE.Vector3(22, 0, -24), new THREE.Vector3(48, 7, -28));
    const g = z.group;

    z.add(new WindZone(g, 32, 3, -26, 10, 6, 12, 0, 6));
    z.add(new RotatingBeam(g, 32, 1.2, -26, 10, 1.4));
    z.add(new JumpPad(g, 36, 0.25, -26, 24));
    z.add(new MovingPlatform(g, new THREE.Vector3(40, 3, -26), new THREE.Vector3(40, 6, -26), 0.45, 4, 4));
    z.add(new DisappearingPlatform(g, 44, 5.5, -26, 1.8, 0.4, 4, 4));
    z.add(new RotatingBeam(g, 46, 6, -28, 7, -1.8));
    z.add(new StaticPlatform(g, 48, 7, -28, 6, 6));
    this.decorate(z, new THREE.Vector3(32, 0, -26), new THREE.Vector3(48, 7, -28), 0xb06fff);
    return z;
  }
}
