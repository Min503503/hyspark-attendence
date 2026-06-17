
-- Allow anon to insert, update, delete profiles (no auth used in this app)
CREATE POLICY "Anon can insert profiles"
ON public.profiles
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can update profiles"
ON public.profiles
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can delete profiles"
ON public.profiles
FOR DELETE
TO anon
USING (true);

-- Allow anon to insert, update, delete sessions
CREATE POLICY "Anon can insert sessions"
ON public.sessions
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can update sessions"
ON public.sessions
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can delete sessions"
ON public.sessions
FOR DELETE
TO anon
USING (true);

-- Allow anon to update, delete attendance_records
CREATE POLICY "Anon can update attendance_records"
ON public.attendance_records
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can delete attendance_records"
ON public.attendance_records
FOR DELETE
TO anon
USING (true);
