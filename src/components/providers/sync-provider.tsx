"use client";

import React, { useEffect } from "react";
import { useHousehold } from "./household-provider";
import { createClient } from "@/lib/supabase/client";
import { triggerSync, registerSyncCallback } from "@/lib/db/sync";
import type { Transaction, Wallet, Category, Budget } from "@/lib/supabase/types";
import { db } from "@/lib/db/dexie";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "@/stores/ui-store";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { householdId } = useHousehold();
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  // Register global post-sync callback to invalidate all queries
  React.useEffect(() => {
    registerSyncCallback(() => {
      queryClient.invalidateQueries();
    });
  }, [queryClient]);

  // 1. Setup online event listeners to flush outbox on network reconnection
  useEffect(() => {
    if (typeof window === "undefined" || !householdId) return;

    const handleOnline = async () => {
      console.log("Network online, triggering full sync...");
      await triggerSync(supabase, householdId);
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
            const oldTx = payload.old as unknown as Transaction;
            if (oldTx?.id) await db.transactions.delete(oldTx.id);
          } else {
            const newTx = payload.new as unknown as Transaction;
            if (newTx) {
              // Soft-delete TIDAK menghapus baris lokal — disimpan dengan
              // is_deleted=true agar Recycle Bin konsisten antar device
              // (sama dengan perilaku pullLatest).
              const local = await db.transactions.get(newTx.id);
              if (!local || local.syncStatus !== "pending") {
                await db.transactions.put({ ...newTx, syncStatus: "synced" });
              }

              // Deteksi konflik: transaksi yang sedang diedit user diubah
              // anggota lain (drawer edit masih terbuka). Saat user menyimpan
              // sendiri, drawer ditutup dulu → editingTransaction null, jadi
              // echo perubahan sendiri tidak memicu banner.
              const editing = useUIStore.getState().editingTransaction;
              if (
                editing &&
                newTx.id === editing.id &&
                editing.updated_at &&
                new Date(newTx.updated_at).getTime() > new Date(editing.updated_at).getTime()
              ) {
                let actor = "anggota lain";
                try {
                  const { data } = await supabase
                    .from("activity_logs")
                    .select("profiles:actor_id(display_name,email)")
                    .eq("entity_id", newTx.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  const prof = (data as { profiles?: { display_name: string | null; email: string } | null } | null)?.profiles;
                  actor = prof?.display_name || prof?.email || actor;
                } catch {
                  // abaikan — pakai label generik
                }
                useUIStore.getState().setEditConflict({ id: newTx.id, actor });
              }
            }
          }
          queryClient.invalidateQueries({ queryKey: ["transactions", householdId] });
          queryClient.invalidateQueries({ queryKey: ["trashed-transactions", householdId] });
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
          const oldW = payload.old as unknown as Wallet;
          const newW = payload.new as unknown as Wallet;
          if (payload.eventType === "DELETE" || newW?.is_archived) {
            const wId = oldW?.id || newW?.id;
            if (wId) {
              // Soft delete locally matching outbox behavior
              await db.wallets.update(wId, { is_archived: true, syncStatus: "synced" });
            }
          } else if (newW) {
            const local = await db.wallets.get(newW.id);
            if (!local || local.syncStatus !== "pending") {
              await db.wallets.put({ ...newW, syncStatus: "synced" });
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
          const oldCat = payload.old as unknown as Category;
          const newCat = payload.new as unknown as Category;
          if (payload.eventType === "DELETE" || newCat?.is_archived) {
            const catId = oldCat?.id || newCat?.id;
            if (catId) {
              // Soft delete locally matching outbox behavior
              await db.categories.update(catId, { is_archived: true, syncStatus: "synced" });
            }
          } else if (newCat) {
            const local = await db.categories.get(newCat.id);
            if (!local || local.syncStatus !== "pending") {
              await db.categories.put({ ...newCat, syncStatus: "synced" });
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
          const oldB = payload.old as unknown as Budget;
          const newB = payload.new as unknown as Budget;
          if (payload.eventType === "DELETE") {
            if (oldB?.id) await db.budgets.delete(oldB.id);
          } else if (newB) {
            const local = await db.budgets.get(newB.id);
            if (!local || local.syncStatus !== "pending") {
              await db.budgets.put({ ...newB, syncStatus: "synced" });
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
