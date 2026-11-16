import { formatShort } from "../core/dates";
import type { Kind } from "../core/events";
import type { ObjectiveState } from "../core/state";

export type Route = { tab: "home" } | { tab: "setup" } | { tab: "course"; run: string; course: string };
export type Navigate = (r: Route) => void;

export const KIND_LABELS: Record<Kind, string> = {
  lecture: "Lecture",
  assignment: "Assignment",
  lab: "Lab",
  reading: "Reading",
  progress: "Progress",
  exam: "Exam",
};

export function renderTypeTag(parent: HTMLElement, kind: Kind): void {
  parent.createSpan({ cls: "sq-tag", text: KIND_LABELS[kind].toUpperCase() });
}

/** Date (or "overdue") and step count, shared by Home and the course view. */
export function renderObjectiveMeta(parent: HTMLElement, o: ObjectiveState, overdue = false): void {
  if (o.steps) parent.createSpan({ cls: "sq-steps", text: `${o.stepsDone.filter(Boolean).length}/${o.steps.length}` });
  if (o.date) {
    const label = o.kind === "exam" ? "exam" : overdue ? "overdue · due" : "due";
    parent.createSpan({ cls: "sq-date", text: `${label} ${formatShort(o.date)}` });
  }
}
