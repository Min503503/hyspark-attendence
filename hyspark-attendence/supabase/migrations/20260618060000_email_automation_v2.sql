-- Email automation v2: 3 fixed triggers only (reminder, open, checkin)

ALTER TABLE public.email_automation_rules
  DROP CONSTRAINT IF EXISTS email_automation_rules_trigger_type_check;

ALTER TABLE public.email_automation_rules
  ADD CONSTRAINT email_automation_rules_trigger_type_check
  CHECK (trigger_type IN ('session_before', 'session_open', 'checkin_complete'));

DELETE FROM public.email_automation_rules
WHERE trigger_type = 'networking_before';

INSERT INTO public.email_automation_rules (
  name, trigger_type, offset_minutes, audience, subject_template, body_template,
  require_networking, enabled, sort_order
)
SELECT * FROM (VALUES
  ('세션 리마인드 (24시간 전)', 'session_before', -1440, 'all_members', '[HySpark] 내일 세션 안내', 'html:session_reminder', false, true, 1),
  ('출석 오픈 알림', 'session_open', 0, 'all_members', '[HySpark] 출석이 시작됐어요', 'html:session_open', false, true, 2),
  ('출석 완료 메일', 'checkin_complete', 0, 'all_members', '[HySpark] 출석 완료', 'html:checkin_complete', false, true, 3)
) AS v(name, trigger_type, offset_minutes, audience, subject_template, body_template, require_networking, enabled, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_automation_rules r WHERE r.trigger_type = v.trigger_type
);
