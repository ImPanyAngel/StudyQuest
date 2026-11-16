import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { QuestStore } from "../store/quest-store";
import { renderHome } from "./home";
import type { Route } from "./parts";

export const VIEW_TYPE = "studyquest-view";

export class StudyQuestView extends ItemView {
  private route: Route = { tab: "home" };
  private unsubscribe?: () => void;

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
    this.refresh();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
  }

  navigate(r: Route): void {
    this.route = r;
    this.refresh();
  }

  refresh(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("studyquest");

    const tabs = root.createDiv({ cls: "sq-tabs" });
    const tab = (label: string, r: Route, active: boolean) => {
      const t = tabs.createDiv({ cls: "sq-tab", text: label });
      if (active) t.addClass("is-active");
      t.onClickEvent(() => this.navigate(r));
    };
    tab("Home", { tab: "home" }, this.route.tab !== "setup");
    tab("Setup", { tab: "setup" }, this.route.tab === "setup");

    const body = root.createDiv({ cls: "sq-body" });
    const nav = (r: Route) => this.navigate(r);
    const clock = this.store.clock;
    switch (this.route.tab) {
      case "home":
        renderHome(body, this.store, nav, clock);
        break;
      case "course":
        body.createDiv({ cls: "sq-muted", text: "Course view arrives in the next build step." });
        break;
      case "setup":
        body.createDiv({ cls: "sq-muted", text: "Setup arrives in a later build step." });
        break;
    }
  }
}
