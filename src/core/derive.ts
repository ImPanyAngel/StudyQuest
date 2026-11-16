import { addDays, type LocalDate } from "./dates";
import { DATED_KINDS } from "./events";
import { withinUndoWindow } from "./replay";
import type { ObjectiveState, RunState, State } from "./state";

const UNDO_WINDOW_MS = 30 * 60_000;

export interface Progress {
  done: number;
  total: number;
  pct: number | null;
}

export function percent(done: number, total: number): number | null {
  return total === 0 ? null : Math.floor((100 * done) / total);
}

function progressOf(objs: ObjectiveState[]): Progress {
  const done = objs.filter((o) => o.completed).length;
  return { done, total: objs.length, pct: percent(done, objs.length) };
}

export function courseObjectives(s: State, run: string, course: string): ObjectiveState[] {
  return [...s.objectives.values()].filter((o) => o.run === run && o.course === course);
}

export function courseProgress(s: State, run: string, course: string): Progress {
  return progressOf(courseObjectives(s, run, course));
}

export function runProgress(s: State, run: string): Progress {
  return progressOf([...s.objectives.values()].filter((o) => o.run === run));
}

export function isResit(s: State, run: string, course: string): boolean {
  const self = s.runs.get(run);
  if (!self) return false;
  return [...s.runs.values()].some((r) => r.start < self.start && r.courses.has(course));
}

export function currentRun(s: State, today: LocalDate): RunState | null {
  const runs = [...s.runs.values()];
  const containing = runs.find((r) => r.start <= today && today <= r.end);
  if (containing) return containing;
  const upcoming = runs.filter((r) => r.start > today).sort((a, b) => (a.start < b.start ? -1 : 1));
  if (upcoming.length) return upcoming[0];
  const past = runs.filter((r) => r.end < today).sort((a, b) => (a.end > b.end ? -1 : 1));
  return past[0] ?? null;
}

export function runEnded(run: RunState, today: LocalDate): boolean {
  return today > run.end;
}

export function shortName(run: RunState): string {
  const words = run.name.trim().split(/\s+/);
  return words[words.length - 1];
}

export interface HomeRow {
  obj: ObjectiveState;
  overdue: boolean;
  soon: boolean;
  clickable: boolean;
}

export function homeRows(s: State, run: string, today: LocalDate): { dated: HomeRow[]; anytime: HomeRow[] } {
  const r = s.runs.get(run);
  const open = [...s.objectives.values()].filter((o) => o.run === run && !o.completed);
  const row = (o: ObjectiveState): HomeRow => ({
    obj: o,
    overdue: o.kind === "assignment" && !!o.date && o.date < today,
    soon: !!o.date && today <= o.date && o.date <= addDays(today, 2),
    clickable: o.kind !== "exam",
  });

  // Stable sort keeps add order for equal dates.
  const dated = open.filter((o) => DATED_KINDS.includes(o.kind)).sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0));

  const courseOrder = r ? [...r.courses.keys()] : [];
  const anytime = open
    .filter((o) => !DATED_KINDS.includes(o.kind))
    .sort((a, b) => courseOrder.indexOf(a.course) - courseOrder.indexOf(b.course));

  return { dated: dated.map(row), anytime: anytime.map(row) };
}

export function undoDeadline(addedAt: string): Date {
  return new Date(Date.parse(addedAt) + UNDO_WINDOW_MS);
}

export function canUndoObjective(o: ObjectiveState, now: Date): boolean {
  return !o.completed && !o.stepsDone.some(Boolean) && withinUndoWindow(o.addedAt, now.toISOString());
}

export function canUndoCourse(s: State, run: string, code: string, now: Date): boolean {
  const c = s.runs.get(run)?.courses.get(code);
  if (!c || !withinUndoWindow(c.addedAt, now.toISOString())) return false;
  return courseObjectives(s, run, code).every((o) => !o.completed && !o.stepsDone.some(Boolean));
}

export function canCorrectRun(run: RunState, now: Date): boolean {
  return withinUndoWindow(run.createdAt, now.toISOString());
}

export function examsDueForSat(s: State, today: LocalDate): ObjectiveState[] {
  return [...s.objectives.values()].filter((o) => o.kind === "exam" && !o.completed && !!o.date && o.date < today);
}
