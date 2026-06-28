import * as THREE from "three";

export type ActionName = "jump" | "sprint" | "dash" | "interact" | "sell";

const KEY_BINDINGS: Record<string, ActionName> = {
  Space: "jump",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  KeyF: "dash",
  KeyE: "interact",
  KeyQ: "sell",
};

/**
 * Keyboard input. Exposes a movement vector (camera-relative resolution
 * happens in the controller) plus held/pressed action queries with
 * edge-detection for "just pressed".
 */
export class Input {
  private held = new Set<string>();
  private pressedThisFrame = new Set<string>();

  constructor() {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
  }

  private onDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.held.add(e.code);
    this.pressedThisFrame.add(e.code);
    // prevent page scroll on space/arrows
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  };

  private onUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };

  private onBlur = () => {
    this.held.clear();
  };

  /** Raw WASD/arrow direction in world XZ (x = strafe, y = forward). */
  moveVector(out: THREE.Vector2): THREE.Vector2 {
    let x = 0;
    let y = 0;
    if (this.held.has("KeyW") || this.held.has("ArrowUp")) y += 1;
    if (this.held.has("KeyS") || this.held.has("ArrowDown")) y -= 1;
    if (this.held.has("KeyA") || this.held.has("ArrowLeft")) x -= 1;
    if (this.held.has("KeyD") || this.held.has("ArrowRight")) x += 1;
    out.set(x, y);
    if (out.lengthSq() > 1) out.normalize();
    return out;
  }

  isDown(action: ActionName): boolean {
    for (const code in KEY_BINDINGS) {
      if (KEY_BINDINGS[code] === action && this.held.has(code)) return true;
    }
    return false;
  }

  justPressed(action: ActionName): boolean {
    for (const code of this.pressedThisFrame) {
      if (KEY_BINDINGS[code] === action) return true;
    }
    return false;
  }

  /** Call at end of each frame to clear edge-triggered state. */
  endFrame() {
    this.pressedThisFrame.clear();
  }

  dispose() {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
  }
}
