/**
 * Render-quality profile, decided once at load. Phones/low-power devices get a
 * lighter profile (lower pixel ratio, no MSAA, smaller shadows, fewer dynamic
 * lights, less decor) so the game stays smooth on mobile.
 */
function detectMobile(): boolean {
  // Our native Android/iOS build (Capacitor) always runs on mobile-class GPUs —
  // including big tablets that would otherwise dodge a screen-size heuristic.
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  if (cap?.isNativePlatform?.() || cap?.getPlatform?.() === "android" || cap?.getPlatform?.() === "ios") return true;

  // On the web: a coarse PRIMARY pointer = touch-first device (phone OR tablet).
  // Touch-laptops keep a fine mouse pointer, so they stay on full quality.
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const fine = window.matchMedia?.("(pointer: fine)").matches ?? false;
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  return coarse || (touch && !fine);
}

const mobile = detectMobile();

export const QUALITY = {
  mobile,
  /** Max devicePixelRatio to render at (huge fragment-cost lever on phones). */
  pixelRatioCap: mobile ? 1.0 : 2,
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
  /** Real-time shadows. Off on mobile — the extra full-scene shadow pass was the biggest GPU cost (120Hz panel, ~1.2M tris). */
  shadows: !mobile,
  /** Half-size of the sun's shadow frustum — tighter on mobile = crisper + far fewer casters per shadow pass. */
  shadowFrustum: mobile ? 46 : 80,
  /** Re-render the shadow map every Nth frame (1 = every frame). Halves the shadow pass on mobile. */
  shadowEveryN: mobile ? 2 : 1,
  /** Camera far plane — shorter on mobile culls distant mountains/decor entirely. */
  drawDistance: mobile ? 330 : 600,
  /** Fog far — pulled in on mobile so culled distance is hidden by haze. */
  fogFar: mobile ? 190 : 360,
};
