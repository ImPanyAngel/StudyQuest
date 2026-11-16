import type { LocalDate } from "./dates";
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
  end: LocalDate;
  createdAt: string;
  /** Active courses by code, in the order added. */
  courses: Map<string, CourseState>;
  /** Set by `quarter_closed`: the frozen result. */
  closed?: { done: number; total: number; tier: PrestigeTier; at: string };
  /** Set by `prestige_seen`. */
  seenAt?: string;
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
  addedAt: string;
  completed?: { tier: Tier; at: string };
}

export interface State {
  /** Runs in creation order. */
  runs: Map<string, RunState>;
  /** Active objectives in add order. */
  objectives: Map<string, ObjectiveState>;
  /** Every objective id ever added, including undone ones. Never shrinks. */
  everObjectiveIds: Set<string>;
}

export function emptyState(): State {
  return { runs: new Map(), objectives: new Map(), everObjectiveIds: new Set() };
}
