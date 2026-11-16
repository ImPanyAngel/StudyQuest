import { Notice, Plugin } from "obsidian";
import { nextLocalMidnight } from "./core/dates";
import { DayTicker, QuestStore } from "./store/quest-store";
import { VaultLog } from "./store/vault-log";
import { StatusBadge } from "./ui/status-bar";
import { StudyQuestView, VIEW_TYPE } from "./ui/view";

export default class StudyQuestPlugin extends Plugin {
  private store!: QuestStore;
  private badge!: StatusBadge;
  private midnightTimer: number | undefined;
  private dayTicker!: DayTicker;

  async onload() {
    const log = new VaultLog(this.app.vault);
    this.store = new QuestStore(log, () => new Date());

    this.registerView(VIEW_TYPE, (leaf) => new StudyQuestView(leaf, this.store));
    this.addRibbonIcon("trophy", "Open StudyQuest", () => void this.openHome());
    this.addCommand({ id: "open-studyquest", name: "Open StudyQuest", callback: () => void this.openHome() });
    this.badge = new StatusBadge(this.addStatusBarItem(), this.store, this.store.clock, () => void this.openHome());

    this.dayTicker = new DayTicker(this.store.clock, () => void this.onNewDay());

    this.app.workspace.onLayoutReady(async () => {
      try {
        await this.store.load();
        await this.store.runDailyCheck();
      } catch (e) {
        new Notice(`StudyQuest couldn't read its log: ${e instanceof Error ? e.message : String(e)}`);
      }

      let reload: number | undefined;
      for (const ref of log.onChange(() => {
        window.clearTimeout(reload);
        reload = window.setTimeout(() => void this.store.load(), 250);
      })) {
        this.registerEvent(ref);
      }
      this.register(() => window.clearTimeout(reload));
      this.scheduleMidnightCheck();
      // Timers don't run while the Mac sleeps, so also check for a new day when the window comes back.
      this.registerDomEvent(window, "focus", () => this.dayTicker.check());
      this.registerDomEvent(document, "visibilitychange", () => this.dayTicker.check());
    });
    this.register(() => window.clearTimeout(this.midnightTimer));
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
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof StudyQuestView) leaf.view.refresh();
    }
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
