import { formatShort } from "../core/dates";
import type { App } from "obsidian";
import { courseObjectives, courseProgress, objectiveLabel, runScore, stains } from "../core/derive";
import { tierLabel } from "../core/prestige";
import { drawnFilter } from "../core/character";
import { badgesEarnedBy, runRewards } from "../core/rewards";
import type { QuestStore } from "../store/quest-store";
import { renderEvidence } from "./evidence-link";
import { renderBadges } from "./badges";
import { renderCharacter } from "./sprite";
import { renderMark, renderObjectiveMeta, renderTypeTag, stainLabel, type Navigate, type Route } from "./parts";

/** Every objective of one run, grouped by course. Read only. */
export function renderRunPage(el: HTMLElement, store: QuestStore, route: Extract<Route, { tab: "run" }>, nav: Navigate, app: App): void {
  const s = store.state;
  el.createDiv({ cls: "sq-back", text: "← Hall" }).onClickEvent(() => nav({ tab: "hall" }));
  const run = s.runs.get(route.run);
  if (!run) {
    el.createDiv({ cls: "sq-muted", text: "This run no longer exists." });
    return;
  }
  const closed = !!run.closed;
  const score = runScore(s, run.id);
  const head = el.createDiv({ cls: "sq-run-head" });
  if (run.character) renderCharacter(head.createDiv({ cls: "sq-run-character" }), run.character, drawnFilter(s, run.id), 1);
  const title = [run.name, score.pct === null ? "—" : `${score.pct}%`];
  if (closed) title.push(tierLabel(score.tier ?? 0));
  title.push(`Level ${runRewards(s, run.id).level.level}`);
  head.createDiv({ cls: "sq-run-title", text: title.join(" · ") });
  const sub = [`${formatShort(run.start)} → ${formatShort(run.end)}`, `${score.done} of ${score.total}`];
  if (closed) sub.push(stainLabel(stains(s, run.id).length));
  head.createDiv({ cls: "sq-hint", text: sub.join(" · ") });

  el.createEl("h4", { cls: "sq-section", text: "Badges" });
  const badges = badgesEarnedBy(s, run.id);
  if (badges.length === 0) el.createDiv({ cls: "sq-muted", text: "No badges." });
  else renderBadges(el, badges);

  if (run.courses.size === 0) el.createDiv({ cls: "sq-muted", text: "No courses." });
  for (const c of run.courses.values()) {
    const p = courseProgress(s, run.id, c.code);
    el.createEl("h4", { cls: "sq-section", text: `${c.code} · ${c.name} · ${p.pct === null ? "—" : `${p.pct}%`}` });
    const box = el.createDiv({ cls: "sq-objectives" });
    const objs = courseObjectives(s, run.id, c.code);
    if (objs.length === 0) box.createDiv({ cls: "sq-muted", text: "No objectives." });
    for (const o of objs) {
      const row = box.createDiv({ cls: "sq-obj-row" });
      if (o.completed) row.addClass("is-done");
      renderTypeTag(row, o.kind);
      row.createSpan({ cls: "sq-obj-title", text: objectiveLabel(o) });
      renderObjectiveMeta(row, o);
      renderMark(row, o, closed);
      renderEvidence(row, o, app);
    }
  }
}
