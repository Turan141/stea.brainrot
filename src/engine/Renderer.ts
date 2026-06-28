import * as THREE from "three";
import { CONFIG } from "../config.ts";

/**
 * Owns the WebGLRenderer and the perspective camera + viewport resize.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render.pixelRatioCap));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.render.fov,
      window.innerWidth / window.innerHeight,
      CONFIG.render.near,
      CONFIG.render.far
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

  render(scene: THREE.Scene) {
    this.gl.render(scene, this.camera);
  }
}
