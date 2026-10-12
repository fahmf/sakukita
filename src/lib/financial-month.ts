/**
 * Financial-month (budget cycle) helpers.
 *
 * A household's accounting month starts on its cycle start day
 * (`households.cycle_start_day`, 1–28, default 25). With day 25, any
 * transaction dated on/after the 25th counts toward the NEXT calendar month:
 * 25 May belongs to the "June" cycle, which spans 25 May – 24 June. Day 1
 * means plain calendar months.
 *
 * Month "labels" stay as "YYYY-MM-01" strings (matching how budgets are stored
 * in `period_month`) and name the calendar month that contains the cycle's end.
 *
 * The active household's day is set once by HouseholdProvider via
 * `setCycleStartDay`, so every helper here follows it without threading it
 * through each call site.
 */
export const DEFAULT_CYCLE_START_DAY = 25;

let cycleStartDay = DEFAULT_CYCLE_START_DAY;

/** Clamp to the supported 1–28 range (every month has a 28th). */
export function normalizeCycleStartDay(day: unknown): number {
  const n = Math.trunc(Number(day));
  return Number.isFinite(n) && n >= 1 && n <= 28 ? n : DEFAULT_CYCLE_START_DAY;
}

/** Set the active household's cycle start day. */
export function setCycleStartDay(day: unknown): void {
  cycleStartDay = normalizeCycleStartDay(day);
}

export function getCycleStartDay(): number {
  return cycleStartDay;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build a "YYYY-MM-01" label from a 0-indexed month, normalising overflow. */
function label(year: number, month0: number): string {
  const d = new Date(year, month0, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

/** The financial-month label a calendar date (year, 0-indexed month, day) falls into. */
export function financialMonthLabel(year: number, month0: number, day: number): string {
  // Day 1 cycles are calendar months; otherwise the start day rolls into
  // the next month's cycle.
  const shifted = cycleStartDay > 1 && day >= cycleStartDay ? month0 + 1 : month0;
  return label(year, shifted);
}

/** Jakarta-local "now", broken into parts. */
function jakartaParts(): { year: number; month0: number; day: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const map = new Map(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
    return {
      year: parseInt(map.get("year")!),
      month0: parseInt(map.get("month")!) - 1,
      day: parseInt(map.get("day")!),
    };
  } catch {
    const n = new Date();
    return { year: n.getFullYear(), month0: n.getMonth(), day: n.getDate() };
  }
}

/** Current financial-month label ("YYYY-MM-01"), based on Jakarta time. */
export function currentFinancialMonth(): string {
  const { year, month0, day } = jakartaParts();
  return financialMonthLabel(year, month0, day);
}

/** Shift a "YYYY-MM-01" label by `delta` months. */
export function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number); // m is 1-indexed
  return label(y, m - 1 + delta);
}

/**
 * Inclusive calendar date range a financial-month label covers, as
 * "YYYY-MM-DD" strings. June (cycle day 25) -> 2026-05-25 .. 2026-06-24.
 */
export function financialMonthDateRange(monthStr: string): {
  startDate: string;
  endDate: string;
} {
  const { start, end } = financialMonthDateRangeAsDates(monthStr);
  return {
    startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    endDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

/**
 * Same range as Date objects (local time), for in-memory comparisons. `day`
 * overrides the active cycle start day (e.g. to preview a new setting).
 */
export function financialMonthDateRangeAsDates(
  monthStr: string,
  day: number = cycleStartDay
): { start: Date; end: Date } {
  const [y, m] = monthStr.split("-").map(Number); // m is 1-indexed
  // Day 25: 25th of the previous month .. 24th of this one. Day 1: the 1st
  // .. last day of this month (day 0 of the next month).
  const startMonth0 = day > 1 ? m - 2 : m - 1;
  const start = new Date(y, startMonth0, day, 0, 0, 0, 0);
  const end = new Date(y, startMonth0 + 1, day - 1, 23, 59, 59, 999);
  return { start, end };
}

const jakartaDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Jakarta calendar date ("YYYY-MM-DD") of a timestamp. Slicing the ISO string
 * gives the UTC date instead, which is a day early for anything between 00:00
 * and 06:59 WIB — e.g. the server-materialized salary stored as
 * 2026-09-24T17:00Z is really 25 Sep WIB, the first day of a new cycle.
 */
export function jakartaDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return typeof value === "string" ? value.slice(0, 10) : "";
  return jakartaDateFmt.format(date); // en-CA formats as YYYY-MM-DD
}

/** Today's date in Jakarta as "YYYY-MM-DD" (for date inputs' defaults). */
export function todayJakarta(): string {
  return jakartaDateKey(new Date());
}

/** Whether a timestamp falls within the given financial month (Jakarta calendar). */
export function isInFinancialMonth(occurredAt: string, monthStr: string): boolean {
  const [y, m, d] = jakartaDateKey(occurredAt).split("-").map(Number);
  return financialMonthLabel(y, m - 1, d) === monthStr;
}

/**
 * Timestamp to store for a transaction dated `dateStr` (Jakarta "YYYY-MM-DD").
 * Today keeps the real current time so it is never mistaken for a future
 * (scheduled) entry before 07:00 WIB and sorts in entry order; other days keep
 * the long-standing 07:00 WIB (00:00Z) convention used by existing rows.
 */
export function occurredAtForDate(dateStr: string): string {
  if (dateStr === todayJakarta()) return new Date().toISOString();
  return new Date(`${dateStr}T00:00:00Z`).toISOString();
}

/**
 * Short human label for the dates a financial month covers, e.g.
 * "25 Sep – 24 Okt". Shown under month navigators so a label like "Oktober"
 * doesn't read as the calendar month.
 */
export function financialMonthRangeLabel(monthStr: string, day: number = cycleStartDay): string {
  const { start, end } = financialMonthDateRangeAsDates(monthStr, day);
  const fmt = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}
