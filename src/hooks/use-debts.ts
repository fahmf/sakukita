"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/providers/household-provider";
import type { Debt } from "@/lib/supabase/types";
import { db } from "@/lib/db/dexie";
import { triggerSync } from "@/lib/db/sync";
import { safeRandomUUID } from "@/lib/utils";

export function useDebts() {
  const { householdId } = useHousehold();

  return useQuery<Debt[]>({
    queryKey: ["debts", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];

      const data = await db.debts
        .where("household_id")
        .equals(householdId)
        .toArray();

      // Sort: incomplete first, then created_at descending
      return data.sort((a, b) => {
        if (a.is_completed !== b.is_completed) {
          return a.is_completed ? 1 : -1;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
  });
}

export function useCreateDebt() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (debt: {
      name: string;
      type: "payable" | "receivable";
      amount: number;
      due_date?: string | null;
      note?: string | null;
    }) => {
      if (!householdId) throw new Error("Active household context is required");

      const id = safeRandomUUID();
      const newDebt: Debt = {
        id,
        household_id: householdId,
        name: debt.name,
        type: debt.type,
        amount: debt.amount,
        remaining_amount: debt.amount,
        due_date: debt.due_date ?? null,
        is_completed: false,
        note: debt.note ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.debts.put({
        ...newDebt,
        syncStatus: "pending",
      });

      await db.outbox.add({
        entity: "debts",
        entityId: id,
        op: "create",
        payload: newDebt,
        createdAt: Date.now(),
      });

      triggerSync(supabase, householdId);

      return newDebt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts", householdId] });
    },
  });
}

export function useUpdateDebt() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (debt: {
      id: string;
      name: string;
      amount: number;
      remaining_amount: number;
      due_date?: string | null;
      note?: string | null;
    }) => {
      if (!householdId) throw new Error("Active household context is required");

      const localDebt = await db.debts.get(debt.id);
      if (!localDebt) throw new Error("Debt not found locally");

      const updatedDebt: Debt = {
        ...localDebt,
        name: debt.name,
        amount: debt.amount,
        remaining_amount: debt.remaining_amount,
        due_date: debt.due_date !== undefined ? debt.due_date : localDebt.due_date,
        is_completed: debt.remaining_amount <= 0,
        note: debt.note !== undefined ? debt.note : localDebt.note,
        updated_at: new Date().toISOString(),
      };

      await db.debts.put({
        ...updatedDebt,
        syncStatus: "pending",
      });

      await db.outbox.add({
        entity: "debts",
        entityId: debt.id,
        op: "update",
        payload: updatedDebt,
        createdAt: Date.now(),
      });

      triggerSync(supabase, householdId);

      return updatedDebt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts", householdId] });
    },
  });
}

export function useDeleteDebt() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (debtId: string) => {
      if (!householdId) throw new Error("Active household context is required");

      const localDebt = await db.debts.get(debtId);
      if (!localDebt) throw new Error("Debt not found locally");

      await db.debts.delete(debtId);

      await db.outbox.add({
        entity: "debts",
        entityId: debtId,
        op: "delete",
        payload: localDebt,
        createdAt: Date.now(),
      });

      triggerSync(supabase, householdId);

      return debtId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts", householdId] });
    },
  });
}
