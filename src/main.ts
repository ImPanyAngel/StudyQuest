import { Plugin } from "obsidian";
import { QuestStore } from "./store/quest-store";
import { VaultLog } from "./store/vault-log";
import { StatusBadge } from "./ui/status-bar";
import { StudyQuestView, VIEW_TYPE } from "./ui/view";

export default class StudyQuestPlugin extends Plugin {
  private store!: QuestStore;
  private badge!: StatusBadge;
  private midnightTimer: number | undefined;

  async onload() {
    const log = new VaultLog(this.app.vault);
    this.store = new QuestStore(log, () => new Date());

    this.registerView(VIEW_TYPE, (leaf) => new StudyQuestView(leaf, this.store));
    this.addRibbonIcon("trophy", "Open StudyQuest", () => void this.openHome());
    this.addCommand({ id: "open-studyquest", name: "Open StudyQuest", callback: () => void this.openHome() });
    this.badge = new StatusBadge(this.addStatusBarItem(), this.store, this.store.clock, () => void this.openHome());

    this.app.workspace.onLayoutReady(async () => {
      await this.store.load();
      await this.store.runAutoSat();

      let reload: number | undefined;
      for (const ref of log.onChange(() => {
        window.clearTimeout(reload);
        reload = window.setTimeout(() => void this.store.load(), 250);
      })) {
        this.registerEvent(ref);
      }
      this.register(() => window.clearTimeout(reload));
      this.scheduleMidnightCheck();
    });
    this.register(() => window.clearTimeout(this.midnightTimer));
  }

  /** Once a day, just after local midnight: mark passed exams as sat and refresh day-dependent UI. */
  private scheduleMidnightCheck() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    this.midnightTimer = window.setTimeout(async () => {
      await this.store.runAutoSat();
      this.badge.update();
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
        if (leaf.view instanceof StudyQuestView) leaf.view.refresh();
      }
      this.scheduleMidnightCheck();
    }, next.getTime() - now.getTime());
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
