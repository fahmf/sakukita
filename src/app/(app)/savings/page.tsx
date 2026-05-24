"use client";

import * as React from "react";
import Link from "next/link";
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from "@/hooks/use-goals";
import type { SavingsGoal } from "@/lib/supabase/types";
import { useHousehold } from "@/components/providers/household-provider";
import { PageHeading, EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  PiggyBank,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Calendar,
  CheckCircle2,
  Award,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";

// Preset colors for savings goals
const presetColors = [
  "#B8E6D3", // Soft Mint (Default)
  "#A5C8E8", // Soft Blue
  "#C8A5E8", // Soft Purple
  "#E8A5A5", // Soft Red
  "#E8D2A5", // Soft Gold
  "#A5E8C8", // Soft Emerald
];

export default function SavingsGoalsPage() {
  useHousehold();
  const { data: goals = [], isLoading: loadingGoals } = useGoals();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const allowed = useCanEdit();

  // Dialog States
  const [goalOpen, setGoalOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<SavingsGoal | null>(null);
  const [addFundsOpen, setAddFundsOpen] = React.useState(false);
  const [fundsTargetGoal, setFundsTargetGoal] = React.useState<SavingsGoal | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [goalToDelete, setGoalToDelete] = React.useState<SavingsGoal | null>(null);

  // Form States
  const [name, setName] = React.useState("");
  const [targetAmount, setTargetAmount] = React.useState("");
  const [currentAmount, setCurrentAmount] = React.useState("");
  const [targetDate, setTargetDate] = React.useState("");
  const [selectedColor, setSelectedColor] = React.useState("#B8E6D3");
  const [addAmount, setAddAmount] = React.useState("");

  // Calculate stats
  const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0);

  const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);

  const overallProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  // Open Handlers
  const handleOpenAdd = () => {
    if (!allowed) {
      viewOnlyToast();
      return;
    }
    setEditingGoal(null);
    setName("");
    setTargetAmount("");
    setCurrentAmount("0");
    setTargetDate("");
    setSelectedColor(presetColors[0]);
    setGoalOpen(true);
  };

  const handleOpenEdit = (goal: SavingsGoal) => {
    if (!allowed) {
      viewOnlyToast();
      return;
    }
    setEditingGoal(goal);
    setName(goal.name);
    setTargetAmount(String(goal.target_amount));
    setCurrentAmount(String(goal.current_amount));
    setTargetDate(goal.target_date || "");
    setSelectedColor(goal.color || presetColors[0]);
    setGoalOpen(true);
  };

  const handleOpenAddFunds = (goal: SavingsGoal) => {
    if (!allowed) {
      viewOnlyToast();
      return;
    }
    setFundsTargetGoal(goal);
    setAddAmount("");
    setAddFundsOpen(true);
  };

  const handleOpenDelete = (goal: SavingsGoal) => {
    if (!allowed) {
      viewOnlyToast();
      return;
    }
    setGoalToDelete(goal);
    setDeleteOpen(true);
  };

  // Submit Handlers
  const handleSubmitGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetAmount) return;

    const targetVal = Number(targetAmount);
    const currentVal = Number(currentAmount || 0);

    if (isNaN(targetVal) || targetVal <= 0) {
      toast.error("Target tabungan harus berupa angka positif.");
      return;
    }

    try {
      if (editingGoal) {
        await updateGoal.mutateAsync({
          id: editingGoal.id,
          name: name.trim(),
          target_amount: targetVal,
          current_amount: currentVal,
          target_date: targetDate || null,
          color: selectedColor,
        });
        toast.success("Target tabungan berhasil diperbarui!");
      } else {
        await createGoal.mutateAsync({
          name: name.trim(),
          target_amount: targetVal,
          current_amount: currentVal,
          target_date: targetDate || null,
          color: selectedColor,
        });
        toast.success("Target tabungan berhasil dibuat!");
      }
      setGoalOpen(false);
    } catch {
      toast.error("Gagal menyimpan target tabungan.");
    }
  };

  const handleSubmitAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundsTargetGoal || !addAmount) return;

    const addVal = Number(addAmount);
    if (isNaN(addVal) || addVal <= 0) {
      toast.error("Nominal tabungan harus berupa angka positif.");
      return;
    }

    try {
      const newCurrentAmount = Number(fundsTargetGoal.current_amount) + addVal;
      await updateGoal.mutateAsync({
        id: fundsTargetGoal.id,
        name: fundsTargetGoal.name,
        target_amount: fundsTargetGoal.target_amount,
        current_amount: newCurrentAmount,
        target_date: fundsTargetGoal.target_date,
        color: fundsTargetGoal.color,
      });

      // Special success toast
      if (newCurrentAmount >= fundsTargetGoal.target_amount) {
        toast.success(`🎉 Selamat! Target "${fundsTargetGoal.name}" telah tercapai!`);
      } else {
        toast.success(`Berhasil menambahkan ${formatCurrency(addVal)} ke ${fundsTargetGoal.name}!`);
      }
      setAddFundsOpen(false);
    } catch {
      toast.error("Gagal menambahkan tabungan.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!goalToDelete) return;
    try {
      await deleteGoal.mutateAsync(goalToDelete.id);
      toast.success("Target tabungan berhasil dihapus");
    } catch {
      toast.error("Gagal menghapus target tabungan.");
    } finally {
      setDeleteOpen(false);
      setGoalToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with back link */}
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="grid size-9 place-items-center rounded-full hover:bg-muted transition-colors"
          aria-label="Kembali ke pengaturan"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeading title="Tabungan Masa Depan" subtitle="Target impian & rencana tabungan" />
      </div>

      {loadingGoals ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Belum ada target tabungan"
          description="Rencanakan liburan, pembelian aset, atau dana darurat keluargamu sekarang."
          action={
            <Button
              onClick={handleOpenAdd}
              className="bg-mint-strong text-white hover:bg-mint-strong/90 rounded-xl"
            >
              <Plus className="size-4 mr-1.5" /> Buat Target Baru
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {/* 2. Overview Card */}
          <Card className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Total Tabungan Terkumpul
                </span>
                <p className="text-3xl font-extrabold text-foreground tracking-tight mt-0.5">
                  {formatCurrency(totalSaved)}
                </p>
              </div>
              <div className="size-11 rounded-2xl bg-mint-soft text-mint-strong flex items-center justify-center shrink-0">
                <PiggyBank className="size-6" />
              </div>
            </div>

            {/* Total Target progress */}
            {totalTarget > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">
                    Akumulasi Progres ({overallProgress}%)
                  </span>
                  <span className="text-foreground">
                    Target: {formatCurrency(totalTarget)}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-mint-strong transition-all duration-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* 3. Goals list */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Daftar Rencana ({goals.length})
            </h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleOpenAdd}
              className="text-xs text-mint-strong hover:bg-mint-soft/50 rounded-xl font-semibold gap-1"
            >
              <Plus className="size-3.5" />
              Tambah Target
            </Button>
          </div>

          <div className="grid gap-3.5">
            {goals.map((goal) => {
              const progress = goal.target_amount > 0 
                ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
                : 0;
              const isCompleted = goal.current_amount >= goal.target_amount;
              const goalColor = goal.color || "#B8E6D3";

              // Format date nicely
              let formattedDate = null;
              if (goal.target_date) {
                const d = new Date(goal.target_date);
                formattedDate = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
              }

              return (
                <Card
                  key={goal.id}
                  className="rounded-2xl border bg-card p-4 space-y-3.5 transition-all hover:border-mint-strong/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-xl font-semibold"
                        style={{ backgroundColor: `${goalColor}40`, color: goalColor }}
                      >
                        <Award className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-foreground truncate">
                            {goal.name}
                          </p>
                          {isCompleted && (
                            <span className="flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              <CheckCircle2 className="size-3" />
                              Selesai
                            </span>
                          )}
                        </div>
                        {formattedDate && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                            <Calendar className="size-3" />
                            Target: {formattedDate}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Edit/Delete actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(goal)}
                        className="size-8 rounded-lg text-muted-foreground hover:text-mint-strong hover:bg-mint-soft/30 transition-all"
                        aria-label="Edit target"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDelete(goal)}
                        className="size-8 rounded-lg text-muted-foreground hover:text-expense hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                        aria-label="Hapus target"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-semibold">
                        {formatCurrency(goal.current_amount)}
                      </span>
                      <span className="text-foreground font-bold">
                        {progress}% dari {formatCurrency(goal.target_amount)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress}%`, backgroundColor: goalColor }}
                      />
                    </div>
                  </div>

                  {/* Quick add funds button */}
                  {!isCompleted && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenAddFunds(goal)}
                      className="w-full h-9 rounded-xl text-xs font-semibold hover:border-mint-strong/40 hover:bg-mint-soft/10 text-foreground transition-all flex items-center gap-1"
                    >
                      <Plus className="size-3.5 text-mint-strong" strokeWidth={2.5} />
                      Tabung Sekarang
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Goal Dialog */}
      {goalOpen && (
        <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editingGoal ? "Edit Rencana Tabungan" : "Buat Rencana Tabungan"}</DialogTitle>
              <DialogDescription>
                Tentukan target menabung keluarga untuk mencapai impian bersama.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitGoal} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goalName">Nama Rencana</Label>
                <Input
                  id="goalName"
                  placeholder="Contoh: Liburan Akhir Tahun, Dana Darurat"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="targetAmount">Target Nominal</Label>
                  <Input
                    id="targetAmount"
                    type="number"
                    placeholder="Contoh: 10000000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="currentAmount">Saldo Awal</Label>
                  <Input
                    id="currentAmount"
                    type="number"
                    placeholder="Contoh: 0"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    className="h-11 rounded-xl"
                    disabled={!!editingGoal} // Direct adjustments via Tabung dialog
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="targetDate">Target Tanggal (Opsional)</Label>
                <Input
                  id="targetDate"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Color Preset Picker */}
              <div className="flex flex-col gap-2">
                <Label>Warna Aksen</Label>
                <div className="flex items-center gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className="size-7 rounded-full border border-border transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                      style={{ backgroundColor: color }}
                    >
                      {selectedColor === color && (
                        <span className="size-2 rounded-full bg-background" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={createGoal.isPending || updateGoal.isPending || !name.trim() || !targetAmount}
                  className="h-11 w-full bg-mint-strong text-white hover:bg-mint-strong/90 rounded-xl font-semibold"
                >
                  {createGoal.isPending || updateGoal.isPending 
                    ? "Menyimpan..." 
                    : (editingGoal ? "Simpan Perubahan" : "Buat Rencana")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Funds Quick Dialog */}
      {addFundsOpen && (
        <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Tabung untuk &quot;{fundsTargetGoal?.name}&quot;</DialogTitle>
              <DialogDescription>
                Masukkan jumlah uang yang ingin Anda tabung ke rencana ini.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitAddFunds} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="addAmount">Nominal Tabungan (Rp)</Label>
                <Input
                  id="addAmount"
                  type="number"
                  placeholder="Masukkan nominal, contoh: 500000"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                  autoFocus
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={updateGoal.isPending || !addAmount}
                  className="h-11 w-full bg-mint-strong text-white hover:bg-mint-strong/90 rounded-xl font-semibold"
                >
                  {updateGoal.isPending ? "Menyimpan..." : "Tambahkan Rencana"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Goal Confirm Dialog */}
      {deleteOpen && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Hapus rencana tabungan?</DialogTitle>
              <DialogDescription>
                Apakah Anda yakin ingin menghapus target tabungan &quot;{goalToDelete?.name}&quot;? Tindakan ini tidak dapat dibatalkan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-xl h-11"
                onClick={() => setDeleteOpen(false)}
              >
                Batal
              </Button>
              <Button
                className="rounded-xl h-11 bg-expense text-white hover:bg-expense/90"
                onClick={handleDeleteConfirm}
                disabled={deleteGoal.isPending}
              >
                {deleteGoal.isPending ? "Menghapus..." : "Ya, Hapus"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
