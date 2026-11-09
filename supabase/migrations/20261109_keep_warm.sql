-- Keep the free (Nano) Supabase instance warm.
--
-- Why: after a few idle hours the first real requests took 25-35 s (2026-11-08)
-- and 70-88 s (2026-11-09: login failed with 504), while the same queries run in
-- 10-60 ms once warm. The free instance lets idle memory go cold; the first
-- person to open the app paid for waking it. Every 4 minutes this touches the
-- tables the app (and Auth's login/refresh) read, and pings the data API and
-- Auth through the public gateway so those services stay warm too.
-- The anon key below is the PUBLIC key already shipped in the app's JS bundle.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists keepwarm;
revoke all on schema keepwarm from public, anon, authenticated;

create or replace function keepwarm.tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform count(*) from public.residents;
  perform count(*) from public.rent_payments;
  perform count(*) from public.beds;
  perform count(*) from public.rooms;
  perform count(*) from public.admins;
  perform count(*) from public.notice_periods;
  perform count(*) from public.maintenance_requests;
  perform count(*) from public.old_dues;
  perform count(*) from public.old_due_payments;
  perform count(*) from public.electricity_readings;
  perform count(*) from auth.users;
  perform count(*) from auth.identities;
  perform count(*) from auth.sessions;
  perform count(*) from auth.refresh_tokens;
  perform net.http_get(
    url := 'https://rskbrdzbbfyyhaxucmgg.supabase.co/rest/v1/rooms?select=id&limit=1',
    headers := jsonb_build_object('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJza2JyZHpiYmZ5eWhheHVjbWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5Mzg1MzQsImV4cCI6MjA5MDUxNDUzNH0.0LTNA10XUuNltDsDc0c4q0xyVW5QFLI5WXY5RjxWXGs', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJza2JyZHpiYmZ5eWhheHVjbWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5Mzg1MzQsImV4cCI6MjA5MDUxNDUzNH0.0LTNA10XUuNltDsDc0c4q0xyVW5QFLI5WXY5RjxWXGs'),
    timeout_milliseconds := 20000);
  perform net.http_get(
    url := 'https://rskbrdzbbfyyhaxucmgg.supabase.co/auth/v1/health',
    headers := jsonb_build_object('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJza2JyZHpiYmZ5eWhheHVjbWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5Mzg1MzQsImV4cCI6MjA5MDUxNDUzNH0.0LTNA10XUuNltDsDc0c4q0xyVW5QFLI5WXY5RjxWXGs'),
    timeout_milliseconds := 20000);
end $$;
revoke all on function keepwarm.tick() from public, anon, authenticated;

select cron.unschedule('bedbox-keep-warm') where exists (select 1 from cron.job where jobname = 'bedbox-keep-warm');
select cron.schedule('bedbox-keep-warm', '*/4 * * * *', 'select keepwarm.tick()');
