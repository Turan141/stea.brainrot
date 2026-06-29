import type { Input } from "../engine/Input.ts";

/** True on phones/tablets (coarse pointer or touch points present). */
export function isTouchDevice(): boolean {
  return (
    window.matchMedia?.("(pointer: coarse)").matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0
  );
}

/**
 * On-screen mobile controls: a left virtual joystick (movement) and right
 * action buttons (jump / dash / sprint / interact / sell). Feeds the shared
 * Input so keyboard and touch work interchangeably. Lives inside #ui so the
 * camera's drag-to-look (which ignores #ui) doesn't fight the buttons; looking
 * around is a drag anywhere on the empty screen.
 *
 * Only mounts on touch devices.
 */
export class TouchControls {
  readonly root: HTMLElement;

  constructor(input: Input, parent: HTMLElement) {
    document.body.classList.add("is-touch");
    this.root = document.createElement("div");
    this.root.id = "touch";
    parent.appendChild(this.root);

    this.buildJoystick(input);
    this.buildButtons(input);
  }

  private buildJoystick(input: Input) {
    const base = document.createElement("div");
    base.className = "tc-stick";
    const knob = document.createElement("div");
    knob.className = "tc-knob";
    base.appendChild(knob);
    this.root.appendChild(base);

    const R = 52; // px travel
    let id: number | null = null;

    const reset = () => {
      id = null;
      knob.style.transform = "translate(-50%, -50%)";
      input.setTouchMove(0, 0);
    };
    const move = (e: PointerEvent) => {
      if (id !== e.pointerId) return;
      const r = base.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(len, R);
      dx = (dx / len) * cl;
      dy = (dy / len) * cl;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      input.setTouchMove(dx / R, -dy / R); // up = forward
    };

    base.addEventListener("pointerdown", (e) => {
      id = e.pointerId;
      base.setPointerCapture(e.pointerId);
      move(e);
      e.preventDefault();
    });
    base.addEventListener("pointermove", move);
    base.addEventListener("pointerup", reset);
    base.addEventListener("pointercancel", reset);
  }

  private buildButtons(input: Input) {
    const pad = document.createElement("div");
    pad.className = "tc-buttons";
    this.root.appendChild(pad);

    const defs: { label: string; action: Parameters<Input["setTouchAction"]>[0]; cls: string }[] = [
      { label: "E", action: "interact", cls: "tc-e" },
      { label: "Q", action: "sell", cls: "tc-q" },
      { label: "⚔️", action: "attack", cls: "tc-attack" },
      { label: "⚡", action: "sprint", cls: "tc-sprint" },
      { label: "»", action: "dash", cls: "tc-dash" },
      { label: "⤒", action: "jump", cls: "tc-jump" },
    ];

    for (const d of defs) {
      const b = document.createElement("button");
      b.className = `tc-btn ${d.cls}`;
      b.textContent = d.label;
      const down = (e: PointerEvent) => {
        input.setTouchAction(d.action, true);
        b.classList.add("active");
        b.setPointerCapture(e.pointerId);
        e.preventDefault();
      };
      const up = () => {
        input.setTouchAction(d.action, false);
        b.classList.remove("active");
      };
      b.addEventListener("pointerdown", down);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      b.addEventListener("contextmenu", (e) => e.preventDefault());
      pad.appendChild(b);
    }
  }
}
