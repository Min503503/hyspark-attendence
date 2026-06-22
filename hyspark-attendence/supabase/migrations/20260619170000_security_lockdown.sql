-- HySpark security lockdown: revoke open anon writes, add RPC + admin sessions

-- 1) Admin session tokens (service role only — no RLS policies for anon)
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON public.admin_sessions(expires_at);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_sessions FROM anon, authenticated;

-- 2) Drop permissive anon write policies
DROP POLICY IF EXISTS "Anon can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anon can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anon can delete profiles" ON public.profiles;

DROP POLICY IF EXISTS "Anon can insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anon can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anon can delete sessions" ON public.sessions;

DROP POLICY IF EXISTS "Anon can update attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Anon can delete attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Anon can insert attendance_records for check-in" ON public.attendance_records;

DROP POLICY IF EXISTS "Anon manage email_automation_rules" ON public.email_automation_rules;
DROP POLICY IF EXISTS "Anon insert email_automation_runs" ON public.email_automation_runs;

-- Keep anon SELECT for member login / app reads
-- email_automation_rules: read-only for admin UI until admin-api sync
DROP POLICY IF EXISTS "Anon read email_automation_rules" ON public.email_automation_rules;
CREATE POLICY "Anon read email_automation_rules"
  ON public.email_automation_rules FOR SELECT TO anon USING (true);

-- 3) Helper: demerit points (matches src/types PENALTY_POLICY)
CREATE OR REPLACE FUNCTION public.hyspark_demerit_points(p_status text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_status = 'late' THEN 0.5
    WHEN p_status IN ('absent', 'unexcused_absent') THEN 1.0
    ELSE 0
  END;
$$;

-- 4) Member: check-in with server-side validation
CREATE OR REPLACE FUNCTION public.member_check_in(
  p_session_id uuid,
  p_member_id uuid,
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.sessions%ROWTYPE;
  v_member public.profiles%ROWTYPE;
  v_existing public.attendance_records%ROWTYPE;
  v_now timestamptz := now();
  v_start_ms bigint;
  v_status text;
  v_demerit numeric;
  v_record_id uuid;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '세션을 찾을 수 없습니다.');
  END IF;

  IF v_session.status <> 'open' OR v_session.attendance_code_status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', '운영진이 현장 출결을 열면 체크인할 수 있습니다.');
  END IF;

  IF v_session.attendance_code IS DISTINCT FROM p_code THEN
    RETURN jsonb_build_object('success', false, 'message', '출결코드가 일치하지 않습니다.');
  END IF;

  SELECT * INTO v_member
  FROM public.profiles
  WHERE id = p_member_id AND role = 'member' AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않은 학회원입니다.');
  END IF;

  SELECT * INTO v_existing
  FROM public.attendance_records
  WHERE session_id = p_session_id AND member_id = p_member_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', v_existing.status,
      'message', '이미 체크인 완료',
      'existing', true,
      'record_id', v_existing.id
    );
  END IF;

  v_start_ms := extract(epoch FROM v_session.start_at)::bigint * 1000;

  IF extract(epoch FROM v_now)::bigint * 1000 < v_start_ms + v_session.attendance_deadline_minutes * 60000 THEN
    v_status := 'present';
  ELSIF extract(epoch FROM v_now)::bigint * 1000 < v_start_ms + v_session.late_deadline_minutes * 60000 THEN
    v_status := 'late';
  ELSE
    v_status := 'unexcused_absent';
  END IF;

  v_demerit := public.hyspark_demerit_points(v_status);

  INSERT INTO public.attendance_records (
    session_id, member_id, member_name, status, checked_in_at,
    check_in_method, code_verified, location_verified, demerit_points
  ) VALUES (
    p_session_id, p_member_id, v_member.full_name, v_status, v_now,
    'code', true, true, v_demerit
  )
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'message', CASE
      WHEN v_status = 'present' THEN '출석 완료!'
      WHEN v_status = 'late' THEN '지각 처리되었습니다.'
      ELSE '결석 처리되었습니다.'
    END,
    'existing', false,
    'record_id', v_record_id,
    'checked_in_at', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.member_check_in(uuid, uuid, text) TO anon, authenticated;

-- 5) Member: absence request
CREATE OR REPLACE FUNCTION public.member_submit_absence(
  p_session_id uuid,
  p_member_id uuid,
  p_status text,
  p_category text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.profiles%ROWTYPE;
  v_existing public.attendance_records%ROWTYPE;
  v_demerit numeric;
BEGIN
  IF p_status NOT IN ('excused_absent', 'unexcused_absent') THEN
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않은 결석 유형입니다.');
  END IF;

  SELECT * INTO v_member
  FROM public.profiles
  WHERE id = p_member_id AND role = 'member' AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '유효하지 않은 학회원입니다.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE id = p_session_id) THEN
    RETURN jsonb_build_object('success', false, 'message', '세션을 찾을 수 없습니다.');
  END IF;

  SELECT * INTO v_existing
  FROM public.attendance_records
  WHERE session_id = p_session_id AND member_id = p_member_id;

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', '이미 출결 기록이 있습니다.');
  END IF;

  v_demerit := public.hyspark_demerit_points(p_status);

  INSERT INTO public.attendance_records (
    session_id, member_id, member_name, status, checked_in_at,
    check_in_method, code_verified, location_verified, demerit_points,
    exception_category, exception_note
  ) VALUES (
    p_session_id, p_member_id, v_member.full_name, p_status, now(),
    'manual', false, false, v_demerit,
    p_category, p_note
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.member_submit_absence(uuid, uuid, text, text, text) TO anon, authenticated;

-- 6) Open due sessions (member fetch fallback; cron uses Edge Function)
CREATE OR REPLACE FUNCTION public.maybe_open_due_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.sessions%ROWTYPE;
  v_now timestamptz := now();
  v_opened integer := 0;
  v_code text;
  v_expires timestamptz;
BEGIN
  FOR v_session IN
    SELECT * FROM public.sessions WHERE status = 'scheduled'
  LOOP
    IF v_now >= (v_session.start_at - (v_session.check_in_open_minutes || ' minutes')::interval) THEN
      v_code := coalesce(v_session.attendance_code, lpad(floor(random() * 90000 + 10000)::text, 5, '0'));
      v_expires := v_session.start_at + (v_session.late_deadline_minutes || ' minutes')::interval;

      UPDATE public.sessions SET
        status = 'open',
        attendance_code = v_code,
        attendance_code_status = 'active',
        attendance_code_issued_at = v_now,
        attendance_code_expires_at = v_expires
      WHERE id = v_session.id;

      v_opened := v_opened + 1;
    END IF;
  END LOOP;

  RETURN v_opened;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maybe_open_due_sessions() TO anon, authenticated;

-- 7) Lock down SECURITY DEFINER cron RPC from public API
REVOKE EXECUTE ON FUNCTION public.invoke_auto_open_sessions_edge() FROM PUBLIC, anon, authenticated;

-- 8) Cron → Edge with shared secret (must match Edge Function CRON_SECRET)
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.internal_auth (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  cron_secret text NOT NULL
);

INSERT INTO private.internal_auth (id, cron_secret)
VALUES (true, encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.internal_auth FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.invoke_auto_open_sessions_edge()
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
    url := 'https://lwbjprzrnmlnmzlxiwrv.supabase.co/functions/v1/auto-open-sessions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_auto_open_sessions_edge() FROM PUBLIC, anon, authenticated;

-- service_role / postgres only (pg_cron runs as postgres)
GRANT EXECUTE ON FUNCTION public.invoke_auto_open_sessions_edge() TO postgres, service_role;
