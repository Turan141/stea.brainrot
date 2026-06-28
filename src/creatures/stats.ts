import type {
  AIBehavior,
  AttackType,
  CombatStats,
  CreatureDef,
  Element,
  Rarity,
  Role,
} from "./types.ts";

export const ELEMENTS: Element[] = ["food", "tech", "beast", "object", "cosmic"];
export const ROLES: Role[] = ["tank", "fighter", "assassin", "support", "trickster"];

/**
 * How each Role reshapes the rarity stat budget and combat behavior. Multipliers
 * apply to hp/attack/defense/speed; the rest set fighting style. This is the
 * single source of truth the Arena/Siege will read.
 */
const ROLE_MODS: Record<
  Role,
  {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
    attackType: AttackType;
    range: number;
    ai: AIBehavior;
    passive: string;
    active: string;
  }
> = {
  tank: { hp: 1.6, attack: 0.7, defense: 1.7, speed: 0.85, attackType: "melee", range: 1.5, ai: "defensive", passive: "taunt", active: "shield-wall" },
  fighter: { hp: 1.1, attack: 1.1, defense: 1.0, speed: 1.0, attackType: "melee", range: 1.6, ai: "aggressive", passive: "second-wind", active: "power-strike" },
  assassin: { hp: 0.7, attack: 1.6, defense: 0.7, speed: 1.25, attackType: "melee", range: 1.5, ai: "aggressive", passive: "crit", active: "backstab" },
  support: { hp: 1.0, attack: 0.7, defense: 1.0, speed: 0.95, attackType: "ranged", range: 6, ai: "support", passive: "regen-aura", active: "heal" },
  trickster: { hp: 0.85, attack: 0.95, defense: 0.85, speed: 1.2, attackType: "ranged", range: 5, ai: "kiter", passive: "evasion", active: "hex" },
};

export function roleFor(def: CreatureDef): Role {
  // mix the seed so role isn't correlated with element/archetype
  return ROLES[((def.seed >> 3) ^ def.seed) % ROLES.length];
}

const ARCHETYPE_ELEMENT: Record<string, Element> = {
  food: "food",
  fruit: "food",
  robot: "tech",
  object: "object",
  animal: "beast",
  monster: "beast",
  meme: "cosmic",
};

/** Per-rarity base stat budget. Tuned later; only the shape matters for MVP. */
const RARITY_BUDGET: Record<Rarity, Partial<CombatStats>> = {
  common: { hp: 60, attack: 10, defense: 5, speed: 8 },
  rare: { hp: 90, attack: 16, defense: 8, speed: 9 },
  epic: { hp: 130, attack: 24, defense: 12, speed: 10 },
  legendary: { hp: 190, attack: 36, defense: 18, speed: 11 },
  mythic: { hp: 270, attack: 52, defense: 26, speed: 12 },
};

function elementFor(def: CreatureDef): Element {
  return ARCHETYPE_ELEMENT[def.archetype] ?? ELEMENTS[def.seed % ELEMENTS.length];
}

function defaultStats(def: CreatureDef): CombatStats {
  const b = RARITY_BUDGET[def.rarity];
  const role = def.role ?? roleFor(def);
  const m = ROLE_MODS[role];
  const speed = Math.round(b.speed! * m.speed);
  return {
    hp: Math.round(b.hp! * m.hp),
    attack: Math.round(b.attack! * m.attack),
    defense: Math.round(b.defense! * m.defense),
    speed,
    attackRange: m.range,
    attackType: m.attackType,
    movementSpeed: +(3 + (speed - 8) * 0.4).toFixed(2),
    passiveAbility: m.passive,
    activeAbility: m.active,
    aiBehavior: m.ai,
  };
}

/**
 * Guarantee a fully-populated CreatureDef in memory (combat/identity fields
 * default in even when the manifest omits them). Keeps the data model complete
 * for future Arena/Siege without forcing the generator to backfill old files.
 */
export function ensureFullDef(def: CreatureDef): CreatureDef {
  if (!def.element) def.element = elementFor(def);
  if (!def.role) def.role = roleFor(def);
  if (def.cost === undefined) def.cost = Math.max(1, Math.round(def.income * 25));
  if (def.evolutionStage === undefined) def.evolutionStage = 1;
  if (!def.stats) def.stats = defaultStats(def);
  return def;
}

/**
 * Derive level-scaled combat stats from a creature's base block. Shared source
 * of truth — the same scaling idea income uses, reserved for the battle system.
 */
export function deriveCombat(def: CreatureDef, level: number): CombatStats {
  const base = def.stats ?? defaultStats(def);
  const k = 1 + (level - 1) * 0.12;
  return {
    ...base,
    hp: Math.round(base.hp * k),
    attack: Math.round(base.attack * k),
    defense: Math.round(base.defense * k),
  };
}
