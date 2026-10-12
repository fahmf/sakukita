"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTransactions, useDeleteTransaction, useRestoreTransaction } from "@/hooks/use-transactions";
import { useWallets } from "@/hooks/use-wallets";
import { useCategories } from "@/hooks/use-categories";
import { formatCurrency, formatRelative } from "@/lib/format";
import { currentFinancialMonth, financialMonthDateRange, financialMonthRangeLabel } from "@/lib/financial-month";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/shared/empty-state";
import type { TransactionWithDetails } from "@/hooks/use-transactions";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  Pencil,
  Trash2,
  FilterX,
} from "lucide-react";
import { TransactionDetailDialog } from "@/components/transaction/transaction-detail-dialog";
import { iconMap } from "@/lib/icons";
import { TransactionListSkeleton } from "@/components/shared/skeletons";

type TypeFilter = "all" | "expense" | "income" | "transfer";

const TYPE_OPTIONS: { value: TypeFilter; label: string; activeClass: string }[] = [
  { value: "all", label: "Semua", activeClass: "text-foreground" },
  { value: "expense", label: "Keluar", activeClass: "text-expense" },
  { value: "income", label: "Masuk", activeClass: "text-income" },
  { value: "transfer", label: "Transfer", activeClass: "text-foreground" },
];

const chipClass =
  "flex h-8! w-auto shrink-0 items-center whitespace-nowrap rounded-full border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted";
const chipActiveClass = "border-mint-strong/30 bg-mint-soft text-mint-strong hover:bg-mint-soft";

export default function AllTransactionsPageRoute() {
  // useSearchParams needs a Suspense boundary or the production build fails
  // for this prerendered route (Next 16).
  return (
    <React.Suspense fallback={<TransactionListSkeleton count={5} />}>
      <AllTransactionsPage />
    </React.Suspense>
  );
}

