import { Notice, type App } from "obsidian";
import type { ObjectiveState } from "../core/state";

/**
 * The evidence file's name, opening the file when clicked. Opened through the
 * TFile itself, not a link, so names with #, ^ or [ open the file and not a heading.
 */
export function renderEvidence(parent: HTMLElement, o: ObjectiveState, app: App): void {
  const path = o.completed?.evidence;
  if (!path) return;
  const name = path.split("/").pop() ?? path;
  const file = app.vault.getFileByPath(path);
  if (!file) {
    parent.createSpan({ cls: "sq-evidence is-missing", text: name, attr: { title: `${path} (no longer in the vault)` } });
    return;
  }
  const link = parent.createEl("a", { cls: "sq-evidence", text: name, attr: { title: path, href: "#" } });
  link.addEventListener("click", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    // Looked up again: the file may have been deleted or renamed since this was drawn.
    const now = app.vault.getFileByPath(path);
    if (now) void app.workspace.getLeaf(false).openFile(now);
    else new Notice(`"${path}" is no longer in the vault.`);
  });
}
