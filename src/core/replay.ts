import { daysBetween, examWeek, isLocalDate, localDateOf, type LocalDate } from "./dates";
import {
  DATED_KINDS,
  EVIDENCE_KINDS,
  KINDS,
  type CharacterChanged,
  type CharacterCreated,
  type CourseAdded,
  type CourseUndone,
  type ObjectiveAdded,
  type ObjectiveCompleted,
  type ItemBought,
  type ObjectiveUndone,
  type PrestigeSeen,
  type PurchaseUndone,
  type QuarterClosed,
  type QuarterCreated,
  type QuarterDatesCorrected,
  type QuestEvent,
  type ReadingBumpUndone,
  type ReadingBumped,
  type StepCompleted,
  eventRun,
} from "./events";
import { isCourseCode, runIdFromName } from "./ids";
import { isPrestigeTier } from "./prestige";
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
  if (e.type !== "quarter_created" && e.type !== "quarter_closed" && e.type !== "prestige_seen") {
    if (state.runs.get(eventRun(e))?.closed) return "This run is closed.";
  }
  switch (e.type) {
    case "quarter_created":
      return quarterCreated(state, e);
    case "quarter_dates_corrected":
      return quarterDatesCorrected(state, e);
    case "course_added":
      return courseAdded(state, e);
    case "course_undone":
      return courseUndone(state, e);
    case "objective_added":
      return objectiveAdded(state, e);
    case "objective_undone":
      return objectiveUndone(state, e);
    case "step_completed":
      return stepCompleted(state, e);
    case "objective_completed":
      return objectiveCompleted(state, e);
    case "quarter_closed":
      return quarterClosed(state, e);
    case "prestige_seen":
      return prestigeSeen(state, e);
    case "reading_bumped":
      return readingBumped(state, e);
    case "reading_bump_undone":
      return readingBumpUndone(state, e);
    case "character_created":
      return characterCreated(state, e);
    case "character_changed":
      return characterChanged(state, e);
    case "item_bought":
      return itemBought(state, e);
    case "purchase_undone":
      return purchaseUndone(state, e);
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
  for (const e of unique) {
    try {
      applyEvent(state, e);
    } catch {
      // A malformed event is ignored like any other rejected one.
    }
  }
  return state;
}

// ── runs ────────────────────────────────────────────────────────────────

/** A run's dates lock 30 minutes after they were set, but never while the end is blank. */
export function datesLocked(run: RunState, t: string): boolean {
  return run.end !== undefined && !withinUndoWindow(run.datesSetAt, t);
}

function checkRunDates(start: LocalDate, end: LocalDate | undefined): string | null {
  if (!isLocalDate(start) || (end !== undefined && !isLocalDate(end))) return "Dates must be valid YYYY-MM-DD dates.";
  if (end !== undefined && daysBetween(start, end) < 7) return "A run must last at least 7 days.";
  // Runs may overlap: a side run (e.g. a career roadmap) can span several quarters.
  return null;
}

