import Dexie, { type Table } from "dexie";
import type {
  Transaction,
  Wallet,
  Category,
  Budget,
  SavingsGoal,
  Debt,
  RecurringTransaction,
} from "@/lib/supabase/types";

export interface OutboxEntry {
  seq?: number;
  entity: "transactions" | "wallets" | "categories" | "budgets" | "savings_goals" | "debts" | "recurring_transactions";
  entityId: string;
  op: "create" | "update" | "delete" | "purge";
  payload: any;
  createdAt: number;
}

export type Syncable<T> = T & { syncStatus?: "pending" | "synced" };

export class SakuDB extends Dexie {
  transactions!: Table<Syncable<Transaction>, string>;
  wallets!: Table<Syncable<Wallet>, string>;
  categories!: Table<Syncable<Category>, string>;
  budgets!: Table<Syncable<Budget>, string>;
  savings_goals!: Table<Syncable<SavingsGoal>, string>;
  debts!: Table<Syncable<Debt>, string>;
  recurring_transactions!: Table<Syncable<RecurringTransaction>, string>;
  outbox!: Table<OutboxEntry, number>;

  constructor() {
    super("saku");
    this.version(2).stores({
      transactions: "id, household_id, occurred_at, updated_at, syncStatus, is_deleted",
      wallets: "id, household_id, updated_at, is_archived, syncStatus",
      categories: "id, household_id, is_archived, syncStatus",
      budgets: "id, household_id, period_month, syncStatus",
      outbox: "++seq, entity, entityId, op, createdAt",
    });
    this.version(3).stores({
      transactions:
        "id, household_id, occurred_at, updated_at, syncStatus, is_deleted, [household_id+is_deleted], [household_id+occurred_at]",
      wallets:
        "id, household_id, updated_at, is_archived, syncStatus, [household_id+is_archived]",
      categories:
        "id, household_id, is_archived, syncStatus, [household_id+is_archived]",
      budgets:
        "id, household_id, period_month, syncStatus, [household_id+period_month]",
      outbox: "++seq, entity, entityId, op, createdAt",
    });
    this.version(4).stores({
      transactions:
        "id, household_id, occurred_at, updated_at, syncStatus, is_deleted, [household_id+is_deleted], [household_id+occurred_at]",
      wallets:
        "id, household_id, updated_at, is_archived, syncStatus, [household_id+is_archived]",
      categories:
        "id, household_id, is_archived, syncStatus, [household_id+is_archived]",
      budgets:
        "id, household_id, period_month, syncStatus, [household_id+period_month]",
      savings_goals:
        "id, household_id, target_date, is_completed, syncStatus, [household_id+is_completed]",
      outbox: "++seq, entity, entityId, op, createdAt",
    });
    this.version(5).stores({
      transactions:
        "id, household_id, occurred_at, updated_at, syncStatus, is_deleted, [household_id+is_deleted], [household_id+occurred_at]",
      wallets:
        "id, household_id, updated_at, is_archived, syncStatus, [household_id+is_archived]",
      categories:
        "id, household_id, is_archived, syncStatus, [household_id+is_archived]",
      budgets:
        "id, household_id, period_month, syncStatus, [household_id+period_month]",
      savings_goals:
        "id, household_id, target_date, is_completed, syncStatus, [household_id+is_completed]",
      debts:
        "id, household_id, type, is_completed, syncStatus, [household_id+is_completed]",
      outbox: "++seq, entity, entityId, op, createdAt",
    });
    this.version(6).stores({
      transactions:
        "id, household_id, occurred_at, updated_at, syncStatus, is_deleted, category_id, [household_id+is_deleted], [household_id+occurred_at]",
      wallets:
        "id, household_id, updated_at, is_archived, syncStatus, [household_id+is_archived]",
      categories:
        "id, household_id, is_archived, syncStatus, [household_id+is_archived]",
      budgets:
        "id, household_id, period_month, syncStatus, category_id, [household_id+period_month]",
      savings_goals:
        "id, household_id, target_date, is_completed, syncStatus, [household_id+is_completed]",
      debts:
        "id, household_id, type, is_completed, syncStatus, [household_id+is_completed]",
      outbox: "++seq, entity, entityId, op, createdAt",
    });
    this.version(7).stores({
      transactions:
        "id, household_id, occurred_at, updated_at, syncStatus, is_deleted, category_id, [household_id+is_deleted], [household_id+occurred_at]",
      wallets:
        "id, household_id, updated_at, is_archived, syncStatus, [household_id+is_archived]",
      categories:
        "id, household_id, is_archived, syncStatus, [household_id+is_archived]",
      budgets:
        "id, household_id, period_month, syncStatus, category_id, [household_id+period_month]",
      savings_goals:
        "id, household_id, target_date, is_completed, syncStatus, [household_id+is_completed]",
      debts:
        "id, household_id, type, is_completed, syncStatus, [household_id+is_completed]",
      recurring_transactions:
        "id, household_id, frequency, next_materialize_at, is_active, syncStatus",
      outbox: "++seq, entity, entityId, op, createdAt",
    });
    // v8: receipt_items JSONB field added to transactions (no new indexes needed)
    this.version(8).stores({
      transactions:
        "id, household_id, occurred_at, updated_at, syncStatus, is_deleted, category_id, [household_id+is_deleted], [household_id+occurred_at]",
      wallets:
        "id, household_id, updated_at, is_archived, syncStatus, [household_id+is_archived]",
      categories:
        "id, household_id, is_archived, syncStatus, [household_id+is_archived]",
      budgets:
        "id, household_id, period_month, syncStatus, category_id, [household_id+period_month]",
      savings_goals:
        "id, household_id, target_date, is_completed, syncStatus, [household_id+is_completed]",
      debts:
        "id, household_id, type, is_completed, syncStatus, [household_id+is_completed]",
      recurring_transactions:
        "id, household_id, frequency, next_materialize_at, is_active, syncStatus",
      outbox: "++seq, entity, entityId, op, createdAt",
    });
  }
}

export const db = new SakuDB();
