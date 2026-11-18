import { localDateOf, type Clock } from "../core/dates";
import { chosenRun, runScore, shortName } from "../core/derive";
import type { QuestStore } from "../store/quest-store";
import type { RunChoice } from "../store/run-choice";

/** "Q2 41%" in the status bar; click opens Home. */
export class StatusBadge {
  constructor(
    private el: HTMLElement,
    private store: QuestStore,
    private choice: RunChoice,
    private clock: Clock,
    onClick: () => void,
  ) {
    el.addClass("mod-clickable");
    el.setAttr("aria-label", "Open StudyQuest");
    el.onClickEvent(onClick);
    store.subscribe(() => this.update());
    choice.subscribe(() => this.update());
    this.update();
  }

  update(): void {
    const run = chosenRun(this.store.state, this.choice.get(), localDateOf(this.clock()));
    if (!run) {
      this.el.setText("StudyQuest");
      return;
    }
    const pct = runScore(this.store.state, run.id).pct;
    this.el.setText(`${shortName(run)} ${pct === null ? "—" : `${pct}%`}`);
  }
}
