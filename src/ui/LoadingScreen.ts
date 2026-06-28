/**
 * Full-screen loading overlay shown until the world + creature library are
 * ready. Instantiated first thing so it paints before any heavy work.
 */
export class LoadingScreen {
  private el: HTMLElement;
  private sub: HTMLElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.id = "loading";
    this.el.innerHTML = `
      <div class="logo">BRAINROT HEIST</div>
      <div class="spinner"></div>
      <div class="sub">Loading creatures…</div>`;
    document.body.appendChild(this.el);
    this.sub = this.el.querySelector(".sub")!;
  }

  setStatus(text: string) {
    this.sub.textContent = text;
  }

  hide() {
    this.el.classList.add("hide");
    setTimeout(() => this.el.remove(), 600);
  }
}
