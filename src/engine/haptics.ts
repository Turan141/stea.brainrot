/**
 * Tiny haptic feedback. Uses the Web Vibration API (works in the Android
 * WebView with the VIBRATE permission; silently no-ops on devices/browsers
 * without it). Kept subtle so interactions feel tactile, not buzzy.
 */
const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

let enabled = true;

function buzz(pattern: number | number[]) {
  if (!enabled || !canVibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore — not supported / blocked */
  }
}

export const haptics = {
  /** Toggle all haptics (e.g. from a settings option). */
  setEnabled(on: boolean) {
    enabled = on;
    if (!on && canVibrate) navigator.vibrate(0);
  },
  /** Light tap — button presses, pad/menu open. */
  tap() {
    buzz(8);
  },
  /** A bit firmer — a meaningful action (capture, purchase). */
  bump() {
    buzz(18);
  },
  /** Positive double-pulse — success (delivered, fusion done, arena won). */
  success() {
    buzz([0, 14, 40, 22]);
  },
  /** Warn — blocked/invalid action. */
  warn() {
    buzz([0, 30, 60, 30]);
  },
};
