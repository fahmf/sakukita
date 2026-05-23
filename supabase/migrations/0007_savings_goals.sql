-- Saku Kita — Savings Goals Schema (Roadmap v1.x)
-- Apply via `supabase db push` or SQL editor.

-- ─── savings_goals ──────────────────────────────────────────────────────────
create table savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  target_amount numeric(18,2) not null check (target_amount > 0),
  current_amount numeric(18,2) not null default 0 check (current_amount >= 0),
  target_date date,
  is_completed boolean not null default false,
  icon text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_goals_household on savings_goals(household_id);

-- ─── Enable RLS ─────────────────────────────────────────────────────────────
alter table savings_goals enable row level security;

-- ─── RLS Policies ────────────────────────────────────────────────────────────
create policy goals_select on savings_goals for select using (is_member(household_id));
create policy goals_insert on savings_goals for insert
  with check (has_role(household_id, array['admin','editor']::member_role[]));
create policy goals_update on savings_goals for update
  using (has_role(household_id, array['admin','editor']::member_role[]));
create policy goals_delete on savings_goals for delete
  using (has_role(household_id, array['admin']::member_role[]));
