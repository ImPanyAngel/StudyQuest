import { FuzzySuggestModal, Notice, type App, type FuzzyMatch, type TFile } from "obsidian";
import { evidenceOwner } from "../core/derive";
import type { ObjectiveState } from "../core/state";
import type { QuestStore } from "../store/quest-store";

/** Searchable list of vault files; picking one completes the objective as silver with that file as evidence. */
export class EvidencePicker extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private store: QuestStore,
    private obj: ObjectiveState,
  ) {
    super(app);
    this.setPlaceholder(`Pick the file that proves "${obj.title}"`);
  }

  getItems(): TFile[] {
    // The plugin's own log folder is never evidence. Recently changed files first.
    return this.app.vault
      .getFiles()
      .filter((f) => !f.path.startsWith("StudyQuest/"))
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
  }

  getItemText(f: TFile): string {
    return f.path;
  }

  renderSuggestion(match: FuzzyMatch<TFile>, el: HTMLElement): void {
    super.renderSuggestion(match, el);
    const owner = evidenceOwner(this.store.state, match.item.path);
    if (owner) {
      el.addClass("sq-evidence-used");
      el.createDiv({ cls: "sq-evidence-owner", text: `used · ${owner.course} · ${owner.title}` });
    }
  }

  // Overrides the default so a used file keeps the picker open.
  selectSuggestion(match: FuzzyMatch<TFile>, evt: MouseEvent | KeyboardEvent): void {
    const owner = evidenceOwner(this.store.state, match.item.path);
    if (owner) {
      new Notice(`That file already proves ${owner.course} · ${owner.title}.`);
      return;
    }
    super.selectSuggestion(match, evt);
  }

  onChooseItem(f: TFile): void {
    void this.store.dispatch({ type: "completeWithEvidence", obj: this.obj.id, path: f.path }).then((r) => {
      if (!r.ok) new Notice(r.error);
    });
  }
}
