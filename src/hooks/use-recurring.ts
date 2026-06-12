"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/providers/household-provider";
import type { RecurringTransaction, TransactionType } from "@/lib/supabase/types";
import { db } from "@/lib/db/dexie";
import { triggerSync } from "@/lib/db/sync";
import { safeRandomUUID } from "@/lib/utils";

export function useRecurringTransactions() {
  const { householdId } = useHousehold();

  return useQuery<RecurringTransaction[]>({
    queryKey: ["recurring-transactions", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];

      const data = await db.recurring_transactions
        .where("household_id")
        .equals(householdId)
        .toArray();

      // Sort by created_at descending
      return data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });
}

export function useCreateRecurringTransaction() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: {
      amount: number;
      type: TransactionType;
      wallet_id: string;
      to_wallet_id?: string | null;
      category_id?: string | null;
      note?: string | null;
      frequency: "daily" | "weekly" | "monthly" | "yearly";
      interval: number;
      start_date: string;
      end_date?: string | null;
    }) => {
      if (!householdId) throw new Error("Active household context is required");

      const id = safeRandomUUID();
      
      // Calculate first occurrence: if start_date is in the future, next_materialize_at starts at start_date.
      // If start_date is today or in the past, it should run next_materialize_at at start_date.
      const initialNextMat = new Date(template.start_date + "T00:00:00Z").toISOString();

      const newTemplate: RecurringTransaction = {
        id,
        household_id: householdId,
        amount: template.amount,
        type: template.type,
        wallet_id: template.wallet_id,
        to_wallet_id: template.to_wallet_id ?? null,
        category_id: template.category_id ?? null,
        note: template.note ?? null,
        frequency: template.frequency,
        interval: template.interval || 1,
        start_date: template.start_date,
        end_date: template.end_date ?? null,
        last_materialized_at: null,
        next_materialize_at: initialNextMat,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.recurring_transactions.put({
        ...newTemplate,
        syncStatus: "pending",
      });

      await db.outbox.add({
        entity: "recurring_transactions",
        entityId: id,
        op: "create",
        payload: newTemplate,
        createdAt: Date.now(),
      });

      triggerSync(supabase, householdId, { pull: false });

      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions", householdId] });
    },
  });
}

export function useUpdateRecurringTransaction() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: {
      id: string;
      amount: number;
      wallet_id: string;
      to_wallet_id?: string | null;
      category_id?: string | null;
      note?: string | null;
      frequency: "daily" | "weekly" | "monthly" | "yearly";
      interval: number;
      is_active: boolean;
      next_materialize_at?: string;
    }) => {
      if (!householdId) throw new Error("Active household context is required");

      const localTemplate = await db.recurring_transactions.get(template.id);
      if (!localTemplate) throw new Error("Recurring transaction template not found locally");

      // Check if active state is turned back on or frequency changed, we might want to recalculate next_materialize_at
      let nextMat = template.next_materialize_at || localTemplate.next_materialize_at;
      if (template.is_active && !localTemplate.is_active) {
        // Deactivated -> Re-activated: reset next_materialize_at to today if it was in the past
        const now = new Date();
        const existingNext = new Date(localTemplate.next_materialize_at);
        if (existingNext < now) {
          nextMat = now.toISOString();
        }
      }

      const updatedTemplate: RecurringTransaction = {
        ...localTemplate,
        amount: template.amount,
        wallet_id: template.wallet_id,
        to_wallet_id: template.to_wallet_id !== undefined ? template.to_wallet_id : localTemplate.to_wallet_id,
        category_id: template.category_id !== undefined ? template.category_id : localTemplate.category_id,
        note: template.note !== undefined ? template.note : localTemplate.note,
        frequency: template.frequency,
        interval: template.interval,
        is_active: template.is_active,
        next_materialize_at: nextMat,
        updated_at: new Date().toISOString(),
      };

      await db.recurring_transactions.put({
        ...updatedTemplate,
        syncStatus: "pending",
      });

      await db.outbox.add({
        entity: "recurring_transactions",
        entityId: template.id,
        op: "update",
        payload: updatedTemplate,
        createdAt: Date.now(),
      });

      triggerSync(supabase, householdId, { pull: false });

      return updatedTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions", householdId] });
    },
  });
}

export function useDeleteRecurringTransaction() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      if (!householdId) throw new Error("Active household context is required");

      const localTemplate = await db.recurring_transactions.get(templateId);
      if (!localTemplate) throw new Error("Recurring transaction template not found locally");

      await db.recurring_transactions.delete(templateId);

      await db.outbox.add({
        entity: "recurring_transactions",
        entityId: templateId,
        op: "delete",
        payload: localTemplate,
        createdAt: Date.now(),
      });

      triggerSync(supabase, householdId, { pull: false });

      return templateId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions", householdId] });
    },
  });
}
