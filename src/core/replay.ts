import { daysBetween, examWeek, isLocalDate, type LocalDate } from "./dates";
import type { CourseAdded, CourseUndone, QuarterCreated, QuarterDatesCorrected, QuestEvent } from "./events";
import { isCourseCode, runIdFromName } from "./ids";
import { emptyState, type ObjectiveState, type RunState, type State } from "./state";

const UNDO_WINDOW_MS = 30 * 60_000;

/** True when `t` is at most 30 minutes after `targetT` (and not before it). */
export function withinUndoWindow(targetT: string, t: string): boolean {
  const diff = Date.parse(t) - Date.parse(targetT);
  return diff >= 0 && diff <= UNDO_WINDOW_MS;
}

/**
 * Applies one event to `state` in place. Returns null when applied, or the
 * reason it was rejected (state untouched).
 */
export function applyEvent(state: State, e: QuestEvent): string | null {
  switch (e.type) {
    case "quarter_created":
      return quarterCreated(state, e);
    case "quarter_dates_corrected":
      return quarterDatesCorrected(state, e);
    case "course_added":
      return courseAdded(state, e);
    case "course_undone":
      return courseUndone(state, e);
    default:
      return "Unknown event type.";
  }
}

/** Dedupe by id (first wins), order by t then id, apply, ignore rejections. */
export function replay(events: QuestEvent[]): State {
  const seen = new Set<string>();
  const unique = events.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  unique.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const state = emptyState();
  for (const e of unique) applyEvent(state, e);
  return state;
}

// ── runs ────────────────────────────────────────────────────────────────

function checkRunDates(state: State, start: LocalDate, end: LocalDate, self?: string): string | null {
  if (!isLocalDate(start) || !isLocalDate(end)) return "Dates must be valid YYYY-MM-DD dates.";
  if (daysBetween(start, end) < 7) return "A run must last at least 7 days.";
  for (const r of state.runs.values()) {
    if (r.id === self) continue;
    if (start <= r.end && r.start <= end) return `These dates overlap with run "${r.name}".`;
  }
  return null;
}

function datedObjectivesFit(state: State, run: string, start: LocalDate, end: LocalDate): string | null {
  const week = examWeek(end);
  for (const o of objectivesOfRun(state, run)) {
    if (!o.date) continue;
    if (o.kind === "assignment" && (o.date < start || o.date > end)) {
      return `"${o.title}" is due on ${o.date}, outside the new dates.`;
    }
    if (o.kind === "exam" && (o.date < week.from || o.date > week.to)) {
      return `"${o.title}" on ${o.date} would fall outside the new exam week.`;
    }
  }
  return null;
}

function quarterCreated(state: State, e: QuarterCreated): string | null {
  const id = runIdFromName(e.name);
  if (!id.ok) return id.error;
  if (id.value !== e.run) return "Run id doesn't match its name.";
  if (state.runs.has(e.run)) return `A run called "${e.name}" already exists.`;
  const bad = checkRunDates(state, e.start, e.end);
  if (bad) return bad;
  state.runs.set(e.run, { id: e.run, name: e.name, start: e.start, end: e.end, createdAt: e.t, courses: new Map() });
  return null;
}

function quarterDatesCorrected(state: State, e: QuarterDatesCorrected): string | null {
  const run = state.runs.get(e.run);
  if (!run) return "Unknown run.";
  if (!withinUndoWindow(run.createdAt, e.t)) return "The run's dates are locked.";
  const bad = checkRunDates(state, e.start, e.end, run.id) ?? datedObjectivesFit(state, run.id, e.start, e.end);
  if (bad) return bad;
  run.start = e.start;
  run.end = e.end;
  return null;
}

// ── courses ─────────────────────────────────────────────────────────────

function courseAdded(state: State, e: CourseAdded): string | null {
  const run = state.runs.get(e.run);
  if (!run) return "Unknown run.";
  if (!isCourseCode(e.course)) return "Course codes may only contain letters and numbers.";
  if (run.courses.has(e.course)) return `${e.course} is already in this run.`;
  run.courses.set(e.course, { code: e.course, name: e.name, folder: e.folder, addedAt: e.t });
  return null;
}

function courseUndone(state: State, e: CourseUndone): string | null {
  const run = state.runs.get(e.run);
  const course = run?.courses.get(e.course);
  if (!run || !course) return "Unknown course.";
  if (!withinUndoWindow(course.addedAt, e.t)) return "The undo window for this course has passed.";
  const objs = objectivesOfRun(state, run.id).filter((o) => o.course === course.code);
  if (objs.some(hasProgress)) return "A course with completed work can't be undone.";
  for (const o of objs) state.objectives.delete(o.id);
  run.courses.delete(course.code);
  return null;
}

// ── helpers ─────────────────────────────────────────────────────────────

function objectivesOfRun(state: State, run: string): ObjectiveState[] {
  return [...state.objectives.values()].filter((o) => o.run === run);
}

function hasProgress(o: ObjectiveState): boolean {
  return o.completed !== undefined || o.stepsDone.some(Boolean);
}

export type { RunState };
