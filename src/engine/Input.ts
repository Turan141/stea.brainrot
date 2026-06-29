import * as THREE from "three";

export type ActionName = "jump" | "sprint" | "dash" | "interact" | "sell" | "attack";

const KEY_BINDINGS: Record<string, ActionName> = {
  Space: "jump",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  KeyF: "dash",
  KeyE: "interact",
  KeyQ: "sell",
  KeyJ: "attack",
};

/**
 * Keyboard input. Exposes a movement vector (camera-relative resolution
 * happens in the controller) plus held/pressed action queries with
 * edge-detection for "just pressed".
 */
export class Input {
  private held = new Set<string>();
  private pressedThisFrame = new Set<string>();

  // Touch/virtual controls (mobile). Merged with keyboard so both work.
  private touchMove = new THREE.Vector2();
  private touchHeld = new Set<ActionName>();
  private touchPressed = new Set<ActionName>();

  /** Virtual joystick vector (x = strafe, y = forward), each in [-1, 1]. */
  setTouchMove(x: number, y: number) {
    this.touchMove.set(x, y);
  }

  /** Virtual button down/up; rising edge feeds justPressed. */
  setTouchAction(action: ActionName, down: boolean) {
    if (down) {
      if (!this.touchHeld.has(action)) this.touchPressed.add(action);
      this.touchHeld.add(action);
    } else {
      this.touchHeld.delete(action);
    }
  }

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
    x += this.touchMove.x;
    y += this.touchMove.y;
    out.set(x, y);
    if (out.lengthSq() > 1) out.normalize();
    return out;
  }

  isDown(action: ActionName): boolean {
    if (this.touchHeld.has(action)) return true;
    for (const code in KEY_BINDINGS) {
      if (KEY_BINDINGS[code] === action && this.held.has(code)) return true;
    }
    return false;
  }

  justPressed(action: ActionName): boolean {
    if (this.touchPressed.has(action)) return true;
    for (const code of this.pressedThisFrame) {
      if (KEY_BINDINGS[code] === action) return true;
    }
    return false;
  }

  /** Call at end of each frame to clear edge-triggered state. */
  endFrame() {
    this.pressedThisFrame.clear();
    this.touchPressed.clear();
  }

  dispose() {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
  }
}
