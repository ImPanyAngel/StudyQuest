import { formatShort, localDateOf, type Clock } from "../core/dates";
import { hallRuns, runScore, stains } from "../core/derive";
import { tierLabel } from "../core/prestige";
import type { RunState } from "../core/state";
import type { QuestStore } from "../store/quest-store";
import { stainLabel, type Navigate } from "./parts";

/** Library of runs: unfinished ones first as dashed cards, then closed runs newest first. */
export function renderHall(el: HTMLElement, store: QuestStore, nav: Navigate, clock: Clock): void {
  const s = store.state;
  const today = localDateOf(clock());
  const { open, closed } = hallRuns(s);
  if (open.length + closed.length === 0) {
    el.createDiv({ cls: "sq-muted", text: "No runs yet." });
    return;
  }
  const grid = el.createDiv({ cls: "sq-hall" });
  const card = (r: RunState, live: boolean) => {
    const c = grid.createDiv({ cls: live ? "sq-card is-live" : "sq-card" });
    c.createDiv({ cls: "sq-card-art", text: live ? "in progress" : "" });
    c.createDiv({ cls: "sq-card-name", text: r.name });
    const score = runScore(s, r.id);
    const meta = c.createDiv({ cls: "sq-card-meta" });
    meta.createSpan({ cls: "sq-card-pct", text: score.pct === null ? "—" : `${score.pct}%` });
    if (live) {
      meta.createSpan({ cls: "sq-hint", text: r.start > today ? `starts ${formatShort(r.start)}` : `ends ${formatShort(r.end)}` });
    } else {
      meta.createSpan({ cls: "sq-card-tier", text: tierLabel(score.tier ?? 0) });
      const n = stains(s, r.id).length;
      c.createDiv({ cls: n ? "sq-card-stains" : "sq-card-stains is-none", text: stainLabel(n) });
    }
    c.onClickEvent(() => nav({ tab: "run", run: r.id }));
  };
  for (const r of open) card(r, true);
  for (const r of closed) card(r, false);
}
