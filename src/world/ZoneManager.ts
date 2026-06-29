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
   * Dress a zone: themed entrance portal (two crystal pillars + glowing lintel),
   * an entrance arena disc, floating crystals strung along the route, and a
   * layered glowing capture ring + light beam at the goal so it reads from afar.
   */
  private decorate(z: Zone, entrance: THREE.Vector3, pad: THREE.Vector3, color: number) {
    const g = z.group;
    const c = new THREE.Color(color);
    const emissive = (i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 });

    // entrance arena disc + emissive outline
    const disc = new THREE.Mesh(new THREE.CircleGeometry(8, 40), new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.35), roughness: 0.85 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(entrance.x, 0.03, entrance.z);
    disc.receiveShadow = true;
    g.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 0.18, 8, 48), emissive(0.9));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(entrance.x, 0.05, entrance.z);
    g.add(ring);

    // entrance portal: two crystal-topped pillars + a glowing lintel facing the field
    const toCenter = new THREE.Vector3(-entrance.x, 0, -entrance.z).normalize();
    const perp = new THREE.Vector3(-toCenter.z, 0, toCenter.x);
    const stone = new THREE.MeshStandardMaterial({ color: 0x6a7488, roughness: 0.9 });
    const PH = 7;
    for (const s of [-1, 1]) {
      const px = entrance.x + perp.x * 7 * s;
      const pz = entrance.z + perp.z * 7 * s;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, PH, 8), stone);
      pillar.position.set(px, PH / 2, pz);
      pillar.castShadow = true;
      g.add(pillar);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), emissive(1.3));
      crystal.position.set(px, PH + 0.8, pz);
      g.add(crystal);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(15, 0.7, 0.7), stone);
    lintel.position.set(entrance.x, PH, entrance.z);
    lintel.lookAt(0, PH, 0);
    g.add(lintel);
    const lintelGlow = new THREE.Mesh(new THREE.BoxGeometry(14, 0.25, 0.25), emissive(0.8));
    lintelGlow.position.set(entrance.x, PH - 0.5, entrance.z);
    lintelGlow.lookAt(0, PH - 0.5, 0);
    g.add(lintelGlow);

    // floating crystals strung along the route (purely decorative ambiance)
    for (let i = 1; i <= 6; i++) {
      const k = i / 7;
      const x = THREE.MathUtils.lerp(entrance.x, pad.x, k) + (i % 2 ? 3.5 : -3.5);
      const zz = THREE.MathUtils.lerp(entrance.z, pad.z, k) + (i % 3 ? -1 : 2);
      const y = THREE.MathUtils.lerp(1.5, pad.y + 2, k) + (i % 2) * 0.8;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.45 + (i % 3) * 0.12), emissive(1.1));
      shard.position.set(x, y, zz);
      shard.rotation.y = i;
      g.add(shard);
    }

    // layered glowing capture ring over the goal + tall light beam
    for (const rr of [1.7, 2.4]) {
      const goal = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.12, 8, 32), emissive(1.4));
      goal.rotation.x = -Math.PI / 2;
      goal.position.set(pad.x, pad.y + 0.9 + (rr - 1.7), pad.z);
      g.add(goal);
    }
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 50, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.set(pad.x, pad.y + 25, pad.z);
    g.add(beam);
  }

  update(dt: number, t: number) {
    for (const z of this.zones) z.update(dt, t);
  }

  // --- Zone C (center, far): Sunny Steps (level 1) ---
  private buildZone1(): Zone {
    const entrance = new THREE.Vector3(0, 0, -30);
    const pad = new THREE.Vector3(0, 10, -86);
    const z = new Zone("zone-1", "Sunspire Ascent", 1, 1, entrance, pad);
    const g = z.group;

    z.add(new Spikes(g, 0, -33, 9, 3));
    z.add(new JumpPad(g, 0, 0.25, -33, 21));
    z.add(new StaticPlatform(g, 0, 2.0, -37, 6, 4));
    z.add(new SwingingHammer(g, 0, 5.6, -38, 5, 1.4, 1.0));
    z.add(new StaticPlatform(g, 0, 2.7, -41, 5, 3, true)); // narrow bridge
    z.add(new MovingPlatform(g, new THREE.Vector3(0, 3.4, -45), new THREE.Vector3(0, 4.6, -45), 0.5, 4, 4));
    z.add(new StaticPlatform(g, 0, 4.6, -49, 5, 4));
    z.add(new DisappearingPlatform(g, 0, 5.2, -53, 2.2, 0, 4, 4));
    z.add(new SwingingHammer(g, 0, 8.4, -55, 5, 1.6, 1.0));
    z.add(new StaticPlatform(g, 0, 5.8, -57, 6, 5));
    z.add(new RotatingBeam(g, 0, 6.4, -57, 9, 1.4));
    z.add(new MovingPlatform(g, new THREE.Vector3(-3, 7.0, -62), new THREE.Vector3(3, 7.0, -62), 0.5, 4, 4));
    z.add(new StaticPlatform(g, 0, 7.6, -66, 5, 4));
    z.add(new DisappearingPlatform(g, 0, 8.2, -70, 2.0, 0.3, 4, 4));
    z.add(new DisappearingPlatform(g, 0, 8.8, -74, 2.0, 0.9, 4, 4));
    z.add(new SwingingHammer(g, 0, 12.2, -78, 6, 1.8, 1.0));
    z.add(new StaticPlatform(g, 0, 9.4, -79, 5, 4));
    z.add(new RotatingBeam(g, 0, 9.8, -82, 8, -1.6));
    z.add(new StaticPlatform(g, 0, 10, -86, 7, 7)); // pad platform
    this.decorate(z, entrance, pad, 0xffce4f);
    return z;
  }

  // --- Zone L (left edge): Frost Gauntlet (level 2) — sprawling icy run ---
  private buildZone2(): Zone {
    const entrance = new THREE.Vector3(-46, 0, -16);
    const pad = new THREE.Vector3(-104, 9, -40);
    const z = new Zone("zone-2", "Frost Gauntlet", 2, 2, entrance, pad);
    const g = z.group;

    z.add(new IceZone(g, -52, 0.4, -18, 12, 9));
    z.add(new Laser(g, -52, 1.6, -18, 9, 2.2, 0));
    z.add(new Laser(g, -57, 2.4, -20, 9, 2.2, 1.1));
    z.add(new DisappearingPlatform(g, -62, 2.0, -22, 2.2, 0, 4, 4));
    z.add(new MovingPlatform(g, new THREE.Vector3(-67, 3, -26), new THREE.Vector3(-67, 3, -18), 0.5, 4, 4));
    z.add(new StaticPlatform(g, -71, 3.8, -24, 5, 5));
    z.add(new SwingingHammer(g, -71, 7.6, -24, 6, 1.8, 1.1));
    z.add(new IceZone(g, -75, 4.6, -28, 6, 6));
    z.add(new Laser(g, -78, 5.6, -30, 8, 2.0, 0.5));
    z.add(new DisappearingPlatform(g, -82, 5.4, -32, 2.0, 0.3, 4, 4));
    z.add(new MovingPlatform(g, new THREE.Vector3(-86, 6, -36), new THREE.Vector3(-86, 6, -28), 0.55, 4, 4));
    z.add(new StaticPlatform(g, -90, 6.6, -34, 5, 5));
    z.add(new SwingingHammer(g, -90, 10.4, -34, 6, 2.0, 1.1));
    z.add(new DisappearingPlatform(g, -95, 7.4, -37, 1.8, 0.4, 4, 4));
    z.add(new IceZone(g, -99, 8.2, -39, 5, 5));
    z.add(new Laser(g, -101, 9.2, -40, 6, 1.8, 0.3));
    z.add(new StaticPlatform(g, -104, 9, -40, 7, 7));
    this.decorate(z, entrance, pad, 0x6fd0ff);
    return z;
  }

  // --- Zone R (right edge): Storm Spire (level 3) — windy high-altitude gauntlet ---
  private buildZone3(): Zone {
    const entrance = new THREE.Vector3(46, 0, -16);
    const pad = new THREE.Vector3(104, 10, -40);
    const z = new Zone("zone-3", "Storm Spire", 3, 3, entrance, pad);
    const g = z.group;

    z.add(new WindZone(g, 52, 3, -18, 12, 6, 12, 4, 4));
    z.add(new RotatingBeam(g, 52, 1.2, -18, 10, 1.4));
    z.add(new JumpPad(g, 56, 0.25, -18, 26));
    z.add(new MovingPlatform(g, new THREE.Vector3(62, 4, -22), new THREE.Vector3(62, 7, -22), 0.5, 4, 4));
    z.add(new DisappearingPlatform(g, 67, 6.5, -24, 1.8, 0.3, 4, 4));
    z.add(new RotatingBeam(g, 71, 7, -26, 8, -1.6));
    z.add(new StaticPlatform(g, 72, 7.2, -26, 6, 5));
    z.add(new SwingingHammer(g, 74, 11, -26, 6, 2.0, 1.2));
    z.add(new MovingPlatform(g, new THREE.Vector3(78, 7.6, -30), new THREE.Vector3(78, 7.6, -22), 0.55, 4, 4));
    z.add(new WindZone(g, 82, 8.5, -30, 8, 6, 8, -6, 0));
    z.add(new DisappearingPlatform(g, 86, 8.0, -32, 1.8, 0.4, 4, 4));
    z.add(new RotatingBeam(g, 90, 8.4, -34, 8, 1.8));
    z.add(new StaticPlatform(g, 91, 8.6, -34, 6, 5));
    z.add(new DisappearingPlatform(g, 96, 9.0, -37, 1.6, 0.5, 3, 3));
    z.add(new SwingingHammer(g, 99, 13, -39, 6, 2.2, 1.2));
    z.add(new StaticPlatform(g, 104, 10, -40, 7, 7));
    this.decorate(z, entrance, pad, 0xb06fff);
    return z;
  }
}
