import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface SceneAssetDef {
  id: string;
  name: string;
  group: string;
  file: string;
}
interface SceneManifest {
  version: number;
  assets: SceneAssetDef[];
}

const MANIFEST_URL = "models/scene/manifest.json";

// Tint for untextured preview structures so they aren't grey.
const TINTS: Record<string, number> = {
  "base-hq": 0x4f8fff,
  "fusion-lab": 0xa970ff,
  "pedestal": 0x6f86b8,
  "base-gate": 0x5a6aa0,
  tree: 0x4fae5d,
  rock: 0x8c93a3,
  lamp: 0xffe08a,
  fence: 0xb07a3c,
  bush: 0x3fa05a,
};

/**
 * Loads the generated scene-asset manifest (base structures + props) and hands
 * out normalized, shadow-casting, palette-tinted instances. Gracefully no-ops
 * if a manifest/asset is missing so the game still runs.
 */
export class SceneAssets {
  private loader = new GLTFLoader();
  private templates = new Map<string, THREE.Object3D>();

  async load(): Promise<void> {
    let defs: SceneAssetDef[] = [];
    try {
      const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
      if (!res.ok) return;
      defs = ((await res.json()) as SceneManifest).assets ?? [];
    } catch {
      return;
    }
    for (const def of defs) {
      try {
        const gltf = await this.loader.loadAsync(def.file);
        this.templates.set(def.id, this.prepare(gltf.scene, def.id));
      } catch {
        /* skip missing */
      }
    }
  }

  has(id: string): boolean {
    return this.templates.has(id);
  }

  /** A fresh instance of an asset, scaled so its max dimension ≈ targetSize. */
  instance(id: string, targetSize: number): THREE.Object3D | null {
    const t = this.templates.get(id);
    if (!t) return null;
    const inst = t.clone(true);
    const box = new THREE.Box3().setFromObject(inst);
    const size = box.getSize(new THREE.Vector3());
    const factor = targetSize / (Math.max(size.x, size.y, size.z) || 1);
    inst.scale.multiplyScalar(factor);
    return inst;
  }

  private prepare(model: THREE.Object3D, id: string): THREE.Object3D {
    // recenter on XZ, feet to y=0
    const box = new THREE.Box3().setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x;
    model.position.z -= c.z;
    model.position.y -= box.min.y;

    const tint = new THREE.Color(TINTS[id] ?? 0x9fb4d6);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat || !("color" in mat)) return;
      // Meshy preview materials often render near-black (metallic, no env map) —
      // make them matte and tint untextured ones with the scene palette.
      mat.metalness = 0;
      mat.roughness = Math.max(0.6, mat.roughness ?? 1);
      if (!mat.map && !mesh.geometry.getAttribute("color")) {
        mat.color.copy(tint);
        mat.emissive = new THREE.Color(tint).multiplyScalar(0.12); // lift out of shadow
      }
      mat.needsUpdate = true;
    });

    const wrap = new THREE.Group();
    wrap.add(model);
    return wrap;
  }
}
