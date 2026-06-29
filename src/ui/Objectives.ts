/**
 * Small onboarding objective banner (top-left). Shows the current goal and a
 * quick green "done" flash before advancing to the next.
 */
export class Objectives {
  private el: HTMLElement;
  private textEl: HTMLElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement("div");
    this.el.id = "objective";
    this.el.innerHTML = `<div class="obj-lbl">🎯 Objective</div><div class="obj-text"></div>`;
    this.textEl = this.el.querySelector(".obj-text")!;
    root.appendChild(this.el);
  }

  show(text: string) {
    this.textEl.textContent = text;
    this.el.classList.add("show");
    this.el.classList.remove("done");
  }

  /** Flash complete, then run `then` to advance. */
  flashComplete(then: () => void) {
    this.el.classList.add("done");
    window.setTimeout(() => {
      this.el.classList.remove("done");
      then();
    }, 900);
  }

  hide() {
    this.el.classList.remove("show");
  }
}
