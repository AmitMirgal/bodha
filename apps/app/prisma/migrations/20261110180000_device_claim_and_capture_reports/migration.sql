-- Device-originated short-lived claim tokens and stored editor learning reports.
-- Prisma Migrate is the schema source of truth. Do not db push.

CREATE TABLE "device_claim_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_claim_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "capture_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "body" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capture_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_claim_tokens_token_hash_key" ON "device_claim_tokens"("token_hash");
CREATE INDEX "device_claim_tokens_device_idx" ON "device_claim_tokens"("device_id");
CREATE UNIQUE INDEX "capture_reports_task_id_version_key" ON "capture_reports"("task_id", "version");
CREATE INDEX "capture_reports_task_idx" ON "capture_reports"("task_id", "version");

ALTER TABLE "device_claim_tokens" ADD CONSTRAINT "device_claim_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capture_reports" ADD CONSTRAINT "capture_reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "capture_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capture_reports" ADD CONSTRAINT "capture_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.device_claim_tokens
  ADD CONSTRAINT device_claim_tokens_hash_len CHECK (char_length(token_hash) = 64);
ALTER TABLE public.capture_reports
  ADD CONSTRAINT capture_reports_status_check CHECK (status IN ('running', 'complete', 'failed', 'incomplete'));

ALTER TABLE public.device_claim_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_claim_tokens FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.device_claim_tokens FROM anon, public;

ALTER TABLE public.capture_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capture_reports FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.capture_reports FROM anon, public;

-- Authenticated users consume a hashed one-time token. Capture roles must not
-- execute this (it uses auth.uid()). Table owner / superuser bypasses FORCE RLS.
CREATE OR REPLACE FUNCTION public.mati_claim_device_with_token(p_token_hash text, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device uuid;
  v_claimed uuid;
  v_consumed timestamptz;
  v_expires timestamptz;
  v_caller uuid;
BEGIN
  IF p_token_hash IS NULL OR char_length(p_token_hash) <> 64 OR p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    v_caller := auth.uid();
  EXCEPTION
    WHEN undefined_function THEN
      v_caller := NULL;
    WHEN invalid_schema_name THEN
      v_caller := NULL;
  END;
  IF v_caller IS NULL OR v_caller IS DISTINCT FROM p_user_id THEN
    RETURN NULL;
  END IF;

  SELECT t.device_id, d.claimed_user_id, t.consumed_at, t.expires_at
    INTO v_device, v_claimed, v_consumed, v_expires
    FROM public.device_claim_tokens t
    JOIN public.devices d ON d.id = t.device_id
   WHERE t.token_hash = p_token_hash
   FOR UPDATE;

  IF v_device IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_claimed IS NOT NULL AND v_claimed IS DISTINCT FROM p_user_id THEN
    RETURN NULL;
  END IF;
  IF v_consumed IS NOT NULL THEN
    IF v_claimed = p_user_id THEN
      RETURN v_device;
    END IF;
    RETURN NULL;
  END IF;
  IF v_expires <= now() THEN
    RETURN NULL;
  END IF;

  UPDATE public.device_claim_tokens
     SET consumed_at = now()
   WHERE token_hash = p_token_hash
     AND consumed_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.devices
     SET claimed_user_id = p_user_id
   WHERE id = v_device
     AND (claimed_user_id IS NULL OR claimed_user_id = p_user_id);

  UPDATE public.capture_tasks
     SET user_id = p_user_id
   WHERE device_id = v_device
     AND (user_id IS NULL OR user_id = p_user_id);

  UPDATE public.capture_events
     SET user_id = p_user_id
   WHERE device_id = v_device
     AND (user_id IS NULL OR user_id = p_user_id);

  UPDATE public.capture_usage
     SET user_id = p_user_id
   WHERE device_id = v_device
     AND (user_id IS NULL OR user_id = p_user_id);

  RETURN v_device;
END;
$$;

REVOKE ALL ON FUNCTION public.mati_claim_device_with_token(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mati_claim_device_with_token(text, uuid) TO authenticated;

DROP POLICY IF EXISTS device_claim_tokens_device_all ON public.device_claim_tokens;
CREATE POLICY device_claim_tokens_device_all
  ON public.device_claim_tokens FOR ALL TO device
  USING (device_id = public.mati_device_id())
  WITH CHECK (device_id = public.mati_device_id());

DROP POLICY IF EXISTS capture_reports_user_all ON public.capture_reports;
CREATE POLICY capture_reports_user_all
  ON public.capture_reports FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_claim_tokens TO device;
GRANT SELECT, INSERT, UPDATE ON public.capture_reports TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, device, capture_register, capture_janitor;
