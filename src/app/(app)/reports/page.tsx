"use client";

import * as React from "react";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useWallets, useWalletBalances } from "@/hooks/use-wallets";
import { formatCurrency } from "@/lib/format";
import { PageHeading } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Download,
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar,
  Wallet as WalletIcon,
  HelpCircle,
  Tag,
  PieChart as PieIcon,
  ChevronRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import {
  getActivePeriodKey,
  shiftPeriodKey,
  getPeriodRange,
  getPeriodKeyForDate,
  formatPeriodShortLabel,
} from "@/lib/period";

// Kunci hari dalam zona Asia/Jakarta (toISOString memakai UTC sehingga
// transaksi dini hari WIB tergeser ke hari sebelumnya)
const dayKeyJakarta = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

const ExpenseDonut = dynamic(
  () => import("@/components/shared/report-charts").then((mod) => mod.ExpenseDonut),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] w-full bg-muted/40 animate-pulse rounded-2xl flex items-center justify-center text-xs text-muted-foreground">
        Memuat grafik...
      </div>
    ),
  }
);

const CumulativeCashflow = dynamic(
  () => import("@/components/shared/report-charts").then((mod) => mod.CumulativeCashflow),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] w-full bg-muted/40 animate-pulse rounded-2xl flex items-center justify-center text-xs text-muted-foreground">
        Memuat grafik...
      </div>
    ),
  }
);

const NetWorthTrend = dynamic(
  () => import("@/components/shared/report-charts").then((mod) => mod.NetWorthTrend),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] w-full bg-muted/40 animate-pulse rounded-2xl flex items-center justify-center text-xs text-muted-foreground">
        Memuat grafik...
      </div>
    ),
  }
);


type PeriodFilter = "this-month" | "last-month" | "last-6-months" | "last-12-months";

