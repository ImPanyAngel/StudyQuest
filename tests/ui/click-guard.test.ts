import { armedAfter } from "../../src/ui/click-guard";

test("armedAfter ignores clicks until the delay has passed", () => {
  let t = 1_000;
  const armed = armedAfter(400, () => t);
  expect(armed()).toBe(false);
  t = 1_399;
  expect(armed()).toBe(false);
  t = 1_400;
  expect(armed()).toBe(true);
});
