/**
 * Periode keuangan berbasis tanggal gajian (Asia/Jakarta).
 *
 * Bulan keuangan TIDAK dimulai tanggal 1, melainkan tanggal gajian
 * (MONTH_START_DAY). Periode diberi label bulan tempat periode itu BERAKHIR:
 * dengan MONTH_START_DAY = 25, periode "Juni 2026" berjalan dari
 * 25 Mei 2026 00:00 WIB s/d 24 Juni 2026 23:59 WIB — gajian 25 Mei
 * membiayai bulan Juni.
 *
 * Kunci periode memakai format "YYYY-MM-01" agar tetap kompatibel dengan
 * kolom budgets.period_month (constraint hari = 1) tanpa migrasi data.
 */

// Bertipe number (bukan literal) agar cabang MONTH_START_DAY === 1 tetap valid
export const MONTH_START_DAY: number = 25;

export interface PeriodRange {
  /** Tanggal mulai inklusif, format YYYY-MM-DD (waktu Jakarta) */
  startDate: string;
  /** Tanggal akhir inklusif, format YYYY-MM-DD (waktu Jakarta) */
  endDate: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function toKey(year: number, month: number): string {
  // month 1-12; normalisasi overflow/underflow
  const d = new Date(Date.UTC(year, month - 1, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
}

function jakartaDateParts(date: Date): { year: number; month: number; day: number } {
  try {
    // en-CA menghasilkan format YYYY-MM-DD
    const str = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    const [year, month, day] = str.split("-").map(Number);
    return { year, month, day };
  } catch {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }
}

/** Kunci periode ("YYYY-MM-01") yang memuat timestamp/tanggal tertentu. */
export function getPeriodKeyForDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const { year, month, day } = jakartaDateParts(d);
  if (MONTH_START_DAY === 1) return toKey(year, month);
  // Tanggal >= hari gajian masuk periode berlabel bulan BERIKUTNYA
  return day >= MONTH_START_DAY ? toKey(year, month + 1) : toKey(year, month);
}

/** Kunci periode yang sedang berjalan hari ini (Jakarta). */
export function getActivePeriodKey(): string {
  return getPeriodKeyForDate(new Date());
}

/** Geser kunci periode maju/mundur sejumlah bulan. */
export function shiftPeriodKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  return toKey(y, m + delta);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Rentang tanggal (inklusif, waktu Jakarta) untuk sebuah kunci periode. */
export function getPeriodRange(key: string): PeriodRange {
  const [y, m] = key.split("-").map(Number);
  if (MONTH_START_DAY === 1) {
    return {
      startDate: `${y}-${pad(m)}-01`,
      endDate: `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m))}`,
    };
  }
  // Mulai: hari gajian di bulan sebelumnya (clamp bila bulan pendek)
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const py = prev.getUTCFullYear();
  const pm = prev.getUTCMonth() + 1;
  const startDay = Math.min(MONTH_START_DAY, lastDayOfMonth(py, pm));
  // Akhir: sehari sebelum hari gajian di bulan label
  const endDay = Math.min(MONTH_START_DAY - 1, lastDayOfMonth(y, m));
  return {
    startDate: `${py}-${pad(pm)}-${pad(startDay)}`,
    endDate: `${y}-${pad(m)}-${pad(endDay)}`,
  };
}

/** Apakah timestamp berada di dalam periode tertentu. */
export function isInPeriod(occurredAt: string, key: string): boolean {
  return getPeriodKeyForDate(occurredAt) === key;
}

/** Label utama, mis. "Juni 2026". */
export function formatPeriodLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Label pendek untuk sumbu chart, mis. "Jun 26". */
export function formatPeriodShortLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("id-ID", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

// ─── Tanggal & jam (Asia/Jakarta) ────────────────────────────────────────────

/** Komponen tanggal/jam "sekarang" di zona Jakarta untuk default input form. */
export function getJakartaNowParts(): { date: string; time: string } {
  const now = new Date();
  const { year, month, day } = jakartaDateParts(now);
  let time = "00:00";
  try {
    time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
  } catch {
    time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  return { date: `${year}-${pad(month)}-${pad(day)}`, time };
}

/** Komponen tanggal & jam Jakarta dari sebuah timestamp (untuk pre-fill edit). */
export function getJakartaParts(value: string | Date): { date: string; time: string } {
  const d = typeof value === "string" ? new Date(value) : value;
  const { year, month, day } = jakartaDateParts(d);
  let time = "00:00";
  try {
    time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return { date: `${year}-${pad(month)}-${pad(day)}`, time };
}

/** Gabungkan "YYYY-MM-DD" + "HH:mm" (waktu Jakarta) → ISO string UTC. */
export function combineJakartaDateTime(date: string, time: string): string {
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return new Date(`${date}T${t}:00+07:00`).toISOString();
}

// ─── Periode tahunan (untuk budget tahunan) ──────────────────────────────────

/** Tahun (number) sebuah timestamp di zona Jakarta. */
export function getJakartaYear(value: string | Date): number {
  const d = typeof value === "string" ? new Date(value) : value;
  return jakartaDateParts(d).year;
}

/** Kunci tahun ("YYYY-01-01") untuk dipakai pada budgets.period_month tahunan. */
export function getYearKey(year: number): string {
  return `${year}-01-01`;
}

/** Kunci tahun yang sedang berjalan (Jakarta). */
export function getActiveYearKey(): string {
  return getYearKey(getJakartaYear(new Date()));
}

/** Geser kunci tahun maju/mundur. */
export function shiftYearKey(key: string, delta: number): string {
  const y = Number(key.split("-")[0]);
  return getYearKey(y + delta);
}

/** Apakah timestamp berada di tahun (kalender Jakarta) dari kunci tahun. */
export function isInYear(occurredAt: string, yearKey: string): boolean {
  return getJakartaYear(occurredAt) === Number(yearKey.split("-")[0]);
}

/** Label tahun, mis. "2026". */
export function formatYearLabel(yearKey: string): string {
  return String(Number(yearKey.split("-")[0]));
}

/** Label rentang, mis. "25 Mei – 24 Jun". */
export function formatPeriodRangeLabel(key: string): string {
  if (MONTH_START_DAY === 1) return "";
  const { startDate, endDate } = getPeriodRange(key);
  const fmt = (s: string) => {
    const [yy, mm, dd] = s.split("-").map(Number);
    return new Date(Date.UTC(yy, mm - 1, dd)).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  };
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}
