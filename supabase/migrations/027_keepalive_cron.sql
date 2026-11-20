-- 027 — Keep the Render free instance awake during Indian business hours (founder, 2026-11-20).
-- Pings https://repaihub.com/health every 5 minutes from 04:00 to 13:55 UTC
-- (= 09:30–19:25 IST, when Indian bank officers are likely to open the beta link).
-- About 10 hours/day ≈ 300 of Render's 750 free instance-hours per month. Costs nothing.
-- Applied to project mievzzzxpsomrzxhkecu on 2026-11-20 via the Management API.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('repaihub-keepalive', '*/5 4-13 * * *',
  $$select net.http_get(url := 'https://repaihub.com/health', timeout_milliseconds := 60000)$$);
-- Change hours:  select cron.alter_job((select jobid from cron.job where jobname='repaihub-keepalive'), schedule := '<cron in UTC>');
-- Remove:        select cron.unschedule('repaihub-keepalive');
