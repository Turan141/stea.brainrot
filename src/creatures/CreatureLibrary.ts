import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { weightedPick } from "../utils/math.ts";
import { ensureFullDef } from "./stats.ts";
import { RARITY_COLOR, type CreatureDef, type CreatureManifest, type Element, type Rarity } from "./types.ts";

const MANIFEST_URL = "models/creatures/metadata.json";

/**
 * Auto-loads every creature described in the generated manifest. No hardcoded
 * creature list — drop GLBs + metadata.json into /public/models/creatures and
 * they appear here. Models are lazy-loaded and cached; instances are clones.
 *
 * If the manifest is missing/empty, a small set of procedural placeholder
 * creatures is synthesized so the game is always playable.
 */
export class CreatureLibrary {
  private defs: CreatureDef[] = [];
  private loader = new GLTFLoader();
  private templates = new Map<string, THREE.Object3D>();
  private loading = new Map<string, Promise<THREE.Object3D>>();
  private clips = new Map<string, THREE.AnimationClip[]>();

  get all(): readonly CreatureDef[] {
    return this.defs;
  }
  get count(): number {
    return this.defs.length;
  }

  async load(): Promise<void> {
    try {
      const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
      if (res.ok) {
        const manifest = (await res.json()) as CreatureManifest;
        if (Array.isArray(manifest.creatures) && manifest.creatures.length) {
          this.defs = manifest.creatures.map(ensureFullDef);
          return;
        }
      }
    } catch {
      /* fall through to procedural fallback */
    }
    this.defs = this.fallbackDefs().map(ensureFullDef);
  }

  /** Definitions unlocked at or below the given zone/progression level. */
  unlocked(level: number): CreatureDef[] {
    return this.defs.filter((d) => d.unlockLevel <= level);
  }

  /** Weighted random pick among unlocked creatures. */
  pick(level: number, rng: () => number = Math.random): CreatureDef | null {
    let pool = this.unlocked(level);
    if (!pool.length) {
      // nothing unlocked at this level yet — fall back to the easiest creatures
      if (!this.defs.length) return null;
      const minUnlock = Math.min(...this.defs.map((d) => d.unlockLevel));
      pool = this.defs.filter((d) => d.unlockLevel === minUnlock);
    }
    return weightedPick(pool, (d) => d.spawnWeight, rng);
  }

  byId(id: string): CreatureDef | undefined {
    return this.defs.find((d) => d.id === id);
  }

  /**
   * Pick a creature of a target element (and rarity if possible) — the result
   * "skin" of a fusion. Relaxes gracefully: element+rarity → element → any.
   */
  pickByElement(element: Element, rarity: Rarity, rng: () => number = Math.random): CreatureDef | null {
    if (!this.defs.length) return null;
    const byElem = this.defs.filter((d) => d.element === element);
    const pool = byElem.length ? byElem : this.defs;
    const exact = pool.filter((d) => d.rarity === rarity);
    const chosen = exact.length ? exact : pool;
    return weightedPick(chosen, (d) => d.spawnWeight, rng);
  }

  /** Instantiate a renderable model for a definition (cloned from a cached template). */
  async createInstance(def: CreatureDef): Promise<THREE.Object3D> {
    const template = await this.getTemplate(def);
    const clips = this.clips.get(def.id);

    let inst: THREE.Object3D;
    if (clips && clips.length) {
      // skinned/animated: clone with bone rebinding + per-instance mixer
      inst = cloneSkeleton(template);
      const mixer = new THREE.AnimationMixer(inst);
      const clip = clips.find((c) => /idle|walk/i.test(c.name)) ?? clips[0];
      mixer.clipAction(clip).play();
      inst.userData.mixer = mixer;
    } else {
      inst = template.clone(true);
    }
    inst.scale.setScalar(def.scale);
    inst.rotation.y = def.rotationY;
    return inst;
  }

