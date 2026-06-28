export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";
/** Family/flavor (drives the fusion matrix). Internal keys; players see labels. */
export type Element = "food" | "tech" | "beast" | "object" | "cosmic";
/** Combat archetype, orthogonal to Element (drives Arena/Siege behavior). */
export type Role = "tank" | "fighter" | "assassin" | "support" | "trickster";
export type AttackType = "melee" | "ranged";
export type AIBehavior = "aggressive" | "defensive" | "support" | "kiter";

/** Player-facing names. Internal Element keys stay food/tech/… for stability. */
export const ELEMENT_LABEL: Record<Element, string> = {
  food: "Snack",
  tech: "Machine",
  beast: "Critter",
  object: "Stuff",
  cosmic: "Void",
};

export const ROLE_LABEL: Record<Role, string> = {
  tank: "Tank",
  fighter: "Fighter",
  assassin: "Assassin",
  support: "Support",
  trickster: "Trickster",
};

export const ELEMENT_COLOR: Record<Element, number> = {
  food: 0x7ec850,
  tech: 0x4fa3ff,
  beast: 0xff8a3c,
  object: 0xb0b6c4,
  cosmic: 0xb070ff,
};

/**
 * Combat / AI stat block. DORMANT in the MVP (only `income` matters today) but
 * stamped on every creature so PvP Arena (1.0) and Siege (2.0) can reuse the
 * exact same creatures with no data migration. Designed-for, not built.
 */
export interface CombatStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number; // turn/initiative for Arena
  attackRange: number;
  attackType: AttackType;
  movementSpeed: number; // for real-time Siege
  passiveAbility: string; // ability id (resolved by future ability system)
  activeAbility: string;
  aiBehavior: AIBehavior;
}

/**
 * One entry of the auto-generated metadata.json manifest. Combat/identity
 * fields are optional in the file (older manifests omit them) and filled with
 * defaults at load — so the data model is always complete in memory.
 */
export interface CreatureDef {
  id: string;
  name: string;
  archetype: string;
  rarity: Rarity;
  income: number;
  unlockLevel: number;
  spawnWeight: number; // also used as "weight"
  glow: number;
  palette: string[];
  scale: number;
  rotationY: number;
  file: string; // path under /public, e.g. "models/creatures/foo.glb"
  thumb: string;
  seed: number;

  // --- reusable across exploration / economy / Arena / Siege ---
  element?: Element;
  role?: Role; // combat archetype (orthogonal to element)
  cost?: number; // buy price reference
  evolutionStage?: number; // 1..n
  stats?: CombatStats; // dormant in MVP
}

export interface CreatureManifest {
  version: number;
  creatures: CreatureDef[];
  generatedAt?: string;
}

export const RARITY_COLOR: Record<Rarity, number> = {
  common: 0x9fb4d6,
  rare: 0x4fd17a,
  epic: 0xa970ff,
  legendary: 0xffc24b,
  mythic: 0xff5d8f,
};
