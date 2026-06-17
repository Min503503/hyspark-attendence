-- Add 5-day session reminder rule (keep 1-day rule separate)

UPDATE public.email_automation_rules
SET
  name = '세션 리마인드 (1일 전)',
  offset_minutes = -1440,
  subject_template = '[HySpark] 내일 세션 안내',
  body_template = 'html:session_reminder_1d',
  sort_order = 2
WHERE trigger_type = 'session_before' AND offset_minutes = -1440;

INSERT INTO public.email_automation_rules (
  name, trigger_type, offset_minutes, audience, subject_template, body_template,
  require_networking, enabled, sort_order
)
SELECT
  '세션 리마인드 (5일 전)',
  'session_before',
  -7200,
  'all_members',
  '[HySpark] 5일 후 세션 안내',
  'html:session_reminder_5d',
  false,
  true,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_automation_rules
  WHERE trigger_type = 'session_before' AND offset_minutes = -7200
);

UPDATE public.email_automation_rules SET sort_order = 3 WHERE trigger_type = 'session_open';
UPDATE public.email_automation_rules SET sort_order = 4 WHERE trigger_type = 'checkin_complete';
