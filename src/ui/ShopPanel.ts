import type { BaseStorage } from "../systems/BaseStorage.ts";
import type { CreatureLibrary } from "../creatures/CreatureLibrary.ts";
import type { EconomySystem } from "../systems/EconomySystem.ts";
import type { ThumbnailRenderer } from "./ThumbnailRenderer.ts";
import { CONFIG } from "../config.ts";
import { weightedPick } from "../utils/math.ts";
import { ELEMENT_LABEL, ROLE_LABEL, type CreatureDef } from "../creatures/types.ts";

interface Offer {
  def: CreatureDef;
  price: number;
  sold: boolean;
}

/**
 * The Creature Shop storefront. A rotating stock of buyable creatures with
 * thumbnails, rarity and price. Buying spends coins, mints the creature and
 * drops it straight into a free base cage. Refresh rerolls the stock.
 */
export class ShopPanel {
  private modal: HTMLElement;
  private list: HTMLElement;
  private offers: Offer[] = [];
  private stockSize = 6;

  constructor(
    root: HTMLElement,
    private baseStorage: BaseStorage,
    private library: CreatureLibrary,
    private economy: EconomySystem,
    private thumbs: ThumbnailRenderer,
    private onBuy: (def: CreatureDef, price: number) => Promise<boolean>
  ) {
    this.modal = document.createElement("div");
    this.modal.className = "modal shop-modal";
    this.modal.innerHTML = `
      <div class="modal-card">
        <h2>🛒 Creature Shop <span class="close">✕</span></h2>
        <p class="fuse-hint">Buy creatures outright — they go straight into a free cage and start earning. Stock rotates: hit refresh for new offers.</p>
        <div class="shop-bar">
          <span class="shop-coins"></span>
          <button class="shop-refresh">🔄 Refresh stock</button>
        </div>
        <div class="shop-list"></div>
      </div>`;
    this.list = this.modal.querySelector(".shop-list")!;
    this.modal.querySelector(".close")!.addEventListener("click", () => this.close());
    this.modal.querySelector(".shop-refresh")!.addEventListener("click", () => this.reroll());
    // Close on a press that STARTS on the backdrop (pointerdown, not click) so the
    // tap that opened the panel can't immediately close it via a synthetic click.
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
    if (!this.offers.length) this.reroll();
    else this.render();
    this.modal.classList.add("open");
  }

  /** Reroll the shop stock (weighted toward cheaper creatures, with a rare gem). */
  private reroll() {
    const defs = [...this.library.all];
    this.offers = [];
    if (!defs.length) {
      this.render();
      return;
    }
    const pool = [...defs];
    for (let i = 0; i < this.stockSize && pool.length; i++) {
      // mostly affordable commons, occasionally a rarer pick
      const def = weightedPick(pool, (d) => (i === this.stockSize - 1 ? d.unlockLevel : 1 / d.unlockLevel));
      if (!def) break;
      pool.splice(pool.indexOf(def), 1);
      this.offers.push({ def, price: this.priceOf(def), sold: false });
    }
    this.render();
  }

  private priceOf(def: CreatureDef): number {
    // a touch pricier than the avenue conveyor (instant, hand-picked)
    return Math.max(1, Math.round(def.income * CONFIG.conveyor.priceFactor * 1.25));
  }

  private render() {
    const coins = this.modal.querySelector(".shop-coins")!;
    coins.innerHTML = `💰 <b>${Math.floor(this.economy.money)}</b>`;

    this.list.innerHTML = "";
    if (!this.offers.length) {
      this.list.innerHTML = `<div class="fuse-empty">No creatures available.</div>`;
      return;
    }

    for (const o of this.offers) {
      const def = o.def;
      const affordable = this.economy.money >= o.price;
      const full = this.baseStorage.isFull;
      const card = document.createElement("div");
      card.className = `shop-card ${o.sold ? "sold" : ""}`;
      card.innerHTML = `
        <img src="${def.thumb}" alt="" onerror="this.style.visibility='hidden'"/>
        <div class="nm">${def.name}</div>
        <div class="rar rar-${def.rarity}">${def.rarity}</div>
        <div class="tags"><span class="tag tag-${def.element}">${def.element ? ELEMENT_LABEL[def.element] : ""}</span><span class="tag tag-role">${def.role ? ROLE_LABEL[def.role] : ""}</span></div>
        <div class="shop-price">💰 ${o.price}</div>
        <button class="shop-buy" ${o.sold || !affordable || full ? "disabled" : ""}>${o.sold ? "✓ Owned" : full ? "Base full" : !affordable ? "Need 💰" : "Buy"}</button>`;
      const img = card.querySelector("img") as HTMLImageElement | null;
      if (img) this.thumbs.apply(img, def);
      const btn = card.querySelector(".shop-buy") as HTMLButtonElement;
      btn.addEventListener("click", async () => {
        if (o.sold) return;
        btn.disabled = true;
        btn.textContent = "…";
        const ok = await this.onBuy(def, o.price);
        if (ok) o.sold = true;
        this.render();
      });
      this.list.appendChild(card);
    }
  }
}
