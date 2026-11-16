import { isCourseCode, objectiveId, runIdFromName } from "../../src/core/ids";

test("runIdFromName", () => {
  expect(runIdFromName("2026-27 Q2")).toEqual({ ok: true, value: "2026-27-Q2" });
  expect(runIdFromName("  Thesis  2027 / Q1-3 ")).toEqual({ ok: true, value: "Thesis-2027--Q1-3" });
  expect(runIdFromName("  ").ok).toBe(false);
  expect(runIdFromName("///").ok).toBe(false);
});

test("objectiveId", () => {
  expect(objectiveId("2026-27-Q2", "DSAIT4000", "lecture", 5)).toBe("2026-27-Q2/DSAIT4000-LEC05");
  expect(objectiveId("R", "C", "exam", 123)).toBe("R/C-EXM123");
  expect(objectiveId("R", "C", "progress", 1)).toBe("R/C-PRG01");
});

test("isCourseCode", () => {
  expect(isCourseCode("DSAIT4000")).toBe(true);
  expect(isCourseCode("DS-1")).toBe(false);
  expect(isCourseCode("")).toBe(false);
});