export default function ReportsPage() {
  const [mounted, setMounted] = React.useState(false);
  const [period, setPeriod] = React.useState<PeriodFilter>("this-month");
  const [selectedWalletId, setSelectedWalletId] = React.useState<string>("all");
  const [selectedParentCategoryId, setSelectedParentCategoryId] = React.useState<string | null>(null);
  const [selectedHeatmapDay, setSelectedHeatmapDay] = React.useState<{ date: Date; amount: number } | null>(null);

  React.useEffect(() => {
    setMounted(true);
    const todayStr = new Date().toISOString().slice(0, 10);
    setSelectedHeatmapDay({ date: new Date(), amount: 0 });
  }, []);

  // Fetch all categories, wallets, transactions
  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const { data: wallets = [], isLoading: loadingWallets } = useWallets();
  const { data: transactions = [], isLoading: loadingTxs } = useTransactions();

  // Helper: rentang periode keuangan (siklus gajian — lihat lib/period.ts)
  const periodDates = React.useMemo(() => {
    const activeKey = getActivePeriodKey();
    let startKey = activeKey;
    let endKey = activeKey;

    if (period === "last-month") {
      startKey = shiftPeriodKey(activeKey, -1);
      endKey = startKey;
    } else if (period === "last-6-months") {
      startKey = shiftPeriodKey(activeKey, -5);
    } else if (period === "last-12-months") {
      startKey = shiftPeriodKey(activeKey, -11);
    }

    const start = new Date(`${getPeriodRange(startKey).startDate}T00:00:00+07:00`);
    const end = new Date(`${getPeriodRange(endKey).endDate}T23:59:59.999+07:00`);
    return { start, end, startKey, endKey };
  }, [period]);

  // Filter transactions by date and selected wallet locally for instant responses
  const filteredTxs = React.useMemo(() => {
    return transactions.filter((t) => {
      const date = new Date(t.occurred_at);
      const inDateRange = date >= periodDates.start && date <= periodDates.end;
      const matchesWallet =
        selectedWalletId === "all" ||
        t.wallet_id === selectedWalletId ||
        t.to_wallet_id === selectedWalletId;
      return inDateRange && matchesWallet && !t.is_deleted;
    });
  }, [transactions, periodDates, selectedWalletId]);

  // Heatmap calculation
  const heatmapData = React.useMemo(() => {
    const data: { date: Date; dateStr: string; amount: number; level: number }[] = [];
    const expenses = transactions.filter((t) => t.type === "expense" && !t.is_deleted);
    
    // Create a map of YYYY-MM-DD -> total expense
    const expenseMap = new Map<string, number>();
    expenses.forEach((t) => {
      const d = new Date(t.occurred_at);
      const key = dayKeyJakarta(d);
      expenseMap.set(key, (expenseMap.get(key) || 0) + Number(t.amount || 0));
    });

    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 90 - today.getDay()); // ~3 months ago, aligned to Sunday
    
    const end = new Date(today);
    end.setDate(today.getDate() + (6 - today.getDay())); // Saturday of this week

    const tempDate = new Date(start);
    while (tempDate <= end) {
      const dateStr = dayKeyJakarta(tempDate);
      const amount = expenseMap.get(dateStr) || 0;
      
      let level = 0;
      if (amount > 0 && amount <= 50000) level = 1;
      else if (amount > 50000 && amount <= 200000) level = 2;
      else if (amount > 200000 && amount <= 1000000) level = 3;
      else if (amount > 1000000) level = 4;

      data.push({
        date: new Date(tempDate),
        dateStr,
        amount,
        level,
      });
      
      tempDate.setDate(tempDate.getDate() + 1);
    }
    
    return data;
  }, [transactions]);

  const heatmapWeeks = React.useMemo(() => {
    const weeks: typeof heatmapData[] = [];
    let currentWeek: typeof heatmapData = [];
    
    heatmapData.forEach((day, index) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || index === heatmapData.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    return weeks;
  }, [heatmapData]);

  const monthLabels = React.useMemo(() => {
    const labels: { index: number; text: string }[] = [];
    let prevMonth = -1;
    
    heatmapWeeks.forEach((week, index) => {
      const firstDay = week[0]?.date;
      if (firstDay) {
        const month = firstDay.getMonth();
        if (month !== prevMonth) {
          labels.push({
            index,
            text: firstDay.toLocaleDateString("id-ID", { month: "short" }),
          });
          prevMonth = month;
        }
      }
    });
    
    return labels;
  }, [heatmapWeeks]);

  const selectedDayTxs = React.useMemo(() => {
    if (!selectedHeatmapDay) return [];
    const targetStr = dayKeyJakarta(selectedHeatmapDay.date);
    return transactions.filter(
      (t) =>
        t.type === "expense" &&
        !t.is_deleted &&
        dayKeyJakarta(t.occurred_at) === targetStr
    );
  }, [transactions, selectedHeatmapDay]);

  // Keep the selected heatmap day amount in sync when transactions load/change
  React.useEffect(() => {
    if (!selectedHeatmapDay) return;
    const targetStr = dayKeyJakarta(selectedHeatmapDay.date);
    const dayExpenses = transactions.filter(
      (t) =>
        t.type === "expense" &&
        !t.is_deleted &&
        dayKeyJakarta(t.occurred_at) === targetStr
    );
    const total = dayExpenses.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    if (selectedHeatmapDay.amount !== total) {
      setSelectedHeatmapDay((prev) => prev ? { ...prev, amount: total } : null);
    }
  }, [transactions, selectedHeatmapDay?.date]);

  // Cashflow statistics calculation
  const stats = React.useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredTxs.forEach((t) => {
      if (t.type === "income") {
        income += t.amount;
      } else if (t.type === "expense") {
        expense += t.amount;
      }
    });

    return {
      income,
      expense,
      net: income - expense,
    };
  }, [filteredTxs]);

  // Flat category map to query details by ID quickly
  const flatCategoryMap = React.useMemo(() => {
    const map = new Map<string, { name: string; parent_id: string | null; color: string }>();
    categories.forEach((parent) => {
      map.set(parent.id, { name: parent.name, parent_id: null, color: parent.color || "#C4C4C4" });
      if (parent.subcategories) {
        parent.subcategories.forEach((sub) => {
          map.set(sub.id, { name: sub.name, parent_id: parent.id, color: sub.color || parent.color || "#C4C4C4" });
        });
      }
    });
    return map;
  }, [categories]);

  // 1. Donut Chart Data: Expenses by Parent Category
  const expenseDonutData = React.useMemo(() => {
    const expenses = filteredTxs.filter((t) => t.type === "expense");
    const parentSums = new Map<string, number>();

    expenses.forEach((t) => {
      if (!t.category_id) return;
      const catDetails = flatCategoryMap.get(t.category_id);
      if (!catDetails) return;

      const parentId = catDetails.parent_id || t.category_id;
      parentSums.set(parentId, (parentSums.get(parentId) || 0) + t.amount);
    });

    const data = Array.from(parentSums.entries()).map(([id, value]) => {
      const parentCat = categories.find((c) => c.id === id);
      return {
        id,
        name: parentCat?.name || "Kategori Lain",
        value,
        color: parentCat?.color || "#5FBF9A",
      };
    });

    // Sort from highest expense to lowest
    return data.sort((a, b) => b.value - a.value);
  }, [filteredTxs, flatCategoryMap, categories]);

  // Subcategory list breakdown for the selected parent slice
  const subcategoryBreakdown = React.useMemo(() => {
    if (!selectedParentCategoryId) return [];

    const expenses = filteredTxs.filter((t) => t.type === "expense");
    const subSums = new Map<string, number>();

    expenses.forEach((t) => {
      if (!t.category_id) return;
      const catDetails = flatCategoryMap.get(t.category_id);
      if (!catDetails) return;

      const parentId = catDetails.parent_id || t.category_id;
      if (parentId === selectedParentCategoryId) {
        subSums.set(t.category_id, (subSums.get(t.category_id) || 0) + t.amount);
      }
    });

    const data = Array.from(subSums.entries()).map(([id, value]) => {
      const details = flatCategoryMap.get(id);
      return {
        id,
        name: details?.name || "Subkategori",
        value,
        color: details?.color || "#B8E6D3",
      };
    });

    return data.sort((a, b) => b.value - a.value);
  }, [selectedParentCategoryId, filteredTxs, flatCategoryMap]);

  // Set default selected slice once donut data loads
  React.useEffect(() => {
    if (expenseDonutData.length > 0 && !selectedParentCategoryId) {
      setSelectedParentCategoryId(expenseDonutData[0].id);
    }
  }, [expenseDonutData, selectedParentCategoryId]);

  // 2. Daily/Monthly Cumulative Cashflow Line Chart Data
  const dailyCashflowData = React.useMemo(() => {
    const datesMap = new Map<string, { income: number; expense: number }>();
    const start = new Date(periodDates.start);
    const end = new Date(periodDates.end);
    const isMonthly = period === "last-6-months" || period === "last-12-months";

    // Initialize all periods in the filter range with 0
    if (isMonthly) {
      // Group by periode gajian
      for (
        let key = periodDates.startKey;
        key <= periodDates.endKey;
        key = shiftPeriodKey(key, 1)
      ) {
        datesMap.set(formatPeriodShortLabel(key), { income: 0, expense: 0 });
      }
    } else {
      // Group by day
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayKey = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
        datesMap.set(dayKey, { income: 0, expense: 0 });
      }
    }

    // Populate sums
    filteredTxs.forEach((t) => {
      const key = isMonthly
        ? formatPeriodShortLabel(getPeriodKeyForDate(t.occurred_at))
        : new Date(t.occurred_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

      if (datesMap.has(key)) {
        const current = datesMap.get(key)!;
        if (t.type === "income") current.income += t.amount;
        if (t.type === "expense") current.expense += t.amount;
      }
    });

    // Construct cumulative results
    const list: any[] = [];
    let cumulativeIncome = 0;
    let cumulativeExpense = 0;

    datesMap.forEach((val, key) => {
      cumulativeIncome += val.income;
      cumulativeExpense += val.expense;
      list.push({
        date: key,
        "Pemasukan Kumulatif": cumulativeIncome,
        "Pengeluaran Kumulatif": cumulativeExpense,
      });
    });

    return list;
  }, [filteredTxs, periodDates]);

  // 3. 6-Month Net Worth Trend Line Chart Data
  const netWorthTrendData = React.useMemo(() => {
    if (wallets.length === 0) return [];

    const list: any[] = [];

    const activeWalletIds = new Set(wallets.filter(w => !w.exclude_from_networth).map(w => w.id));
    const initialBalancesSum = wallets.reduce((sum, w) => {
      return w.exclude_from_networth ? sum : sum + Number(w.initial_balance || 0);
    }, 0);

    // Loop through last 6 periode gajian
    const activeKey = getActivePeriodKey();
    for (let i = 5; i >= 0; i--) {
      const key = shiftPeriodKey(activeKey, -i);
      const d = new Date(`${getPeriodRange(key).endDate}T23:59:59.999+07:00`);
      const monthLabel = formatPeriodShortLabel(key);
      const targetTime = d.getTime();

      let netWorth = initialBalancesSum;
      
      transactions.forEach((t) => {
        if (t.is_deleted) return;
        if (new Date(t.occurred_at).getTime() > targetTime) return; // skip future transactions

        const amt = Number(t.amount || 0);
        if (t.type === "income" && activeWalletIds.has(t.wallet_id)) {
          netWorth += amt;
        } else if (t.type === "expense" && activeWalletIds.has(t.wallet_id)) {
          netWorth -= amt;
        } else if (t.type === "transfer") {
          if (activeWalletIds.has(t.wallet_id)) netWorth -= amt;
          if (t.to_wallet_id && activeWalletIds.has(t.to_wallet_id)) netWorth += amt;
        }
      });

      list.push({
        month: monthLabel,
        "Kekayaan Bersih": netWorth,
      });
    }

    return list;
  }, [wallets, transactions]);

  // CSV Exporter
  const handleExportCSV = () => {
    if (filteredTxs.length === 0) {
      toast.error("Tidak ada transaksi untuk diekspor pada rentang ini.");
      return;
    }

    try {
      const headers = ["Tanggal", "Tipe", "Kategori", "Dari Dompet", "Ke Dompet", "Jumlah (Rp)", "Catatan", "Tag"];
      const rows = filteredTxs.map((t) => {
        const date = new Date(t.occurred_at).toLocaleDateString("id-ID");
        const typeLabel = t.type === "income" ? "Pemasukan" : t.type === "expense" ? "Pengeluaran" : "Transfer";
        const categoryLabel = t.category?.name || "-";
        const walletLabel = t.wallet?.name || "-";
        const toWalletLabel = t.to_wallet?.name || "-";
        const amountVal = t.amount;
        const noteVal = t.note ? `"${t.note.replace(/"/g, '""')}"` : "";
        const tagsVal = t.tags && t.tags.length > 0 ? `"${t.tags.join(", ").replace(/"/g, '""')}"` : "";

        return [date, typeLabel, categoryLabel, walletLabel, toWalletLabel, amountVal, noteVal, tagsVal].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n"); // Add BOM for Excel compatibility in UTF-8
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = `SakuKita_Ekspor_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV berhasil diekspor offline!");
    } catch (err) {
      toast.error("Gagal mengekspor CSV.");
    }
  };

  const isLoading = loadingCategories || loadingWallets || loadingTxs;

  return (
    <div className="max-w-md mx-auto min-h-dvh flex flex-col space-y-5 pb-20 print-container">
      {/* Printable Statement Header (Only visible on paper / PDF print) */}
      <div className="print-only hidden space-y-6 pb-6 border-b-2 border-stone-850">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">LAPORAN KEUANGAN SAKUKITA</h1>
            <p className="text-xs font-semibold text-stone-500 uppercase mt-0.5">Pencatatan Keuangan Rumah Tangga</p>
          </div>
          <div className="text-right text-xs text-stone-500">
            <p className="font-bold text-stone-850">SakuKita PWA</p>
            <p>Tanggal Cetak: {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs">
          <div>
            <span className="text-[10px] font-bold text-stone-500 uppercase block">Total Pemasukan</span>
            <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatCurrency(stats.income)}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-stone-500 uppercase block">Total Pengeluaran</span>
            <p className="text-sm font-bold text-red-600 mt-0.5">{formatCurrency(stats.expense)}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-stone-500 uppercase block">Arus Kas Bersih</span>
            <p className={`text-sm font-bold mt-0.5 ${stats.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(stats.net)}</p>
          </div>
        </div>
      </div>

      <PageHeading
        title="Laporan Keuangan"
        subtitle="Analisis arus kas dan kekayaan bersih"
      />

      {/* Control Filter Bar */}
      <div className="bg-card border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Period Range Select */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Calendar className="size-3 text-mint-strong" /> Rentang Waktu
            </label>
            <Select value={period} onValueChange={(val: PeriodFilter) => setPeriod(val)}>
              <SelectTrigger className="h-10 rounded-xl text-xs bg-muted/30 border-none">
                <SelectValue placeholder="Pilih rentang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">Bulan Ini</SelectItem>
                <SelectItem value="last-month">Bulan Lalu</SelectItem>
                <SelectItem value="last-6-months">6 Bulan Terakhir</SelectItem>
                <SelectItem value="last-12-months">12 Bulan Terakhir</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Wallet Select Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <WalletIcon className="size-3 text-mint-strong" /> Filter Dompet
            </label>
            <Select value={selectedWalletId} onValueChange={(val) => setSelectedWalletId(val)}>
              <SelectTrigger className="h-10 rounded-xl text-xs bg-muted/30 border-none">
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
        </div>

        {/* Export Buttons Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* CSV Download Button */}
          <Button
            onClick={handleExportCSV}
            disabled={isLoading || filteredTxs.length === 0}
            className="h-10 rounded-xl bg-muted/65 hover:bg-muted text-foreground border gap-2 text-xs font-semibold"
          >
            <Download className="size-4" />
            Ekspor CSV
          </Button>

          {/* PDF/Print Button */}
          <Button
            onClick={() => window.print()}
            disabled={isLoading || filteredTxs.length === 0}
            className="h-10 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 gap-2 text-xs font-semibold"
          >
            <PieIcon className="size-4" />
            Cetak PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="size-8 animate-spin text-mint-strong" />
          <p className="text-xs text-muted-foreground">Menganalisis data keuangan lokal...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Dynamic Cashflow Cards Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border bg-card p-3 flex flex-col justify-between h-20">
              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <TrendingUp className="size-3 text-emerald-500" /> Masuk
              </span>
              <p className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                {formatCurrency(stats.income)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-3 flex flex-col justify-between h-20">
              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <TrendingDown className="size-3 text-red-500" /> Keluar
              </span>
              <p className="text-[13px] font-bold text-red-600 dark:text-red-400 truncate">
                {formatCurrency(stats.expense)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-3 flex flex-col justify-between h-20">
              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <Scale className="size-3 text-mint-strong" /> Bersih
              </span>
              <p className={`text-[13px] font-bold truncate ${stats.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {formatCurrency(stats.net)}
              </p>
            </div>
          </div>

          {/* Kalender Heatmap Pengeluaran */}
          <div className="rounded-2xl border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Calendar className="size-4 text-mint-strong" /> Kerapatan Pengeluaran Harian
              </h3>
              <span className="text-[10px] text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded-lg">
                3 Bulan Terakhir
              </span>
            </div>

            <div className="flex gap-1.5 overflow-hidden">
              {/* Weekday indicators */}
              <div className="flex flex-col gap-[3px] text-[8px] text-muted-foreground/60 font-semibold pt-[17px] h-[105px] w-6 select-none shrink-0 text-right pr-1 justify-between">
                <span>Min</span>
                <span className="invisible">Sen</span>
                <span>Sel</span>
                <span className="invisible">Rab</span>
                <span>Kam</span>
                <span className="invisible">Jum</span>
                <span>Sab</span>
              </div>

              {/* Grid with Month Labels */}
              <div className="flex-1 overflow-x-auto pb-1 scrollbar-none">
                <div className="min-w-[345px] flex flex-col space-y-1">
                  {/* Months row */}
                  <div className="h-4 relative text-[9px] text-muted-foreground/80 font-bold select-none">
                    {monthLabels.map((lbl) => (
                      <span
                        key={lbl.index}
                        className="absolute"
                        style={{ left: `${lbl.index * 13}px` }} // Each column is 10px + 3px gap = 13px
                      >
                        {lbl.text}
                      </span>
                    ))}
                  </div>

                  {/* Heatmap Grid columns */}
                  <div className="flex gap-[3px] select-none">
                    {heatmapWeeks.map((week, wIdx) => (
                      <div key={wIdx} className="flex flex-col gap-[3px]">
                        {week.map((day, dIdx) => {
                          const today = new Date();
                          const isFuture = day.date > today;
                          const isSelected = selectedHeatmapDay && day.date.toDateString() === selectedHeatmapDay.date.toDateString();
                          
                          return (
                            <button
                              key={dIdx}
                              onClick={() => {
                                if (!isFuture) {
                                  setSelectedHeatmapDay({ date: day.date, amount: day.amount });
                                }
                              }}
                              disabled={isFuture}
                              title={`${day.date.toLocaleDateString("id-ID", { dateStyle: "medium" })}: ${formatCurrency(day.amount)}`}
                              className={`size-[10px] rounded-[2px] transition-all cursor-pointer outline-none shrink-0 ${
                                isFuture
                                  ? "bg-transparent cursor-default"
                                  : day.level === 0
                                  ? "bg-muted/30 hover:ring-1 hover:ring-foreground/20 dark:bg-muted/10"
                                  : day.level === 1
                                  ? "bg-[#E8F8F2] dark:bg-[#0E2920] border-[0.5px] border-[#10B981]/10 hover:scale-110"
                                  : day.level === 2
                                  ? "bg-[#C4EFE0] dark:bg-[#164D3B] border-[0.5px] border-[#10B981]/20 hover:scale-110"
                                  : day.level === 3
                                  ? "bg-[#78DBB7] dark:bg-[#208362] border-[0.5px] border-[#10B981]/30 hover:scale-110"
                                  : "bg-[#10B981] dark:bg-[#10B981] border-[0.5px] border-[#10B981]/40 hover:scale-110"
                              } ${
                                isSelected
                                  ? "ring-[1.5px] ring-foreground scale-110 dark:ring-white"
                                  : ""
                              }`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="flex items-center justify-end gap-1.5 text-[9px] text-muted-foreground/80 font-medium select-none pr-1">
              <span>Sedikit</span>
              <span className="size-[9px] rounded-[1px] bg-muted/30 dark:bg-muted/10" />
              <span className="size-[9px] rounded-[1px] bg-[#E8F8F2] dark:bg-[#0E2920]" />
              <span className="size-[9px] rounded-[1px] bg-[#C4EFE0] dark:bg-[#164D3B]" />
              <span className="size-[9px] rounded-[1px] bg-[#78DBB7] dark:bg-[#208362]" />
              <span className="size-[9px] rounded-[1px] bg-[#10B981] dark:bg-[#10B981]" />
              <span>Banyak</span>
            </div>

            {/* Interactive Day Details Panel */}
            {selectedHeatmapDay && (
              <div className="rounded-xl border bg-muted/20 dark:bg-muted/5 p-3 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b pb-1.5 border-muted-foreground/10">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    Detail {selectedHeatmapDay.date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <span className={`text-xs font-bold ${selectedHeatmapDay.amount > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {selectedHeatmapDay.amount > 0 ? formatCurrency(selectedHeatmapDay.amount) : "Tidak ada pengeluaran"}
                  </span>
                </div>

                {selectedDayTxs.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-2">
                    Tidak ada catatan pengeluaran untuk hari ini.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {selectedDayTxs.map((t) => {
                      const iconVal = t.category?.icon || "🏷️";
                      const displayIcon = iconVal.includes(" ") ? iconVal.split(" ")[1] || iconVal.split(" ")[0] : iconVal;
                      return (
                        <div key={t.id} className="flex items-center justify-between p-1.5 rounded-lg bg-card border text-[11px] font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="size-5 rounded-md bg-muted flex items-center justify-center shrink-0">
                              {displayIcon.length <= 2 ? displayIcon : "🏷️"}
                            </span>
                            <div className="truncate flex flex-col">
                              <span className="text-foreground truncate">{t.note || t.category?.name || "Pengeluaran"}</span>
                              <span className="text-[9px] text-muted-foreground truncate">
                                {t.wallet?.name} {t.category?.name ? `• ${t.category.name}` : ""}
                              </span>
                            </div>
                          </div>
                          <span className="text-red-500 shrink-0 font-bold">{formatCurrency(t.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 1. Donut Chart - Expenses Distribution */}
          <div className="rounded-2xl border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <PieIcon className="size-4 text-mint-strong" /> Distribusi Pengeluaran
              </h3>
              <span className="text-[10px] text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded-lg">
                Berdasarkan Kategori Utama
              </span>
            </div>

            {expenseDonutData.length === 0 ? (
              <div className="h-[120px] flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                Tidak ada data pengeluaran pada periode ini.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Recharts Pie Donut Container */}
                <ExpenseDonut
                  data={expenseDonutData}
                  selectedParentCategoryId={selectedParentCategoryId}
                  onSelectCategory={setSelectedParentCategoryId}
                  totalSpent={stats.expense}
                />

                {/* Parent Categories interactive listing */}
                <div className="grid grid-cols-2 gap-2">
                  {expenseDonutData.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedParentCategoryId(item.id)}
                      className={`flex items-center justify-between p-2 rounded-xl border text-[11px] font-medium cursor-pointer transition-all hover:bg-muted/30 ${
                        selectedParentCategoryId === item.id ? "bg-muted border-foreground/30 scale-[1.02]" : "bg-card border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate text-foreground pr-1">{item.name}</span>
                      </div>
                      <span className="text-muted-foreground shrink-0">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>

                {/* Subcategory breakdown slide-down list */}
                {selectedParentCategoryId && subcategoryBreakdown.length > 0 && (
                  <div className="border-t pt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <Tag className="size-3" /> Subkategori Rincian
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {categories.find((c) => c.id === selectedParentCategoryId)?.name}
                      </span>
                    </div>

                    <div className="rounded-xl bg-muted/30 border p-3.5 space-y-2.5">
                      {subcategoryBreakdown.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="font-medium text-foreground">{item.name}</span>
                          </div>
                          <span className="font-semibold text-muted-foreground">
                            {formatCurrency(item.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Daily Cumulative Cashflow Line Chart */}
          <div className="rounded-2xl border bg-card p-4 space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Scale className="size-4 text-mint-strong" /> Tren Arus Kas Kumulatif
            </h3>

            {dailyCashflowData.length <= 1 ? (
              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                Menunggu pencatatan transaksi...
              </div>
            ) : (
              <div className="h-[200px] w-full">
                <CumulativeCashflow data={dailyCashflowData} />
              </div>
            )}
          </div>

          {/* 3. 6-Month Net Worth Trend Line */}
          <div className="rounded-2xl border bg-card p-4 space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="size-4 text-mint-strong" /> Tren Kekayaan Bersih
            </h3>

            {netWorthTrendData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                Menunggu data dompet aktif...
              </div>
            ) : (
              <div className="h-[200px] w-full">
                <NetWorthTrend data={netWorthTrendData} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
