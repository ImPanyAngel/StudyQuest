import { formatShort } from "../core/dates";
import { KIND_NAMES, type Kind } from "../core/events";
import type { Badge, RunRewards } from "../core/rewards";
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

/** DONE (stored as "silver") or SAT when complete; otherwise STAIN on a closed run, OPEN on a running one. */
export function markOf(o: ObjectiveState, closed: boolean): { kind: string; text: string } {
  const tier = o.completed?.tier;
  const kind = tier === "silver" ? "done" : (tier ?? (closed ? "stain" : "open"));
  return { kind, text: kind.toUpperCase() };
}

export function renderMark(parent: HTMLElement, o: ObjectiveState, closed: boolean): void {
  const m = markOf(o, closed);
  parent.createSpan({ cls: `sq-mark is-${m.kind}`, text: m.text });
}

export function stainLabel(n: number): string {
  return n === 0 ? "no stains" : n === 1 ? "1 stain" : `${n} stains`;
}

/** "Level N", coins, and the XP bar toward the next level. */
export function renderLevel(parent: HTMLElement, r: RunRewards): void {
  const box = parent.createDiv({ cls: "sq-level" });
  const line = box.createDiv({ cls: "sq-level-line" });
  line.createSpan({ cls: "sq-level-n", text: `Level ${r.level.level}` });
  line.createSpan({ cls: "sq-coins", text: `${r.coins} coins` });
  const bar = box.createDiv({ cls: "sq-xp-bar" });
  bar.setAttr("title", `${r.level.xpIntoLevel} / ${r.level.xpForNextLevel} XP to level ${r.level.level + 1}`);
  bar.createSpan({ cls: "sq-xp-fill" }).style.width = `${(100 * r.level.xpIntoLevel) / r.level.xpForNextLevel}%`;
}

/** Badge chips; permanent ones (no course) in gold. The line keeps its height when empty. */
export function renderBadges(parent: HTMLElement, badges: Badge[]): void {
  const line = parent.createDiv({ cls: "sq-badges" });
  for (const b of badges) {
    line.createSpan({ cls: b.course ? "sq-badge" : "sq-badge is-permanent", text: b.course ? `${b.name} · ${b.course}` : b.name });
  }
}
