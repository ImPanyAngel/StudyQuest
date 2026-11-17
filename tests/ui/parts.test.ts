import { markOf, stainLabel } from "../../src/ui/parts";
import type { ObjectiveState } from "../../src/core/state";

const obj = (completed?: ObjectiveState["completed"]): ObjectiveState => ({
  id: "R/C1-LEC01",
  run: "R",
  course: "C1",
  kind: "lecture",
  title: "Lecture 1",
  source: "manual",
  stepsDone: [],
  addedAt: "2026-11-16T10:00:00.000Z",
  ...(completed ? { completed } : {}),
});

test("markOf: tier when complete, else STAIN on a closed run and OPEN on a running one", () => {
  expect(markOf(obj({ tier: "silver", at: "x" }), true)).toEqual({ kind: "silver", text: "SILVER" });
  expect(markOf(obj({ tier: "sat", at: "x" }), false)).toEqual({ kind: "sat", text: "SAT" });
  expect(markOf(obj(), true)).toEqual({ kind: "stain", text: "STAIN" });
  expect(markOf(obj(), false)).toEqual({ kind: "open", text: "OPEN" });
});

test("stainLabel is the same wording everywhere", () => {
  expect([0, 1, 4].map(stainLabel)).toEqual(["no stains", "1 stain", "4 stains"]);
});
