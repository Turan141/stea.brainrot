#!/usr/bin/env node
// Batch-generate the remaining base props/structures as textured GLBs
// (preview -> refine). Saves each to public/models/scene/<id>.glb and records
// task ids in scene/tasks.json. PAID: one preview + one refine per item.
//
//   node scripts/gen-props-batch.mjs          # all
//   node scripts/gen-props-batch.mjs --dry    # list only

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCENE_DIR = path.join(root, "public/models/scene");
const LEDGER = path.join(SCENE_DIR, "tasks.json");
const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";

const SPECS = [
  { id: "prop-lamp", prompt: "A stylized cartoon street lamp: an ornate metal pole on a stone base with a glowing warm lantern on top, cute low-poly, colorful, game-ready, centered, flat bottom, NO ground plane." },
  { id: "prop-planter", prompt: "A stylized cartoon stone planter box with colorful round low-poly flowers and green foliage, cute, game-ready, low-poly, centered, flat bottom, NO ground plane." },
  { id: "prop-crate", prompt: "A stylized cartoon wooden cargo crate with metal corner brackets, cute low-poly, game-ready, centered, flat bottom, NO ground plane." },
  { id: "prop-barrel", prompt: "A stylized cartoon wooden barrel with metal hoop rings, cute low-poly, game-ready, centered, flat bottom, NO ground plane." },
  { id: "prop-banner", prompt: "A stylized cartoon hanging fabric pennant banner with a round emblem and a horizontal top bar, draped cloth, cute low-poly, game-ready, centered, NO ground plane." },
  { id: "prop-bench", prompt: "A stylized cartoon park bench with wood slats and a metal frame, cute low-poly, game-ready, centered, flat bottom, NO ground plane." },
  { id: "prop-stall", prompt: "A stylized cartoon market stall with a wooden counter, a striped awning and goods on top, cute low-poly, game-ready, centered, flat bottom, NO ground plane." },
  { id: "base-fountain", prompt: "A stylized cartoon multi-tier stone fountain with a round basin and glowing blue water, ornate cute low-poly, game-ready, centered, flat bottom, NO ground plane." },
  { id: "base-cage", prompt: "A stylized cartoon creature pen: a low square fenced cage with corner posts, top rails and a little gate, open top, cute low-poly, game-ready, centered, flat bottom, NO ground plane." },
];

const dry = process.argv.includes("--dry");
const key = process.env.MESHY_API_KEY;
if (!key) {
  console.error("MESHY_API_KEY not set");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function post(body) {
  const r = await fetch(BASE, { method: "POST", headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`create failed: ${r.status} ${await r.text()}`);
  return (await r.json()).result;
}
async function poll(taskId, { tries = 100, intervalMs = 5000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${BASE}/${taskId}`, { headers });
    const j = await r.json();
    if (j.status === "SUCCEEDED" && j.model_urls?.glb) return j.model_urls.glb;
    if (j.status === "FAILED") throw new Error(`task ${taskId} FAILED`);
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(`task ${taskId} timed out`);
}

if (dry) {
  for (const s of SPECS) console.log(`• ${s.id}`);
  console.log(`\n--dry: ${SPECS.length} items, no API calls.`);
  process.exit(0);
}

fs.mkdirSync(SCENE_DIR, { recursive: true });
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : {};

async function genOne(s) {
  console.log(`[${s.id}] preview…`);
  const previewId = await post({ mode: "preview", prompt: s.prompt, art_style: "realistic", should_remesh: true });
  await poll(previewId);
  console.log(`[${s.id}] refine…`);
  const refineId = await post({ mode: "refine", preview_task_id: previewId });
  const url = await poll(refineId);
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(path.join(SCENE_DIR, `${s.id}.glb`), bytes);
  ledger[s.id] = { previewTaskId: previewId, refineTaskId: refineId, prompt: s.prompt };
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + "\n"); // checkpoint each
  console.log(`[${s.id}] ✓ ${(bytes.length / 1e6).toFixed(2)} MB`);
}

const results = await Promise.allSettled(SPECS.map(genOne));
results.forEach((r, i) => {
  if (r.status === "rejected") console.error(`  FAIL ${SPECS[i].id}:`, r.reason?.message ?? r.reason);
});
console.log(`\nDone: ${results.filter((r) => r.status === "fulfilled").length}/${SPECS.length} generated.`);
