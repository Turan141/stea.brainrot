import * as THREE from "three";
import { Box, type Obstacle } from "./types.ts";

// Shared materials (cheap, reused across instances).
const MAT = {
  platform: new THREE.MeshStandardMaterial({ color: 0x3a4a72, roughness: 0.85 }),
  bridge: new THREE.MeshStandardMaterial({ color: 0x4a5680, roughness: 0.9 }),
  moving: new THREE.MeshStandardMaterial({ color: 0x4f8fff, roughness: 0.6, emissive: 0x12325f, emissiveIntensity: 0.4 }),
  ice: new THREE.MeshStandardMaterial({ color: 0x9fe4ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }),
  hazard: new THREE.MeshStandardMaterial({ color: 0xff4d5e, roughness: 0.5, emissive: 0x661016, emissiveIntensity: 0.5 }),
  beam: new THREE.MeshStandardMaterial({ color: 0xff7a3d, roughness: 0.5, emissive: 0x612a10, emissiveIntensity: 0.5 }),
  pad: new THREE.MeshStandardMaterial({ color: 0x2ee6a6, roughness: 0.4, emissive: 0x0e6b4e, emissiveIntensity: 0.6 }),
  laser: new THREE.MeshBasicMaterial({ color: 0xff2d55 }),
  wind: new THREE.MeshBasicMaterial({ color: 0x88bbff, transparent: true, opacity: 0.08 }),
};

function box(group: THREE.Group, mat: THREE.Material, b: Box): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2, b.hy * 2, b.hz * 2), mat);
  m.position.set(b.cx, b.cy, b.cz);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

/** Static platform / narrow bridge — a standable surface. */
export class StaticPlatform implements Obstacle {
  private b: Box;
  constructor(group: THREE.Group, cx: number, cy: number, cz: number, w: number, d: number, narrow = false) {
    this.b = new Box(cx, cy, cz, w / 2, 0.4, d / 2);
    box(group, narrow ? MAT.bridge : MAT.platform, this.b);
  }
  update() {}
  supports() {
    return [this.b];
  }
}

/** Platform oscillating between two points (horizontal or vertical). */
export class MovingPlatform implements Obstacle {
  private b: Box;
  private mesh: THREE.Mesh;
  constructor(
    group: THREE.Group,
    private from: THREE.Vector3,
    private to: THREE.Vector3,
    private speed = 0.4,
    w = 4,
    d = 4
  ) {
    this.b = new Box(from.x, from.y, from.z, w / 2, 0.4, d / 2);
    this.mesh = box(group, MAT.moving, this.b);
  }
  update(_dt: number, t: number) {
    const k = (Math.sin(t * this.speed * Math.PI) + 1) / 2;
    const nx = THREE.MathUtils.lerp(this.from.x, this.to.x, k);
    const ny = THREE.MathUtils.lerp(this.from.y, this.to.y, k);
    const nz = THREE.MathUtils.lerp(this.from.z, this.to.z, k);
    this.b.dx = nx - this.b.cx;
    this.b.dz = nz - this.b.cz;
    this.b.cx = nx;
    this.b.cy = ny;
    this.b.cz = nz;
    this.mesh.position.set(nx, ny, nz);
  }
  supports() {
    return [this.b];
  }
}

/** Platform that blinks in and out on a timer. */
export class DisappearingPlatform implements Obstacle {
  private b: Box;
  private mesh: THREE.Mesh;
  private solid = true;
  constructor(group: THREE.Group, cx: number, cy: number, cz: number, private period = 2, private phase = 0, w = 4, d = 4) {
    this.b = new Box(cx, cy, cz, w / 2, 0.4, d / 2);
    this.mesh = box(group, MAT.platform.clone(), this.b);
    (this.mesh.material as THREE.MeshStandardMaterial).transparent = true;
  }
  update(_dt: number, t: number) {
    const cycle = ((t + this.phase) % this.period) / this.period;
    this.solid = cycle < 0.6;
    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    mat.opacity = this.solid ? 1 : 0.18;
    this.mesh.visible = mat.opacity > 0.2 || this.solid;
  }
  supports() {
    return this.solid ? [this.b] : [];
  }
}

/** Rotating beam that sweeps across a platform — knocks the player off. */
export class RotatingBeam implements Obstacle {
  private pivot: THREE.Group;
  private hazardBoxes: Box[] = [];
  private length: number;
  constructor(group: THREE.Group, private cx: number, private cy: number, private cz: number, length = 8, private speed = 1.2) {
    this.length = length;
    this.pivot = new THREE.Group();
    this.pivot.position.set(cx, cy, cz);
    group.add(this.pivot);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(length, 0.5, 0.5), MAT.beam);
    beam.castShadow = true;
    this.pivot.add(beam);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, cy * 2, 8), MAT.platform);
    post.position.y = -cy;
    this.pivot.add(post);
    for (let i = 0; i < 4; i++) this.hazardBoxes.push(new Box(cx, cy, cz, 0.6, 0.6, 0.6));
  }
  update(_dt: number, t: number) {
    const a = t * this.speed;
    this.pivot.rotation.y = a;
    const n = this.hazardBoxes.length;
    for (let i = 0; i < n; i++) {
      const dist = (this.length / 2) * ((i + 1) / n);
      this.hazardBoxes[i].cx = this.cx + Math.cos(a) * dist;
      this.hazardBoxes[i].cz = this.cz - Math.sin(a) * dist;
      this.hazardBoxes[i].cy = this.cy;
    }
  }
  hazards() {
    return this.hazardBoxes;
  }
}

