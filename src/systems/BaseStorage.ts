import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { Creature } from "../creatures/Creature.ts";
import type { CreatureLibrary } from "../creatures/CreatureLibrary.ts";

const BASE_CENTER = new THREE.Vector3(0, 0, 8);

/**
 * Holds the creatures delivered to the base. They sit on a grid of pedestals
 * and generate passive income. Capacity grows with the base-expansion upgrade.
 */
export class BaseStorage {
  readonly stored: Creature[] = [];
  capacity = 12;

  private podiumGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.5, 12);
  private podiumMat = new THREE.MeshStandardMaterial({ color: 0x223152, roughness: 0.7 });

  constructor(private scene: THREE.Scene) {}

  get isFull(): boolean {
    return this.stored.length >= this.capacity;
  }

  /** Raw income per second (before the income multiplier upgrade). */
  get baseIncomePerSec(): number {
    let v = 0;
    for (const c of this.stored) v += c.value;
    return v * CONFIG.base.incomeRatePerValue;
  }

  /** Place a creature on the base. Returns false if full. */
  store(creature: Creature): boolean {
    if (this.isFull) return false;
    creature.state = "stored";
    this.placeOnGrid(creature, this.stored.length);
    this.stored.push(creature);
    return true;
  }

  private placeOnGrid(c: Creature, index: number) {
    const cols = CONFIG.base.gridCols;
    const gap = CONFIG.base.gridGap;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = BASE_CENTER.x + (col - (cols - 1) / 2) * gap;
    const z = BASE_CENTER.z + 2 + row * gap;

    const podium = new THREE.Mesh(this.podiumGeo, this.podiumMat);
    podium.position.set(x, 0.25, z);
    podium.castShadow = true;
    podium.receiveShadow = true;
    this.scene.add(podium);

    c.setPosition(x, 0.9, z);
  }

  update(dt: number) {
    for (const c of this.stored) c.update(dt);
  }

  // --- persistence ---

  ids(): string[] {
    return this.stored.map((c) => c.def.id);
  }

  /** Rebuild stored creatures from saved ids on load. */
  async restore(ids: string[], library: CreatureLibrary) {
    for (const id of ids) {
      const def = library.byId(id);
      if (!def) continue;
      const mesh = await library.createInstance(def);
      this.scene.add(mesh);
      const c = new Creature(def, mesh);
      this.store(c);
    }
  }
}
