#!/usr/bin/env node
// Compress a GLB in place: dedup duplicate textures/accessors, downscale +
// recompress textures to WebP, prune unused data. Big win for AI-generated
// models that ship with 4K PBR maps.
//
//   node scripts/compress-glb.mjs public/models/creatures/sock-shark.glb 1024

import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { dedup, prune, textureCompress } from "@gltf-transform/functions";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

const file = process.argv[2];
const maxSize = parseInt(process.argv[3] ?? "1024", 10) || 1024;
if (!file) {
  console.error("usage: node scripts/compress-glb.mjs <path.glb> [maxTextureSize]");
  process.exit(1);
}

const before = fs.statSync(file).size;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(file);

await doc.transform(
  dedup(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [maxSize, maxSize] }),
  prune()
);

await io.write(file, doc);
const after = fs.statSync(file).size;
const mb = (b) => (b / 1024 / 1024).toFixed(1);
console.log(`✔ ${file}: ${mb(before)} MB -> ${mb(after)} MB (${Math.round((1 - after / before) * 100)}% smaller)`);
