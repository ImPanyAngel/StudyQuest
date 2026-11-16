import { EVENT_TYPES, type QuestEvent } from "./events";

/** One JSON object per line. Anything that isn't a known event is skipped. */
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
    events.push(e as unknown as QuestEvent);
  }
  return events;
}

export function formatEvent(e: QuestEvent): string {
  const { id, t, type, ...rest } = e;
  return JSON.stringify({ id, t, type, ...rest });
}
