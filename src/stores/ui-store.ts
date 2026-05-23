import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TransactionType } from "@/lib/supabase/types";

interface UIState {
  /** Quick-add transaction drawer */
  quickAddOpen: boolean;
  quickAddType: TransactionType;
  openQuickAdd: (type?: TransactionType) => void;
  closeQuickAdd: () => void;

  /** Smart defaults — remembered across sessions for faster re-entry */
  lastWalletId: string | null;
  lastCategoryId: string | null;
  setLastWallet: (id: string) => void;
  setLastCategory: (id: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      quickAddOpen: false,
      quickAddType: "expense",
      openQuickAdd: (type = "expense") =>
        set({ quickAddOpen: true, quickAddType: type }),
      closeQuickAdd: () => set({ quickAddOpen: false }),

      lastWalletId: null,
      lastCategoryId: null,
      setLastWallet: (id) => set({ lastWalletId: id }),
      setLastCategory: (id) => set({ lastCategoryId: id }),
    }),
    {
      name: "saku-ui",
      // Only persist the smart-default fields, not transient UI flags.
      partialize: (s) => ({
        lastWalletId: s.lastWalletId,
        lastCategoryId: s.lastCategoryId,
      }),
    },
  ),
);
