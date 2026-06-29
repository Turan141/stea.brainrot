#!/usr/bin/env node
// Add textures to base STRUCTURES we generated in preview mode. Recovers each
// one's original preview task from the Meshy account, runs a refine (textures,
// no geometry regen), downloads the textured GLB, swaps it in place under
// public/models/scene, and records task ids in scene/tasks.json.
//
// PAID: each refined structure costs Meshy refine credits.
//
//   node scripts/refine-scene.mjs        # all targets below
//   node scripts/refine-scene.mjs --dry  # match only, no API calls

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCENE_DIR = path.join(root, "public/models/scene");
const LEDGER = path.join(SCENE_DIR, "tasks.json");
const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";

// scene asset id → output file + keywords that identify its preview prompt
const TARGETS = [
  { id: "base-gate", file: "base-gate.glb", keywords: ["entrance", "gate"] },
  { id: "base-hq", file: "base-hq.glb", keywords: ["headquarters"] },
  { id: "fusion-lab", file: "fusion-lab.glb", keywords: ["fusion", "laboratory"] },
  { id: "pedestal", file: "pedestal.glb", keywords: ["pedestal"] },
];

const dry = process.argv.includes("--dry");
const key = process.env.MESHY_API_KEY;
if (!key) {
  console.error("MESHY_API_KEY not set");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function listTasks() {
  const res = await fetch(`${BASE}?page_size=50&sort_by=-created_at`, { headers });
  if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.result ?? [];
}
function matchPreview(tasks, kws) {
  return tasks.find((t) => {
    if (t.mode !== "preview" || t.status !== "SUCCEEDED") return false;
    const p = (t.prompt ?? "").toLowerCase();
    return kws.every((k) => p.includes(k));
  });
}
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

const tasks = await listTasks();
console.log(`account has ${tasks.length} tasks; targeting ${TARGETS.length} structures\n`);

const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : {};
const jobs = [];
for (const t of TARGETS) {
  const preview = matchPreview(tasks, t.keywords);
  if (!preview) {
    console.warn(`! ${t.id}: no matching preview task, skipping`);
    continue;
  }
  console.log(`• ${t.id} ↔ ${preview.id}  "${(preview.prompt ?? "").slice(0, 50)}"`);
  if (dry) continue;
  jobs.push(
    (async () => {
      const refineId = await post({ mode: "refine", preview_task_id: preview.id });
      const url = await poll(refineId);
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      fs.writeFileSync(path.join(SCENE_DIR, t.file), bytes);
      ledger[t.id] = { previewTaskId: preview.id, refineTaskId: refineId, prompt: preview.prompt };
      console.log(`  [${t.id}] ✓ ${(bytes.length / 1e6).toFixed(2)} MB → models/scene/${t.file}`);
    })()
  );
}

if (dry) {
  console.log("\n--dry: no API calls made.");
  process.exit(0);
}

const results = await Promise.allSettled(jobs);
for (const f of results.filter((r) => r.status === "rejected")) console.error("  FAIL:", f.reason?.message ?? f.reason);
fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + "\n");
console.log(`\nDone: ${results.filter((r) => r.status === "fulfilled").length}/${jobs.length} textured.`);
