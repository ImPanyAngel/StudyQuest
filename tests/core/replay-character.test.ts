import { replay } from "../../src/core/replay";
import { LOOK, Q2, at, ev } from "./fixtures";

const R = Q2.run;
const HAT = "headwear/hats/caps/hat_cap_leather";
const withHat = { ...LOOK, worn: { ...LOOK.worn, hat: { item: HAT } } };

test("a run gets one character; a second, a closed run or an unknown body is rejected", () => {
  const s = replay([ev.created(), ev.character(R, "male"), ev.character(R, "female", LOOK, at(3))]);
  expect(s.runs.get(R)!.character).toMatchObject({ body: "male", look: LOOK, createdAt: at(2) });
  expect(replay([ev.created(), ev.character(R, "teen")]).runs.get(R)!.character).toBeUndefined();
  const old = ev.created("Old", "2026-10-01", "2026-10-15", at(0));
  expect(replay([old, ev.closed("Old", 0, 0, 0, at(1)), ev.character("Old", "male", LOOK, at(2))]).runs.get("Old")!.character).toBeUndefined();
});

test("changes need a character; the body never changes", () => {
  expect(replay([ev.created(), ev.changed(R, withHat, at(3))]).runs.get(R)!.character).toBeUndefined();
  const s = replay([ev.created(), ev.character(R, "male"), ev.changed(R, withHat, at(3))]);
  expect(s.runs.get(R)!.character).toMatchObject({ body: "male", look: withHat });
});

test("buying needs a character; the same item can't be bought twice", () => {
  expect(replay([ev.created(), ev.bought(R, HAT, 120, at(3))]).runs.get(R)!.purchases.size).toBe(0);
  const s = replay([ev.created(), ev.character(R, "male"), ev.bought(R, HAT, 120, at(3)), ev.bought(R, HAT, 120, at(4))]);
  expect([...s.runs.get(R)!.purchases]).toEqual([[HAT, { price: 120, at: at(3) }]]);
});

test("undo within 30 minutes refunds and takes the item off; at 31 it's rejected", () => {
  const h = [ev.created(), ev.character(R, "male"), ev.bought(R, HAT, 120, at(3)), ev.changed(R, withHat, at(4))];
  const ok = replay([...h, ev.purchaseUndone(R, HAT, at(33))]).runs.get(R)!;
  expect(ok.purchases.size).toBe(0);
  expect(ok.character!.look.worn.hat).toBeUndefined();
  const late = replay([...h, ev.purchaseUndone(R, HAT, at(34))]).runs.get(R)!;
  expect(late.purchases.has(HAT)).toBe(true);
  expect(late.character!.look.worn.hat).toEqual({ item: HAT });
});

test("history is trusted: a price no shelf would ask still replays", () => {
  const s = replay([ev.created(), ev.character(R, "male"), ev.bought(R, HAT, 7, at(3))]);
  expect(s.runs.get(R)!.purchases.get(HAT)!.price).toBe(7);
});

test("a closed run's character is frozen", () => {
  const old = ev.created("Old", "2026-10-01", "2026-10-15", at(0));
  const s = replay([old, ev.character("Old", "male", LOOK, at(1)), ev.closed("Old", 0, 0, 0, at(2)), ev.changed("Old", withHat, at(3)), ev.bought("Old", HAT, 120, at(3))]);
  expect(s.runs.get("Old")!.character!.look).toEqual(LOOK);
  expect(s.runs.get("Old")!.purchases.size).toBe(0);
});

test("overlapping runs keep separate characters and purchases", () => {
  const career = ev.created("Career", "2026-09-01", "2027-07-15");
  const s = replay([ev.created(), career, ev.character(R, "male"), ev.character("Career", "female"), ev.bought(R, HAT, 120, at(3))]);
  expect(s.runs.get("Career")!.character!.body).toBe("female");
  expect(s.runs.get("Career")!.purchases.size).toBe(0);
});

test("a purchase can't be undone once its run is closed", () => {
  const old = ev.created("Old", "2026-10-01", "2026-10-15", at(0));
  const s = replay([old, ev.character("Old", "male", LOOK, at(1)), ev.bought("Old", HAT, 120, at(2)), ev.closed("Old", 0, 0, 0, at(3)), ev.purchaseUndone("Old", HAT, at(4))]);
  expect(s.runs.get("Old")!.purchases.has(HAT)).toBe(true);
});
