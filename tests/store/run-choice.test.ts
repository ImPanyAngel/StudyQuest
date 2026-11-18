import { RunChoice } from "../../src/store/run-choice";

test("starts at the remembered id", () => {
  expect(new RunChoice("A", () => {}).get()).toBe("A");
  expect(new RunChoice(undefined, () => {}).get()).toBeUndefined();
});

test("set saves and notifies once; the same id again does nothing", () => {
  const saved: string[] = [];
  const c = new RunChoice("A", (id) => saved.push(id));
  let calls = 0;
  c.subscribe(() => calls++);
  c.set("B");
  expect([c.get(), saved, calls]).toEqual(["B", ["B"], 1]);
  c.set("B");
  expect([saved, calls]).toEqual([["B"], 1]);
});

test("an unsubscribed listener isn't called", () => {
  const c = new RunChoice("A", () => {});
  let calls = 0;
  const off = c.subscribe(() => calls++);
  off();
  c.set("B");
  expect(calls).toBe(0);
});
