#!/usr/bin/env node
// Decoration props + player character generation pipeline.
//
//   npm run generate-assets                # 3 props + 1 character (default)
//   npm run generate-assets -- 6           # 6 props + character
//   CREATURE_PROVIDER=meshy npm run generate-assets -- 4   # via Meshy (uses .env key)
//
// Procedural provider builds primitive placeholders; meshy/tripo build real AI
// models. Writes GLBs + manifests the game auto-loads (props scattered in the
// world; character replaces the capsule).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";
import { selectGenerator } from "./generators/index.mjs";
import { buildPropGLB, buildCharacterGLB } from "./generators/props.mjs";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROPS_DIR = path.join(ROOT, "public/models/props");
const CHAR_DIR = path.join(ROOT, "public/models/character");

const PROP_CATALOG = [
  { category: "tree", name: "Stylized Tree", palette: ["#4fae5d", "#2f7a3a"], prompt: "a stylized low-poly cartoon tree with a rounded leafy canopy, game asset, vibrant" },
  { category: "rock", name: "Boulder", palette: ["#8c93a3", "#5e6577"], prompt: "a chunky low-poly boulder rock, smooth cartoon style, game asset" },
  { category: "crystal", name: "Crystal Cluster", palette: ["#7fe0ff", "#4f8fff"], prompt: "a glowing fantasy crystal cluster, translucent, cartoon, game asset" },
  { category: "crate", name: "Wooden Crate", palette: ["#b07a3c", "#7a5326"], prompt: "a wooden cartoon crate box with metal corners, game asset" },
  { category: "mushroom", name: "Giant Mushroom", palette: ["#ff6b8a", "#d23f63"], prompt: "a giant cute cartoon mushroom with a spotted cap, game asset" },
  { category: "lamp", name: "Lamp Post", palette: ["#3a3f4f", "#ffe08a"], prompt: "a stylized fantasy street lamp post with a glowing bulb, game asset" },
  { category: "bush", name: "Round Bush", palette: ["#3fa05a", "#2c7a42"], prompt: "a round cartoon bush shrub, low-poly, game asset" },
  { category: "sign", name: "Wooden Sign", palette: ["#8a5a2b", "#caa05a"], prompt: "a wooden directional sign post, cartoon, game asset" },
];

const CHARACTER = {
  id: "player",
  name: "Adventurer",
  palette: ["#4fa3ff", "#ffd24b"],
  prompt: "a cute original cartoon adventurer character, chunky rounded proportions, big head, game ready, standing T-pose, no weapons",
};

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function makeAssets() {
  const propCount = Math.max(0, parseInt(process.argv[2] ?? "3", 10) || 3);
  const provider = selectGenerator();
  const providerName = provider.meta?.provider ?? "procedural";
  const isProc = providerName === "procedural";

  await fs.mkdir(PROPS_DIR, { recursive: true });
  await fs.mkdir(CHAR_DIR, { recursive: true });

  console.log(`▶ Assets via "${providerName}": ${propCount} prop(s) + character`);

  // ---- Props ----
  const manifest = { version: 1, props: [] };
  for (let i = 0; i < propCount && i < PROP_CATALOG.length; i++) {
    const c = PROP_CATALOG[i];
    const spec = { id: slug(c.name), category: c.category, name: c.name, palette: c.palette, prompt: c.prompt };
    try {
      const glb = isProc ? await buildPropGLB(spec) : await provider.buildGLB(spec);
      await fs.writeFile(path.join(PROPS_DIR, `${spec.id}.glb`), glb);
      manifest.props.push({ id: spec.id, name: c.name, category: c.category, file: `models/props/${spec.id}.glb`, palette: c.palette });
      console.log(`  ✓ prop: ${c.name}`);
    } catch (err) {
      console.error(`  ✗ prop ${c.name}: ${err.message}`);
      if (provider.meta?.needsApiKey) process.exit(1);
    }
  }
  await fs.writeFile(path.join(PROPS_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  // ---- Character ----
  try {
    const glb = isProc ? await buildCharacterGLB(CHARACTER) : await provider.buildGLB(CHARACTER);
    await fs.writeFile(path.join(CHAR_DIR, "player.glb"), glb);
    await fs.writeFile(path.join(CHAR_DIR, "meta.json"), JSON.stringify({ version: 1, file: "models/character/player.glb", name: CHARACTER.name }, null, 2));
    console.log(`  ✓ character: ${CHARACTER.name}`);
  } catch (err) {
    console.error(`  ✗ character: ${err.message}`);
    if (provider.meta?.needsApiKey) process.exit(1);
  }

  console.log(`\n✔ Done. Props: ${manifest.props.length}. Character: yes.`);
}

makeAssets().catch((e) => {
  console.error(e);
  process.exit(1);
});
