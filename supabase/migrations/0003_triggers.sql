-- Saku Kita — triggers & functions

-- ─── updated_at auto-touch ──────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated     before update on profiles
  for each row execute function set_updated_at();
create trigger trg_wallets_updated      before update on wallets
  for each row execute function set_updated_at();
create trigger trg_transactions_updated before update on transactions
  for each row execute function set_updated_at();
create trigger trg_budgets_updated      before update on budgets
  for each row execute function set_updated_at();

-- ─── New-user bootstrap ─────────────────────────────────────────────────────
-- On signup: create profile + household + admin membership + default
-- categories + a Cash wallet. Runs as definer so it bypasses RLS.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  display text;
begin
  display := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  insert into profiles (id, email, display_name, avatar_url)
  values (new.id, new.email, display, new.raw_user_meta_data->>'avatar_url');

  insert into households (name, owner_id)
  values ('Keluarga ' || display, new.id)
  returning id into hid;

  update profiles set active_household_id = hid where id = new.id;

  insert into household_members (household_id, user_id, role)
  values (hid, new.id, 'admin');

  insert into categories (household_id, name, kind, icon, color, sort_order) values
    (hid, 'Makanan',   'expense', 'utensils',      '#E8A5A5', 1),
    (hid, 'Transport', 'expense', 'car',           '#A5C8E8', 2),
    (hid, 'Belanja',   'expense', 'shopping-bag',  '#E8D2A5', 3),
    (hid, 'Hiburan',   'expense', 'party-popper',  '#C8A5E8', 4),
    (hid, 'Kesehatan', 'expense', 'heart-pulse',   '#A5E8C8', 5),
    (hid, 'Tagihan',   'expense', 'receipt',       '#E8B8A5', 6),
    (hid, 'Lain-lain', 'expense', 'circle-dashed', '#C4C4C4', 99),
    (hid, 'Gaji',      'income',  'wallet',        '#5FBF9A', 1),
    (hid, 'Hadiah',    'income',  'gift',          '#B8E6D3', 2);

  insert into wallets (household_id, name, type, icon, color, initial_balance, sort_order)
  values (hid, 'Cash', 'cash', 'banknote', '#B8E6D3', 0, 1);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
