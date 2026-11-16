import { TFile, normalizePath, type EventRef, type TAbstractFile, type Vault } from "obsidian";
import { joinForAppend, type LogPort } from "./quest-store";

/** The event log as markdown files in the vault: `<folder>/<run-id>.md`. */
export class VaultLog implements LogPort {
  constructor(
    private vault: Vault,
    readonly folder = "StudyQuest/log",
  ) {}

  async readAll(): Promise<string[]> {
    const dir = this.vault.getFolderByPath(normalizePath(this.folder));
    if (!dir) return [];
    const files = dir.children.filter((f): f is TFile => f instanceof TFile && f.extension === "md");
    return Promise.all(files.map((f) => this.vault.read(f)));
  }

  async append(runId: string, lines: string[]): Promise<void> {
    await this.ensureFolder();
    const path = normalizePath(`${this.folder}/${runId}.md`);
    const file = this.vault.getFileByPath(path);
    if (!file) {
      await this.vault.create(path, joinForAppend("", lines));
      return;
    }
    await this.vault.process(file, (text) => text + joinForAppend(text, lines));
  }

  isLogFile(f: TAbstractFile): boolean {
    return f instanceof TFile && f.path.startsWith(normalizePath(this.folder) + "/") && f.extension === "md";
  }

  /** Calls `cb` when a log file is created, changed, renamed or deleted. Register the refs with the plugin. */
  onChange(cb: () => void): EventRef[] {
    const handler = (f: TAbstractFile) => {
      if (this.isLogFile(f)) cb();
    };
    return [
      this.vault.on("create", handler),
      this.vault.on("modify", handler),
      this.vault.on("delete", handler),
      this.vault.on("rename", handler),
    ];
  }

  private async ensureFolder() {
    const parts = normalizePath(this.folder).split("/");
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join("/");
      if (!this.vault.getAbstractFileByPath(p)) await this.vault.createFolder(p);
    }
  }
}
