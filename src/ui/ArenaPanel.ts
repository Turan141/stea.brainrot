import type { BaseStorage } from "../systems/BaseStorage.ts";
import type { CreatureLibrary } from "../creatures/CreatureLibrary.ts";
import type { Creature } from "../creatures/Creature.ts";
import type { ThumbnailRenderer } from "./ThumbnailRenderer.ts";
import { combatPower, elementMultiplier } from "../creatures/stats.ts";
import { ELEMENT_LABEL, ROLE_LABEL, type CreatureDef } from "../creatures/types.ts";

/**
 * PvP Arena UI: a prize creature is on offer; pick one of your creatures as the
 * champion and fight for it. Win → a reduced-income clone joins your base. Your
 * champion is never lost (it fights by its stats, not in person).
 */
export class ArenaPanel {
  private modal: HTMLElement;
  private list: HTMLElement;
  private header: HTMLElement;
  private champion: Creature | null = null;
  private prize: CreatureDef | null = null;

  constructor(
    root: HTMLElement,
    private baseStorage: BaseStorage,
    private library: CreatureLibrary,
    private thumbs: ThumbnailRenderer,
    private onFight: (championDef: CreatureDef, prizeDef: CreatureDef, championLevel: number) => void,
    private cloneFactor = 0.5
  ) {
    this.modal = document.createElement("div");
    this.modal.className = "modal arena-modal";
    this.modal.innerHTML = `
      <div class="modal-card">
        <h2>⚔️ PvP Arena <span class="close">✕</span></h2>
        <p class="fuse-hint">Fight for the prize creature. Pick your champion — it battles by its stats and is never lost. Win → a clone (${Math.round(this.cloneFactor * 100)}% income) joins your base.</p>
        <div class="arena-header"></div>
        <div class="fuse-list"></div>
      </div>`;
    this.list = this.modal.querySelector(".fuse-list")!;
    this.header = this.modal.querySelector(".arena-header")!;
    this.modal.querySelector(".close")!.addEventListener("click", () => this.close());
    this.modal.addEventListener("pointerdown", (e) => {
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
  close() {
    this.modal.classList.remove("open");
  }

  open() {
    this.champion = null;
    this.rerollPrize();
    this.modal.classList.add("open");
  }

  private rerollPrize() {
    // a rarer challenger makes a tempting prize
    const pool = this.library.all.filter((d) => d.rarity !== "common");
    this.prize = pool.length ? pool[(Math.random() * pool.length) | 0] : this.library.pick(99);
    this.render();
  }

  private render() {
    // prize header
    const p = this.prize;
    this.header.innerHTML = p
      ? `<div class="arena-prize">
           <div class="lbl">PRIZE</div>
           <img src="${p.thumb}" alt="" onerror="this.style.visibility='hidden'"/>
           <div class="nm">${p.name}</div>
           <div class="rar rar-${p.rarity}">${p.rarity}</div>
           <div class="tags"><span class="tag tag-${p.element}">${p.element ? ELEMENT_LABEL[p.element] : ""}</span><span class="tag tag-role">${p.role ? ROLE_LABEL[p.role] : ""}</span></div>
           <button class="arena-reroll">🔄 New challenger</button>
         </div>`
      : `<div class="fuse-empty">No challenger available.</div>`;
    this.header.querySelector(".arena-reroll")?.addEventListener("click", () => this.rerollPrize());
    const prizeImg = this.header.querySelector("img") as HTMLImageElement | null;
    if (prizeImg && p) this.thumbs.apply(prizeImg, p);

    // champion list
    this.list.innerHTML = "";
    const stored = this.baseStorage.stored;
    if (!stored.length) {
      this.list.innerHTML = `<div class="fuse-empty">No creatures to fight with. Capture or buy some first.</div>`;
      return;
    }
    const pick = document.createElement("div");
    pick.className = "fuse-pick";
    pick.textContent = "Choose your champion:";
    this.list.appendChild(pick);

    for (const c of stored) {
      const def = c.def;
      const sel = c === this.champion;
      const card = document.createElement("div");
      card.className = `fuse-card ${sel ? "sel" : ""}`;
      card.innerHTML = `
        ${sel ? `<div class="fuse-badge">★</div>` : ""}
        <img src="${def.thumb}" alt="" onerror="this.style.visibility='hidden'"/>
        <div class="nm">${def.name} · Lv${c.level}</div>
        <div class="rar rar-${def.rarity}">${def.rarity}</div>
        <div class="tags"><span class="tag tag-${def.element}">${def.element ? ELEMENT_LABEL[def.element] : ""}</span><span class="tag tag-role">${def.role ? ROLE_LABEL[def.role] : ""}</span></div>`;
      const img = card.querySelector("img") as HTMLImageElement | null;
      if (img) this.thumbs.apply(img, def);
      card.addEventListener("click", () => {
        this.champion = c;
        this.render();
      });
      this.list.appendChild(card);
    }

    // power + type-advantage preview so the pick is meaningful
    if (this.champion && p) {
      const cp = combatPower(this.champion.def, this.champion.level);
      const pp = combatPower(p, 1);
      const mult = elementMultiplier(this.champion.def.element, p.element);
      const typeTxt = mult > 1 ? `<b style="color:#3fe07a">type advantage</b>` : mult < 1 ? `<b style="color:#ff6b6b">type weak</b>` : `neutral type`;
      const edge = cp >= pp * 1.15 ? "favored" : cp <= pp * 0.85 ? "underdog" : "even";
      const info = document.createElement("div");
      info.className = "arena-odds";
      info.innerHTML = `Power <b>${cp}</b> vs <b>${pp}</b> · ${edge} · ${typeTxt}`;
      this.list.appendChild(info);
    }

    const btn = document.createElement("button");
    btn.className = "fuse-btn";
    btn.textContent = this.champion ? `⚔️ Fight for ${p?.name ?? "prize"}` : "Select a champion";
    btn.disabled = !this.champion || !p;
    btn.addEventListener("click", () => {
      if (this.champion && this.prize) {
        this.onFight(this.champion.def, this.prize, this.champion.level);
        this.close();
      }
    });
    this.list.appendChild(btn);
  }
}
