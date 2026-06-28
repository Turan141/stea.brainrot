export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Frame-rate independent smoothing factor for exponential approach. */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

export function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

/** Deterministic-ish weighted pick. `rng` defaults to Math.random. */
export function weightedPick<T>(items: T[], weightOf: (t: T) => number, rng: () => number = Math.random): T {
  let total = 0;
  for (const it of items) total += weightOf(it);
  let r = rng() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
