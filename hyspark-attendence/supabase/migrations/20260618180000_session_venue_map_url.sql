ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS venue_map_url TEXT;
