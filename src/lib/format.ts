const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const grouped = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

/** Rp 47.500 */
export function formatCurrency(amount: number): string {
  return idr.format(amount);
}

/** Signed amount with income/expense intent, e.g. "+8.500.000" / "-3.200.000" */
export function formatSigned(amount: number, kind: "income" | "expense"): string {
  const sign = kind === "income" ? "+" : "-";
  return `${sign}${grouped.format(Math.abs(amount))}`;
}

/** 47500 -> "47.500" (no currency symbol, for amount inputs) */
export function formatGrouped(amount: number): string {
  return grouped.format(amount);
}

const longDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
});

/** 12 Mei 2026 */
export function formatDate(value: string | Date): string {
  return longDate.format(new Date(value));
}

/** 12 Mei */
export function formatDateShort(value: string | Date): string {
  return shortDate.format(new Date(value));
}

/** "baru saja" / "5 menit lalu" / "3 jam lalu" / "12 Mei" */
export function formatRelative(value: string | Date): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return formatDateShort(date);
}
