import * as THREE from "three";
import { Box, type CapturePoint, type Obstacle } from "./types.ts";

/**
 * A self-contained course segment: a group of obstacles leading to a capture
 * pad. `level` drives which creatures spawn; `unlockLevel` gates entry (M5).
 */
export class Zone {
  readonly group = new THREE.Group();
  readonly obstacles: Obstacle[] = [];
  readonly capture: CapturePoint;
  private padRing: THREE.Mesh;
  private barrier: THREE.Mesh;
  locked = false;

  constructor(
    readonly id: string,
    readonly name: string,
    readonly level: number,
    readonly unlockLevel: number,
    readonly start: THREE.Vector3,
    capturePos: THREE.Vector3,
    captureRadius = 3
  ) {
    this.capture = { position: capturePos.clone(), radius: captureRadius };

    // Capture pad visuals
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(captureRadius, captureRadius + 0.4, 0.3, 24),
      new THREE.MeshStandardMaterial({ color: 0xffc24b, emissive: 0xffc24b, emissiveIntensity: 0.4, roughness: 0.5 })
    );
    pad.position.copy(capturePos);
    pad.receiveShadow = true;
    this.group.add(pad);

    this.padRing = new THREE.Mesh(
      new THREE.TorusGeometry(captureRadius * 0.8, 0.1, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe08a })
    );
    this.padRing.rotation.x = -Math.PI / 2;
    this.padRing.position.set(capturePos.x, capturePos.y + 1.2, capturePos.z);
    this.group.add(this.padRing);

    // Lock barrier at the zone entrance (shown until unlocked)
    this.barrier = new THREE.Mesh(
      new THREE.BoxGeometry(10, 8, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xff5d8f, transparent: true, opacity: 0.22, emissive: 0xff5d8f, emissiveIntensity: 0.3 })
    );
    this.barrier.position.set(start.x, 4, start.z);
    this.barrier.lookAt(0, 4, 0);
    this.barrier.visible = false;
    this.group.add(this.barrier);
  }

  setLocked(locked: boolean) {
    this.locked = locked;
    this.barrier.visible = locked;
  }

  add<T extends Obstacle>(o: T): T {
    this.obstacles.push(o);
    return o;
  }

  /** A standable support box at the capture pad so creatures rest on it. */
  get padSupport(): Box {
    const p = this.capture.position;
    return new Box(p.x, p.y + 0.15, p.z, this.capture.radius, 0.15, this.capture.radius);
  }

  update(dt: number, t: number) {
    for (const o of this.obstacles) o.update(dt, t);
    const s = 1 + Math.sin(t * 3) * 0.08;
    this.padRing.scale.set(s, s, 1);
    this.padRing.position.y = this.capture.position.y + 1.2 + Math.sin(t * 2) * 0.12;
  }
}