function datedObjectivesFit(state: State, run: string, start: LocalDate, end: LocalDate | undefined): string | null {
  for (const o of objectivesOfRun(state, run)) {
    if (!o.date) continue;
    if (end === undefined) {
      // No end: assignments may be due whenever, and there's no exam week to hold an exam.
      if (o.kind === "exam") return `"${o.title}" needs an end date for its exam week.`;
      continue;
    }
    const week = examWeek(end);
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
  const bad = checkRunDates(e.start, e.end);
  if (bad) return bad;
  const run: RunState = { id: e.run, name: e.name, start: e.start, createdAt: e.t, datesSetAt: e.t, courses: new Map(), purchases: new Map() };
  if (e.end !== undefined) run.end = e.end;
  state.runs.set(e.run, run);
  return null;
}

function quarterDatesCorrected(state: State, e: QuarterDatesCorrected): string | null {
  const run = state.runs.get(e.run);
  if (!run) return "Unknown run.";
  if (datesLocked(run, e.t)) return "The run's dates are locked.";
  const bad = checkRunDates(e.start, e.end) ?? datedObjectivesFit(state, run.id, e.start, e.end);
  if (bad) return bad;
  // The window starts when a blank end is first filled in.
  if (run.end === undefined && e.end !== undefined) run.datesSetAt = e.t;
  run.start = e.start;
  if (e.end === undefined) delete run.end;
  else run.end = e.end;
  return null;
}

function quarterClosed(state: State, e: QuarterClosed): string | null {
  const run = state.runs.get(e.run);
  if (!run) return "Unknown run.";
  if (run.closed) return "This run is already closed.";
  if (run.end === undefined || localDateOf(new Date(e.t)) <= run.end) return "The run hasn't ended yet.";
  if (!Number.isInteger(e.done) || !Number.isInteger(e.total) || e.done < 0 || e.done > e.total) return "Impossible counts.";
  if (!isPrestigeTier(e.tier)) return "Unknown tier.";
  run.closed = { id: e.id, done: e.done, total: e.total, tier: e.tier, at: e.t };
  return null;
}

function prestigeSeen(state: State, e: PrestigeSeen): string | null {
  const run = state.runs.get(e.run);
  if (!run) return "Unknown run.";
  if (!run.closed) return "This run isn't closed.";
  if (run.seenAt) return "Already seen.";
  run.seenAt = e.t;
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

// ── objectives ──────────────────────────────────────────────────────────

function objectiveAdded(state: State, e: ObjectiveAdded): string | null {
  const run = state.runs.get(e.run);
  if (!run || !run.courses.has(e.course)) return "Unknown course.";
  if (!e.obj.startsWith(`${e.run}/${e.course}-`)) return "Objective id doesn't match its course.";
  if (state.everObjectiveIds.has(e.obj)) return "That objective id has already been used.";
  if (!KINDS.includes(e.kind)) return "Unknown objective type.";
  if (typeof e.title !== "string" || !e.title.trim()) return "An objective needs a title.";

  const dated = DATED_KINDS.includes(e.kind);
  if (dated !== (e.date !== undefined)) {
    return dated ? "Assignments and exams need a date." : "Only assignments and exams have a date.";
  }
  if (e.date !== undefined) {
    if (!isLocalDate(e.date)) return "Dates must be valid YYYY-MM-DD dates.";
    if (run.end === undefined) {
      // No end yet: assignments may be due whenever; exams wait for an exam week.
      if (e.kind === "exam") return "Set an end date to add exams.";
    } else if (e.kind === "assignment" && (e.date < run.start || e.date > run.end)) {
      return "An assignment's due date must fall within the run.";
    }
    const week = run.end === undefined ? null : examWeek(run.end);
    if (week && e.kind === "exam" && (e.date < week.from || e.date > week.to)) {
      return "An exam's date must fall within exam week.";
    }
  }

  const isProgress = e.kind === "progress";
  if (isProgress !== (e.steps !== undefined)) {
    return isProgress ? "A progress objective needs steps." : "Only progress objectives have steps.";
  }
  if (e.steps !== undefined) {
    if (!Array.isArray(e.steps) || e.steps.length < 2) return "A progress objective needs at least two steps.";
    if (e.steps.some((s) => typeof s !== "string" || !s.trim())) return "Steps can't be empty.";
  }

  let levels: string[] | undefined;
  if (e.levels !== undefined) {
    if (e.kind !== "reading") return "Only readings have levels.";
    if (!Array.isArray(e.levels) || e.levels.length < 1 || e.levels.length > 2) return "A reading has one or two levels.";
    levels = e.levels.map((l) => (typeof l === "string" ? l.trim() : ""));
    if (levels.some((l) => !l)) return "Level names can't be empty.";
  }

  const o: ObjectiveState = {
    id: e.obj,
    run: e.run,
    course: e.course,
    kind: e.kind,
    title: e.title,
    source: "manual",
    stepsDone: e.steps ? e.steps.map(() => false) : [],
    position: levels ? levels.map(() => 0) : [],
    bumps: [],
    bumped: false,
    addedAt: e.t,
  };
  if (e.date !== undefined) o.date = e.date;
  if (e.steps !== undefined) o.steps = [...e.steps];
  if (levels) o.levels = levels;
  state.objectives.set(o.id, o);
  state.everObjectiveIds.add(o.id);
  return null;
}

function objectiveUndone(state: State, e: ObjectiveUndone): string | null {
  const o = state.objectives.get(e.obj);
  if (!o) return "Unknown objective.";
  if (hasProgress(o)) return "Completed work can't be undone.";
  if (!withinUndoWindow(o.addedAt, e.t)) return "The undo window for this objective has passed.";
  state.objectives.delete(o.id);
  return null;
}

function stepCompleted(state: State, e: StepCompleted): string | null {
  const o = state.objectives.get(e.obj);
  if (!o) return "Unknown objective.";
  if (o.kind !== "progress" || !o.steps) return "Only progress objectives have steps.";
  if (o.completed) return "This objective is already complete.";
  if (!Number.isInteger(e.step) || e.step < 0 || e.step >= o.steps.length) return "Unknown step.";
  if (o.stepsDone[e.step]) return "That step is already checked.";
  o.stepsDone[e.step] = true;
  return null;
}

function objectiveCompleted(state: State, e: ObjectiveCompleted): string | null {
  const o = state.objectives.get(e.obj);
  if (!o) return "Unknown objective.";
  if (o.completed) return "This objective is already complete.";
  if (e.tier === "silver") {
    if (o.kind === "exam") return "Exams complete automatically.";
    if (o.kind === "progress" && !o.stepsDone.every(Boolean)) return "Check every step first.";
  } else if (e.tier === "sat") {
    if (o.kind !== "exam" || !o.date) return "Only exams can be marked sat.";
    if (localDateOf(new Date(e.t)) <= o.date) return "The exam date hasn't passed yet.";
  } else {
    return "Unknown completion tier.";
  }
  if (e.evidence !== undefined) {
    if (e.tier !== "silver" || !EVIDENCE_KINDS.includes(o.kind)) return "Only lectures, assignments and labs take evidence.";
    if (typeof e.evidence !== "string" || !e.evidence) return "Evidence needs a file path.";
    // A file already claimed by an earlier completion: keep the silver, drop only the claim.
    if (state.evidenceOwners.has(e.evidence)) {
      o.completed = { tier: e.tier, at: e.t };
      return null;
    }
    state.evidenceOwners.set(e.evidence, o.id);
    o.completed = { tier: e.tier, at: e.t, evidence: e.evidence };
    return null;
  }
  o.completed = { tier: e.tier, at: e.t };
  return null;
}

function readingBumped(state: State, e: ReadingBumped): string | null {
  const o = state.objectives.get(e.obj);
  if (!o) return "Unknown objective.";
  if (o.kind !== "reading" || !o.levels) return "Only readings with levels can be bumped.";
  if (o.completed) return "This reading is finished.";
  if (!Number.isInteger(e.level) || e.level < 0 || e.level >= o.levels.length) return "Unknown level.";
  o.bumps.push({ at: e.t, before: [...o.position] });
  o.position = o.position.map((n, i) => (i < e.level ? n : i === e.level ? n + 1 : 0));
  o.bumped = true;
  return null;
}

function readingBumpUndone(state: State, e: ReadingBumpUndone): string | null {
  const o = state.objectives.get(e.obj);
  if (!o) return "Unknown objective.";
  if (o.completed) return "This reading is finished.";
  const last = o.bumps[o.bumps.length - 1];
  if (!last) return "Nothing to undo.";
  if (!withinUndoWindow(last.at, e.t)) return "The undo window for this bump has passed.";
  o.bumps.pop();
  o.position = last.before;
  return null;
}

// ── helpers ─────────────────────────────────────────────────────────────

function objectivesOfRun(state: State, run: string): ObjectiveState[] {
  return [...state.objectives.values()].filter((o) => o.run === run);
}

function hasProgress(o: ObjectiveState): boolean {
  return o.completed !== undefined || o.stepsDone.some(Boolean) || o.bumped;
}

// ── character ───────────────────────────────────────────────────────────
// Shop rules (level, price, coins, what may be worn) are checked when an action is planned.
// Replay trusts recorded history and checks only its shape, so retuning prices or shelves never
// rewrites the past. Closed runs are already refused at the top of applyEvent.

function characterCreated(state: State, e: CharacterCreated): string | null {
  const run = state.runs.get(e.run);
  if (!run) return "Unknown run.";
  if (run.character) return "This run already has a character.";
  if (e.body !== "male" && e.body !== "female") return "Unknown body.";
  run.character = { body: e.body, look: structuredClone(e.look), createdAt: e.t };
  return null;
}

function characterChanged(state: State, e: CharacterChanged): string | null {
  const run = state.runs.get(e.run);
  if (!run?.character) return "This run has no character yet.";
  run.character.look = structuredClone(e.look);
  return null;
}

function itemBought(state: State, e: ItemBought): string | null {
  const run = state.runs.get(e.run);
  if (!run?.character) return "This run has no character yet.";
  if (run.purchases.has(e.item)) return "Already bought.";
  run.purchases.set(e.item, { price: e.price, at: e.t });
  return null;
}

function purchaseUndone(state: State, e: PurchaseUndone): string | null {
  const run = state.runs.get(e.run);
  const bought = run?.purchases.get(e.item);
  if (!run || !bought) return "Nothing to undo.";
  if (!withinUndoWindow(bought.at, e.t)) return "The undo window for this purchase has passed.";
  run.purchases.delete(e.item);
  const look = run.character?.look;
  if (look) for (const [slot, w] of Object.entries(look.worn)) if (w.item === e.item) delete look.worn[slot];
  return null;
}
