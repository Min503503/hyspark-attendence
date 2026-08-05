-- Schedule bounce-sync every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    -- Remove previous schedule if exists (idempotent)
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hyspark-bounce-sync') THEN
      PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'hyspark-bounce-sync'));
    END IF;

    PERFORM cron.schedule(
      'hyspark-bounce-sync',
      '0 0,6,12,18 * * *',
      $job$
        SELECT net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/bounce-sync',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
          ),
          body := '{}'::jsonb
        );
      $job$
    );
  END IF;
END;
$$;
