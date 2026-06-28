#!/usr/bin/env node
// READ-ONLY: list recent Meshy text-to-3D tasks for this API key. No generation,
// no credits spent — just confirms what exists on the account.

import { loadEnv } from "./lib/env.mjs";
loadEnv();

const key = process.env.MESHY_API_KEY;
if (!key) {
  console.error("MESHY_API_KEY not set");
  process.exit(1);
}

const res = await fetch("https://api.meshy.ai/openapi/v2/text-to-3d?page_size=20&sort_by=-created_at", {
  headers: { Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error(`list failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const data = await res.json();
const tasks = Array.isArray(data) ? data : data.result ?? [];
console.log(`recent tasks: ${tasks.length}`);
for (const t of tasks) {
  const prompt = (t.prompt ?? "").slice(0, 50);
  console.log(`  ${t.id}  [${t.mode}/${t.status}]  ${prompt}`);
}
