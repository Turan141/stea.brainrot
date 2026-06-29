#!/usr/bin/env node
// Add textures to creatures we generated in PREVIEW mode (geometry only).
// Recovers each creature's original preview task from the Meshy account, runs a
// REFINE on it (textures, no geometry regen), downloads the textured GLB, swaps
// the file in place, and records the task ids back into metadata.json so the
// model is always recoverable later.
//
// PAID: each refined creature costs Meshy refine credits.
//
//   node scripts/refine-untextured.mjs                # default target set below
//   node scripts/refine-untextured.mjs id-a id-b      # only these creature ids
//   node scripts/refine-untextured.mjs --dry          # match only, no API calls

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(root, "public/models/creatures/metadata.json");
const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";

// Creatures that were generated preview-only (no textures). avocado-coffee-cup
// is already refined, so it is intentionally not here.
const DEFAULT_TARGETS = [
  "fire-hydrant-dinosaur-36027",
  "cuckoo-clock-axolotl-92632",
  "washing-machine-narwhal-22130",
  "traffic-cone-corgi-8246",
  "toaster-octopus-4064",
  "narwhal-crab-14595",
  "traffic-cone-duck-43730",
  "ceiling-fan-robot-53840",
];

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const targets = args.filter((a) => !a.startsWith("--"));
const wantedIds = targets.length ? targets : DEFAULT_TARGETS;

const key = process.env.MESHY_API_KEY;
if (!key) {
  console.error("MESHY_API_KEY not set");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

/** Keywords from a creature id: drop the trailing numeric suffix tokens. */
function keywords(id) {
  return id.split("-").filter((t) => t && !/^\d+$/.test(t));
}

async function listTasks() {
  const res = await fetch(`${BASE}?page_size=50&sort_by=-created_at`, { headers });
  if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.result ?? [];
}

/** The most recent SUCCEEDED preview task whose prompt contains all keywords. */
function matchPreview(tasks, id) {
  const kws = keywords(id);
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

async function refineOne(def, previewTaskId) {
  console.log(`  [${def.id}] refine of ${previewTaskId} …`);
  const refineId = await post({ mode: "refine", preview_task_id: previewTaskId });
  const url = await poll(refineId);
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const out = path.join(root, "public", def.file);
  fs.writeFileSync(out, bytes);
  def.previewTaskId = previewTaskId;
  def.refineTaskId = refineId;
  def.textured = true;
  console.log(`  [${def.id}] ✓ ${(bytes.length / 1e6).toFixed(2)} MB → ${def.file}`);
}

const tasks = await listTasks();
console.log(`account has ${tasks.length} tasks; targeting ${wantedIds.length} creatures\n`);

const jobs = [];
for (const id of wantedIds) {
  const def = manifest.creatures.find((c) => c.id === id);
  if (!def) {
    console.warn(`! ${id}: not in manifest, skipping`);
    continue;
  }
  const preview = matchPreview(tasks, id);
  if (!preview) {
    console.warn(`! ${id}: no matching preview task found, skipping`);
    continue;
  }
  console.log(`• ${id} ↔ ${preview.id}`);
  if (!dry) jobs.push(refineOne(def, preview.id));
}

if (dry) {
  console.log("\n--dry: no API calls made.");
  process.exit(0);
}

const results = await Promise.allSettled(jobs);
const ok = results.filter((r) => r.status === "fulfilled").length;
const failed = results.filter((r) => r.status === "rejected");
for (const f of failed) console.error("  FAIL:", f.reason?.message ?? f.reason);

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nDone: ${ok} textured, ${failed.length} failed. metadata.json updated.`);
