import { localDateOf, type Clock } from "../core/dates";
import { courseObjectives, courseProgress, isResit, runEnded } from "../core/derive";
import type { QuestStore } from "../store/quest-store";
import { openCompleteMenu } from "./complete-menu";
import { renderMark, renderObjectiveMeta, renderTypeTag, type Navigate, type Route } from "./parts";

export function renderCourse(
  el: HTMLElement,
  store: QuestStore,
  route: Extract<Route, { tab: "course" }>,
  nav: Navigate,
  clock: Clock,
): void {
  const s = store.state;
  const run = s.runs.get(route.run);
  const course = run?.courses.get(route.course);

  el.createDiv({ cls: "sq-back", text: "← Home" }).onClickEvent(() => nav({ tab: "home" }));

  if (!run || !course) {
    el.createDiv({ cls: "sq-muted", text: "This course no longer exists." });
    return;
  }
  const ended = runEnded(run, localDateOf(clock()));
  const closed = !!run.closed;

  const head = el.createDiv({ cls: "sq-course-head" });
  head.createSpan({ cls: "sq-code", text: course.code });
  head.createSpan({ cls: "sq-name", text: course.name });
  if (isResit(s, run.id, course.code)) head.createSpan({ cls: "sq-pill", text: "RESIT" });
  const p = courseProgress(s, run.id, course.code);
  const bar = head.createSpan({ cls: "sq-bar" });
  bar.createSpan({ cls: "sq-bar-fill" }).style.width = `${p.pct ?? 0}%`;
  head.createSpan({ cls: "sq-pct", text: p.pct === null ? "—" : `${p.pct}%` });

  const box = el.createDiv({ cls: "sq-objectives" });
  const objs = courseObjectives(s, run.id, course.code);
  if (objs.length === 0) box.createDiv({ cls: "sq-muted", text: "No objectives yet. Add them in Setup." });

  for (const o of objs) {
    const row = box.createDiv({ cls: "sq-obj-row" });
    renderTypeTag(row, o.kind);
    row.createSpan({ cls: "sq-obj-title", text: o.title });
    renderObjectiveMeta(row, o);
    const tier = o.completed?.tier;
    renderMark(row, o, closed);
    if (tier) {
      row.addClass("is-done");
    } else if (o.kind !== "exam" && !ended && !closed) {
      row.addClass("is-clickable");
      row.onClickEvent((evt) => openCompleteMenu(evt, o, store));
    }
  }
}
