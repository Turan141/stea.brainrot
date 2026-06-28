#!/usr/bin/env node
// Import hand-made / website-downloaded GLB models into the game.
//
//   npm run import-models                # creatures (default)
//   npm run import-models -- scene       # base structures
//
// Drop .glb files into the target folder, then run this. Any file not already
// in the manifest is registered (metadata + thumbnail), so it shows up in game.
//
// Creatures: the filename may encode metadata, separated by "__":
//   toaster-octopus__legendary__tech__assassin.glb
//     name  = "Toaster Octopus"
//     rarity/element/role from the tags (any order; unknown tags ignored).
//   Missing tags are filled with sensible (varied) defaults.
//
// Scene: filename = asset id. Name it to match a base building so it auto-swaps:
//   arena.glb · warehouse.glb · storage.glb · workshop.glb · shop.glb · upgrades.glb
//   (base-hq / fusion-lab / base-gate already exist)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mulberry32, buildThumb } from "./generators/procedural.mjs";
import { RARITIES, makePalette, randIntRange, pickRarity } from "./lib/taxonomy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, "../public");

const ELEMENTS = ["food", "tech", "beast", "object", "cosmic"];
const ROLES = ["tank", "fighter", "assassin", "support", "trickster"];

function titleCase(s) {
  return s.replace(/[-_]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function importCreatures() {
  const dir = path.join(PUBLIC, "models/creatures");
  const manifestPath = path.join(dir, "metadata.json");
  const manifest = await readJson(manifestPath, { version: 1, creatures: [] });
  const knownFiles = new Set(manifest.creatures.map((c) => c.file));
  const usedNames = new Set(manifest.creatures.map((c) => c.name));

  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".glb"));
  let added = 0;
  for (const f of files) {
    const rel = `models/creatures/${f}`;
    if (knownFiles.has(rel)) continue;

    const base = f.replace(/\.glb$/i, "");
    const [nameSlug, ...tags] = base.split("__");
    const tagSet = tags.map((t) => t.toLowerCase());
    const seed = hashSeed(base);
    const rng = mulberry32(seed);

    const rarity = RARITIES.find((r) => tagSet.includes(r.key)) ?? pickRarity(rng);
    const element = ELEMENTS.find((e) => tagSet.includes(e)) ?? ELEMENTS[seed % ELEMENTS.length];
    const role = ROLES.find((r) => tagSet.includes(r)) ?? ROLES[(seed >> 3) % ROLES.length];

    let name = titleCase(nameSlug) || "Imported Creature";
    let n = 2;
    while (usedNames.has(name)) name = `${titleCase(nameSlug)} ${n++}`;
    usedNames.add(name);

    const id = `${slugify(name)}-${seed % 100000}`;
    const spec = {
      id,
      seed,
      name,
      archetype: "meme",
      rarity: rarity.key,
      income: randIntRange(rarity.income, rng),
      unlockLevel: rarity.unlock,
      spawnWeight: rarity.weight,
      glow: rarity.glow,
      palette: makePalette("meme", rng),
      scale: 1,
      rotationY: 0,
    };

    await fs.writeFile(path.join(dir, `${id}.svg`), buildThumb(spec));
    manifest.creatures.push({
      ...spec,
      element,
      role,
      file: rel,
      thumb: `models/creatures/${id}.svg`,
    });
    added++;
    console.log(`  ✓ ${name.padEnd(26)} [${rarity.key}] ${element}/${role}  ← ${f}`);
  }

  manifest.version = 1;
  manifest.generatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n✔ Imported ${added} creature(s). Total: ${manifest.creatures.length}.`);
}

async function importScene() {
  const dir = path.join(PUBLIC, "models/scene");
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = await readJson(manifestPath, { version: 1, assets: [] });
  const known = new Set(manifest.assets.map((a) => a.id));

  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".glb"));
  let added = 0;
  for (const f of files) {
    const id = slugify(f.replace(/\.glb$/i, ""));
    if (known.has(id)) continue;
    manifest.assets.push({ id, name: titleCase(id), group: "structures", file: `models/scene/${f}` });
    added++;
    console.log(`  ✓ ${id}  ← ${f}`);
  }

  manifest.version = 1;
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n✔ Imported ${added} scene asset(s). Total: ${manifest.assets.length}.`);
}

const target = (process.argv[2] || "creatures").toLowerCase();
console.log(`▶ Importing ${target}…`);
if (target === "scene") await importScene();
else await importCreatures();
