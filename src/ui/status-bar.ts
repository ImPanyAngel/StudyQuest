import { localDateOf, type Clock } from "../core/dates";
import { currentRun, runProgress, shortName } from "../core/derive";
import type { QuestStore } from "../store/quest-store";

/** "Q2 41%" in the status bar; click opens Home. */
export class StatusBadge {
  constructor(
    private el: HTMLElement,
    private store: QuestStore,
    private clock: Clock,
    onClick: () => void,
  ) {
    el.addClass("mod-clickable");
    el.setAttr("aria-label", "Open StudyQuest");
    el.onClickEvent(onClick);
    store.subscribe(() => this.update());
    this.update();
  }

  update(): void {
    const run = currentRun(this.store.state, localDateOf(this.clock()));
    if (!run) {
      this.el.setText("StudyQuest");
      return;
    }
    const pct = runProgress(this.store.state, run.id).pct;
    this.el.setText(`${shortName(run)} ${pct === null ? "—" : `${pct}%`}`);
  }
}
