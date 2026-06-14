"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useHousehold } from "@/components/providers/household-provider";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";
import { useWallets } from "@/hooks/use-wallets";
import { useCategories } from "@/hooks/use-categories";
import { PageHeading } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { parseCSV, parseNumberLoose, parseFlexibleDate } from "@/lib/backup";
import { combineJakartaDateTime } from "@/lib/period";
import { db } from "@/lib/db/dexie";
import { triggerSync } from "@/lib/db/sync";
import { createClient } from "@/lib/supabase/client";
import { safeRandomUUID } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { Transaction, TransactionType } from "@/lib/supabase/types";

const NONE = "none";

interface ParsedRow {
  date: string | null;
  amount: number | null;
  type: TransactionType;
  note: string;
  categoryId: string | null;
  valid: boolean;
}

export default function ImportPage() {
  const { householdId, userId } = useHousehold();
  const allowed = useCanEdit();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: wallets = [] } = useWallets();
  const { data: categoriesTree = [] } = useCategories();

  const flatCategories = React.useMemo(
    () => categoriesTree.flatMap((p) => [p, ...p.subcategories]),
    [categoriesTree]
  );

  const [rows, setRows] = React.useState<string[][]>([]);
  const [hasHeader, setHasHeader] = React.useState(true);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Mapping kolom (index sebagai string, atau NONE)
  const [dateCol, setDateCol] = React.useState<string>(NONE);
  const [amountCol, setAmountCol] = React.useState<string>(NONE);
  const [noteCol, setNoteCol] = React.useState<string>(NONE);
  const [typeCol, setTypeCol] = React.useState<string>(NONE);
  const [catCol, setCatCol] = React.useState<string>(NONE);

  const [walletId, setWalletId] = React.useState<string>("");
  const [negativeIsExpense, setNegativeIsExpense] = React.useState(true);
  const [defaultExpenseCat, setDefaultExpenseCat] = React.useState<string>(NONE);
  const [defaultIncomeCat, setDefaultIncomeCat] = React.useState<string>(NONE);
  const [importing, setImporting] = React.useState(false);

  const headerRow = hasHeader && rows.length > 0 ? rows[0] : null;
  const dataRows = React.useMemo(
    () => (hasHeader ? rows.slice(1) : rows),
    [rows, hasHeader]
  );
  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0);

  const columnOptions = React.useMemo(() => {
    return Array.from({ length: colCount }, (_, i) => ({
      value: String(i),
      label: headerRow?.[i]?.trim() ? headerRow[i].trim() : `Kolom ${i + 1}`,
    }));
  }, [colCount, headerRow]);

  // Auto-tebak mapping kolom dari nama header (dipanggil saat file dimuat,
  // bukan di dalam effect, agar tidak memicu cascading render).
  const guessMapping = (header: string[]) => {
    const find = (keywords: string[]) => {
      const idx = header.findIndex((h) =>
        keywords.some((k) => h.toLowerCase().includes(k))
      );
      return idx >= 0 ? String(idx) : NONE;
    };
    setDateCol(find(["tanggal", "date", "tgl", "waktu"]));
    setAmountCol(find(["nominal", "amount", "jumlah", "nilai", "debit", "kredit"]));
    setNoteCol(find(["catatan", "note", "keterangan", "deskripsi", "uraian"]));
    setCatCol(find(["kategori", "category"]));
    setTypeCol(find(["tipe", "type", "jenis"]));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        toast.error("File CSV kosong atau tidak terbaca.");
        return;
      }
      setRows(parsed);
      if (hasHeader && parsed[0]) guessMapping(parsed[0]);
      toast.success(`${parsed.length} baris terbaca dari file.`);
    } catch {
      toast.error("Gagal membaca file CSV.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const resolveType = React.useCallback(
    (rawType: string, amount: number): TransactionType => {
      if (typeCol !== NONE && rawType) {
        const t = rawType.toLowerCase();
        if (/(masuk|income|kredit|credit|in|pemasukan|terima)/.test(t)) return "income";
        if (/(keluar|expense|debit|out|pengeluaran|bayar)/.test(t)) return "expense";
      }
      if (negativeIsExpense) return amount < 0 ? "expense" : "income";
      return "expense";
    },
    [typeCol, negativeIsExpense]
  );

  const parsedRows: ParsedRow[] = React.useMemo(() => {
    return dataRows.map((r) => {
      const date = dateCol !== NONE ? parseFlexibleDate(r[Number(dateCol)] ?? "") : null;
      const amountRaw = amountCol !== NONE ? parseNumberLoose(r[Number(amountCol)] ?? "") : null;
      const note = noteCol !== NONE ? (r[Number(noteCol)] ?? "").trim() : "";
      const rawType = typeCol !== NONE ? (r[Number(typeCol)] ?? "").trim() : "";
      const amount = amountRaw;
      const type = resolveType(rawType, amount ?? 0);

      // Kategori: cocokkan dari kolom (by name) lalu fallback default per tipe
      let categoryId: string | null = null;
      if (catCol !== NONE) {
        const name = (r[Number(catCol)] ?? "").trim().toLowerCase();
        const match = flatCategories.find(
          (c) => c.name.toLowerCase() === name && c.kind === type
        );
        if (match) categoryId = match.id;
      }
      if (!categoryId) {
        const def = type === "income" ? defaultIncomeCat : defaultExpenseCat;
        categoryId = def !== NONE ? def : null;
      }

      const valid = !!date && amount !== null && Math.abs(amount) > 0;
      return { date, amount, type, note, categoryId, valid };
    });
  }, [
    dataRows,
    dateCol,
    amountCol,
    noteCol,
    typeCol,
    catCol,
    flatCategories,
    defaultExpenseCat,
    defaultIncomeCat,
    resolveType,
  ]);

  const validRows = parsedRows.filter((r) => r.valid);
  const canImport =
    allowed && !!walletId && dateCol !== NONE && amountCol !== NONE && validRows.length > 0;

  const handleImport = async () => {
    if (!allowed) {
      viewOnlyToast();
      return;
    }
    if (!householdId || !userId || !walletId) {
      toast.error("Pilih dompet tujuan terlebih dahulu.");
      return;
    }
    if (validRows.length === 0) {
      toast.error("Tidak ada baris valid untuk diimpor.");
      return;
    }
    setImporting(true);
    try {
      const supabase = createClient();
      const nowIso = new Date().toISOString();
      for (const r of validRows) {
        const id = safeRandomUUID();
        const occurredIso = combineJakartaDateTime(r.date!, "12:00");
        const newTx: Transaction = {
          id,
          household_id: householdId,
          created_by: userId,
          type: r.type,
          amount: Math.abs(r.amount!),
          occurred_at: occurredIso,
          is_scheduled: new Date(occurredIso).getTime() > Date.now(),
          wallet_id: walletId,
          to_wallet_id: null,
          category_id: r.categoryId,
          note: r.note || null,
          tags: [],
          receipt_url: null,
          receipt_items: null,
          splits: null,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          client_id: id,
          created_at: nowIso,
          updated_at: nowIso,
        };
        await db.transactions.put({ ...newTx, syncStatus: "pending" });
        await db.outbox.add({
          entity: "transactions",
          entityId: id,
          op: "create",
          payload: newTx,
          createdAt: Date.now(),
        });
      }
      triggerSync(supabase, householdId, { pull: false });
      queryClient.invalidateQueries({ queryKey: ["transactions", householdId] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balances", householdId] });
      toast.success(`${validRows.length} transaksi berhasil diimpor!`);
      router.push("/transactions");
    } catch (err) {
      console.error("Import failed:", err);
      toast.error("Gagal mengimpor transaksi.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="grid size-9 place-items-center rounded-full hover:bg-muted transition-colors"
          aria-label="Kembali ke pengaturan"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeading title="Impor Transaksi" subtitle="Dari file CSV bank / e-wallet" />
      </div>

      {/* Step 1: Upload */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">1. Unggah File CSV</h2>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-2xl border border-dashed border-mint-strong/40 bg-card p-6 flex flex-col items-center gap-2 hover:bg-mint-soft/10 transition-colors"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-mint-soft text-mint-strong">
            <Upload className="size-5" />
          </span>
          <span className="text-sm font-semibold text-foreground">Pilih file .csv</span>
          <span className="text-xs text-muted-foreground">
            {rows.length > 0 ? `${rows.length} baris dimuat` : "Belum ada file dipilih"}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="hidden"
        />
        {rows.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => setHasHeader(e.target.checked)}
              className="size-4 accent-mint-strong"
            />
            Baris pertama adalah judul kolom (header)
          </label>
        )}
      </section>

      {rows.length > 0 && (
        <>
          {/* Step 2: Mapping */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">2. Petakan Kolom</h2>
            <div className="rounded-2xl border bg-card p-4 grid gap-3">
              <MappingSelect label="Tanggal *" value={dateCol} onChange={setDateCol} options={columnOptions} />
              <MappingSelect label="Nominal *" value={amountCol} onChange={setAmountCol} options={columnOptions} />
              <MappingSelect label="Catatan" value={noteCol} onChange={setNoteCol} options={columnOptions} allowNone />
              <MappingSelect label="Tipe (income/expense)" value={typeCol} onChange={setTypeCol} options={columnOptions} allowNone />
              <MappingSelect label="Kategori (cocok nama)" value={catCol} onChange={setCatCol} options={columnOptions} allowNone />
            </div>
          </section>

          {/* Step 3: Tujuan & aturan */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">3. Tujuan & Aturan</h2>
            <div className="rounded-2xl border bg-card p-4 grid gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Dompet Tujuan *</Label>
                <Select value={walletId} onValueChange={setWalletId}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Pilih dompet" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {typeCol === NONE && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={negativeIsExpense}
                    onChange={(e) => setNegativeIsExpense(e.target.checked)}
                    className="size-4 accent-mint-strong"
                  />
                  Nominal negatif dianggap pengeluaran (positif = pemasukan)
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Default Kategori Pengeluaran</Label>
                  <Select value={defaultExpenseCat} onValueChange={setDefaultExpenseCat}>
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue placeholder="Tanpa kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Tanpa kategori</SelectItem>
                      {flatCategories.filter((c) => c.kind === "expense").map((c) => (
                        <SelectItem key={c.id} value={c.id} className={c.parent_id ? "pl-6 text-xs" : ""}>
                          {c.parent_id ? `↳ ${c.name}` : c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Default Kategori Pemasukan</Label>
                  <Select value={defaultIncomeCat} onValueChange={setDefaultIncomeCat}>
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue placeholder="Tanpa kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Tanpa kategori</SelectItem>
                      {flatCategories.filter((c) => c.kind === "income").map((c) => (
                        <SelectItem key={c.id} value={c.id} className={c.parent_id ? "pl-6 text-xs" : ""}>
                          {c.parent_id ? `↳ ${c.name}` : c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>

          {/* Step 4: Preview */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              4. Pratinjau ({validRows.length} valid / {parsedRows.length} baris)
            </h2>
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="max-h-72 overflow-auto divide-y divide-border/60">
                {parsedRows.slice(0, 50).map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${
                      r.valid ? "" : "bg-red-50/50 dark:bg-red-950/10"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {r.note || <span className="italic text-muted-foreground">tanpa catatan</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.date || "tanggal tidak valid"}
                        {" · "}
                        {r.type === "income" ? "Pemasukan" : "Pengeluaran"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-semibold ${
                        r.type === "income" ? "text-income" : "text-expense"
                      }`}
                    >
                      {r.amount !== null ? formatCurrency(Math.abs(r.amount)) : "—"}
                    </span>
                  </div>
                ))}
              </div>
              {parsedRows.length > 50 && (
                <div className="px-3 py-2 text-[10px] text-muted-foreground border-t text-center">
                  Menampilkan 50 dari {parsedRows.length} baris
                </div>
              )}
            </div>
          </section>

          {/* Import button */}
          <Button
            onClick={handleImport}
            disabled={!canImport || importing}
            className="w-full h-12 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Mengimpor...
              </>
            ) : (
              <>
                <FileSpreadsheet className="size-4" /> Impor {validRows.length} Transaksi
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}

function MappingSelect({
  label,
  value,
  onChange,
  options,
  allowNone,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allowNone?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-44 rounded-xl text-xs">
          <SelectValue placeholder="Pilih kolom" />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={NONE}>— Tidak ada —</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
