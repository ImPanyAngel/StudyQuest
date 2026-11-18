import { Modal, type App } from "obsidian";
import credits from "../../assets/sprites/CREDITS.md";

/** Every LPC artist and licence behind the character art, as the licences require. */
export class CreditsModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Art credits");
    this.contentEl.addClass("sq-credits");
    this.contentEl.createEl("pre", { text: credits });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
