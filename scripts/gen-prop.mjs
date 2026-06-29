#!/usr/bin/env node
// Generate a single textured scene prop via Meshy (preview -> refine) and save
// it under public/models/scene/<name>.glb. Records task ids alongside so the
// asset is recoverable later. PAID: one preview + one refine per call.
//
//   node scripts/gen-prop.mjs <name> "<prompt>"
//
// Multiple props: call once per prop (keeps prompts explicit / approvable).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCENE_DIR = path.join(root, "public/models/scene");
const LEDGER = path.join(SCENE_DIR, "tasks.json"); // name -> { previewTaskId, refineTaskId, prompt }
const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";

const [name, prompt] = process.argv.slice(2);
if (!name || !prompt) {
  console.error('usage: node scripts/gen-prop.mjs <name> "<prompt>"');
  process.exit(1);
}

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
async function poll(taskId, { tries = 80, intervalMs = 5000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${BASE}/${taskId}`, { headers });
    const j = await r.json();
    if (j.status === "SUCCEEDED" && j.model_urls?.glb) return j.model_urls.glb;
    if (j.status === "FAILED") throw new Error(`task ${taskId} FAILED`);
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(`task ${taskId} timed out`);
}

fs.mkdirSync(SCENE_DIR, { recursive: true });

console.log(`[${name}] preview …`);
const previewId = await post({ mode: "preview", prompt, art_style: "realistic", should_remesh: true });
await poll(previewId);
console.log(`[${name}] refine …`);
const refineId = await post({ mode: "refine", preview_task_id: previewId });
const url = await poll(refineId);
const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
const out = path.join(SCENE_DIR, `${name}.glb`);
fs.writeFileSync(out, bytes);

const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : {};
ledger[name] = { previewTaskId: previewId, refineTaskId: refineId, prompt };
fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + "\n");

console.log(`[${name}] ✓ ${(bytes.length / 1e6).toFixed(2)} MB → models/scene/${name}.glb`);
