import type { EventBus } from "../engine/EventBus.ts";

export interface HudState {
  money: number;
  incomePerSec: number;
  carried: number;
  capacity: number;
  stored: number;
  baseCapacity: number;
  stamina: number;
  staminaMax: number;
  level: number;
}

/**
 * Heads-up display: money / income / carry / base counts, a stamina bar, a
 * save indicator and toast notifications driven by the event bus.
 */
export class HUD {
  private money: HTMLElement;
  private income: HTMLElement;
  private carry: HTMLElement;
  private base: HTMLElement;
  private level: HTMLElement;
  private staminaFill: HTMLElement;
  private saveDot: HTMLElement;
  private toasts: HTMLElement;
  private saveTimer = 0;

  constructor(root: HTMLElement, bus: EventBus) {
    const top = el("div", "", { id: "hud-top" });
    this.money = chip(top, "💰", "hud-money");
    this.income = chip(top, "📈", "hud-income");
    this.carry = chip(top, "🎒", "");
    this.base = chip(top, "🏠", "");
    this.level = chip(top, "⭐", "");
    root.appendChild(top);

    const bar = el("div", "", { id: "hud-stamina" });
    this.staminaFill = el("i");
    bar.appendChild(this.staminaFill);
    root.appendChild(bar);

    this.saveDot = el("div", "💾 saved", { id: "save-indicator" });
    root.appendChild(this.saveDot);

    this.toasts = el("div", "", { id: "toasts" });
    root.appendChild(this.toasts);

    bus.on("creature:delivered", () => this.bumpMoney());
    bus.on("save:written", () => this.flashSave());
    bus.on("notify", (p) => this.toast(p.text, p.kind));
    bus.on("creature:captured", (p) => this.toast(`Captured ${p.name}!`, "good"));
    bus.on("creature:delivered", (p) => this.toast(`+${p.count} to base ($${p.value}/s value)`, "good"));
    bus.on("zone:unlocked", (p) => this.toast(`Zone unlocked: ${p.id}`, "good"));
  }

  update(s: HudState, dt: number) {
    this.money.innerHTML = `<span class="lbl">$</span><b>${Math.floor(s.money)}</b>`;
    this.income.innerHTML = `<b>+${s.incomePerSec.toFixed(1)}</b><span class="lbl">/s</span>`;
    this.carry.innerHTML = `<b>${s.carried}</b><span class="lbl">/${s.capacity}</span>`;
    this.base.innerHTML = `<b>${s.stored}</b><span class="lbl">/${s.baseCapacity}</span>`;
    this.level.innerHTML = `<span class="lbl">LVL</span><b>${s.level}</b>`;
    this.staminaFill.style.width = `${(s.stamina / s.staminaMax) * 100}%`;

    if (this.saveTimer > 0) {
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) this.saveDot.classList.remove("show");
    }
  }

  private bumpMoney() {
    this.money.classList.remove("bump");
    void this.money.offsetWidth; // restart animation
    this.money.classList.add("bump");
  }

  private flashSave() {
    this.saveDot.classList.add("show");
    this.saveTimer = 1.4;
  }

  private toast(text: string, kind?: "info" | "good" | "warn") {
    const t = el("div", text, {});
    t.className = `toast ${kind ?? "info"}`;
    this.toasts.appendChild(t);
    setTimeout(() => t.remove(), 2100);
  }
}

function el(tag: string, text = "", attrs: Record<string, string> = {}): HTMLElement {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function chip(parent: HTMLElement, _icon: string, extra: string): HTMLElement {
  const c = el("div", "", {});
  c.className = `hud-chip ${extra}`;
  parent.appendChild(c);
  return c;
}
