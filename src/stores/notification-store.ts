import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NotificationPrefsState {
  /** Notify when a category's spending crosses 80% / 100% of its budget. */
  budgetAlerts: boolean;
  /** Notify when a single expense is at or above `largeTxThreshold`. */
  largeTxAlerts: boolean;
  /** Rupiah threshold for the "large transaction" alert. */
  largeTxThreshold: number;
  setBudgetAlerts: (v: boolean) => void;
  setLargeTxAlerts: (v: boolean) => void;
  setLargeTxThreshold: (v: number) => void;
}

export const useNotificationPrefs = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      budgetAlerts: true,
      largeTxAlerts: true,
      largeTxThreshold: 1_000_000,
      setBudgetAlerts: (budgetAlerts) => set({ budgetAlerts }),
      setLargeTxAlerts: (largeTxAlerts) => set({ largeTxAlerts }),
      setLargeTxThreshold: (largeTxThreshold) => set({ largeTxThreshold }),
    }),
    { name: "saku-notification-prefs" }
  )
);
