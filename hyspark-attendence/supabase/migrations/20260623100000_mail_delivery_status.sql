-- Mail delivery status tracking: bounce and unsubscribe management

-- 1. Add delivery status columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mail_delivery_status TEXT NOT NULL DEFAULT 'active'
    CHECK (mail_delivery_status IN ('active', 'unsubscribed', 'bounced'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bounce_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_bounce_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_bounce_reason TEXT;

-- 2. Bounce logs — one row per Gmail DSN message, UNIQUE on gmail_message_id prevents double-processing
CREATE TABLE IF NOT EXISTS public.bounce_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id  TEXT        NOT NULL UNIQUE,
  email             TEXT        NOT NULL,
  profile_id        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  dsn_status        TEXT,           -- e.g. "5.1.1"
  dsn_action        TEXT,           -- e.g. "failed"
  bounce_type       TEXT        NOT NULL CHECK (bounce_type IN ('permanent', 'transient', 'unknown')),
  raw_reason        TEXT,
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bounce_logs_email          ON public.bounce_logs(email);
CREATE INDEX IF NOT EXISTS idx_bounce_logs_processed_at   ON public.bounce_logs(processed_at DESC);

ALTER TABLE public.bounce_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon manage bounce_logs" ON public.bounce_logs
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 3. Email send state — key/value store for rate-limit cooldown
CREATE TABLE IF NOT EXISTS public.email_send_state (
  key         TEXT        PRIMARY KEY,
  value       JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon manage email_send_state" ON public.email_send_state
  FOR ALL TO anon USING (true) WITH CHECK (true);