/** Pendulum hammer that swings across the path. */
export class SwingingHammer implements Obstacle {
  private pivot: THREE.Group;
  private head: THREE.Mesh;
  private hazard: Box;
  constructor(group: THREE.Group, cx: number, cy: number, cz: number, armLen = 6, private speed = 1.6, private amp = 1.1) {
    this.pivot = new THREE.Group();
    this.pivot.position.set(cx, cy, cz);
    group.add(this.pivot);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, armLen, 6), MAT.platform);
    arm.position.y = -armLen / 2;
    this.pivot.add(arm);
    this.head = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), MAT.hazard);
    this.head.position.y = -armLen;
    this.head.castShadow = true;
    this.pivot.add(this.head);
    this.hazard = new Box(cx, cy - armLen, cz, 1, 1, 1);
  }
  update(_dt: number, t: number) {
    const a = Math.sin(t * this.speed) * this.amp;
    this.pivot.rotation.z = a;
    const wp = new THREE.Vector3();
    this.head.getWorldPosition(wp);
    this.hazard.cx = wp.x;
    this.hazard.cy = wp.y;
    this.hazard.cz = wp.z;
  }
  hazards() {
    return [this.hazard];
  }
}

/** Floor spikes — a static hazard strip. */
export class Spikes implements Obstacle {
  private b: Box;
  constructor(group: THREE.Group, cx: number, cz: number, w = 4, d = 4) {
    this.b = new Box(cx, 0.4, cz, w / 2, 0.4, d / 2);
    const cols = Math.max(2, Math.round(w));
    const rows = Math.max(2, Math.round(d));
    const geo = new THREE.ConeGeometry(0.25, 0.8, 6);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const s = new THREE.Mesh(geo, MAT.hazard);
        s.position.set(cx - w / 2 + (i + 0.5) * (w / cols), 0.4, cz - d / 2 + (j + 0.5) * (d / rows));
        s.castShadow = true;
        group.add(s);
      }
    }
  }
  update() {}
  hazards() {
    return [this.b];
  }
}

/** Toggling laser gate — hazard only while lit. */
export class Laser implements Obstacle {
  private b: Box;
  private mesh: THREE.Mesh;
  private on = true;
  constructor(group: THREE.Group, cx: number, cy: number, cz: number, len = 6, private period = 2.4, private phase = 0) {
    this.b = new Box(cx, cy, cz, len / 2, 0.15, 0.15);
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 8), MAT.laser);
    this.mesh.rotation.z = Math.PI / 2;
    this.mesh.position.set(cx, cy, cz);
    group.add(this.mesh);
  }
  update(_dt: number, t: number) {
    this.on = ((t + this.phase) % this.period) / this.period < 0.55;
    this.mesh.visible = this.on;
  }
  hazards() {
    return this.on ? [this.b] : [];
  }
}

/** Bounce pad — launches the player upward when stepped on. */
export class JumpPad implements Obstacle {
  private b: Box;
  private mesh: THREE.Mesh;
  constructor(group: THREE.Group, cx: number, cy: number, cz: number, private power = 22) {
    this.b = new Box(cx, cy, cz, 1.4, 0.25, 1.4);
    this.mesh = box(group, MAT.pad, this.b);
  }
  update(_dt: number, t: number) {
    this.mesh.scale.y = 1 + Math.sin(t * 6) * 0.15;
  }
  supports() {
    return [this.b];
  }
  jumpPads() {
    return [{ box: this.b, power: this.power }];
  }
}

/** Wind region — pushes the player along a constant horizontal vector. */
export class WindZone implements Obstacle {
  private b: Box;
  constructor(group: THREE.Group, cx: number, cy: number, cz: number, w: number, h: number, d: number, private fx: number, private fz: number) {
    this.b = new Box(cx, cy, cz, w / 2, h / 2, d / 2);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT.wind);
    m.position.set(cx, cy, cz);
    group.add(m);
  }
  update() {}
  windZones() {
    return [{ box: this.b, x: this.fx, z: this.fz }];
  }
}

/** Slippery platform — low friction while standing on it. */
export class IceZone implements Obstacle {
  private b: Box;
  constructor(group: THREE.Group, cx: number, cy: number, cz: number, w = 8, d = 8) {
    this.b = new Box(cx, cy, cz, w / 2, 0.4, d / 2);
    box(group, MAT.ice, this.b);
  }
  update() {}
  supports() {
    return [this.b];
  }
  iceZones() {
    return [new Box(this.b.cx, this.b.cy + 1, this.b.cz, this.b.hx, 1.5, this.b.hz)];
  }
}
