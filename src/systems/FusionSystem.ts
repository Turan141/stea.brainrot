import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { Creature } from "../creatures/Creature.ts";
import type { CreatureLibrary } from "../creatures/CreatureLibrary.ts";
import type { BaseStorage } from "./BaseStorage.ts";
import type { EconomySystem } from "./EconomySystem.ts";
import type { EventBus } from "../engine/EventBus.ts";
import { ELEMENT_LABEL, type Element, type Rarity } from "../creatures/types.ts";
import { fuseElement, fuseRarity, upChanceFor, OPPOSITE } from "../creatures/fusion.ts";

export interface FusionPreview {
  elementText: string;
  rarityText: string;
  cosmicNote: string | null;
  cost: number;
  affordable: boolean;
}

interface Snapshot {
  elemA: Element;
  elemB: Element;
  rarA: Rarity;
  rarB: Rarity;
  nameA: string;
  nameB: string;
}

/**
 * The Splice Lab. Burns two stored parents + Gene Cells, runs a cooldown, then
 * produces a new hybrid: element by the fusion matrix, rarity gambled up. The
 * child "skin" is pulled from the library pool so no per-fusion generation.
 */
export class FusionSystem {
  busy = false;
  timer = 0;
  total = 0;
  private snapshot: Snapshot | null = null;
  private pity = 0;
  onChange: (() => void) | null = null;

  constructor(
    private scene: THREE.Scene,
    private library: CreatureLibrary,
    private baseStorage: BaseStorage,
    private economy: EconomySystem,
    private bus: EventBus
  ) {}

  get remaining(): number {
    return Math.max(0, this.timer);
  }

  canFuse(a: Creature, b: Creature): boolean {
    return !this.busy && a !== b && this.economy.geneCells >= CONFIG.fusion.costGene;
  }

  /** Preview the likely outcome for the UI (no side effects). */
  preview(a: Creature, b: Creature): FusionPreview {
    const ea = a.def.element!;
    const eb = b.def.element!;
    // deterministic-path read (rng unused for the deterministic branches)
    let elementText: string;
    let cosmicNote: string | null = null;
    if (ea === eb) {
      elementText = ELEMENT_LABEL[ea];
    } else if (ea === "cosmic" || eb === "cosmic") {
      const other = ea === "cosmic" ? eb : ea;
      elementText = `${ELEMENT_LABEL[other]} (+1 rarity)`;
    } else if (OPPOSITE[ea] === eb) {
      elementText = `${ELEMENT_LABEL.cosmic} 🌌`;
    } else {
      elementText = `${ELEMENT_LABEL[ea]} / ${ELEMENT_LABEL[eb]}`;
      cosmicNote = "~8% chance to spark Void 🌌";
    }

    const infuse = (ea === "cosmic") !== (eb === "cosmic");
    const up = upChanceFor(a.def.rarity, b.def.rarity, infuse, this.pity, CONFIG.fusion.upChanceBase, CONFIG.fusion.upChancePerPity);
    const baseR = rarityMax(a.def.rarity, b.def.rarity);
    const rarityText = up >= 1 ? `${baseR} · ${Math.round(up * 100)}% → rarer` : `${baseR}`;

    return {
      elementText,
      rarityText,
      cosmicNote,
      cost: CONFIG.fusion.costGene,
      affordable: this.economy.geneCells >= CONFIG.fusion.costGene,
    };
  }

  /** Begin a splice: burn parents + Gene Cells, start the cooldown. */
  start(a: Creature, b: Creature): boolean {
    if (!this.canFuse(a, b)) return false;
    if (!this.economy.spendGene(CONFIG.fusion.costGene)) return false;

    this.snapshot = {
      elemA: a.def.element!,
      elemB: b.def.element!,
      rarA: a.def.rarity,
      rarB: b.def.rarity,
      nameA: a.def.name,
      nameB: b.def.name,
    };
    this.baseStorage.remove(a);
    this.baseStorage.remove(b);

    this.busy = true;
    this.total = CONFIG.fusion.cooldownSec;
    this.timer = this.total;
    this.bus.emit("notify", { text: `Splicing ${this.snapshot.nameA} × ${this.snapshot.nameB}…`, kind: "info" });
    this.onChange?.();
    return true;
  }

  update(dt: number) {
    if (!this.busy) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.busy = false;
      void this.finalize();
    }
  }

  private async finalize() {
    const s = this.snapshot;
    this.snapshot = null;
    if (!s) return;
    const rng = Math.random;

    const eo = fuseElement(s.elemA, s.elemB, rng);
    const ro = fuseRarity(s.rarA, s.rarB, eo.infuse, this.pity, CONFIG.fusion.upChanceBase, CONFIG.fusion.upChancePerPity, rng);
    this.pity = ro.up > 0 ? 0 : this.pity + 1;

    const def = this.library.pickByElement(eo.element, ro.rarity, rng);
    if (!def) {
      this.onChange?.();
      return;
    }
    const mesh = await this.library.createInstance(def);
    this.scene.add(mesh);
    const child = new Creature(def, mesh, 1);
    const placed = this.baseStorage.store(child);
    if (!placed) this.scene.remove(mesh);

    const upText = ro.up > 0 ? ` (+${ro.up} rarity!)` : "";
    this.bus.emit("notify", { text: `Spliced: ${def.name} [${def.rarity}]${upText}`, kind: "good" });
    this.onChange?.();
  }
}

function rarityMax(a: Rarity, b: Rarity): Rarity {
  const order: Rarity[] = ["common", "rare", "epic", "legendary", "mythic"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}
