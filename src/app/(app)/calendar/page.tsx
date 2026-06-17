"use client";

import * as React from "react";
import Link from "next/link";
import { useTransactions, useDeleteTransaction, useRestoreTransaction } from "@/hooks/use-transactions";
import type { TransactionWithDetails } from "@/hooks/use-transactions";
import { useUIStore } from "@/stores/ui-store";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";
import { formatCurrency } from "@/lib/format";
import { PageHeading } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TransactionDetailDialog } from "@/components/transaction/transaction-detail-dialog";
import { TransactionListSkeleton } from "@/components/shared/skeletons";
import { iconMap } from "@/lib/icons";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
} from "lucide-react";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Local YYYY-MM-DD key for a Date. */
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Jakarta-timezone YYYY-MM-DD key for a timestamp (matches the rest of the app). */
function jakartaKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const map = new Map(parts.map((p) => [p.type, p.value]));
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`;
}

/** 120000 -> "120rb", 1500000 -> "1,5jt" */
function compactAmount(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1).replace(".", ",")}jt`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}rb`;
  return String(v);
}

export default function CalendarPage() {
  const { openEditTransaction } = useUIStore();
  const allowed = useCanEdit();
  const deleteTx = useDeleteTransaction();
  const restoreTx = useRestoreTransaction();

  // Visible calendar month (real calendar month, not the financial cycle).
  const [cursor, setCursor] = React.useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month0: n.getMonth() };
  });
  const [selectedKey, setSelectedKey] = React.useState<string>(() => ymd(new Date()));
  const [selectedTxForDetail, setSelectedTxForDetail] = React.useState<TransactionWithDetails | null>(null);

  const monthStart = React.useMemo(() => new Date(cursor.year, cursor.month0, 1), [cursor]);
  const monthEnd = React.useMemo(() => new Date(cursor.year, cursor.month0 + 1, 0), [cursor]);

  const { data: transactions = [], isLoading } = useTransactions({
    period: "custom",
    startDate: ymd(monthStart),
    endDate: ymd(monthEnd),
    walletId: null,
    categoryId: null,
  });

  const monthName = monthStart.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const todayKey = ymd(new Date());

  // Aggregate per day: expense + income totals and the transactions themselves.
  const byDay = React.useMemo(() => {
    const map = new Map<string, { expense: number; income: number; txs: TransactionWithDetails[] }>();
    for (const t of transactions) {
      const key = jakartaKey(t.occurred_at);
      const entry = map.get(key) ?? { expense: 0, income: 0, txs: [] };
      if (t.type === "expense") entry.expense += t.amount;
      else if (t.type === "income") entry.income += t.amount;
      entry.txs.push(t);
      map.set(key, entry);
    }
    return map;
  }, [transactions]);

  // Build the Monday-start week grid covering the month.
  const weeks = React.useMemo(() => {
    const rows: Date[][] = [];
    const start = new Date(cursor.year, cursor.month0, 1);
    const offset = (start.getDay() + 6) % 7; // 0 = Monday
    start.setDate(start.getDate() - offset);
    const walk = new Date(start);
    for (let w = 0; w < 6; w++) {
      const row: Date[] = [];
      for (let d = 0; d < 7; d++) {
        row.push(new Date(walk));
        walk.setDate(walk.getDate() + 1);
      }
      rows.push(row);
      if (walk > monthEnd) break;
    }
    return rows;
  }, [cursor, monthEnd]);

  const goPrev = () =>
    setCursor((c) => (c.month0 === 0 ? { year: c.year - 1, month0: 11 } : { year: c.year, month0: c.month0 - 1 }));
  const goNext = () =>
    setCursor((c) => (c.month0 === 11 ? { year: c.year + 1, month0: 0 } : { year: c.year, month0: c.month0 + 1 }));

  const selectedEntry = byDay.get(selectedKey);
  const selectedDateLabel = React.useMemo(() => {
    const [y, m, d] = selectedKey.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [selectedKey]);

  const handleQuickDelete = async (tx: TransactionWithDetails) => {
    if (!allowed) {
      viewOnlyToast();
      return;
    }
    try {
      await deleteTx.mutateAsync(tx.id);
      toast.success("Transaksi dihapus", {
        description: `${tx.note || tx.category?.name || "Transaksi"} · ${formatCurrency(tx.amount)}`,
        action: {
          label: "Urungkan",
          onClick: () =>
            restoreTx.mutate(tx.id, { onSuccess: () => toast.success("Transaksi dipulihkan") }),
        },
      });
    } catch {
      toast.error("Gagal menghapus transaksi.");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="grid size-9 place-items-center rounded-full hover:bg-muted transition-colors"
          aria-label="Kembali ke beranda"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeading title="Kalender" subtitle="Transaksi per hari" />
        <Link
          href="/transactions"
          className="ml-auto grid size-9 place-items-center rounded-full hover:bg-muted transition-colors"
          aria-label="Tampilan daftar"
          title="Tampilan daftar"
        >
          <List className="size-4" />
        </Link>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between bg-card border rounded-2xl p-2.5 shadow-xs">
        <Button variant="ghost" size="icon" onClick={goPrev} className="size-9 rounded-xl hover:bg-muted">
          <ChevronLeft className="size-5" />
        </Button>
        <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
          <CalendarDays className="size-4 text-mint-strong" />
          <span>{monthName}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={goNext} className="size-9 rounded-xl hover:bg-muted">
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {/* Calendar grid */}
      <Card className="rounded-2xl border bg-card p-3">
        <div className="grid grid-cols-7 gap-1 pb-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weeks.flat().map((date) => {
            const key = ymd(date);
            const inMonth = date.getMonth() === cursor.month0;
            const entry = byDay.get(key);
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                className={`relative flex aspect-square flex-col items-center justify-start gap-0.5 rounded-xl border p-1 text-center transition-all active:scale-95 ${
                  isSelected
                    ? "border-mint-strong bg-mint-soft/40"
                    : "border-transparent hover:bg-muted/50"
                } ${inMonth ? "" : "opacity-35"}`}
              >
                <span
                  className={`grid size-5 place-items-center rounded-full text-[11px] font-semibold ${
                    isToday ? "bg-mint-strong text-white" : "text-foreground"
                  }`}
                >
                  {date.getDate()}
                </span>
                {entry && entry.expense > 0 && (
                  <span className="text-[9px] font-bold leading-none text-expense">
                    {compactAmount(entry.expense)}
                  </span>
                )}
                {entry && entry.income > 0 && (
                  <span className="absolute right-1 top-1 size-1.5 rounded-full bg-income" />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected day's transactions */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {selectedDateLabel}
          </h2>
          {selectedEntry && (
            <span
              className={`text-xs font-bold ${
                selectedEntry.income - selectedEntry.expense >= 0 ? "text-income" : "text-expense"
              }`}
            >
              Net: {selectedEntry.income - selectedEntry.expense >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(selectedEntry.income - selectedEntry.expense)).replace("Rp", "").trim()}
            </span>
          )}
        </div>

        {isLoading ? (
          <TransactionListSkeleton count={3} />
        ) : !selectedEntry || selectedEntry.txs.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed rounded-2xl space-y-1.5 bg-card">
            <CalendarDays className="size-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Tidak ada transaksi pada hari ini.</p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {selectedEntry.txs.map((tx) => {
              const isExpense = tx.type === "expense";
              const isIncome = tx.type === "income";
              const isTransfer = tx.type === "transfer";
              let bgColor = "#C4C4C4";
              const hasMappedIcon = !isTransfer && tx.category && iconMap[tx.category.icon || ""];
              const categoryIcon = tx.category?.icon || "🏷️";
              if (isTransfer) bgColor = "#A8A29E";
              else if (tx.category) bgColor = tx.category.color || "#C4C4C4";

              return (
                <button
                  type="button"
                  key={tx.id}
                  onClick={() => setSelectedTxForDetail(tx)}
                  className="flex w-full items-center justify-between rounded-2xl border bg-card p-3.5 text-left transition-all hover:border-mint-strong/20 active:opacity-75 min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-xl text-white font-semibold"
                      style={{ backgroundColor: bgColor }}
                    >
                      {isTransfer ? (
                        <ArrowRightLeft className="size-4" />
                      ) : hasMappedIcon ? (
                        React.createElement(iconMap[tx.category!.icon || ""], { className: "size-4" })
                      ) : (
                        <span className="text-base select-none leading-none">{categoryIcon}</span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {isTransfer
                          ? `Transfer ke ${tx.to_wallet?.name}`
                          : tx.note || tx.category?.name || "Lain-lain"}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium truncate">{tx.wallet?.name}</p>
                    </div>
                  </div>
                  <p
                    className={`shrink-0 pl-2 font-bold text-sm tracking-tight ${
                      isIncome ? "text-income" : isExpense ? "text-expense" : "text-foreground"
                    }`}
                  >
                    {isIncome ? "+" : isExpense ? "-" : ""}
                    {formatCurrency(tx.amount).replace("Rp", "").trim()}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <TransactionDetailDialog
        tx={selectedTxForDetail}
        open={selectedTxForDetail !== null}
        onOpenChange={(o) => !o && setSelectedTxForDetail(null)}
        onEdit={openEditTransaction}
        onDelete={handleQuickDelete}
      />
    </div>
  );
}
