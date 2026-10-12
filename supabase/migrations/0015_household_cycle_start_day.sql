-- Saku Kita — Per-household financial-month cycle start day (0015)
--
-- The app counts each "month" from this day of the previous calendar month
-- (default 25: the "Oktober" cycle is 25 Sep – 24 Okt). 1 means plain
-- calendar months. Capped at 28 so every month has the day.
--
-- Additive and backward compatible: existing households get 25, which is the
-- value that was hard-coded in the app before this column existed. Budgets
-- stay keyed by period_month; only which transactions fall into a month
-- depends on this value, so changing it re-buckets history rather than
-- losing anything.

alter table households
  add column if not exists cycle_start_day smallint not null default 25;

alter table households
  drop constraint if exists households_cycle_start_day_range;

alter table households
  add constraint households_cycle_start_day_range
  check (cycle_start_day between 1 and 28);
