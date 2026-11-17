import { planAction, type Action } from "../../src/core/actions";
import { bumpDeadline, canUndoBump, canUndoObjective, evidenceOwner, objectiveLabel } from "../../src/core/derive";
import { createIdFactory, type QuestEvent } from "../../src/core/events";
import { replay } from "../../src/core/replay";
import { Q2, T0, at, ev } from "./fixtures";

const R = Q2.run;
const ids = createIdFactory();
const min = (m: number) => new Date(T0 + m * 60_000);
const start = (): QuestEvent[] => [ev.created(), ev.course(R, "C1")];
const plan = (log: QuestEvent[], a: Action, now = min(10)) => planAction(replay(log), a, now, ids);

test("objectiveLabel shows reading positions", () => {
  const boot = ev.objective(R, "C1", "reading", 1, at(2), { title: "Boot.dev", levels: ["Course", "Chapter"] });
  const book = ev.objective(R, "C1", "reading", 2, at(2), { title: "Thinking in Systems", levels: ["Chapter"] });
  const legacy = ev.objective(R, "C1", "reading", 3, at(2), { title: "Old book" });
  const lec = ev.objective(R, "C1", "lecture", 1, at(2), { title: "Lecture 1" });
  const s = replay([...start(), boot, book, legacy, lec, ev.bump(boot.obj, 0, at(3)), ...[4, 5, 6, 7].map((m) => ev.bump(boot.obj, 1, at(m)))]);
  expect(objectiveLabel(s.objectives.get(boot.obj)!)).toBe("Boot.dev [Course: 1; Chapter: 4]");
  expect(objectiveLabel(s.objectives.get(book.obj)!)).toBe("Thinking in Systems [Chapter: 0]");
  expect(objectiveLabel(s.objectives.get(legacy.obj)!)).toBe("Old book");
  expect(objectiveLabel(s.objectives.get(lec.obj)!)).toBe("Lecture 1");
});

test("completeWithEvidence writes a silver with the path", () => {
  const l = ev.objective(R, "C1", "lecture", 1);
  const r = plan([...start(), l], { type: "completeWithEvidence", obj: l.obj, path: "C1/Lecture 1.md" });
  expect(r.ok && r.value).toMatchObject([{ type: "objective_completed", obj: l.obj, tier: "silver", evidence: "C1/Lecture 1.md" }]);
});

test("completeWithEvidence refusals", () => {
  const a = ev.objective(R, "C1", "lecture", 1, at(2), { title: "Lecture 1" });
  const b = ev.objective(R, "C1", "lecture", 2);
  const rd = ev.objective(R, "C1", "reading", 1, at(2), { levels: ["Chapter"] });
  const log = [...start(), a, b, rd, ev.completed(a.obj, "silver", at(3), "X.md")];
  expect(plan(log, { type: "completeWithEvidence", obj: b.obj, path: "X.md" })).toEqual({ ok: false, error: "That file already proves C1 · Lecture 1." });
  expect(plan(log, { type: "completeWithEvidence", obj: b.obj, path: "  " }).ok).toBe(false);
  expect(plan(log, { type: "completeWithEvidence", obj: rd.obj, path: "Y.md" }).ok).toBe(false);
  expect(evidenceOwner(replay(log), "X.md")!.id).toBe(a.obj);
  expect(evidenceOwner(replay(log), "Y.md")).toBeUndefined();
});

test("selfCheck is refused for evidence kinds, allowed for readings", () => {
  const l = ev.objective(R, "C1", "lecture", 1);
  const rd = ev.objective(R, "C1", "reading", 1, at(2), { levels: ["Chapter"] });
  expect(plan([...start(), l], { type: "selfCheck", obj: l.obj })).toEqual({ ok: false, error: "Pick the file that proves it." });
  expect(plan([...start(), rd], { type: "selfCheck", obj: rd.obj }).ok).toBe(true);
});

test("addObjective: reading levels are trimmed and need one or two; progress and bulk readings refused", () => {
  const add = (extra: Partial<Extract<Action, { type: "addObjective" }>>) =>
    plan(start(), { type: "addObjective", run: R, course: "C1", kind: "reading", title: "Boot.dev", ...extra });
  const r = add({ levels: ["Course", "", " Chapter "] });
  expect(r.ok && r.value[0]).toMatchObject({ levels: ["Course", "Chapter"] });
  expect(add({ levels: ["a", "b", "c"] }).ok).toBe(false);
  expect(add({ levels: [" "] }).ok).toBe(false);
  expect(add({}).ok).toBe(false);
  expect(add({ kind: "progress", steps: ["a", "b"] })).toEqual({ ok: false, error: "Progress objectives are no longer available." });
  expect(plan(start(), { type: "bulkAddObjectives", run: R, course: "C1", kind: "reading", prefix: "", from: 1, to: 3 })).toEqual({
    ok: false,
    error: "Bulk add works for lectures and labs.",
  });
});

test("bump, undo and their windows", () => {
  const rd = ev.objective(R, "C1", "reading", 1, at(2), { levels: ["Chapter"] });
  const b = plan([...start(), rd], { type: "bumpReading", obj: rd.obj, level: 0 }, min(3));
  expect(b.ok && b.value).toMatchObject([{ type: "reading_bumped", level: 0 }]);
  const log = [...start(), rd, ...(b.ok ? b.value : [])];
  const s = replay(log);
  const o = s.objectives.get(rd.obj)!;
  expect(canUndoBump(o, min(33))).toBe(true);
  expect(canUndoBump(o, min(34))).toBe(false);
  expect(bumpDeadline(o)!.toISOString()).toBe(min(33).toISOString());
  expect(plan(log, { type: "undoBump", obj: rd.obj }, min(4)).ok).toBe(true);
  const undone = replay([...log, ev.bumpUndone(rd.obj, min(4).toISOString())]);
  expect(canUndoObjective(undone.objectives.get(rd.obj)!, min(5))).toBe(false);
  expect(bumpDeadline(undone.objectives.get(rd.obj)!)).toBeNull();
});
