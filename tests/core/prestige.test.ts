import { tierFor, tierLabel } from "../../src/core/prestige";

test("tierFor boundaries", () => {
  expect([null, 0, 74, 75, 84, 85, 89, 90, 94, 95, 99, 100].map(tierFor)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
});

test("tierLabel", () => {
  expect(tierLabel(0)).toBe("Unranked");
  expect(tierLabel(3)).toBe("Tier 3");
  expect(tierLabel(5)).toBe("Tier 5");
});
