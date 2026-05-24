"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/providers/household-provider";
import type { Transaction, TransactionType } from "@/lib/supabase/types";
import { db } from "@/lib/db/dexie";
import { triggerSync } from "@/lib/db/sync";
import { safeRandomUUID } from "@/lib/utils";

export interface TransactionWithDetails extends Transaction {
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  wallet: {
    id: string;
    name: string;
    type: string;
    icon: string | null;
    color: string | null;
  };
  to_wallet: {
    id: string;
    name: string;
    type: string;
    icon: string | null;
    color: string | null;
  } | null;
}

interface UseTransactionsFilters {
  period: "this-month" | "last-month" | "custom";
  startDate: string | null;
  endDate: string | null;
  walletId: string | null;
  categoryId: string | null;
}

export function useTransactions(filters?: UseTransactionsFilters) {
  const { householdId } = useHousehold();

  return useQuery<TransactionWithDetails[]>({
    queryKey: ["transactions", householdId, filters],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];

      // 1. Fetch all transactions locally from IndexedDB
      const allTxs = await db.transactions
        .where("household_id")
        .equals(householdId)
        .toArray();

      // Filter active (not deleted and not scheduled) records
      let filtered = allTxs.filter((t) => !t.is_deleted && !t.is_scheduled);

      // Sort by occurred_at descending (newest first)
      filtered.sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      );

      // 2. Apply filters locally
      if (filters) {
        const { period, startDate, endDate, walletId, categoryId } = filters;
        const { start, end } = getPeriodDates(period, startDate, endDate);

        if (start) {
          filtered = filtered.filter((t) => new Date(t.occurred_at).getTime() >= start.getTime());
        }
        if (end) {
          filtered = filtered.filter((t) => new Date(t.occurred_at).getTime() <= end.getTime());
        }
        if (walletId) {
          filtered = filtered.filter(
            (t) => t.wallet_id === walletId || t.to_wallet_id === walletId
          );
        }
        if (categoryId) {
          filtered = filtered.filter((t) => t.category_id === categoryId);
        }
      }

      // 3. Bulk-load lookup tables once, build Maps for O(1) resolution
      const [cats, wallets] = await Promise.all([
        db.categories.where("household_id").equals(householdId).toArray(),
        db.wallets.where("household_id").equals(householdId).toArray(),
      ]);
      const catMap = new Map(cats.map((c) => [c.id, c]));
      const walletMap = new Map(wallets.map((w) => [w.id, w]));

      const results: TransactionWithDetails[] = filtered.map((t) => {
        const cat = t.category_id ? catMap.get(t.category_id) : null;
        const w = walletMap.get(t.wallet_id);
        const tow = t.to_wallet_id ? walletMap.get(t.to_wallet_id) : null;

        return {
          ...t,
          category: cat
            ? { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color }
            : null,
          wallet: w
            ? { id: w.id, name: w.name, type: w.type, icon: w.icon, color: w.color }
            : {
                id: t.wallet_id,
                name: "Dompet",
                type: "cash",
                icon: "wallet",
                color: "#C4C4C4",
              },
          to_wallet: tow
            ? { id: tow.id, name: tow.name, type: tow.type, icon: tow.icon, color: tow.color }
            : null,
        };
      });

      return results;
    },
  });
}

