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

/**
 * Warm cut-stone plaza floor: large limestone slabs laid in a running-bond
 * pattern (rows offset by half a slab) with thin grout and gentle per-slab tone
 * + veining. Calm and premium — no busy mosaic, no bright accents. Tileable.
 */
export function plazaTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = "#5a4d3b"; // warm grout
  ctx.fillRect(0, 0, S, S);

  const cols = 3;
  const rows = 4;
  const sw = S / cols;
  const sh = S / rows;
  const gap = 4;
  const stone = [0xd3c19a, 0xddcca6, 0xc7b48b, 0xe5d6b2];

  const slab = (x: number, y: number, w: number, h: number, col: number) => {
    const shade = 0.94 + Math.random() * 0.1;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, shadeHex(col, shade + 0.05));
    g.addColorStop(1, shadeHex(col, shade - 0.05));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // subtle veining
    ctx.strokeStyle = "rgba(120,100,70,0.15)";
    ctx.lineWidth = 1;
    for (let v = 0; v < 2; v++) {
      ctx.beginPath();
      ctx.moveTo(x + Math.random() * w, y);
      ctx.lineTo(x + Math.random() * w, y + h);
      ctx.stroke();
    }
    // fine grain
    for (let s = 0; s < 40; s++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(60,45,25,0.06)";
      ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 2, 2);
    }
    // soft top-edge highlight
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  };

  for (let ry = 0; ry < rows; ry++) {
    const offset = (ry % 2) * (sw / 2); // running bond
    for (let cx = -1; cx <= cols; cx++) {
      const x = cx * sw + offset + gap / 2;
      const y = ry * sh + gap / 2;
      slab(x, y, sw - gap, sh - gap, stone[(cx + ry * 2 + 8) % stone.length]);
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
