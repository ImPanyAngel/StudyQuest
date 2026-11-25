import type { LocalDate } from "./dates";
import type { Look } from "./character";
import type { Kind, Tier } from "./events";
import type { PrestigeTier } from "./prestige";

export interface CourseState {
  code: string;
  name: string;
  folder: string;
  addedAt: string;
}

export interface RunState {
  id: string;
  name: string;
  start: LocalDate;
  /** Absent while the end date isn't known: the run can't end, close or hold exams. */
  end?: LocalDate;
  createdAt: string;
  /** When the dates' 30-minute window started: creation, or when a blank end was first set. */
  datesSetAt: string;
  /** Active courses by code, in the order added. */
  courses: Map<string, CourseState>;
  /** Set by `quarter_closed`: the frozen result. */
  closed?: { id: string; done: number; total: number; tier: PrestigeTier; at: string };
  /** Set by `prestige_seen`. */
  seenAt?: string;
  /** Set by `character_created`; the look changes with `character_changed`. */
  character?: { body: "male" | "female"; look: Look; createdAt: string };
  /** Live purchases (not undone): item id → what was paid and when. */
  purchases: Map<string, { price: number; at: string }>;
}

export interface ObjectiveState {
  id: string;
  run: string;
  course: string;
  kind: Kind;
  title: string;
  source: "manual";
  date?: LocalDate;
  steps?: string[];
  stepsDone: boolean[];
  /** Readings: level names (absent on readings from before phase 3). */
  levels?: string[];
  /** Readings: number per level; [] without levels. */
  position: number[];
  /** Readings: bumps not yet undone, newest last, with the position before each. */
  bumps: { at: string; before: number[] }[];
  /** True once ever bumped; ends the objective's and course's undo windows for good. */
  bumped: boolean;
  addedAt: string;
  completed?: { tier: Tier; at: string; evidence?: string };
}

export interface State {
  /** Runs in creation order. */
  runs: Map<string, RunState>;
  /** Active objectives in add order. */
  objectives: Map<string, ObjectiveState>;
  /** Every objective id ever added, including undone ones. Never shrinks. */
  everObjectiveIds: Set<string>;
  /** Evidence path → the objective whose completion owns it. */
  evidenceOwners: Map<string, string>;
}

export function emptyState(): State {
  return { runs: new Map(), objectives: new Map(), everObjectiveIds: new Set(), evidenceOwners: new Map() };
}
