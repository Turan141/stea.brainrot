import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CONFIG } from "../config.ts";

interface CharMeta {
  version: number;
  file: string;
  name: string;
}

const META_URL = "models/character/meta.json";

/**
 * Loads the generated player character GLB (if present) and normalizes it to
 * the player's height with feet on the ground. Returns null when there's no
 * character asset yet — the game then keeps the placeholder capsule.
 */
export async function loadCharacter(): Promise<THREE.Object3D | null> {
  let meta: CharMeta;
  try {
    const res = await fetch(META_URL, { cache: "no-cache" });
    if (!res.ok) return null;
    meta = (await res.json()) as CharMeta;
  } catch {
    return null;
  }

  try {
    const gltf = await new GLTFLoader().loadAsync(meta.file);
    return normalize(gltf.scene, CONFIG.player.height);
  } catch {
    return null;
  }
}

function normalize(model: THREE.Object3D, targetHeight: number): THREE.Group {
  const b0 = new THREE.Box3().setFromObject(model);
  const size = b0.getSize(new THREE.Vector3());
  const factor = targetHeight / (size.y || 1);
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