function AllTransactionsPage() {
  const searchParams = useSearchParams();
  const { openEditTransaction } = useUIStore();
  const allowed = useCanEdit();
  const deleteTx = useDeleteTransaction();
  const restoreTx = useRestoreTransaction();

  // Navigation states (initialized to the current financial month)
  // Deep links: ?kategori=<id>[&bulan=YYYY-MM-01][&rentang=semua] — used by
  // "Lihat transaksi" on categories (Settings) and budgets.
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const bulan = searchParams.get("bulan");
    return bulan && /^\d{4}-\d{2}-01$/.test(bulan) ? bulan : currentFinancialMonth();
  });
  const [allTime, setAllTime] = React.useState(() => searchParams.get("rentang") === "semua");

  // Filter and search states
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedWalletId, setSelectedWalletId] = React.useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>(
    () => searchParams.get("kategori") || "all"
  );
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  // ?tipe=expense|income|transfer — e.g. from the Beranda income/expense cards.
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>(() => {
    const tipe = searchParams.get("tipe");
    return tipe === "expense" || tipe === "income" || tipe === "transfer" ? tipe : "all";
  });

  // Dialog & Detail states
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

  const activeMonthName = React.useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  // Convert selectedMonth to the financial-cycle date range for useTransactions
  const { startDate, endDate } = React.useMemo(
    () => financialMonthDateRange(selectedMonth),
    [selectedMonth]
  );

  // Fetch data
  const { data: transactions = [], isLoading: loadingTx } = useTransactions({
    period: "custom",
    startDate: allTime ? null : startDate,
    endDate: allTime ? null : endDate,
    walletId: null,
    categoryId: null,
  });

  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();

  // Selecting a parent category covers its subcategories too — most entries
  // live in subcategories, so an exact-id match showed e.g. 4 of 90 "Makanan".
  const selectedCategory = React.useMemo(() => {
    if (selectedCategoryId === "all") return null;
    const parent = categories.find((p) => p.id === selectedCategoryId);
    if (parent) {
      return {
        name: parent.name,
        parentName: null as string | null,
        ids: new Set([parent.id, ...parent.subcategories.map((sub) => sub.id)]),
      };
    }
    const owner = categories.find((p) => p.subcategories.some((sub) => sub.id === selectedCategoryId));
    const sub = owner?.subcategories.find((c) => c.id === selectedCategoryId);
    if (!owner || !sub) return null;
    return { name: sub.name, parentName: owner.name as string | null, ids: new Set([sub.id]) };
  }, [categories, selectedCategoryId]);

  // Apply filters in memory
  const filteredTransactions = React.useMemo(() => {
    let result = transactions;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((t) => {
        const noteMatch = t.note?.toLowerCase().includes(q);
        const catMatch = t.category?.name?.toLowerCase().includes(q);
        const walletMatch = t.wallet?.name?.toLowerCase().includes(q);
        const toWalletMatch = t.to_wallet?.name?.toLowerCase().includes(q);
        const amountMatch = t.amount.toString().includes(q);
        const tagMatch = t.tags?.some((tg) => tg.toLowerCase().includes(q.replace(/^#/, "")));
        return noteMatch || catMatch || walletMatch || toWalletMatch || amountMatch || tagMatch;
      });
    }

    // Wallet filter
    if (selectedWalletId !== "all") {
      result = result.filter(
        (t) => t.wallet_id === selectedWalletId || t.to_wallet_id === selectedWalletId
      );
    }

    // Category filter (parent includes its subcategories)
    if (selectedCategoryId !== "all") {
      const ids = selectedCategory?.ids ?? new Set([selectedCategoryId]);
      result = result.filter((t) => !!t.category_id && ids.has(t.category_id));
    }

    // Tag filter
    if (selectedTag) {
      result = result.filter((t) => t.tags?.includes(selectedTag));
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((t) => t.type === typeFilter);
    }

    return result;
  }, [transactions, searchQuery, selectedWalletId, selectedCategoryId, selectedCategory, selectedTag, typeFilter]);

  // Totals for the current filter, shown when a category is picked.
  const filterTotals = React.useMemo(() => {
    let expense = 0;
    let income = 0;
    for (const t of filteredTransactions) {
      if (t.type === "expense") expense += Number(t.amount || 0);
      else if (t.type === "income") income += Number(t.amount || 0);
    }
    return { expense, income, count: filteredTransactions.length };
  }, [filteredTransactions]);

  // Unique tags present in the current month's transactions (for the quick filter row).
  const availableTags = React.useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => t.tags?.forEach((tg) => set.add(tg)));
    return Array.from(set).sort();
  }, [transactions]);

  // Dynamic grouping by date matching Jakarta Timezone
  const groupedTransactions = React.useMemo(() => {
    const groups: { [dateStr: string]: { label: string; date: Date; txs: TransactionWithDetails[]; net: number } } = {};
    
    const jkt = getJakartaTimeParts();
    const todayStr = `${jkt.year}-${String(jkt.month + 1).padStart(2, "0")}-${String(jkt.day).padStart(2, "0")}`;
    
    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yestFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const yestParts = yestFormatter.formatToParts(yestDate);
    const yestMap = new Map(yestParts.map(p => [p.type, p.value]));
    const yestStr = `${yestMap.get("year")}-${yestMap.get("month")}-${yestMap.get("day")}`;

    filteredTransactions.forEach((tx) => {
      const txDate = new Date(tx.occurred_at);
      const txFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      const txParts = txFormatter.formatToParts(txDate);
      const txMap = new Map(txParts.map(p => [p.type, p.value]));
      const dateKey = `${txMap.get("year")}-${txMap.get("month")}-${txMap.get("day")}`;

      if (!groups[dateKey]) {
        let label = txDate.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        if (dateKey === todayStr) {
          label = "Hari Ini";
        } else if (dateKey === yestStr) {
          label = "Kemarin";
        }
        groups[dateKey] = {
          label,
          date: txDate,
          txs: [],
          net: 0,
        };
      }
      
      groups[dateKey].txs.push(tx);
      const amount = Number(tx.amount || 0);
      if (tx.type === "income") {
        groups[dateKey].net += amount;
      } else if (tx.type === "expense") {
        groups[dateKey].net -= amount;
      }
    });

    // Convert to sorted array descending
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => groups[key]);
  }, [filteredTransactions]);

  // Delete immediately and offer an "Undo" — soft-delete keeps it in the
  // 30-day recycle bin, so this is safe and much faster than a confirm dialog.
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
    } catch {
      toast.error("Gagal menghapus transaksi.");
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedWalletId("all");
    setSelectedCategoryId("all");
    setSelectedTag(null);
    setTypeFilter("all");
    setAllTime(false);
  };

  const hasActiveFilters =
    !!searchQuery ||
    selectedWalletId !== "all" ||
    selectedCategoryId !== "all" ||
    !!selectedTag ||
    typeFilter !== "all" ||
    allTime;
  const selectedWalletName = wallets.find((w) => w.id === selectedWalletId)?.name;

  return (
    <div className="space-y-5">
      {/* 1. Header with Back Link */}
      <div className="flex items-center gap-2">
        <PageHeading title="Riwayat Transaksi" subtitle="Semua catatan keuangan keluarga" />
        <Link
          href="/calendar"
          className="ml-auto grid size-9 place-items-center rounded-full hover:bg-muted transition-colors"
          aria-label="Tampilan kalender"
          title="Tampilan kalender"
        >
          <CalendarDays className="size-4" />
        </Link>
      </div>

      {/* 2. Month Navigator (or the all-time banner) */}
      {allTime ? (
        <div className="flex items-center justify-between bg-card border rounded-2xl p-2.5 pl-4 shadow-xs">
          <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
            <Calendar className="size-4 text-mint-strong" />
            <span>Semua waktu</span>
          </div>
          <Button
            variant="ghost"
            onClick={() => setAllTime(false)}
            className="h-9 rounded-xl text-xs font-semibold"
          >
            Per bulan
          </Button>
        </div>
      ) : (
      <div className="flex items-center justify-between bg-card border rounded-2xl p-2.5 shadow-xs">
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
            <span>{activeMonthName}</span>
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
      )}

      {/* 3. Search + one row of filter chips (type, wallet, category, tags).
          Compact so the list itself starts high on the screen. */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Cari catatan, kategori, nominal…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border rounded-xl pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-mint-strong focus:border-mint-strong transition-all h-10"
          />
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={typeFilter === opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                typeFilter === opt.value
                  ? `bg-card shadow-xs ${opt.activeClass}`
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none">
          <Select value={selectedWalletId} onValueChange={(v) => v && setSelectedWalletId(v)}>
            <SelectTrigger
              aria-label="Filter dompet"
              className={`${chipClass} ${selectedWalletId !== "all" ? chipActiveClass : ""}`}
            >
              {selectedWalletId !== "all" ? selectedWalletName ?? "Dompet" : "Semua dompet"}
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">Semua Dompet</SelectItem>
              {wallets.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedCategoryId} onValueChange={(v) => v && setSelectedCategoryId(v)}>
            <SelectTrigger
              aria-label="Filter kategori"
              className={`${chipClass} ${selectedCategory ? chipActiveClass : ""}`}
            >
              {selectedCategory ? selectedCategory.name : "Semua kategori"}
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map((c) => (
                <React.Fragment key={c.id}>
                  <SelectItem value={c.id} className="font-semibold">
                    {c.name}
                  </SelectItem>
                  {c.subcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id} className="pl-6 text-muted-foreground">
                      ↳ {sub.name}
                    </SelectItem>
                  ))}
                </React.Fragment>
              ))}
            </SelectContent>
          </Select>

          {availableTags.map((tag) => {
            const active = selectedTag === tag;
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedTag(active ? null : tag)}
                className={`${chipClass} ${active ? chipActiveClass : ""}`}
              >
                #{tag}
              </button>
            );
          })}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className={`${chipClass} gap-1 border-dashed text-muted-foreground hover:text-expense`}
            >
              <FilterX className="size-3.5" />
              Reset
            </button>
          )}
        </div>

        {/* What the current filter adds up to (the category card below has
            its own, richer version). */}
        {!selectedCategory && !loadingTx && (
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-muted-foreground">{filterTotals.count} transaksi</span>
            <span className="flex gap-3 font-semibold">
              {filterTotals.income > 0 && (
                <span className="text-income">+{formatCurrency(filterTotals.income)}</span>
              )}
              {filterTotals.expense > 0 && (
                <span className="text-expense">−{formatCurrency(filterTotals.expense)}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Category summary: what this category adds up to in the shown range */}
      {selectedCategory && (
        <Card className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {selectedCategory.parentName ? `${selectedCategory.parentName} ›` : "Kategori"}
              </p>
              <p className="font-semibold text-sm truncate">{selectedCategory.name}</p>
              <p className="text-xs text-muted-foreground">
                {filterTotals.count} transaksi · {allTime ? "semua waktu" : activeMonthName}
              </p>
            </div>
            <div className="text-right shrink-0">
              {filterTotals.expense > 0 && (
                <p className="font-bold text-sm text-expense">-{formatCurrency(filterTotals.expense)}</p>
              )}
              {filterTotals.income > 0 && (
                <p className="font-bold text-sm text-income">+{formatCurrency(filterTotals.income)}</p>
              )}
              {filterTotals.expense === 0 && filterTotals.income === 0 && (
                <p className="font-bold text-sm text-muted-foreground">{formatCurrency(0)}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setAllTime(false)}
              className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                !allTime ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              Per bulan
            </button>
            <button
              type="button"
              onClick={() => setAllTime(true)}
              className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                allTime ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              Semua waktu
            </button>
          </div>
        </Card>
      )}

      {/* 4. Transactions Grouped List */}
      <div className="space-y-4">
        {loadingTx ? (
          <div className="py-2">
            <TransactionListSkeleton count={5} />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed rounded-2xl space-y-3 bg-card">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <FilterX className="size-5" />
            </span>
            <div>
              <p className="font-bold text-sm">Tidak ada transaksi ditemukan</p>
              <p className="text-xs text-muted-foreground px-4 mt-0.5">
                Coba sesuaikan kata kunci pencarian atau bersihkan filter filter yang terpasang.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={resetFilters}
              className="rounded-xl h-9 text-xs"
            >
              Reset Pencarian
            </Button>
          </Card>
        ) : (
          <div className="space-y-5">
            {groupedTransactions.map((group) => (
              <div key={group.label} className="space-y-2">
                {/* Date Group Header */}
                <div className="flex justify-between items-center px-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>{group.label}</span>
                  <span className={group.net > 0 ? "text-income" : group.net < 0 ? "text-expense" : ""}>
                    Net: {group.net >= 0 ? "+" : ""}{formatCurrency(group.net).replace("Rp", "").trim()}
                  </span>
                </div>

                {/* Group transactions */}
                <div className="grid gap-2">
                  {group.txs.map((tx) => {
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
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none active:opacity-75"
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
                            className="text-right cursor-pointer select-none pr-1 active:opacity-75"
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
                            onClick={() => handleQuickDelete(tx)}
                            className="size-8 rounded-lg text-muted-foreground hover:text-expense hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                            aria-label="Hapus transaksi"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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

function getJakartaTimeParts() {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const partMap = new Map(parts.map(p => [p.type, p.value]));
    return {
      year: parseInt(partMap.get("year")!),
      month: parseInt(partMap.get("month")!) - 1, // 0-indexed
      day: parseInt(partMap.get("day")!),
      hour: parseInt(partMap.get("hour")!),
      minute: parseInt(partMap.get("minute")!),
      second: parseInt(partMap.get("second")!)
    };
  } catch {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds()
    };
  }
}
