-- Repair an EXISTING production-like Supabase database that already has
-- product tables (possibly without FORCE RLS, without roles device /
-- capture_register / capture_janitor, and with or without the capture
-- tables). Idempotent. Does not DROP tables or rewrite user rows.
--
-- Production path:
--   prisma migrate resolve --applied 20261110120000_init
--   prisma migrate deploy
--
-- Works whether capture tables exist (empty) or were dropped.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" TEXT NOT NULL,
    "claimed_user_id" UUID,
    "consent" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cursor_admin_settings" (
    "user_id" UUID NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "encryption_iv" TEXT NOT NULL,
    "encryption_tag" TEXT NOT NULL,
    "key_fingerprint" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "cursor_admin_settings_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE IF NOT EXISTS "pairing_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "pairing_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "capture_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "user_id" UUID,
    "editor" TEXT NOT NULL,
    "editor_task_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "finished_at" TIMESTAMPTZ(6),
    "workspace_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "capture_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "capture_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "user_id" UUID,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "capture_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "capture_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "user_id" UUID,
    "operation_id" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "input_tokens" BIGINT,
    "output_tokens" BIGINT,
    "cached_tokens" BIGINT,
    "reasoning_tokens" BIGINT,
    "model" TEXT,
    "native" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "capture_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "devices_token_hash_key" ON "devices"("token_hash");
CREATE INDEX IF NOT EXISTS "devices_unclaimed_created_idx" ON "devices"("created_at");
CREATE INDEX IF NOT EXISTS "pairing_codes_hash_idx" ON "pairing_codes"("code_hash");
CREATE INDEX IF NOT EXISTS "capture_tasks_device_idx" ON "capture_tasks"("device_id", "started_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "capture_tasks_device_id_editor_editor_task_id_key" ON "capture_tasks"("device_id", "editor", "editor_task_id");
CREATE INDEX IF NOT EXISTS "capture_events_task_idx" ON "capture_events"("task_id", "occurred_at");
CREATE UNIQUE INDEX IF NOT EXISTS "capture_events_device_id_idempotency_key_key" ON "capture_events"("device_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "capture_usage_task_idx" ON "capture_usage"("task_id");
CREATE UNIQUE INDEX IF NOT EXISTS "capture_usage_task_id_operation_id_key" ON "capture_usage"("task_id", "operation_id");

DO $$ BEGIN
  ALTER TABLE "devices" ADD CONSTRAINT "devices_claimed_user_id_fkey" FOREIGN KEY ("claimed_user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cursor_admin_settings" ADD CONSTRAINT "cursor_admin_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "capture_tasks" ADD CONSTRAINT "capture_tasks_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "capture_tasks" ADD CONSTRAINT "capture_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "capture_events" ADD CONSTRAINT "capture_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "capture_events" ADD CONSTRAINT "capture_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "capture_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "capture_events" ADD CONSTRAINT "capture_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "capture_usage" ADD CONSTRAINT "capture_usage_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "capture_usage" ADD CONSTRAINT "capture_usage_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "capture_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "capture_usage" ADD CONSTRAINT "capture_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
END $$;

-- Roles, FORCE RLS, policies, grants, checks, view, and functions.
-- Prisma schema cannot express these. This overlay is idempotent so it can
-- run on an empty database (after tables exist) and on an existing Supabase
-- database whose tables were created outside Prisma Migrate.

-- ---------------------------------------------------------------------------
-- Auth stub for empty Postgres / PGlite. No-op on hosted Supabase.
-- Never overwrite auth.uid() when it already exists.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text
    );
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid' AND p.pronargs = 0
  ) THEN
    CREATE SCHEMA IF NOT EXISTS auth;
    EXECUTE $fn$
      CREATE FUNCTION auth.uid()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $uid$
        SELECT coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          nullif(current_setting('request.jwt.claims', true), '')::json->>'sub'
        )::uuid
      $uid$
    $fn$;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Roles. authenticated/anon already exist on Supabase; do not ALTER them.
