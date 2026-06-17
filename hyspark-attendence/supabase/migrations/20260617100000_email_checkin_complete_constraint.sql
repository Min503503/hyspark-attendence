-- Ensure checkin_complete is allowed (remote DB may still have pre-v2 constraint)

ALTER TABLE public.email_automation_rules
  DROP CONSTRAINT IF EXISTS email_automation_rules_trigger_type_check;

ALTER TABLE public.email_automation_rules
  ADD CONSTRAINT email_automation_rules_trigger_type_check
  CHECK (trigger_type IN ('session_before', 'session_open', 'checkin_complete'));

INSERT INTO public.email_automation_rules (
  name, trigger_type, offset_minutes, audience, subject_template, body_template,
  require_networking, enabled, sort_order
)
SELECT
  '출석 완료', 'checkin_complete', 0, 'all_members',
  '[HySpark] 출석 완료 — {세션제목}', 'html:checkin_complete',
  false, true, 4
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_automation_rules WHERE trigger_type = 'checkin_complete'
);
