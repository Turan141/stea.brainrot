export interface PromptInfo {
  html: string;
  affordable: boolean;
}

/**
 * Bottom-center interaction prompt (conveyor buy / creature upgrade). Hidden
 * when nothing is in range. The caller builds the HTML so it stays generic.
 */
export class ShopPrompt {
  private el: HTMLElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement("div");
    this.el.id = "shop-prompt";
    root.appendChild(this.el);
  }

  update(info: PromptInfo | null) {
    if (!info) {
      this.el.classList.remove("show");
      return;
    }
    this.el.className = `show ${info.affordable ? "" : "cant"}`;
    this.el.innerHTML = info.html;
  }
}
