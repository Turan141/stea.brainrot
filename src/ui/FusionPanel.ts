import type { BaseStorage } from "../systems/BaseStorage.ts";
import type { FusionSystem } from "../systems/FusionSystem.ts";
import type { EconomySystem } from "../systems/EconomySystem.ts";
import type { Creature } from "../creatures/Creature.ts";
import { ELEMENT_LABEL, ROLE_LABEL } from "../creatures/types.ts";

/**
 * Splice Lab UI: pick two parents from the base, preview the outcome, and fuse.
 * Parents are consumed; a new hybrid arrives after the lab cooldown.
 */
export class FusionPanel {
  private modal: HTMLElement;
  private list: HTMLElement;
  private status: HTMLElement;
  private selA: Creature | null = null;
  private selB: Creature | null = null;

  constructor(
    root: HTMLElement,
    private baseStorage: BaseStorage,
    private fusion: FusionSystem,
    private economy: EconomySystem,
    private onFused: () => void
  ) {
    this.modal = document.createElement("div");
    this.modal.className = "modal";
    this.modal.innerHTML = `
      <div class="modal-card">
        <h2>⚗️ Splice Lab <span class="close">✕</span></h2>
        <p class="fuse-hint">Pick two creatures to fuse. Parents are consumed; a new hybrid arrives after the lab cooldown.</p>
        <div class="fuse-status"></div>
        <div class="fuse-list"></div>
      </div>`;
    this.list = this.modal.querySelector(".fuse-list")!;
    this.status = this.modal.querySelector(".fuse-status")!;
    this.modal.querySelector(".close")!.addEventListener("click", () => this.close());
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) this.close();
    });
    root.appendChild(this.modal);
  }

  get isOpen(): boolean {
    return this.modal.classList.contains("open");
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.selA = this.selB = null;
    this.refreshList();
    this.updateStatus();
    this.modal.classList.add("open");
  }

  close() {
    this.modal.classList.remove("open");
  }

  /** Called each frame; keeps the cooldown bar / odds live while open. */
  update() {
    if (this.isOpen) this.updateStatus();
  }

  private select(c: Creature) {
    if (this.selA === c) {
      this.selA = this.selB;
      this.selB = null;
    } else if (this.selB === c) {
      this.selB = null;
    } else if (!this.selA) {
      this.selA = c;
    } else if (!this.selB) {
      this.selB = c;
    } else {
      this.selA = this.selB;
      this.selB = c;
    }
    this.refreshList();
    this.updateStatus();
  }

  private refreshList() {
    this.list.innerHTML = "";
    const stored = this.baseStorage.stored;
    if (!stored.length) {
      this.list.innerHTML = `<div class="fuse-empty">No creatures in your cages yet. Capture or buy some first.</div>`;
      return;
    }
    for (const c of stored) {
      const def = c.def;
      const slot = c === this.selA ? "A" : c === this.selB ? "B" : "";
      const card = document.createElement("div");
      card.className = `fuse-card ${slot ? "sel" : ""}`;
      card.innerHTML = `
        ${slot ? `<div class="fuse-badge">${slot}</div>` : ""}
        <img src="${def.thumb}" alt="" onerror="this.style.visibility='hidden'"/>
        <div class="nm">${def.name}</div>
        <div class="rar rar-${def.rarity}">${def.rarity}</div>
        <div class="tags">
          <span class="tag tag-${def.element}">${def.element ? ELEMENT_LABEL[def.element] : ""}</span>
          <span class="tag tag-role">${def.role ? ROLE_LABEL[def.role] : ""}</span>
        </div>`;
      card.addEventListener("click", () => this.select(c));
      this.list.appendChild(card);
    }
  }

  private updateStatus() {
    const gene = this.economy.geneCells;
    const geneLine = `<span class="gene">🧬 ${gene} Gene Cells</span>`;

    if (this.fusion.busy) {
      const pct = (1 - this.fusion.remaining / this.fusion.total) * 100;
      this.status.innerHTML = `
        ${geneLine}
        <div class="fuse-busy">Lab busy — ${Math.ceil(this.fusion.remaining)}s
          <div class="fuse-bar"><i style="width:${pct}%"></i></div>
        </div>`;
      return;
    }

    if (this.selA && this.selB) {
      const p = this.fusion.preview(this.selA, this.selB);
      const can = this.fusion.canFuse(this.selA, this.selB);
      this.status.innerHTML = `
        ${geneLine}
        <div class="fuse-preview">
          <div class="row"><span>Type →</span><b>${p.elementText}</b></div>
          <div class="row"><span>Rarity →</span><b>${p.rarityText}</b></div>
          ${p.cosmicNote ? `<div class="row note">${p.cosmicNote}</div>` : ""}
          <div class="row"><span>Cost</span><b>🧬 ${p.cost}</b></div>
          <button class="fuse-btn" ${can ? "" : "disabled"}>⚗️ Splice (parents burn)</button>
        </div>`;
      const btn = this.status.querySelector(".fuse-btn") as HTMLButtonElement | null;
      btn?.addEventListener("click", () => this.doFuse());
    } else {
      this.status.innerHTML = `${geneLine}<div class="fuse-pick">Select two parents below…</div>`;
    }
  }

  private doFuse() {
    if (!this.selA || !this.selB) return;
    if (this.fusion.start(this.selA, this.selB)) {
      this.selA = this.selB = null;
      this.onFused();
      this.refreshList();
      this.updateStatus();
    }
  }
}
