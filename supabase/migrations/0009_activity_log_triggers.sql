-- Saku Kita — Activity Log Triggers (A10)
-- Automatically write records into activity_logs on INSERT, UPDATE, or DELETE
-- of transactions, wallets, or budgets.

create or replace function log_activity()
returns trigger
language plpgsql
security definer
as $$
declare
  current_actor uuid;
  h_id uuid;
  act text;
  e_id uuid;
  meta jsonb;
begin
  -- Get current authenticated Supabase user ID
  current_actor := auth.uid();

  -- Determine action, entity properties, and fallback actor
  if (TG_OP = 'INSERT') then
    act := 'create';
    e_id := new.id;
    h_id := new.household_id;
    if (TG_TABLE_NAME = 'transactions') then
      if (current_actor is null) then current_actor := new.created_by; end if;
      meta := jsonb_build_object('type', new.type, 'amount', new.amount, 'note', new.note);
    elsif (TG_TABLE_NAME = 'wallets') then
      meta := jsonb_build_object('name', new.name, 'type', new.type);
    elsif (TG_TABLE_NAME = 'budgets') then
      meta := jsonb_build_object('amount', new.amount, 'category_id', new.category_id, 'period_month', new.period_month);
    end if;

  elsif (TG_OP = 'UPDATE') then
    act := 'update';
    e_id := new.id;
    h_id := new.household_id;
    if (TG_TABLE_NAME = 'transactions') then
      if (current_actor is null) then current_actor := new.created_by; end if;
      if (new.is_deleted = true and (old.is_deleted is null or old.is_deleted = false)) then
        act := 'delete'; -- Soft deleted is logged as delete
      end if;
      meta := jsonb_build_object('type', new.type, 'amount', new.amount, 'note', new.note);
    elsif (TG_TABLE_NAME = 'wallets') then
      if (new.is_archived = true and (old.is_archived is null or old.is_archived = false)) then
        act := 'archive';
      end if;
      meta := jsonb_build_object('name', new.name, 'type', new.type);
    elsif (TG_TABLE_NAME = 'budgets') then
      meta := jsonb_build_object('amount', new.amount, 'category_id', new.category_id, 'period_month', new.period_month);
    end if;

  elsif (TG_OP = 'DELETE') then
    act := 'delete';
    e_id := old.id;
    h_id := old.household_id;
    if (TG_TABLE_NAME = 'transactions') then
      if (current_actor is null) then current_actor := old.created_by; end if;
      meta := jsonb_build_object('type', old.type, 'amount', old.amount, 'note', old.note);
    elsif (TG_TABLE_NAME = 'wallets') then
      if (old.is_archived = true) then
        act := 'archive';
      end if;
      meta := jsonb_build_object('name', old.name, 'type', old.type);
    elsif (TG_TABLE_NAME = 'budgets') then
      meta := jsonb_build_object('amount', old.amount, 'category_id', old.category_id, 'period_month', old.period_month);
    end if;
  end if;

  insert into activity_logs (household_id, actor_id, action, entity_type, entity_id, metadata)
  values (h_id, current_actor, act, TG_TABLE_NAME, e_id, meta);

  if (TG_OP = 'DELETE') then
    return old;
  else
    return new;
  end if;
end;
$$;

-- Create triggers
drop trigger if exists trg_transactions_activity on transactions;
create trigger trg_transactions_activity
  after insert or update or delete on transactions
  for each row execute function log_activity();

drop trigger if exists trg_wallets_activity on wallets;
create trigger trg_wallets_activity
  after insert or update or delete on wallets
  for each row execute function log_activity();

drop trigger if exists trg_budgets_activity on budgets;
create trigger trg_budgets_activity
  after insert or update or delete on budgets
  for each row execute function log_activity();
