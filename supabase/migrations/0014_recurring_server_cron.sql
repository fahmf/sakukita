-- Saku Kita — Server-side materialization of recurring transactions (0014)
--
-- Applied to production on 2026-06-12 but never committed; reconstructed from
-- the live definitions (pg_get_functiondef / cron.job) so the repo can rebuild
-- the database again. Replaces the client-side materializer, which inserted
-- created_by = 'system' (not a UUID) and was always rejected.

-- ─── add_months_clamped: month arithmetic that keeps the anchor day ─────────
-- e.g. anchor 31: Jan 31 → Feb 28/29 → Mar 31 (never drifts to the 28th).
create or replace function public.add_months_clamped(d date, months integer, anchor_day integer)
returns date
language plpgsql
immutable
as $$
declare
  first_of_target date;
  last_day int;
begin
  first_of_target := (date_trunc('month', d) + make_interval(months => months))::date;
  last_day := extract(day from (first_of_target + interval '1 month - 1 day'))::int;
  return first_of_target + (least(anchor_day, last_day) - 1);
end;
$$;

-- ─── materialize_recurring_transactions ─────────────────────────────────────
create or replace function public.materialize_recurring_transactions()
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- ─── Hourly job (minute 10) ─────────────────────────────────────────────────
do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'materialize-recurring';
exception when others then
  null;
end$$;

select cron.schedule(
  'materialize-recurring',
  '10 * * * *',
  $$select public.materialize_recurring_transactions()$$
);
