import type { EventBus } from "../engine/EventBus.ts";

/**
 * The wallet. Money is kept as a float (passive income accrues continuously)
 * and floored for display. Emits change events for the HUD.
 */
export class EconomySystem {
  money = 0;
  /** Gene Cells — the Splice Lab (fusion) catalyst currency. */
  geneCells = 0;

  constructor(private bus: EventBus) {}

  add(amount: number) {
    if (amount <= 0) return;
    this.money += amount;
    this.bus.emit("money:changed", { money: this.money });
  }

  spend(amount: number): boolean {
    if (this.money < amount) return false;
    this.money -= amount;
    this.bus.emit("money:changed", { money: this.money });
    return true;
  }

  addGene(amount: number) {
    if (amount <= 0) return;
    this.geneCells += amount;
  }

  spendGene(amount: number): boolean {
    if (this.geneCells < amount) return false;
    this.geneCells -= amount;
    return true;
  }
}
