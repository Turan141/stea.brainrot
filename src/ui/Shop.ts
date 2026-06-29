import { UpgradeSystem, type UpgradeKey } from "../systems/UpgradeSystem.ts";
import type { EconomySystem } from "../systems/EconomySystem.ts";

interface Row {
  btn: HTMLButtonElement;
  name: HTMLElement;
  cost: HTMLElement;
  meta: HTMLElement;
}

/**
 * Upgrade shop panel. Functional list of every upgrade; M6 adds the polished
 * styling/animations. Buying is wired through UpgradeSystem + EconomySystem.
 */
export class Shop {
  private rows = new Map<UpgradeKey, Row>();
  private panel: HTMLElement;

  constructor(
    root: HTMLElement,
    private upgrades: UpgradeSystem,
    private economy: EconomySystem,
    private onBuy?: (key: UpgradeKey) => void
  ) {
    const panel = document.createElement("div");
    panel.id = "shop";
    this.panel = panel;
    const title = document.createElement("div");
    title.className = "shop-title";
    const label = document.createElement("span");
    label.textContent = "🔧 Upgrades";
    const close = document.createElement("span");
    close.className = "close";
    close.textContent = "✕";
    close.addEventListener("click", () => this.close());
    title.append(label, close);
    panel.appendChild(title);

    for (const def of UpgradeSystem.defs) {
      const btn = document.createElement("button");
      btn.className = "up-btn";
      const name = span("nm");
      const cost = span("cost");
      const meta = span("meta");
      btn.append(name, cost, meta);
      btn.addEventListener("click", () => {
        if (this.upgrades.buy(def.key, this.economy)) {
          this.refresh();
          this.onBuy?.(def.key);
        }
      });
      panel.appendChild(btn);
      this.rows.set(def.key, { btn, name, cost, meta });
    }
    root.appendChild(panel);
    this.refresh();
  }

  get isOpen(): boolean {
    return this.panel.classList.contains("open");
  }
  open() {
    this.refresh();
    this.panel.classList.add("open");
  }
  close() {
    this.panel.classList.remove("open");
  }
  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  refresh() {
    for (const def of UpgradeSystem.defs) {
      const row = this.rows.get(def.key)!;
      const lvl = this.upgrades.level(def.key);
      const cost = this.upgrades.cost(def.key);
      const maxed = !isFinite(cost);
      row.name.textContent = `${def.label} ${lvl > 0 ? `· L${lvl}` : ""}`;
      row.meta.textContent = def.effect(lvl);
      row.btn.classList.toggle("maxed", maxed);
      if (maxed) {
        row.cost.textContent = "MAX";
        row.btn.disabled = true;
        row.btn.classList.remove("cant");
      } else {
        row.cost.textContent = `$${cost}`;
        const afford = this.economy.money >= cost;
        row.btn.disabled = !afford;
        row.btn.classList.toggle("cant", !afford);
      }
    }
  }
}

function span(cls: string): HTMLElement {
  const s = document.createElement("span");
  s.className = cls;
  return s;
}
