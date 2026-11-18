import { TFolder, type App } from "obsidian";
import { folderChain } from "../core/folders";

/** Creates course folders in the vault, and removes one on undo only if it made it this session and it's still empty. */
export class CourseFolders {
  private created = new Set<string>();

  constructor(private app: App) {}

  /** Creates the folder and any missing parents; an existing folder is used as it is. */
  async ensure(path: string): Promise<void> {
    for (const p of folderChain(path)) {
      const existing = this.app.vault.getAbstractFileByPath(p);
      if (existing instanceof TFolder) continue;
      if (existing) throw new Error(`"${p}" is a file, not a folder.`);
      await this.app.vault.createFolder(p);
      this.created.add(p);
    }
  }

  /** Moves the course's own folder to the trash if this session created it and nothing has been put in it. */
  async removeIfEmpty(path: string): Promise<void> {
    const p = folderChain(path).at(-1);
    if (!p || !this.created.has(p)) return;
    const folder = this.app.vault.getAbstractFileByPath(p);
    if (!(folder instanceof TFolder) || folder.children.length > 0) return;
    await this.app.fileManager.trashFile(folder);
    this.created.delete(p);
  }
}
