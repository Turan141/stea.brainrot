// Procedural fallback builders for decoration props and the player character.
// Used when CREATURE_PROVIDER=procedural; with meshy/tripo the AI adapter is
// used instead (it only needs spec.prompt).

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { colored, geometryToGLB } from "./procedural.mjs";

function merge(parts) {
  const m = mergeGeometries(parts, false);
  if (!m) throw new Error("merge failed");
  m.computeVertexNormals();
  return m;
}

/** Build a simple recognizable prop per category. */
export async function buildPropGLB(spec) {
  const [a, b] = spec.palette;
  const parts = [];
  switch (spec.category) {
    case "tree": {
      const trunk = new THREE.CylinderGeometry(0.18, 0.25, 1.2, 8);
      trunk.translate(0, 0.6, 0);
      parts.push(colored(trunk, "#6b4a2b"));
      for (let i = 0; i < 3; i++) {
        const leaf = new THREE.IcosahedronGeometry(0.7 - i * 0.12, 0);
        leaf.translate(0, 1.3 + i * 0.45, 0);
        parts.push(colored(leaf, a));
      }
      break;
    }
    case "rock": {
      const r = new THREE.IcosahedronGeometry(0.7, 0);
      r.scale(1.2, 0.8, 1);
      parts.push(colored(r, a));
      break;
    }
    case "crystal": {
      for (const [sx, sy, h] of [[0, 0, 1.4], [0.3, 0, 0.9], [-0.3, 0, 1.0]]) {
        const c = new THREE.OctahedronGeometry(0.25, 0);
        c.scale(1, h, 1);
        c.translate(sx, h * 0.5, sy);
        parts.push(colored(c, b));
      }
      break;
    }
    case "crate": {
      const box = new THREE.BoxGeometry(0.9, 0.9, 0.9);
      box.translate(0, 0.45, 0);
      parts.push(colored(box, a));
      break;
    }
    case "mushroom": {
      const stem = new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8);
      stem.translate(0, 0.35, 0);
      parts.push(colored(stem, "#efe6d0"));
      const cap = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      cap.translate(0, 0.7, 0);
      parts.push(colored(cap, a));
      break;
    }
    case "lamp": {
      const post = new THREE.CylinderGeometry(0.08, 0.1, 2, 8);
      post.translate(0, 1, 0);
      parts.push(colored(post, "#3a3f4f"));
      const bulb = new THREE.SphereGeometry(0.22, 10, 10);
      bulb.translate(0, 2.1, 0);
      parts.push(colored(bulb, b));
      break;
    }
    case "sign": {
      const post = new THREE.CylinderGeometry(0.07, 0.07, 1.3, 6);
      post.translate(0, 0.65, 0);
      parts.push(colored(post, "#6b4a2b"));
      const board = new THREE.BoxGeometry(0.9, 0.4, 0.08);
      board.translate(0, 1.1, 0);
      parts.push(colored(board, a));
      break;
    }
    default: {
      const bush = new THREE.IcosahedronGeometry(0.6, 0);
      parts.push(colored(bush, a));
    }
  }
  return geometryToGLB(merge(parts), spec.id, { roughness: 0.85 });
}

/** Build a simple humanoid player character. */
export async function buildCharacterGLB(spec) {
  const [a, b] = spec.palette;
  const parts = [];
  const body = new THREE.CapsuleGeometry(0.35, 0.7, 6, 12);
  body.translate(0, 0.85, 0);
  parts.push(colored(body, a));
  const head = new THREE.SphereGeometry(0.34, 16, 16);
  head.translate(0, 1.7, 0);
  parts.push(colored(head, b));
  for (const sx of [-0.45, 0.45]) {
    const arm = new THREE.CapsuleGeometry(0.12, 0.5, 4, 8);
    arm.translate(sx, 0.95, 0);
    parts.push(colored(arm, a));
  }
  for (const sx of [-0.18, 0.18]) {
    const leg = new THREE.CapsuleGeometry(0.15, 0.5, 4, 8);
    leg.translate(sx, 0.3, 0);
    parts.push(colored(leg, "#2a3350"));
  }
  for (const sx of [-0.12, 0.12]) {
    const eye = new THREE.SphereGeometry(0.06, 8, 8);
    eye.translate(sx, 1.75, 0.28);
    parts.push(colored(eye, "#15151f"));
  }
  return geometryToGLB(merge(parts), spec.id, { roughness: 0.6 });
}
