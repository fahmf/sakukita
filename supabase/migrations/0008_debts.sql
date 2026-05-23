-- Saku Kita — Debts & Loans Schema (Roadmap v1.x)
-- Apply via `supabase db push` or SQL editor.

-- ─── debts ──────────────────────────────────────────────────────────
create table debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  type text not null check (type in ('payable', 'receivable')),
  amount numeric(18,2) not null check (amount > 0),
  remaining_amount numeric(18,2) not null check (remaining_amount >= 0),
  due_date date,
  is_completed boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_debts_household on debts(household_id);

-- ─── Enable RLS ─────────────────────────────────────────────────────────────
alter table debts enable row level security;

-- ─── RLS Policies ────────────────────────────────────────────────────────────
create policy debts_select on debts for select using (is_member(household_id));
create policy debts_insert on debts for insert
  with check (has_role(household_id, array['admin','editor']::member_role[]));
create policy debts_update on debts for update
  using (has_role(household_id, array['admin','editor']::member_role[]));
create policy debts_delete on debts for delete
  using (has_role(household_id, array['admin']::member_role[]));
