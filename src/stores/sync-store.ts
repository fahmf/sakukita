import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SyncState {
  status: "synced" | "syncing" | "offline" | "error";
  lastSyncedAt: string | null;
  errorMsg: string | null;
  /** Jumlah perubahan yang gagal permanen disinkronkan (dead-letter) */
  deadLetterCount: number;
  setStatus: (status: "synced" | "syncing" | "offline" | "error", errorMsg?: string | null) => void;
  setLastSynced: (dateStr: string) => void;
  setDeadLetterCount: (count: number) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      status: "synced",
      lastSyncedAt: null,
      errorMsg: null,
      deadLetterCount: 0,
      setStatus: (status, errorMsg = null) => set({ status, errorMsg }),
      setLastSynced: (lastSyncedAt) => set({ lastSyncedAt, status: "synced", errorMsg: null }),
      setDeadLetterCount: (deadLetterCount) => set({ deadLetterCount }),
    }),
    {
      name: "saku-sync",
    }
  )
);
