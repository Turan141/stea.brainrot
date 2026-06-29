// Generates branded source art for the app icon + splash, then @capacitor/assets
// expands them into every Android density. Pure SVG → sharp raster, no deps art.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = "resources";

/** Glowing hex-gem emblem (matches the creature/fusion theme). */
function emblem(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  const inner = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    inner.push(`${(cx + Math.cos(a) * r * 0.62).toFixed(1)},${(cy + Math.sin(a) * r * 0.62).toFixed(1)}`);
  }
  return `
    <polygon points="${pts.join(" ")}" fill="url(#gem)" stroke="#bff3ff" stroke-width="${r * 0.05}" filter="url(#glow)"/>
    <polygon points="${inner.join(" ")}" fill="#0a1430" opacity="0.55"/>
    <polygon points="${inner.join(" ")}" fill="url(#facet)" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.16}" fill="#fff" opacity="0.9" filter="url(#glow)"/>
  `;
}

const defs = `
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#1b2a52"/>
      <stop offset="55%" stop-color="#0f1730"/>
      <stop offset="100%" stop-color="#070b16"/>
    </radialGradient>
    <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4fe3ff"/>
      <stop offset="50%" stop-color="#8a6bff"/>
      <stop offset="100%" stop-color="#ff5db1"/>
    </linearGradient>
    <linearGradient id="facet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7fd6ff" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#6f3fd0" stop-opacity="0.3"/>
    </linearGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="14" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

function iconSVG(size) {
  const c = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${defs}
    <rect width="${size}" height="${size}" fill="url(#bg)"/>
    ${emblem(c, c, size * 0.34)}
  </svg>`;
}

function splashSVG(size, dark) {
  const c = size / 2;
  const bg = dark ? "#05080f" : "#0b0f1a";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${defs}
    <rect width="${size}" height="${size}" fill="${bg}"/>
    <rect width="${size}" height="${size}" fill="url(#bg)" opacity="0.9"/>
    ${emblem(c, c - size * 0.06, size * 0.16)}
    <text x="${c}" y="${c + size * 0.16}" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-weight="800"
      font-size="${size * 0.062}" fill="#eaf2ff" letter-spacing="${size * 0.004}">BRAINROT HEIST</text>
    <text x="${c}" y="${c + size * 0.205}" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-weight="500"
      font-size="${size * 0.026}" fill="#7fa6d8" letter-spacing="${size * 0.006}">collect · fuse · compete</text>
  </svg>`;
}

await mkdir(OUT, { recursive: true });
const jobs = [
  ["icon.png", iconSVG(1024)],
  ["splash.png", splashSVG(2732, false)],
  ["splash-dark.png", splashSVG(2732, true)],
];
for (const [name, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${name}`);
  await writeFile(`${OUT}/${name.replace(".png", ".svg")}`, svg);
  console.log("wrote", `${OUT}/${name}`);
}
console.log("done");
