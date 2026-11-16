import { addDays, daysBetween, examWeek, formatShort, isLocalDate, localDateOf } from "../../src/core/dates";
import { err, ok } from "../../src/core/result";

test("isLocalDate", () => {
  expect(isLocalDate("2027-01-30")).toBe(true);
  expect(isLocalDate("2027-02-30")).toBe(false);
  expect(isLocalDate("2027-1-30")).toBe(false);
  expect(isLocalDate("")).toBe(false);
});

test("addDays crosses months and DST", () => {
  expect(addDays("2027-01-30", 3)).toBe("2027-02-02");
  expect(addDays("2027-03-27", 2)).toBe("2027-03-29");
  expect(addDays("2027-01-30", -7)).toBe("2027-01-23");
});

test("daysBetween", () => {
  expect(daysBetween("2026-11-09", "2027-01-30")).toBe(82);
  expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
});

test("examWeek", () => {
  expect(examWeek("2027-01-30")).toEqual({ from: "2027-01-23", to: "2027-01-30" });
});

test("localDateOf uses local time", () => {
  expect(localDateOf(new Date("2027-01-27T23:30:00Z"))).toBe("2027-01-28");
  expect(localDateOf(new Date("2027-01-27T22:30:00Z"))).toBe("2027-01-27");
});

test("formatShort", () => {
  expect(formatShort("2027-01-30")).toBe("Sat 30 Jan 2027");
});

test("result helpers", () => {
  expect(ok(1)).toEqual({ ok: true, value: 1 });
  expect(err("no")).toEqual({ ok: false, error: "no" });
});
