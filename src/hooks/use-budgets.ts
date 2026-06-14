"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/providers/household-provider";
import type { Budget, BudgetPeriodType } from "@/lib/supabase/types";
import { db } from "@/lib/db/dexie";
import { triggerSync } from "@/lib/db/sync";
import { safeRandomUUID } from "@/lib/utils";

export function useBudgets(monthStr?: string) {
  const { householdId } = useHousehold();

  return useQuery<Budget[]>({
    queryKey: ["budgets", householdId, monthStr],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];

      if (monthStr) {
        return db.budgets
          .where("[household_id+period_month]")
          .equals([householdId, monthStr])
          .toArray();
      }
      return db.budgets.where("household_id").equals(householdId).toArray();
    },
  });
}

export function useSetBudget() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (budget: {
      category_id: string;
      amount: number;
      period_month: string; // "YYYY-MM-01" (bulanan) atau "YYYY-01-01" (tahunan)
      period_type?: BudgetPeriodType;
      carry_over: boolean;
    }) => {
      if (!householdId) throw new Error("Active household context is required");

      const periodType: BudgetPeriodType = budget.period_type ?? "monthly";

      // Search if a budget already exists for this category, period & type
      const existing = await db.budgets
        .where("household_id")
        .equals(householdId)
        .filter(
          (b) =>
            b.category_id === budget.category_id &&
            b.period_month === budget.period_month &&
            (b.period_type ?? "monthly") === periodType
        )
        .first();

      const targetId = existing?.id;
      const now = new Date().toISOString();

      if (existing) {
        // Update operation
        const updatedBudget: Budget = {
          ...existing,
          amount: budget.amount,
          carry_over: budget.carry_over,
          period_type: periodType,
          updated_at: now,
        };

        // Update local Dexie DB
        await db.budgets.put({
          ...updatedBudget,
          syncStatus: "pending",
        });

        // Queue action into outbox
        await db.outbox.add({
          entity: "budgets",
          entityId: targetId!,
          op: "update",
          payload: updatedBudget,
          createdAt: Date.now(),
        });

        triggerSync(supabase, householdId, { pull: false });
        return updatedBudget;
      } else {
        // Create operation
        const newId = safeRandomUUID();
        const newBudget: Budget = {
          id: newId,
          household_id: householdId,
          category_id: budget.category_id,
          amount: budget.amount,
          period_month: budget.period_month,
          period_type: periodType,
          carry_over: budget.carry_over,
          created_at: now,
          updated_at: now,
        };

        // Write locally to Dexie
        await db.budgets.put({
          ...newBudget,
          syncStatus: "pending",
        });

        // Queue action into outbox
        await db.outbox.add({
          entity: "budgets",
          entityId: newId,
          op: "create",
          payload: newBudget,
          createdAt: Date.now(),
        });

        triggerSync(supabase, householdId, { pull: false });
        return newBudget;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["budgets", householdId, variables.period_month],
      });
    },
  });
}

export function useDeleteBudget() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!householdId) throw new Error("Active household context is required");

      const existing = await db.budgets.get(id);
      if (!existing) return null;

      // Delete locally
      await db.budgets.delete(id);

      // Queue in outbox
      await db.outbox.add({
        entity: "budgets",
        entityId: id,
        op: "delete",
        payload: {},
        createdAt: Date.now(),
      });

      triggerSync(supabase, householdId, { pull: false });
      return existing.period_month;
    },
    onSuccess: (periodMonth) => {
      if (periodMonth) {
        queryClient.invalidateQueries({
          queryKey: ["budgets", householdId, periodMonth],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["budgets", householdId] });
      }
    },
  });
}
