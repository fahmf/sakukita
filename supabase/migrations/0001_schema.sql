-- Saku Kita — core schema (TRD §4)
-- Apply via Supabase dashboard SQL editor, or `supabase db push`.

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type member_role as enum ('admin', 'editor', 'viewer');
create type invite_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type wallet_type as enum (
  'cash', 'debit', 'credit', 'ewallet',
  'savings', 'investment', 'receivable', 'payable'
);
create type category_kind as enum ('income', 'expense');
create type transaction_type as enum ('income', 'expense', 'transfer');

-- ─── profiles ───────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  active_household_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── households ─────────────────────────────────────────────────────────────
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id),
  currency text not null default 'IDR',
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_active_household_fk
  foreign key (active_household_id) references households(id) on delete set null;

-- ─── household_members ──────────────────────────────────────────────────────
create table household_members (
  household_id uuid references households(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role member_role not null default 'editor',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- ─── invites ────────────────────────────────────────────────────────────────
create table invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  invited_by uuid references profiles(id),
  email text,
  token text unique not null,
  role member_role not null default 'editor',
  status invite_status not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ─── wallets ────────────────────────────────────────────────────────────────
create table wallets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  type wallet_type not null,
  icon text,
  color text,
  initial_balance numeric(18,2) not null default 0,
  is_archived boolean not null default false,
  exclude_from_networth boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_wallets_household on wallets(household_id) where is_archived = false;

-- ─── categories (two-level tree) ────────────────────────────────────────────
create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  parent_id uuid references categories(id) on delete cascade,
  name text not null,
  kind category_kind not null,
  icon text,
  color text,
  sort_order int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_categories_household on categories(household_id);
create index idx_categories_parent on categories(parent_id);

-- ─── transactions ───────────────────────────────────────────────────────────
create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references profiles(id),
  type transaction_type not null,
  amount numeric(18,2) not null check (amount > 0),
  occurred_at timestamptz not null,
  is_scheduled boolean not null default false,
  wallet_id uuid not null references wallets(id),
  to_wallet_id uuid references wallets(id),
  category_id uuid references categories(id),
  note text,
  tags text[] not null default '{}',
  receipt_url text,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfer_wallet_rule check (
    (type = 'transfer' and to_wallet_id is not null and to_wallet_id <> wallet_id)
    or (type <> 'transfer' and to_wallet_id is null)
  )
);
create index idx_tx_deleted_recycle on transactions(deleted_at) where is_deleted = true;
create index idx_tx_scheduled on transactions(household_id, occurred_at) where is_scheduled = true;
create index idx_tx_household_occurred on transactions(household_id, occurred_at desc) where is_deleted = false;
create index idx_tx_wallet on transactions(wallet_id) where is_deleted = false;
create index idx_tx_category on transactions(category_id) where is_deleted = false;

-- ─── budgets ────────────────────────────────────────────────────────────────
create table budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  amount numeric(18,2) not null check (amount > 0),
  period_month date not null,
  carry_over boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, category_id, period_month),
  constraint period_first_of_month check (extract(day from period_month) = 1)
);

-- ─── activity_logs ──────────────────────────────────────────────────────────
create table activity_logs (
  id bigserial primary key,
  household_id uuid not null references households(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index idx_activity_household on activity_logs(household_id, created_at desc);

-- ─── push_subscriptions ─────────────────────────────────────────────────────
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ─── v_wallet_balances ──────────────────────────────────────────────────────
-- security_invoker = on so the view respects each table's RLS.
create view v_wallet_balances with (security_invoker = on) as
select
  w.id as wallet_id,
  w.household_id,
  w.initial_balance
    + coalesce(sum(t.amount) filter (where t.type = 'income'   and t.wallet_id = w.id), 0)
    + coalesce(sum(t.amount) filter (where t.type = 'transfer' and t.to_wallet_id = w.id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'expense'  and t.wallet_id = w.id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'transfer' and t.wallet_id = w.id), 0)
    as balance
from wallets w
left join transactions t
  on (t.wallet_id = w.id or t.to_wallet_id = w.id)
  and t.is_deleted = false
  and t.is_scheduled = false
group by w.id;
