-- Saku Kita — 0014: Materialisasi transaksi berulang pindah ke server
--
-- Sebelumnya materialisasi recurring dijalankan di klien (sync.ts), yang
-- menyebabkan dua masalah: (1) payload klien memakai created_by "system"
-- yang bukan UUID sehingga insert selalu gagal; (2) setiap device
-- menjalankan materialisasi sendiri sehingga dua device online bersamaan
-- menghasilkan transaksi ganda. Satu runner di server menghilangkan
-- keduanya, dan recurring tetap berjalan walau tidak ada device yang aktif.

-- ─── 1. set_updated_at: hormati nilai updated_at dari klien ────────────────
-- Klien selalu mengirim updated_at (waktu edit lokal) dan sync engine memakai
-- guard last-write-wins `updated_at < payload.updated_at`. Bila trigger
-- selalu menimpa dengan now(), perbandingan itu membandingkan jam server vs
-- jam klien dan menjadi rawan skew. Sekarang now() hanya dipakai bila klien
-- tidak mengubah updated_at.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$fn$;

-- ─── 2. Penambahan bulan dengan anchor day (anti-drift) ─────────────────────
-- 31 Jan + 1 bulan = 28/29 Feb, lalu bulan berikutnya KEMBALI ke tanggal 31
-- (bukan terkunci di 28). anchor_day = tanggal pada start_date template.
create or replace function public.add_months_clamped(d date, months int, anchor_day int)
returns date
language plpgsql
immutable
as $fn$
declare
  first_of_target date;
  last_day int;
begin
  first_of_target := (date_trunc('month', d) + make_interval(months => months))::date;
  last_day := extract(day from (first_of_target + interval '1 month - 1 day'))::int;
  return first_of_target + (least(anchor_day, last_day) - 1);
end;
$fn$;

-- ─── 3. Runner materialisasi recurring ──────────────────────────────────────
create or replace function public.materialize_recurring_transactions()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  tpl record;
  occur_date date;
  next_ts timestamptz;
  owner uuid;
  iv int;
  anchor int;
  guard int;
begin
  for tpl in
    select * from recurring_transactions
    where is_active = true and next_materialize_at <= now()
    for update skip locked
  loop
    iv := tpl."interval";
    anchor := extract(day from tpl.start_date)::int;
    -- created_by wajib UUID valid; pakai pemilik household sebagai aktor
    select owner_id into owner from households where id = tpl.household_id;
    next_ts := tpl.next_materialize_at;
    guard := 0;

    -- Catch-up: materialisasi semua kejadian yang terlewat (maks 120 agar
    -- template yang lama tidak aktif tidak membanjiri tabel).
    while next_ts <= now() and guard < 120 loop
      occur_date := (next_ts at time zone 'Asia/Jakarta')::date;

      if tpl.end_date is not null and occur_date > tpl.end_date then
        update recurring_transactions
          set is_active = false
          where id = tpl.id;
        next_ts := null;
        exit;
      end if;

      insert into transactions
        (household_id, created_by, type, amount, occurred_at, is_scheduled,
         wallet_id, to_wallet_id, category_id, note, tags)
      values
        (tpl.household_id, owner, tpl.type, tpl.amount, next_ts, false,
         tpl.wallet_id, tpl.to_wallet_id, tpl.category_id,
         coalesce(tpl.note, 'Transaksi Berulang Otomatis'), '{}');

      occur_date := case tpl.frequency
        when 'daily'   then occur_date + iv
        when 'weekly'  then occur_date + iv * 7
        when 'monthly' then add_months_clamped(occur_date, iv, anchor)
        when 'yearly'  then add_months_clamped(occur_date, iv * 12, anchor)
        else occur_date + 1
      end;
      next_ts := occur_date::timestamp at time zone 'Asia/Jakarta';
      guard := guard + 1;
    end loop;

    if next_ts is not null then
      update recurring_transactions
        set last_materialized_at = now(),
            next_materialize_at = next_ts
        where id = tpl.id;
    end if;
  end loop;
end;
$fn$;

-- Hanya cron/postgres yang boleh menjalankan runner ini
revoke execute on function public.materialize_recurring_transactions() from public, anon, authenticated;

-- ─── 4. Jadwal cron: tiap jam menit ke-10 ───────────────────────────────────
do $do$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'materialize-recurring';
exception when others then
  null;
end$do$;

select cron.schedule(
  'materialize-recurring',
  '10 * * * *',
  $job$select public.materialize_recurring_transactions()$job$
);
