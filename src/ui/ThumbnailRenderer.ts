import * as THREE from "three";
import type { CreatureLibrary } from "../creatures/CreatureLibrary.ts";
import type { CreatureDef } from "../creatures/types.ts";

/**
 * Renders real creature models to small PNG thumbnails for the UI (instead of
 * the procedural emoji/SVG placeholders). One tiny offscreen WebGL context,
 * rendered on demand and cached by creature id — cheap enough for mobile.
 */
export class ThumbnailRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private cache = new Map<string, string>();
  private pending = new Map<string, Promise<string>>();

  constructor(
    private library: CreatureLibrary,
    size = 160
  ) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(size, size);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x44506a, 1.15));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(3, 5, 4);
    this.scene.add(dir);
  }

  /** Get a data-URL thumbnail for a creature (cached). */
  get(def: CreatureDef): Promise<string> {
    const cached = this.cache.get(def.id);
    if (cached) return Promise.resolve(cached);
    const inFlight = this.pending.get(def.id);
    if (inFlight) return inFlight;
    const job = this.render(def);
    this.pending.set(def.id, job);
    return job;
  }

  /** Set an <img>'s src to the real model thumbnail once it's ready. */
  apply(img: HTMLImageElement, def: CreatureDef) {
    this.get(def)
      .then((url) => {
        img.src = url;
      })
      .catch(() => {
        /* leave whatever fallback src is set */
      });
  }

  private async render(def: CreatureDef): Promise<string> {
    const model = await this.library.createInstance(def);
    this.scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center); // center at origin

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = maxDim * 1.9;
    this.camera.position.set(dist * 0.55, dist * 0.42, dist);
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL("image/png");

    this.scene.remove(model);
    this.cache.set(def.id, url);
    this.pending.delete(def.id);
    return url;
  }
}
