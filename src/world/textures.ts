import * as THREE from "three";

/**
 * Cheap procedural canvas textures so the scene reads richer than flat colors —
 * organic grass, a stone-plaza base floor and asphalt road with lane markings.
 * All tileable; generated once at startup (no asset downloads).
 */

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

function wrap(c: HTMLCanvasElement, repeatX: number, repeatY = repeatX): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Soft organic grass — mottled greens, gentle so tiling stays subtle. */
export function grassTexture(repeat = 8): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = canvas(S);

  // base vertical-ish gradient so it never looks dead-flat
  const base = ctx.createLinearGradient(0, 0, S, S);
  base.addColorStop(0, "#4a8a5c");
  base.addColorStop(1, "#3c7a4e");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  // soft mottling blobs (low alpha) — organic field variation
  const tones = ["#52955f", "#3a7048", "#5aa066", "#347044", "#46885a"];
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 20 + Math.random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, tones[(Math.random() * tones.length) | 0]);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  ctx.globalAlpha = 1;

  // very fine speckle for close-up grain
  for (let i = 0; i < 4000; i++) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? "rgba(150,200,150,0.10)" : "rgba(20,55,30,0.10)";
    ctx.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
  }
  return wrap(c, repeat);
}

/** Light stone-plaza tiles with grout lines and subtle per-tile shading. */
export function plazaTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = "#3a4358"; // grout / gap color
  ctx.fillRect(0, 0, S, S);

  const tiles = 4;
  const step = S / tiles;
  const gap = 6;
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const x = tx * step + gap / 2;
      const y = ty * step + gap / 2;
      const w = step - gap;
      const h = step - gap;
      const shade = 0.92 + Math.random() * 0.14;
      // tile base with a slight diagonal sheen
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, shadeHex(0x9aa3b4, shade));
      g.addColorStop(1, shadeHex(0x7f8aa0, shade));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // faint speckle on the stone
      for (let s = 0; s < 60; s++) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
        ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 2, 2);
      }
      // soft inner bevel highlight
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
  }
  return wrap(c, 1);
}

/** Asphalt with side stripes + dashed center line (tiles along the road length). */
export function roadTexture(repeatV = 8): THREE.CanvasTexture {
  const [c, ctx] = canvas(128);
  ctx.fillStyle = "#2a3142";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? "rgba(160,170,190,0.06)" : "rgba(0,0,0,0.18)";
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  ctx.fillStyle = "#e9c84b";
  ctx.fillRect(4, 0, 5, 128);
  ctx.fillRect(119, 0, 5, 128);
  ctx.fillStyle = "rgba(230,236,255,0.85)";
  ctx.fillRect(60, 24, 8, 80);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, repeatV);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function shadeHex(hex: number, factor: number): string {
  const r = Math.min(255, ((hex >> 16) & 255) * factor) | 0;
  const g = Math.min(255, ((hex >> 8) & 255) * factor) | 0;
  const b = Math.min(255, (hex & 255) * factor) | 0;
  return `rgb(${r},${g},${b})`;
}
