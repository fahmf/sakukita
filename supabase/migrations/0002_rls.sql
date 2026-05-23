-- Saku Kita — Row Level Security (TRD §4)

-- ─── Helper functions (security definer → bypass RLS, avoid recursion) ───────
create or replace function is_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create or replace function has_role(hid uuid, roles member_role[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid() and role = any(roles)
  );
$$;

-- ─── Enable RLS ─────────────────────────────────────────────────────────────
alter table profiles            enable row level security;
alter table households          enable row level security;
alter table household_members   enable row level security;
alter table invites             enable row level security;
alter table wallets             enable row level security;
alter table categories          enable row level security;
alter table transactions        enable row level security;
alter table budgets             enable row level security;
alter table activity_logs       enable row level security;
alter table push_subscriptions  enable row level security;

-- ─── profiles ───────────────────────────────────────────────────────────────
create policy profiles_select on profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from household_members m1
    join household_members m2 on m1.household_id = m2.household_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  )
);
create policy profiles_insert on profiles for insert with check (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid());

-- ─── households ─────────────────────────────────────────────────────────────
create policy households_select on households for select using (is_member(id));
create policy households_insert on households for insert with check (owner_id = auth.uid());
create policy households_update on households for update using (owner_id = auth.uid());
create policy households_delete on households for delete using (owner_id = auth.uid());

-- ─── household_members ──────────────────────────────────────────────────────
create policy hm_select on household_members for select using (is_member(household_id));
create policy hm_insert on household_members for insert
  with check (has_role(household_id, array['admin']::member_role[]));
create policy hm_update on household_members for update
  using (has_role(household_id, array['admin']::member_role[]));
create policy hm_delete on household_members for delete using (
  has_role(household_id, array['admin']::member_role[]) or user_id = auth.uid()
);

-- ─── invites (admin only; accept handled by Edge Function w/ service role) ──
create policy invites_select on invites for select
  using (has_role(household_id, array['admin']::member_role[]));
create policy invites_insert on invites for insert
  with check (has_role(household_id, array['admin']::member_role[]));
create policy invites_update on invites for update
  using (has_role(household_id, array['admin']::member_role[]));

-- ─── wallets ────────────────────────────────────────────────────────────────
create policy wallets_select on wallets for select using (is_member(household_id));
create policy wallets_insert on wallets for insert
  with check (has_role(household_id, array['admin','editor']::member_role[]));
create policy wallets_update on wallets for update
  using (has_role(household_id, array['admin','editor']::member_role[]));
create policy wallets_delete on wallets for delete
  using (has_role(household_id, array['admin']::member_role[]));

-- ─── categories ─────────────────────────────────────────────────────────────
create policy categories_select on categories for select using (is_member(household_id));
create policy categories_insert on categories for insert
  with check (has_role(household_id, array['admin','editor']::member_role[]));
create policy categories_update on categories for update
  using (has_role(household_id, array['admin','editor']::member_role[]));
create policy categories_delete on categories for delete
  using (has_role(household_id, array['admin']::member_role[]));

-- ─── transactions (soft-delete is an UPDATE → editors allowed; hard DELETE admin) ─
create policy tx_select on transactions for select using (is_member(household_id));
create policy tx_insert on transactions for insert
  with check (has_role(household_id, array['admin','editor']::member_role[]));
create policy tx_update on transactions for update
  using (has_role(household_id, array['admin','editor']::member_role[]));
create policy tx_delete on transactions for delete
  using (has_role(household_id, array['admin']::member_role[]));

-- ─── budgets ────────────────────────────────────────────────────────────────
create policy budgets_select on budgets for select using (is_member(household_id));
create policy budgets_insert on budgets for insert
  with check (has_role(household_id, array['admin','editor']::member_role[]));
create policy budgets_update on budgets for update
  using (has_role(household_id, array['admin','editor']::member_role[]));
create policy budgets_delete on budgets for delete
  using (has_role(household_id, array['admin']::member_role[]));

-- ─── activity_logs ──────────────────────────────────────────────────────────
create policy activity_select on activity_logs for select using (is_member(household_id));
create policy activity_insert on activity_logs for insert with check (is_member(household_id));

-- ─── push_subscriptions (owner-scoped) ──────────────────────────────────────
create policy push_select on push_subscriptions for select using (user_id = auth.uid());
create policy push_insert on push_subscriptions for insert with check (user_id = auth.uid());
create policy push_delete on push_subscriptions for delete using (user_id = auth.uid());
