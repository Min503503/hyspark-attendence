-- 캠프 설문: 연속 구간 대신 시간대(1시간 블록) 다중 선택

ALTER TABLE public.camp_daily_responses
  ADD COLUMN IF NOT EXISTS time_slots text[] DEFAULT NULL;

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
      'attended', v_resp.attended,
      'from_time', to_char(v_resp.from_time, 'HH24:MI'),
      'to_time', to_char(v_resp.to_time, 'HH24:MI'),
      'time_slots', COALESCE(
        to_jsonb(v_resp.time_slots),
        '[]'::jsonb
      ),
      'duration_minutes', v_resp.duration_minutes,
      'demerit_credit', v_resp.demerit_credit,
      'submitted_at', v_resp.submitted_at
    ) END
  );
END;
$$;

DROP FUNCTION IF EXISTS public.submit_camp_daily_response(uuid, text, text, boolean);

CREATE OR REPLACE FUNCTION public.submit_camp_daily_response(
  p_profile_id uuid,
  p_from_time text,
  p_to_time text,
  p_attended boolean DEFAULT true,
  p_time_slots text[] DEFAULT NULL
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
  v_slot text;
  v_slot_time time;
  v_sorted text[];
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

  IF NOT COALESCE(p_attended, true) THEN
    v_from := v_camp.daily_open_time;
    v_to := v_camp.daily_open_time;
    v_duration := 0;
    v_credit := 0;
    v_sorted := NULL;
  ELSIF p_time_slots IS NOT NULL AND cardinality(p_time_slots) > 0 THEN
    SELECT array_agg(slot ORDER BY slot::time)
    INTO v_sorted
    FROM unnest(p_time_slots) AS slot;

    FOREACH v_slot IN ARRAY v_sorted LOOP
      BEGIN
        v_slot_time := v_slot::time;
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', '시간 형식이 올바르지 않습니다.');
      END;

      IF v_slot_time < v_camp.daily_open_time
        OR v_slot_time >= v_camp.daily_close_time
        OR date_part('minute', v_slot_time) <> 0 THEN
        RETURN jsonb_build_object('success', false, 'message', '캠프 운영 시간(정각)만 선택할 수 있습니다.');
      END IF;
    END LOOP;

    v_from := v_sorted[1]::time;
    v_to := (v_sorted[cardinality(v_sorted)]::time + interval '1 hour')::time;
    v_duration := cardinality(v_sorted) * 60;
    v_credit := public.hyspark_camp_demerit_credit(v_duration);
  ELSE
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
    v_sorted := NULL;
  END IF;

  INSERT INTO public.camp_daily_responses (
    camp_id, profile_id, response_date, from_time, to_time, time_slots,
    duration_minutes, demerit_credit, attended, submitted_at
  ) VALUES (
    v_camp.id, p_profile_id, v_today, v_from, v_to, v_sorted,
    v_duration, v_credit, COALESCE(p_attended, true), now()
  )
  ON CONFLICT (profile_id, response_date) DO UPDATE SET
    camp_id = EXCLUDED.camp_id,
    from_time = EXCLUDED.from_time,
    to_time = EXCLUDED.to_time,
    time_slots = EXCLUDED.time_slots,
    duration_minutes = EXCLUDED.duration_minutes,
    demerit_credit = EXCLUDED.demerit_credit,
    attended = EXCLUDED.attended,
    submitted_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE WHEN v_row.attended THEN '오늘 참여 시간이 저장되었습니다.' ELSE '오늘 출석 안 함으로 기록되었습니다.' END,
    'response', jsonb_build_object(
      'id', v_row.id,
      'attended', v_row.attended,
      'from_time', to_char(v_row.from_time, 'HH24:MI'),
      'to_time', to_char(v_row.to_time, 'HH24:MI'),
      'time_slots', COALESCE(to_jsonb(v_row.time_slots), '[]'::jsonb),
      'duration_minutes', v_row.duration_minutes,
      'demerit_credit', v_row.demerit_credit,
      'submitted_at', v_row.submitted_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_camp_daily_response(uuid, text, text, boolean, text[]) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_member_camp_responses(uuid);

CREATE OR REPLACE FUNCTION public.get_member_camp_responses(p_profile_id uuid)
RETURNS TABLE (
  id uuid,
  response_date date,
  attended boolean,
  from_time time,
  to_time time,
  time_slots text[],
  duration_minutes integer,
  demerit_credit numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.response_date, r.attended, r.from_time, r.to_time, r.time_slots, r.duration_minutes, r.demerit_credit
  FROM public.camp_daily_responses r
  WHERE r.profile_id = p_profile_id
  ORDER BY r.response_date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_camp_responses(uuid) TO anon, authenticated;
