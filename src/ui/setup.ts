import { Notice, type App } from "obsidian";
import type { Action } from "../core/actions";
import { examWeek, formatRunDates, formatShort, localDateOf, type Clock } from "../core/dates";
import {
  canCorrectRun,
  canUndoCourse,
  canUndoObjective,
  courseObjectives,
  chosenRun,
  objectiveLabel,
  isResit,
  runEnded,
  runScore,
  undoDeadline,
} from "../core/derive";
import { tierLabel } from "../core/prestige";
import { ADDABLE_KINDS, BULK_KINDS, DATED_KINDS, type Kind } from "../core/events";
import { courseFolder } from "../core/folders";
import { runIdFromName } from "../core/ids";
import type { CourseFolders } from "../store/course-folders";
import type { QuestStore } from "../store/quest-store";
import type { RunChoice } from "../store/run-choice";
import { renderEvidence } from "./evidence-link";
import { KIND_LABELS, renderMark, renderObjectiveMeta, renderTypeTag } from "./parts";
import { singleFlight } from "./single-flight";

/** Setup's own UI state, kept on the view so re-renders don't lose typed input. */
export interface SetupUi {
  run?: string; // run id, or "new"
  course?: string;
  drafts: Record<string, string>;
}

export function renderSetup(
  el: HTMLElement,
  store: QuestStore,
  clock: Clock,
  ui: SetupUi,
  rerender: () => void,
  app: App,
  folders: CourseFolders,
  choice: RunChoice,
): void {
  const s = store.state;
  const now = clock();
  const today = localDateOf(now);

  if (!ui.run || (ui.run !== "new" && !s.runs.has(ui.run))) ui.run = chosenRun(s, choice.get(), today)?.id ?? "new";

  const field = (parent: HTMLElement, key: string, attrs: { type?: string; placeholder?: string; value?: string }) => {
    const input = parent.createEl("input", { type: attrs.type ?? "text", cls: "sq-input" });
    if (attrs.placeholder) input.placeholder = attrs.placeholder;
    input.value = ui.drafts[key] ?? attrs.value ?? "";
    input.addEventListener("input", () => (ui.drafts[key] = input.value));
    return input;
  };
  const clear = (...keys: string[]) => keys.forEach((k) => delete ui.drafts[k]);
  const act = async (a: Action, onOk?: () => void) => {
    const r = await store.dispatch(a);
    if (!r.ok) new Notice(r.error);
    else {
      onOk?.();
      rerender();
    }
  };
  const minutesLeft = (addedAt: string) => Math.max(1, Math.ceil((undoDeadline(addedAt).getTime() - now.getTime()) / 60_000));

  // ── 1 · run dates ──
  const s1 = section(el, "1 · Run dates");
  const pick = s1.createEl("select", { cls: "sq-select" });
  for (const r of s.runs.values()) pick.createEl("option", { value: r.id, text: r.name });
  pick.createEl("option", { value: "new", text: "New run…" });
  pick.value = ui.run;
  pick.onchange = () => {
    ui.run = pick.value;
    ui.course = undefined;
    // Picking an open run moves the run switch too; a closed run is only viewed.
    const picked = s.runs.get(pick.value);
    if (picked && !picked.closed) choice.set(picked.id);
    rerender();
  };

  if (ui.run === "new") {
    const row = s1.createDiv({ cls: "sq-form" });
    const name = field(row, "run.name", { placeholder: "Name, e.g. 2026-27 Q2" });
    labelled(row, "Start", field(row, "run.start", { type: "date" }));
    labelled(row, "End", field(row, "run.end", { type: "date" }));
    button(row, "Create run", () => {
      const id = runIdFromName(name.value);
      // A blank End means the end date isn't known yet.
      return act({ type: "createRun", name: name.value, start: ui.drafts["run.start"] ?? "", end: ui.drafts["run.end"] || undefined }, () => {
        if (id.ok) {
          ui.run = id.value;
          choice.set(id.value);
        }
        clear("run.name", "run.start", "run.end");
      });
    });
    s1.createDiv({ cls: "sq-hint", text: "Dates come from the university calendar. Leave End blank if you don't know it yet. Dates lock 30 minutes after the end is set." });
    return;
  }

  const run = s.runs.get(ui.run)!;
  const closed = !!run.closed;
  // A closed run is frozen: no forms and no undo, whatever the clock says.
  const ended = closed || runEnded(run, today);
  const week = run.end === undefined ? null : examWeek(run.end);
  if (closed) {
    const score = runScore(s, run.id);
    const pct = score.pct === null ? "—" : `${score.pct}%`;
    s1.createDiv({ cls: "sq-line", text: `${formatRunDates(run.start, run.end)} · closed · ${pct} · ${tierLabel(score.tier ?? 0)}` });
  } else if (canCorrectRun(run, now)) {
    const row = s1.createDiv({ cls: "sq-form" });
    labelled(row, "Start", field(row, `fix.${run.id}.start`, { type: "date", value: run.start }));
    labelled(row, "End", field(row, `fix.${run.id}.end`, { type: "date", value: run.end ?? "" }));
    button(row, "Save dates", () =>
      act(
        {
          type: "correctRunDates",
          run: run.id,
          start: ui.drafts[`fix.${run.id}.start`] ?? run.start,
          // A cleared End field means no end date.
          end: (ui.drafts[`fix.${run.id}.end`] ?? run.end) || undefined,
        },
        () => clear(`fix.${run.id}.start`, `fix.${run.id}.end`),
      ),
    );
    s1.createDiv({
      cls: "sq-hint",
      text: run.end === undefined
        ? "No end date yet. Dates stay editable until you set one."
        : `Editable for ${minutesLeft(run.datesSetAt)} more min, then locked.`,
    });
  } else {
    s1.createDiv({ cls: "sq-line", text: `${formatRunDates(run.start, run.end)} · locked` });
  }
  if (week) s1.createDiv({ cls: "sq-hint", text: `Exam week: ${formatShort(week.from)} → ${formatShort(week.to)}` });
  if (closed) s1.createDiv({ cls: "sq-hint", text: "This run is closed. Its record is final." });
  else if (ended) s1.createDiv({ cls: "sq-hint is-warning", text: "This run has ended. Nothing more can be added." });

  // ── 2 · courses ──
  const s2 = section(el, "2 · Courses");
  if (run.courses.size === 0) s2.createDiv({ cls: "sq-muted", text: "No courses yet." });
  for (const c of run.courses.values()) {
    const row = s2.createDiv({ cls: "sq-list-row" });
    row.createSpan({ cls: "sq-code", text: c.code });
    row.createSpan({ cls: "sq-name", text: c.name });
    if (isResit(s, run.id, c.code)) row.createSpan({ cls: "sq-pill", text: "RESIT" });
    row.createSpan({ cls: "sq-hint", text: `folder: ${c.folder}` });
    if (!closed && canUndoCourse(s, run.id, c.code, now)) {
      button(row, `Undo · ${minutesLeft(c.addedAt)} min left`, () =>
        act({ type: "undoCourse", run: run.id, code: c.code }, () => {
          folders.removeIfEmpty(c.folder).catch((e) => new Notice(`Course undone, but its folder couldn't be removed: ${message(e)}`));
        }),
      );
    }
  }
  if (!ended) {
    const row = s2.createDiv({ cls: "sq-form" });
    const code = field(row, "course.code", { placeholder: "Code, e.g. DSAIT4000" });
    field(row, "course.name", { placeholder: "Name" });
    field(row, "course.folder", { placeholder: "Folder in Courses/ (default: CODE)" });
    button(row, "Add course", () => {
      const c = code.value.trim();
      const folder = courseFolder(ui.drafts["course.folder"] ?? "", c);
      return act(
        {
          type: "addCourse",
          run: run.id,
          code: c,
          name: ui.drafts["course.name"] ?? "",
          folder,
        },
        () => {
          folders.ensure(folder).catch((e) => new Notice(`Course added, but its folder couldn't be created: ${message(e)}`));
          ui.course = c;
          clear("course.code", "course.name", "course.folder");
        },
      );
    });
  }

  // ── 3 · objectives ──
  const s3 = section(el, "3 · Objectives");
  if (run.courses.size === 0) {
    s3.createDiv({ cls: "sq-muted", text: "Add a course first." });
    return;
  }
  if (!ui.course || !run.courses.has(ui.course)) ui.course = run.courses.keys().next().value;
  const course = ui.course!;
  const coursePick = s3.createEl("select", { cls: "sq-select" });
  for (const c of run.courses.values()) coursePick.createEl("option", { value: c.code, text: `${c.code} · ${c.name}` });
  coursePick.value = course;
  coursePick.onchange = () => {
    ui.course = coursePick.value;
    rerender();
  };

  const list = s3.createDiv({ cls: "sq-objectives" });
  const objs = courseObjectives(s, run.id, course);
  if (objs.length === 0) list.createDiv({ cls: "sq-muted", text: "No objectives yet." });
  for (const o of objs) {
    const row = list.createDiv({ cls: "sq-obj-row" });
    renderTypeTag(row, o.kind);
    row.createSpan({ cls: "sq-obj-title", text: objectiveLabel(o) });
    renderObjectiveMeta(row, o);
    if (o.completed || closed) renderMark(row, o, closed);
    renderEvidence(row, o, app);
    if (!closed && canUndoObjective(o, now)) button(row, `Undo · ${minutesLeft(o.addedAt)} min left`, () => act({ type: "undoObjective", obj: o.id }));
  }
  if (ended) return;

  // Add one
  const drafted = ui.drafts["obj.kind"] as Kind | undefined;
  const kind: Kind = drafted && ADDABLE_KINDS.includes(drafted) ? drafted : "lecture";
  const add = s3.createDiv({ cls: "sq-form" });
  kindSelect(add, ADDABLE_KINDS, kind, (k) => {
    ui.drafts["obj.kind"] = k;
    rerender();
  });
  // No end date means no exam week, so there's nowhere to put an exam yet.
  if (kind === "exam" && !week) {
    add.createSpan({ cls: "sq-hint", text: "Set an end date to add exams." });
  } else {
    field(add, "obj.title", { placeholder: "Title, e.g. Assignment 2" });
    if (DATED_KINDS.includes(kind)) {
      labelled(add, kind === "exam" ? "Exam date" : "Due date", field(add, "obj.date", { type: "date" }));
    }
    if (kind === "reading") {
      labelled(add, "Levels", field(add, "obj.levels", { placeholder: "Chapter, or Course, Chapter", value: "Chapter" }));
    }
    button(add, "Add objective", () => {
      const a: Action = { type: "addObjective", run: run.id, course, kind, title: ui.drafts["obj.title"] ?? "" };
      if (DATED_KINDS.includes(kind)) a.date = ui.drafts["obj.date"] ?? "";
      if (kind === "reading") a.levels = (ui.drafts["obj.levels"] ?? "Chapter").split(",");
      return act(a, () => clear("obj.title", "obj.date", "obj.levels"));
    });
  }
  if (kind === "exam" && week) s3.createDiv({ cls: "sq-hint", text: `Exam dates must fall in exam week (${formatShort(week.from)} → ${formatShort(week.to)}). Exams complete themselves as SAT once the date passes.` });

  // Bulk add
  const bulkDraft = ui.drafts["bulk.kind"] as Kind | undefined;
  const bulkKind: Kind = bulkDraft && BULK_KINDS.includes(bulkDraft) ? bulkDraft : "lecture";
  const bulk = s3.createDiv({ cls: "sq-form" });
  bulk.createSpan({ cls: "sq-hint", text: "Bulk add" });
  kindSelect(bulk, BULK_KINDS, bulkKind, (k) => (ui.drafts["bulk.kind"] = k));
  field(bulk, "bulk.prefix", { placeholder: "Prefix, e.g. Lecture" });
  labelled(bulk, "from", field(bulk, "bulk.from", { type: "number", placeholder: "1" }));
  labelled(bulk, "to", field(bulk, "bulk.to", { type: "number", placeholder: "14" }));
  button(bulk, "Add series", () =>
    act(
      {
        type: "bulkAddObjectives",
        run: run.id,
        course,
        kind: bulkKind,
        prefix: ui.drafts["bulk.prefix"] ?? "",
        from: Number(ui.drafts["bulk.from"] ?? 1),
        to: Number(ui.drafts["bulk.to"] ?? 0),
      },
      () => clear("bulk.prefix", "bulk.from", "bulk.to"),
    ),
  );
}

function section(el: HTMLElement, title: string): HTMLElement {
  const box = el.createDiv({ cls: "sq-step" });
  box.createEl("h4", { cls: "sq-step-title", text: title });
  return box;
}

function labelled(parent: HTMLElement, label: string, input: HTMLElement): void {
  const l = parent.createEl("label", { cls: "sq-label", text: label });
  l.appendChild(input);
}

function button(parent: HTMLElement, text: string, onClick: () => unknown): HTMLButtonElement {
  const b = parent.createEl("button", { text, cls: "sq-btn" });
  const once = singleFlight(async () => {
    b.disabled = true;
    try {
      await onClick();
    } finally {
      b.disabled = false;
    }
  });
  b.onClickEvent(() => void once());
  return b;
}

function kindSelect(parent: HTMLElement, kinds: Kind[], value: Kind, onChange: (k: Kind) => void): void {
  const sel = parent.createEl("select", { cls: "sq-select" });
  for (const k of kinds) sel.createEl("option", { value: k, text: KIND_LABELS[k] });
  sel.value = value;
  sel.onchange = () => onChange(sel.value as Kind);
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
