-- Mini Startup Camp: daily participation survey + demerit offset

CREATE TABLE IF NOT EXISTS public.camp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_open_time TIME NOT NULL DEFAULT '10:00',
  daily_close_time TIME NOT NULL DEFAULT '22:00',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT camp_settings_date_range CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.camp_daily_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES public.camp_settings(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response_date DATE NOT NULL,
  from_time TIME NOT NULL,
  to_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  demerit_credit NUMERIC(4, 2) NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, response_date)
);

CREATE INDEX IF NOT EXISTS idx_camp_daily_responses_date
  ON public.camp_daily_responses(response_date DESC);

CREATE INDEX IF NOT EXISTS idx_camp_daily_responses_profile
  ON public.camp_daily_responses(profile_id);

ALTER TABLE public.camp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_daily_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon read camp_settings" ON public.camp_settings;
CREATE POLICY "Anon read camp_settings"
  ON public.camp_settings FOR SELECT TO anon USING (true);

-- Responses: no anon access (RPC + admin-api only)

CREATE OR REPLACE FUNCTION public.hyspark_camp_demerit_credit(p_duration_minutes integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (floor(greatest(p_duration_minutes, 0)::numeric / 300) * 0.25)::numeric(4, 2);
$$;

CREATE OR REPLACE FUNCTION public.hyspark_kst_date(p_ts timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (p_ts AT TIME ZONE 'Asia/Seoul')::date;
$$;

CREATE OR REPLACE FUNCTION public.get_active_camp_settings()
RETURNS public.camp_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.camp_settings
  WHERE enabled = true
  ORDER BY start_date DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_camp_settings() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_camp_survey_context(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_camp public.camp_settings%ROWTYPE;
  v_today date := public.hyspark_kst_date();
  v_resp public.camp_daily_responses%ROWTYPE;
BEGIN
  SELECT * INTO v_camp FROM public.get_active_camp_settings();
  IF NOT FOUND OR v_today < v_camp.start_date OR v_today > v_camp.end_date THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  SELECT * INTO v_resp
  FROM public.camp_daily_responses
  WHERE profile_id = p_profile_id AND response_date = v_today;

  RETURN jsonb_build_object(
    'active', true,
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'title', v_camp.title,
      'start_date', v_camp.start_date,
      'end_date', v_camp.end_date,
      'daily_open_time', to_char(v_camp.daily_open_time, 'HH24:MI'),
      'daily_close_time', to_char(v_camp.daily_close_time, 'HH24:MI'),
      'enabled', v_camp.enabled
    ),
    'today', CASE WHEN v_resp.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_resp.id,
      'from_time', to_char(v_resp.from_time, 'HH24:MI'),
      'to_time', to_char(v_resp.to_time, 'HH24:MI'),
      'duration_minutes', v_resp.duration_minutes,
      'demerit_credit', v_resp.demerit_credit,
      'submitted_at', v_resp.submitted_at
    ) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_camp_survey_context(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_camp_daily_response(
  p_profile_id uuid,
  p_from_time text,
  p_to_time text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_camp public.camp_settings%ROWTYPE;
  v_member public.profiles%ROWTYPE;
  v_today date := public.hyspark_kst_date();
  v_from time;
  v_to time;
  v_duration integer;
  v_credit numeric(4, 2);
  v_row public.camp_daily_responses%ROWTYPE;
BEGIN
  SELECT * INTO v_camp FROM public.get_active_camp_settings();
  IF NOT FOUND OR NOT v_camp.enabled THEN
    RETURN jsonb_build_object('success', false, 'message', '진행 중인 캠프가 없습니다.');
  END IF;

  IF v_today < v_camp.start_date OR v_today > v_camp.end_date THEN
    RETURN jsonb_build_object('success', false, 'message', '캠프 기간이 아닙니다.');
  END IF;

  SELECT * INTO v_member
  FROM public.profiles
  WHERE id = p_profile_id AND role = 'member' AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않은 학회원입니다.');
  END IF;

  BEGIN
    v_from := p_from_time::time;
    v_to := p_to_time::time;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', '시간 형식이 올바르지 않습니다.');
  END;

  IF v_from < v_camp.daily_open_time OR v_to > v_camp.daily_close_time THEN
    RETURN jsonb_build_object('success', false, 'message', '캠프 운영 시간 내에서만 입력할 수 있습니다.');
  END IF;

  IF v_to <= v_from THEN
    RETURN jsonb_build_object('success', false, 'message', '종료 시각은 시작 시각보다 늦어야 합니다.');
  END IF;

  v_duration := (extract(epoch FROM (v_to - v_from)) / 60)::integer;
  v_credit := public.hyspark_camp_demerit_credit(v_duration);

  INSERT INTO public.camp_daily_responses (
    camp_id, profile_id, response_date, from_time, to_time,
    duration_minutes, demerit_credit, submitted_at
  ) VALUES (
    v_camp.id, p_profile_id, v_today, v_from, v_to,
    v_duration, v_credit, now()
  )
  ON CONFLICT (profile_id, response_date) DO UPDATE SET
    camp_id = EXCLUDED.camp_id,
    from_time = EXCLUDED.from_time,
    to_time = EXCLUDED.to_time,
    duration_minutes = EXCLUDED.duration_minutes,
    demerit_credit = EXCLUDED.demerit_credit,
    submitted_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'success', true,
    'message', '오늘 참여 시간이 저장되었습니다.',
    'response', jsonb_build_object(
      'id', v_row.id,
      'from_time', to_char(v_row.from_time, 'HH24:MI'),
      'to_time', to_char(v_row.to_time, 'HH24:MI'),
      'duration_minutes', v_row.duration_minutes,
      'demerit_credit', v_row.demerit_credit,
      'submitted_at', v_row.submitted_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_camp_daily_response(uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_member_camp_responses(p_profile_id uuid)
RETURNS TABLE (
  id uuid,
  response_date date,
  from_time time,
  to_time time,
  duration_minutes integer,
  demerit_credit numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.response_date, r.from_time, r.to_time, r.duration_minutes, r.demerit_credit
  FROM public.camp_daily_responses r
  WHERE r.profile_id = p_profile_id
  ORDER BY r.response_date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_camp_responses(uuid) TO anon, authenticated;

-- Seed: 미니 스타트업 캠프 2026-06-22 ~ 2026-06-26
INSERT INTO public.camp_settings (
  title, start_date, end_date, daily_open_time, daily_close_time, enabled
)
SELECT
  '미니 스타트업 캠프',
  '2026-06-22'::date,
  '2026-06-26'::date,
  '10:00'::time,
  '22:00'::time,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.camp_settings);

-- Cron: 22:00 KST daily → send-camp-survey-reminder Edge Function (x-cron-secret)
CREATE OR REPLACE FUNCTION public.invoke_camp_survey_reminder_edge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT cron_secret INTO v_secret FROM private.internal_auth WHERE id = true;

  PERFORM net.http_post(
    url := 'https://lwbjprzrnmlnmzlxiwrv.supabase.co/functions/v1/send-camp-survey-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_camp_survey_reminder_edge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_camp_survey_reminder_edge() TO postgres, service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hyspark-camp-survey-22kst') THEN
      PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'hyspark-camp-survey-22kst'));
    END IF;

    -- UTC 13:00 = KST 22:00
    PERFORM cron.schedule(
      'hyspark-camp-survey-22kst',
      '0 13 * * *',
      $$ SELECT public.invoke_camp_survey_reminder_edge(); $$
    );
  END IF;
END;
$cron$;