-- Product roles are NOLOGIN / NOSUPERUSER / NOBYPASSRLS.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE device NOLOGIN NOSUPERUSER NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN
  ALTER ROLE device NOLOGIN NOSUPERUSER NOBYPASSRLS;
END $$;
DO $$ BEGIN
  CREATE ROLE capture_register NOLOGIN NOSUPERUSER NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN
  ALTER ROLE capture_register NOLOGIN NOSUPERUSER NOBYPASSRLS;
END $$;
DO $$ BEGIN
  CREATE ROLE capture_janitor NOLOGIN NOSUPERUSER NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN
  ALTER ROLE capture_janitor NOLOGIN NOSUPERUSER NOBYPASSRLS;
END $$;

GRANT authenticated TO CURRENT_USER;
GRANT anon TO CURRENT_USER;
GRANT device TO CURRENT_USER;
GRANT capture_register TO CURRENT_USER;
GRANT capture_janitor TO CURRENT_USER;

GRANT USAGE ON SCHEMA public TO authenticated, anon, device, capture_register, capture_janitor;

DO $$ BEGIN
  GRANT USAGE ON SCHEMA auth TO authenticated, anon, device, capture_register, capture_janitor;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon, device, capture_register, capture_janitor;
EXCEPTION WHEN undefined_function THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bodha_uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mati_device_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(
    coalesce(
      nullif(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::json->>'device_id',
    ''
  )::uuid
$$;

REVOKE ALL ON FUNCTION public.mati_device_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mati_device_id() TO device, authenticated, capture_register, anon, capture_janitor;

CREATE OR REPLACE FUNCTION public.mati_consume_pairing_code(p_code_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF p_code_hash IS NULL OR char_length(p_code_hash) <> 64 THEN
    RETURN NULL;
  END IF;
  UPDATE public.pairing_codes
     SET consumed_at = now()
   WHERE id = (
     SELECT id
     FROM public.pairing_codes
     WHERE code_hash = p_code_hash
       AND consumed_at IS NULL
       AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE
   )
  RETURNING user_id INTO v_user;
  RETURN v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.mati_consume_pairing_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mati_consume_pairing_code(text) TO device;

-- MATI_AUTH_TRIGGER_BEGIN
DO $$
BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
-- MATI_AUTH_TRIGGER_END

-- ---------------------------------------------------------------------------
-- Additive column fixes for databases that predate later SQL migrations
-- ---------------------------------------------------------------------------
ALTER TABLE public.llm_settings ALTER COLUMN base_url DROP NOT NULL;

ALTER TABLE public.llm_settings
  ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '{"tools":"unknown","structuredOutput":"unknown","streaming":"unknown","usageReporting":"unknown"}'::jsonb;

ALTER TABLE public.llm_settings
  ALTER COLUMN capabilities SET DEFAULT '{"tools":"unknown","structuredOutput":"unknown","streaming":"unknown","usageReporting":"unknown"}'::jsonb;

COMMENT ON COLUMN public.llm_settings.base_url IS
  'Unused by Mati. Official provider endpoints are defined in application adapters. Left nullable so existing rows are not rewritten.';

-- ---------------------------------------------------------------------------
-- Check constraints (duplicate_object is a no-op on re-apply)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.llm_settings
    ADD CONSTRAINT llm_settings_capabilities_object CHECK (jsonb_typeof(capabilities) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.llm_settings
    ADD CONSTRAINT llm_settings_provider_len CHECK (char_length(provider) BETWEEN 1 AND 64);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.llm_settings
    ADD CONSTRAINT llm_settings_model_len CHECK (char_length(model) BETWEEN 1 AND 200);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.llm_settings DROP CONSTRAINT IF EXISTS llm_settings_base_url_len;
END $$;
DO $$ BEGIN
  ALTER TABLE public.llm_settings
    ADD CONSTRAINT llm_settings_provider_allowed
    CHECK (provider IN ('openai', 'anthropic', 'sarvam', 'xai', 'google'))
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.sessions
    ADD CONSTRAINT sessions_status_check CHECK (
      status IN (
        'pending_consent',
        'running',
        'finalizing',
        'complete',
        'cancelled',
        'failed',
        'incomplete'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.sessions
    ADD CONSTRAINT sessions_exercise_id_check CHECK (exercise_id ~ '^[a-z0-9-]+$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.evidence_events
    ADD CONSTRAINT evidence_kind_check CHECK (
      kind IN ('prompt', 'assistant', 'tool', 'test_run', 'system', 'consent', 'usage')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.evidence_events
    ADD CONSTRAINT evidence_source_check CHECK (
      source IN ('provider', 'browser', 'learner', 'server')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.messages
    ADD CONSTRAINT messages_role_check CHECK (role IN ('user', 'assistant', 'system', 'tool'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.reports
    ADD CONSTRAINT reports_status_check CHECK (
      status IN ('running', 'complete', 'failed', 'incomplete')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.usage_records
    ADD CONSTRAINT usage_role_check CHECK (agent_role IN ('trainer', 'review'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.usage_records
    ADD CONSTRAINT usage_coverage_check CHECK (coverage IN ('complete', 'partial', 'unknown'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.devices
    ADD CONSTRAINT devices_token_hash_len CHECK (char_length(token_hash) = 64);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.devices
    ADD CONSTRAINT devices_consent_object CHECK (jsonb_typeof(consent) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.capture_tasks
    ADD CONSTRAINT capture_tasks_editor_check CHECK (editor IN ('cursor', 'vscode'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.capture_tasks
    ADD CONSTRAINT capture_tasks_status_check CHECK (status IN ('open', 'closed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.capture_tasks
    ADD CONSTRAINT capture_tasks_editor_task_id_len CHECK (char_length(editor_task_id) BETWEEN 1 AND 200);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.capture_tasks
    ADD CONSTRAINT capture_tasks_workspace_hash_len CHECK (char_length(workspace_hash) BETWEEN 1 AND 128);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.capture_events
    ADD CONSTRAINT capture_events_kind_check CHECK (
      kind IN ('prompt', 'response', 'file_edit', 'context_compact', 'usage', 'session_end')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.capture_events
    ADD CONSTRAINT capture_events_idempotency_len CHECK (char_length(idempotency_key) BETWEEN 1 AND 300);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.capture_usage
    ADD CONSTRAINT capture_usage_provenance_check CHECK (provenance IN ('measured', 'estimated', 'missing'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.capture_usage
    ADD CONSTRAINT capture_usage_source_check CHECK (
      source IN ('copilot_otel_chat_span', 'cursor_admin_api', 'text_estimate', 'none')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.pairing_codes
    ADD CONSTRAINT pairing_codes_hash_len CHECK (char_length(code_hash) = 64);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Owner-safe view excludes ciphertext (security_invoker so RLS still applies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.llm_settings_status
WITH (security_invoker = true) AS
SELECT
  user_id,
  provider,
  model,
  base_url,
  key_fingerprint,
  capabilities,
  created_at,
  updated_at
FROM public.llm_settings;

GRANT SELECT ON public.llm_settings_status TO authenticated;
REVOKE ALL ON public.llm_settings_status FROM anon, public;

-- ---------------------------------------------------------------------------
-- ENABLE + FORCE RLS on every product table
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles FROM anon, public;
ALTER TABLE public.llm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.llm_settings FROM anon, public;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sessions FROM anon, public;
ALTER TABLE public.exercise_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_snapshots FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.exercise_snapshots FROM anon, public;
ALTER TABLE public.evidence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.evidence_events FROM anon, public;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.messages FROM anon, public;
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_runs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.test_runs FROM anon, public;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reports FROM anon, public;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.usage_records FROM anon, public;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.devices FROM anon, public;
ALTER TABLE public.capture_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capture_tasks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.capture_tasks FROM anon, public;
ALTER TABLE public.capture_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capture_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.capture_events FROM anon, public;
ALTER TABLE public.capture_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capture_usage FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.capture_usage FROM anon, public;
ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairing_codes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pairing_codes FROM anon, public;
ALTER TABLE public.cursor_admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursor_admin_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cursor_admin_settings FROM anon, public;

-- ---------------------------------------------------------------------------
-- Policies (drop + create so re-apply is safe)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS llm_settings_select_own ON public.llm_settings;
CREATE POLICY llm_settings_select_own
  ON public.llm_settings FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS llm_settings_insert_own ON public.llm_settings;
CREATE POLICY llm_settings_insert_own
  ON public.llm_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS llm_settings_update_own ON public.llm_settings;
CREATE POLICY llm_settings_update_own
  ON public.llm_settings FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS llm_settings_delete_own ON public.llm_settings;
CREATE POLICY llm_settings_delete_own
  ON public.llm_settings FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS sessions_select_own ON public.sessions;
CREATE POLICY sessions_select_own
  ON public.sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS sessions_insert_own ON public.sessions;
CREATE POLICY sessions_insert_own
  ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sessions_update_own ON public.sessions;
CREATE POLICY sessions_update_own
  ON public.sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS snapshots_select_own ON public.exercise_snapshots;
CREATE POLICY snapshots_select_own
  ON public.exercise_snapshots FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS snapshots_insert_own ON public.exercise_snapshots;
CREATE POLICY snapshots_insert_own
  ON public.exercise_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = exercise_snapshots.session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS evidence_select_own ON public.evidence_events;
CREATE POLICY evidence_select_own
  ON public.evidence_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS evidence_insert_own ON public.evidence_events;
CREATE POLICY evidence_insert_own
  ON public.evidence_events FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = evidence_events.session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS messages_select_own ON public.messages;
CREATE POLICY messages_select_own
  ON public.messages FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_insert_own
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = messages.session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS test_runs_select_own ON public.test_runs;
CREATE POLICY test_runs_select_own
  ON public.test_runs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS test_runs_insert_own ON public.test_runs;
CREATE POLICY test_runs_insert_own
  ON public.test_runs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = test_runs.session_id AND s.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.exercise_snapshots snap
      WHERE snap.id = test_runs.snapshot_id
        AND snap.user_id = auth.uid()
        AND snap.session_id = test_runs.session_id
    )
  );

DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own
  ON public.reports FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS reports_insert_own ON public.reports;
CREATE POLICY reports_insert_own
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = reports.session_id AND s.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.exercise_snapshots snap
      WHERE snap.id = reports.snapshot_id
        AND snap.user_id = auth.uid()
        AND snap.session_id = reports.session_id
    )
  );

DROP POLICY IF EXISTS reports_update_own ON public.reports;
CREATE POLICY reports_update_own
  ON public.reports FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS usage_select_own ON public.usage_records;
CREATE POLICY usage_select_own
  ON public.usage_records FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS usage_insert_own ON public.usage_records;
CREATE POLICY usage_insert_own
  ON public.usage_records FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = usage_records.session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS devices_register_insert ON public.devices;
CREATE POLICY devices_register_insert
  ON public.devices FOR INSERT TO capture_register
  WITH CHECK (true);

DROP POLICY IF EXISTS devices_register_select ON public.devices;
CREATE POLICY devices_register_select
  ON public.devices FOR SELECT TO capture_register
  USING (true);

DROP POLICY IF EXISTS devices_device_select ON public.devices;
CREATE POLICY devices_device_select
  ON public.devices FOR SELECT TO device
  USING (id = public.mati_device_id());

DROP POLICY IF EXISTS devices_device_update ON public.devices;
CREATE POLICY devices_device_update
  ON public.devices FOR UPDATE TO device
  USING (id = public.mati_device_id())
  WITH CHECK (id = public.mati_device_id());

DROP POLICY IF EXISTS devices_device_delete ON public.devices;
CREATE POLICY devices_device_delete
  ON public.devices FOR DELETE TO device
  USING (id = public.mati_device_id());

DROP POLICY IF EXISTS devices_user_select ON public.devices;
CREATE POLICY devices_user_select
  ON public.devices FOR SELECT TO authenticated
  USING (claimed_user_id = auth.uid());

DROP POLICY IF EXISTS devices_user_delete ON public.devices;
CREATE POLICY devices_user_delete
  ON public.devices FOR DELETE TO authenticated
  USING (claimed_user_id = auth.uid());

DROP POLICY IF EXISTS capture_tasks_device_all ON public.capture_tasks;
CREATE POLICY capture_tasks_device_all
  ON public.capture_tasks FOR ALL TO device
  USING (device_id = public.mati_device_id())
  WITH CHECK (device_id = public.mati_device_id());

DROP POLICY IF EXISTS capture_events_device_all ON public.capture_events;
CREATE POLICY capture_events_device_all
  ON public.capture_events FOR ALL TO device
  USING (device_id = public.mati_device_id())
  WITH CHECK (device_id = public.mati_device_id());

DROP POLICY IF EXISTS capture_usage_device_all ON public.capture_usage;
CREATE POLICY capture_usage_device_all
  ON public.capture_usage FOR ALL TO device
  USING (device_id = public.mati_device_id())
  WITH CHECK (device_id = public.mati_device_id());

DROP POLICY IF EXISTS capture_tasks_user_select ON public.capture_tasks;
CREATE POLICY capture_tasks_user_select
  ON public.capture_tasks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS capture_events_user_select ON public.capture_events;
CREATE POLICY capture_events_user_select
  ON public.capture_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS capture_usage_user_select ON public.capture_usage;
CREATE POLICY capture_usage_user_select
  ON public.capture_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS capture_tasks_user_delete ON public.capture_tasks;
CREATE POLICY capture_tasks_user_delete
  ON public.capture_tasks FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS capture_events_user_delete ON public.capture_events;
CREATE POLICY capture_events_user_delete
  ON public.capture_events FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS capture_usage_user_delete ON public.capture_usage;
CREATE POLICY capture_usage_user_delete
  ON public.capture_usage FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pairing_codes_user_insert ON public.pairing_codes;
CREATE POLICY pairing_codes_user_insert
  ON public.pairing_codes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS pairing_codes_user_select ON public.pairing_codes;
CREATE POLICY pairing_codes_user_select
  ON public.pairing_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pairing_codes_user_update ON public.pairing_codes;
CREATE POLICY pairing_codes_user_update
  ON public.pairing_codes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS pairing_codes_user_delete ON public.pairing_codes;
CREATE POLICY pairing_codes_user_delete
  ON public.pairing_codes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS devices_janitor_select ON public.devices;
CREATE POLICY devices_janitor_select
  ON public.devices FOR SELECT TO capture_janitor
  USING (
    claimed_user_id IS NULL
    AND created_at < now() - interval '90 days'
  );

DROP POLICY IF EXISTS devices_janitor_delete ON public.devices;
CREATE POLICY devices_janitor_delete
  ON public.devices FOR DELETE TO capture_janitor
  USING (
    claimed_user_id IS NULL
    AND created_at < now() - interval '90 days'
  );

DROP POLICY IF EXISTS capture_tasks_janitor_select ON public.capture_tasks;
CREATE POLICY capture_tasks_janitor_select
  ON public.capture_tasks FOR SELECT TO capture_janitor
  USING (
    user_id IS NULL
    AND device_id IN (
      SELECT id FROM public.devices
      WHERE claimed_user_id IS NULL
        AND created_at < now() - interval '90 days'
    )
  );

DROP POLICY IF EXISTS capture_tasks_janitor_delete ON public.capture_tasks;
CREATE POLICY capture_tasks_janitor_delete
  ON public.capture_tasks FOR DELETE TO capture_janitor
  USING (
    user_id IS NULL
    AND device_id IN (
      SELECT id FROM public.devices
      WHERE claimed_user_id IS NULL
        AND created_at < now() - interval '90 days'
    )
  );

DROP POLICY IF EXISTS capture_events_janitor_select ON public.capture_events;
CREATE POLICY capture_events_janitor_select
  ON public.capture_events FOR SELECT TO capture_janitor
  USING (
    user_id IS NULL
    AND device_id IN (
      SELECT id FROM public.devices
      WHERE claimed_user_id IS NULL
        AND created_at < now() - interval '90 days'
    )
  );

DROP POLICY IF EXISTS capture_events_janitor_delete ON public.capture_events;
CREATE POLICY capture_events_janitor_delete
  ON public.capture_events FOR DELETE TO capture_janitor
  USING (
    user_id IS NULL
    AND device_id IN (
      SELECT id FROM public.devices
      WHERE claimed_user_id IS NULL
        AND created_at < now() - interval '90 days'
    )
  );

DROP POLICY IF EXISTS capture_usage_janitor_select ON public.capture_usage;
CREATE POLICY capture_usage_janitor_select
  ON public.capture_usage FOR SELECT TO capture_janitor
  USING (
    user_id IS NULL
    AND device_id IN (
      SELECT id FROM public.devices
      WHERE claimed_user_id IS NULL
        AND created_at < now() - interval '90 days'
    )
  );

DROP POLICY IF EXISTS capture_usage_janitor_delete ON public.capture_usage;
CREATE POLICY capture_usage_janitor_delete
  ON public.capture_usage FOR DELETE TO capture_janitor
  USING (
    user_id IS NULL
    AND device_id IN (
      SELECT id FROM public.devices
      WHERE claimed_user_id IS NULL
        AND created_at < now() - interval '90 days'
    )
  );

DROP POLICY IF EXISTS cursor_admin_settings_select_own ON public.cursor_admin_settings;
CREATE POLICY cursor_admin_settings_select_own
  ON public.cursor_admin_settings FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS cursor_admin_settings_insert_own ON public.cursor_admin_settings;
CREATE POLICY cursor_admin_settings_insert_own
  ON public.cursor_admin_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS cursor_admin_settings_update_own ON public.cursor_admin_settings;
CREATE POLICY cursor_admin_settings_update_own
  ON public.cursor_admin_settings FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS cursor_admin_settings_delete_own ON public.cursor_admin_settings;
CREATE POLICY cursor_admin_settings_delete_own
  ON public.cursor_admin_settings FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Table grants. Anon is denied on product relations only.
-- Intentionally no UPDATE grant on evidence_events / exercise_snapshots:
-- ON CONFLICT DO UPDATE is not granted and must not be used.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sessions TO authenticated;
GRANT SELECT, INSERT ON public.exercise_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.evidence_events TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT SELECT, INSERT ON public.test_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT SELECT, INSERT ON public.usage_records TO authenticated;
GRANT INSERT, SELECT ON public.devices TO capture_register;
GRANT SELECT, UPDATE, DELETE ON public.devices TO device;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_tasks TO device;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_events TO device;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_usage TO device;
GRANT SELECT ON public.devices TO authenticated;
GRANT SELECT ON public.capture_tasks TO authenticated;
GRANT SELECT ON public.capture_events TO authenticated;
GRANT SELECT ON public.capture_usage TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.pairing_codes TO authenticated;
GRANT DELETE ON public.devices TO authenticated;
GRANT DELETE ON public.capture_tasks TO authenticated;
GRANT DELETE ON public.capture_events TO authenticated;
GRANT DELETE ON public.capture_usage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cursor_admin_settings TO authenticated;
GRANT SELECT, DELETE ON public.devices TO capture_janitor;
GRANT SELECT, DELETE ON public.capture_tasks TO capture_janitor;
GRANT SELECT, DELETE ON public.capture_events TO capture_janitor;
GRANT SELECT, DELETE ON public.capture_usage TO capture_janitor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, device, capture_register, capture_janitor;
