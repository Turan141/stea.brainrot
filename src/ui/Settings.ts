import type { AudioManager } from "../audio/AudioManager.ts";

interface SettingsState {
  sfx: boolean;
  music: boolean;
}

/**
 * Settings modal: SFX / music toggles (wired live to the audio manager) and a
 * destructive "reset progress" action.
 */
export class Settings {
  private modal: HTMLElement;

  constructor(
    root: HTMLElement,
    private state: SettingsState,
    private audio: AudioManager,
    private onChange: () => void,
    private onReset: () => void
  ) {
    this.modal = document.createElement("div");
    this.modal.className = "modal";
    this.modal.innerHTML = `
      <div class="modal-card">
        <h2>Settings <span class="close">✕</span></h2>
        <div class="setting-row"><span>Sound effects</span><div class="toggle" data-k="sfx"></div></div>
        <div class="setting-row"><span>Music</span><div class="toggle" data-k="music"></div></div>
        <div class="setting-row"><span>Reset all progress</span><button class="btn-danger">Reset</button></div>
      </div>`;
    root.appendChild(this.modal);

    this.modal.querySelector(".close")!.addEventListener("click", () => this.close());
    this.modal.addEventListener("pointerdown", (e) => {
      if (e.target === this.modal) this.close();
    });
    this.modal.querySelectorAll<HTMLElement>(".toggle").forEach((t) => {
      t.addEventListener("click", () => this.flip(t.dataset.k as "sfx" | "music", t));
    });
    this.modal.querySelector(".btn-danger")!.addEventListener("click", () => {
      if (confirm("Reset all progress? This cannot be undone.")) this.onReset();
    });
    this.sync();
  }

  private flip(key: "sfx" | "music", el: HTMLElement) {
    this.state[key] = !this.state[key];
    el.classList.toggle("on", this.state[key]);
    if (key === "sfx") this.audio.setSfx(this.state.sfx);
    else this.audio.setMusic(this.state.music);
    this.onChange();
  }

  private sync() {
    this.modal.querySelectorAll<HTMLElement>(".toggle").forEach((t) => {
      const k = t.dataset.k as "sfx" | "music";
      t.classList.toggle("on", this.state[k]);
    });
  }

  toggle() {
    this.modal.classList.contains("open") ? this.close() : this.open();
  }
  open() {
    this.sync();
    this.modal.classList.add("open");
  }
  close() {
    this.modal.classList.remove("open");
  }
}
