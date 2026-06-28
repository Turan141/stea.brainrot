// Pluggable AI 3D-generation adapters. The procedural generator is the default
// and always works offline. These adapters let you swap in a paid text-to-3D
// service later by setting an API key — no code changes elsewhere.
//
// Each adapter implements:
//   meta: { provider, needsApiKey }
//   async buildGLB(spec)  -> Uint8Array   (downloaded GLB bytes)
//   buildThumb(spec)      -> string        (SVG markup; reuse procedural's)
//
// To activate:  set CREATURE_PROVIDER=meshy  and  MESHY_API_KEY=...

import { buildThumb } from "./procedural.mjs";

async function pollUntilDone(fetchStatus, { tries = 60, intervalMs = 5000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const s = await fetchStatus();
    if (s.status === "SUCCEEDED" && s.url) return s.url;
    if (s.status === "FAILED") throw new Error("AI generation failed");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("AI generation timed out");
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Meshy.ai text-to-3D adapter (https://docs.meshy.ai). */
export const meshy = {
  meta: { provider: "meshy", needsApiKey: true },
  buildThumb,
  async buildGLB(spec) {
    const key = process.env.MESHY_API_KEY;
    if (!key) throw new Error("MESHY_API_KEY is not set");
    const wantRefine = (process.env.MESHY_MODE || "preview") === "refine";
    const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    const base = "https://api.meshy.ai/openapi/v2/text-to-3d";

    const post = async (body) => {
      const r = await fetch(base, { method: "POST", headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`meshy create failed: ${r.status} ${await r.text()}`);
      return (await r.json()).result;
    };
    const poll = (taskId) =>
      pollUntilDone(async () => {
        const r = await fetch(`${base}/${taskId}`, { headers });
        const j = await r.json();
        return { status: j.status, url: j.model_urls?.glb };
      });

    // 1) preview (geometry). Meshy's v2 preview only accepts art_style "realistic"
    // (style only affects refine textures; geometry is the same).
    const previewId = await post({ mode: "preview", prompt: spec.prompt, art_style: "realistic", should_remesh: true });
    const previewUrl = await poll(previewId);

    // 2) optional refine (textures)
    if (wantRefine) {
      const refineId = await post({ mode: "refine", preview_task_id: previewId });
      const refinedUrl = await poll(refineId);
      return download(refinedUrl);
    }
    return download(previewUrl);
  },
};

/** Tripo3D adapter (https://platform.tripo3d.ai). */
export const tripo = {
  meta: { provider: "tripo", needsApiKey: true },
  buildThumb,
  async buildGLB(spec) {
    const key = process.env.TRIPO_API_KEY;
    if (!key) throw new Error("TRIPO_API_KEY is not set");
    const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    const create = await fetch("https://api.tripo3d.ai/v2/openapi/task", {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "text_to_model", prompt: spec.prompt }),
    });
    if (!create.ok) throw new Error(`tripo create failed: ${create.status}`);
    const { data } = await create.json();
    const taskId = data.task_id;
    const url = await pollUntilDone(async () => {
      const r = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${taskId}`, { headers });
      const j = await r.json();
      return { status: j.data?.status?.toUpperCase(), url: j.data?.output?.pbr_model || j.data?.output?.model };
    });
    return download(url);
  },
};
