"use client";

import * as React from "react";
import { useDebts, useCreateDebt, useUpdateDebt, useDeleteDebt } from "@/hooks/use-debts";
import { formatCurrency } from "@/lib/format";
import { PageHeading } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Scale,
  Calendar,
  Plus,
  Loader2,
  Sparkles,
  ChevronLeft,
  Info,
  TrendingDown,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { parseAmountExpression } from "@/lib/calculator";
import type { Debt } from "@/lib/supabase/types";
import Link from "next/link";

export default function DebtsPage() {
  const [activeTab, setActiveTab] = React.useState<"payable" | "receivable">("payable");
  
  // Queries & Mutations
  const { data: debts = [], isLoading } = useDebts();
  const createDebtMutation = useCreateDebt();
  const updateDebtMutation = useUpdateDebt();
  const deleteDebtMutation = useDeleteDebt();

  // Modal states
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingDebt, setEditingDebt] = React.useState<Debt | null>(null);
  const [debtName, setDebtName] = React.useState("");
  const [debtAmount, setDebtAmount] = React.useState("");
  const [debtRemaining, setDebtRemaining] = React.useState("");
  const [debtDueDate, setDebtDueDate] = React.useState("");
  const [debtNote, setDebtNote] = React.useState("");

  // Payment states
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [paymentDebt, setPaymentDebt] = React.useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = React.useState("");

  // Separate and filter debts
  const filteredDebts = React.useMemo(() => {
    return debts.filter((d) => d.type === activeTab);
  }, [debts, activeTab]);

  // Statistics calculation
  const stats = React.useMemo(() => {
    const active = debts.filter((d) => d.type === activeTab && !d.is_completed);
    const completed = debts.filter((d) => d.type === activeTab && d.is_completed);

    const totalActiveAmount = active.reduce((sum, d) => sum + d.remaining_amount, 0);
    const countCompleted = completed.length;

    return {
      totalActiveAmount,
      countActive: active.length,
      countCompleted,
    };
  }, [debts, activeTab]);

  // Open Add Modal
  const handleOpenCreateDebt = () => {
    setEditingDebt(null);
    setDebtName("");
    setDebtAmount("");
    setDebtRemaining("");
    setDebtDueDate("");
    setDebtNote("");
    setDialogOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditDebt = (debt: Debt) => {
    setEditingDebt(debt);
    setDebtName(debt.name);
    setDebtAmount(String(debt.amount));
    setDebtRemaining(String(debt.remaining_amount));
    setDebtDueDate(debt.due_date || "");
    setDebtNote(debt.note || "");
    setDialogOpen(true);
  };

  // Save Debt Submit
  const handleSaveDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtName.trim()) {
      toast.error("Nama kontak/pihak luar tidak boleh kosong.");
      return;
    }

    const amountVal = parseAmountExpression(debtAmount);
    if (amountVal === null || amountVal <= 0) {
      toast.error("Format nominal utang awal tidak valid.");
      return;
    }

    // Default remaining to amount if empty
    const remainingVal = debtRemaining.trim()
      ? parseAmountExpression(debtRemaining)
      : amountVal;

    if (remainingVal === null || remainingVal < 0) {
      toast.error("Format sisa nominal berjalan tidak valid.");
      return;
    }

    if (remainingVal > amountVal) {
      toast.error("Sisa nominal berjalan tidak boleh melebihi nominal awal.");
      return;
    }

    try {
      if (editingDebt) {
        await updateDebtMutation.mutateAsync({
          id: editingDebt.id,
          name: debtName,
          amount: amountVal,
          remaining_amount: remainingVal,
          due_date: debtDueDate || null,
          note: debtNote || null,
        });
        toast.success("Catatan utang-piutang berhasil diperbarui!");
      } else {
        await createDebtMutation.mutateAsync({
          name: debtName,
          type: activeTab,
          amount: amountVal,
          due_date: debtDueDate || null,
          note: debtNote || null,
        });
        toast.success("Catatan utang-piutang berhasil ditambahkan!");
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan catatan.");
    }
  };

  // Delete Debt Handler
  const handleDeleteDebt = async () => {
    if (!editingDebt) return;
    try {
      await deleteDebtMutation.mutateAsync(editingDebt.id);
      toast.success("Catatan utang-piutang berhasil dihapus.");
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus catatan.");
    }
  };

  // Repayment Submit
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDebt) return;

    const parsed = parseAmountExpression(paymentAmount);
    if (parsed === null || parsed <= 0) {
      toast.error("Format nominal angsuran tidak valid.");
      return;
    }

    if (parsed > paymentDebt.remaining_amount) {
      toast.error("Jumlah angsuran tidak boleh melebihi sisa kewajiban.");
      return;
    }

    try {
      const newRemaining = paymentDebt.remaining_amount - parsed;
      await updateDebtMutation.mutateAsync({
        id: paymentDebt.id,
        name: paymentDebt.name,
        amount: paymentDebt.amount,
        remaining_amount: newRemaining,
        due_date: paymentDebt.due_date,
        note: paymentDebt.note,
      });

      toast.success(
        newRemaining <= 0
          ? `Selamat! Utang dengan ${paymentDebt.name} berhasil dilunasi! 🎉`
          : `Berhasil mengangsur ${formatCurrency(parsed)} ke ${paymentDebt.name}!`
      );
      setPaymentDialogOpen(false);
      setPaymentAmount("");
    } catch (err: any) {
      toast.error(err.message || "Gagal mencatat cicilan.");
    }
  };

  // Circular progress ring helper
  const renderProgressCircle = (current: number, target: number, color: string, emoji: string) => {
    const remaining = Math.max(0, current);
    const paid = Math.max(0, target - remaining);
    const percent = target > 0 ? (paid / target) * 100 : 0;
    
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

  // Precision due date helper
  const getDueDateBadge = (dueDateStr: string | null, isCompleted: boolean) => {
    if (isCompleted) {
      return (
        <span className="text-emerald-500 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-md">
          • Lunas
        </span>
      );
    }
    if (!dueDateStr) return null;

    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="text-red-500 font-bold bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded-md animate-pulse">
          • Terlambat {Math.abs(diffDays)} hari
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="text-amber-500 font-bold bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded-md">
          • Jatuh tempo hari ini
        </span>
      );
    } else {
      return (
        <span className="text-mint-strong font-semibold bg-mint-soft/30 dark:bg-mint-soft/10 px-1.5 py-0.5 rounded-md">
          • Sisa {diffDays} hari
        </span>
      );
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-dvh flex flex-col space-y-5 pb-20">
      {/* Page Header */}
      <div className="flex items-center gap-1.5">
        <Link href="/settings" className="size-9 rounded-xl hover:bg-muted flex items-center justify-center border bg-card">
          <ChevronLeft className="size-5 text-muted-foreground" />
        </Link>
        <PageHeading
          title="Hutang & Piutang"
          subtitle="Kelola kewajiban utang dan tagihan piutang"
        />
      </div>

      {/* Tabs Control */}
      <div className="grid grid-cols-2 p-1 bg-muted/40 backdrop-blur-xs rounded-xl border border-muted select-none">
        <button
          onClick={() => setActiveTab("payable")}
          className={`h-9 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "payable"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Utang Saya (Kewajiban)
        </button>
        <button
          onClick={() => setActiveTab("receivable")}
          className={`h-9 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "receivable"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Piutang Saya (Tagihan)
        </button>
      </div>

      {/* Statistics Rings */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4 space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
            <Coins className="size-3 text-mint-strong" /> Total Belum Lunas
          </span>
          <p className="text-[15px] font-extrabold text-foreground truncate">
            {formatCurrency(stats.totalActiveAmount)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
            <Sparkles className="size-3 text-emerald-500" /> Selesai / Lunas
          </span>
          <p className="text-[15px] font-extrabold text-emerald-600 dark:text-emerald-400 truncate">
            {stats.countCompleted} Catatan
          </p>
        </div>
      </div>

      {/* Action Add Bar */}
      <div className="flex items-center justify-between bg-card border rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Scale className="size-5 text-mint-strong" />
          <span className="font-bold text-foreground text-sm">
            {activeTab === "payable" ? "Daftar Utang Pihak Lain" : "Daftar Piutang Saya"}
          </span>
        </div>
        <Button
          onClick={handleOpenCreateDebt}
          className="h-8 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 gap-1.5 text-xs font-semibold px-3"
        >
          <Plus className="size-3.5" /> Catatan Baru
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="size-8 animate-spin text-mint-strong" />
          <p className="text-xs text-muted-foreground">Memuat catatan utang-piutang...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDebts.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center bg-card/50 space-y-3">
              <div className="grid size-12 place-items-center rounded-2xl bg-muted/40 mx-auto text-muted-foreground">
                <Scale className="size-6 text-mint-strong" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">Belum ada catatan aktif</p>
                <p className="text-xs text-muted-foreground">
                  {activeTab === "payable"
                    ? "Semua kewajiban utang Anda saat ini bersih atau sudah lunas."
                    : "Anda tidak memiliki tagihan piutang aktif kepada orang lain."}
                </p>
              </div>
              <Button
                onClick={handleOpenCreateDebt}
                className="h-9 px-4 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 text-xs font-semibold gap-1.5"
              >
                <Plus className="size-4" /> Tambah Catatan Baru
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredDebts.map((debt) => {
                const totalPaid = Math.max(0, debt.amount - debt.remaining_amount);
                const percent = debt.amount > 0 ? (totalPaid / debt.amount) * 100 : 0;
                const emoji = debt.type === "payable" ? "💸" : "💰";
                const color = debt.type === "payable" ? "#E8A5A5" : "#5FBF9A"; // rose for payable, mint for receivable

                return (
                  <div
                    key={debt.id}
                    className="rounded-2xl border bg-card p-4 space-y-3.5 transition-all hover:border-muted-foreground/20"
                  >
                    <div className="flex items-center gap-3">
                      {/* Circle Ring Progress */}
                      {renderProgressCircle(debt.remaining_amount, debt.amount, color, emoji)}

                      {/* Text Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 justify-between">
                          <h4 className="font-bold text-sm text-foreground truncate pr-2">
                            {debt.name}
                          </h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                            debt.is_completed
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : debt.type === "payable"
                              ? "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400"
                              : "bg-mint-soft text-mint-strong dark:bg-mint-soft/10 dark:text-mint-soft"
                          }`}>
                            {debt.is_completed ? "Lunas" : `${Math.round(percent)}% Terbayar`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-0.5">
                          <span className="font-semibold text-foreground">
                            Sisa {formatCurrency(debt.remaining_amount)}
                          </span>
                          <span className="text-muted-foreground">
                            dari {formatCurrency(debt.amount)}
                          </span>
                        </div>
                        
                        {/* Due Date Indicator */}
                        {(debt.due_date || debt.is_completed) && (
                          <div className="flex items-center gap-1 text-[9px] text-muted-foreground/80 mt-1 select-none flex-wrap">
                            <Calendar className="size-3 text-mint-strong" />
                            {debt.due_date && (
                              <span>Hingga {new Date(debt.due_date).toLocaleDateString("id-ID", { month: "short", day: "numeric", year: "numeric" })}</span>
                            )}
                            {getDueDateBadge(debt.due_date, debt.is_completed)}
                          </div>
                        )}

                        {/* Note */}
                        {debt.note && (
                          <div className="flex items-start gap-1 text-[9px] text-muted-foreground/60 mt-1 italic border-l pl-2 border-muted-foreground/20 leading-normal">
                            <Info className="size-2.5 shrink-0 mt-0.5 text-muted-foreground/50" />
                            <span className="truncate">{debt.note}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setPaymentDebt(debt);
                          setPaymentAmount("");
                          setPaymentDialogOpen(true);
                        }}
                        disabled={debt.is_completed}
                        className={`flex-1 h-9 rounded-xl font-semibold text-xs transition-all ${
                          debt.is_completed
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 cursor-default"
                            : debt.type === "payable"
                            ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200/20 dark:bg-red-950/10 dark:text-red-400"
                            : "bg-mint-soft text-mint-strong border border-mint-strong/10 hover:bg-mint-soft/80"
                        }`}
                      >
                        {debt.is_completed ? "Lunas Selesai! 🎉" : debt.type === "payable" ? "- Angsur Utang" : "+ Tagih Piutang"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditDebt(debt)}
                        className="h-9 rounded-xl border-muted hover:bg-muted text-xs font-semibold px-3 shrink-0"
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

      {/* Quick Installment Repayment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl select-none">{paymentDebt?.type === "payable" ? "💸" : "💰"}</span>
              <span>{paymentDebt?.type === "payable" ? "Bayar Angsuran Utang" : "Terima Pembayaran Piutang"}</span>
            </DialogTitle>
          </DialogHeader>

          {paymentDebt && (
            <form onSubmit={handlePayment} className="space-y-4 pt-2">
              <div className="bg-muted/30 border p-3.5 rounded-2xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pihak Luar:</span>
                  <span className="font-semibold text-foreground">{paymentDebt.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Sisa Kewajiban:</span>
                  <span className="font-semibold text-red-500">{formatCurrency(paymentDebt.remaining_amount)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="payment_amount">Nominal Setoran Cicilan (Rp)</Label>
                <Input
                  id="payment_amount"
                  placeholder="Contoh: 100000 atau 500000 * 2"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="h-11 rounded-xl pr-3"
                  required
                  autoFocus
                />
                {/* Real-time Math Expression Preview */}
                {parseAmountExpression(paymentAmount) !== null && (
                  <p className="text-xs text-mint-strong font-semibold flex items-center gap-1 mt-0.5">
                    <Sparkles className="size-3.5" />
                    <span>Hasil evaluasi: {formatCurrency(parseAmountExpression(paymentAmount)!)}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={updateDebtMutation.isPending}
                  className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold"
                >
                  {updateDebtMutation.isPending ? "Memproses..." : "Konfirmasi Pembayaran"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit Debt Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl select-none">{activeTab === "payable" ? "💸" : "💰"}</span>
              <span>{editingDebt ? "Ubah Catatan" : activeTab === "payable" ? "Tambah Utang Baru" : "Tambah Piutang Baru"}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveDebt} className="space-y-4 pt-2">
            {/*外 Nama Pihak Luar */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="debt_name">Nama Pihak Luar (Kontak)</Label>
              <Input
                id="debt_name"
                placeholder="Contoh: Budi, Bank Mandiri, Tokopedia PayLater"
                value={debtName}
                onChange={(e) => setDebtName(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>

            {/* Total Amount */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="debt_target">Nominal Utang Awal (Rp)</Label>
              <Input
                id="debt_target"
                placeholder="Contoh: 5000000 atau 1000000 * 5"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
              {parseAmountExpression(debtAmount) !== null && (
                <p className="text-xs text-mint-strong font-semibold flex items-center gap-1 mt-0.5">
                  <Sparkles className="size-3.5" />
                  <span>Hasil evaluasi: {formatCurrency(parseAmountExpression(debtAmount)!)}</span>
                </p>
              )}
            </div>

            {/* Remaining Amount */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="debt_current">Sisa Nominal Berjalan (Rp) (Opsional)</Label>
              <Input
                id="debt_current"
                placeholder="Biarkan kosong jika sama dengan nominal awal"
                value={debtRemaining}
                onChange={(e) => setDebtRemaining(e.target.value)}
                className="h-11 rounded-xl"
              />
              {parseAmountExpression(debtRemaining) !== null && (
                <p className="text-xs text-mint-strong font-semibold flex items-center gap-1 mt-0.5">
                  <Sparkles className="size-3.5" />
                  <span>Hasil evaluasi: {formatCurrency(parseAmountExpression(debtRemaining)!)}</span>
                </p>
              )}
            </div>

            {/* Due Date */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="debt_due">Tenggat Waktu Pelunasan (Opsional)</Label>
              <Input
                id="debt_due"
                type="date"
                value={debtDueDate}
                onChange={(e) => setDebtDueDate(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            {/* Note */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="debt_note">Catatan Tambahan (Keterangan)</Label>
              <Input
                id="debt_note"
                placeholder="Contoh: Pinjam untuk modal usaha"
                value={debtNote}
                onChange={(e) => setDebtNote(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            {/* Form Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                disabled={createDebtMutation.isPending || updateDebtMutation.isPending}
                className="h-11 rounded-xl bg-mint-strong text-white hover:bg-mint-strong/90 font-semibold"
              >
                {createDebtMutation.isPending || updateDebtMutation.isPending ? "Menyimpan..." : "Simpan Catatan"}
              </Button>

              {editingDebt && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDeleteDebt}
                  disabled={deleteDebtMutation.isPending}
                  className="h-10 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold"
                >
                  {deleteDebtMutation.isPending ? "Menghapus..." : "Hapus Catatan"}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
