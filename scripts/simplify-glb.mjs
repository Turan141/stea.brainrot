#!/usr/bin/env node
// Geometry-only decimation for GLB files. weld + simplify to cut triangle
// count WITHOUT touching textures (so already-compressed textures don't get
// re-encoded / degraded). Originals are backed up once to asset-originals/.
//
//   node scripts/simplify-glb.mjs <keepRatio> <file.glb> [file2.glb ...]
//
//   keepRatio: fraction of triangles to KEEP (0..1). 0.3 = keep 30%.

import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { weld, simplify } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const keepRatio = Math.min(1, Math.max(0.05, parseFloat(process.argv[2] ?? "1")));
// Error bound (env ERR). Higher = lets simplify hit the target ratio on stubborn
// meshes at the cost of shape fidelity. 0.001 = shape-preserving, 0.05 = aggressive.
const ERR = parseFloat(process.env.ERR ?? "0.01");
const files = process.argv.slice(3);
if (!files.length || !(keepRatio < 1)) {
  console.error("usage: node scripts/simplify-glb.mjs <keepRatio 0..1> <file.glb> [...]");
  process.exit(1);
}

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const backupDir = path.resolve("asset-originals");

function triCount(doc) {
  let t = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute("POSITION");
      t += (idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3;
    }
  return Math.round(t);
}

for (const file of files) {
  if (!fs.existsSync(file)) { console.warn("skip (missing):", file); continue; }
  const backupPath = path.join(backupDir, path.basename(file));
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(file, backupPath);
  }
  const doc = await io.read(file);
  const before = triCount(doc);
  await doc.transform(
    weld({ tolerance: 0.0001 }),
    simplify({ simplifier: MeshoptSimplifier, ratio: keepRatio, error: ERR, lockBorder: false })
  );
  const after = triCount(doc);
  await io.write(file, doc);
  const sz = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(`${path.basename(file).padEnd(36)} ${before} → ${after} tris  (${sz} KB)`);
}
console.log("done");
