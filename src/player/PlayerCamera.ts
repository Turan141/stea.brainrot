import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { damp } from "../utils/math.ts";

/**
 * Third-person follow camera. Trails behind the player at a fixed offset and
 * smoothly tracks position (including vertical when jumping). Mouse drag
 * orbits the yaw so courses can be navigated from any angle.
 */
export class PlayerCamera {
  // start facing the avenue (-Z) with the camera behind the player (+Z side)
  private yaw = Math.PI;
  private targetYaw = Math.PI;
  private focus = new THREE.Vector3();
  private lookId: number | null = null; // pointer driving the look-drag (touch-safe)
  private lastX = 0;
  private obstacles: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();

  constructor(private camera: THREE.PerspectiveCamera) {
    window.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
    window.addEventListener("pointermove", this.onMove);
  }

  private onDown = (e: PointerEvent) => {
    // ignore clicks on UI overlay (joystick/buttons live inside #ui)
    if ((e.target as HTMLElement)?.closest?.("#ui")) return;
    if (this.lookId !== null) return; // already tracking a look-drag finger
    this.lookId = e.pointerId;
    this.lastX = e.clientX;
  };
  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.lookId) this.lookId = null;
  };
  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.lookId) return; // only the look finger rotates the camera
    const dx = e.clientX - this.lastX;
    this.lastX = e.clientX;
    this.targetYaw -= dx * 0.005;
  };

  /** Current yaw — useful if movement should follow camera exactly. */
  get currentYaw(): number {
    return this.yaw;
  }

  /** Meshes the camera should pull in front of instead of clipping through. */
  setObstacles(list: THREE.Object3D[]) {
    this.obstacles = list;
  }

  update(dt: number, target: THREE.Vector3) {
    this.yaw += (this.targetYaw - this.yaw) * damp(CONFIG.camera.lookLerp, dt);

    this.focus.lerp(target, damp(CONFIG.camera.lerp, dt));

    const dist = CONFIG.camera.distance;
    const desired = new THREE.Vector3(
      this.focus.x - Math.sin(this.yaw) * dist,
      this.focus.y + CONFIG.camera.height,
      this.focus.z - Math.cos(this.yaw) * dist
    );

    // Pull the camera in if a base structure sits between it and the player,
    // so buildings never block the view (no clipping into walls/HQ).
    const origin = new THREE.Vector3(this.focus.x, this.focus.y + 1.2, this.focus.z);
    const dir = desired.clone().sub(origin);
    const wanted = dir.length();
    dir.normalize();
    let allowed = wanted;
    if (this.obstacles.length) {
      this.raycaster.set(origin, dir);
      this.raycaster.far = wanted;
      const hits = this.raycaster.intersectObjects(this.obstacles, true);
      if (hits.length) allowed = Math.max(3, hits[0].distance - 0.6);
    }
    const goal = origin.clone().add(dir.multiplyScalar(allowed));

    this.camera.position.lerp(goal, damp(CONFIG.camera.lerp, dt));
    this.camera.lookAt(this.focus.x, this.focus.y + 1.2, this.focus.z);
  }
}
