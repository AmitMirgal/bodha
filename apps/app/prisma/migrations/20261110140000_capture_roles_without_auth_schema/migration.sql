-- Hosted Supabase: GRANT USAGE ON SCHEMA auth TO device / capture_register /
-- capture_janitor as postgres can report success and still leave
-- has_schema_privilege(..., 'auth', 'USAGE') = false because schema auth is
-- owned by supabase_auth_admin. Do not depend on that grant.
--
-- applyRlsContext only calls auth.uid() for authenticated / anon. Capture
-- roles verify an empty JWT subject via current_setting and use
-- public.mati_device_id() / mati_consume_pairing_code (no auth.*).
-- Retrying USAGE/EXECUTE on auth here is harmless and may help empty
-- Postgres; it is not required on hosted Supabase.

DO $$ BEGIN
  GRANT USAGE ON SCHEMA auth TO device;
EXCEPTION WHEN insufficient_privilege THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  GRANT USAGE ON SCHEMA auth TO capture_register;
EXCEPTION WHEN insufficient_privilege THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  GRANT USAGE ON SCHEMA auth TO capture_janitor;
EXCEPTION WHEN insufficient_privilege THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION auth.uid() TO device;
EXCEPTION WHEN insufficient_privilege THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION auth.uid() TO capture_register;
EXCEPTION WHEN insufficient_privilege THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION auth.uid() TO capture_janitor;
EXCEPTION WHEN insufficient_privilege THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public TO device;
GRANT USAGE ON SCHEMA public TO capture_register;
GRANT USAGE ON SCHEMA public TO capture_janitor;
GRANT EXECUTE ON FUNCTION public.mati_device_id() TO device;
GRANT EXECUTE ON FUNCTION public.mati_device_id() TO capture_register;
GRANT EXECUTE ON FUNCTION public.mati_device_id() TO capture_janitor;
GRANT EXECUTE ON FUNCTION public.mati_device_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mati_device_id() TO anon;
REVOKE ALL ON FUNCTION public.bodha_uid() FROM device, capture_register, capture_janitor;
GRANT device TO CURRENT_USER;
GRANT capture_register TO CURRENT_USER;
GRANT capture_janitor TO CURRENT_USER;
