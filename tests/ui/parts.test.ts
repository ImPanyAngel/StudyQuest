import { BADGE_ICONS, badgeLabel, courseBreaks, endDateFrom, markOf, stainLabel } from "../../src/ui/parts";
import type { ObjectiveState } from "../../src/core/state";

const obj = (completed?: ObjectiveState["completed"]): ObjectiveState => ({
  id: "R/C1-LEC01",
  run: "R",
  course: "C1",
  kind: "lecture",
  title: "Lecture 1",
  source: "manual",
  stepsDone: [],
  position: [],
  bumps: [],
  bumped: false,
  addedAt: "2026-11-16T10:00:00.000Z",
  ...(completed ? { completed } : {}),
});

test("markOf: DONE or SAT when complete, else STAIN on a closed run and OPEN on a running one", () => {
  expect(markOf(obj({ tier: "silver", at: "x" }), true)).toEqual({ kind: "done", text: "DONE" });
  expect(markOf(obj({ tier: "sat", at: "x" }), false)).toEqual({ kind: "sat", text: "SAT" });
  expect(markOf(obj(), true)).toEqual({ kind: "stain", text: "STAIN" });
  expect(markOf(obj(), false)).toEqual({ kind: "open", text: "OPEN" });
});

test("stainLabel is the same wording everywhere", () => {
  expect([0, 1, 4].map(stainLabel)).toEqual(["no stains", "1 stain", "4 stains"]);
});

test("badgeLabel names the course for in-run badges; every badge has an icon", () => {
  expect(badgeLabel({ id: "course-complete", name: "Course complete", course: "DSAIT4005" })).toBe("Course complete · DSAIT4005");
  expect(badgeLabel({ id: "tier-5", name: "Tier 5 run" })).toBe("Tier 5 run");
  for (const id of ["course-complete", "lecture-sweep", "first-prestige", "tier-3", "tier-5"] as const) expect(BADGE_ICONS[id]).toEqual(expect.any(String));
});

describe("endDateFrom", () => {
  test("an empty field means no end date", () => {
    expect(endDateFrom("", false)).toEqual({ ok: true, value: undefined });
  });

  test("a full date is the end date", () => {
    expect(endDateFrom("2027-01-30", false)).toEqual({ ok: true, value: "2027-01-30" });
  });

  test("a half-typed date is refused, not read as blank", () => {
    expect(endDateFrom("", true)).toEqual({ ok: false, error: "Finish the End date, or clear it to leave the run without one." });
  });
});

describe("courseBreaks", () => {
  test("marks the first row of each course after the first", () => {
    expect(courseBreaks(["C1", "C1", "C2", "C3", "C3"])).toEqual([false, false, true, true, false]);
  });

  test("no breaks for one course or none", () => {
    expect(courseBreaks(["C1", "C1"])).toEqual([false, false]);
    expect(courseBreaks([])).toEqual([]);
  });
});
