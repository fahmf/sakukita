"use client";

import * as React from "react";
import Link from "next/link";
import { useWalletBalances } from "@/hooks/use-wallets";
import { useTransactions } from "@/hooks/use-transactions";
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
} from "lucide-react";

// Icons map for rendering categories
const iconMap: Record<string, any> = {
  utensils: Utensils,
  car: Car,
  "shopping-bag": ShoppingBag,
  "party-popper": Gift,
  "heart-pulse": Heart,
  receipt: Receipt,
  wallet: Briefcase,
  gift: Gift,
  "circle-dashed": CircleDot,
};

export default function DashboardPage() {
  const { openQuickAdd } = useUIStore();
  const { data: walletBalances = [], isLoading: loadingBalances } = useWalletBalances();
  const { data: transactions = [], isLoading: loadingTx } = useTransactions({
    period: "this-month",
    startDate: null,
    endDate: null,
    walletId: null,
    categoryId: null,
  });
  const { data: categories = [] } = useCategories();

  const activeMonthStr = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);
  const { data: budgets = [], isLoading: loadingBudgets } = useBudgets(activeMonthStr);

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
    return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date());
  }, []);

  return (
    <div className="space-y-6">
      {/* 1. Header & Month Selector */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Bulan Ini
          </span>
          <h1 className="text-xl font-bold text-foreground">{activeMonthName}</h1>
        </div>
      </div>

      {/* 2. Total Net Worth Monokrom Card */}
      <Link href="/wallets" className="block transition-all">
        <Card className="rounded-2xl border bg-card p-5 text-center space-y-1 hover:border-mint-strong/40 transition-all cursor-pointer">
          <span className="text-xs text-muted-foreground font-medium">Saldo Total Keluarga</span>
          {loadingBalances ? (
            <div className="h-8 flex items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
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
             <div className="h-10 bg-muted animate-pulse rounded-full w-full" />
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
            Transaksi Terakhir
          </h2>
        </div>

        {loadingTx ? (
          <div className="space-y-3">
            <div className="h-16 bg-muted animate-pulse rounded-2xl" />
            <div className="h-16 bg-muted animate-pulse rounded-2xl" />
          </div>
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
            {transactions.slice(0, 10).map((tx) => {
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
                      <p className="text-xs text-muted-foreground font-medium">
                        {tx.wallet?.name} · {formatRelative(tx.occurred_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 pl-2">
                    <p
                      className={`font-bold text-sm tracking-tight ${
                        isIncome ? "text-income" : isExpense ? "text-expense" : "text-foreground"
                      }`}
                    >
                      {isIncome ? "+" : isExpense ? "-" : ""}
                      {formatCurrency(tx.amount).replace("Rp", "").trim()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
