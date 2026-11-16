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

test("parseLog drops events with missing or wrong-typed fields", () => {
  const t = "2026-11-16T10:00:00.000Z";
  const lines = [
    { id: "e_1", t, type: "quarter_created" },
    { id: "e_2", t, type: "objective_added", run: "R", course: "C", kind: "lecture", title: "x", source: "manual" },
    { id: "e_3", t, type: "course_added", run: "R", name: "n", folder: "f" },
    { id: "e_4", t, type: "step_completed", obj: "R/C-PRG01", step: "0" },
    { id: "e_5", t, type: "objective_added", obj: "R/C-PRG01", run: "R", course: "C", kind: "progress", title: "x", source: "manual", steps: "a" },
    { id: "e_6", t: "garbage", type: "objective_completed", obj: "R/C-EXM01", tier: "sat" },
    { id: "e_7", t, type: "course_added", run: "R", course: "C", name: "n", folder: "f" },
  ].map((l) => JSON.stringify(l));
  expect(parseLog(lines.join("\n")).map((e) => e.id)).toEqual(["e_7"]);
});

test("parseLog reads quarter_closed and prestige_seen, and checks their field types", () => {
  const text = [
    '{"id":"e_1","t":"2027-01-31T08:00:00.000Z","type":"quarter_closed","run":"R","done":3,"total":4,"tier":0}',
    '{"id":"e_2","t":"2027-01-31T08:01:00.000Z","type":"prestige_seen","run":"R"}',
    '{"id":"e_3","t":"2027-01-31T08:00:00.000Z","type":"quarter_closed","run":"R","done":"3","total":4,"tier":0}',
    '{"id":"e_4","t":"2027-01-31T08:01:00.000Z","type":"prestige_seen"}',
  ].join("\n");
  expect(parseLog(text).map((e) => e.id)).toEqual(["e_1", "e_2"]);
});
