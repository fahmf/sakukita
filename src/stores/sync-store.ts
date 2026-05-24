import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SyncState {
  status: "synced" | "syncing" | "offline" | "error";
  lastSyncedAt: string | null;
  errorMsg: string | null;
  setStatus: (status: "synced" | "syncing" | "offline" | "error", errorMsg?: string | null) => void;
  setLastSynced: (dateStr: string) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      status: "synced",
      lastSyncedAt: null,
      errorMsg: null,
      setStatus: (status, errorMsg = null) => set({ status, errorMsg }),
      setLastSynced: (lastSyncedAt) => set({ lastSyncedAt, status: "synced", errorMsg: null }),
    }),
    {
      name: "saku-sync",
    }
  )
);
