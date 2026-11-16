import { ItemView, Notice, type WorkspaceLeaf } from "obsidian";
import { runScore, unseenPrestige } from "../core/derive";
import type { QuestStore } from "../store/quest-store";
import { renderCourse } from "./course";
import { renderHall } from "./hall";
import { renderHome } from "./home";
import { renderPrestigeUp } from "./prestige-up";
import { renderRunPage } from "./run-page";
import { renderSetup, type SetupUi } from "./setup";
import type { Route } from "./parts";

export const VIEW_TYPE = "studyquest-view";

export class StudyQuestView extends ItemView {
  private route: Route = { tab: "home" };
  private unsubscribe?: () => void;
  private setupUi: SetupUi = { drafts: {} };

  constructor(
    leaf: WorkspaceLeaf,
    private store: QuestStore,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "StudyQuest";
  }

  getIcon(): string {
    return "trophy";
  }

  async onOpen(): Promise<void> {
    this.unsubscribe = this.store.subscribe(() => this.refresh());
    // Keeps undo countdowns and date locks current while Setup is open.
    // Skipped while a field has focus so typing isn't interrupted.
    this.registerInterval(
      window.setInterval(() => {
        const typing = this.contentEl.contains(document.activeElement) && document.activeElement?.matches("input, textarea, select");
        if (this.route.tab === "setup" && !typing) this.refresh();
      }, 30_000),
    );
    this.refresh();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
  }

  navigate(r: Route): void {
    this.route = r;
    this.refresh();
  }

  /** Setup with "New run…" selected. */
  openSetupForNewRun(): void {
    this.setupUi.run = "new";
    this.navigate({ tab: "setup" });
  }

  refresh(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("studyquest");

    // A closed run nobody has seen yet takes over the whole view.
    const unseen = unseenPrestige(this.store.state)[0];
    if (unseen) {
      renderPrestigeUp(root, unseen, runScore(this.store.state, unseen.id), async () => {
        const r = await this.store.dispatch({ type: "acknowledgePrestige", run: unseen.id });
        if (!r.ok) new Notice(r.error);
        else if (unseenPrestige(this.store.state).length === 0) this.openSetupForNewRun();
      });
      return;
    }

    const tabs = root.createDiv({ cls: "sq-tabs" });
    const tab = (label: string, r: Route, active: boolean) => {
      const t = tabs.createDiv({ cls: "sq-tab", text: label });
      if (active) t.addClass("is-active");
      t.onClickEvent(() => this.navigate(r));
    };
    const at = this.route.tab;
    tab("Home", { tab: "home" }, at === "home" || at === "course");
    tab("Setup", { tab: "setup" }, at === "setup");
    tab("Hall", { tab: "hall" }, at === "hall" || at === "run");

    const body = root.createDiv({ cls: "sq-body" });
    const nav = (r: Route) => this.navigate(r);
    const clock = this.store.clock;
    switch (this.route.tab) {
      case "home":
        renderHome(body, this.store, nav, clock);
        break;
      case "course":
        renderCourse(body, this.store, this.route, nav, clock);
        break;
      case "setup":
        renderSetup(body, this.store, clock, this.setupUi, () => this.refresh());
        break;
      case "hall":
        renderHall(body, this.store, nav, clock);
        break;
      case "run":
        renderRunPage(body, this.store, this.route, nav);
        break;
    }
  }
}
