import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { QUALITY } from "./quality.ts";

/**
 * Owns the WebGLRenderer and the perspective camera + viewport resize.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: QUALITY.antialias, powerPreference: "high-performance" });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.pixelRatioCap));
    this.gl.shadowMap.enabled = QUALITY.shadows;
    this.gl.shadowMap.type = QUALITY.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    // Throttle the shadow pass when shadows are on but we want to render them less often.
    this.gl.shadowMap.autoUpdate = !QUALITY.shadows || QUALITY.shadowEveryN <= 1;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.render.fov,
      window.innerWidth / window.innerHeight,
      CONFIG.render.near,
      QUALITY.drawDistance
    );

    this.resize();
    window.addEventListener("resize", this.resize);
  }

  private resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.gl.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private frame = 0;

  render(scene: THREE.Scene) {
    // When auto-update is off, flag the shadow map to re-render on the chosen cadence.
    if (!this.gl.shadowMap.autoUpdate) {
      this.gl.shadowMap.needsUpdate = this.frame % QUALITY.shadowEveryN === 0;
      this.frame++;
    }
    this.gl.render(scene, this.camera);
  }
}
