import { db } from "./dexie";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSyncStore } from "@/stores/sync-store";

// Mutex to prevent concurrent triggerSync executions
let _syncLock = false;

// Track consecutive failures per outbox entry for dead-letter handling
const _outboxRetries = new Map<number, number>();

// Post-sync callback — lets SyncProvider register QueryClient invalidation
let _onSyncComplete: (() => void) | null = null;
export function registerSyncCallback(cb: () => void) {
  _onSyncComplete = cb;
}

export async function pullLatest(supabase: SupabaseClient, householdId: string) {
  if (!householdId) return;

  try {
    // 1. Pull Wallets
    const { data: wallets, error: walletsError } = await supabase
      .from("wallets")
      .select("*")
      .eq("household_id", householdId)
      .eq("is_archived", false);

    if (walletsError) throw walletsError;

    // Merge wallets: do not overwrite local pending changes
    const pendingWallets = await db.wallets
      .where("syncStatus")
      .equals("pending")
      .toArray();
    const pendingWalletIds = new Set(pendingWallets.map((w) => w.id));

    const walletsToPut = (wallets || [])
      .filter((w) => !pendingWalletIds.has(w.id))
      .map((w) => ({ ...w, syncStatus: "synced" as const }));

    if (walletsToPut.length > 0) {
      await db.wallets.bulkPut(walletsToPut);
    }

    // Purge wallets deleted remotely
    const remoteWalletIds = new Set((wallets || []).map((w) => w.id));
    const localWallets = await db.wallets.where("household_id").equals(householdId).toArray();
    const walletsToDelete = localWallets
      .filter((w) => w.syncStatus === "synced" && !remoteWalletIds.has(w.id))
      .map((w) => w.id);
    if (walletsToDelete.length > 0) {
      await db.wallets.bulkDelete(walletsToDelete);
    }

    // 2. Pull Categories
    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId)
      .eq("is_archived", false);

    if (categoriesError) throw categoriesError;

    const pendingCategories = await db.categories
      .where("syncStatus")
      .equals("pending")
      .toArray();
    const pendingCategoryIds = new Set(pendingCategories.map((c) => c.id));

    const categoriesToPut = (categories || [])
      .filter((c) => !pendingCategoryIds.has(c.id))
      .map((c) => ({ ...c, syncStatus: "synced" as const }));

    if (categoriesToPut.length > 0) {
      await db.categories.bulkPut(categoriesToPut);
    }

    // Purge categories deleted remotely
    const remoteCategoryIds = new Set((categories || []).map((c) => c.id));
    const localCategories = await db.categories.where("household_id").equals(householdId).toArray();
    const categoriesToDelete = localCategories
      .filter((c) => c.syncStatus === "synced" && !remoteCategoryIds.has(c.id))
      .map((c) => c.id);
    if (categoriesToDelete.length > 0) {
      await db.categories.bulkDelete(categoriesToDelete);
    }

    // 3. Pull Transactions — active + recently soft-deleted (last 30 days for trash UI)
    const trashCutoff = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("household_id", householdId)
      .or(`is_deleted.eq.false,deleted_at.gte.${trashCutoff}`);

    if (txError) throw txError;

    const pendingTxs = await db.transactions
      .where("syncStatus")
      .equals("pending")
      .toArray();
    const pendingTxIds = new Set(pendingTxs.map((t) => t.id));

    const txsToPut = (transactions || [])
      .filter((t) => !pendingTxIds.has(t.id))
      .map((t) => ({ ...t, syncStatus: "synced" as const }));

    if (txsToPut.length > 0) {
      await db.transactions.bulkPut(txsToPut);
    }

    // Purge transactions soft-deleted on server
    const remoteTxIds = new Set((transactions || []).map((t) => t.id));
    const localTxs = await db.transactions.where("household_id").equals(householdId).toArray();
    const txsToDelete = localTxs
      .filter((t) => t.syncStatus === "synced" && !remoteTxIds.has(t.id))
      .map((t) => t.id);
    if (txsToDelete.length > 0) {
      await db.transactions.bulkDelete(txsToDelete);
    }

    // 4. Pull Budgets
    const { data: budgets, error: budgetsError } = await supabase
      .from("budgets")
      .select("*")
      .eq("household_id", householdId);

    if (budgetsError) throw budgetsError;

    const pendingBudgets = await db.budgets
      .where("syncStatus")
      .equals("pending")
      .toArray();
    const pendingBudgetIds = new Set(pendingBudgets.map((b) => b.id));

    const budgetsToPut = (budgets || [])
      .filter((b) => !pendingBudgetIds.has(b.id))
      .map((b) => ({ ...b, syncStatus: "synced" as const }));

    if (budgetsToPut.length > 0) {
      await db.budgets.bulkPut(budgetsToPut);
    }

    // Purge budgets deleted remotely
    const remoteBudgetIds = new Set((budgets || []).map((b) => b.id));
    const localBudgets = await db.budgets.where("household_id").equals(householdId).toArray();
    const budgetsToDelete = localBudgets
      .filter((b) => b.syncStatus === "synced" && !remoteBudgetIds.has(b.id))
      .map((b) => b.id);
    if (budgetsToDelete.length > 0) {
      await db.budgets.bulkDelete(budgetsToDelete);
    }

    // 5. Pull Savings Goals
    const { data: goals, error: goalsError } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("household_id", householdId);

    if (goalsError) throw goalsError;

    const pendingGoals = await db.savings_goals
      .where("syncStatus")
      .equals("pending")
      .toArray();
    const pendingGoalIds = new Set(pendingGoals.map((g) => g.id));

    const goalsToPut = (goals || [])
      .filter((g) => !pendingGoalIds.has(g.id))
      .map((g) => ({ ...g, syncStatus: "synced" as const }));

    if (goalsToPut.length > 0) {
      await db.savings_goals.bulkPut(goalsToPut);
    }

    // Purge goals deleted remotely
    const remoteGoalIds = new Set((goals || []).map((g) => g.id));
    const localGoals = await db.savings_goals.where("household_id").equals(householdId).toArray();
    const goalsToDelete = localGoals
      .filter((g) => g.syncStatus === "synced" && !remoteGoalIds.has(g.id))
      .map((g) => g.id);
    if (goalsToDelete.length > 0) {
      await db.savings_goals.bulkDelete(goalsToDelete);
    }

    // 6. Pull Debts
    const { data: debts, error: debtsError } = await supabase
      .from("debts")
      .select("*")
      .eq("household_id", householdId);

    if (debtsError) throw debtsError;

    const pendingDebts = await db.debts
      .where("syncStatus")
      .equals("pending")
      .toArray();
    const pendingDebtIds = new Set(pendingDebts.map((d) => d.id));

    const debtsToPut = (debts || [])
      .filter((d) => !pendingDebtIds.has(d.id))
      .map((d) => ({ ...d, syncStatus: "synced" as const }));

    if (debtsToPut.length > 0) {
      await db.debts.bulkPut(debtsToPut);
    }

    // Purge debts deleted remotely
    const remoteDebtIds = new Set((debts || []).map((d) => d.id));
    const localDebts = await db.debts.where("household_id").equals(householdId).toArray();
    const debtsToDelete = localDebts
      .filter((d) => d.syncStatus === "synced" && !remoteDebtIds.has(d.id))
      .map((d) => d.id);
    if (debtsToDelete.length > 0) {
      await db.debts.bulkDelete(debtsToDelete);
    }

    // 7. Pull Recurring Transactions
    const { data: recurrings, error: recurringsError } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("household_id", householdId);

    if (recurringsError) throw recurringsError;

    const pendingRecurrings = await db.recurring_transactions
      .where("syncStatus")
      .equals("pending")
      .toArray();
    const pendingRecurringIds = new Set(pendingRecurrings.map((r) => r.id));

    const recurringsToPut = (recurrings || [])
      .filter((r) => !pendingRecurringIds.has(r.id))
      .map((r) => ({ ...r, syncStatus: "synced" as const }));

    if (recurringsToPut.length > 0) {
      await db.recurring_transactions.bulkPut(recurringsToPut);
    }

    // Purge recurrings deleted remotely
    const remoteRecurringIds = new Set((recurrings || []).map((r) => r.id));
    const localRecurrings = await db.recurring_transactions.where("household_id").equals(householdId).toArray();
    const recurringsToDelete = localRecurrings
      .filter((r) => r.syncStatus === "synced" && !remoteRecurringIds.has(r.id))
      .map((r) => r.id);
    if (recurringsToDelete.length > 0) {
      await db.recurring_transactions.bulkDelete(recurringsToDelete);
    }
  } catch (error) {
    console.error("Failed to pull latest from remote:", error);
    useSyncStore.getState().setStatus("error", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function flushOutbox(supabase: SupabaseClient) {
  // Grab items ordered by sequence seq to maintain transactional chronology
  const entries = await db.outbox.orderBy("seq").toArray();
  if (entries.length === 0) return;

  for (const entry of entries) {
    try {
      if (entry.entity === "transactions") {
        if (entry.op === "create") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase.from("transactions").insert(payload);
          if (error) {
            // Constraint errors (e.g. duplicate key) shouldn't block queue infinitely
            if (error.code && error.code.startsWith("23")) {
              console.error("Constraint error during transaction insert; discarding entry", error);
              await db.outbox.delete(entry.seq!);
              await db.transactions.update(entry.entityId, { syncStatus: "synced" });
              continue;
            }
            throw error;
          }
          await db.transactions.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "update") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase
            .from("transactions")
            .update(payload)
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.transactions.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "delete") {
          // Soft-delete on server; keep local record (with is_deleted=true) for trash UI
          const local = await db.transactions.get(entry.entityId);
          const deletedAt = local?.deleted_at ?? new Date().toISOString();
          const { error } = await supabase
            .from("transactions")
            .update({
              is_deleted: true,
              deleted_at: deletedAt,
              deleted_by: local?.deleted_by ?? null,
            })
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.transactions.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "purge") {
          // Hard delete — only allowed via RLS when is_deleted = true
          const { error } = await supabase
            .from("transactions")
            .delete()
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.transactions.delete(entry.entityId);
          await db.outbox.delete(entry.seq!);
        }
      } else if (entry.entity === "wallets") {
        if (entry.op === "create") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase.from("wallets").insert(payload);
          if (error) {
            if (error.code && error.code.startsWith("23")) {
              console.error("Constraint error during wallet insert; discarding entry", error);
              await db.outbox.delete(entry.seq!);
              await db.wallets.update(entry.entityId, { syncStatus: "synced" });
              continue;
            }
            throw error;
          }
          await db.wallets.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "update") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase
            .from("wallets")
            .update(payload)
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.wallets.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "delete") {
          const { error } = await supabase
            .from("wallets")
            .update({ is_archived: true })
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.wallets.update(entry.entityId, { is_archived: true, syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        }
      } else if (entry.entity === "categories") {
        if (entry.op === "create") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase.from("categories").insert(payload);
          if (error) {
            if (error.code && error.code.startsWith("23")) {
              console.error("Constraint error during category insert; discarding entry", error);
              await db.outbox.delete(entry.seq!);
              await db.categories.update(entry.entityId, { syncStatus: "synced" });
              continue;
            }
            throw error;
          }
          await db.categories.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "update") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase
            .from("categories")
            .update(payload)
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.categories.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "delete") {
          const { error } = await supabase
            .from("categories")
            .update({ is_archived: true })
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.categories.update(entry.entityId, { is_archived: true, syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        }
      } else if (entry.entity === "budgets") {
        if (entry.op === "create") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase.from("budgets").insert(payload);
          if (error) {
            if (error.code && error.code.startsWith("23")) {
              console.error("Constraint error during budget insert; discarding entry", error);
              await db.outbox.delete(entry.seq!);
              await db.budgets.update(entry.entityId, { syncStatus: "synced" });
              continue;
            }
            throw error;
          }
          await db.budgets.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "update") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase
            .from("budgets")
            .update(payload)
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.budgets.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "delete") {
          const { error } = await supabase
            .from("budgets")
            .delete()
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.budgets.delete(entry.entityId);
          await db.outbox.delete(entry.seq!);
        }
      } else if (entry.entity === "savings_goals") {
        if (entry.op === "create") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase.from("savings_goals").insert(payload);
          if (error) {
            if (error.code && error.code.startsWith("23")) {
              console.error("Constraint error during goal insert; discarding entry", error);
              await db.outbox.delete(entry.seq!);
              await db.savings_goals.update(entry.entityId, { syncStatus: "synced" });
              continue;
            }
            throw error;
          }
          await db.savings_goals.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "update") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase
            .from("savings_goals")
            .update(payload)
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.savings_goals.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "delete") {
          const { error } = await supabase
            .from("savings_goals")
            .delete()
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.savings_goals.delete(entry.entityId);
          await db.outbox.delete(entry.seq!);
        }
      } else if (entry.entity === "debts") {
        if (entry.op === "create") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase.from("debts").insert(payload);
          if (error) {
            if (error.code && error.code.startsWith("23")) {
              console.error("Constraint error during debt insert; discarding entry", error);
              await db.outbox.delete(entry.seq!);
              await db.debts.update(entry.entityId, { syncStatus: "synced" });
              continue;
            }
            throw error;
          }
          await db.debts.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "update") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase
            .from("debts")
            .update(payload)
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.debts.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "delete") {
          const { error } = await supabase
            .from("debts")
            .delete()
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.debts.delete(entry.entityId);
          await db.outbox.delete(entry.seq!);
        }
      } else if (entry.entity === "recurring_transactions") {
        if (entry.op === "create") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase.from("recurring_transactions").insert(payload);
          if (error) {
            if (error.code && error.code.startsWith("23")) {
              console.error("Constraint error during recurring insert; discarding entry", error);
              await db.outbox.delete(entry.seq!);
              await db.recurring_transactions.update(entry.entityId, { syncStatus: "synced" });
              continue;
            }
            throw error;
          }
          await db.recurring_transactions.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "update") {
          const payload = { ...entry.payload }; delete (payload as Record<string, unknown>).syncStatus;
          const { error } = await supabase
            .from("recurring_transactions")
            .update(payload)
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.recurring_transactions.update(entry.entityId, { syncStatus: "synced" });
          await db.outbox.delete(entry.seq!);
        } else if (entry.op === "delete") {
          const { error } = await supabase
            .from("recurring_transactions")
            .delete()
            .eq("id", entry.entityId);
          if (error) throw error;
          await db.recurring_transactions.delete(entry.entityId);
          await db.outbox.delete(entry.seq!);
        }
      }
    } catch (err) {
      console.error(`Failed to flush outbox entry seq=${entry.seq}:`, err);
      const key = entry.seq!;
      const count = (_outboxRetries.get(key) ?? 0) + 1;
      _outboxRetries.set(key, count);
      if (count >= 3) {
        // Dead-letter: discard permanently failing entries to unblock queue
        console.error(`Outbox entry seq=${key} failed ${count} times, discarding as dead-letter`);
        await db.outbox.delete(key);
        _outboxRetries.delete(key);
        continue; // Try next entry instead of blocking queue
      }
      // Halt on transient errors to preserve ordering, retry on next sync
      break;
    }
  }
}