  private async getTemplate(def: CreatureDef): Promise<THREE.Object3D> {
    const cached = this.templates.get(def.id);
    if (cached) return cached;

    let pending = this.loading.get(def.id);
    if (!pending) {
      pending = this.loadModel(def);
      this.loading.set(def.id, pending);
    }
    const obj = await pending;
    this.templates.set(def.id, obj);
    return obj;
  }

  private async loadModel(def: CreatureDef): Promise<THREE.Object3D> {
    try {
      const gltf = await this.loader.loadAsync(def.file);
      if (gltf.animations?.length) this.clips.set(def.id, gltf.animations);
      const normalized = this.normalize(gltf.scene);
      this.applyRarityLook(normalized, def);
      return normalized;
    } catch {
      return this.proceduralModel(def);
    }
  }

  /**
   * Fit any GLB (procedural or AI-generated, arbitrary size/origin) into a
   * consistent ~1.5u-tall model resting on y=0, wrapped so def.scale can scale
   * it uniformly afterwards.
   */
  private normalize(model: THREE.Object3D, targetHeight = 1.5): THREE.Group {
    const boxBefore = new THREE.Box3().setFromObject(model);
    const size = boxBefore.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const factor = targetHeight / maxDim;
    model.scale.multiplyScalar(factor);

    // recenter on XZ and drop feet to y=0
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;

    const wrap = new THREE.Group();
    wrap.add(model);
    return wrap;
  }

  /** Give the model shadows + a rarity-tinted emissive glow. */
  private applyRarityLook(root: THREE.Object3D, def: CreatureDef) {
    const glowColor = new THREE.Color(RARITY_COLOR[def.rarity]);
    const tint = new THREE.Color(def.palette?.[0] ?? "#9fb4d6");
    let partIndex = 0;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat || !("emissive" in mat)) return;

      const hasVertexColors = !!mesh.geometry.getAttribute("color");
      const hasTexture = !!mat.map;
      if (hasVertexColors) {
        mat.vertexColors = true;
      } else if (!hasTexture) {
        // untextured AI preview model — tint with the palette so it isn't grey
        mat.color.set(partIndex % 2 === 0 ? tint : new THREE.Color(def.palette?.[1] ?? def.palette?.[0] ?? "#9fb4d6"));
      }
      mat.emissive = glowColor;
      mat.emissiveIntensity = def.glow * 0.6;
      partIndex++;
    });
  }

  // ---- Fallbacks (no manifest / model failed to load) ----

  private fallbackDefs(): CreatureDef[] {
    const rarities: Rarity[] = ["common", "common", "rare", "epic", "legendary"];
    return rarities.map((rarity, i) => ({
      id: `fallback-${i}`,
      name: `Blobby #${i + 1}`,
      archetype: "monster",
      rarity,
      income: [1, 2, 5, 12, 30][i],
      unlockLevel: [1, 1, 2, 3, 4][i],
      spawnWeight: [50, 50, 25, 12, 5][i],
      glow: [0.05, 0.05, 0.15, 0.3, 0.5][i],
      palette: [["#9fb4d6", "#6f86b8"], ["#7fd6a6", "#3fa07a"], ["#a970ff", "#6f3fd0"], ["#ffc24b", "#d08f1f"], ["#ff5d8f", "#c03060"]][i],
      scale: 1,
      rotationY: 0,
      file: "",
      thumb: "",
      seed: i,
    }));
  }

  private proceduralModel(def: CreatureDef): THREE.Object3D {
    const group = new THREE.Group();
    const color = new THREE.Color(def.palette[0]);
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.5,
        emissive: RARITY_COLOR[def.rarity],
        emissiveIntensity: def.glow * 0.6,
      })
    );
    body.castShadow = true;
    group.add(body);
    for (const sx of [-0.32, 0.32]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      eye.position.set(sx, 0.3, 0.85);
      group.add(eye);
    }
    return group;
  }
}
