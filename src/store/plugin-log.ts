import { joinForAppend, type LogPort } from "./quest-store";

/** The slice of Obsidian's file adapter the log needs; it reaches files the vault index hides. */
export interface Files {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  list(path: string): Promise<{ files: string[]; folders: string[] }>;
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
}

/**
 * The event log inside StudyQuest's own plugin folder (`<config>/plugins/studyquest/log/<run>.jsonl`),
 * where it stays out of the file explorer, search and the graph. One JSON event per line.
 */
export class PluginLog implements LogPort {
  constructor(
    private files: Files,
    readonly dir: string,
  ) {}

  async readAll(): Promise<string[]> {
    if (!(await this.files.exists(this.dir))) return [];
    const { files } = await this.files.list(this.dir);
    return Promise.all(files.filter((p) => p.endsWith(".jsonl")).map((p) => this.files.read(p)));
  }

  async append(runId: string, lines: string[]): Promise<void> {
    if (!(await this.files.exists(this.dir))) await this.files.mkdir(this.dir);
    const path = this.pathOf(runId);
    const existing = (await this.files.exists(path)) ? await this.files.read(path) : "";
    await this.files.write(path, existing + joinForAppend(existing, lines));
  }

  /** Adds an older log's text for a run (moving from the old vault folder). Duplicate events are harmless: replay dedupes by id. */
  async importText(runId: string, text: string): Promise<void> {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length) await this.append(runId, lines);
  }

  private pathOf(runId: string): string {
    return `${this.dir}/${runId}.jsonl`;
  }
}