export function useCreateTransaction() {
  const supabase = createClient();
  const { householdId, userId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tx: {
      type: TransactionType;
      amount: number;
      occurred_at: string;
      wallet_id: string;
      to_wallet_id?: string | null;
      category_id?: string | null;
      note?: string | null;
      tags?: string[];
    }) => {
      if (!householdId) throw new Error("Household ID context is required");
      if (!userId) throw new Error("User ID context is required");

      const id = safeRandomUUID();
      const newTx: Transaction = {
        id,
        household_id: householdId,
        created_by: userId,
        type: tx.type,
        amount: tx.amount,
        occurred_at: tx.occurred_at,
        is_scheduled: new Date(tx.occurred_at).getTime() > Date.now(),
        wallet_id: tx.wallet_id,
        to_wallet_id: tx.to_wallet_id ?? null,
        category_id: tx.category_id ?? null,
        note: tx.note ?? null,
        tags: tx.tags ?? [],
        receipt_url: null,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        client_id: id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Write transaction locally to Dexie IndexedDB
      await db.transactions.put({
        ...newTx,
        syncStatus: "pending",
      });

      // Register outbox insertion entry
      await db.outbox.add({
        entity: "transactions",
        entityId: id,
        op: "create",
        payload: newTx,
        createdAt: Date.now(),
      });

      // Background synchronise attempt
      triggerSync(supabase, householdId);

      return newTx;
    },
    onSuccess: () => {
      // Invalidate queries to instantly re-trigger local queryFn evaluations
      queryClient.invalidateQueries({ queryKey: ["transactions", householdId] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balances", householdId] });
    },
  });
}

export function useDeleteTransaction() {
  const supabase = createClient();
  const { householdId, userId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (txId: string) => {
      if (!householdId) throw new Error("Household ID context is required");

      const localTx = await db.transactions.get(txId);
      if (!localTx) throw new Error("Transaction not found locally");

      const now = new Date().toISOString();

      // Soft-delete locally by updating record
      await db.transactions.update(txId, {
        is_deleted: true,
        deleted_at: now,
        deleted_by: userId ?? null,
        syncStatus: "pending",
      });

      // Register outbox deletion entry
      await db.outbox.add({
        entity: "transactions",
        entityId: txId,
        op: "delete",
        payload: { id: txId },
        createdAt: Date.now(),
      });

      // Background synchronize attempt
      triggerSync(supabase, householdId);

      return txId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", householdId] });
      queryClient.invalidateQueries({ queryKey: ["trashed-transactions", householdId] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balances", householdId] });
    },
  });
}

export function useUpdateTransaction() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tx: {
      id: string;
      type: TransactionType;
      amount: number;
      occurred_at: string;
      wallet_id: string;
      to_wallet_id?: string | null;
      category_id?: string | null;
      note?: string | null;
      tags?: string[];
    }) => {
      if (!householdId) throw new Error("Household ID context is required");

      const localTx = await db.transactions.get(tx.id);
      if (!localTx) throw new Error("Transaction not found locally");

      const updatedTx: Transaction = {
        ...localTx,
        type: tx.type,
        amount: tx.amount,
        occurred_at: tx.occurred_at,
        is_scheduled: new Date(tx.occurred_at).getTime() > Date.now(),
        wallet_id: tx.wallet_id,
        to_wallet_id: tx.to_wallet_id ?? null,
        category_id: tx.category_id ?? null,
        note: tx.note ?? null,
        tags: tx.tags ?? [],
        updated_at: new Date().toISOString(),
      };

      // Write update locally to Dexie IndexedDB
      await db.transactions.put({
        ...updatedTx,
        syncStatus: "pending",
      });

      // Register outbox update entry
      await db.outbox.add({
        entity: "transactions",
        entityId: tx.id,
        op: "update",
        payload: updatedTx,
        createdAt: Date.now(),
      });

      // Background synchronize attempt
      triggerSync(supabase, householdId);

      return updatedTx;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", householdId] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balances", householdId] });
    },
  });
}

export function useTrashedTransactions() {
  const { householdId } = useHousehold();

  return useQuery<TransactionWithDetails[]>({
    queryKey: ["trashed-transactions", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];

      const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const allTxs = await db.transactions
        .where("household_id")
        .equals(householdId)
        .toArray();

      const trashed = allTxs.filter(
        (t) =>
          t.is_deleted &&
          t.deleted_at &&
          new Date(t.deleted_at).getTime() >= cutoffMs
      );
      trashed.sort(
        (a, b) =>
          new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime()
      );

      const [cats, wallets] = await Promise.all([
        db.categories.where("household_id").equals(householdId).toArray(),
        db.wallets.where("household_id").equals(householdId).toArray(),
      ]);
      const catMap = new Map(cats.map((c) => [c.id, c]));
      const walletMap = new Map(wallets.map((w) => [w.id, w]));

      return trashed.map((t) => {
        const cat = t.category_id ? catMap.get(t.category_id) : null;
        const w = walletMap.get(t.wallet_id);
        const tow = t.to_wallet_id ? walletMap.get(t.to_wallet_id) : null;
        return {
          ...t,
          category: cat
            ? { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color }
            : null,
          wallet: w
            ? { id: w.id, name: w.name, type: w.type, icon: w.icon, color: w.color }
            : {
                id: t.wallet_id,
                name: "Dompet",
                type: "cash",
                icon: "wallet",
                color: "#C4C4C4",
              },
          to_wallet: tow
            ? { id: tow.id, name: tow.name, type: tow.type, icon: tow.icon, color: tow.color }
            : null,
        };
      });
    },
  });
}

export function useRestoreTransaction() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (txId: string) => {
      if (!householdId) throw new Error("Household ID context is required");

      const localTx = await db.transactions.get(txId);
      if (!localTx) throw new Error("Transaction not found locally");
      if (!localTx.is_deleted) return txId;

      const restored: Transaction = {
        ...localTx,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
      };

      await db.transactions.put({ ...restored, syncStatus: "pending" });

      await db.outbox.add({
        entity: "transactions",
        entityId: txId,
        op: "update",
        payload: restored,
        createdAt: Date.now(),
      });

      triggerSync(supabase, householdId);
      return txId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", householdId] });
      queryClient.invalidateQueries({ queryKey: ["trashed-transactions", householdId] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balances", householdId] });
    },
  });
}

