import { addDays, daysBetween, examWeek, formatRunDates, formatShort, isLocalDate, localDateOf, nextLocalMidnight } from "../../src/core/dates";
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

test("localDateOf is the Amsterdam date", () => {
  expect(localDateOf(new Date("2027-01-27T23:30:00Z"))).toBe("2027-01-28"); // 00:30 CET
  expect(localDateOf(new Date("2027-01-27T22:30:00Z"))).toBe("2027-01-27"); // 23:30 CET
  expect(localDateOf(new Date("2027-03-28T22:30:00Z"))).toBe("2027-03-29"); // 00:30 CEST
  expect(localDateOf(new Date("2027-03-28T21:30:00Z"))).toBe("2027-03-28"); // 23:30 CEST
});

test("nextLocalMidnight follows Amsterdam across DST", () => {
  expect(nextLocalMidnight(new Date("2027-01-27T12:00:00Z")).toISOString()).toBe("2027-01-27T23:00:00.000Z");
  expect(nextLocalMidnight(new Date("2027-01-27T23:00:00Z")).toISOString()).toBe("2027-01-28T23:00:00.000Z");
  expect(nextLocalMidnight(new Date("2027-03-28T12:00:00Z")).toISOString()).toBe("2027-03-28T22:00:00.000Z");
  expect(nextLocalMidnight(new Date("2027-10-31T12:00:00Z")).toISOString()).toBe("2027-10-31T23:00:00.000Z");
});

test("formatShort", () => {
  expect(formatShort("2027-01-30")).toBe("Sat 30 Jan 2027");
});

test("result helpers", () => {
  expect(ok(1)).toEqual({ ok: true, value: 1 });
  expect(err("no")).toEqual({ ok: false, error: "no" });
});

test("formatRunDates shows no end date when there's no end", () => {
  expect(formatRunDates("2026-11-09")).toBe("Mon 9 Nov 2026 → no end date");
  expect(formatRunDates("2026-11-09", "2027-01-30")).toBe("Mon 9 Nov 2026 → Sat 30 Jan 2027");
});