export async function materializePassedScheduledTransactions() {
  try {
    const nowStr = new Date().toISOString();
    const allTxs = await db.transactions.toArray();
    const filterPassed = allTxs.filter(t => t.is_scheduled && t.occurred_at <= nowStr && !t.is_deleted);
    
    for (const tx of filterPassed) {
      console.log("Materializing scheduled transaction locally:", tx.id);
      const updated = { ...tx, is_scheduled: false, updated_at: new Date().toISOString() };
      await db.transactions.put({ ...updated, syncStatus: "pending" });
      await db.outbox.add({
        entity: "transactions",
        entityId: tx.id,
        op: "update",
        payload: updated,
        createdAt: Date.now(),
      });
    }
  } catch (err) {
    console.error("Failed to materialize scheduled transactions locally:", err);
  }
}

export function calculateNextMaterializeDate(currentDateStr: string, frequency: string, interval: number): string {
  const date = new Date(currentDateStr);
  if (isNaN(date.getTime())) return new Date().toISOString();

  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + interval);
      break;
    case "weekly":
      date.setDate(date.getDate() + (interval * 7));
      break;
    case "monthly":
      date.setMonth(date.getMonth() + interval);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + interval);
      break;
    default:
      date.setDate(date.getDate() + 1);
  }
  return date.toISOString();
}

