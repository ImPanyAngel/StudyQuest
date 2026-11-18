import { ItemView, Notice, type WorkspaceLeaf } from "obsidian";
import { localDateOf } from "../core/dates";
import { chosenRun, openRuns, runScore, unseenPrestige } from "../core/derive";
import type { CourseFolders } from "../store/course-folders";
import type { QuestStore } from "../store/quest-store";
import type { RunChoice } from "../store/run-choice";
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
    private folders: CourseFolders,
    private choice: RunChoice,
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
    const offStore = this.store.subscribe(() => this.refresh());
    const offChoice = this.choice.subscribe(() => this.refresh());
    this.unsubscribe = () => {
      offStore();
      offChoice();
    };
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
    this.renderRunSwitch(tabs);

    const body = root.createDiv({ cls: "sq-body" });
    const nav = (r: Route) => this.navigate(r);
    const clock = this.store.clock;
    switch (this.route.tab) {
      case "home":
        renderHome(body, this.store, nav, clock, this.app, this.choice);
        break;
      case "course":
        renderCourse(body, this.store, this.route, nav, clock, this.app);
        break;
      case "setup":
        renderSetup(body, this.store, clock, this.setupUi, () => this.refresh(), this.app, this.folders, this.choice);
        break;
      case "hall":
        renderHall(body, this.store, nav, clock);
        break;
      case "run":
        renderRunPage(body, this.store, this.route, nav, this.app);
        break;
    }
  }

  /** Far right of the tab bar: picks which open run Home, the badge and Setup show. Hidden with fewer than two. */
  private renderRunSwitch(tabs: HTMLElement): void {
    const s = this.store.state;
    const open = openRuns(s);
    if (open.length < 2) return;
    const pick = tabs.createEl("select", { cls: "dropdown sq-run-switch" });
    pick.setAttr("aria-label", "Run");
    for (const r of open) pick.createEl("option", { value: r.id, text: r.name });
    pick.value = chosenRun(s, this.choice.get(), localDateOf(this.store.clock()))?.id ?? "";
    pick.onchange = () => {
      this.setupUi.run = pick.value;
      this.setupUi.course = undefined;
      // A course page belongs to the old run; go back to Home.
      if (this.route.tab === "course") this.route = { tab: "home" };
      this.choice.set(pick.value);
      this.refresh();
    };
  }
}
