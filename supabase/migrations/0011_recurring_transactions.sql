-- Saku Kita — Recurring Transactions (0011)

-- ─── 1. Create recurring_transactions table ──────────────────────────────────
create table recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  amount numeric not null check (amount > 0),
  type transaction_type not null,
  wallet_id uuid not null references wallets(id) on delete cascade,
  to_wallet_id uuid references wallets(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  note text,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  interval integer not null default 1 check (interval > 0),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  last_materialized_at timestamptz,
  next_materialize_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Transfer integrity check
  constraint check_recurring_transfer check (
    (type = 'transfer'::transaction_type and to_wallet_id is not null and wallet_id <> to_wallet_id) or
    (type <> 'transfer'::transaction_type and to_wallet_id is null)
  )
);

-- ─── 2. Enable RLS ───────────────────────────────────────────────────────────
alter table recurring_transactions enable row level security;

-- ─── 3. Add RLS Policies ──────────────────────────────────────────────────────
create policy recurring_select on recurring_transactions for select
  using (is_member(household_id));

create policy recurring_insert on recurring_transactions for insert
  with check (has_role(household_id, array['admin'::member_role, 'editor'::member_role]));

create policy recurring_update on recurring_transactions for update
  using (has_role(household_id, array['admin'::member_role, 'editor'::member_role]))
  with check (has_role(household_id, array['admin'::member_role, 'editor'::member_role]));

create policy recurring_delete on recurring_transactions for delete
  using (has_role(household_id, array['admin'::member_role, 'editor'::member_role]));

-- ─── 4. Add updated_at trigger ────────────────────────────────────────────────
create trigger trg_recurring_updated before update on recurring_transactions
  for each row execute function set_updated_at();

-- ─── 5. Add indexes ──────────────────────────────────────────────────────────
create index idx_recurring_household on recurring_transactions(household_id);
create index idx_recurring_next_mat on recurring_transactions(next_materialize_at) where is_active = true;

-- ─── 6. Add activity logging trigger ─────────────────────────────────────────
-- Activity logging for recurring transactions
create or replace function log_recurring_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_actor uuid;
  act text;
  e_id uuid;
  h_id uuid;
  meta jsonb;
begin
  current_actor := auth.uid();

  if (TG_OP = 'INSERT') then
    act := 'create';
    e_id := new.id;
    h_id := new.household_id;
    meta := jsonb_build_object('amount', new.amount, 'type', new.type, 'frequency', new.frequency, 'note', new.note);
  elsif (TG_OP = 'UPDATE') then
    act := 'update';
    e_id := new.id;
    h_id := new.household_id;
    if (new.is_active = false and old.is_active = true) then
      act := 'deactivate';
    elsif (new.is_active = true and old.is_active = false) then
      act := 'activate';
    end if;
    meta := jsonb_build_object('amount', new.amount, 'type', new.type, 'frequency', new.frequency, 'note', new.note);
  elsif (TG_OP = 'DELETE') then
    act := 'delete';
    e_id := old.id;
    h_id := old.household_id;
    meta := jsonb_build_object('amount', old.amount, 'type', old.type, 'frequency', old.frequency, 'note', old.note);
  end if;

  insert into activity_logs (household_id, actor_id, action, entity_type, entity_id, metadata)
  values (h_id, current_actor, act, 'recurring_transactions', e_id, meta);

  if (TG_OP = 'DELETE') then
    return old;
  else
    return new;
  end if;
end;
$$;

create trigger trg_recurring_activity_log
  after insert or update or delete on recurring_transactions
  for each row execute function log_recurring_activity();
