/** A local calendar date, `YYYY-MM-DD`. */
export type LocalDate = string;

export type Clock = () => Date;

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Calendar arithmetic is done on UTC midnights so DST never shifts a day. */
function toUtc(d: LocalDate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function fromUtc(d: Date): LocalDate {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isLocalDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return fromUtc(toUtc(s)) === s;
}

/** `en-CA` formats as `YYYY-MM-DD`. */
const AMSTERDAM = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar date in Amsterdam at instant `d`, whatever the system time zone. */
export function localDateOf(d: Date): LocalDate {
  return AMSTERDAM.format(d);
}

/** The first instant after `now` at which the Amsterdam date changes. */
export function nextLocalMidnight(now: Date): Date {
  const tomorrow = addDays(localDateOf(now), 1);
  const utcMidnight = toUtc(tomorrow).getTime();
  // Amsterdam is UTC+1 or UTC+2, so midnight there is 1 or 2 hours before UTC midnight.
  for (const hours of [2, 1]) {
    const candidate = new Date(utcMidnight - hours * 3_600_000);
    if (localDateOf(candidate) === tomorrow && localDateOf(new Date(candidate.getTime() - 1)) !== tomorrow) return candidate;
  }
  throw new Error(`No Amsterdam midnight found for ${tomorrow}`);
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtc(new Date(toUtc(d).getTime() + n * DAY_MS));
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / DAY_MS);
}

export function examWeek(end: LocalDate): { from: LocalDate; to: LocalDate } {
  return { from: addDays(end, -7), to: end };
}

export function formatShort(d: LocalDate): string {
  const u = toUtc(d);
  return `${WEEKDAYS[u.getUTCDay()]} ${u.getUTCDate()} ${MONTHS[u.getUTCMonth()]} ${u.getUTCFullYear()}`;
}
