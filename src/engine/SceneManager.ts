import * as THREE from "three";
import { CONFIG } from "../config.ts";

/**
 * Builds the THREE.Scene with sky, fog and lighting rig. Pure presentation —
 * gameplay objects are added by World/systems.
 */
export class SceneManager {
  readonly scene: THREE.Scene;
  readonly sun: THREE.DirectionalLight;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.render.background);
    this.scene.fog = new THREE.Fog(CONFIG.render.fog.color, CONFIG.render.fog.near, CONFIG.render.fog.far);

    const hemi = new THREE.HemisphereLight(0xbcd3ff, 0x202838, 0.7);
    this.scene.add(hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 1.4);
    this.sun.position.set(40, 70, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(CONFIG.render.shadowMapSize, CONFIG.render.shadowMapSize);
    const d = 80;
    const cam = this.sun.shadow.camera;
    cam.left = -d;
    cam.right = d;
    cam.top = d;
    cam.bottom = -d;
    cam.near = 1;
    cam.far = 250;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  /** Keep the shadow frustum centered on a focus point (the player). */
  focusShadow(x: number, z: number) {
    this.sun.position.set(x + 40, 70, z + 30);
    this.sun.target.position.set(x, 0, z);
    this.sun.target.updateMatrixWorld();
  }
}
