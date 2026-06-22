-- Member portal magic links: one reusable token per profile (no expiry)

CREATE TABLE IF NOT EXISTS public.member_portal_tokens (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_portal_tokens_token ON public.member_portal_tokens(token);

ALTER TABLE public.member_portal_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.member_portal_tokens FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_member_portal_token(p_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  SELECT token INTO v_token
  FROM public.member_portal_tokens
  WHERE profile_id = p_profile_id;

  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  INSERT INTO public.member_portal_tokens (profile_id)
  VALUES (p_profile_id)
  ON CONFLICT (profile_id) DO NOTHING
  RETURNING token INTO v_token;

  IF v_token IS NULL THEN
    SELECT token INTO v_token
    FROM public.member_portal_tokens
    WHERE profile_id = p_profile_id;
  END IF;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_member_portal_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF p_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'invalid token');
  END IF;

  SELECT p.* INTO v_profile
  FROM public.member_portal_tokens t
  JOIN public.profiles p ON p.id = t.profile_id
  WHERE t.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'invalid token');
  END IF;

  IF v_profile.role <> 'member' OR v_profile.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'member inactive');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'profile_id', v_profile.id,
    'full_name', v_profile.full_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_member_portal_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_member_portal_token(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.resolve_member_portal_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_member_portal_token(uuid) TO anon, authenticated, service_role;
