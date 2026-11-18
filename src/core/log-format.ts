import { EVENT_TYPES, eventRun, type QuestEvent } from "./events";

type FieldType = "string" | "number" | "object";
const S: FieldType = "string";
const N: FieldType = "number";
const O: FieldType = "object";

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
  reading_bumped: { obj: S, level: N },
  reading_bump_undone: { obj: S },
  character_created: { run: S, body: S, look: O },
  character_changed: { run: S, look: O },
  item_bought: { run: S, item: S, price: N },
  purchase_undone: { run: S, item: S },
};

function wellFormed(e: Record<string, unknown>, type: QuestEvent["type"]): boolean {
  if (Number.isNaN(Date.parse(e.t as string))) return false;
  for (const [key, want] of Object.entries(REQUIRED[type])) if (typeof e[key] !== want) return false;
  if (type === "objective_added") {
    if (e.date !== undefined && typeof e.date !== "string") return false;
    if (e.steps !== undefined && !isStringArray(e.steps)) return false;
    if (e.levels !== undefined && !isStringArray(e.levels)) return false;
  }
  if (type === "objective_completed" && e.evidence !== undefined && typeof e.evidence !== "string") return false;
  if ((type === "character_created" || type === "character_changed") && !isLook(e.look)) return false;
  if (type === "item_bought" && !(Number.isFinite(e.price) && (e.price as number) >= 0)) return false;
  return true;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const optString = (v: unknown) => v === undefined || typeof v === "string";

/** A look's shape: skin, head and face strings, optional eyes, and worn items each naming their item. */
function isLook(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  if (typeof v.skin !== "string" || typeof v.head !== "string" || typeof v.face !== "string" || !optString(v.eyes)) return false;
  if (!isPlainObject(v.worn)) return false;
  return Object.values(v.worn).every((w) => isPlainObject(w) && typeof w.item === "string" && optString(w.color) && optString(w.color2));
}

function isStringArray(v: unknown): boolean {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
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

/**
 * One file's events in file order. Below a run's accepted close (its id is in
 * `acceptedCloses`), that run's events other than prestige_seen are dropped
 * whatever their timestamp, so a line added later with an older time can't
 * change a frozen run. A close line replay rejected cuts nothing.
 */
export function dropAfterClose(events: QuestEvent[], acceptedCloses: Set<string>): QuestEvent[] {
  const closed = new Set<string>();
  return events.filter((e) => {
    if (e.type === "prestige_seen") return true;
    const run = eventRun(e);
    if (closed.has(run)) return false;
    if (e.type === "quarter_closed" && acceptedCloses.has(e.id)) closed.add(run);
    return true;
  });
}
