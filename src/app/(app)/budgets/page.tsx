"use client";

import * as React from "react";
import { useCategories } from "@/hooks/use-categories";
import { useBudgets, useSetBudget, useDeleteBudget } from "@/hooks/use-budgets";
import { useTransactions } from "@/hooks/use-transactions";
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from "@/hooks/use-goals";
import { formatCurrency } from "@/lib/format";
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
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { parseAmountExpression } from "@/lib/calculator";
import {
  getActivePeriodKey,
  shiftPeriodKey,
  getPeriodKeyForDate,
  formatPeriodLabel,
  formatPeriodRangeLabel,
} from "@/lib/period";
import type { Category, SavingsGoal } from "@/lib/supabase/types";
import { BudgetCardSkeleton, GoalListSkeleton } from "@/components/shared/skeletons";

export default function BudgetsPage() {
  const [activeTab, setActiveTab] = React.useState<"budgets" | "goals">("budgets");
  // Periode keuangan (siklus gajian — lihat lib/period.ts); kunci tetap
  // "YYYY-MM-01" agar kompatibel dengan budgets.period_month.
  const [selectedMonth, setSelectedMonth] = React.useState(() => getActivePeriodKey());
  
  // Budget states
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [inputAmount, setInputAmount] = React.useState("");
  const [carryOver, setCarryOver] = React.useState(false);

  // Goal states
  const [goalDialogOpen, setGoalDialogOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<SavingsGoal | null>(null);
  const [goalName, setGoalName] = React.useState("");
  const [goalTargetAmount, setGoalTargetAmount] = React.useState("");
  const [goalCurrentAmount, setGoalCurrentAmount] = React.useState("");
  const [goalTargetDate, setGoalTargetDate] = React.useState("");
  const [goalEmoji, setGoalEmoji] = React.useState("🎯");
  const [goalColor, setGoalColor] = React.useState("#5FBF9A");

  // Quick Deposit states
  const [depositDialogOpen, setDepositDialogOpen] = React.useState(false);
  const [depositingGoal, setDepositingGoal] = React.useState<SavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = React.useState("");

  // Load custom hooks
  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const { data: budgets = [], isLoading: loadingBudgets } = useBudgets();
  const { data: transactions = [], isLoading: loadingTxs } = useTransactions();

  // Load goals hooks
  const { data: goals = [], isLoading: loadingGoals } = useGoals();
  const createGoalMutation = useCreateGoal();
  const updateGoalMutation = useUpdateGoal();
  const deleteGoalMutation = useDeleteGoal();

  const setBudgetMutation = useSetBudget();
  const deleteBudgetMutation = useDeleteBudget();

  // Helper: Prev period string
  const prevMonthStr = React.useMemo(
    () => shiftPeriodKey(selectedMonth, -1),
    [selectedMonth]
  );

  // Helpers: Format date for header Indonesian
  const monthLabel = React.useMemo(
    () => formatPeriodLabel(selectedMonth),
    [selectedMonth]
  );
  const periodRangeLabel = React.useMemo(
    () => formatPeriodRangeLabel(selectedMonth),
    [selectedMonth]
  );

  // Navigation handlers
  const handlePrevMonth = () => setSelectedMonth(shiftPeriodKey(selectedMonth, -1));
  const handleNextMonth = () => setSelectedMonth(shiftPeriodKey(selectedMonth, 1));

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
    // Periode gajian + zona Jakarta (perbandingan startsWith pada ISO string
    // UTC salah menggolongkan transaksi dini hari WIB ke bulan sebelumnya)
    const isSameMonth = (dateStr: string, monthStr: string) => {
      return getPeriodKeyForDate(dateStr) === monthStr;
    };

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
            isSameMonth(t.occurred_at, selectedMonth)
        )
        .reduce((sum, t) => sum + t.amount, 0);

      // Previous spent for carry over calculation
      const prevSpent = transactions
        .filter(
          (t) =>
            t.type === "expense" &&
            t.category_id &&
            targetIds.includes(t.category_id) &&
            isSameMonth(t.occurred_at, prevMonthStr)
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

  // Open create goal
  const handleOpenCreateGoal = () => {
    setEditingGoal(null);
    setGoalName("");
    setGoalTargetAmount("");
    setGoalCurrentAmount("0");
    setGoalTargetDate("");
    setGoalEmoji("🎯");
    setGoalColor("#5FBF9A");
    setGoalDialogOpen(true);
  };

  // Open edit goal
  const handleOpenEditGoal = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setGoalTargetAmount(String(goal.target_amount));
    setGoalCurrentAmount(String(goal.current_amount));
    setGoalTargetDate(goal.target_date || "");
    setGoalEmoji(goal.icon || "🎯");
    setGoalColor(goal.color || "#5FBF9A");
    setGoalDialogOpen(true);
  };

  // Save Goal Handler
  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim()) {
      toast.error("Nama target tidak boleh kosong.");
      return;
    }

    const targetVal = parseAmountExpression(goalTargetAmount);
    const currentVal = parseAmountExpression(goalCurrentAmount) || 0;

    if (targetVal === null || targetVal <= 0) {
      toast.error("Format nominal target tidak valid. Contoh: 15000000 atau 5000000 * 3");
      return;
    }

    try {
      if (editingGoal) {
        await updateGoalMutation.mutateAsync({
          id: editingGoal.id,
          name: goalName,
          target_amount: targetVal,
          current_amount: currentVal,
          target_date: goalTargetDate || null,
          icon: goalEmoji,
          color: goalColor,
        });
        toast.success(`Target ${goalName} berhasil diperbarui!`);
      } else {
        await createGoalMutation.mutateAsync({
          name: goalName,
          target_amount: targetVal,
          current_amount: currentVal,
          target_date: goalTargetDate || null,
          icon: goalEmoji,
          color: goalColor,
        });
        toast.success(`Target ${goalName} berhasil ditambahkan!`);
      }
      setGoalDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan target tabungan.");
    }
  };

  // Delete Goal Handler
  const handleDeleteGoal = async () => {
    if (!editingGoal) return;
    try {
      await deleteGoalMutation.mutateAsync(editingGoal.id);
      toast.success(`Target ${editingGoal.name} berhasil dihapus.`);
      setGoalDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus target tabungan.");
    }
  };

  // Deposit Handler
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositingGoal) return;
    const parsed = parseAmountExpression(depositAmount);
    if (parsed === null || parsed <= 0) {
      toast.error("Format nominal setoran tidak valid.");
      return;
    }
    
    try {
      const newAmount = depositingGoal.current_amount + parsed;
      await updateGoalMutation.mutateAsync({
        id: depositingGoal.id,
        name: depositingGoal.name,
        target_amount: depositingGoal.target_amount,
        current_amount: newAmount,
        target_date: depositingGoal.target_date,
        icon: depositingGoal.icon,
        color: depositingGoal.color,
      });
      toast.success(`Berhasil menyetor ${formatCurrency(parsed)} ke ${depositingGoal.name}!`);
      setDepositDialogOpen(false);
      setDepositAmount("");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyetor dana.");
    }
  };

  // Helper for Circular Progress Ring
  const renderProgressCircle = (current: number, target: number, color: string, emoji: string) => {
    const percent = target > 0 ? (current / target) * 100 : 0;
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (Math.min(percent, 100) / 100) * circumference;

    return (
      <div className="relative size-12 shrink-0 flex items-center justify-center select-none">
        <svg className="size-12 -rotate-90 absolute inset-0">
          <circle
            className="text-muted/15 dark:text-muted/10"
            strokeWidth={3}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="24"
            cy="24"
          />
          <circle
            strokeWidth={3}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke={color}
            fill="transparent"
            r={radius}
            cx="24"
            cy="24"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <span className="text-base z-10">{emoji}</span>
      </div>
    );
  };

  // Helper to calculate monthly required
  const calculateMonthlyRequired = (current: number, target: number, dateStr: string) => {
    const remaining = target - current;
    if (remaining <= 0) return null;
    
    const targetDate = new Date(dateStr);
    const today = new Date();
    
    const yearsDiff = targetDate.getFullYear() - today.getFullYear();
    const monthsDiff = targetDate.getMonth() - today.getMonth();
    const totalMonths = yearsDiff * 12 + monthsDiff;
    
    if (totalMonths <= 0) {
      return <span className="text-amber-500 font-semibold">• Sisa bulan ini</span>;
    }
    
    const requiredPerMonth = remaining / totalMonths;
    return (
      <span className="text-mint-strong font-semibold dark:text-mint-soft">
        • Butuh {formatCurrency(requiredPerMonth)}/bln
      </span>
    );
  };

  const isLoading = loadingCategories || loadingBudgets || loadingTxs;

  return (
    <div className="max-w-md mx-auto min-h-dvh flex flex-col space-y-5 pb-20">
      <PageHeading
        title="Budget & Tabungan"
        subtitle="Kelola anggaran belanja dan target tabungan Anda"
      />

      {/* Tabs Control */}
      <div className="grid grid-cols-2 p-1 bg-muted/40 backdrop-blur-xs rounded-xl border border-muted select-none">
        <button
          onClick={() => setActiveTab("budgets")}
          className={`h-9 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "budgets"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Anggaran Belanja
        </button>
        <button
          onClick={() => setActiveTab("goals")}
          className={`h-9 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "goals"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Target Tabungan
        </button>
      </div>

      {activeTab === "budgets" ? (
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
            <div className="flex flex-col items-center font-semibold text-foreground text-sm">
              <span className="flex items-center gap-2">
                <Calendar className="size-4 text-mint-strong" />
                {monthLabel}
              </span>
              {periodRangeLabel && (
                <span className="text-[10px] font-normal text-muted-foreground">
                  {periodRangeLabel}
                </span>
              )}
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
      ) : (
        <>
          {/* Savings Goals Content */}
          <div className="flex items-center justify-between bg-card border rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <PiggyBank className="size-5 text-mint-strong" />
              <span className="font-bold text-foreground text-sm">Target Tabungan Impian</span>
            </div>
            <Button
              onClick={handleOpenCreateGoal}
              className="h-8 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 gap-1.5 text-xs font-semibold px-3"
            >
              <Plus className="size-3.5" /> Target Baru
            </Button>
          </div>

          {loadingGoals ? (
            <GoalListSkeleton count={3} />
          ) : (
            <div className="space-y-4">
              {goals.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center bg-card/50 space-y-3">
                  <div className="grid size-12 place-items-center rounded-2xl bg-muted/40 mx-auto text-muted-foreground">
                    <PiggyBank className="size-6 text-mint-strong" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground">Belum ada target tabungan</p>
                    <p className="text-xs text-muted-foreground">
                      Mulai wujudkan impian Anda dengan membuat target tabungan baru sekarang.
                    </p>
                  </div>
                  <Button
                    onClick={handleOpenCreateGoal}
                    className="h-9 px-4 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 text-xs font-semibold gap-1.5"
                  >
                    <Plus className="size-4" /> Buat Target Baru
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {goals.map((goal) => {
                    const percent = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
                    return (
                      <div
                        key={goal.id}
                        className="rounded-2xl border bg-card p-4 space-y-3.5 transition-all hover:border-muted-foreground/20"
                      >
                        <div className="flex items-center gap-3">
                          {/* SVG Progress Circle with Emoji */}
                          {renderProgressCircle(goal.current_amount, goal.target_amount, goal.color || "#5FBF9A", goal.icon || "🎯")}

                          {/* Text Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 justify-between">
                              <h4 className="font-bold text-sm text-foreground truncate pr-2">
                                {goal.name}
                              </h4>
                              <span className="text-[10px] font-bold text-mint-strong dark:text-mint-soft bg-mint-soft/30 dark:bg-mint-soft/10 px-2 py-0.5 rounded-lg shrink-0">
                                {Math.round(percent)}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs mt-0.5">
                              <span className="font-semibold text-foreground">{formatCurrency(goal.current_amount)}</span>
                              <span className="text-muted-foreground">dari {formatCurrency(goal.target_amount)}</span>
                            </div>
                            {goal.target_date && (
                              <div className="flex items-center gap-1 text-[9px] text-muted-foreground/80 mt-1 select-none">
                                <Calendar className="size-3 text-mint-strong" />
                                <span>Hingga {new Date(goal.target_date).toLocaleDateString("id-ID", { month: "short", year: "numeric" })}</span>
                                {calculateMonthlyRequired(goal.current_amount, goal.target_amount, goal.target_date)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons Row */}
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setDepositingGoal(goal);
                              setDepositAmount("");
                              setDepositDialogOpen(true);
                            }}
                            disabled={goal.is_completed}
                            className={`flex-1 h-9 rounded-xl font-semibold text-xs transition-all ${
                              goal.is_completed
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 cursor-default"
                                : "bg-mint-soft text-mint-strong border border-mint-strong/10 hover:bg-mint-soft/80"
                            }`}
                          >
                            {goal.is_completed ? "Tercapai! 🎉" : "+ Setor Tabungan"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditGoal(goal)}
                            className="h-9 rounded-xl border-muted hover:bg-muted text-xs font-semibold px-3"
                          >
                            Sesuaikan
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

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
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Deposit Dialog */}
      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl select-none">{depositingGoal?.icon || "🎯"}</span>
              <span>Setor Dana Ke {depositingGoal?.name}</span>
            </DialogTitle>
          </DialogHeader>

          {depositingGoal && (
            <form onSubmit={handleDeposit} className="space-y-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deposit_amount">Jumlah Setoran (Rp)</Label>
                <Input
                  id="deposit_amount"
                  placeholder="Contoh: 100000 atau 50000 * 2"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="h-11 rounded-xl pr-3"
                  required
                  autoFocus
                />
                {/* Real-time Math Expression Evaluation Preview */}
                {parseAmountExpression(depositAmount) !== null && (
                  <p className="text-xs text-mint-strong font-semibold flex items-center gap-1 mt-0.5">
                    <Sparkles className="size-3.5" />
                    <span>Hasil evaluasi: {formatCurrency(parseAmountExpression(depositAmount)!)}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={updateGoalMutation.isPending}
                  className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold"
                >
                  {updateGoalMutation.isPending ? "Memproses..." : "Konfirmasi Setoran"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit Savings Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl select-none">{goalEmoji}</span>
              <span>{editingGoal ? "Ubah Target Tabungan" : "Target Tabungan Baru"}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveGoal} className="space-y-4 pt-2">
            {/* Goal Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal_name">Nama Impian</Label>
              <Input
                id="goal_name"
                placeholder="Contoh: Liburan ke Jepang, Beli Laptop"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>

            {/* Target Amount */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal_target">Nominal Target (Rp)</Label>
              <Input
                id="goal_target"
                placeholder="Contoh: 15000000 atau 5000000 * 3"
                value={goalTargetAmount}
                onChange={(e) => setGoalTargetAmount(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
              {parseAmountExpression(goalTargetAmount) !== null && (
                <p className="text-xs text-mint-strong font-semibold flex items-center gap-1 mt-0.5">
                  <Sparkles className="size-3.5" />
                  <span>Hasil evaluasi: {formatCurrency(parseAmountExpression(goalTargetAmount)!)}</span>
                </p>
              )}
            </div>

            {/* Current Amount */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal_current">Saldo Terkumpul Saat Ini (Rp)</Label>
              <Input
                id="goal_current"
                placeholder="Contoh: 1000000 atau 500000"
                value={goalCurrentAmount}
                onChange={(e) => setGoalCurrentAmount(e.target.value)}
                className="h-11 rounded-xl"
              />
              {parseAmountExpression(goalCurrentAmount) !== null && (
                <p className="text-xs text-mint-strong font-semibold flex items-center gap-1 mt-0.5">
                  <Sparkles className="size-3.5" />
                  <span>Hasil evaluasi: {formatCurrency(parseAmountExpression(goalCurrentAmount)!)}</span>
                </p>
              )}
            </div>

            {/* Target Date */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal_date">Batas Waktu Capaian (Opsional)</Label>
              <Input
                id="goal_date"
                type="date"
                value={goalTargetDate}
                onChange={(e) => setGoalTargetDate(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            {/* Emoji Selection Grid */}
            <div className="flex flex-col gap-1.5">
              <Label>Pilih Ikon Emoji</Label>
              <div className="flex flex-wrap gap-2">
                {["🎯", "🏦", "🚗", "🏠", "📈", "✈️", "💍", "💻", "💼", "💰"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setGoalEmoji(emoji)}
                    className={`size-9 rounded-xl border text-lg flex items-center justify-center transition-all ${
                      goalEmoji === emoji
                        ? "bg-muted border-foreground dark:border-white"
                        : "bg-card border-transparent hover:bg-muted/50"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Selection Grid */}
            <div className="flex flex-col gap-1.5">
              <Label>Pilih Warna Tema</Label>
              <div className="flex flex-wrap gap-2">
                {["#5FBF9A", "#B8E6D3", "#B5E2FA", "#D3C3FC", "#F5CAC3", "#F4D2A6", "#E8A5A5", "#90E0EF"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setGoalColor(color)}
                    className={`size-8 rounded-full border transition-all relative flex items-center justify-center ${
                      goalColor === color
                        ? "ring-2 ring-foreground dark:ring-white scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {goalColor === color && (
                      <span className="absolute size-2 rounded-full bg-white shadow-xs" style={{ filter: "invert(1)" }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
                className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold"
              >
                {createGoalMutation.isPending || updateGoalMutation.isPending ? "Menyimpan..." : "Simpan Target Tabungan"}
              </Button>

              {editingGoal && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDeleteGoal}
                  disabled={deleteGoalMutation.isPending}
                  className="h-10 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold"
                >
                  {deleteGoalMutation.isPending ? "Menghapus..." : "Hapus Target"}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
