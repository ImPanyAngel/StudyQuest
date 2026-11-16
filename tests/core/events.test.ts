import { createIdFactory } from "../../src/core/events";

test("id format", () => {
  expect(createIdFactory()(new Date())).toMatch(/^e_[0-9A-HJKMNP-TV-Z]{26}$/);
});

test("ids sort by time", () => {
  const f = createIdFactory();
  expect(f(new Date(1000)) < f(new Date(2000))).toBe(true);
});

test("ids are monotonic within one millisecond", () => {
  const f = createIdFactory(() => 0.999999);
  const now = new Date(5000);
  const a = f(now), b = f(now), c = f(now);
  expect(a < b).toBe(true);
  expect(b < c).toBe(true);
});
