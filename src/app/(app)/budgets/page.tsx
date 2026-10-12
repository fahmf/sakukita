"use client";

import * as React from "react";
import Link from "next/link";
import { useCategories } from "@/hooks/use-categories";
import { useBudgets, useSetBudget, useDeleteBudget } from "@/hooks/use-budgets";
import { useTransactions } from "@/hooks/use-transactions";
import { formatCurrency } from "@/lib/format";
import { currentFinancialMonth, shiftMonth, isInFinancialMonth, financialMonthRangeLabel } from "@/lib/financial-month";
import { PageHeading } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PiggyBank,
  Scale,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Info,
  ListFilter,
} from "lucide-react";
import { toast } from "sonner";
import { parseAmountExpression } from "@/lib/calculator";
import type { Category } from "@/lib/supabase/types";
import { BudgetCardSkeleton } from "@/components/shared/skeletons";

export default function BudgetsPage() {
  const [selectedMonth, setSelectedMonth] = React.useState(() => currentFinancialMonth());
  
  // Budget states
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [inputAmount, setInputAmount] = React.useState("");
  const [carryOver, setCarryOver] = React.useState(false);

  // Load custom hooks
  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const { data: budgets = [], isLoading: loadingBudgets } = useBudgets();
  const { data: transactions = [], isLoading: loadingTxs } = useTransactions();

  const setBudgetMutation = useSetBudget();
  const deleteBudgetMutation = useDeleteBudget();

  // Helper: Prev month string
  const prevMonthStr = React.useMemo(() => shiftMonth(selectedMonth, -1), [selectedMonth]);

  // Helpers: Format date for header Indonesian
  const monthLabel = React.useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  // Navigation handlers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`);
  };

  // Evaluation of inline math expressions
  const parsedPreview = React.useMemo(() => {
    if (!inputAmount.trim()) return null;
    const parsed = parseAmountExpression(inputAmount);
    return parsed;
  }, [inputAmount]);

  // Map subcategories flatly to search them easily
  const flatCategories = React.useMemo(() => {
    const list: Category[] = [];
    categories.forEach((parent) => {
      list.push(parent);
      if (parent.subcategories) {
        parent.subcategories.forEach((sub) => list.push(sub));
      }
    });
    return list;
  }, [categories]);

  // Calculate budgets status: limit, spent, carry over details
  const budgetsAnalysis = React.useMemo(() => {
    return flatCategories.map((cat) => {
      // Find current budget
      const curBudget = budgets.find(
        (b) => b.category_id === cat.id && b.period_month === selectedMonth
      );

      // Find previous budget
      const prevBudget = budgets.find(
        (b) => b.category_id === cat.id && b.period_month === prevMonthStr
      );

      // Category transactions in current month
      // Sum this category and subcategories (if this is a parent category)
      const childIds = cat.parent_id === null
        ? (categories.find((c) => c.id === cat.id)?.subcategories || []).map((s) => s.id)
        : [];
      const targetIds = [cat.id, ...childIds];

      const spent = transactions
        .filter(
          (t) =>
            t.type === "expense" &&
            t.category_id &&
            targetIds.includes(t.category_id) &&
            isInFinancialMonth(t.occurred_at, selectedMonth)
        )
        .reduce((sum, t) => sum + t.amount, 0);

      // Previous spent for carry over calculation
      const prevSpent = transactions
        .filter(
          (t) =>
            t.type === "expense" &&
            t.category_id &&
            targetIds.includes(t.category_id) &&
            isInFinancialMonth(t.occurred_at, prevMonthStr)
        )
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate carry over limit
      let carryOverAmount = 0;
      if (curBudget?.carry_over && prevBudget) {
        // If previous budget was positive and we had money left, carry it over
        const prevLimit = prevBudget.amount;
        // Wait, does previous budget carry over from its prior month?
        // To be accurate and keep it offline-local, we calculate previous remaining:
        const prevRemaining = prevLimit - prevSpent;
        if (prevRemaining > 0) {
          carryOverAmount = prevRemaining;
        }
      }

      const limit = curBudget ? curBudget.amount : 0;
      const totalLimit = limit + carryOverAmount;
      const remaining = totalLimit - spent;
      const progressPercent = totalLimit > 0 ? (spent / totalLimit) * 100 : 0;

      // Determine aesthetic HSL colors:
      // Mint green if < 80%, Butter yellow if 80-100%, Dusty rose if > 100%
      let progressColor = "#B8E6D3"; // Mint
      let progressTextColor = "#2C6E52";
      let progressBgColor = "rgba(184, 230, 211, 0.2)";

      if (progressPercent >= 80 && progressPercent <= 100) {
        progressColor = "#F4D2A6"; // Yellow
        progressTextColor = "#7E5724";
        progressBgColor = "rgba(244, 210, 166, 0.2)";
      } else if (progressPercent > 100) {
        progressColor = "#E8A5A5"; // Red/Rose
        progressTextColor = "#7C3A3A";
        progressBgColor = "rgba(232, 165, 165, 0.2)";
      }

      return {
        category: cat,
        budget: curBudget,
        limit,
        carryOverAmount,
        totalLimit,
        spent,
        remaining,
        progressPercent,
        progressColor,
        progressTextColor,
        progressBgColor,
      };
    });
  }, [flatCategories, budgets, selectedMonth, prevMonthStr, transactions, categories]);

  // Separate active budgeted items and unbudgeted items
  const { budgetedItems, unbudgetedItems } = React.useMemo(() => {
    const active = budgetsAnalysis.filter((item) => item.budget !== undefined);
    const inactive = budgetsAnalysis.filter((item) => item.budget === undefined);
    return { budgetedItems: active, unbudgetedItems: inactive };
  }, [budgetsAnalysis]);

  // Budgets are stored per financial month, so a new cycle starts empty (and
  // budget alerts go quiet) until they are set again. Offer to copy the most
  // recent month that has budgets, limited to categories that still exist.
  const copySource = React.useMemo(() => {
    if (budgets.some((b) => b.period_month === selectedMonth)) return null;
    const activeIds = new Set(flatCategories.map((c) => c.id));
    const earlier = budgets
      .filter((b) => b.period_month < selectedMonth && activeIds.has(b.category_id))
      .map((b) => b.period_month)
      .sort();
    const month = earlier[earlier.length - 1];
    if (!month) return null;
    const rows = budgets.filter((b) => b.period_month === month && activeIds.has(b.category_id));
    const [y, m] = month.split("-").map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    return { month, label, rows };
  }, [budgets, selectedMonth, flatCategories]);

  const [copying, setCopying] = React.useState(false);
  const handleCopyBudgets = async () => {
    if (!copySource) return;
    setCopying(true);
    try {
      for (const b of copySource.rows) {
        await setBudgetMutation.mutateAsync({
          category_id: b.category_id,
          amount: Number(b.amount),
          period_month: selectedMonth,
          carry_over: b.carry_over,
        });
      }
      toast.success(`${copySource.rows.length} budget disalin dari ${copySource.label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyalin budget.");
    } finally {
      setCopying(false);
    }
  };

  // Open "Atur Budget" dialog
  const handleOpenSetup = (cat: Category) => {
    const item = budgetsAnalysis.find((x) => x.category.id === cat.id);
    setEditingCategory(cat);
    setInputAmount(item?.budget ? String(item.budget.amount) : "");
    setCarryOver(item?.budget ? item.budget.carry_over : false);
    setDialogOpen(true);
  };

  // Submit Handler
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    const parsed = parseAmountExpression(inputAmount);
    if (parsed === null || parsed <= 0) {
      toast.error("Format nominal tidak valid. Contoh: 500000 atau 300000 + 200000");
      return;
    }

    try {
      await setBudgetMutation.mutateAsync({
        category_id: editingCategory.id,
        amount: parsed,
        period_month: selectedMonth,
        carry_over: carryOver,
      });
      toast.success(`Budget ${editingCategory.name} berhasil disimpan!`);
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan budget.");
    }
  };

  // Delete Handler
  const handleDeleteBudget = async () => {
    if (!editingCategory) return;
    const item = budgetedItems.find((x) => x.category.id === editingCategory.id);
    if (!item?.budget) return;

    try {
      await deleteBudgetMutation.mutateAsync(item.budget.id);
      toast.success(`Budget ${editingCategory.name} berhasil dihapus.`);
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus budget.");
    }
  };

  const isLoading = loadingCategories || loadingBudgets || loadingTxs;

  return (
    <div className="max-w-md mx-auto min-h-dvh flex flex-col space-y-5 pb-20">
      <PageHeading
        back="/more"
        title="Rencana"
        subtitle="Budget bulanan, tabungan, dan utang-piutang"
      />

      {/* Rencana = budgets here, plus the other two planning ledgers. */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: "/savings", label: "Tabungan", hint: "Target impian", icon: PiggyBank, tone: "bg-mint-soft text-mint-strong" },
          { href: "/debts", label: "Utang & Piutang", hint: "Pinjaman keluarga", icon: Scale, tone: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex items-center gap-2.5 rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/40"
          >
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${t.tone}`}>
              <t.icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{t.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{t.hint}</span>
            </span>
          </Link>
        ))}
      </div>

        <>
          {/* Month Navigator Header */}
          <div className="flex items-center justify-between bg-card border rounded-2xl p-4 shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              className="size-9 rounded-xl hover:bg-muted"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <Calendar className="size-4 text-mint-strong" />
                <span>{monthLabel}</span>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">
                {financialMonthRangeLabel(selectedMonth)}
              </span>
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

          {isLoading ? (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <BudgetCardSkeleton />
              <BudgetCardSkeleton />
              <BudgetCardSkeleton />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Budgets List */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Batas Pengeluaran Aktif ({budgetedItems.length})
                </h3>

                {budgetedItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-8 text-center bg-card/50 space-y-3">
                    <div className="grid size-12 place-items-center rounded-2xl bg-muted/40 mx-auto text-muted-foreground">
                      <PiggyBank className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-muted-foreground">Belum ada budget bulan ini</p>
                      <p className="text-xs text-muted-foreground">
                        Atur batas limit di kategori di bawah untuk menjaga pengeluaran Anda.
                      </p>
                    </div>
                    {copySource && (
                      <Button
                        type="button"
                        onClick={handleCopyBudgets}
                        disabled={copying}
                        className="h-10 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold text-xs gap-1.5"
                      >
                        {copying ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="size-3.5" />
                        )}
                        Salin {copySource.rows.length} budget dari {copySource.label}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {budgetedItems.map((item) => {
                      const overspent = item.spent > item.totalLimit;
                      const isNearLimit = !overspent && item.spent >= item.totalLimit * 0.8;

                      return (
                        <div
                          key={item.category.id}
                          className="rounded-2xl border bg-card p-4 space-y-3 transition-all hover:border-muted-foreground/20"
                        >
                          {/* Budget Details Row */}
                          <div className="flex items-start justify-between min-w-0">
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className="grid size-10 shrink-0 place-items-center rounded-xl text-white font-semibold"
                                style={{ backgroundColor: item.category.color || "#5FBF9A" }}
                              >
                                <span className="text-lg">{item.category.icon || "🏷️"}</span>
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-sm truncate text-foreground">
                                    {item.category.name}
                                  </p>
                                  {item.category.parent_id !== null && (
                                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
                                      Sub
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                  <span>Terpakai {formatCurrency(item.spent)}</span>
                                  <span>•</span>
                                  <span>Limit {formatCurrency(item.totalLimit)}</span>
                                </div>
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenSetup(item.category)}
                              className="h-8 text-xs font-semibold rounded-xl text-mint-strong hover:text-mint-strong/80 hover:bg-mint-strong/5 shrink-0 px-3"
                            >
                              Atur
                            </Button>
                          </div>

                          {/* Carry Over Alert Badge */}
                          {item.carryOverAmount > 0 && (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-xl">
                              <Sparkles className="size-3.5 shrink-0" />
                              <span>
                                Termasuk sisa bulan lalu: <strong>{formatCurrency(item.carryOverAmount)}</strong>
                              </span>
                            </div>
                          )}

                          {/* Progress Bar */}
                          <div className="space-y-1">
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden relative">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(item.progressPercent, 100)}%`,
                                  backgroundColor: item.progressColor,
                                }}
                              />
                            </div>

                            {/* Limit warnings / indicators */}
                            <div className="flex justify-between items-center text-[10px] font-medium">
                              <span
                                className="px-1.5 py-0.5 rounded-md"
                                style={{
                                  backgroundColor: item.progressBgColor,
                                  color: item.progressTextColor,
                                }}
                              >
                                {Math.round(item.progressPercent)}% limit
                              </span>
                              {overspent ? (
                                <span className="text-red-500 font-semibold flex items-center gap-0.5">
                                  <TrendingDown className="size-3" />
                                  Melebihi limit {formatCurrency(Math.abs(item.remaining))}
                                </span>
                              ) : isNearLimit ? (
                                <span className="text-amber-500 font-semibold">
                                  Mendekati limit! Sisa {formatCurrency(item.remaining)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Sisa {formatCurrency(item.remaining)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Unbudgeted Categories */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Kategori Tanpa Batas Limit ({unbudgetedItems.length})
                </h3>

                {unbudgetedItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1">Semua kategori sudah memiliki batas limit.</p>
                ) : (
                  <div className="grid gap-2">
                    {unbudgetedItems.map((item) => (
                      <div
                        key={item.category.id}
                        onClick={() => handleOpenSetup(item.category)}
                        className="flex items-center justify-between rounded-xl border bg-card p-3 transition-all hover:border-mint-strong/30 cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="grid size-9 shrink-0 place-items-center rounded-xl text-white font-semibold"
                            style={{ backgroundColor: item.category.color || "#C4C4C4" }}
                          >
                            <span className="text-base">{item.category.icon || "🏷️"}</span>
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-xs truncate text-foreground">
                                {item.category.name}
                              </p>
                              {item.category.parent_id !== null && (
                                <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  Sub
                                </span>
                              )}
                            </div>
                            {item.spent > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                Terpakai {formatCurrency(item.spent)} bulan ini
                              </p>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-8 rounded-xl bg-muted/60 text-muted-foreground hover:bg-mint-strong hover:text-white shrink-0"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>

      {/* Set Budget Dialog Overlay */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="grid size-8 place-items-center rounded-lg text-white text-sm"
                style={{ backgroundColor: editingCategory?.color || "#5FBF9A" }}
              >
                {editingCategory?.icon || "🏷️"}
              </span>
              <span>Batas Limit {editingCategory?.name}</span>
            </DialogTitle>
          </DialogHeader>

          {editingCategory && (
            <form onSubmit={handleSaveBudget} className="space-y-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="budget_amount">Batas Pengeluaran Bulanan (Rp)</Label>
                <div className="relative">
                  <Input
                    id="budget_amount"
                    placeholder="Contoh: 500000 atau 350000 * 2"
                    value={inputAmount}
                    onChange={(e) => setInputAmount(e.target.value)}
                    className="h-11 rounded-xl pr-3"
                    required
                    autoFocus
                  />
                </div>
                {/* Real-time Math Expression Evaluation Preview */}
                {parsedPreview !== null && (
                  <p className="text-xs text-mint-strong font-semibold flex items-center gap-1 mt-0.5">
                    <Sparkles className="size-3.5" />
                    <span>Hasil evaluasi: {formatCurrency(parsedPreview)}</span>
                  </p>
                )}
              </div>

              {/* Carry Over Settings */}
              <div className="flex items-center justify-between border rounded-2xl p-4 bg-muted/30">
                <div className="space-y-0.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="carry_over_toggle" className="font-semibold text-xs text-foreground cursor-pointer">
                      Akumulasi Sisa Bulan Lalu
                    </Label>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Jika aktif, sisa dana tak terpakai di bulan lalu otomatis ditambahkan ke batas limit bulan ini.
                  </p>
                </div>
                <Switch
                  id="carry_over_toggle"
                  checked={carryOver}
                  onCheckedChange={setCarryOver}
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={setBudgetMutation.isPending}
                  className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold"
                >
                  {setBudgetMutation.isPending ? "Menyimpan..." : "Simpan Batas Limit"}
                </Button>

                {/* Show delete button if budget exists */}
                {budgetedItems.some((x) => x.category.id === editingCategory.id) && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDeleteBudget}
                    disabled={deleteBudgetMutation.isPending}
                    className="h-10 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold"
                  >
                    {deleteBudgetMutation.isPending ? "Menghapus..." : "Hapus Batas Limit"}
                  </Button>
                )}

                <Link
                  href={`/transactions?kategori=${editingCategory.id}&bulan=${selectedMonth}`}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-mint-strong hover:bg-mint-soft/40 transition-colors"
                >
                  <ListFilter className="size-3.5" />
                  Lihat transaksi {editingCategory.name} bulan ini
                </Link>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
