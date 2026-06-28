export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

/** One entry of the auto-generated metadata.json manifest. */
export interface CreatureDef {
  id: string;
  name: string;
  archetype: string;
  rarity: Rarity;
  income: number;
  unlockLevel: number;
  spawnWeight: number;
  glow: number;
  palette: string[];
  scale: number;
  rotationY: number;
  file: string; // path under /public, e.g. "models/creatures/foo.glb"
  thumb: string;
  seed: number;
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
