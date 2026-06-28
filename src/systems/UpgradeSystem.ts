import { CONFIG } from "../config.ts";
import type { Player } from "../player/Player.ts";
import type { EconomySystem } from "./EconomySystem.ts";

export type UpgradeKey =
  | "speed"
  | "sprint"
  | "jump"
  | "carrySpeed"
  | "stamina"
  | "dash"
  | "doubleJump"
  | "magnet"
  | "income"
  | "capacity"
  | "baseExpansion";

interface UpgradeDef {
  key: UpgradeKey;
  label: string;
  baseCost: number;
  costMul: number;
  maxLevel: number;
  effect: (level: number) => string;
}

const DEFS: UpgradeDef[] = [
  { key: "speed", label: "Move Speed", baseCost: 40, costMul: 1.5, maxLevel: 10, effect: (l) => `${(CONFIG.player.walkSpeed + l * 1.5).toFixed(0)} u/s` },
  { key: "sprint", label: "Sprint Speed", baseCost: 60, costMul: 1.55, maxLevel: 10, effect: (l) => `${(CONFIG.player.sprintSpeed + l * 2).toFixed(0)} u/s` },
  { key: "jump", label: "Jump Power", baseCost: 55, costMul: 1.55, maxLevel: 8, effect: (l) => `${(CONFIG.player.jumpSpeed + l).toFixed(0)}` },
  { key: "carrySpeed", label: "Carry Speed", baseCost: 70, costMul: 1.6, maxLevel: 8, effect: (l) => `+${(l * 12).toFixed(0)}%` },
  { key: "stamina", label: "Stamina", baseCost: 50, costMul: 1.5, maxLevel: 8, effect: (l) => `${(CONFIG.player.staminaMax + l * 20).toFixed(0)}` },
  { key: "dash", label: "Dash", baseCost: 120, costMul: 1.7, maxLevel: 6, effect: (l) => (l === 0 ? "locked" : `${(CONFIG.player.dashSpeed + l * 2).toFixed(0)}`) },
  { key: "doubleJump", label: "Double Jump", baseCost: 200, costMul: 2, maxLevel: 1, effect: (l) => (l ? "unlocked" : "locked") },
  { key: "magnet", label: "Magnet", baseCost: 90, costMul: 1.65, maxLevel: 6, effect: (l) => `+${(l * 1.5).toFixed(1)} m` },
  { key: "income", label: "Income ×", baseCost: 110, costMul: 1.8, maxLevel: 10, effect: (l) => `×${(1 + l * 0.2).toFixed(2)}` },
  { key: "capacity", label: "Carry Slots", baseCost: 80, costMul: 1.7, maxLevel: 10, effect: (l) => `${5 + l}` },
  { key: "baseExpansion", label: "Base Size", baseCost: 150, costMul: 1.75, maxLevel: 10, effect: (l) => `${12 + l * 6}` },
];

/**
 * Owns upgrade levels, prices and how they map to player stats / derived
 * values (income multiplier, base capacity, progression level for zone gating).
 */
export class UpgradeSystem {
  private levels: Record<UpgradeKey, number> = {
    speed: 0, sprint: 0, jump: 0, carrySpeed: 0, stamina: 0, dash: 0,
    doubleJump: 0, magnet: 0, income: 0, capacity: 0, baseExpansion: 0,
  };

  static defs = DEFS;

  level(key: UpgradeKey): number {
    return this.levels[key];
  }

  cost(key: UpgradeKey): number {
    const def = DEFS.find((d) => d.key === key)!;
    const l = this.levels[key];
    if (l >= def.maxLevel) return Infinity;
    return Math.round(def.baseCost * Math.pow(def.costMul, l));
  }

  buy(key: UpgradeKey, economy: EconomySystem): boolean {
    const c = this.cost(key);
    if (!isFinite(c) || !economy.spend(c)) return false;
    this.levels[key]++;
    return true;
  }

  get incomeMult(): number {
    return 1 + this.levels.income * 0.2;
  }
  get baseCapacity(): number {
    return 12 + this.levels.baseExpansion * 6;
  }
  get dashUnlocked(): boolean {
    return this.levels.dash > 0;
  }

  /** Total levels invested → unlocks progressively harder zones. */
  get progressionLevel(): number {
    const total = Object.values(this.levels).reduce((s, v) => s + v, 0);
    return 1 + Math.floor(total / 5);
  }

  /** Push current upgrade effects onto the player's mutable stats. */
  apply(player: Player) {
    const L = this.levels;
    player.walkSpeed = CONFIG.player.walkSpeed + L.speed * 1.5;
    player.sprintSpeed = CONFIG.player.sprintSpeed + L.sprint * 2;
    player.jumpSpeed = CONFIG.player.jumpSpeed + L.jump;
    player.carrySpeedFactor = 1 + L.carrySpeed * 0.12;
    player.staminaMax = CONFIG.player.staminaMax + L.stamina * 20;
    player.dashSpeed = CONFIG.player.dashSpeed + L.dash * 2;
    player.maxJumps = 1 + L.doubleJump;
    player.magnetRadius = L.magnet * 1.5;
    player.carryCapacity = 5 + L.capacity;
    if (player.stamina > player.staminaMax) player.stamina = player.staminaMax;
  }

  getLevels(): Record<UpgradeKey, number> {
    return { ...this.levels };
  }

  setLevels(data: Partial<Record<UpgradeKey, number>>) {
    for (const def of DEFS) {
      const v = data[def.key];
      if (typeof v === "number" && isFinite(v)) {
        this.levels[def.key] = Math.max(0, Math.min(def.maxLevel, Math.floor(v)));
      }
    }
  }
}
