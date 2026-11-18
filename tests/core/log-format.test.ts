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

test("parseLog reads levels, evidence and reading events, and checks their field types", () => {
  const t = "2026-11-18T09:00:00.000Z";
  const add = { t, type: "objective_added", obj: "R/C-RDG01", run: "R", course: "C", kind: "reading", title: "B", source: "manual" };
  const lines = [
    { id: "ok1", ...add, levels: ["Course", "Chapter"] },
    { id: "ok2", t, type: "objective_completed", obj: "R/C-LEC01", tier: "silver", evidence: "A/B.md" },
    { id: "ok3", t, type: "reading_bumped", obj: "R/C-RDG01", level: 1 },
    { id: "ok4", t, type: "reading_bump_undone", obj: "R/C-RDG01" },
    { id: "bad1", ...add, levels: "Chapter" },
    { id: "bad2", ...add, levels: [1] },
    { id: "bad3", t, type: "objective_completed", obj: "R/C-LEC01", tier: "silver", evidence: 3 },
    { id: "bad4", t, type: "reading_bumped", obj: "R/C-RDG01", level: "1" },
    { id: "bad5", t, type: "reading_bump_undone" },
  ].map((l) => JSON.stringify(l));
  expect(parseLog(lines.join("\n")).map((e) => e.id)).toEqual(["ok1", "ok2", "ok3", "ok4"]);
});

test("parseLog reads character events and checks their shapes", () => {
  const t = "2026-11-16T10:00:00.000Z";
  const look = { skin: "light", head: "h", face: "f", worn: { hat: { item: "x", color: "red" } } };
  const lines = [
    { id: "e_1", t, type: "character_created", run: "R", body: "male", look },
    { id: "e_2", t, type: "character_changed", run: "R", look },
    { id: "e_3", t, type: "item_bought", run: "R", item: "x", price: 40 },
    { id: "e_4", t, type: "purchase_undone", run: "R", item: "x" },
    { id: "e_5", t, type: "character_changed", run: "R", look: "fancy" },
    { id: "e_6", t, type: "character_changed", run: "R", look: { ...look, worn: [] } },
    { id: "e_7", t, type: "character_changed", run: "R", look: { ...look, worn: { hat: { color: "red" } } } },
    { id: "e_8", t, type: "item_bought", run: "R", item: "x", price: "40" },
    { id: "e_9", t, type: "item_bought", run: "R", item: "x", price: -1 },
    { id: "e_10", t, type: "character_created", run: "R", body: "male", look: { ...look, skin: 3 } },
  ];
  expect(parseLog(lines.map((l) => JSON.stringify(l)).join("\n")).map((e) => e.id)).toEqual(["e_1", "e_2", "e_3", "e_4"]);
});
