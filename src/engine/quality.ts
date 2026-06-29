/**
 * Render-quality profile, decided once at load. Phones/low-power devices get a
 * lighter profile (lower pixel ratio, no MSAA, smaller shadows, fewer dynamic
 * lights, less decor) so the game stays smooth on mobile.
 */
function detectMobile(): boolean {
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 820;
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4;
  // a touch device that is also small-screen or low-core → treat as mobile
  return (coarse || touch) && (smallScreen || fewCores);
}

const mobile = detectMobile();

export const QUALITY = {
  mobile,
  /** Max devicePixelRatio to render at (huge fragment-cost lever on phones). */
  pixelRatioCap: mobile ? 1.25 : 2,
  /** MSAA — off on mobile. */
  antialias: !mobile,
  /** Directional shadow map resolution. */
  shadowMapSize: mobile ? 1024 : 2048,
  /** Soft (PCF) shadows on desktop, cheaper hard shadows on mobile. */
  softShadows: !mobile,
  /** Allow the extra lamp/brazier point lights (skipped on mobile). */
  dynamicLights: !mobile,
  /** How many scattered ground-clutter props to place. */
  clutterCount: mobile ? 30 : 90,
};
