-- Saku Kita — Invite acceptance flow (TRD §6)
-- Security definer function so an authenticated user can accept an invite
-- without needing direct SELECT/UPDATE on the invites table (admin-only).

create or replace function public.accept_invite(p_token text)
returns table (household_id uuid, role member_role)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
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

-- Cron: mark pending invites as expired once their expires_at lapses.
do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'expire-invites';
exception when others then
  null;
end$$;

select cron.schedule(
  'expire-invites',
  '15 * * * *',  -- hourly at :15
  $$
    update public.invites
      set status = 'expired'
    where status = 'pending'
      and expires_at < now()
  $$
);
