import { addDays, type LocalDate } from "./dates";
import { DATED_KINDS } from "./events";
import type { PrestigeTier } from "./prestige";
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
  return !touched(o) && withinUndoWindow(o.addedAt, now.toISOString());
}

/** Completed, a step checked, or ever bumped: undo windows are over. Mirrors replay's rule. */
function touched(o: ObjectiveState): boolean {
  return !!o.completed || o.stepsDone.some(Boolean) || o.bumped;
}

/** Title, plus the reading's position, e.g. "Boot.dev [Course: 1; Chapter: 4]". */
export function objectiveLabel(o: ObjectiveState): string {
  if (!o.levels) return o.title;
  return `${o.title} [${o.levels.map((l, i) => `${l}: ${o.position[i]}`).join("; ")}]`;
}

/** When the most recent live bump stops being undoable, or null if there is none. */
export function bumpDeadline(o: ObjectiveState): Date | null {
  const last = o.bumps[o.bumps.length - 1];
  return last ? undoDeadline(last.at) : null;
}

export function canUndoBump(o: ObjectiveState, now: Date): boolean {
  const last = o.bumps[o.bumps.length - 1];
  return !o.completed && !!last && withinUndoWindow(last.at, now.toISOString());
}

export function evidenceOwner(s: State, path: string): ObjectiveState | undefined {
  const id = s.evidenceOwners.get(path);
  return id ? s.objectives.get(id) : undefined;
}

export function canUndoCourse(s: State, run: string, code: string, now: Date): boolean {
  const c = s.runs.get(run)?.courses.get(code);
  if (!c || !withinUndoWindow(c.addedAt, now.toISOString())) return false;
  return courseObjectives(s, run, code).every((o) => !touched(o));
}

export function canCorrectRun(run: RunState, now: Date): boolean {
  return withinUndoWindow(run.createdAt, now.toISOString());
}

export function examsDueForSat(s: State, today: LocalDate): ObjectiveState[] {
  return [...s.objectives.values()].filter(
    (o) => o.kind === "exam" && !o.completed && !!o.date && o.date < today && !s.runs.get(o.run)?.closed,
  );
}

// ── prestige ────────────────────────────────────────────────────────────

export function isClosed(run: RunState): boolean {
  return run.closed !== undefined;
}

export interface Score {
  done: number;
  total: number;
  pct: number | null;
  /** Null until the run is closed. */
  tier: PrestigeTier | null;
}

/** A closed run's frozen result, or the live progress of an open one. */
export function runScore(s: State, run: string): Score {
  const closed = s.runs.get(run)?.closed;
  if (closed) return { done: closed.done, total: closed.total, pct: percent(closed.done, closed.total), tier: closed.tier };
  return { ...runProgress(s, run), tier: null };
}

/** Objectives a closed run left open, in add order. */
export function stains(s: State, run: string): ObjectiveState[] {
  if (!s.runs.get(run)?.closed) return [];
  return [...s.objectives.values()].filter((o) => o.run === run && !o.completed);
}

const byEnd = (a: RunState, b: RunState) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0);
const byStart = (a: RunState, b: RunState) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0);

export function runsDueToClose(s: State, today: LocalDate): RunState[] {
  return [...s.runs.values()].filter((r) => !r.closed && runEnded(r, today)).sort(byEnd);
}

export function unseenPrestige(s: State): RunState[] {
  return [...s.runs.values()].filter((r) => r.closed && !r.seenAt).sort(byEnd);
}

export function hallRuns(s: State): { open: RunState[]; closed: RunState[] } {
  const runs = [...s.runs.values()];
  return {
    open: runs.filter((r) => !r.closed).sort(byStart),
    closed: runs.filter((r) => r.closed).sort((a, b) => byEnd(b, a)),
  };
}
