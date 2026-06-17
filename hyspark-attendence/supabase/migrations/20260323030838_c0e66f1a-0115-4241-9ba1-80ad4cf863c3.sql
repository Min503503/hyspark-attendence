
-- 1. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'staff', 'member')),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  member_code TEXT UNIQUE,
  cohort_label TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can read profiles for login"
  ON public.profiles FOR SELECT
  TO anon
  USING (true);

-- 2. Cohorts table
CREATE TABLE public.cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  season_label TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cohorts"
  ON public.cohorts FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can manage cohorts"
  ON public.cohorts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  venue_name TEXT,
  venue_lat NUMERIC(10,7),
  venue_lng NUMERIC(10,7),
  geofence_radius_m INTEGER NOT NULL DEFAULT 100,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  check_in_open_minutes INTEGER NOT NULL DEFAULT 10,
  attendance_deadline_minutes INTEGER NOT NULL DEFAULT 5,
  late_deadline_minutes INTEGER NOT NULL DEFAULT 30,
  session_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  attendance_code TEXT,
  attendance_code_status TEXT NOT NULL DEFAULT 'inactive' CHECK (attendance_code_status IN ('inactive', 'active', 'expired')),
  attendance_code_issued_at TIMESTAMPTZ,
  attendance_code_expires_at TIMESTAMPTZ,
  qr_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'open', 'closed', 'archived')),
  attendance_rate NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sessions"
  ON public.sessions FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can manage sessions"
  ON public.sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Attendance records table
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused_absent', 'unexcused_absent')),
  checked_in_at TIMESTAMPTZ,
  check_in_method TEXT NOT NULL DEFAULT 'code' CHECK (check_in_method IN ('qr', 'code', 'manual')),
  code_verified BOOLEAN NOT NULL DEFAULT false,
  location_verified BOOLEAN NOT NULL DEFAULT false,
  check_in_lat NUMERIC(10,7),
  check_in_lng NUMERIC(10,7),
  demerit_points NUMERIC(4,1) NOT NULL DEFAULT 0,
  exception_category TEXT,
  exception_note TEXT,
  override_reason TEXT,
  override_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, member_id)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read attendance_records"
  ON public.attendance_records FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can manage attendance_records"
  ON public.attendance_records FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can insert attendance_records for check-in"
  ON public.attendance_records FOR INSERT
  TO anon
  WITH CHECK (true);

-- 5. Indexes
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_sessions_start_at ON public.sessions(start_at);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_attendance_session_id ON public.attendance_records(session_id);
CREATE INDEX idx_attendance_member_id ON public.attendance_records(member_id);
CREATE INDEX idx_attendance_status ON public.attendance_records(status);

-- 6. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
