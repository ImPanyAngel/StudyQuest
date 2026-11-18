import { FuzzySuggestModal, Notice, type App, type FuzzyMatch, type TFile } from "obsidian";
import { evidenceOwner } from "../core/derive";
import { CHECKED_EXTENSIONS, checkEvidence } from "../core/file-checks";
import type { ObjectiveState } from "../core/state";
import type { QuestStore } from "../store/quest-store";

/** Searchable list of vault files; picking one completes the objective (DONE) with that file as evidence, after the file checks pass. */
export class EvidencePicker extends FuzzySuggestModal<TFile> {
  private files: TFile[] | null = null;
  /** A picked file is being read and checked; further picks wait. */
  private checking = false;
  private closed = false;

  constructor(
    app: App,
    private store: QuestStore,
    private obj: ObjectiveState,
  ) {
    super(app);
    this.setPlaceholder(`Pick the file that proves "${obj.title}"`);
  }

  /** Called on every keystroke, so the sorted list is built once per opening. */
  getItems(): TFile[] {
    // The plugin's own log folder is never evidence. Recently changed files first.
    this.files ??= this.app.vault
      .getFiles()
      .filter((f) => !f.path.startsWith("StudyQuest/"))
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
    return this.files;
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

  // Overrides the default so a used or refused file keeps the picker open.
  selectSuggestion(match: FuzzyMatch<TFile>, evt: MouseEvent | KeyboardEvent): void {
    const owner = evidenceOwner(this.store.state, match.item.path);
    if (owner) {
      new Notice(`That file already proves ${owner.course} · ${owner.title}.`);
      return;
    }
    if (this.checking) return;
    if (!CHECKED_EXTENSIONS.includes(match.item.extension.toLowerCase())) {
      super.selectSuggestion(match, evt);
      return;
    }
    this.checking = true;
    void this.check(match.item).then((passed) => {
      this.checking = false;
      if (passed && !this.closed) super.selectSuggestion(match, evt);
    });
  }

  /** Reads the picked file and runs its rule; shows the reason and returns false when it's refused. */
  private async check(picked: TFile): Promise<boolean> {
    const f = this.app.vault.getFileByPath(picked.path);
    if (!f) {
      new Notice(`"${picked.path}" is no longer in the vault.`);
      return false;
    }
    let text: string;
    try {
      text = await this.app.vault.cachedRead(f);
    } catch {
      new Notice(`Couldn't read "${f.path}".`);
      return false;
    }
    const refusal = checkEvidence(f.extension, text);
    if (refusal) new Notice(refusal);
    return refusal === null;
  }

  onClose(): void {
    this.closed = true;
    super.onClose();
  }

  onChooseItem(f: TFile): void {
    // The list was built when the picker opened; the file may have gone since.
    if (!this.app.vault.getFileByPath(f.path)) {
      new Notice(`"${f.path}" is no longer in the vault.`);
      return;
    }
    void this.store.dispatch({ type: "completeWithEvidence", obj: this.obj.id, path: f.path }).then((r) => {
      if (!r.ok) new Notice(r.error);
    });
  }
}
