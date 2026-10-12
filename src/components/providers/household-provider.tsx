"use client";

import { createContext, useContext } from "react";
import type { MemberRole } from "@/lib/supabase/types";
import { setCycleStartDay } from "@/lib/financial-month";

export interface HouseholdContextValue {
  userId: string;
  householdId: string;
  householdName: string;
  displayName: string;
  role: MemberRole;
  /** Household owner — the only member RLS lets update the household row. */
  isOwner: boolean;
  /** Financial-month start day (1–28). */
  cycleStartDay: number;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({
  value,
  children,
}: {
  value: HouseholdContextValue;
  children: React.ReactNode;
}) {
  // Set during render (not in an effect) so children computing month ranges
  // in this same render already see the household's day.
  setCycleStartDay(value.cycleStartDay);
  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext);
  if (!ctx) {
    throw new Error("useHousehold must be used within HouseholdProvider");
  }
  return ctx;
}

/** True when the role may create/edit transactions and shared data. */
export function canEdit(role: MemberRole): boolean {
  return role === "admin" || role === "editor";
}
