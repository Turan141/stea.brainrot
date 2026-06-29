import type { EventBus, GameEvents } from "../engine/EventBus.ts";
import type { Objectives } from "../ui/Objectives.ts";

interface Step {
  text: string;
  event: keyof GameEvents;
}

/**
 * Lightweight first-session onboarding. Drives the objective banner through a
 * fixed list of goals, advancing when the matching game event fires. Progress
 * is persisted (via onAdvance) so it never repeats once finished.
 */
const STEPS: Step[] = [
  { text: "Head out the gate and follow a glowing trail to a course. Reach the pad to grab the creature.", event: "creature:captured" },
  { text: "Carry it home — step onto your base deck to drop it into a cage.", event: "creature:delivered" },
  { text: "Stand on the 🔧 Upgrades pad (press E) and buy your first upgrade.", event: "upgrade:purchased" },
  { text: "Open the ⚗️ Splice Lab pad and fuse two creatures into a hybrid.", event: "fusion:done" },
  { text: "Enter the ⚔️ Arena pad, pick a champion and win a creature.", event: "arena:won" },
];

export class Tutorial {
  private step: number;

  constructor(
    bus: EventBus,
    private ui: Objectives,
    start: number,
    private onAdvance: (step: number) => void
  ) {
    this.step = start;
    if (this.step >= STEPS.length) return; // already finished
    this.ui.show(STEPS[this.step].text);

    const events = [...new Set(STEPS.map((s) => s.event))];
    for (const e of events) bus.on(e, () => this.onEvent(e));
  }

  private onEvent(e: keyof GameEvents) {
    if (this.step >= STEPS.length) return;
    if (STEPS[this.step].event !== e) return;
    this.ui.flashComplete(() => {
      this.step++;
      this.onAdvance(this.step);
      if (this.step >= STEPS.length) this.ui.hide();
      else this.ui.show(STEPS[this.step].text);
    });
  }
}
