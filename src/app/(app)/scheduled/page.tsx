"use client";

import * as React from "react";
import {
  useScheduledTransactions,
  useDeleteTransaction,
  useMaterializeNow,
} from "@/hooks/use-transactions";
import { PageHeading, EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCanEdit, viewOnlyToast } from "@/components/shared/edit-guard";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { CalendarClock, X, Check, Loader2 } from "lucide-react";

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

export default function ScheduledPage() {
  const { data: scheduled = [], isLoading } = useScheduledTransactions();
  const cancelTx = useDeleteTransaction();
  const materialize = useMaterializeNow();
  const allowed = useCanEdit();

  const [confirmCancel, setConfirmCancel] = React.useState<string | null>(null);

  const grouped = React.useMemo(() => groupByMonth(scheduled), [scheduled]);

  const handleCancel = async () => {
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
      const message =
        err instanceof Error ? err.message : "Gagal membatalkan";
      toast.error(message);
    } finally {
      setConfirmCancel(null);
    }
  };

  const handleMaterialize = async (id: string) => {
    if (!allowed) {
      viewOnlyToast();
      return;
    }
    try {
      await materialize.mutateAsync(id);
      toast.success("Transaksi dijadikan aktif sekarang");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menjadikan aktif";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Terjadwal"
        subtitle="Transaksi yang dijadwalkan di masa depan dan belum dihitung di saldo"
      />

      {isLoading ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : scheduled.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Belum ada transaksi terjadwal"
          description="Tambah transaksi dengan tanggal di masa depan untuk membuat catatan terjadwal."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <section key={g.key} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.label}
              </h2>
              <div className="rounded-2xl border bg-card overflow-hidden divide-y">
                {g.items.map((t) => {
                  const isExpense = t.type === "expense";
                  const sign =
                    isExpense ? "-" : t.type === "income" ? "+" : "";
                  return (
                    <div
                      key={t.id}
                      className="flex items-start justify-between gap-3 p-4"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-3">
                        <span
                          className="grid size-9 place-items-center rounded-xl text-white shrink-0"
                          style={{
                            backgroundColor:
                              t.category?.color ??
                              (isExpense ? "#E8A5A5" : "#5FBF9A"),
                          }}
                          aria-hidden
                        >
                          <CalendarClock className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {t.note || t.category?.name || "Tanpa catatan"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.category?.name ?? "Tanpa kategori"} ·{" "}
                            {t.wallet.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(t.occurred_at)}
                          </p>
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
                            onClick={() => handleMaterialize(t.id)}
                            disabled={materialize.isPending}
                            aria-label="Jadikan aktif sekarang"
                          >
                            <Check className="size-3.5" aria-hidden />
                            Aktifkan
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl text-xs h-8 text-expense hover:text-expense"
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

      <Dialog
        open={confirmCancel !== null}
        onOpenChange={(o) => !o && setConfirmCancel(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Batalkan transaksi terjadwal?</DialogTitle>
            <DialogDescription>
              Transaksi akan dipindahkan ke Recycle Bin selama 30 hari sebelum
              dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-xl h-11"
              onClick={() => setConfirmCancel(null)}
            >
              Tidak
            </Button>
            <Button
              className="rounded-xl h-11 bg-expense text-white hover:bg-expense/90"
              onClick={handleCancel}
              disabled={cancelTx.isPending}
            >
              {cancelTx.isPending ? "Memproses..." : "Ya, batalkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
