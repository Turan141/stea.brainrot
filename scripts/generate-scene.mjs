#!/usr/bin/env node
// Scene asset pipeline — base structures + environment props for the player hub.
//
//   CREATURE_PROVIDER=meshy node scripts/generate-scene.mjs structures
//   CREATURE_PROVIDER=meshy node scripts/generate-scene.mjs props
//   node scripts/generate-scene.mjs all          (procedural fallback if no key)
//
// Writes GLBs + a manifest to public/models/scene/. The game loads & places them.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { loadEnv } from "./lib/env.mjs";
import { selectGenerator } from "./generators/index.mjs";
import { colored, geometryToGLB } from "./generators/procedural.mjs";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../public/models/scene");
const MANIFEST = path.join(OUT, "manifest.json");

const CATALOG = {
  structures: [
    { id: "base-hq", name: "HQ", palette: ["#4f8fff", "#ffd24b"], prompt: "a stylized low-poly cartoon HQ headquarters building, cute, colorful, rounded roof, friendly, game-ready, under 6000 triangles" },
    { id: "fusion-lab", name: "Fusion Lab", palette: ["#a970ff", "#2ee6a6"], prompt: "a stylized low-poly cartoon science fusion laboratory dome with glowing tubes and antennas, colorful, game-ready, under 6000 triangles" },
    { id: "pedestal", name: "Pedestal", palette: ["#cfd6e6", "#6f86b8"], prompt: "a stylized low-poly display pedestal podium with a glowing top ring, cartoon, game-ready, under 1500 triangles" },
    { id: "base-gate", name: "Gate", palette: ["#3a4a72", "#ffe08a"], prompt: "a stylized low-poly cartoon entrance gate arch with banners, colorful, game-ready, under 3000 triangles" },
  ],
  shop: [
    { id: "shop", name: "Creature Shop", palette: ["#33c2b0", "#ffd24b"], prompt: "a stylized low-poly cartoon creature pet-shop stall with a striped teal awning, wooden counter, a hanging sign, glass jars and small cages holding cute colorful creatures on the shelves, friendly, vibrant, game-ready, under 6000 triangles" },
  ],
  props: [
    { id: "tree", name: "Tree", palette: ["#4fae5d", "#2f7a3a"], prompt: "a stylized low-poly cartoon tree with a rounded leafy canopy, colorful, game-ready, under 2000 triangles" },
    { id: "rock", name: "Rock", palette: ["#8c93a3", "#5e6577"], prompt: "a chunky low-poly cartoon boulder rock, game-ready, under 1500 triangles" },
    { id: "lamp", name: "Lamp", palette: ["#3a3f4f", "#ffe08a"], prompt: "a stylized low-poly cartoon street lamp post with a glowing bulb, game-ready, under 1500 triangles" },
    { id: "fence", name: "Fence", palette: ["#8a5a2b", "#caa05a"], prompt: "a stylized low-poly cartoon wooden fence segment, game-ready, under 1000 triangles" },
    { id: "bush", name: "Bush", palette: ["#3fa05a", "#2c7a42"], prompt: "a round stylized low-poly cartoon bush shrub, game-ready, under 1000 triangles" },
  ],
};

/** Procedural fallback: a simple colored box so the pipeline runs without a key. */
async function fallbackGLB(spec) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  return geometryToGLB(colored(geo, spec.palette[0]), spec.id, { roughness: 0.85 });
}

async function main() {
  const group = (process.argv[2] ?? "all").toLowerCase();
  const groups = group === "all" ? ["structures", "props"] : [group];
  if (!groups.every((g) => CATALOG[g])) {
    console.error(`unknown group "${group}". use: structures | props | all`);
    process.exit(1);
  }

  const generator = selectGenerator();
  const provider = generator.meta?.provider ?? "procedural";
  const isProc = provider === "procedural";
  await fs.mkdir(OUT, { recursive: true });

  // merge with any existing manifest so re-runs append/replace by id
  let manifest = { version: 1, assets: [] };
  try {
    manifest = JSON.parse(await fs.readFile(MANIFEST, "utf8"));
  } catch {
    /* none yet */
  }

  console.log(`▶ Scene assets via "${provider}": [${groups.join(", ")}]`);
  for (const g of groups) {
    for (const spec of CATALOG[g]) {
      try {
        const glb = isProc ? await fallbackGLB(spec) : await generator.buildGLB(spec);
        await fs.writeFile(path.join(OUT, `${spec.id}.glb`), glb);
        manifest.assets = manifest.assets.filter((a) => a.id !== spec.id);
        manifest.assets.push({ id: spec.id, name: spec.name, group: g, file: `models/scene/${spec.id}.glb` });
        console.log(`  ✓ ${g}: ${spec.name}`);
      } catch (err) {
        console.error(`  ✗ ${spec.name}: ${err.message}`);
        if (generator.meta?.needsApiKey) process.exit(1);
      }
    }
  }

  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\n✔ Scene manifest: ${manifest.assets.length} asset(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
