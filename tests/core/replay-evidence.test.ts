import { dropAfterClose } from "../../src/core/log-format";
import { replay } from "../../src/core/replay";
import { Q2, at, ev } from "./fixtures";

const R = Q2.run;
const start = () => [ev.created(), ev.course(R, "C1")];

describe("evidence", () => {
  test("a second claim on the same file stays silver but without evidence", () => {
    const a = ev.objective(R, "C1", "lecture", 1);
    const b = ev.objective(R, "C1", "lecture", 2);
    const s = replay([...start(), a, b, ev.completed(a.obj, "silver", at(3), "C1/L.md"), ev.completed(b.obj, "silver", at(4), "C1/L.md")]);
    expect(s.objectives.get(a.obj)!.completed).toMatchObject({ tier: "silver", evidence: "C1/L.md" });
    expect(s.objectives.get(b.obj)!.completed).toMatchObject({ tier: "silver" });
    expect(s.objectives.get(b.obj)!.completed!.evidence).toBeUndefined();
    expect(s.evidenceOwners.get("C1/L.md")).toBe(a.obj);
  });

  test("ownership spans runs, including a closed one", () => {
    const old = ev.created("Old", "2026-10-01", "2026-10-15", at(0));
    const oc = ev.course("Old", "C1", at(1));
    const ol = ev.objective("Old", "C1", "lecture", 1, at(2));
    const l = ev.objective(R, "C1", "lecture", 1);
    const s = replay([
      old,
      oc,
      ol,
      ev.completed(ol.obj, "silver", at(3), "X.md"),
      ev.closed("Old", 1, 1, 5, at(4)),
      ...start(),
      l,
      ev.completed(l.obj, "silver", at(5), "X.md"),
    ]);
    expect(s.evidenceOwners.get("X.md")).toBe(ol.obj);
    expect(s.objectives.get(ol.obj)!.completed!.evidence).toBe("X.md");
    expect(s.objectives.get(l.obj)!.completed!.evidence).toBeUndefined();
  });

  test("evidence on a reading, an exam, a sat, or empty is rejected", () => {
    const r = ev.objective(R, "C1", "reading", 1, at(2), { levels: ["Chapter"] });
    const l = ev.objective(R, "C1", "lecture", 1);
    const x = ev.objective(R, "C1", "exam", 1, at(2), { date: "2027-01-27" });
    const s = replay([
      ...start(),
      r,
      l,
      x,
      ev.completed(r.obj, "silver", at(3), "R.md"),
      ev.completed(l.obj, "silver", at(3), ""),
      ev.completed(x.obj, "sat", "2027-01-28T08:00:00.000Z", "X.md"),
    ]);
    expect(s.objectives.get(r.obj)!.completed).toBeUndefined();
    expect(s.objectives.get(l.obj)!.completed).toBeUndefined();
    expect(s.objectives.get(x.obj)!.completed).toBeUndefined();
    expect(s.evidenceOwners.size).toBe(0);
  });

  test("phase 1 history replays unchanged: silver without evidence, legacy reading, progress", () => {
    const l = ev.objective(R, "C1", "lecture", 1);
    const r = ev.objective(R, "C1", "reading", 1);
    const p = ev.objective(R, "C1", "progress", 1, at(2), { steps: ["a", "b"] });
    const s = replay([
      ...start(),
      l,
      r,
      p,
      ev.completed(l.obj, "silver", at(3)),
      ev.completed(r.obj, "silver", at(3)),
      ev.step(p.obj, 0, at(3)),
      ev.step(p.obj, 1, at(4)),
      ev.completed(p.obj, "silver", at(4)),
    ]);
    for (const e of [l, r, p]) {
      expect(s.objectives.get(e.obj)!.completed).toMatchObject({ tier: "silver" });
      expect(s.objectives.get(e.obj)!.completed!.evidence).toBeUndefined();
    }
    expect(s.objectives.get(r.obj)!.levels).toBeUndefined();
    expect(s.objectives.get(r.obj)!.position).toEqual([]);
  });
});

