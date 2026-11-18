import { Notice, Plugin, TFile, TFolder, normalizePath } from "obsidian";
import { nextLocalMidnight } from "./core/dates";
import { unseenPrestige } from "./core/derive";
import { CourseFolders } from "./store/course-folders";
import { DayTicker, QuestStore } from "./store/quest-store";
import { RunChoice } from "./store/run-choice";
import { PluginLog } from "./store/plugin-log";
import { StatusBadge } from "./ui/status-bar";
import { StudyQuestView, VIEW_TYPE } from "./ui/view";

export default class StudyQuestPlugin extends Plugin {
  private store!: QuestStore;
  private badge!: StatusBadge;
  private midnightTimer: number | undefined;
  private dayTicker!: DayTicker;

  async onload() {
    // The log lives in StudyQuest's own plugin folder: hidden from the explorer, search and graph.
    const log = new PluginLog(this.app.vault.adapter, normalizePath(`${this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`}/log`));
    this.store = new QuestStore(log, () => new Date());

    const folders = new CourseFolders(this.app);
    // Plugin settings: only the run the switch last picked.
    const data = ((await this.loadData()) ?? {}) as { run?: string };
    const choice = new RunChoice(data.run, (run) => void this.saveData({ ...data, run }));
    this.registerView(VIEW_TYPE, (leaf) => new StudyQuestView(leaf, this.store, folders, choice));
    this.addRibbonIcon("trophy", "Open StudyQuest", () => void this.openHome());
    this.addCommand({ id: "open-studyquest", name: "Open StudyQuest", callback: () => void this.openHome() });
    this.badge = new StatusBadge(this.addStatusBarItem(), this.store, choice, this.store.clock, () => void this.openHome());

    this.dayTicker = new DayTicker(this.store.clock, () => void this.onNewDay());

    this.app.workspace.onLayoutReady(async () => {
      try {
        await this.moveOldLog(log);
        await this.store.load();
        await this.store.runDailyCheck();
      } catch (e) {
        new Notice(`StudyQuest couldn't read its log: ${e instanceof Error ? e.message : String(e)}`);
      }
      await this.revealPrestige();


      // Evidence links show whether their file still exists; redraw when files come and go.
      let redraw: number | undefined;
      const redrawSoon = () => {
        window.clearTimeout(redraw);
        redraw = window.setTimeout(() => this.refreshViews(), 250);
      };
      for (const name of ["create", "delete", "rename"] as const) {
        this.registerEvent(this.app.vault.on(name as "create", redrawSoon));
      }
      this.register(() => window.clearTimeout(redraw));
      this.scheduleMidnightCheck();
      // Timers don't run while the Mac sleeps, so also check for a new day when the window comes back.
      // Obsidian doesn't report changes to files in the plugin folder, so re-read the log when the
      // window comes back (picks up what Sync brought in meanwhile), then check for a new day.
      this.registerDomEvent(window, "focus", () => {
        void this.store.load().catch(() => undefined);
        this.dayTicker.check();
      });
      this.registerDomEvent(document, "visibilitychange", () => this.dayTicker.check());
    });
    this.register(() => window.clearTimeout(this.midnightTimer));
  }

  /** Earlier versions kept the log in a visible `StudyQuest/log` folder: move it into the plugin folder, once. */
  private async moveOldLog(log: PluginLog) {
    const old = this.app.vault.getFolderByPath("StudyQuest/log");
    if (!old) return;
    const files = old.children.filter((f): f is TFile => f instanceof TFile && f.extension === "md");
    for (const f of files) await log.importText(f.basename, await this.app.vault.read(f));
    await this.app.fileManager.trashFile(old);
    const parent = this.app.vault.getAbstractFileByPath("StudyQuest");
    if (parent instanceof TFolder && parent.children.length === 0) await this.app.fileManager.trashFile(parent);
    if (files.length) new Notice("StudyQuest moved its log into its plugin folder; the old StudyQuest folder is in the trash.");
  }

  /** Wakes just after local midnight to check for a new day. */
  private scheduleMidnightCheck() {
    const now = new Date();
    const next = nextLocalMidnight(now).getTime() + 5_000;
    this.midnightTimer = window.setTimeout(() => {
      this.dayTicker.check();
      this.scheduleMidnightCheck();
    }, next - now.getTime());
  }

  /** Once per new day: mark passed exams as sat and refresh day-dependent UI. */
  private async onNewDay() {
    await this.store.runDailyCheck();
    this.badge.update();
    this.refreshViews();
    await this.revealPrestige();
  }

  private refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof StudyQuestView) leaf.view.refresh();
    }
  }

  /** Opens StudyQuest when a closed run's Prestige Up screen hasn't been seen yet. */
  private async revealPrestige() {
    if (unseenPrestige(this.store.state).length > 0) await this.openHome();
  }

  private async openHome() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof StudyQuestView) leaf.view.navigate({ tab: "home" });
  }
}
