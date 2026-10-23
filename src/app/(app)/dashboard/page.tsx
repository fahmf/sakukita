"use client";

import * as React from "react";
import Link from "next/link";
import { useWalletBalances } from "@/hooks/use-wallets";
import {
  useTransactions,
  useDeleteTransaction,
  useRestoreTransaction,
  useScheduledTransactions,
  type TransactionWithDetails,
} from "@/hooks/use-transactions";
import { useBudgets } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { useDebts } from "@/hooks/use-debts";
import { formatCurrency, formatDateShort, formatGrouped } from "@/lib/format";
import {
  currentFinancialMonth,
  financialMonthDateRange,
  financialMonthRangeLabel,
  shiftMonth,
} from "@/lib/financial-month";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarClock,
  Wallet,
} from "lucide-react";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";
import { TransactionDetailDialog } from "@/components/transaction/transaction-detail-dialog";
import { TransactionRow } from "@/components/transaction/transaction-row";
import { PetCard } from "@/components/pet/pet-card";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { iconMap } from "@/lib/icons";
import { computeBudgetUsage } from "@/lib/budget-usage";
import { TransactionListSkeleton, BudgetCardSkeleton } from "@/components/shared/skeletons";

export default function DashboardPage() {
  const { openQuickAdd, openEditTransaction } = useUIStore();
  const { data: walletBalances = [], isLoading: loadingBalances } = useWalletBalances();

  // Dynamic month selection state (initialized to the current financial month,
  // which follows the household cycle start day)
  const [selectedMonth, setSelectedMonth] = React.useState(() => currentFinancialMonth());

  // Captured once at mount so the "next 30 days" horizon stays stable across
  // re-renders (calling Date.now() during render is impure).
  const [nowMs] = React.useState(() => Date.now());

  const deleteTx = useDeleteTransaction();
  const restoreTx = useRestoreTransaction();
  const allowed = useCanEdit();
  const router = useRouter();
  const [selectedTxForDetail, setSelectedTxForDetail] = React.useState<TransactionWithDetails | null>(null);

  // Helper: Prev/Next month logic
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(
      `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`
    );
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(
      `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`
    );
  };

  // Convert selectedMonth to the financial-cycle date range for useTransactions
  const { startDate, endDate } = React.useMemo(
    () => financialMonthDateRange(selectedMonth),
    [selectedMonth]
  );

  const { data: transactions = [], isLoading: loadingTx } = useTransactions({
    period: "custom",
    startDate,
    endDate,
    walletId: null,
    categoryId: null,
  });

  // Previous financial month — used only to compare expense month-over-month.
  const { startDate: prevStart, endDate: prevEnd } = React.useMemo(
    () => financialMonthDateRange(shiftMonth(selectedMonth, -1)),
    [selectedMonth]
  );
  const { data: prevTransactions = [] } = useTransactions({
    period: "custom",
    startDate: prevStart,
    endDate: prevEnd,
    walletId: null,
    categoryId: null,
  });

  const { data: categories = [] } = useCategories();
  const { data: budgets = [], isLoading: loadingBudgets } = useBudgets(selectedMonth);
  const { data: prevBudgets = [] } = useBudgets(shiftMonth(selectedMonth, -1));
  const { data: debts = [] } = useDebts();
  const { data: scheduledTx = [] } = useScheduledTransactions();

  // Calculate Net Worth based on active balances
  const totalNetWorth = React.useMemo(() => {
    return walletBalances.reduce((sum, w) => sum + w.balance, 0);
  }, [walletBalances]);

  // Calculate month-to-date income and expense dynamically
  const { monthlyIncome, monthlyExpense } = React.useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach((t) => {
      if (t.type === "income") {
        income += t.amount;
      } else if (t.type === "expense") {
        expense += t.amount;
      }
    });

    return { monthlyIncome: income, monthlyExpense: expense };
  }, [transactions]);

  // Month-over-month expense change vs the previous financial month.
  const expenseDelta = React.useMemo(() => {
    const prevExpense = prevTransactions.reduce(
      (sum, t) => (t.type === "expense" ? sum + t.amount : sum),
      0
    );
    if (prevExpense <= 0) return null;
    const pct = Math.round(((monthlyExpense - prevExpense) / prevExpense) * 100);
    return { pct };
  }, [prevTransactions, monthlyExpense]);

  // Outstanding debt position (separate ledger from wallet balances).
  const { receivables, payables } = React.useMemo(() => {
    let receivables = 0;
    let payables = 0;
    debts.forEach((d) => {
      if (d.is_completed) return;
      if (d.type === "receivable") receivables += d.remaining_amount;
      else payables += d.remaining_amount;
    });
    return { receivables, payables };
  }, [debts]);
  const hasDebtPosition = receivables > 0 || payables > 0;

  // Upcoming & due: future scheduled transactions + open debts with a due date,
  // within the next 30 days (plus any already-overdue debts), nearest first.
  const upcomingItems = React.useMemo(() => {
    type Item = {
      id: string;
      title: string;
      date: string;
      amount: number;
      flow: "in" | "out" | "neutral";
      kind: "scheduled" | "debt";
      href: string;
    };
    const items: Item[] = [];

    scheduledTx.forEach((t) => {
      items.push({
        id: `s-${t.id}`,
        title:
          t.note ||
          t.category?.name ||
          (t.type === "transfer" ? `Transfer ke ${t.to_wallet?.name ?? ""}` : "Transaksi terjadwal"),
        date: t.occurred_at,
        amount: t.amount,
        flow: t.type === "income" ? "in" : t.type === "expense" ? "out" : "neutral",
        kind: "scheduled",
        href: "/scheduled",
      });
    });

    debts.forEach((d) => {
      if (d.is_completed || !d.due_date) return;
      items.push({
        id: `d-${d.id}`,
        title: d.name,
        date: d.due_date,
        amount: d.remaining_amount,
        flow: d.type === "receivable" ? "in" : "out",
        kind: "debt",
        href: "/debts",
      });
    });

    const horizon = nowMs + 30 * 86400000;
    return items
      .filter((it) => new Date(it.date).getTime() <= horizon)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 4);
  }, [scheduledTx, debts, nowMs]);

  const budgetProgress = React.useMemo(() => {
    const flat = categories.flatMap((p) => [p, ...p.subcategories]);
    const prevMonth = shiftMonth(selectedMonth, -1);
    const txs = [...transactions, ...prevTransactions];
    return budgets.map((b) => {
      const cat = flat.find((c) => c.id === b.category_id);
      const prevBudget = prevBudgets.find((p) => p.category_id === b.category_id);
      // Shared with the Budget page: subcategory spend and carry-over count.
      const usage = computeBudgetUsage(b, prevBudget, categories, txs, prevMonth);
      return {
        id: b.id,
        name: cat?.name || "Kategori Lain",
        iconStr: cat?.icon || "🏷️",
        percent: usage.percent,
        progress: Math.min(100, usage.percent),
        remaining: usage.remaining,
        status: usage.status,
      };
    });
  }, [budgets, prevBudgets, categories, transactions, prevTransactions, selectedMonth]);

  const activeMonthName = React.useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  // Delete immediately with an "Undo" toast — soft-delete lands in the 30-day
  // recycle bin, so this is safe and faster than a confirmation dialog.
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
          onClick: () => {
            restoreTx.mutate(tx.id, {
              onSuccess: () => toast.success("Transaksi dipulihkan"),
            });
          },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menghapus transaksi";
      toast.error(message);
    }
  };

  // Dashboard only ever shows a short preview; the full searchable/filterable
  // list lives on /transactions (see the "Lihat Semua" link below).
  const displayedTransactions = transactions.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* 1. Current household balance (all wallets, not month-scoped) */}
      <Link href="/wallets" className="block transition-all">
        {/* Fixed emerald→teal (both ~5.5:1 behind white text) so the headline
            card is colourful in either theme without new tokens. */}
        <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-700 p-5 text-center text-white space-y-1 shadow-md shadow-emerald-900/20 transition-all cursor-pointer hover:brightness-105">
          <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-12 -left-6 size-28 rounded-full bg-white/5" />
          <span className="relative text-xs text-white/85 font-medium">Saldo Keluarga Saat Ini</span>
          {loadingBalances ? (
            <div className="relative mx-auto h-9 w-48 animate-pulse rounded-xl bg-white/20" />
          ) : (
            <p className="relative text-3xl font-extrabold text-white tracking-tight">
              {formatCurrency(totalNetWorth)}
            </p>
          )}
          {!loadingBalances && hasDebtPosition && (
            <div className="relative flex items-center justify-center gap-3 pt-1 text-xs font-semibold">
              {receivables > 0 && (
                <span className="text-emerald-100">
                  + Piutang {formatGrouped(receivables)}
                </span>
              )}
              {payables > 0 && (
                <span className="text-rose-100">
                  − Utang {formatGrouped(payables)}
                </span>
              )}
            </div>
          )}
          <span className="relative inline-flex items-center justify-center gap-1 self-center rounded-full bg-white/15 px-3 py-1 mt-1.5 text-xs font-semibold text-white">
            <Wallet className="size-3" />
            Kelola &amp; tambah dompet
            <ChevronRight className="size-3" />
          </span>
        </Card>
      </Link>

      {/* 1b. Household pet — fed by recording transactions */}
      <PetCard />

      {/* 2. Month navigator — sits below the balance on purpose: the balance is
          "right now" and never changes with the month, everything below this
          bar is scoped to the selected financial month. */}
      <div className="flex items-center justify-between bg-card border rounded-2xl p-3 shadow-xs">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          aria-label="Bulan sebelumnya"
          className="size-9 rounded-xl hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div className="flex flex-col items-center">
          <span className="font-semibold text-foreground text-sm">{activeMonthName}</span>
          <span className="text-xs font-medium text-muted-foreground">
            {financialMonthRangeLabel(selectedMonth)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            aria-label="Bulan berikutnya"
            className="size-9 rounded-xl hover:bg-muted"
          >
            <ChevronRight className="size-5" />
          </Button>
          <Link
            href="/calendar"
            title="Buka kalender transaksi"
            aria-label="Buka kalender transaksi"
            className="grid size-9 place-items-center rounded-xl border bg-muted/30 text-mint-strong transition-colors hover:bg-muted"
          >
            <Calendar className="size-4" />
          </Link>
        </div>
      </div>

      {/* 3. Income & Expense mini cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/transactions?bulan=${selectedMonth}&tipe=income`} className="block">
          <Card className="h-full rounded-2xl border border-mint-strong/20 bg-mint-soft p-4 space-y-1 transition-colors hover:border-mint-strong/40">
            <div className="flex items-center gap-1 text-xs text-foreground/75 font-medium">
              <span className="grid size-5 place-items-center rounded-full bg-mint-strong text-on-mint">
                <ArrowUpRight className="size-3" />
              </span>
              Pemasukan
            </div>
            <p className="text-base font-bold text-income tracking-tight">
              {loadingTx ? "..." : `+${formatGrouped(monthlyIncome)}`}
            </p>
          </Card>
        </Link>

        <Link href={`/transactions?bulan=${selectedMonth}&tipe=expense`} className="block">
          <Card className="h-full rounded-2xl border border-expense/20 bg-expense-soft p-4 space-y-1 transition-colors hover:border-expense/40">
            <div className="flex items-center gap-1 text-xs text-foreground/75 font-medium">
              <span className="grid size-5 place-items-center rounded-full bg-expense text-on-expense">
                <ArrowDownRight className="size-3" />
              </span>
              Pengeluaran
            </div>
            <p className="text-base font-bold text-expense tracking-tight">
              {loadingTx ? "..." : `-${formatGrouped(monthlyExpense)}`}
            </p>
            {!loadingTx && expenseDelta && (
              <p
                className={`flex items-center gap-0.5 text-xs font-semibold ${
                  expenseDelta.pct > 0
                    ? "text-expense"
                    : expenseDelta.pct < 0
                    ? "text-income"
                    : "text-muted-foreground"
                }`}
              >
                {expenseDelta.pct > 0 ? (
                  <ArrowUpRight className="size-3" />
                ) : expenseDelta.pct < 0 ? (
                  <ArrowDownRight className="size-3" />
                ) : null}
                {expenseDelta.pct > 0 ? "+" : ""}
                {expenseDelta.pct}% vs bln lalu
              </p>
            )}
          </Card>
        </Link>
      </div>

      {/* 3b. Upcoming & due (scheduled transactions + debts with a due date) */}
      {upcomingItems.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CalendarClock className="size-3.5" /> Akan Datang & Jatuh Tempo
          </h2>
          <Card className="rounded-2xl border bg-card divide-y overflow-hidden">
            {upcomingItems.map((it) => {
              const due = dueLabel(it.date);
              return (
                <Link
                  key={it.id}
                  href={it.href}
                  className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                        it.kind === "debt"
                          ? "bg-warning-soft text-warning-strong"
                          : "bg-mint-soft text-mint-strong"
                      }`}
                    >
                      <CalendarClock className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{it.title}</p>
                      <p
                        className={`text-xs font-medium ${
                          due.tone === "overdue"
                            ? "text-expense"
                            : due.tone === "today" || due.tone === "soon"
                            ? "text-warning-strong"
                            : "text-muted-foreground"
                        }`}
                      >
                        {due.text} · {it.kind === "debt" ? "Utang/Piutang" : "Terjadwal"}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`shrink-0 text-right font-bold text-sm tracking-tight ${
                      it.flow === "in" ? "text-income" : it.flow === "out" ? "text-expense" : "text-foreground"
                    }`}
                  >
                    {it.flow === "in" ? "+" : it.flow === "out" ? "-" : ""}
                    {formatGrouped(it.amount)}
                  </p>
                </Link>
              );
            })}
          </Card>
        </div>
      )}

      {/* 4. Budget progress display */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Budget Bulan Ini
          </h2>
          <Link href="/budgets" className="text-xs text-mint-strong hover:underline">
            Lihat semua →
          </Link>
        </div>

        <Card className="rounded-2xl border bg-card p-4 space-y-3.5">
          {loadingBudgets ? (
            <div className="space-y-3.5 py-1">
              <BudgetCardSkeleton />
              <BudgetCardSkeleton />
            </div>
          ) : budgetProgress.length === 0 ? (
            <div className="text-center py-2 space-y-2">
              <p className="text-xs text-muted-foreground">Belum ada budget untuk bulan ini.</p>
              <Button size="sm" variant="outline" asChild className="h-8 text-xs rounded-xl">
                <Link href="/budgets">Atur Budget</Link>
              </Button>
            </div>
          ) : (
            // Most-used budgets first, so ones near or over the limit surface.
            [...budgetProgress].sort((a, b) => b.percent - a.percent).slice(0, 3).map((b) => {
              const BIcon = iconMap[b.iconStr];
              return (
                <div key={b.id} className="space-y-1">
                  <div className="flex justify-between gap-2 text-xs font-medium">
                    <span className="text-foreground flex min-w-0 items-center gap-1.5">
                      {BIcon ? (
                        <BIcon className="size-3.5 shrink-0" />
                      ) : (
                        <span className="text-sm leading-none select-none">{b.iconStr}</span>
                      )}
                      <span className="truncate">{b.name}</span>
                    </span>
                    <span
                      className={`shrink-0 ${
                        b.status === "over"
                          ? "font-semibold text-expense"
                          : b.status === "near"
                          ? "font-semibold text-warning-strong"
                          : "text-muted-foreground"
                      }`}
                    >
                      {b.percent}% · {b.remaining >= 0 ? "Sisa" : "Lewat"}{" "}
                      {formatGrouped(Math.abs(b.remaining))}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        b.status === "over"
                          ? "bg-expense"
                          : b.status === "near"
                          ? "bg-warning-strong"
                          : "bg-mint-strong"
                      }`}
                      style={{ width: `${b.progress}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* 5. Recent Transactions List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Transaksi Terakhir
          </h2>
          <Link
            href={`/transactions?bulan=${selectedMonth}`}
            className="text-xs text-mint-strong hover:underline"
          >
            Lihat semua →
          </Link>
        </div>

        {loadingTx ? (
          <TransactionListSkeleton count={3} />
        ) : transactions.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed rounded-2xl space-y-2.5">
            <span className="grid size-11 place-items-center rounded-full bg-mint-soft text-mint-strong">
              <Plus className="size-5" />
            </span>
            <div>
              <p className="font-semibold text-sm">Belum ada transaksi bulan ini</p>
              <p className="text-xs text-muted-foreground px-4">
                Catatanmu baru dimulai. Tap tombol + di bawah untuk mencatat pemasukan atau pengeluaran pertamamu.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => openQuickAdd("expense")}
              className="bg-mint-strong text-on-mint hover:bg-mint-strong/90 rounded-xl"
            >
              Catat Sekarang
            </Button>
          </Card>
        ) : (
          <div className="grid gap-2.5">
            {displayedTransactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                onOpen={setSelectedTxForDetail}
              />
            ))}

            {transactions.length > 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/transactions?bulan=${selectedMonth}`)}
                className="w-full text-xs text-mint-strong hover:bg-mint-soft/50 py-2.5 mt-1 rounded-xl font-semibold"
              >
                Lihat Semua ({transactions.length} Transaksi)
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Transaction Detail Dialog */}
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

/** Human due-date label + tone for the upcoming/due widget. */
function dueLabel(dateStr: string): {
  text: string;
  tone: "overdue" | "today" | "soon" | "future";
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(dateStr);
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dd.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { text: `Terlambat ${Math.abs(diffDays)} hari`, tone: "overdue" };
  if (diffDays === 0) return { text: "Jatuh tempo hari ini", tone: "today" };
  if (diffDays === 1) return { text: "Besok", tone: "soon" };
  if (diffDays <= 7) return { text: `${diffDays} hari lagi`, tone: "soon" };
  return { text: formatDateShort(d), tone: "future" };
}
