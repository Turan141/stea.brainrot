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
  RARITIES,
} from "./lib/taxonomy.mjs";

// Curated, on-theme creatures (used with the `curated` arg). Battle-ready meme
// hybrids, each with a signature weapon. Entries may give a custom `prompt`,
// `name`, `element` and `role`; otherwise fall back to {a, b} + comboPrompt.
const BATTLE_STYLE =
  "Colorful, goofy, exaggerated proportions, low poly, cute but fierce and battle-ready, " +
  "dynamic ready-to-fight pose, single character, game-ready, under 5000 triangles, GLB.";

const CURATED = [
  { name: "Broccoli Samurai", rarity: "epic", element: "food", role: "fighter",
    prompt: `An original cartoon creature: a broccoli warrior samurai clad in segmented armor, wielding a sharp katana, fierce battle stance. ${BATTLE_STYLE}` },
  { name: "Refrigerator Bruiser", rarity: "epic", element: "tech", role: "tank",
    prompt: `An original cartoon creature: a walking refrigerator brawler with two huge mechanical piston fists, stocky and armored, ready to smash. ${BATTLE_STYLE}` },
  { name: "Pizza Wizard", rarity: "legendary", element: "food", role: "support",
    prompt: `An original cartoon creature: a pizza-slice wizard in a starry hat, holding a flaming pizza peel as a magic staff, casting fire. ${BATTLE_STYLE}` },
  { name: "TV Duck", rarity: "rare", element: "tech", role: "trickster",
    prompt: `An original cartoon creature: a duck with a retro television for a body, brandishing a crackling energy antenna as a spear. ${BATTLE_STYLE}` },
  { name: "Aquarium Walker", rarity: "epic", element: "object", role: "tank",
    prompt: `An original cartoon creature: a fish-tank aquarium on sturdy legs, ramming with a heavy reinforced glass shield, water and fish inside. ${BATTLE_STYLE}` },
  { name: "Banana Astronaut", rarity: "rare", element: "cosmic", role: "assassin",
    prompt: `An original cartoon creature: a banana astronaut in a spacesuit with glowing rocket-powered jet gauntlets, fast and agile fighting pose. ${BATTLE_STYLE}` },
  { name: "Toaster Knight", rarity: "rare", element: "object", role: "tank",
    prompt: `An original cartoon creature: a toaster knight in armor, using two toaster-lids as round shields, popping toast, defensive stance. ${BATTLE_STYLE}` },
  { name: "Traffic Cone Rhino", rarity: "legendary", element: "object", role: "fighter",
    prompt: `An original cartoon creature: a rhino made of a traffic cone, a massive ramming horn at the front, armored hide, charging pose. ${BATTLE_STYLE}` },
];

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

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
    prompt: comboPrompt(combo.a, combo.b, rarity.key),
  };
}

/** Build a spec from a curated {a, b, rarity} entry. */
function buildCuratedSpec(entry, usedNames, usedSeeds) {
  let seed;
  do {
    seed = Math.floor(Math.random() * 1e9);
  } while (usedSeeds.has(seed));
  usedSeeds.add(seed);

  const rng = mulberry32(seed);
  const rarity = RARITIES.find((r) => r.key === entry.rarity) ?? RARITIES[0];
  const baseName = entry.name ?? titleCase(`${entry.a} ${entry.b}`);
  let name = baseName;
  let n = 2;
  while (usedNames.has(name)) name = `${baseName} ${n++}`;
  usedNames.add(name);

  return {
    id: slugify(name, seed),
    seed,
    name,
    archetype: "meme",
    rarity: rarity.key,
    income: randIntRange(rarity.income, rng),
    unlockLevel: rarity.unlock,
    spawnWeight: rarity.weight,
    glow: rarity.glow,
    palette: makePalette("meme", rng),
    scale: +(0.8 + rng() * 0.7).toFixed(2),
    rotationY: +(rng() * Math.PI * 2).toFixed(3),
    element: entry.element,
    role: entry.role,
    prompt: entry.prompt ?? comboPrompt(entry.a, entry.b, rarity.key),
  };
}

async function main() {
  // Always generate WITH textures unless explicitly overridden (refine = preview+texture).
  if (!process.env.MESHY_MODE) process.env.MESHY_MODE = "refine";
  const curated = process.argv.includes("curated") || process.env.CURATED === "1";
  const limit = process.argv.map(Number).find((n) => Number.isFinite(n) && n > 0);
  const count = curated
    ? Math.min(CURATED.length, limit ?? CURATED.length)
    : parseInt(process.argv[2] ?? process.env.COUNT ?? "12", 10) || 12;
  const generator = selectGenerator();
  const provider = generator.meta?.provider ?? "procedural";

  await fs.mkdir(OUT_DIR, { recursive: true });
  const manifest = await loadManifest();

  const usedNames = new Set(manifest.creatures.map((c) => c.name));
  const usedSeeds = new Set(manifest.creatures.map((c) => c.seed));

  console.log(`▶ Generating ${count} ${curated ? "curated " : ""}creature(s) with provider "${provider}"…`);
  let added = 0;

  for (let i = 0; i < count; i++) {
    const spec = curated ? buildCuratedSpec(CURATED[i], usedNames, usedSeeds) : buildSpec(usedNames, usedSeeds);
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
        ...(spec.element ? { element: spec.element } : {}),
        ...(spec.role ? { role: spec.role } : {}),
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
