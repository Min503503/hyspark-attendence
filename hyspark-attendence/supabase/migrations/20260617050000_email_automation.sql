-- Email automation rules and send logs

CREATE TABLE IF NOT EXISTS public.email_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('session_before', 'session_open', 'networking_before')),
  offset_minutes INTEGER NOT NULL DEFAULT 0,
  audience TEXT NOT NULL DEFAULT 'all_members' CHECK (audience IN ('all_members', 'staff')),
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  require_networking BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.email_automation_rules(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  message_id TEXT,
  error_message TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_send_logs_sent_at ON public.email_send_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_automation_rules_enabled ON public.email_automation_rules(enabled, sort_order);

ALTER TABLE public.email_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read email_automation_rules" ON public.email_automation_rules FOR SELECT TO anon USING (true);
CREATE POLICY "Anon manage email_automation_rules" ON public.email_automation_rules FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon read email_send_logs" ON public.email_send_logs FOR SELECT TO anon USING (true);
