import type { QuestEvent } from "../../src/core/events";
import { formatEvent, parseLog } from "../../src/core/log-format";

test("parseLog skips junk and unknown types", () => {
  const text = [
    '{"id":"e_1","t":"2026-11-16T10:00:00.000Z","type":"course_undone","run":"R","course":"C"}',
    "",
    "not json",
    "[1,2]",
    '{"id":"e_2","type":"course_undone"}',
    '{"id":"e_3","t":"2026-11-16T10:00:00.000Z","type":"purchase"}',
  ].join("\n");
  expect(parseLog(text).map((e) => e.id)).toEqual(["e_1"]);
});

test("parseLog handles CRLF line endings", () => {
  const text = '{"id":"e_1","t":"2026-11-16T10:00:00.000Z","type":"course_undone","run":"R","course":"C"}\r\n';
  expect(parseLog(text)).toHaveLength(1);
});

test("formatEvent puts id, t, type first and round-trips", () => {
  const e = { run: "R", course: "C", type: "course_undone", t: "2026-11-16T10:00:00.000Z", id: "e_1" } as QuestEvent;
  expect(formatEvent(e).startsWith('{"id":"e_1","t":"2026-11-16T10:00:00.000Z","type":"course_undone"')).toBe(true);
  expect(parseLog(formatEvent(e))).toEqual([e]);
});
