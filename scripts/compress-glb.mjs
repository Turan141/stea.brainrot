#!/usr/bin/env node
// Compress a GLB in place. Two levers:
//   • geometry — weld + simplify (decimate) to cut triangle count
//   • textures — dedup + downscale/recompress to WebP, prune unused data
// The geometry lever is the fix for high-poly AI models that are huge even
// WITHOUT textures.
//
//   node scripts/compress-glb.mjs <path.glb> [maxTextureSize] [keepRatio]
//
//   keepRatio: fraction of triangles to KEEP (0..1). Omit/1 = no simplify.
//     0.5 = halve polys · 0.25 = quarter · 0.1 = aggressive low-poly
//
//   e.g.  node scripts/compress-glb.mjs public/models/creatures/foo.glb 1024 0.3

import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { dedup, prune, weld, simplify, textureCompress } from "@gltf-transform/functions";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const file = process.argv[2];
const maxSize = parseInt(process.argv[3] ?? "1024", 10) || 1024;
const keepRatio = Math.min(1, Math.max(0.01, parseFloat(process.argv[4] ?? "1")));
if (!file) {
  console.error("usage: node scripts/compress-glb.mjs <path.glb> [maxTextureSize] [keepRatio 0..1]");
  process.exit(1);
}

await MeshoptSimplifier.ready;

// Back up the ORIGINAL once (compression is in-place + lossy) so we can always
// re-compress from full quality. Backups live outside /public (not served).
const backupDir = path.resolve("asset-originals");
const backupPath = path.join(backupDir, path.basename(file));
if (!fs.existsSync(backupPath)) {
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(file, backupPath);
  console.log(`  ↳ backed up original → ${path.relative(process.cwd(), backupPath)}`);
}

const before = fs.statSync(file).size;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(file);

const tris = (d) =>
  d
    .getRoot()
    .listMeshes()
    .reduce(
      (n, m) =>
        n +
        m.listPrimitives().reduce((p, prim) => {
          const idx = prim.getIndices();
          const pos = prim.getAttribute("POSITION");
          return p + ((idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3);
        }, 0),
      0
    );
const trisBefore = tris(doc);

const steps = [dedup(), weld()];
if (keepRatio < 1) {
  steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: keepRatio, error: 0.02 }));
}
steps.push(textureCompress({ encoder: sharp, targetFormat: "webp", resize: [maxSize, maxSize] }), prune());

await doc.transform(...steps);

await io.write(file, doc);
const after = fs.statSync(file).size;
const trisAfter = tris(doc);
const mb = (b) => (b / 1024 / 1024).toFixed(2);
console.log(
  `✔ ${file}\n  size: ${mb(before)} MB → ${mb(after)} MB (${Math.round((1 - after / before) * 100)}% smaller)\n  tris: ${Math.round(trisBefore).toLocaleString()} → ${Math.round(trisAfter).toLocaleString()}`
);
