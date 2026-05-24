"use client";

import { Bell, Cloud, CloudOff, Loader2, AlertCircle } from "lucide-react";
import { HouseholdSwitcher } from "./household-switcher";
import { toast } from "sonner";
import { useSyncStore } from "@/stores/sync-store";
import * as React from "react";

export function TopBar() {
  const { status, errorMsg, lastSyncedAt } = useSyncStore();

  const renderSyncBadge = () => {
    switch (status) {
      case "syncing":
        return (
          <div
            title="Menyinkronkan data..."
            className="flex items-center gap-1 text-[10px] font-semibold text-mint-strong bg-mint-soft px-2.5 py-1 rounded-full animate-pulse border border-mint-strong/20 select-none shrink-0"
          >
            <Loader2 className="size-3 animate-spin" />
            <span>Syncing</span>
          </div>
        );
      case "offline":
        return (
          <div
            title="Mode offline - Data disimpan di perangkat"
            className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full border select-none shrink-0"
          >
            <CloudOff className="size-3" />
            <span>Offline</span>
          </div>
        );
      case "error":
        return (
          <button
            type="button"
            onClick={() => toast.error(`Gagal sinkron: ${errorMsg || "Eror tidak diketahui"}`)}
            title="Gagal sinkron - Ketuk untuk detail"
            className="flex items-center gap-1 text-[10px] font-semibold text-expense bg-red-50 dark:bg-red-950/20 px-2.5 py-1 rounded-full border border-expense/20 animate-bounce cursor-pointer shrink-0"
          >
            <AlertCircle className="size-3" />
            <span>Sync Error</span>
          </button>
        );
      case "synced":
      default:
        const lastSyncedTime = lastSyncedAt 
          ? new Date(lastSyncedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
          : null;
        return (
          <div
            title={lastSyncedTime ? `Tersinkron pukul ${lastSyncedTime}` : "Data tersinkron"}
            className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full border border-emerald-500/20 select-none shrink-0"
          >
            <Cloud className="size-3 text-emerald-500" />
            <span>Synced</span>
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
      <div className="min-w-0 flex-1 mr-2">
        <HouseholdSwitcher />
      </div>
      <div className="flex items-center gap-2">
        {renderSyncBadge()}
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
