import type { App } from "obsidian";
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

/** SILVER / SAT (GOLD later) when complete; otherwise STAIN on a closed run, OPEN on a running one. */
export function markOf(o: ObjectiveState, closed: boolean): { kind: string; text: string } {
  const kind = o.completed?.tier ?? (closed ? "stain" : "open");
  return { kind, text: kind.toUpperCase() };
}

export function renderMark(parent: HTMLElement, o: ObjectiveState, closed: boolean): void {
  const m = markOf(o, closed);
  parent.createSpan({ cls: `sq-mark is-${m.kind}`, text: m.text });
}

export function stainLabel(n: number): string {
  return n === 0 ? "no stains" : n === 1 ? "1 stain" : `${n} stains`;
}

/**
 * The evidence file's name, opening the file when clicked. Opened through the
 * TFile itself, not a link, so names with #, ^ or [ open the file and not a heading.
 */
export function renderEvidence(parent: HTMLElement, o: ObjectiveState, app: App): void {
  const path = o.completed?.evidence;
  if (!path) return;
  const name = path.split("/").pop() ?? path;
  const file = app.vault.getFileByPath(path);
  if (!file) {
    parent.createSpan({ cls: "sq-evidence is-missing", text: name, attr: { title: `${path} (no longer in the vault)` } });
    return;
  }
  const link = parent.createEl("a", { cls: "sq-evidence", text: name, attr: { title: path, href: "#" } });
  link.addEventListener("click", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    void app.workspace.getLeaf(false).openFile(file);
  });
}
