// Procedural creature generator: builds an original low-poly GLB from primitive
// parts (no external service, no copyrighted assets) and a matching SVG thumb.
//
// Geometry math is done with three (works headless — no WebGL needed), then
// written to GLB with @gltf-transform/core.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Document, NodeIO } from "@gltf-transform/core";

/** Deterministic PRNG so a given seed always rebuilds the same creature. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function colored(geo, hex) {
  geo.deleteAttribute("uv");
  // Normalize every part to non-indexed so primitives with/without an index
  // buffer (icosahedron vs sphere) can be merged together.
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color(hex);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

/**
 * Assemble a creature mesh from archetype-driven parts. Returns a merged,
 * vertex-colored, indexed BufferGeometry.
 */
function buildGeometry(spec) {
  const rng = mulberry32(spec.seed);
  const [body, accent, dark] = [spec.palette[0], spec.palette[1] ?? spec.palette[0], "#1a1a22"];
  const parts = [];

  // Body — squashed icosahedron for a blobby look
  const bodyGeo = new THREE.IcosahedronGeometry(1, 1);
  const squash = 0.85 + rng() * 0.4;
  bodyGeo.scale(1, squash, 1);
  parts.push(colored(bodyGeo, body));

  // Eyes (white) + pupils (dark), facing +Z
  const eyeCount = rng() > 0.7 ? 1 : 2;
  const eyeY = 0.25 + rng() * 0.25;
  const eyeX = eyeCount === 1 ? 0 : 0.32;
  for (let i = 0; i < eyeCount; i++) {
    const sx = eyeCount === 1 ? 0 : i === 0 ? -eyeX : eyeX;
    const eye = new THREE.SphereGeometry(0.22, 10, 10);
    eye.translate(sx, eyeY, 0.82);
    parts.push(colored(eye, "#ffffff"));
    const pupil = new THREE.SphereGeometry(0.1, 8, 8);
    pupil.translate(sx, eyeY, 0.98);
    parts.push(colored(pupil, dark));
  }

  // Feet
  if (rng() > 0.3) {
    for (const sx of [-0.4, 0.4]) {
      const foot = new THREE.SphereGeometry(0.28, 8, 8);
      foot.scale(1, 0.6, 1.2);
      foot.translate(sx, -squash, 0.15);
      parts.push(colored(foot, accent));
    }
  }

  // Horns / antennae on top
  if (rng() > 0.45) {
    const horns = rng() > 0.5;
    for (const sx of [-0.35, 0.35]) {
      const top = horns
        ? new THREE.ConeGeometry(0.14, 0.5, 7)
        : new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6);
      top.translate(sx, squash + 0.25, 0);
      parts.push(colored(top, accent));
      if (!horns) {
        const bulb = new THREE.SphereGeometry(0.1, 8, 8);
        bulb.translate(sx, squash + 0.55, 0);
        parts.push(colored(bulb, body));
      }
    }
  }

  // Mouth — a small flattened dark sphere
  const mouth = new THREE.SphereGeometry(0.18, 8, 8);
  mouth.scale(1.3, 0.5, 0.6);
  mouth.translate(0, -0.15 + rng() * 0.1, 0.92);
  parts.push(colored(mouth, dark));

  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error("geometry merge failed");
  merged.computeVertexNormals();
  return merged;
}

/** Write a vertex-colored BufferGeometry to a GLB binary (Uint8Array). */
export async function geometryToGLB(geo, name, { metallic = 0.05, roughness = 0.55 } = {}) {
  const position = new Float32Array(geo.attributes.position.array);
  const normal = new Float32Array(geo.attributes.normal.array);
  const color = new Float32Array(geo.attributes.color.array);

  const doc = new Document();
  doc.createBuffer();
  const buffer = doc.getRoot().listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);

  const mat = doc
    .createMaterial(name)
    .setBaseColorFactor([1, 1, 1, 1])
    .setRoughnessFactor(roughness)
    .setMetallicFactor(metallic);

  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", acc("VEC3", position))
    .setAttribute("NORMAL", acc("VEC3", normal))
    .setAttribute("COLOR_0", acc("VEC3", color))
    .setMaterial(mat);
  if (geo.index) prim.setIndices(acc("SCALAR", new Uint32Array(geo.index.array)));

  const mesh = doc.createMesh(name).addPrimitive(prim);
  const node = doc.createNode(name).setMesh(mesh);
  doc.createScene().addChild(node);
  return new NodeIO().writeBinary(doc);
}

/** Build a GLB binary (Uint8Array) for the creature spec. */
export async function buildGLB(spec) {
  const geo = buildGeometry(spec);
  return geometryToGLB(geo, spec.name, { metallic: spec.archetype === "robot" ? 0.6 : 0.05 });
}

export { colored };

/** Build a lightweight SVG thumbnail from the palette. */
export function buildThumb(spec) {
  const [a, b] = [spec.palette[0], spec.palette[1] ?? spec.palette[0]];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs><radialGradient id="g" cx="50%" cy="40%" r="65%">
    <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
  </radialGradient></defs>
  <rect width="128" height="128" rx="18" fill="#10182b"/>
  <ellipse cx="64" cy="70" rx="42" ry="40" fill="url(#g)"/>
  <circle cx="50" cy="60" r="9" fill="#fff"/><circle cx="78" cy="60" r="9" fill="#fff"/>
  <circle cx="52" cy="62" r="4" fill="#1a1a22"/><circle cx="80" cy="62" r="4" fill="#1a1a22"/>
  <ellipse cx="64" cy="84" rx="10" ry="4" fill="#1a1a22"/>
</svg>`;
}

export const meta = { provider: "procedural", needsApiKey: false };
