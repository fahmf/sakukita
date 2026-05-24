-- Saku Kita — Bug fixes & security hardening (0010)
-- Fixes: log_activity search_path, activity_logs RLS, missing triggers & indexes

-- ─── 1. Fix log_activity() — add search_path (security fix) ────────────────
create or replace function log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
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

-- ─── 2. Restrict activity_logs INSERT — trigger-only (security fix) ────────
-- Activity logs should only be written by the log_activity() SECURITY DEFINER
-- trigger, not by direct user access. Drop the overly-permissive INSERT policy.
drop policy if exists activity_insert on activity_logs;

-- ─── 3. Add updated_at triggers for savings_goals and debts ────────────────
create trigger trg_savings_goals_updated before update on savings_goals
  for each row execute function set_updated_at();
create trigger trg_debts_updated before update on debts
  for each row execute function set_updated_at();

-- ─── 4. Add CHECK constraint on debts.remaining_amount ─────────────────────
alter table debts add constraint debts_remaining_lte_amount
  check (remaining_amount <= amount);

-- ─── 5. Add missing indexes ────────────────────────────────────────────────
-- Critical: household_members(user_id) — used by is_member()/has_role() in
-- every RLS check. Without this, every query does a seq scan on hm.
create index if not exists idx_hm_user on household_members(user_id);

-- v_wallet_balances view and transfer queries need to_wallet_id indexed
create index if not exists idx_tx_to_wallet
  on transactions(to_wallet_id)
  where is_deleted = false and to_wallet_id is not null;

-- Invite expiry cron job performance
create index if not exists idx_invites_pending_expiry
  on invites(expires_at)
  where status = 'pending';

-- ─── 6. Fix accept_invite() — add email verification (security fix) ────────
-- When the invite has an email set, verify the accepting user's email matches.
-- This prevents unauthorized users from accepting invites meant for others.
create or replace function public.accept_invite(p_token text)
returns table (household_id uuid, role member_role)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_invite invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_invite
  from invites
  where token = p_token
  for update;

  if not found then
    raise exception 'Invite not found' using errcode = 'P0002';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Invite is %', v_invite.status using errcode = 'P0001';
  end if;

  if v_invite.expires_at < now() then
    update invites set status = 'expired' where id = v_invite.id;
    raise exception 'Invite expired' using errcode = 'P0001';
  end if;

  -- Verify email match when invite targets a specific email
  if v_invite.email is not null and v_invite.email <> '' then
    select email into v_user_email
    from auth.users
    where id = v_user_id;

    if v_user_email is null or lower(v_user_email) <> lower(v_invite.email) then
      raise exception 'Email tidak cocok dengan undangan'
        using errcode = 'P0001';
    end if;
  end if;

  -- Idempotent: skip insert if already a member
  insert into household_members (household_id, user_id, role)
  values (v_invite.household_id, v_user_id, v_invite.role)
  on conflict (household_id, user_id) do update
    set role = excluded.role;

  update invites set status = 'accepted' where id = v_invite.id;

  -- Auto-switch active household for convenience
  update profiles
    set active_household_id = v_invite.household_id,
        updated_at = now()
  where id = v_user_id;

  return query select v_invite.household_id, v_invite.role;
end;
$$;

revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;
