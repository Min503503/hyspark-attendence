-- 캠프 시간대: 30분 단위 슬롯 허용

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
        OR (extract(minute FROM v_slot_time)::integer NOT IN (0, 30)) THEN
        RETURN jsonb_build_object('success', false, 'message', '캠프 운영 시간(30분 단위)만 선택할 수 있습니다.');
      END IF;
    END LOOP;

    v_from := v_sorted[1]::time;
    v_to := (v_sorted[cardinality(v_sorted)]::time + interval '30 minutes')::time;
    v_duration := cardinality(v_sorted) * 30;
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
