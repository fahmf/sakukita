"use client";

import { createContext, useContext } from "react";
import type { MemberRole } from "@/lib/supabase/types";

export interface HouseholdContextValue {
  userId: string;
  householdId: string;
  householdName: string;
  displayName: string;
  role: MemberRole;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({
  value,
  children,
}: {
  value: HouseholdContextValue;
  children: React.ReactNode;
}) {
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
