-- Saku Kita — Materialize scheduled transactions (TRD §10)
-- Daily 00:05 UTC: flip is_scheduled=false for any future-dated rows
-- whose occurred_at has now passed.

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'materialize-scheduled';
exception when others then
  null;
end$$;

select cron.schedule(
  'materialize-scheduled',
  '5 0 * * *',  -- daily at 00:05 UTC
  $$
    update public.transactions
      set is_scheduled = false,
          updated_at = now()
    where is_scheduled = true
      and is_deleted = false
      and occurred_at <= now()
  $$
);
