#!/usr/bin/env node
// Creature generation pipeline.
//
//   npm run generate-creatures            # 12 procedural creatures
//   npm run generate-creatures -- 30      # custom count
//   CREATURE_PROVIDER=meshy MESHY_API_KEY=... npm run generate-creatures -- 10
//
// - Generates N original creatures (GLB + SVG thumb + metadata)
// - Deduplicates by name across runs (regeneration just appends new ones)
// - Writes a single metadata.json the game auto-loads at runtime

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";
import { selectGenerator } from "./generators/index.mjs";

loadEnv(); // populate process.env from .env (MESHY_API_KEY, CREATURE_PROVIDER, …)
import {
  mulberry32,
} from "./generators/procedural.mjs";
import {
  pickRarity,
  makePalette,
  randIntRange,
  pickCombo,
  comboPrompt,
} from "./lib/taxonomy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/models/creatures");
const MANIFEST = path.join(OUT_DIR, "metadata.json");
const MANIFEST_VERSION = 1;

function slugify(name, seed) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + (seed % 100000);
}

async function loadManifest() {
  try {
    const raw = await fs.readFile(MANIFEST, "utf8");
    const json = JSON.parse(raw);
    if (Array.isArray(json.creatures)) return json;
  } catch {
    /* none yet */
  }
  return { version: MANIFEST_VERSION, creatures: [] };
}

function buildSpec(usedNames, usedSeeds) {
  let seed;
  do {
    seed = Math.floor(Math.random() * 1e9);
  } while (usedSeeds.has(seed));
  usedSeeds.add(seed);

  const rng = mulberry32(seed);
  const rarity = pickRarity(rng);
  const combo = pickCombo(rng, usedNames);
  usedNames.add(combo.name);
  const archetype = "meme";
  const palette = makePalette(archetype, rng);
  const income = randIntRange(rarity.income, rng);

  return {
    id: slugify(combo.name, seed),
    seed,
    name: combo.name,
    archetype,
    rarity: rarity.key,
    income,
    unlockLevel: rarity.unlock,
    spawnWeight: rarity.weight,
    glow: rarity.glow,
    palette,
    scale: +(0.8 + rng() * 0.7).toFixed(2),
    rotationY: +(rng() * Math.PI * 2).toFixed(3),
    prompt: comboPrompt(combo.a, combo.b),
  };
}

async function main() {
  const count = parseInt(process.argv[2] ?? process.env.COUNT ?? "12", 10) || 12;
  const generator = selectGenerator();
  const provider = generator.meta?.provider ?? "procedural";

  await fs.mkdir(OUT_DIR, { recursive: true });
  const manifest = await loadManifest();

  const usedNames = new Set(manifest.creatures.map((c) => c.name));
  const usedSeeds = new Set(manifest.creatures.map((c) => c.seed));

  console.log(`▶ Generating ${count} creature(s) with provider "${provider}"…`);
  let added = 0;

  for (let i = 0; i < count; i++) {
    const spec = buildSpec(usedNames, usedSeeds);
    try {
      const glb = await generator.buildGLB(spec);
      await fs.writeFile(path.join(OUT_DIR, `${spec.id}.glb`), glb);

      const svg = generator.buildThumb(spec);
      await fs.writeFile(path.join(OUT_DIR, `${spec.id}.svg`), svg);

      manifest.creatures.push({
        id: spec.id,
        name: spec.name,
        archetype: spec.archetype,
        rarity: spec.rarity,
        income: spec.income,
        unlockLevel: spec.unlockLevel,
        spawnWeight: spec.spawnWeight,
        glow: spec.glow,
        palette: spec.palette,
        scale: spec.scale,
        rotationY: spec.rotationY,
        file: `models/creatures/${spec.id}.glb`,
        thumb: `models/creatures/${spec.id}.svg`,
        seed: spec.seed,
      });
      added++;
      console.log(`  ✓ ${spec.name.padEnd(24)} [${spec.rarity}] $${spec.income}/s  (lvl ${spec.unlockLevel})`);
    } catch (err) {
      console.error(`  ✗ ${spec.name}: ${err.message}`);
      if (generator.meta?.needsApiKey) {
        console.error(`    Provider "${provider}" needs an API key. Aborting.`);
        process.exit(1);
      }
    }
  }

  manifest.version = MANIFEST_VERSION;
  manifest.generatedAt = new Date().toISOString();
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2));

  console.log(`\n✔ Added ${added} creature(s). Total: ${manifest.creatures.length}.`);
  console.log(`  Manifest: ${path.relative(process.cwd(), MANIFEST)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
