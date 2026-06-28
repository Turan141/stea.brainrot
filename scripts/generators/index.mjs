// Generator registry. Selects the active provider via CREATURE_PROVIDER env
// (default: procedural). Adding a new AI backend = register it here.

import * as procedural from "./procedural.mjs";
import { meshy, tripo } from "./ai-adapter.mjs";

const REGISTRY = {
  procedural,
  meshy,
  tripo,
};

export function selectGenerator(name = process.env.CREATURE_PROVIDER || "procedural") {
  const gen = REGISTRY[name];
  if (!gen) {
    const known = Object.keys(REGISTRY).join(", ");
    throw new Error(`Unknown creature provider "${name}". Available: ${known}`);
  }
  return gen;
}

export function listProviders() {
  return Object.keys(REGISTRY);
}
