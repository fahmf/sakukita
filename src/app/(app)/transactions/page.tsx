"use client";

import * as React from "react";
import Link from "next/link";
import { useTransactions, useDeleteTransaction } from "@/hooks/use-transactions";
import { useWallets } from "@/hooks/use-wallets";
import { useCategories } from "@/hooks/use-categories";
import { formatCurrency, formatRelative } from "@/lib/format";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/shared/empty-state";
import type { TransactionWithDetails } from "@/hooks/use-transactions";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Pencil,
  Trash2,
  CircleDot,
  Briefcase,
  Utensils,
  Car,
  ShoppingBag,
  Gift,
  Heart,
  Receipt,
  FilterX,
} from "lucide-react";
import { TransactionDetailDialog } from "@/components/transaction/transaction-detail-dialog";
import { iconMap } from "@/lib/icons";
import { TransactionListSkeleton } from "@/components/shared/skeletons";

export default function AllTransactionsPage() {
  const { openEditTransaction } = useUIStore();
  const allowed = useCanEdit();
  const deleteTx = useDeleteTransaction();

  // Navigation states
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });

  // Filter and search states
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedWalletId, setSelectedWalletId] = React.useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("all");

  // Dialog & Detail states
  const [selectedTxForDetail, setSelectedTxForDetail] = React.useState<TransactionWithDetails | null>(null);
  const [txToDelete, setTxToDelete] = React.useState<TransactionWithDetails | null>(null);

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

  // Fetch data
  const { data: transactions = [], isLoading: loadingTx } = useTransactions({
    period: "custom",
    startDate,
    endDate,
    walletId: null,
    categoryId: null,
  });

  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();

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
        return noteMatch || catMatch || walletMatch || toWalletMatch || amountMatch;
      });
    }

    // Wallet filter
    if (selectedWalletId !== "all") {
      result = result.filter(
        (t) => t.wallet_id === selectedWalletId || t.to_wallet_id === selectedWalletId
      );
    }

    // Category filter
    if (selectedCategoryId !== "all") {
      result = result.filter((t) => t.category_id === selectedCategoryId);
    }

    return result;
  }, [transactions, searchQuery, selectedWalletId, selectedCategoryId]);

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
    } catch {
      toast.error("Gagal menghapus transaksi.");
    } finally {
      setTxToDelete(null);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedWalletId("all");
    setSelectedCategoryId("all");
    toast.info("Filter pencarian direset");
  };

  return (
    <div className="space-y-5">
      {/* 1. Header with Back Link */}
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="grid size-9 place-items-center rounded-full hover:bg-muted transition-colors"
          aria-label="Kembali ke beranda"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeading title="Riwayat Transaksi" subtitle="Semua catatan keuangan keluarga" />
      </div>

      {/* 2. Month Navigator */}
      <div className="flex items-center justify-between bg-card border rounded-2xl p-2.5 shadow-xs">
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

      {/* 3. Search & Filters Bar */}
      <Card className="rounded-2xl border bg-card p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari transaksi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-mint-strong focus:border-mint-strong transition-all h-10"
          />
        </div>

        {/* Filters grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Wallet Selector */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block pl-1">
              Dompet
            </span>
            <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
              <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/30 border-none">
                <SelectValue placeholder="Semua Dompet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Dompet</SelectItem>
                {wallets.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Selector */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block pl-1">
              Kategori
            </span>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/30 border-none">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Reset button if filters active */}
        {(searchQuery || selectedWalletId !== "all" || selectedCategoryId !== "all") && (
          <Button
            variant="ghost"
            onClick={resetFilters}
            className="w-full text-xs text-muted-foreground hover:text-expense hover:bg-red-50 dark:hover:bg-red-950/10 rounded-xl h-8 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <FilterX className="size-3.5" />
            Hapus Semua Filter
          </Button>
        )}
      </Card>

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
                            onClick={() => setTxToDelete(tx)}
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