describe("reading levels and bumps", () => {
  const reading = () => ev.objective(R, "C1", "reading", 1, at(2), { levels: ["Course", "Chapter"] });

  test("levels start at zero; bad levels are rejected", () => {
    const ok = reading();
    const s = replay([...start(), ok]);
    expect(s.objectives.get(ok.obj)!.position).toEqual([0, 0]);
    for (const bad of [
      ev.objective(R, "C1", "lecture", 1, at(2), { levels: ["Chapter"] }),
      ev.objective(R, "C1", "reading", 2, at(2), { levels: [] }),
      ev.objective(R, "C1", "reading", 3, at(2), { levels: ["a", "b", "c"] }),
      ev.objective(R, "C1", "reading", 4, at(2), { levels: [" "] }),
    ]) {
      expect(replay([...start(), bad]).objectives.has(bad.obj)).toBe(false);
    }
  });

  test("bumping resets lower levels; undo restores the exact prior position", () => {
    const r = reading();
    const s = replay([...start(), r, ev.bump(r.obj, 1, at(3)), ev.bump(r.obj, 1, at(4)), ev.bump(r.obj, 0, at(5))]);
    expect(s.objectives.get(r.obj)!.position).toEqual([1, 0]);
    const u = replay([...start(), r, ev.bump(r.obj, 1, at(3)), ev.bump(r.obj, 1, at(4)), ev.bump(r.obj, 0, at(5)), ev.bumpUndone(r.obj, at(6))]);
    expect(u.objectives.get(r.obj)!.position).toEqual([0, 2]);
  });

  test("undo window is 30 minutes after the bump", () => {
    const r = reading();
    const b = ev.bump(r.obj, 1, at(3));
    expect(replay([...start(), r, b, ev.bumpUndone(r.obj, at(33))]).objectives.get(r.obj)!.position).toEqual([0, 0]);
    expect(replay([...start(), r, b, ev.bumpUndone(r.obj, at(34))]).objectives.get(r.obj)!.position).toEqual([0, 1]);
  });

  test("two undos walk back two bumps; a third is rejected", () => {
    const r = reading();
    const s = replay([
      ...start(),
      r,
      ev.bump(r.obj, 1, at(3)),
      ev.bump(r.obj, 1, at(4)),
      ev.bumpUndone(r.obj, at(5)),
      ev.bumpUndone(r.obj, at(6)),
      ev.bumpUndone(r.obj, at(7)),
    ]);
    expect(s.objectives.get(r.obj)!.position).toEqual([0, 0]);
    expect(s.objectives.get(r.obj)!.bumps).toEqual([]);
  });

  test("bumps on a legacy reading, a lecture, a finished reading, or out of range are rejected", () => {
    const legacy = ev.objective(R, "C1", "reading", 1);
    const l = ev.objective(R, "C1", "lecture", 1);
    const r = ev.objective(R, "C1", "reading", 2, at(2), { levels: ["Course", "Chapter"] });
    const s = replay([
      ...start(),
      legacy,
      l,
      r,
      ev.bump(legacy.obj, 0, at(3)),
      ev.bump(l.obj, 0, at(3)),
      ev.bump(r.obj, 2, at(3)),
      ev.bump(r.obj, 0.5, at(3)),
      ev.completed(r.obj, "silver", at(4)),
      ev.bump(r.obj, 0, at(5)),
    ]);
    expect(s.objectives.get(legacy.obj)!.position).toEqual([]);
    expect(s.objectives.get(l.obj)!.bumped).toBe(false);
    expect(s.objectives.get(r.obj)!.position).toEqual([0, 0]);
  });

  test("an undone bump still ends the reading's and the course's undo windows", () => {
    const r = reading();
    const s = replay([
      ...start(),
      r,
      ev.bump(r.obj, 1, at(3)),
      ev.bumpUndone(r.obj, at(4)),
      ev.objectiveUndone(r.obj, at(5)),
      ev.courseUndone(R, "C1", at(5)),
    ]);
    expect(s.objectives.has(r.obj)).toBe(true);
    expect(s.runs.get(R)!.courses.has("C1")).toBe(true);
  });

  test("bumps on a closed run are ignored", () => {
    const old = ev.created("Old", "2026-10-01", "2026-10-15", at(0));
    const oc = ev.course("Old", "C1", at(1));
    const r = ev.objective("Old", "C1", "reading", 1, at(2), { levels: ["Chapter"] });
    const s = replay([old, oc, r, ev.closed("Old", 0, 1, 0, at(3)), ev.bump(r.obj, 0, at(4))]);
    expect(s.objectives.get(r.obj)!.position).toEqual([0]);
  });
});

test("undo after a reading is finished is rejected", () => {
  const r = ev.objective(R, "C1", "reading", 1, at(2), { levels: ["Chapter"] });
  const s = replay([...start(), r, ev.bump(r.obj, 0, at(3)), ev.completed(r.obj, "silver", at(4)), ev.bumpUndone(r.obj, at(5))]);
  expect(s.objectives.get(r.obj)!.position).toEqual([1]);
});

test("a backdated bump below a run's close is dropped from its file", () => {
  const old = ev.created("Old", "2026-10-01", "2026-10-15", at(0));
  const oc = ev.course("Old", "C1", at(1));
  const r = ev.objective("Old", "C1", "reading", 1, at(2), { levels: ["Chapter"] });
  const close = ev.closed("Old", 0, 1, 0, at(5));
  const bump = ev.bump(r.obj, 0, at(3)); // earlier than the close, but written below it
  expect(dropAfterClose([old, oc, r, close, bump], new Set([close.id]))).toEqual([old, oc, r, close]);
});
