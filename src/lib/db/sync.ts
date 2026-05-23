import { db } from "./dexie";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  } catch (error) {
    console.error("Failed to pull latest from remote:", error);
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
          const { syncStatus, ...payload } = entry.payload;
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
          const { syncStatus, ...payload } = entry.payload;
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
          const { syncStatus, ...payload } = entry.payload;
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
        }
      } else if (entry.entity === "categories") {
        if (entry.op === "create") {
          const { syncStatus, ...payload } = entry.payload;
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
          const { syncStatus, ...payload } = entry.payload;
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
          await db.categories.delete(entry.entityId);
          await db.outbox.delete(entry.seq!);
        }
      } else if (entry.entity === "budgets") {
        if (entry.op === "create") {
          const { syncStatus, ...payload } = entry.payload;
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
          const { syncStatus, ...payload } = entry.payload;
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
          const { syncStatus, ...payload } = entry.payload;
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
          const { syncStatus, ...payload } = entry.payload;
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
          const { syncStatus, ...payload } = entry.payload;
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
          const { syncStatus, ...payload } = entry.payload;
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
      }
    } catch (err) {
      console.error(`Failed to flush outbox entry seq=${entry.seq}:`, err);
      // Halt flushing loop on network errors to preserve ordering
      break;
    }
  }
}

export async function triggerSync(supabase: SupabaseClient, householdId: string) {
  if (typeof window !== "undefined" && !navigator.onLine) return;
  await flushOutbox(supabase);
  await pullLatest(supabase, householdId);
}
