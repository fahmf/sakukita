-- Saku Kita — Recycle Bin auto-purge (TRD §10)
-- Hard-delete transactions soft-deleted more than 30 days ago.
-- Requires pg_cron extension (enabled by default on Supabase).

create extension if not exists pg_cron with schema extensions;

-- Idempotent: drop existing job before re-creating
do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'cleanup-recycle-bin';
exception when others then
  null;
end$$;

select cron.schedule(
  'cleanup-recycle-bin',
  '0 3 * * *',  -- daily at 03:00 UTC
  $$
    delete from public.transactions
    where is_deleted = true
      and deleted_at is not null
      and deleted_at < now() - interval '30 days'
  $$
);
