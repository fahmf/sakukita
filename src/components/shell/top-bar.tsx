"use client";

import { Bell, Cloud, CloudOff, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { HouseholdSwitcher } from "./household-switcher";
import { toast } from "sonner";
import { useSyncStore } from "@/stores/sync-store";
import { useHousehold } from "@/components/providers/household-provider";
import { createClient } from "@/lib/supabase/client";
import { triggerSync } from "@/lib/db/sync";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

export function TopBar() {
  const { status, errorMsg, lastSyncedAt } = useSyncStore();
  const { householdId } = useHousehold();
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const handleManualSync = async () => {
    if (!householdId || status === "syncing") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast("Sedang offline — perubahan akan tersinkron otomatis saat online.");
      return;
    }
    if (status === "error" && errorMsg) {
      toast.error(`Gagal sinkron sebelumnya: ${errorMsg}`);
    }
    try {
      await triggerSync(supabase, householdId);
      queryClient.invalidateQueries();
    } catch {
      toast.error("Gagal menyinkronkan. Coba lagi.");
    }
  };

  const renderSyncBadge = () => {
    switch (status) {
      case "syncing":
        return (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-mint-strong bg-mint-soft px-2.5 py-1 rounded-full animate-pulse border border-mint-strong/20 select-none shrink-0">
            <Loader2 className="size-3 animate-spin" />
            <span>Syncing</span>
          </div>
        );
      case "offline":
        return (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full border select-none shrink-0">
            <CloudOff className="size-3" />
            <span>Offline</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-expense bg-red-50 dark:bg-red-950/20 px-2.5 py-1 rounded-full border border-expense/20 shrink-0">
            <AlertCircle className="size-3" />
            <span>Sync Error</span>
          </div>
        );
      case "synced":
      default:
        return (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full border border-emerald-500/20 select-none shrink-0">
            <Cloud className="size-3 text-emerald-500" />
            <span>Synced</span>
          </div>
        );
    }
  };

  const lastSyncedTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : null;

  const syncTitle =
    status === "syncing"
      ? "Menyinkronkan data..."
      : status === "offline"
      ? "Mode offline — ketuk untuk mencoba sinkron"
      : status === "error"
      ? "Gagal sinkron — ketuk untuk coba lagi"
      : lastSyncedTime
      ? `Tersinkron pukul ${lastSyncedTime} — ketuk untuk sinkron ulang`
      : "Ketuk untuk sinkron";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
      <div className="min-w-0 flex-1 mr-2">
        <HouseholdSwitcher />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleManualSync}
          disabled={status === "syncing"}
          title={syncTitle}
          aria-label={syncTitle}
          className="group flex items-center gap-1 disabled:cursor-default"
        >
          {renderSyncBadge()}
          {status !== "syncing" && (
            <RefreshCw className="size-3 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
          )}
        </button>
        <button
          type="button"
          aria-label="Notifikasi"
          onClick={() => toast("Notifikasi akan hadir di update berikutnya.")}
          className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
        >
          <Bell className="size-5" />
        </button>
      </div>
    </header>
  );
}
