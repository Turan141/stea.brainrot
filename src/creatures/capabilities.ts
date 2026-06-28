import type { CombatStats } from "./types.ts";

/**
 * Capability interfaces a creature entity can expose. A creature is ONE reusable
 * entity; each game mode consumes it through a capability, never through bespoke
 * per-mode logic. This keeps Exploration / Economy / Arena / Siege sharing the
 * same creatures with no rewrite.
 *
 * MVP implements Carryable (in Player.ts) + the income/value getter.
 * Combatant + Commandable are RESERVED — declared now, implemented in 1.0 / 2.0.
 */

/** Used by PvP Arena (1.0) and Siege (2.0). Not implemented in the MVP. */
export interface Combatant {
  readonly combat: CombatStats; // level-scaled, via deriveCombat()
  takeDamage(amount: number): void;
  isAlive(): boolean;
}

/** Used by Siege (2.0): the player commands a squad. Not implemented in the MVP. */
export type SquadCommand = "follow" | "attack" | "defend" | "hold" | "ultimate";

export interface Commandable {
  issue(command: SquadCommand, targetId?: string): void;
}