export async function materializeRecurringTransactions() {
  try {
    const nowStr = new Date().toISOString();
    const templates = await db.recurring_transactions.toArray();
    const activeTemplates = templates.filter(t => t.is_active && t.next_materialize_at <= nowStr);

    for (const t of activeTemplates) {
      console.log("Materializing recurring transaction locally:", t.id);
      
      const txId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      const newTx = {
        id: txId,
        household_id: t.household_id,
        created_by: "system",
        type: t.type,
        amount: t.amount,
        occurred_at: t.next_materialize_at,
        is_scheduled: false,
        wallet_id: t.wallet_id,
        to_wallet_id: t.to_wallet_id || null,
        category_id: t.category_id || null,
        note: t.note || "Transaksi Berulang Otomatis",
        tags: [],
        receipt_url: null,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        client_id: "recurring-system",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.transactions.put({ ...newTx, syncStatus: "pending" });
      await db.outbox.add({
        entity: "transactions",
        entityId: txId,
        op: "create",
        payload: newTx,
        createdAt: Date.now(),
      });

      const nextDate = calculateNextMaterializeDate(t.next_materialize_at, t.frequency, t.interval);
      const updatedTemplate = {
        ...t,
        last_materialized_at: t.next_materialize_at,
        next_materialize_at: nextDate,
        updated_at: new Date().toISOString(),
      };

      await db.recurring_transactions.put({ ...updatedTemplate, syncStatus: "pending" });
      await db.outbox.add({
        entity: "recurring_transactions",
        entityId: t.id,
        op: "update",
        payload: updatedTemplate,
        createdAt: Date.now(),
      });
    }
  } catch (err) {
    console.error("Failed to materialize recurring transactions locally:", err);
  }
}

export async function triggerSync(supabase: SupabaseClient, householdId: string) {
  // Mutex: prevent concurrent sync executions that cause data corruption
  if (_syncLock) return;
  if (typeof window !== "undefined" && !navigator.onLine) {
    useSyncStore.getState().setStatus("offline");
    return;
  }
  _syncLock = true;
  useSyncStore.getState().setStatus("syncing");
  try {
    await flushOutbox(supabase);
    await pullLatest(supabase, householdId);
    await materializePassedScheduledTransactions();
    await materializeRecurringTransactions();
    useSyncStore.getState().setLastSynced(new Date().toISOString());
    // Notify listeners (e.g. SyncProvider) to invalidate query caches
    _onSyncComplete?.();
  } catch (err) {
    console.error("Sync failed:", err);
    useSyncStore.getState().setStatus("error", err instanceof Error ? err.message : String(err));
  } finally {
    _syncLock = false;
  }
}
