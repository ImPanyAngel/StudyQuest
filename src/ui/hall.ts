import { formatShort, localDateOf, type Clock } from "../core/dates";
import { hallRuns, runScore, stains } from "../core/derive";
import { tierLabel } from "../core/prestige";
import { drawnFilter } from "../core/character";
import { runRewards } from "../core/rewards";
import type { RunState } from "../core/state";
import type { QuestStore } from "../store/quest-store";
import { stainLabel, type Navigate } from "./parts";
import { renderCharacter } from "./sprite";

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
    const art = c.createDiv({ cls: "sq-card-art" });
    if (r.character) renderCharacter(art, r.character, drawnFilter(s, r.id), 2);
    else art.setText(live ? "in progress" : "");
    c.createDiv({ cls: "sq-card-name", text: r.name });
    const score = runScore(s, r.id);
    const meta = c.createDiv({ cls: "sq-card-meta" });
    meta.createSpan({ cls: "sq-card-pct", text: score.pct === null ? "—" : `${score.pct}%` });
    meta.createSpan({ cls: "sq-card-level", text: `Lv ${runRewards(s, r.id).level.level}` });
    if (live) {
      meta.createSpan({ cls: "sq-hint", text: r.start > today ? `starts ${formatShort(r.start)}` : r.end ? `ends ${formatShort(r.end)}` : "no end date" });
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
