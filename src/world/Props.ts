import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface PropDef {
  id: string;
  name: string;
  category: string;
  file: string;
  palette: string[];
}
interface PropManifest {
  version: number;
  props: PropDef[];
}

const MANIFEST_URL = "models/props/manifest.json";

/**
 * Loads decoration props (auto-detected from the props manifest) and scatters
 * instances around the arena. Gracefully does nothing if no props exist.
 * Frustum culling is automatic (per-mesh) in three.
 */
export class Props {
  private loader = new GLTFLoader();

  constructor(private scene: THREE.Scene) {}

  async load(perProp = 8) {
    let defs: PropDef[] = [];
    try {
      const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
      if (!res.ok) return;
      const manifest = (await res.json()) as PropManifest;
      defs = manifest.props ?? [];
    } catch {
      return;
    }
    if (!defs.length) return;

    for (const def of defs) {
      let template: THREE.Object3D;
      try {
        const gltf = await this.loader.loadAsync(def.file);
        template = this.normalize(gltf.scene);
      } catch {
        continue;
      }
      this.scatter(template, perProp);
    }
  }

  private scatter(template: THREE.Object3D, count: number) {
    for (let i = 0; i < count; i++) {
      const pos = this.randomSpot();
      if (!pos) continue;
      const inst = template.clone(true);
      inst.position.copy(pos);
      inst.rotation.y = Math.random() * Math.PI * 2;
      inst.scale.multiplyScalar(0.8 + Math.random() * 0.7);
      inst.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      this.scene.add(inst);
    }
  }

  /** A spot in the outer ring, away from the base and zone corridors. */
  private randomSpot(): THREE.Vector3 | null {
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 40;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // keep clear of the three zone corridors (along -Z, -X, +X)
      if (Math.abs(x) < 8 && z < 0) continue;
      if (Math.abs(z) < 8 && Math.abs(x) > 18) continue;
      return new THREE.Vector3(x, 0, z);
    }
    return null;
  }

  private normalize(model: THREE.Object3D, targetHeight = 2.4): THREE.Group {
    const b0 = new THREE.Box3().setFromObject(model);
    const size = b0.getSize(new THREE.Vector3());
    const factor = targetHeight / (Math.max(size.x, size.y, size.z) || 1);
    model.scale.multiplyScalar(factor);
    const b = new THREE.Box3().setFromObject(model);
    const c = b.getCenter(new THREE.Vector3());
    model.position.x -= c.x;
    model.position.z -= c.z;
    model.position.y -= b.min.y;
    const wrap = new THREE.Group();
    wrap.add(model);
    return wrap;
  }
}
