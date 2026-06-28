import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { damp } from "../utils/math.ts";

/**
 * Third-person follow camera. Trails behind the player at a fixed offset and
 * smoothly tracks position (including vertical when jumping). Mouse drag
 * orbits the yaw so courses can be navigated from any angle.
 */
export class PlayerCamera {
  private yaw = 0;
  private targetYaw = 0;
  private focus = new THREE.Vector3();
  private dragging = false;
  private lastX = 0;

  constructor(private camera: THREE.PerspectiveCamera) {
    window.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointermove", this.onMove);
  }

  private onDown = (e: PointerEvent) => {
    // ignore clicks on UI overlay
    if ((e.target as HTMLElement)?.closest?.("#ui")) return;
    this.dragging = true;
    this.lastX = e.clientX;
  };
  private onUp = () => {
    this.dragging = false;
  };
  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    this.lastX = e.clientX;
    this.targetYaw -= dx * 0.005;
  };

  /** Current yaw — useful if movement should follow camera exactly. */
  get currentYaw(): number {
    return this.yaw;
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
    this.camera.position.lerp(desired, damp(CONFIG.camera.lerp, dt));
    this.camera.lookAt(this.focus.x, this.focus.y + 1.2, this.focus.z);
  }
}
