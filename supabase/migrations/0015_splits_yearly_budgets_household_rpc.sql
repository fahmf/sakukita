-- Saku Kita — fitur baru:
--   1. Split transaction (pecah satu transaksi ke beberapa kategori)
--   2. Budget tahunan (period_type) + tetap kompatibel envelope/carry_over
--   3. RPC transfer kepemilikan & keluar household
--
-- Aman dijalankan berulang (idempotent sebisa mungkin).

-- ─── 1. Split transaction ────────────────────────────────────────────────────
-- Disimpan sebagai JSONB array [{ "category_id": uuid, "amount": number,
-- "note"?: text }]. Saat splits terisi, transactions.category_id = null dan
-- jumlah seluruh split = transactions.amount (divalidasi di klien).
alter table transactions
  add column if not exists splits jsonb;

-- ─── 2. Budget tahunan ───────────────────────────────────────────────────────
-- period_type: 'monthly' (default, perilaku lama) atau 'yearly'.
-- Periode tahunan memakai period_month = YYYY-01-01 (hari = 1 → constraint
-- period_first_of_month tetap terpenuhi tanpa perubahan).
alter table budgets
  add column if not exists period_type text not null default 'monthly';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'budgets_period_type_check'
  ) then
    alter table budgets
      add constraint budgets_period_type_check
      check (period_type in ('monthly', 'yearly'));
  end if;
end$$;

-- Unik lama (household, category, period_month) tidak boleh menabrak antara
-- budget bulanan & tahunan yang sama-sama jatuh pada YYYY-01-01. Sertakan
-- period_type pada kunci unik.
alter table budgets
  drop constraint if exists budgets_household_id_category_id_period_month_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'budgets_period_unique'
  ) then
    alter table budgets
      add constraint budgets_period_unique
      unique (household_id, category_id, period_month, period_type);
  end if;
end$$;

-- ─── 3. Transfer kepemilikan household ───────────────────────────────────────
create or replace function transfer_household_ownership(
  p_household_id uuid,
  p_new_owner uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Tidak terautentikasi';
  end if;

  -- Hanya pemilik saat ini yang boleh mentransfer
  if not exists (
    select 1 from households
    where id = p_household_id and owner_id = v_caller
  ) then
    raise exception 'Hanya pemilik household yang dapat mentransfer kepemilikan';
  end if;

  -- Calon pemilik wajib anggota household
  if not exists (
    select 1 from household_members
    where household_id = p_household_id and user_id = p_new_owner
  ) then
    raise exception 'Calon pemilik harus anggota household terlebih dahulu';
  end if;

  update households set owner_id = p_new_owner where id = p_household_id;

  -- Pemilik baru otomatis admin; pemilik lama tetap admin
  update household_members set role = 'admin'
    where household_id = p_household_id and user_id = p_new_owner;
  update household_members set role = 'admin'
    where household_id = p_household_id and user_id = v_caller;
end;
$$;

revoke execute on function transfer_household_ownership(uuid, uuid) from public;
grant execute on function transfer_household_ownership(uuid, uuid) to authenticated;

-- ─── 4. Keluar dari household ────────────────────────────────────────────────
create or replace function leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Tidak terautentikasi';
  end if;

  -- Pemilik tidak boleh keluar tanpa transfer kepemilikan dulu
  if exists (
    select 1 from households
    where id = p_household_id and owner_id = v_caller
  ) then
    raise exception 'Pemilik tidak dapat keluar. Transfer kepemilikan terlebih dahulu.';
  end if;

  if not exists (
    select 1 from household_members
    where household_id = p_household_id and user_id = v_caller
  ) then
    raise exception 'Kamu bukan anggota household ini';
  end if;

  delete from household_members
    where household_id = p_household_id and user_id = v_caller;

  -- Pindahkan active household ke membership lain bila ada, jika tidak null
  update profiles p
    set active_household_id = (
      select hm.household_id from household_members hm
      where hm.user_id = v_caller and hm.household_id <> p_household_id
      limit 1
    ),
    updated_at = now()
    where p.id = v_caller and p.active_household_id = p_household_id;
end;
$$;

revoke execute on function leave_household(uuid) from public;
grant execute on function leave_household(uuid) to authenticated;
