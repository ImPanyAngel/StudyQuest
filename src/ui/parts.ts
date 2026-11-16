import { formatShort } from "../core/dates";
import { KIND_NAMES, type Kind } from "../core/events";
import type { ObjectiveState } from "../core/state";

export type Route =
  | { tab: "home" }
  | { tab: "setup" }
  | { tab: "course"; run: string; course: string }
  | { tab: "hall" }
  | { tab: "run"; run: string };
export type Navigate = (r: Route) => void;

export const KIND_LABELS: Record<Kind, string> = KIND_NAMES;

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

/** The placeholder character until phase 6. */
export function renderSprite(parent: HTMLElement): void {
  const sprite = parent.createDiv({ cls: "sq-sprite" });
  for (const part of ["head", "body", "leg-l", "leg-r"]) sprite.createDiv({ cls: `sq-sprite-${part}` });
}

/** SILVER / SAT (GOLD later) when complete; otherwise STAIN on a closed run, open on a running one. */
export function renderMark(parent: HTMLElement, o: ObjectiveState, closed: boolean): void {
  const tier = o.completed?.tier;
  const kind = tier ?? (closed ? "stain" : "open");
  parent.createSpan({ cls: `sq-mark is-${kind}`, text: kind === "open" ? "open" : kind.toUpperCase() });
}
