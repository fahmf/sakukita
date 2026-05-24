"use client";

import * as React from "react";
import Link from "next/link";
import { useWalletBalances } from "@/hooks/use-wallets";
import { useTransactions, useDeleteTransaction } from "@/hooks/use-transactions";
import { useBudgets } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { formatCurrency, formatRelative } from "@/lib/format";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Banknote,
  Utensils,
  Car,
  ShoppingBag,
  Gift,
  Heart,
  Receipt,
  CircleDot,
  Briefcase,
  TrendingUp,
  Landmark,
  Smartphone,
  CreditCard,
  PiggyBank,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Trash2,
  Search,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";
import { TransactionDetailDialog } from "@/components/transaction/transaction-detail-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { iconMap } from "@/lib/icons";
import { TransactionListSkeleton, BudgetCardSkeleton, NetWorthSkeleton } from "@/components/shared/skeletons";

export default function DashboardPage() {
  const { openQuickAdd, openEditTransaction } = useUIStore();
  const { data: walletBalances = [], isLoading: loadingBalances } = useWalletBalances();

  // Dynamic month selection state (initialized to first day of current month)
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });

  const [showAll, setShowAll] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [txToDelete, setTxToDelete] = React.useState<any>(null);

  const deleteTx = useDeleteTransaction();
  const allowed = useCanEdit();
  const router = useRouter();
  const [selectedTxForDetail, setSelectedTxForDetail] = React.useState<any>(null);

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

  // Convert selectedMonth to precise YYYY-MM-DD date string ranges for useTransactions
  const { startDate, endDate } = React.useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const firstDay = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDayNum = new Date(y, m, 0).getDate();
    const lastDay = `${y}-${String(m).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;
    return {
      startDate: firstDay,
      endDate: lastDay,
    };
  }, [selectedMonth]);

  const { data: transactions = [], isLoading: loadingTx } = useTransactions({
    period: "custom",
    startDate,
    endDate,
    walletId: null,
    categoryId: null,
  });

  const { data: categories = [] } = useCategories();
  const { data: budgets = [], isLoading: loadingBudgets } = useBudgets(selectedMonth);

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

  const budgetProgress = React.useMemo(() => {
    return budgets.map((b) => {
      const cat = categories.find((c) => c.id === b.category_id);
      let spent = 0;
      transactions.forEach((t) => {
        if (t.type === "expense" && t.category_id === b.category_id) {
          spent += t.amount;
        }
      });
      const progress = Math.min(100, Math.round((spent / b.amount) * 100));
      const remaining = b.amount - spent;
      return {
        id: b.id,
        name: cat?.name || "Kategori Lain",
        iconStr: cat?.icon || "circle-dashed",
        color: cat?.color || "#5FBF9A",
        amount: b.amount,
        spent,
        progress,
        remaining,
      };
    });
  }, [budgets, categories, transactions]);

  const activeMonthName = React.useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  // Handle transaction soft deletion confirmation
  const handleDeleteConfirm = async () => {
    if (!txToDelete) return;
    if (!allowed) {
      viewOnlyToast();
      setTxToDelete(null);
      return;
    }
    try {
      await deleteTx.mutateAsync(txToDelete.id);
      toast.success("Transaksi berhasil dihapus");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menghapus transaksi";
      toast.error(message);
    } finally {
      setTxToDelete(null);
    }
  };

  // Filter transactions based on searchQuery when showAll is true
  const displayedTransactions = React.useMemo(() => {
    const activeTx = transactions;
    if (!showAll) {
      return activeTx.slice(0, 10);
    }
    if (!searchQuery) {
      return activeTx;
    }
    const query = searchQuery.toLowerCase().trim();
    return activeTx.filter((t) => {
      const noteMatch = t.note?.toLowerCase().includes(query);
      const catMatch = t.category?.name?.toLowerCase().includes(query);
      const walletMatch = t.wallet?.name?.toLowerCase().includes(query);
      const toWalletMatch = t.to_wallet?.name?.toLowerCase().includes(query);
      const amountMatch = t.amount.toString().includes(query);
      return noteMatch || catMatch || walletMatch || toWalletMatch || amountMatch;
    });
  }, [transactions, showAll, searchQuery]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Month Navigator */}
      <div className="flex items-center justify-between bg-card border rounded-2xl p-3 shadow-xs">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          className="size-9 rounded-xl hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
          <Calendar className="size-4 text-mint-strong" />
          <span>{activeMonthName}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="size-9 rounded-xl hover:bg-muted"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {/* 2. Total Net Worth Monokrom Card */}
      <Link href="/wallets" className="block transition-all">
        <Card className="rounded-2xl border bg-card p-5 text-center space-y-1 hover:border-mint-strong/40 transition-all cursor-pointer">
          <span className="text-xs text-muted-foreground font-medium">Saldo Total Keluarga</span>
          {loadingBalances ? (
            <NetWorthSkeleton />
          ) : (
            <p className="text-3xl font-extrabold text-foreground tracking-tight">
              {formatCurrency(totalNetWorth)}
            </p>
          )}
        </Card>
      </Link>

      {/* 3. Income & Expense mini cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
            <span className="grid size-5 place-items-center rounded-full bg-mint-soft text-mint-strong">
              <ArrowUpRight className="size-3" />
            </span>
            Pemasukan
          </div>
          <p className="text-base font-bold text-income tracking-tight">
            {loadingTx ? "..." : `+${formatCurrency(monthlyIncome).replace("Rp", "").trim()}`}
          </p>
        </Card>

        <Card className="rounded-2xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
            <span className="grid size-5 place-items-center rounded-full bg-red-50 dark:bg-red-950/20 text-expense">
              <ArrowDownRight className="size-3" />
            </span>
            Pengeluaran
          </div>
          <p className="text-base font-bold text-expense tracking-tight">
            {loadingTx ? "..." : `-${formatCurrency(monthlyExpense).replace("Rp", "").trim()}`}
          </p>
        </Card>
      </div>

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
            budgetProgress.slice(0, 3).map((b) => {
              const BIcon = iconMap[b.iconStr] || CircleDot;
              return (
                <div key={b.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground flex items-center gap-1.5">
                      <BIcon className="size-3.5" style={{ color: b.color }} /> {b.name}
                    </span>
                    <span className="text-muted-foreground">
                      {b.progress}% ({b.remaining >= 0 ? "Sisa" : "Over"} {formatCurrency(Math.abs(b.remaining)).replace("Rp", "").trim()})
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${b.progress}%`, backgroundColor: b.color }}
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
            {showAll ? "Semua Transaksi" : "Transaksi Terakhir"}
          </h2>
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
              className="bg-mint-strong text-white hover:bg-mint-strong/90 rounded-xl"
            >
              Catat Sekarang
            </Button>
          </Card>
        ) : (
          <div className="grid gap-2.5">
            {showAll && (
              <div className="relative mb-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari berdasarkan catatan, kategori, dll..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-mint-strong focus:border-mint-strong transition-all"
                />
              </div>
            )}

            {displayedTransactions.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-2xl bg-card">
                <p className="text-xs text-muted-foreground">Tidak ada transaksi yang cocok.</p>
              </div>
            ) : (
              displayedTransactions.map((tx) => {
                const isExpense = tx.type === "expense";
                const isIncome = tx.type === "income";
                const isTransfer = tx.type === "transfer";

                let bgColor = "#C4C4C4";
                const hasMappedIcon = !isTransfer && tx.category && iconMap[tx.category.icon || ""];
                const categoryIcon = tx.category?.icon || "🏷️";

                if (isTransfer) {
                  bgColor = "#A8A29E";
                } else if (tx.category) {
                  bgColor = tx.category.color || "#C4C4C4";
                }

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-2xl border bg-card p-3.5 transition-all hover:border-mint-strong/20 min-w-0"
                  >
                    <div 
                      onClick={() => setSelectedTxForDetail(tx)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none active:opacity-70 transition-opacity"
                    >
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
                        <p className="text-xs text-muted-foreground font-medium">
                          {tx.wallet?.name} · {formatRelative(tx.occurred_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                      <div 
                        onClick={() => setSelectedTxForDetail(tx)}
                        className="text-right cursor-pointer select-none pr-1 active:opacity-70 transition-opacity"
                      >
                        <p
                          className={`font-bold text-sm tracking-tight ${
                            isIncome ? "text-income" : isExpense ? "text-expense" : "text-foreground"
                          }`}
                        >
                          {isIncome ? "+" : isExpense ? "-" : ""}
                          {formatCurrency(tx.amount).replace("Rp", "").trim()}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (!allowed) {
                            viewOnlyToast();
                          } else {
                            openEditTransaction(tx);
                          }
                        }}
                        className="size-8 rounded-lg text-muted-foreground hover:text-mint-strong hover:bg-mint-soft/50 transition-colors"
                        aria-label="Ubah transaksi"
                      >
                        <Pencil className="size-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTxToDelete(tx)}
                        className="size-8 rounded-lg text-muted-foreground hover:text-expense hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        aria-label="Hapus transaksi"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}

            {transactions.length > 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/transactions")}
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
        onDelete={setTxToDelete}
      />

      {/* Confirmation Dialog for Transaction Deletion */}
      {txToDelete !== null && (
        <Dialog
          open={txToDelete !== null}
          onOpenChange={(o) => !o && setTxToDelete(null)}
        >
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Hapus transaksi ini?</DialogTitle>
              <DialogDescription>
                Transaksi sebesar{" "}
                <span className="font-semibold text-foreground">
                  {txToDelete ? formatCurrency(txToDelete.amount) : ""}
                </span>{" "}
                ({txToDelete?.note || txToDelete?.category?.name || "Tanpa catatan"}) akan dipindahkan ke Recycle Bin selama 30 hari.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-xl h-11"
                onClick={() => setTxToDelete(null)}
              >
                Batal
              </Button>
              <Button
                className="rounded-xl h-11 bg-expense text-white hover:bg-expense/90"
                onClick={handleDeleteConfirm}
                disabled={deleteTx.isPending}
              >
                {deleteTx.isPending ? "Menghapus..." : "Ya, Hapus"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
