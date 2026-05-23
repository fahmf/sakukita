"use client";

import React, { useEffect } from "react";
import { useHousehold } from "./household-provider";
import { createClient } from "@/lib/supabase/client";
import { triggerSync, flushOutbox, pullLatest } from "@/lib/db/sync";
import { db } from "@/lib/db/dexie";
import { useQueryClient } from "@tanstack/react-query";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { householdId } = useHousehold();
  const supabase = createClient();
  const queryClient = useQueryClient();

  // 1. Setup online event listeners to flush outbox on network reconnection
  useEffect(() => {
    if (typeof window === "undefined" || !householdId) return;

    const handleOnline = async () => {
      console.log("Network online, flushing pending outbox items...");
      await flushOutbox(supabase);
      await pullLatest(supabase, householdId);
      // Invalidate all react-query queries to fetch latest from local Dexie store
      queryClient.invalidateQueries();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [supabase, householdId, queryClient]);

  // 2. Perform initial background pull on mount / household swap
  useEffect(() => {
    if (!householdId) return;

    const performInitialSync = async () => {
      console.log(`Starting synchronization for household: ${householdId}`);
      await triggerSync(supabase, householdId);
      queryClient.invalidateQueries();
    };

    performInitialSync();
  }, [supabase, householdId, queryClient]);

  // 3. Subscribe to Supabase Realtime events for active household tenant
  useEffect(() => {
    if (!householdId) return;

    const channel = supabase
      .channel(`household_sync:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `household_id=eq.${householdId}`,
        },
        async (payload) => {
          console.log("Realtime transaction change detected:", payload);
          if (payload.eventType === "DELETE") {
            await db.transactions.delete((payload.old as any).id);
          } else {
            const newTx = payload.new as any;
            if (newTx.is_deleted) {
              await db.transactions.delete(newTx.id);
            } else {
              const local = await db.transactions.get(newTx.id);
              if (!local || local.syncStatus !== "pending") {
                await db.transactions.put({ ...newTx, syncStatus: "synced" });
              }
            }
          }
          queryClient.invalidateQueries({ queryKey: ["transactions", householdId] });
          queryClient.invalidateQueries({ queryKey: ["wallet-balances", householdId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `household_id=eq.${householdId}`,
        },
        async (payload) => {
          console.log("Realtime wallet change detected:", payload);
          if (payload.eventType === "DELETE" || (payload.new as any)?.is_archived) {
            await db.wallets.delete((payload.old as any)?.id || (payload.new as any)?.id);
          } else {
            const newWallet = payload.new as any;
            const local = await db.wallets.get(newWallet.id);
            if (!local || local.syncStatus !== "pending") {
              await db.wallets.put({ ...newWallet, syncStatus: "synced" });
            }
          }
          queryClient.invalidateQueries({ queryKey: ["wallets", householdId] });
          queryClient.invalidateQueries({ queryKey: ["wallet-balances", householdId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
          filter: `household_id=eq.${householdId}`,
        },
        async (payload) => {
          console.log("Realtime category change detected:", payload);
          if (payload.eventType === "DELETE" || (payload.new as any)?.is_archived) {
            await db.categories.delete((payload.old as any)?.id || (payload.new as any)?.id);
          } else {
            const newCategory = payload.new as any;
            const local = await db.categories.get(newCategory.id);
            if (!local || local.syncStatus !== "pending") {
              await db.categories.put({ ...newCategory, syncStatus: "synced" });
            }
          }
          queryClient.invalidateQueries({ queryKey: ["categories", householdId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budgets",
          filter: `household_id=eq.${householdId}`,
        },
        async (payload) => {
          console.log("Realtime budget change detected:", payload);
          if (payload.eventType === "DELETE") {
            await db.budgets.delete((payload.old as any)?.id);
          } else {
            const newBudget = payload.new as any;
            const local = await db.budgets.get(newBudget.id);
            if (!local || local.syncStatus !== "pending") {
              await db.budgets.put({ ...newBudget, syncStatus: "synced" });
            }
          }
          queryClient.invalidateQueries({ queryKey: ["budgets", householdId] });
        }
      )
      .subscribe();

    return () => {
      console.log(`Unsubscribing from realtime channels for household: ${householdId}`);
      supabase.removeChannel(channel);
    };
  }, [supabase, householdId, queryClient]);

  return <>{children}</>;
}
