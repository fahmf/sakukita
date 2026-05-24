"use client";

import * as React from "react";
import Link from "next/link";
import {
  useTrashedTransactions,
  useRestoreTransaction,
  usePurgeTransaction,
} from "@/hooks/use-transactions";
import { PageHeading, EmptyState } from "@/components/shared/empty-state";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency, formatRelative, formatDate } from "@/lib/format";
import { ArrowLeft, Trash2, Undo2, Loader2 } from "lucide-react";
import { TransactionListSkeleton } from "@/components/shared/skeletons";

export default function TrashPage() {
  const { data: trashed = [], isLoading } = useTrashedTransactions();
  const restore = useRestoreTransaction();
  const purge = usePurgeTransaction();
  const allowed = useCanEdit();

  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  const handleRestore = async (id: string) => {
    if (!allowed) {
      viewOnlyToast();
      return;
    }
    try {
      await restore.mutateAsync(id);
      toast.success("Transaksi dipulihkan");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memulihkan";
      toast.error(message);
    }
  };

  const handlePurge = async () => {
    if (!confirmId) return;
    if (!allowed) {
      viewOnlyToast();
      setConfirmId(null);
      return;
    }
    try {
      await purge.mutateAsync(confirmId);
      toast.success("Transaksi dihapus permanen");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menghapus";
      toast.error(message);
    } finally {
      setConfirmId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="grid size-9 place-items-center rounded-full hover:bg-muted transition-colors"
          aria-label="Kembali ke pengaturan"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeading
          title="Recycle Bin"
          subtitle="Transaksi terhapus disimpan 30 hari sebelum dihapus permanen otomatis"
        />
      </div>

      {isLoading ? (
        <div className="py-2">
          <TransactionListSkeleton count={4} />
        </div>
      ) : trashed.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Recycle bin kosong"
          description="Transaksi yang kamu hapus akan muncul di sini selama 30 hari."
        />
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden divide-y">
          {trashed.map((t) => {
            const isExpense = t.type === "expense";
            const sign = isExpense ? "-" : t.type === "income" ? "+" : "";
            return (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="grid size-9 place-items-center rounded-xl text-white shrink-0"
                      style={{
                        backgroundColor:
                          t.category?.color ?? (isExpense ? "#E8A5A5" : "#5FBF9A"),
                      }}
                      aria-hidden
                    >
                      <Trash2 className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {t.note || t.category?.name || "Tanpa catatan"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.category?.name ?? "Tanpa kategori"} · {t.wallet.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(t.occurred_at)} · dihapus{" "}
                        {t.deleted_at ? formatRelative(t.deleted_at) : "-"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span
                    className={`text-sm font-semibold ${
                      isExpense ? "text-expense" : "text-income"
                    }`}
                  >
                    {sign}
                    {formatCurrency(Number(t.amount))}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl gap-1 text-xs h-8"
                      onClick={() => handleRestore(t.id)}
                      disabled={restore.isPending}
                      aria-label={`Pulihkan transaksi ${t.note ?? ""}`}
                    >
                      <Undo2 className="size-3.5" aria-hidden />
                      Pulihkan
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl text-xs h-8 text-expense hover:text-expense"
                      onClick={() => setConfirmId(t.id)}
                      disabled={purge.isPending}
                      aria-label={`Hapus permanen transaksi ${t.note ?? ""}`}
                    >
                      Hapus permanen
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={confirmId !== null}
        onOpenChange={(o) => !o && setConfirmId(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Hapus permanen?</DialogTitle>
            <DialogDescription>
              Transaksi akan dihapus dari semua perangkat dan tidak bisa dipulihkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2 gap-2">
            <Button
              variant="outline"
              className="rounded-xl h-11"
              onClick={() => setConfirmId(null)}
            >
              Batal
            </Button>
            <Button
              className="rounded-xl h-11 bg-expense text-white hover:bg-expense/90"
              onClick={handlePurge}
              disabled={purge.isPending}
            >
              {purge.isPending ? "Menghapus..." : "Hapus permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
