"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarRange, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useHousehold } from "@/components/providers/household-provider";
import { createClient } from "@/lib/supabase/client";
import { currentFinancialMonth, financialMonthRangeLabel } from "@/lib/financial-month";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/**
 * "Awal bulan keuangan": the day each financial month starts. Only the
 * household owner may change it (households RLS); everyone else sees it.
 */
export function CycleStartDayCard() {
  const { householdId, isOwner, cycleStartDay } = useHousehold();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingDay, setPendingDay] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  const month = currentFinancialMonth();

  const handleConfirm = async () => {
    if (pendingDay === null) return;
    setSaving(true);
    try {
      const supabase = createClient() as unknown as SupabaseClient;
      // .select() so a row filtered out by RLS reads as a failure instead of
      // a silent no-op.
      const { data, error } = await supabase
        .from("households")
        .update({ cycle_start_day: pendingDay })
        .eq("id", householdId)
        .select("id");
      if (error) {
        // 42703 = undefined_column: migration 0015 hasn't been applied yet.
        throw new Error(
          error.code === "42703"
            ? "Database belum diperbarui (migrasi 0015). Hubungi pengelola aplikasi."
            : error.message
        );
      }
      if (!data || data.length === 0) {
        throw new Error("Hanya pemilik keluarga yang bisa mengubah pengaturan ini.");
      }
      toast.success(`Bulan keuangan sekarang mulai tanggal ${pendingDay}`);
      setPendingDay(null);
      // The layout re-reads the household and re-sets the day; cached month
      // ranges are recomputed on refetch.
      router.refresh();
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <CalendarRange className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-sm">Awal Bulan Keuangan</p>
          <p className="text-xs text-muted-foreground">
            Bulan ini: {financialMonthRangeLabel(month)}
          </p>
        </div>
      </div>
      <Select
        value={String(cycleStartDay)}
        disabled={!isOwner}
        onValueChange={(v) => {
          const day = Number(v);
          if (v && day !== cycleStartDay) setPendingDay(day);
        }}
      >
        <SelectTrigger
          aria-label="Tanggal mulai bulan keuangan"
          title={isOwner ? undefined : "Hanya pemilik keluarga yang bisa mengubah"}
          className="w-28 h-9 rounded-xl text-xs bg-muted/40 border-none shrink-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72">
          {DAYS.map((d) => (
            <SelectItem key={d} value={String(d)}>
              {d === 1 ? "Tgl 1 (kalender)" : `Tanggal ${d}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={pendingDay !== null} onOpenChange={(o) => !o && !saving && setPendingDay(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Mulai bulan keuangan tanggal {pendingDay}?</DialogTitle>
            <DialogDescription>
              Bulan ini akan menjadi{" "}
              <strong className="text-foreground">
                {pendingDay !== null && financialMonthRangeLabel(month, pendingDay)}
              </strong>{" "}
              (sebelumnya {financialMonthRangeLabel(month)}).
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
            <li>Tidak ada data yang dihapus.</li>
            <li>
              Transaksi lama dikelompokkan ulang ke bulan sesuai tanggal baru, jadi total per bulan
              di Beranda, Budget, dan Laporan — termasuk bulan-bulan lalu — bisa berubah.
            </li>
            <li>Budget yang sudah diatur tetap tersimpan per bulan; angka terpakainya dihitung ulang.</li>
            <li>Berlaku untuk semua anggota keluarga.</li>
          </ul>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setPendingDay(null)}
              className="rounded-xl"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={saving}
              className="rounded-xl bg-mint-strong text-on-mint hover:bg-mint-strong/90"
            >
              {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Ubah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