export function useScheduledTransactions() {
  const { householdId } = useHousehold();

  return useQuery<TransactionWithDetails[]>({
    queryKey: ["scheduled-transactions", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];

      const allTxs = await db.transactions
        .where("household_id")
        .equals(householdId)
        .toArray();

      const scheduled = allTxs.filter(
        (t) => t.is_scheduled && !t.is_deleted
      );
      scheduled.sort(
        (a, b) =>
          new Date(a.occurred_at).getTime() -
          new Date(b.occurred_at).getTime()
      );

      const [cats, wallets] = await Promise.all([
        db.categories.where("household_id").equals(householdId).toArray(),
        db.wallets.where("household_id").equals(householdId).toArray(),
      ]);
      const catMap = new Map(cats.map((c) => [c.id, c]));
      const walletMap = new Map(wallets.map((w) => [w.id, w]));

      return scheduled.map((t) => {
        const cat = t.category_id ? catMap.get(t.category_id) : null;
        const w = walletMap.get(t.wallet_id);
        const tow = t.to_wallet_id ? walletMap.get(t.to_wallet_id) : null;
        return {
          ...t,
          category: cat
            ? { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color }
            : null,
          wallet: w
            ? { id: w.id, name: w.name, type: w.type, icon: w.icon, color: w.color }
            : {
                id: t.wallet_id,
                name: "Dompet",
                type: "cash",
                icon: "wallet",
                color: "#C4C4C4",
              },
          to_wallet: tow
            ? { id: tow.id, name: tow.name, type: tow.type, icon: tow.icon, color: tow.color }
            : null,
        };
      });
    },
  });
}

export function useMaterializeNow() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (txId: string) => {
      if (!householdId) throw new Error("Household ID context is required");
      const localTx = await db.transactions.get(txId);
      if (!localTx) throw new Error("Transaction not found locally");

      const updated: Transaction = {
        ...localTx,
        is_scheduled: false,
        occurred_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await db.transactions.put({ ...updated, syncStatus: "pending" });
      await db.outbox.add({
        entity: "transactions",
        entityId: txId,
        op: "update",
        payload: updated,
        createdAt: Date.now(),
      });
      triggerSync(supabase, householdId);
      return txId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", householdId] });
      queryClient.invalidateQueries({
        queryKey: ["scheduled-transactions", householdId],
      });
      queryClient.invalidateQueries({ queryKey: ["wallet-balances", householdId] });
    },
  });
}

export function usePurgeTransaction() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (txId: string) => {
      if (!householdId) throw new Error("Household ID context is required");

      const localTx = await db.transactions.get(txId);
      if (!localTx) return txId;
      if (!localTx.is_deleted) {
        throw new Error("Hanya transaksi di Recycle Bin yang bisa dihapus permanen");
      }

      await db.transactions.delete(txId);

      await db.outbox.add({
        entity: "transactions",
        entityId: txId,
        op: "purge",
        payload: { id: txId },
        createdAt: Date.now(),
      });

      triggerSync(supabase, householdId);
      return txId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trashed-transactions", householdId] });
    },
  });
}

function getPeriodDates(
  period: "this-month" | "last-month" | "custom",
  customStart: string | null,
  customEnd: string | null
): { start: Date | null; end: Date | null } {
  // We want boundaries in Asia/Jakarta timezone (+07:00)
  if (period === "this-month") {
    const now = getJakartaTimeParts();
    const startStr = `${now.year}-${String(now.month + 1).padStart(2, "0")}-01T00:00:00+07:00`;
    const lastDay = new Date(now.year, now.month + 1, 0).getDate();
    const endStr = `${now.year}-${String(now.month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999+07:00`;
    return { start: new Date(startStr), end: new Date(endStr) };
  }
  if (period === "last-month") {
    const now = getJakartaTimeParts();
    let prevYear = now.year;
    let prevMonth = now.month - 1;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear -= 1;
    }
    const startStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01T00:00:00+07:00`;
    const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
    const endStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999+07:00`;
    return { start: new Date(startStr), end: new Date(endStr) };
  }

  let start: Date | null = null;
  let end: Date | null = null;
  if (customStart) {
    start = new Date(`${customStart}T00:00:00+07:00`);
  }
  if (customEnd) {
    end = new Date(`${customEnd}T23:59:59.999+07:00`);
  }
  return { start, end };
}

function getJakartaTimeParts() {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const partMap = new Map(parts.map(p => [p.type, p.value]));
    return {
      year: parseInt(partMap.get("year")!),
      month: parseInt(partMap.get("month")!) - 1, // 0-indexed
      day: parseInt(partMap.get("day")!),
      hour: parseInt(partMap.get("hour")!),
      minute: parseInt(partMap.get("minute")!),
      second: parseInt(partMap.get("second")!)
    };
  } catch {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds()
    };
  }
}
