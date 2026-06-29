import type { CreatureLibrary } from "../creatures/CreatureLibrary.ts";
import type { ThumbnailRenderer } from "./ThumbnailRenderer.ts";
import { ELEMENT_LABEL, ROLE_LABEL } from "../creatures/types.ts";

/**
 * Collection panel: every creature in the auto-generated library, shown with
 * its pipeline thumbnail. Undiscovered creatures appear locked until captured.
 */
export class Inventory {
  private modal: HTMLElement;
  private grid: HTMLElement;

  constructor(
    root: HTMLElement,
    private library: CreatureLibrary,
    private discovered: Set<string>,
    private thumbs: ThumbnailRenderer
  ) {
    this.modal = document.createElement("div");
    this.modal.className = "modal";
    this.modal.innerHTML = `
      <div class="modal-card">
        <h2>Creaturedex <span class="close">✕</span></h2>
        <div class="inv-grid"></div>
      </div>`;
    this.grid = this.modal.querySelector(".inv-grid")!;
    this.modal.querySelector(".close")!.addEventListener("click", () => this.close());
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) this.close();
    });
    root.appendChild(this.modal);
  }

  toggle() {
    this.modal.classList.contains("open") ? this.close() : this.open();
  }

  open() {
    this.refresh();
    this.modal.classList.add("open");
  }

  close() {
    this.modal.classList.remove("open");
  }

  private refresh() {
    const defs = [...this.library.all].sort((a, b) => a.unlockLevel - b.unlockLevel || a.income - b.income);
    this.grid.innerHTML = "";
    for (const def of defs) {
      const known = this.discovered.has(def.id);
      const card = document.createElement("div");
      card.className = `inv-card ${known ? "" : "locked"}`;
      if (known) {
        const type = def.element ? ELEMENT_LABEL[def.element] : "";
        const role = def.role ? ROLE_LABEL[def.role] : "";
        card.innerHTML = `
          <img src="${def.thumb}" alt="" onerror="this.style.visibility='hidden'"/>
          <div class="nm">${def.name}</div>
          <div class="rar rar-${def.rarity}">${def.rarity}</div>
          <div class="tags"><span class="tag tag-${def.element}">${type}</span><span class="tag tag-role">${role}</span></div>
          <div class="inc">$${def.income}/s</div>`;
        const img = card.querySelector("img") as HTMLImageElement | null;
        if (img) this.thumbs.apply(img, def);
      } else {
        card.innerHTML = `
          <img src="" style="visibility:hidden"/>
          <div class="nm">???</div>
          <div class="rar">Lvl ${def.unlockLevel}</div>
          <div class="inc">undiscovered</div>`;
      }
      this.grid.appendChild(card);
    }
    if (!defs.length) this.grid.innerHTML = `<div style="color:#8fa0c8">No creatures loaded. Run <code>npm run generate-creatures</code>.</div>`;
  }
}
