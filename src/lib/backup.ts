import { db } from "@/lib/db/dexie";

/** Backup penuh satu household dari data lokal (IndexedDB). */
export interface HouseholdBackup {
  version: number;
  exported_at: string;
  household_id: string;
  data: {
    transactions: unknown[];
    wallets: unknown[];
    categories: unknown[];
    budgets: unknown[];
    savings_goals: unknown[];
    debts: unknown[];
    recurring_transactions: unknown[];
  };
}

function stripSync<T extends { syncStatus?: unknown }>(rows: T[]): Omit<T, "syncStatus">[] {
  return rows.map(({ syncStatus, ...rest }) => {
    void syncStatus;
    return rest;
  });
}

/** Kumpulkan seluruh data household menjadi objek backup. */
export async function buildHouseholdBackup(householdId: string): Promise<HouseholdBackup> {
  const [
    transactions,
    wallets,
    categories,
    budgets,
    savings_goals,
    debts,
    recurring_transactions,
  ] = await Promise.all([
    db.transactions.where("household_id").equals(householdId).toArray(),
    db.wallets.where("household_id").equals(householdId).toArray(),
    db.categories.where("household_id").equals(householdId).toArray(),
    db.budgets.where("household_id").equals(householdId).toArray(),
    db.savings_goals.where("household_id").equals(householdId).toArray(),
    db.debts.where("household_id").equals(householdId).toArray(),
    db.recurring_transactions.where("household_id").equals(householdId).toArray(),
  ]);

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    household_id: householdId,
    data: {
      transactions: stripSync(transactions),
      wallets: stripSync(wallets),
      categories: stripSync(categories),
      budgets: stripSync(budgets),
      savings_goals: stripSync(savings_goals),
      debts: stripSync(debts),
      recurring_transactions: stripSync(recurring_transactions),
    },
  };
}

/** Picu unduhan file di browser. */
export function downloadFile(filename: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Parsing CSV ──────────────────────────────────────────────────────────────

/** Parser CSV sederhana yang menangani tanda kutip & koma di dalam sel. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normalkan line ending
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // Sisa field/row terakhir
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Buang baris kosong total
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Ubah string nominal longgar ("Rp 50.000", "1.234,56", "-25000") → number. */
export function parseNumberLoose(input: string): number | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.includes("-");
  // Sisakan digit, titik, koma
  s = s.replace(/[^0-9.,]/g, "");
  if (!s) return null;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // Format ID: titik ribuan, koma desimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Format EN: koma ribuan, titik desimal
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const after = s.split(",").pop() ?? "";
    if (after.length === 2) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasDot) {
    const parts = s.split(".");
    const after = parts[parts.length - 1];
    if (parts.length === 2 && after.length === 2) {
      // desimal (mis. 50000.00)
    } else {
      s = s.replace(/\./g, "");
    }
  }

  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/** Parsing tanggal longgar → "YYYY-MM-DD" (zona dianggap lokal/Jakarta). */
export function parseFlexibleDate(input: string): string | null {
  if (!input) return null;
  const s = String(input).trim();
  // ISO atau YYYY-MM-DD[ T...]
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD/MM/YYYY atau DD-MM-YYYY (umum di bank/e-wallet ID)
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (dmy) {
    const [, d, m, yRaw] = dmy;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const dd = d.padStart(2, "0");
    const mm = m.padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  // Fallback: biarkan Date mencoba parse
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}
