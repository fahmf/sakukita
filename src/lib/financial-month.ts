/**
 * Financial-month (budget cycle) helpers.
 *
 * The household's accounting month does NOT start on the 1st — it starts on
 * `CYCLE_START_DAY`. Any transaction dated on/after that day counts toward the
 * NEXT calendar month. With day 25, a transaction on 25 May belongs to the
 * "June" cycle, and the June cycle spans 25 May – 24 June.
 *
 * Month "labels" stay as "YYYY-MM-01" strings (matching how budgets are stored
 * in `period_month`) and name the calendar month that contains the cycle's end.
 * Change `CYCLE_START_DAY` here to move the cycle boundary everywhere.
 */
export const CYCLE_START_DAY = 25;

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
  const shifted = day >= CYCLE_START_DAY ? month0 + 1 : month0;
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
  const [y, m] = monthStr.split("-").map(Number); // m is 1-indexed
  const start = new Date(y, m - 2, CYCLE_START_DAY); // previous month, day 25
  const end = new Date(y, m - 1, CYCLE_START_DAY - 1); // this month, day 24
  return {
    startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    endDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

/** Same range as Date objects (local time), for in-memory comparisons. */
export function financialMonthDateRangeAsDates(monthStr: string): { start: Date; end: Date } {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(y, m - 2, CYCLE_START_DAY, 0, 0, 0, 0);
  const end = new Date(y, m - 1, CYCLE_START_DAY - 1, 23, 59, 59, 999);
  return { start, end };
}

/** Whether a `YYYY-MM-DD...` timestamp falls within the given financial month. */
export function isInFinancialMonth(occurredAt: string, monthStr: string): boolean {
  const [y, m, d] = occurredAt.slice(0, 10).split("-").map(Number);
  return financialMonthLabel(y, m - 1, d) === monthStr;
}
