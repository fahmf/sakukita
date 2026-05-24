"use client";

import * as React from "react";
import {
  useScheduledTransactions,
  useDeleteTransaction,
  useMaterializeNow,
} from "@/hooks/use-transactions";
import {
  useRecurringTransactions,
  useCreateRecurringTransaction,
  useUpdateRecurringTransaction,
  useDeleteRecurringTransaction,
} from "@/hooks/use-recurring";
import { useWallets } from "@/hooks/use-wallets";
import { useCategories } from "@/hooks/use-categories";
import { PageHeading, EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  CalendarClock,
  X,
  Check,
  Loader2,
  Repeat,
  Plus,
  Trash2,
  Pencil,
  ArrowRightLeft,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import type { RecurringTransaction, TransactionType } from "@/lib/supabase/types";

function groupByMonth<T extends { occurred_at: string }>(
  rows: T[]
): Array<{ key: string; label: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const d = new Date(r.occurred_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  const labelFmt = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => {
      const [y, m] = key.split("-").map(Number);
      const label = labelFmt.format(new Date(y, m - 1, 1));
      return { key, label, items };
    });
}

function getRecurrenceLabel(frequency: string, interval: number) {
  const freqMap: Record<string, string> = {
    daily: "hari",
    weekly: "minggu",
    monthly: "bulan",
    yearly: "tahun",
  };
  const unit = freqMap[frequency] || "bulan";
  if (interval === 1) {
    return `Setiap ${unit}`;
  }
  return `Setiap ${interval} ${unit}`;
}

export default function ScheduledPage() {
  const { data: scheduled = [], isLoading: isLoadingScheduled } = useScheduledTransactions();
  const cancelTx = useDeleteTransaction();
  const materialize = useMaterializeNow();

  const { data: recurring = [], isLoading: isLoadingRecurring } = useRecurringTransactions();
  const createRecurring = useCreateRecurringTransaction();
  const updateRecurring = useUpdateRecurringTransaction();
  const deleteRecurring = useDeleteRecurringTransaction();

  const { data: wallets = [] } = useWallets();
  const { data: categoriesTree = [] } = useCategories();

  const allowed = useCanEdit();

  // Navigation state
  const [activeTab, setActiveTab] = React.useState<string>("scheduled");

  // Scheduled Cancel State
  const [confirmCancel, setConfirmCancel] = React.useState<string | null>(null);

  // Recurring Form Dialog State
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<RecurringTransaction | null>(null);

  // Form Fields State
  const [amount, setAmount] = React.useState("");
  const [type, setType] = React.useState<TransactionType>("expense");
  const [walletId, setWalletId] = React.useState("");
  const [toWalletId, setToWalletId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [frequency, setFrequency] = React.useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [interval, setInterval] = React.useState("1");
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = React.useState("");

  // Delete Recurring Template State
  const [confirmDeleteRecurring, setConfirmDeleteRecurring] = React.useState<string | null>(null);

  const groupedScheduled = React.useMemo(() => groupByMonth(scheduled), [scheduled]);

  // Flattened categories for selector dropdown
  const flatCategories = React.useMemo(() => {
    return categoriesTree.flatMap((parent) => [
      parent,
      ...parent.subcategories.map((sub) => ({
        ...sub,
        name: `↳ ${sub.name}`,
      })),
    ]);
  }, [categoriesTree]);

  // Handlers for scheduled transactions
  const handleCancelScheduled = async () => {
    if (!confirmCancel) return;
    if (!allowed) {
      viewOnlyToast();
      setConfirmCancel(null);
      return;
    }
    try {
      await cancelTx.mutateAsync(confirmCancel);
      toast.success("Transaksi terjadwal dibatalkan");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal membatalkan";
      toast.error(message);
    } finally {
      setConfirmCancel(null);
    }
  };

  const handleMaterializeScheduled = async (id: string) => {
    if (!allowed) {
      viewOnlyToast();
      return;
    }
    try {
      await materialize.mutateAsync(id);
      toast.success("Transaksi dijadikan aktif sekarang");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menjadikan aktif";
      toast.error(message);
    }
  };

  // Handlers for recurring templates
  const handleOpenAddDialog = () => {
    if (!allowed) {
      viewOnlyToast();
      return;
    }
    setEditingTemplate(null);
    setAmount("");
    setType("expense");
    setWalletId(wallets[0]?.id || "");
    setToWalletId("");
    setCategoryId("");
    setNote("");
    setFrequency("monthly");
    setInterval("1");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (t: RecurringTransaction) => {
    if (!allowed) {
      viewOnlyToast();
      return;
    }
    setEditingTemplate(t);
    setAmount(String(t.amount));
    setType(t.type);
    setWalletId(t.wallet_id);
    setToWalletId(t.to_wallet_id || "");
    setCategoryId(t.category_id || "");
    setNote(t.note || "");
    setFrequency(t.frequency);
    setInterval(String(t.interval));
    setStartDate(t.start_date);
    setEndDate(t.end_date || "");
    setDialogOpen(true);
  };

  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error("Jumlah uang harus lebih besar dari 0");
      return;
    }
    if (!walletId) {
      toast.error("Silakan pilih dompet");
      return;
    }
    if (type === "transfer" && !toWalletId) {
      toast.error("Silakan pilih dompet tujuan transfer");
      return;
    }
    if (type === "transfer" && walletId === toWalletId) {
      toast.error("Dompet asal dan tujuan transfer tidak boleh sama");
      return;
    }
    if (type !== "transfer" && !categoryId) {
      toast.error("Silakan pilih kategori");
      return;
    }

    try {
      if (editingTemplate) {
        // Update existing template
        await updateRecurring.mutateAsync({
          id: editingTemplate.id,
          amount: Number(amount),
          wallet_id: walletId,
          to_wallet_id: type === "transfer" ? toWalletId : null,
          category_id: type !== "transfer" ? categoryId : null,
          note: note || null,
          frequency,
          interval: Number(interval) || 1,
          is_active: editingTemplate.is_active,
        });
        toast.success("Transaksi berulang berhasil diperbarui!");
      } else {
        // Create new template
        await createRecurring.mutateAsync({
          amount: Number(amount),
          type,
          wallet_id: walletId,
          to_wallet_id: type === "transfer" ? toWalletId : null,
          category_id: type !== "transfer" ? categoryId : null,
          note: note || null,
          frequency,
          interval: Number(interval) || 1,
          start_date: startDate,
          end_date: endDate || null,
        });
        toast.success("Transaksi berulang baru berhasil dijadwalkan!");
      }
      setDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan jadwal";
      toast.error(message);
    }
  };

  const handleToggleRecurringActive = async (t: RecurringTransaction) => {
    if (!allowed) {
      viewOnlyToast();
      return;
    }
    try {
      await updateRecurring.mutateAsync({
        id: t.id,
        amount: t.amount,
        wallet_id: t.wallet_id,
        to_wallet_id: t.to_wallet_id,
        category_id: t.category_id,
        note: t.note,
        frequency: t.frequency,
        interval: t.interval,
        is_active: !t.is_active,
      });
      toast.success(t.is_active ? "Jadwal dinonaktifkan" : "Jadwal diaktifkan kembali");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal mengubah status aktif";
      toast.error(message);
    }
  };

  const handleDeleteRecurring = async () => {
    if (!confirmDeleteRecurring) return;
    if (!allowed) {
      viewOnlyToast();
      setConfirmDeleteRecurring(null);
      return;
    }
    try {
      await deleteRecurring.mutateAsync(confirmDeleteRecurring);
      toast.success("Transaksi berulang berhasil dihapus");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menghapus";
      toast.error(message);
    } finally {
      setConfirmDeleteRecurring(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeading
          title="Transaksi Terjadwal"
          subtitle="Kelola pengeluaran terjadwal di masa depan dan transaksi berulang berkala"
        />
        {activeTab === "recurring" && (
          <Button
            onClick={handleOpenAddDialog}
            className="bg-mint-strong hover:bg-mint-strong/90 text-white rounded-xl h-11 px-4 text-sm font-semibold flex items-center justify-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="size-4" />
            Tambah Berulang
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-sm mb-6 bg-muted/40 p-1 rounded-xl">
          <TabsTrigger value="scheduled" className="rounded-lg py-2 text-xs font-semibold data-active:bg-background">
            Masa Depan ({scheduled.length})
          </TabsTrigger>
          <TabsTrigger value="recurring" className="rounded-lg py-2 text-xs font-semibold data-active:bg-background">
            Transaksi Berulang ({recurring.length})
          </TabsTrigger>
        </TabsList>

        {/* SCHEDULED (FUTURE DATE) CONTENT */}
        <TabsContent value="scheduled" className="outline-none">
          {isLoadingScheduled ? (
            <div className="h-40 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : scheduled.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Belum ada transaksi terjadwal"
              description="Catatan dengan tanggal di masa depan akan muncul di sini dan tidak akan memengaruhi saldo sampai tanggalnya terlewati."
            />
          ) : (
            <div className="space-y-6">
              {groupedScheduled.map((g) => (
                <section key={g.key} className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-1">
                    {g.label}
                  </h2>
                  <div className="rounded-2xl border bg-card overflow-hidden divide-y">
                    {g.items.map((t) => {
                      const isExpense = t.type === "expense";
                      const isTransfer = t.type === "transfer";
                      const sign = isExpense ? "-" : t.type === "income" ? "+" : "";
                      return (
                        <div
                          key={t.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/10 transition-colors"
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-3">
                            <span
                              className="grid size-10 place-items-center rounded-xl text-white shrink-0 shadow-sm"
                              style={{
                                backgroundColor:
                                  t.category?.color ??
                                  (isExpense ? "#E8A5A5" : isTransfer ? "#A5D8E8" : "#5FBF9A"),
                              }}
                              aria-hidden
                            >
                              {isTransfer ? (
                                <ArrowRightLeft className="size-5" />
                              ) : (
                                <CalendarClock className="size-5" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">
                                {t.note || t.category?.name || (isTransfer ? "Transfer Uang" : "Transaksi")}
                              </p>
                              <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                                {isTransfer ? (
                                  <span>
                                    {t.wallet.name} <span className="text-muted-foreground/60">→</span> {t.to_wallet?.name}
                                  </span>
                                ) : (
                                  <span>
                                    {t.category?.name ?? "Tanpa kategori"} · {t.wallet.name}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground font-medium mt-0.5 flex items-center gap-1.5">
                                <Calendar className="size-3.5" />
                                {formatDate(t.occurred_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                            <span
                              className={`text-sm font-bold ${
                                isExpense ? "text-expense" : isTransfer ? "text-muted-foreground" : "text-income"
                              }`}
                            >
                              {sign}
                              {formatCurrency(Number(t.amount))}
                            </span>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl gap-1 text-xs h-8 border-mint-strong/20 hover:border-mint-strong/40 text-mint-strong hover:bg-mint-soft/20"
                                onClick={() => handleMaterializeScheduled(t.id)}
                                disabled={materialize.isPending}
                                aria-label="Jadikan aktif sekarang"
                              >
                                <Check className="size-3.5" aria-hidden />
                                Aktifkan
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-xl text-xs h-8 text-expense hover:text-expense hover:bg-red-50/50 dark:hover:bg-red-950/20"
                                onClick={() => setConfirmCancel(t.id)}
                                disabled={cancelTx.isPending}
                                aria-label="Batalkan"
                              >
                                <X className="size-3.5" aria-hidden />
                                Batal
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        {/* RECURRING TEMPLATES CONTENT */}
        <TabsContent value="recurring" className="outline-none">
          {isLoadingRecurring ? (
            <div className="h-40 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : recurring.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="Belum ada transaksi berulang"
              description="Jadwalkan template transaksi berkala (bulanan, mingguan, dll). Aplikasi akan otomatis membuat transaksi nyata di tanggal jatuh tempo."
            />
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border bg-card overflow-hidden divide-y shadow-sm">
                {recurring.map((t) => {
                  const isExpense = t.type === "expense";
                  const isTransfer = t.type === "transfer";
                  const walletName = wallets.find((w) => w.id === t.wallet_id)?.name || "Dompet";
                  const toWalletName = isTransfer ? wallets.find((w) => w.id === t.to_wallet_id)?.name || "Dompet" : "";
                  
                  // Dynamically resolve category color and name from tree
                  let catColor = "";
                  let catName = "";
                  let catIcon = "";
                  
                  if (!isTransfer && t.category_id) {
                    const flat = categoriesTree.flatMap((c) => [c, ...c.subcategories]);
                    const matchedCat = flat.find((c) => c.id === t.category_id);
                    if (matchedCat) {
                      catColor = matchedCat.color || "";
                      catName = matchedCat.name;
                      catIcon = matchedCat.icon || "";
                    }
                  }

                  const sign = isExpense ? "-" : t.type === "income" ? "+" : "";

                  return (
                    <div
                      key={t.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/10 ${
                        !t.is_active ? "opacity-60 bg-muted/5" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-3">
                        <span
                          className="grid size-10 place-items-center rounded-xl text-white shrink-0 font-bold shadow-sm"
                          style={{
                            backgroundColor:
                              catColor ||
                              (isExpense ? "#E8A5A5" : isTransfer ? "#A5D8E8" : "#5FBF9A"),
                          }}
                          aria-hidden
                        >
                          {isTransfer ? (
                            <ArrowRightLeft className="size-5" />
                          ) : catIcon ? (
                            <span className="text-lg">{catIcon}</span>
                          ) : (
                            <Repeat className="size-5" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-foreground truncate">
                              {t.note || catName || (isTransfer ? "Transfer Berulang" : "Transaksi Berkala")}
                            </p>
                            {!t.is_active && (
                              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold">
                                Nonaktif
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                            {isTransfer ? (
                              <span>
                                {walletName} <span className="text-muted-foreground/60">→</span> {toWalletName}
                              </span>
                            ) : (
                              <span>
                                {catName ?? "Tanpa kategori"} · {walletName}
                              </span>
                            )}
                          </p>
                          <div className="text-[11px] text-muted-foreground font-bold mt-1.5 flex flex-wrap items-center gap-3 bg-muted/30 w-fit px-2.5 py-1 rounded-lg">
                            <span className="flex items-center gap-1 text-mint-strong">
                              <Repeat className="size-3" />
                              {getRecurrenceLabel(t.frequency, t.interval)}
                            </span>
                            {t.is_active && t.next_materialize_at && (
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                                <Calendar className="size-3" />
                                Jt Tempo: {formatDate(t.next_materialize_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                        <span
                          className={`text-sm font-extrabold ${
                            isExpense ? "text-expense" : isTransfer ? "text-muted-foreground" : "text-income"
                          }`}
                        >
                          {sign}
                          {formatCurrency(t.amount)}
                        </span>
                        <div className="flex items-center gap-2">
                          {/* Active Switch Toggle */}
                          <Switch
                            checked={t.is_active}
                            onCheckedChange={() => handleToggleRecurringActive(t)}
                            disabled={updateRecurring.isPending}
                            aria-label="Aktifkan/Nonaktifkan Transaksi Berulang"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => handleOpenEditDialog(t)}
                            aria-label="Ubah jadwal"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 rounded-xl text-expense hover:text-expense hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => setConfirmDeleteRecurring(t.id)}
                            aria-label="Hapus jadwal"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* SCHEDULED CANCEL CONFIRMATION */}
      <Dialog
        open={confirmCancel !== null}
        onOpenChange={(o) => !o && setConfirmCancel(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Batalkan transaksi terjadwal?</DialogTitle>
            <DialogDescription>
              Transaksi akan dipindahkan ke Recycle Bin selama 30 hari sebelum
              dihapus secara permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-xl h-11"
              onClick={() => setConfirmCancel(null)}
            >
              Kembali
            </Button>
            <Button
              className="rounded-xl h-11 bg-expense text-white hover:bg-expense/90"
              onClick={handleCancelScheduled}
              disabled={cancelTx.isPending}
            >
              {cancelTx.isPending ? "Memproses..." : "Ya, Batalkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RECURRING DELETE CONFIRMATION */}
      <Dialog
        open={confirmDeleteRecurring !== null}
        onOpenChange={(o) => !o && setConfirmDeleteRecurring(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-5" /> Hapus Transaksi Berulang?
            </DialogTitle>
            <DialogDescription>
              Tindakan ini akan menghentikan jadwal transaksi berulang ini secara permanen. Transaksi nyata yang telah dibuat sebelumnya dari template ini akan tetap aman.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-xl h-11"
              onClick={() => setConfirmDeleteRecurring(null)}
            >
              Batal
            </Button>
            <Button
              className="rounded-xl h-11 bg-red-600 text-white hover:bg-red-700"
              onClick={handleDeleteRecurring}
              disabled={deleteRecurring.isPending}
            >
              {deleteRecurring.isPending ? "Menghapus..." : "Ya, Hapus Permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RECURRING ADD / EDIT FORM DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Ubah Transaksi Berulang" : "Buat Transaksi Berulang Baru"}</DialogTitle>
            <DialogDescription>
              Definisikan aturan nominal, dompet, kategori, dan siklus interval waktu jatuh tempo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRecurring} className="space-y-4">
            <div className="space-y-3">
              {/* Type Switcher (only editable when creating) */}
              <div className="flex flex-col gap-1.5">
                <Label>Jenis Transaksi</Label>
                <div className="grid grid-cols-3 gap-2 bg-muted/40 p-1 rounded-xl">
                  {(["expense", "income", "transfer"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={!!editingTemplate}
                      onClick={() => setType(t)}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all capitalize ${
                        type === t
                          ? t === "expense"
                            ? "bg-expense text-white shadow-sm"
                            : t === "income"
                            ? "bg-mint-strong text-white shadow-sm"
                            : "bg-blue-500 text-white shadow-sm"
                          : "text-muted-foreground hover:bg-muted/40"
                      } ${!!editingTemplate ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {t === "expense" ? "Pengeluaran" : t === "income" ? "Pemasukan" : "Transfer"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount input */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amountInput">Jumlah Uang (Rp)</Label>
                <Input
                  id="amountInput"
                  type="number"
                  placeholder="Masukkan nominal angka"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 rounded-xl font-bold"
                  required
                />
              </div>

              {/* Wallets & Categories Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="walletSelect">{type === "transfer" ? "Dompet Asal" : "Sumber Dompet"}</Label>
                  <Select value={walletId} onValueChange={setWalletId}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Pilih dompet" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.filter((w) => !w.is_archived).map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {type === "transfer" ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="toWalletSelect">Dompet Tujuan</Label>
                    <Select value={toWalletId} onValueChange={setToWalletId}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Pilih dompet tujuan" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallets.filter((w) => !w.is_archived).map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="categorySelect">Kategori</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Pilih kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        {flatCategories
                          .filter((c) => c.kind === type)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Recurrence Rule Fields */}
              <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3 rounded-2xl border">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="frequencySelect">Frekuensi</Label>
                  <Select
                    value={frequency}
                    onValueChange={(val: "daily" | "weekly" | "monthly" | "yearly") => setFrequency(val)}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-background">
                      <SelectValue placeholder="Frekuensi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Harian</SelectItem>
                      <SelectItem value="weekly">Mingguan</SelectItem>
                      <SelectItem value="monthly">Bulanan</SelectItem>
                      <SelectItem value="yearly">Tahunan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="intervalInput">Ulangi Setiap (Interval)</Label>
                  <Input
                    id="intervalInput"
                    type="number"
                    min="1"
                    placeholder="1"
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    className="h-11 rounded-xl bg-background"
                    required
                  />
                </div>
              </div>

              {/* Start Date & End Date (End Date is optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="startDateInput">Tanggal Mulai</Label>
                  <Input
                    id="startDateInput"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={!!editingTemplate}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="endDateInput">Tanggal Selesai (Opsional)</Label>
                  <Input
                    id="endDateInput"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              {/* Note / Memo */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="noteInput">Catatan / Keterangan</Label>
                <Input
                  id="noteInput"
                  placeholder="Contoh: Pembayaran Kost Bulanan, Berlangganan Spotify"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="submit"
                disabled={createRecurring.isPending || updateRecurring.isPending}
                className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold w-full"
              >
                {createRecurring.isPending || updateRecurring.isPending
                  ? "Menyimpan..."
                  : editingTemplate
                  ? "Simpan Perubahan"
                  : "Mulai Jadwalkan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
