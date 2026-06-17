-- Automation run history (visible in admin console)
CREATE TABLE IF NOT EXISTS public.email_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened INTEGER NOT NULL DEFAULT 0,
  closed INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  rules_checked INTEGER NOT NULL DEFAULT 0,
  trigger_source TEXT NOT NULL DEFAULT 'auto_open_sessions',
  error_message TEXT,
  raw_response JSONB
);

CREATE INDEX IF NOT EXISTS idx_email_automation_runs_checked_at
  ON public.email_automation_runs(checked_at DESC);

ALTER TABLE public.email_automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon read email_automation_runs" ON public.email_automation_runs;
CREATE POLICY "Anon read email_automation_runs"
  ON public.email_automation_runs FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon insert email_automation_runs" ON public.email_automation_runs;
CREATE POLICY "Anon insert email_automation_runs"
  ON public.email_automation_runs FOR INSERT TO anon WITH CHECK (true);

-- pg_cron + pg_net: invoke auto-open-sessions every 10 min (+ Monday 10:00 KST safety pass)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_auto_open_sessions_edge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lwbjprzrnmlnmzlxiwrv.supabase.co/functions/v1/auto-open-sessions',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
END;
$$;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hyspark-auto-open-10m') THEN
      PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'hyspark-auto-open-10m'));
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hyspark-monday-10am-kst') THEN
      PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'hyspark-monday-10am-kst'));
    END IF;

    PERFORM cron.schedule(
      'hyspark-auto-open-10m',
      '*/10 * * * *',
      $$ SELECT public.invoke_auto_open_sessions_edge(); $$
    );

    -- Monday 01:00 UTC = Monday 10:00 KST (5일 전 리마인드 보강)
    PERFORM cron.schedule(
      'hyspark-monday-10am-kst',
      '0 1 * * 1',
      $$ SELECT public.invoke_auto_open_sessions_edge(); $$
    );
  END IF;
END;
$cron$;
