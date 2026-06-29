import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { Creature } from "../creatures/Creature.ts";
import type { CreatureLibrary } from "../creatures/CreatureLibrary.ts";

interface Cage {
  center: THREE.Vector3;
  occupant: Creature | null;
}

/**
 * The creature pens. A fixed grid of cages fills the central plaza; each holds
 * one creature that wanders inside it and earns passive income. The player
 * stands outside a cage to upgrade or sell its occupant.
 */
export class BaseStorage {
  readonly stored: Creature[] = [];
  capacity = CONFIG.base.maxCapacity;

  private cages: Cage[] = [];
  private cageGroup = new THREE.Group();
  private fountainGroup = new THREE.Group();

  constructor(private scene: THREE.Scene) {
    this.scene.add(this.cageGroup, this.fountainGroup);
    this.buildCages();
  }

  /**
   * Swap the procedural cage pens and fountain for generated textured models
   * where available (kept as groups so we can clear + rebuild cleanly).
   */
  applyModels(assets: { instance(id: string, size: number): THREE.Object3D | null; has(id: string): boolean }) {
    const { deckTop, cageCell } = CONFIG.base;
    if (assets.has("base-cage")) {
      this.cageGroup.clear();
      for (const cage of this.cages) {
        const m = assets.instance("base-cage", cageCell - 0.4);
        if (!m) break;
        m.position.set(cage.center.x, deckTop, cage.center.z);
        m.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
        });
        this.cageGroup.add(m);
      }
    }
    if (assets.has("base-fountain")) {
      const m = assets.instance("base-fountain", 5);
      if (m) {
        this.fountainGroup.clear();
        m.position.set(CONFIG.base.centerX, deckTop, CONFIG.base.centerZ);
        m.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
        });
        this.fountainGroup.add(m);
      }
    }
  }

  private buildCages() {
    const { centerX, centerZ, deckTop, quadCols, quadRows, cageCell, pathHalf } = CONFIG.base;

    // First cage of a quadrant starts just past the central avenues.
    const x0 = pathHalf + 2.4;
    const z0 = pathHalf + 2.4;
    const spanX = x0 + (quadCols - 1) * cageCell; // outer reach of cages in x
    const spanZ = z0 + (quadRows - 1) * cageCell;

    this.buildAvenues(centerX, centerZ, deckTop, spanX, spanZ, pathHalf);
    this.buildFountain(centerX, centerZ, deckTop);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (let r = 0; r < quadRows; r++) {
          for (let c = 0; c < quadCols; c++) {
            const x = centerX + sx * (x0 + c * cageCell);
            const z = centerZ + sz * (z0 + r * cageCell);
            this.buildCage(x, z, deckTop);
            this.cages.push({ center: new THREE.Vector3(x, deckTop + 0.4, z), occupant: null });
          }
        }
      }
    }
  }

  /** One fenced pen: floor pad + corner posts + top rails. */
  private buildCage(x: number, z: number, deckTop: number) {
    const penSize = CONFIG.base.cageCell - 1.8;
    const half = penSize / 2;
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x8a6f47, roughness: 0.85 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8893ad, roughness: 0.6, metalness: 0.1 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(penSize, 0.08, penSize), floorMat);
    floor.position.set(x, deckTop + 0.05, z);
    floor.receiveShadow = true;
    this.cageGroup.add(floor);

    const H = 2.2;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, H, 0.16), postMat);
        post.position.set(x + sx * half, deckTop + H / 2, z + sz * half);
        post.castShadow = true;
        this.cageGroup.add(post);
      }
    }
    for (const [w, d, ox, oz] of [
      [penSize, 0.1, 0, -half],
      [penSize, 0.1, 0, half],
      [0.1, penSize, -half, 0],
      [0.1, penSize, half, 0],
    ] as const) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), postMat);
      rail.position.set(x + ox, deckTop + H, z + oz);
      this.cageGroup.add(rail);
    }
  }

  /** Plus-shaped stone avenues separating the four cage quadrants. */
  private buildAvenues(cx: number, cz: number, deckTop: number, spanX: number, spanZ: number, pathHalf: number) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xc2a878, roughness: 0.9 });
    const y = deckTop + 0.04;
    const lenZ = (spanZ + 3) * 2;
    const lenX = (spanX + 3) * 2;
    const central = new THREE.Mesh(new THREE.BoxGeometry(pathHalf * 2, 0.06, lenZ), mat);
    central.position.set(cx, y, cz);
    central.receiveShadow = true;
    this.scene.add(central);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(lenX, 0.06, pathHalf * 2), mat);
    cross.position.set(cx, y, cz);
    cross.receiveShadow = true;
    this.scene.add(cross);
  }

  /** Decorative central fountain where the avenues cross. */
  private buildFountain(cx: number, cz: number, deckTop: number) {
    const stone = new THREE.MeshStandardMaterial({ color: 0x8a93a8, roughness: 0.8 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 0.6, 24), stone);
    base.position.set(cx, deckTop + 0.3, cz);
    base.castShadow = base.receiveShadow = true;
    this.fountainGroup.add(base);
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 0.5, 20), stone);
    tier.position.set(cx, deckTop + 0.85, cz);
    this.fountainGroup.add(tier);
    const water = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x4fc3ff, emissive: 0x2a7fd0, emissiveIntensity: 0.7, roughness: 0.3 })
    );
    water.position.set(cx, deckTop + 1.5, cz);
    this.fountainGroup.add(water);
  }

  get isFull(): boolean {
    return this.stored.length >= this.capacity || !this.cages.some((c) => !c.occupant);
  }

  /**
   * Raw income per second (before the income multiplier upgrade), with a soft
   * cap: the most valuable creatures pay full, extras past the cap pay a
   * fraction — so a big base never out-earns active play (zones/fusion/arena).
   */
  get baseIncomePerSec(): number {
    const values = this.stored.map((c) => c.value).sort((a, b) => b - a);
    const { softCapCount, overCapFactor, incomeRatePerValue } = CONFIG.base;
    let v = 0;
    for (let i = 0; i < values.length; i++) {
      v += i < softCapCount ? values[i] : values[i] * overCapFactor;
    }
    return v * incomeRatePerValue;
  }

  /** Place a creature into the next free cage. Returns false if full. */
  store(creature: Creature): boolean {
    const cage = this.cages.find((c) => !c.occupant);
    if (!cage) return false;
    creature.state = "stored";
    cage.occupant = creature;
    creature.setPen(cage.center, CONFIG.base.penHalf);
    this.stored.push(creature);
    creature.showLevelLabel();
    return true;
  }

  /** Nearest cage occupant within radius of a point (for upgrade/sell). */
  nearestStored(x: number, z: number, radius: number): Creature | null {
    let best: Creature | null = null;
    let bestD = radius * radius;
    for (const cage of this.cages) {
      if (!cage.occupant) continue;
      const dx = cage.center.x - x;
      const dz = cage.center.z - z;
      const d = dx * dx + dz * dz;
      if (d <= bestD) {
        bestD = d;
        best = cage.occupant;
      }
    }
    return best;
  }

  /** Sell a stored creature: free its cage, remove it, return the coin refund. */
  sell(creature: Creature): number {
    const refund = Math.max(1, Math.round(creature.value * CONFIG.base.sellPriceFactor));
    this.remove(creature);
    return refund;
  }

  /** Remove a stored creature without any refund (e.g. burned by fusion). */
  remove(creature: Creature): boolean {
    const cage = this.cages.find((c) => c.occupant === creature);
    if (!cage) return false;
    cage.occupant = null;
    const i = this.stored.indexOf(creature);
    if (i >= 0) this.stored.splice(i, 1);
    this.scene.remove(creature.mesh);
    return true;
  }

  update(dt: number) {
    for (const c of this.stored) c.update(dt);
  }

  // --- persistence ---

  serialize(): { id: string; level: number }[] {
    return this.stored.map((c) => ({ id: c.def.id, level: c.level }));
  }

  /** Rebuild stored creatures (with their levels) from save on load. */
  async restore(entries: { id: string; level: number }[], library: CreatureLibrary) {
    for (const e of entries) {
      const def = library.byId(e.id);
      if (!def) continue;
      const mesh = await library.createInstance(def);
      this.scene.add(mesh);
      this.store(new Creature(def, mesh, e.level));
    }
  }
}
