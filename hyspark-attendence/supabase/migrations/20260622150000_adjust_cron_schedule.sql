-- Reschedule Monday KST cron to 10:05 KST to prevent concurrent conflict with 10-minute interval cron

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    -- Unschedule existing job if exists
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hyspark-monday-10am-kst') THEN
      PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'hyspark-monday-10am-kst'));
    END IF;

    -- Reschedule to Monday 10:05 KST (01:05 UTC)
    PERFORM cron.schedule(
      'hyspark-monday-10am-kst',
      '5 1 * * 1',
      $job$ SELECT public.invoke_auto_open_sessions_edge(); $job$
    );
  END IF;
END;
$$;
