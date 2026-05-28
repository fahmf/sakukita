// Hand-written DB types mirroring supabase/migrations.
// Regenerate later with: supabase gen types typescript --project-id <id>

export type MemberRole = "admin" | "editor" | "viewer";
export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";
export type WalletType =
  | "cash"
  | "debit"
  | "credit"
  | "ewallet"
  | "savings"
  | "investment"
  | "receivable"
  | "payable";
export type CategoryKind = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer";

export interface ReceiptItem {
  name: string;
  price: number;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  active_household_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Household {
  id: string;
  name: string;
  owner_id: string;
  currency: string;
  created_at: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
}

export interface Wallet {
  id: string;
  household_id: string;
  name: string;
  type: WalletType;
  icon: string | null;
  color: string | null;
  initial_balance: number;
  is_archived: boolean;
  exclude_from_networth: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  household_id: string;
  parent_id: string | null;
  name: string;
  kind: CategoryKind;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  household_id: string;
  created_by: string;
  type: TransactionType;
  amount: number;
  occurred_at: string;
  is_scheduled: boolean;
  wallet_id: string;
  to_wallet_id: string | null;
  category_id: string | null;
  note: string | null;
  tags: string[];
  receipt_url: string | null;
  receipt_items: ReceiptItem[] | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  household_id: string;
  category_id: string;
  amount: number;
  period_month: string;
  carry_over: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoal {
  id: string;
  household_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  is_completed: boolean;
  icon: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}
export interface Debt {
  id: string;
  household_id: string;
  name: string;
  type: "payable" | "receivable";
  amount: number;
  remaining_amount: number;
  due_date: string | null;
  is_completed: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringTransaction {
  id: string;
  household_id: string;
  amount: number;
  type: TransactionType;
  wallet_id: string;
  to_wallet_id: string | null;
  category_id: string | null;
  note: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  start_date: string;
  end_date: string | null;
  last_materialized_at: string | null;
  next_materialize_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletBalance {
  wallet_id: string;
  household_id: string;
  balance: number;
}

type Insertable<T, Optional extends keyof T> = Omit<T, Optional> &
  Partial<Pick<T, Optional>>;

type DbTable<Row, InsertOptional extends keyof Row> = {
  Row: Row;
  Insert: Insertable<Row, InsertOptional>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: DbTable<Profile, "created_at" | "updated_at" | "display_name" | "avatar_url" | "active_household_id">;
      households: DbTable<Household, "id" | "created_at" | "currency">;
      household_members: DbTable<HouseholdMember, "joined_at" | "role">;
      wallets: DbTable<
        Wallet,
        | "id"
        | "created_at"
        | "updated_at"
        | "icon"
        | "color"
        | "initial_balance"
        | "is_archived"
        | "exclude_from_networth"
        | "sort_order"
      >;
      categories: DbTable<
        Category,
        "id" | "created_at" | "parent_id" | "icon" | "color" | "sort_order" | "is_archived"
      >;
      transactions: DbTable<
        Transaction,
        | "id"
        | "created_at"
        | "updated_at"
        | "is_scheduled"
        | "to_wallet_id"
        | "category_id"
        | "note"
        | "tags"
        | "receipt_url"
        | "receipt_items"
        | "is_deleted"
        | "deleted_at"
        | "deleted_by"
        | "client_id"
      >;
      budgets: DbTable<Budget, "id" | "created_at" | "updated_at" | "carry_over">;
      savings_goals: DbTable<
        SavingsGoal,
        "id" | "current_amount" | "target_date" | "is_completed" | "icon" | "color" | "created_at" | "updated_at"
      >;
      debts: DbTable<
        Debt,
        "id" | "remaining_amount" | "due_date" | "is_completed" | "note" | "created_at" | "updated_at"
      >;
      recurring_transactions: DbTable<
        RecurringTransaction,
        | "id"
        | "to_wallet_id"
        | "category_id"
        | "note"
        | "interval"
        | "end_date"
        | "last_materialized_at"
        | "is_active"
        | "created_at"
        | "updated_at"
      >;
    };
    Views: {
      v_wallet_balances: {
        Row: WalletBalance;
        Relationships: [];
      };
    };
    Functions: {
      accept_invite: {
        Args: { p_token: string };
        Returns: { household_id: string; role: MemberRole }[];
      };
    };
    Enums: {
      member_role: MemberRole;
      invite_status: InviteStatus;
      wallet_type: WalletType;
      category_kind: CategoryKind;
      transaction_type: TransactionType;
    };
  };
}
