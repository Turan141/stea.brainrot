// Original creature taxonomy: archetypes, name fragments, rarity tables and
// palette generation. Nothing here references existing/branded characters.

export const ARCHETYPES = {
  fruit: { nouns: ["Mango", "Durian", "Kiwi", "Lychee", "Papaya", "Fig", "Plum", "Guava"], hue: [20, 140] },
  food: { nouns: ["Toaster Waffle", "Dumpling", "Pretzel", "Taco", "Donut", "Pickle", "Meatball", "Noodle"], hue: [25, 60] },
  robot: { nouns: ["Bot", "Droid", "Servo", "Cog", "Circuit", "Unit", "Mech", "Gizmo"], hue: [180, 260] },
  monster: { nouns: ["Gloop", "Fang", "Blob", "Gnash", "Lurk", "Snarl", "Critter", "Beastie"], hue: [270, 340] },
  meme: { nouns: ["Doodle", "Wojek", "Smol", "Chonk", "Derp", "Yeet", "Boop", "Zoom"], hue: [0, 360] },
  animal: { nouns: ["Axolotl", "Quokka", "Capy", "Narwhal", "Pangolin", "Tapir", "Wombat", "Sloth"], hue: [30, 210] },
  object: { nouns: ["Lamp", "Sock", "Mug", "Brick", "Spork", "Button", "Cube", "Bell"], hue: [200, 300] },
};

export const ADJECTIVES = [
  "Wobbly", "Sneaky", "Cosmic", "Greasy", "Turbo", "Sleepy", "Spicy", "Crusty",
  "Glitchy", "Funky", "Mega", "Tiny", "Cursed", "Shiny", "Goofy", "Feral",
  "Bouncy", "Soggy", "Electric", "Royal", "Galactic", "Vintage", "Quantum", "Plush",
];

export const RARITIES = [
  { key: "common", weight: 50, income: [1, 3], unlock: 1, glow: 0.05 },
  { key: "rare", weight: 28, income: [4, 9], unlock: 2, glow: 0.15 },
  { key: "epic", weight: 14, income: [10, 24], unlock: 3, glow: 0.3 },
  { key: "legendary", weight: 6, income: [28, 60], unlock: 4, glow: 0.5 },
  { key: "mythic", weight: 2, income: [70, 160], unlock: 5, glow: 0.8 },
];

const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);

function hslHex(h, s, l) {
  h /= 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function makePalette(archetype, rng) {
  const [h0, h1] = ARCHETYPES[archetype].hue;
  const baseHue = h0 + rng() * (h1 - h0);
  const accentHue = (baseHue + 40 + rng() * 80) % 360;
  return [hslHex(baseHue, 0.6, 0.55), hslHex(accentHue, 0.7, 0.6)];
}

export function pickRarity(rng) {
  const total = RARITIES.reduce((s, r) => s + r.weight, 0);
  let r = rng() * total;
  for (const rarity of RARITIES) {
    r -= rarity.weight;
    if (r <= 0) return rarity;
  }
  return RARITIES[0];
}

export function pickArchetype(rng) {
  return ARCHETYPE_KEYS[Math.floor(rng() * ARCHETYPE_KEYS.length)];
}

export function makeName(archetype, rng, used) {
  const nouns = ARCHETYPES[archetype].nouns;
  for (let i = 0; i < 40; i++) {
    const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)];
    const noun = nouns[Math.floor(rng() * nouns.length)];
    const name = `${adj} ${noun}`;
    if (!used.has(name)) return name;
  }
  // fallback guarantees uniqueness
  let n = 2;
  let base = `${ADJECTIVES[0]} ${nouns[0]}`;
  while (used.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export function randIntRange([lo, hi], rng) {
  return Math.round(lo + rng() * (hi - lo));
}
