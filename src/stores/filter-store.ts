import { create } from "zustand";

export type PeriodPreset = "this-month" | "last-month" | "custom";

interface FilterState {
  period: PeriodPreset;
  startDate: string | null;
  endDate: string | null;
  walletId: string | null;
  categoryId: string | null;
  setPeriod: (period: PeriodPreset) => void;
  setRange: (start: string, end: string) => void;
  setWallet: (id: string | null) => void;
  setCategory: (id: string | null) => void;
  reset: () => void;
}

const initial = {
  period: "this-month" as PeriodPreset,
  startDate: null,
  endDate: null,
  walletId: null,
  categoryId: null,
};

export const useFilterStore = create<FilterState>((set) => ({
  ...initial,
  setPeriod: (period) => set({ period }),
  setRange: (startDate, endDate) => set({ startDate, endDate, period: "custom" }),
  setWallet: (walletId) => set({ walletId }),
  setCategory: (categoryId) => set({ categoryId }),
  reset: () => set(initial),
}));
