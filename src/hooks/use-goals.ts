"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/providers/household-provider";
import type { SavingsGoal } from "@/lib/supabase/types";
import { db } from "@/lib/db/dexie";
import { triggerSync } from "@/lib/db/sync";

export function useGoals() {
  const { householdId } = useHousehold();

  return useQuery<SavingsGoal[]>({
    queryKey: ["savings-goals", householdId],
    queryFn: async () => {
      if (!householdId) return [];

      const data = await db.savings_goals
        .where("household_id")
        .equals(householdId)
        .toArray();

      // Sort by created_at ascending
      return data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    },
  });
}

export function useCreateGoal() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goal: {
      name: string;
      target_amount: number;
      current_amount?: number;
      target_date?: string | null;
      icon?: string | null;
      color?: string | null;
    }) => {
      if (!householdId) throw new Error("Active household context is required");

      const id = crypto.randomUUID();
      const newGoal: SavingsGoal = {
        id,
        household_id: householdId,
        name: goal.name,
        target_amount: goal.target_amount,
        current_amount: goal.current_amount ?? 0,
        target_date: goal.target_date ?? null,
        is_completed: (goal.current_amount ?? 0) >= goal.target_amount,
        icon: goal.icon ?? "piggy-bank",
        color: goal.color ?? "#B8E6D3",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.savings_goals.put({
        ...newGoal,
        syncStatus: "pending",
      });

      await db.outbox.add({
        entity: "savings_goals",
        entityId: id,
        op: "create",
        payload: newGoal,
        createdAt: Date.now(),
      });

      triggerSync(supabase, householdId);

      return newGoal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-goals", householdId] });
    },
  });
}

export function useUpdateGoal() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goal: {
      id: string;
      name: string;
      target_amount: number;
      current_amount: number;
      target_date?: string | null;
      icon?: string | null;
      color?: string | null;
    }) => {
      if (!householdId) throw new Error("Active household context is required");

      const localGoal = await db.savings_goals.get(goal.id);
      if (!localGoal) throw new Error("Savings goal not found locally");

      const updatedGoal: SavingsGoal = {
        ...localGoal,
        name: goal.name,
        target_amount: goal.target_amount,
        current_amount: goal.current_amount,
        target_date: goal.target_date !== undefined ? goal.target_date : localGoal.target_date,
        is_completed: goal.current_amount >= goal.target_amount,
        icon: goal.icon !== undefined ? goal.icon : localGoal.icon,
        color: goal.color !== undefined ? goal.color : localGoal.color,
        updated_at: new Date().toISOString(),
      };

      await db.savings_goals.put({
        ...updatedGoal,
        syncStatus: "pending",
      });

      await db.outbox.add({
        entity: "savings_goals",
        entityId: goal.id,
        op: "update",
        payload: updatedGoal,
        createdAt: Date.now(),
      });

      triggerSync(supabase, householdId);

      return updatedGoal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-goals", householdId] });
    },
  });
}

export function useDeleteGoal() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goalId: string) => {
      if (!householdId) throw new Error("Active household context is required");

      const localGoal = await db.savings_goals.get(goalId);
      if (!localGoal) throw new Error("Savings goal not found locally");

      await db.savings_goals.delete(goalId);

      await db.outbox.add({
        entity: "savings_goals",
        entityId: goalId,
        op: "delete",
        payload: localGoal,
        createdAt: Date.now(),
      });

      triggerSync(supabase, householdId);

      return goalId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-goals", householdId] });
    },
  });
}
