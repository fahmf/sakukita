"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/components/providers/household-provider";
import type { Wallet, WalletBalance, WalletType } from "@/lib/supabase/types";
import { db } from "@/lib/db/dexie";
import { triggerSync } from "@/lib/db/sync";
import { safeRandomUUID } from "@/lib/utils";

export function useWallets() {
  const { householdId } = useHousehold();

  return useQuery<Wallet[]>({
    queryKey: ["wallets", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];

      const data = await db.wallets
        .where("household_id")
        .equals(householdId)
        .toArray();

      const activeWallets = data.filter((w) => !w.is_archived);
      activeWallets.sort((a, b) => a.sort_order - b.sort_order);
      return activeWallets;
    },
  });
}

export function useWalletBalances() {
  const { householdId } = useHousehold();

  return useQuery<WalletBalance[]>({
    queryKey: ["wallet-balances", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];

      // 1. Fetch active wallets
      const wallets = await db.wallets
        .where("household_id")
        .equals(householdId)
        .toArray();

      const activeWallets = wallets.filter((w) => !w.is_archived);

      // 2. Fetch transactions, ignoring deleted + scheduled (match v_wallet_balances view)
      const txs = await db.transactions
        .where("household_id")
        .equals(householdId)
        .toArray();

      // 3. Single-pass aggregation: walletId -> delta from transactions
      const deltas = new Map<string, number>();
      for (const t of txs) {
        if (t.is_deleted || t.is_scheduled) continue;
        const amount = Number(t.amount || 0);
        if (t.type === "income") {
          deltas.set(t.wallet_id, (deltas.get(t.wallet_id) ?? 0) + amount);
        } else if (t.type === "expense") {
          deltas.set(t.wallet_id, (deltas.get(t.wallet_id) ?? 0) - amount);
        } else if (t.type === "transfer") {
          deltas.set(t.wallet_id, (deltas.get(t.wallet_id) ?? 0) - amount);
          if (t.to_wallet_id) {
            deltas.set(t.to_wallet_id, (deltas.get(t.to_wallet_id) ?? 0) + amount);
          }
        }
      }

      // 4. Compose balance per active wallet — O(1) lookup each
      return activeWallets.map((wallet) => ({
        wallet_id: wallet.id,
        household_id: householdId,
        balance: Number(wallet.initial_balance || 0) + (deltas.get(wallet.id) ?? 0),
      }));
    },
  });
}

export function useCreateWallet() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (wallet: {
      name: string;
      type: WalletType;
      initial_balance: number;
      color?: string;
      icon?: string;
    }) => {
      if (!householdId) throw new Error("Active household context is required");

      const id = safeRandomUUID();
      const newWallet: Wallet = {
        id,
        household_id: householdId,
        name: wallet.name,
        type: wallet.type,
        initial_balance: wallet.initial_balance,
        color: wallet.color ?? "#C4C4C4",
        icon: wallet.icon ?? "wallet",
        is_archived: false,
        exclude_from_networth: false,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Write locally to IndexedDB immediately
      await db.wallets.put({
        ...newWallet,
        syncStatus: "pending",
      });

      // Queue action into outbox sync queue
      await db.outbox.add({
        entity: "wallets",
        entityId: id,
        op: "create",
        payload: newWallet,
        createdAt: Date.now(),
      });

      // Fire a background sync attempt
      triggerSync(supabase, householdId);

      return newWallet;
    },
    onSuccess: () => {
      // Instantly invalidate TanStack Query cache
      queryClient.invalidateQueries({ queryKey: ["wallets", householdId] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balances", householdId] });
    },
  });
}

export function useUpdateWallet() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (wallet: {
      id: string;
      name: string;
      type: WalletType;
      initial_balance: number;
      color?: string;
      icon?: string;
      exclude_from_networth?: boolean;
    }) => {
      if (!householdId) throw new Error("Active household context is required");

      const localWallet = await db.wallets.get(wallet.id);
      if (!localWallet) throw new Error("Wallet not found locally");

      const updatedWallet: Wallet = {
        ...localWallet,
        name: wallet.name,
        type: wallet.type,
        initial_balance: wallet.initial_balance,
        color: wallet.color ?? localWallet.color,
        icon: wallet.icon ?? localWallet.icon,
        exclude_from_networth: wallet.exclude_from_networth !== undefined ? wallet.exclude_from_networth : localWallet.exclude_from_networth,
        updated_at: new Date().toISOString(),
      };

      // Write update locally to IndexedDB immediately
      await db.wallets.put({
        ...updatedWallet,
        syncStatus: "pending",
      });

      // Queue action into outbox sync queue
      await db.outbox.add({
        entity: "wallets",
        entityId: wallet.id,
        op: "update",
        payload: updatedWallet,
        createdAt: Date.now(),
      });

      // Fire a background sync attempt
      triggerSync(supabase, householdId);

      return updatedWallet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets", householdId] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balances", householdId] });
    },
  });
}

export function useArchiveWallet() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (walletId: string) => {
      if (!householdId) throw new Error("Active household context is required");

      const localWallet = await db.wallets.get(walletId);
      if (!localWallet) throw new Error("Wallet not found locally");

      const archivedWallet: Wallet = {
        ...localWallet,
        is_archived: true,
        updated_at: new Date().toISOString(),
      };

      // Write update locally to IndexedDB immediately
      await db.wallets.put({
        ...archivedWallet,
        syncStatus: "pending",
      });

      // Queue action into outbox sync queue
      await db.outbox.add({
        entity: "wallets",
        entityId: walletId,
        op: "delete", // Sync engine maps archive to delete op in outbox
        payload: archivedWallet,
        createdAt: Date.now(),
      });

      // Fire a background sync attempt
      triggerSync(supabase, householdId);

      return archivedWallet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets", householdId] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balances", householdId] });
    },
  });
}
