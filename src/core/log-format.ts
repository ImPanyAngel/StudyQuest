import { EVENT_TYPES, type QuestEvent } from "./events";

type FieldType = "string" | "number";
const S: FieldType = "string";
const N: FieldType = "number";

/** Required fields per event type, with their JSON types. */
const REQUIRED: Record<QuestEvent["type"], Record<string, FieldType>> = {
  quarter_created: { run: S, name: S, start: S, end: S },
  quarter_dates_corrected: { run: S, start: S, end: S },
  course_added: { run: S, course: S, name: S, folder: S },
  course_undone: { run: S, course: S },
  objective_added: { obj: S, run: S, course: S, kind: S, title: S, source: S },
  objective_undone: { obj: S },
  step_completed: { obj: S, step: N },
  objective_completed: { obj: S, tier: S },
  quarter_closed: { run: S, done: N, total: N, tier: N },
  prestige_seen: { run: S },
};

function wellFormed(e: Record<string, unknown>, type: QuestEvent["type"]): boolean {
  if (Number.isNaN(Date.parse(e.t as string))) return false;
  for (const [key, want] of Object.entries(REQUIRED[type])) if (typeof e[key] !== want) return false;
  if (type === "objective_added") {
    if (e.date !== undefined && typeof e.date !== "string") return false;
    if (e.steps !== undefined && (!Array.isArray(e.steps) || e.steps.some((x) => typeof x !== "string"))) return false;
  }
  return true;
}

/** One JSON object per line. Anything that isn't a known, well-formed event is skipped. */
export function parseLog(text: string): QuestEvent[] {
  const events: QuestEvent[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const e = value as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.t !== "string" || typeof e.type !== "string") continue;
    if (!EVENT_TYPES.includes(e.type as QuestEvent["type"])) continue;
    if (!wellFormed(e, e.type as QuestEvent["type"])) continue;
    events.push(e as unknown as QuestEvent);
  }
  return events;
}

export function formatEvent(e: QuestEvent): string {
  const { id, t, type, ...rest } = e;
  return JSON.stringify({ id, t, type, ...rest });
}
