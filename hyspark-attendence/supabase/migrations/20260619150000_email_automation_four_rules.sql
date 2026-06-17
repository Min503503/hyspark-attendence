-- Standard 4 email automation rules (5d / 1d / open / checkin complete)

DELETE FROM public.email_automation_rules WHERE trigger_type = 'networking_before';

INSERT INTO public.email_automation_rules (
  name, trigger_type, offset_minutes, audience, subject_template, body_template,
  require_networking, enabled, sort_order, updated_at
)
SELECT v.name, v.trigger_type, v.offset_minutes, v.audience, v.subject_template, v.body_template,
  false, true, v.sort_order, now()
FROM (VALUES
  ('5일 전 리마인드', 'session_before', -7200, 'all_members', '[HySpark] 5일 후 세션 안내 — {세션제목}', 'html:session_reminder_5d', 1),
  ('1일 전 리마인드', 'session_before', -1440, 'all_members', '[HySpark] 내일 세션 안내 — {세션제목}', 'html:session_reminder_1d', 2),
  ('출석 오픈', 'session_open', 0, 'all_members', '[HySpark] 지금 출석체크 — {세션제목}', 'html:session_open', 3),
  ('출석 완료', 'checkin_complete', 0, 'all_members', '[HySpark] 출석 완료 — {세션제목}', 'html:checkin_complete', 4)
) AS v(name, trigger_type, offset_minutes, audience, subject_template, body_template, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_automation_rules r
  WHERE r.trigger_type = v.trigger_type
    AND (v.trigger_type <> 'session_before' OR r.offset_minutes = v.offset_minutes)
);

UPDATE public.email_automation_rules SET
  name = '5일 전 리마인드',
  subject_template = '[HySpark] 5일 후 세션 안내 — {세션제목}',
  body_template = 'html:session_reminder_5d',
  sort_order = 1,
  enabled = true,
  updated_at = now()
WHERE trigger_type = 'session_before' AND offset_minutes = -7200;

UPDATE public.email_automation_rules SET
  name = '1일 전 리마인드',
  subject_template = '[HySpark] 내일 세션 안내 — {세션제목}',
  body_template = 'html:session_reminder_1d',
  sort_order = 2,
  enabled = true,
  updated_at = now()
WHERE trigger_type = 'session_before' AND offset_minutes = -1440;

UPDATE public.email_automation_rules SET
  name = '출석 오픈',
  subject_template = '[HySpark] 지금 출석체크 — {세션제목}',
  body_template = 'html:session_open',
  sort_order = 3,
  enabled = true,
  updated_at = now()
WHERE trigger_type = 'session_open';

UPDATE public.email_automation_rules SET
  name = '출석 완료',
  subject_template = '[HySpark] 출석 완료 — {세션제목}',
  body_template = 'html:checkin_complete',
  sort_order = 4,
  enabled = true,
  updated_at = now()
WHERE trigger_type = 'checkin_complete';
