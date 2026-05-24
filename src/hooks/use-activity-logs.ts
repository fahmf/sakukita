"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/providers/household-provider";

export interface ActivityLog {
  id: number;
  action: "create" | "update" | "delete" | "archive";
  entity_type: "transactions" | "wallets" | "budgets";
  entity_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles: {
    display_name: string | null;
    email: string;
  } | null;
}

export function useActivityLogs() {
  const { householdId } = useHousehold();
  const supabase = createClient();

  return useQuery<ActivityLog[]>({
    queryKey: ["activity-logs", householdId],
    queryFn: async () => {
      if (!householdId) return [];

      const { data, error } = await supabase
        .from("activity_logs")
        .select(`
          id,
          action,
          entity_type,
          entity_id,
          metadata,
          created_at,
          profiles:actor_id (
            display_name,
            email
          )
        `)
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        console.error("Failed to fetch activity logs:", error);
        throw error;
      }
      return (data || []) as unknown as ActivityLog[];
    },
    enabled: !!householdId,
  });
}
