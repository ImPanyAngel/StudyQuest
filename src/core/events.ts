import type { LocalDate } from "./dates";

export type Kind = "lecture" | "assignment" | "lab" | "reading" | "progress" | "exam";
export const KINDS: Kind[] = ["lecture", "assignment", "lab", "reading", "progress", "exam"];
export const DATED_KINDS: Kind[] = ["assignment", "exam"];
export const BULK_KINDS: Kind[] = ["lecture", "lab", "reading"];
export const KIND_NAMES: Record<Kind, string> = {
  lecture: "Lecture",
  assignment: "Assignment",
  lab: "Lab",
  reading: "Reading",
  progress: "Progress",
  exam: "Exam",
};

/** Gold arrives in phase 4. */
export type Tier = "silver" | "sat";

interface Base {
  id: string;
  /** ISO 8601 UTC. */
  t: string;
}

export interface QuarterCreated extends Base {
  type: "quarter_created";
  run: string;
  name: string;
  start: LocalDate;
  end: LocalDate;
}

export interface QuarterDatesCorrected extends Base {
  type: "quarter_dates_corrected";
  run: string;
  start: LocalDate;
  end: LocalDate;
}

export interface CourseAdded extends Base {
  type: "course_added";
  run: string;
  course: string;
  name: string;
  folder: string;
}

export interface CourseUndone extends Base {
  type: "course_undone";
  run: string;
  course: string;
}

export interface ObjectiveAdded extends Base {
  type: "objective_added";
  obj: string;
  run: string;
  course: string;
  kind: Kind;
  title: string;
  source: "manual";
  date?: LocalDate;
  steps?: string[];
}

export interface ObjectiveUndone extends Base {
  type: "objective_undone";
  obj: string;
}

export interface StepCompleted extends Base {
  type: "step_completed";
  obj: string;
  step: number;
}

export interface ObjectiveCompleted extends Base {
  type: "objective_completed";
  obj: string;
  tier: Tier;
}

export interface QuarterClosed extends Base {
  type: "quarter_closed";
  run: string;
  done: number;
  total: number;
  tier: number;
}

export interface PrestigeSeen extends Base {
  type: "prestige_seen";
  run: string;
}

export type QuestEvent =
  | QuarterCreated
  | QuarterDatesCorrected
  | CourseAdded
  | CourseUndone
  | ObjectiveAdded
  | ObjectiveUndone
  | StepCompleted
  | ObjectiveCompleted
  | QuarterClosed
  | PrestigeSeen;

export const EVENT_TYPES: QuestEvent["type"][] = [
  "quarter_created",
  "quarter_dates_corrected",
  "course_added",
  "course_undone",
  "objective_added",
  "objective_undone",
  "step_completed",
  "objective_completed",
  "quarter_closed",
  "prestige_seen",
];

/** The run an event belongs to. Objective ids carry their run before the `/`. */
export function eventRun(e: QuestEvent): string {
  return "run" in e ? e.run : e.obj.split("/")[0];
}

export type IdFactory = (now: Date) => string;

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * ULID ids (`e_` + 10 time chars + 16 random chars), monotonic within one
 * millisecond: a repeat millisecond increments the previous random part.
 * The first random digit is kept below 16 so the increment can't overflow.
 */
export function createIdFactory(random: () => number = Math.random): IdFactory {
  let lastMs = -1;
  let lastRand: number[] = [];
  return (now: Date) => {
    const ms = now.getTime();
    if (ms === lastMs) {
      lastRand = increment(lastRand);
    } else {
      lastMs = ms;
      lastRand = Array.from({ length: 16 }, (_, i) => Math.floor(random() * (i === 0 ? 16 : 32)));
    }
    return "e_" + encodeTime(ms) + lastRand.map((d) => CROCKFORD[d]).join("");
  };
}

function encodeTime(ms: number): string {
  let out = "";
  for (let i = 0; i < 10; i++) {
    out = CROCKFORD[ms % 32] + out;
    ms = Math.floor(ms / 32);
  }
  return out;
}

function increment(digits: number[]): number[] {
  const next = [...digits];
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i] < 31) {
      next[i]++;
      return next;
    }
    next[i] = 0;
  }
  return next;
}
