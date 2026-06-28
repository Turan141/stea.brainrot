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

// Pool for "combine two random things" meme creatures.
export const ITEMS = [
  // everyday objects
  "toaster", "umbrella", "alarm clock", "light bulb", "backpack", "teapot",
  "sneaker", "traffic cone", "vacuum cleaner", "desk lamp", "remote control",
  // foods
  "banana", "pizza slice", "watermelon", "donut", "taco", "pickle", "sushi roll",
  "ice cream cone", "pretzel", "cupcake", "hot dog", "avocado", "coffee cup",
  // animals
  "octopus", "duck", "axolotl", "sloth", "narwhal", "frog", "corgi", "pigeon",
  "crab", "hamster", "shark", "llama", "dinosaur", "astronaut cat",
  // household
  "washing machine", "television", "ceiling fan", "mailbox", "fire hydrant",
  "rubber duck", "garden gnome", "cuckoo clock", "robot",
];

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Pick two distinct items and a combined name unique vs `used`. */
export function pickCombo(rng, used) {
  for (let i = 0; i < 50; i++) {
    const a = ITEMS[Math.floor(rng() * ITEMS.length)];
    const b = ITEMS[Math.floor(rng() * ITEMS.length)];
    if (a === b) continue;
    const name = titleCase(`${a} ${b}`);
    if (!used.has(name)) return { a, b, name };
  }
  let n = 2;
  const base = titleCase(`${ITEMS[0]} ${ITEMS[1]}`);
  while (used.has(`${base} ${n}`)) n++;
  return { a: ITEMS[0], b: ITEMS[1], name: `${base} ${n}` };
}

// Visual richness scales with rarity — rarer creatures should look more
// interesting/ornate, not just a plain shape.
const RARITY_DETAIL = {
  common: "simple clean shapes",
  rare: "more detailed with colorful accents and small extra features",
  epic: "highly detailed and ornate, with glowing energy accents and expressive features",
  legendary: "extremely detailed and majestic, with a glowing magical aura, intricate ornaments and dynamic pose",
  mythic: "an ultra-detailed masterpiece, radiant cosmic aura, intricate ornate design, awe-inspiring",
};

/** The agreed meme-creature prompt for AI generation (detail scales by rarity). */
export function comboPrompt(a, b, rarity = "common") {
  const detail = RARITY_DETAIL[rarity] ?? "detailed";
  return (
    `An original absurd meme creature: a ${a} combined with a ${b} into one funny cartoon character, ${detail}. ` +
    `Visually distinct and original — must NOT resemble a coffee cup, an avocado, a sock or a shark. ` +
    `Style: colorful, goofy, exaggerated proportions, low poly, cute, collectible, game-ready, under 5000 triangles.`
  );
}

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
