import type { Element, Rarity } from "./types.ts";

/**
 * Pure fusion rules (the Splice matrix). Type/flavor is driven here; the child
 * creature itself is later picked from the library pool of the resulting
 * element + rarity. Kept side-effect free so the UI can preview odds.
 *
 * Rules:
 *  1. same + same        → same element (purebred)
 *  2. opposites          → cosmic           (food↔tech, beast↔object)
 *  3. cosmic + X (X≠cos) → X, but rarity +1 ("infuse" — cosmic is consumed)
 *  4. other cross pair   → 50/50 of the two parents (+~8% cosmic "jackpot")
 */

export const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary", "mythic"];

export const OPPOSITE: Partial<Record<Element, Element>> = {
  food: "tech",
  tech: "food",
  beast: "object",
  object: "beast",
};

export const JACKPOT_CHANCE = 0.08;

export interface ElementOutcome {
  element: Element;
  infuse: boolean; // cosmic-infuse → guaranteed rarity +1
  deterministic: boolean; // true if element is fixed (no 50/50)
  alt?: Element; // the other 50/50 possibility (for preview)
}

export function fuseElement(a: Element, b: Element, rng: () => number): ElementOutcome {
  if (a === "cosmic" && b === "cosmic") return { element: "cosmic", infuse: false, deterministic: true };
  if (a === "cosmic") return { element: b, infuse: true, deterministic: true };
  if (b === "cosmic") return { element: a, infuse: true, deterministic: true };
  if (a === b) return { element: a, infuse: false, deterministic: true };
  if (OPPOSITE[a] === b) return { element: "cosmic", infuse: false, deterministic: true };
  // non-opposite cross pair
  if (rng() < JACKPOT_CHANCE) return { element: "cosmic", infuse: false, deterministic: false, alt: a };
  return { element: rng() < 0.5 ? a : b, infuse: false, deterministic: false, alt: b };
}

export interface RarityOutcome {
  rarity: Rarity;
  up: number; // how many tiers it rose
}

export function fuseRarity(
  a: Rarity,
  b: Rarity,
  infuse: boolean,
  pity: number,
  upChanceBase: number,
  upChancePerPity: number,
  rng: () => number
): RarityOutcome {
  const baseIdx = Math.max(RARITY_ORDER.indexOf(a), RARITY_ORDER.indexOf(b));
  let up = 0;
  if (infuse) {
    up = 1; // cosmic infuse guarantees one tier
  } else {
    const chance = Math.min(0.85, upChanceBase + pity * upChancePerPity);
    if (rng() < chance) {
      up = 1;
      if (rng() < 0.15) up = 2; // rare double-up
    }
  }
  const idx = Math.min(RARITY_ORDER.length - 1, baseIdx + up);
  return { rarity: RARITY_ORDER[idx], up };
}

/** Probability the child rises ≥1 tier (for the preview odds bar). */
export function upChanceFor(
  a: Rarity,
  b: Rarity,
  infuse: boolean,
  pity: number,
  upChanceBase: number,
  upChancePerPity: number
): number {
  if (infuse) return 1;
  if (Math.max(RARITY_ORDER.indexOf(a), RARITY_ORDER.indexOf(b)) >= RARITY_ORDER.length - 1) return 0;
  return Math.min(0.85, upChanceBase + pity * upChancePerPity);
}
