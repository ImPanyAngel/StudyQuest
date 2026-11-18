import { Modal, type App } from "obsidian";

/** A small yes/no dialog. Resolves true on confirm, false on cancel or close. */
export function confirm(app: App, title: string, message: string, ok: string): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const modal = new (class extends Modal {
      onOpen(): void {
        this.titleEl.setText(title);
        this.contentEl.createEl("p", { text: message });
        const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
        buttons.createEl("button", { cls: "mod-cta", text: ok }).onClickEvent(() => {
          answered = true;
          resolve(true);
          this.close();
        });
        buttons.createEl("button", { text: "Cancel" }).onClickEvent(() => this.close());
      }
      onClose(): void {
        this.contentEl.empty();
        if (!answered) resolve(false);
      }
    })(app);
    modal.open();
  });
}
