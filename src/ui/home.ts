import type { App } from "obsidian";
import { examWeek, formatShort, localDateOf, type Clock } from "../core/dates";
import {
  chosenRun,
  courseProgress,
  homeRows,
  isResit,
  objectiveLabel,
  runEnded,
  runHasExams,
  runProgress,
  runScore,
  type HomeRow,
} from "../core/derive";
import { tierLabel } from "../core/prestige";
import { runBadges, runRewards } from "../core/rewards";
import type { QuestStore } from "../store/quest-store";
import type { RunChoice } from "../store/run-choice";
import { openCompleteMenu } from "./complete-menu";
import { renderBadges } from "./badges";
import { drawnFilter } from "../core/character";
import { courseBreaks, renderLevel, renderObjectiveMeta, renderTypeTag, type Navigate } from "./parts";
import { renderCharacter } from "./sprite";

export function renderHome(el: HTMLElement, store: QuestStore, nav: Navigate, clock: Clock, app: App, choice: RunChoice): void {
  const s = store.state;
  const today = localDateOf(clock());
  const run = chosenRun(s, choice.get(), today);

  if (!run) {
    const empty = el.createDiv({ cls: "sq-empty" });
    empty.createEl("p", { text: "No run yet. Set up your quarter to start." });
    empty.createEl("button", { text: "Go to Setup", cls: "mod-cta" }).onClickEvent(() => nav({ tab: "setup" }));
    return;
  }
  const ended = runEnded(run, today);

  if (run.closed) {
    const score = runScore(s, run.id);
    const box = el.createDiv({ cls: "sq-empty" });
    box.createEl("p", { text: `${run.name} is closed.` });
    const level = runRewards(s, run.id).level.level;
    box.createEl("p", { cls: "sq-closed-score", text: `${score.pct === null ? "—" : `${score.pct}%`} · ${tierLabel(score.tier ?? 0)} · Level ${level}` });
    const buttons = box.createDiv({ cls: "sq-prestige-buttons" });
    buttons.createEl("button", { text: "Go to Setup", cls: "mod-cta" }).onClickEvent(() => nav({ tab: "setup" }));
    buttons.createEl("button", { text: "Open Hall" }).onClickEvent(() => nav({ tab: "hall" }));
    return;
  }

  // ── top row ──
  const top = el.createDiv({ cls: "sq-top" });

  const progress = runProgress(s, run.id);
  const pct = progress.pct;
  const ring = top.createDiv({ cls: "sq-ring" });
  ring.setCssProps({ "--sq-pct": String(pct ?? 0) });
  ring.createDiv({ cls: "sq-ring-value", text: pct === null ? "—" : `${pct}%` });
  ring.createDiv({ cls: "sq-ring-label", text: run.name });

  const middle = top.createDiv({ cls: "sq-middle" });
  // A run without exams (e.g. a career roadmap) has no exam week to show. The line always
  // keeps its space, so the course list starts at the same height whichever run is shown.
  // A run with no end date has no exam week and can't have ended.
  const week = run.end === undefined ? null : examWeek(run.end);
  const examLine =
    week && runHasExams(s, run.id)
      ? `${ended ? "Ended · " : ""}Exam week: ${formatShort(week.from)} → ${formatShort(week.to)}`
      : ended && run.end
        ? `Ended ${formatShort(run.end)}`
        : "\u00a0";
  middle.createDiv({ cls: "sq-exam-week", text: examLine });
  const list = middle.createDiv({ cls: "sq-courses" });
  if (run.courses.size === 0) list.createDiv({ cls: "sq-muted", text: "No courses yet. Add them in Setup." });
  for (const c of run.courses.values()) {
    const p = courseProgress(s, run.id, c.code);
    const row = list.createDiv({ cls: "sq-course-row" });
    row.createSpan({ cls: "sq-code", text: c.code });
    row.createSpan({ cls: "sq-name", text: c.name });
    if (isResit(s, run.id, c.code)) row.createSpan({ cls: "sq-pill", text: "RESIT" });
    const bar = row.createSpan({ cls: "sq-bar" });
    bar.createSpan({ cls: "sq-bar-fill" }).setCssStyles({ width: `${p.pct ?? 0}%` });
    row.createSpan({ cls: "sq-pct", text: p.pct === null ? "—" : `${p.pct}%` });
    row.onClickEvent(() => nav({ tab: "course", run: run.id, course: c.code }));
  }

  renderBadges(middle, runBadges(s, run.id));

  const side = top.createDiv({ cls: "sq-player-col" });
  // The card is the way to the character: creation first, then the character page.
  const card = side.createDiv({ cls: "sq-player is-clickable" });
  renderCharacter(card, run.character ?? null, drawnFilter(s, run.id), 2);
  card.onClickEvent(() => nav(run.character ? { tab: "character", run: run.id } : { tab: "creation", run: run.id }));
  renderLevel(side, runRewards(s, run.id));

  // ── objectives ──
  const heading = el.createEl("h4", { cls: "sq-section", text: "Objectives" });
  heading.createSpan({ cls: "sq-count", text: `${progress.done}/${progress.total}` });
  const rows = homeRows(s, run.id, today);
  const box = el.createDiv({ cls: "sq-objectives" });
  if (rows.dated.length === 0 && rows.anytime.length === 0) {
    box.createDiv({ cls: "sq-muted", text: run.courses.size ? "Nothing open." : "Add objectives in Setup." });
  }
  for (const r of rows.dated) renderRow(box, r, store, ended, app);
  if (rows.anytime.length) box.createDiv({ cls: "sq-divider", text: "anytime" });
  // A small break between courses makes each course's anytime work easy to spot.
  const breaks = courseBreaks(rows.anytime.map((r) => r.obj.course));
  rows.anytime.forEach((r, i) => {
    if (breaks[i]) box.createDiv({ cls: "sq-course-break" });
    renderRow(box, r, store, ended, app);
  });
}

function renderRow(box: HTMLElement, r: HomeRow, store: QuestStore, ended: boolean, app: App) {
  const row = box.createDiv({ cls: "sq-obj-row" });
  if (r.overdue) row.addClass("is-overdue");
  if (r.soon) row.addClass("is-soon");
  renderTypeTag(row, r.obj.kind);
  row.createSpan({ cls: "sq-obj-title", text: `${r.obj.course} · ${objectiveLabel(r.obj)}` });
  renderObjectiveMeta(row, r.obj, r.overdue);
  if (r.clickable && !ended) {
    row.addClass("is-clickable");
    row.onClickEvent((evt) => openCompleteMenu(evt, r.obj, store, app));
  }
}
