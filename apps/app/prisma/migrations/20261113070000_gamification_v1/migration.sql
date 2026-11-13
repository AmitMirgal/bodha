-- Gamification v1: report-open tracking, habit awards, opt-in leaderboard.
-- Prisma Migrate is the schema source of truth. Do not db push.
-- Capture roles must not read these tables or execute the leaderboard function.

CREATE TABLE "capture_report_opens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capture_report_opens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leaderboard_profiles" (
    "user_id" UUID NOT NULL,
    "opted_in" BOOLEAN NOT NULL DEFAULT false,
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "habit_awards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "award_key" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "earned_at" TIMESTAMPTZ(6) NOT NULL,
    "day_bucket" DATE NOT NULL,
    "week_start" DATE NOT NULL,
    "source_task_id" UUID,
    "badge_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_awards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "capture_report_opens_user_task_key" ON "capture_report_opens"("user_id", "task_id");
CREATE INDEX "capture_report_opens_user_opened_idx" ON "capture_report_opens"("user_id", "opened_at");
CREATE UNIQUE INDEX "habit_awards_user_key" ON "habit_awards"("user_id", "award_key");
CREATE INDEX "habit_awards_week_user_idx" ON "habit_awards"("week_start", "user_id");
CREATE INDEX "habit_awards_user_day_idx" ON "habit_awards"("user_id", "day_bucket");

ALTER TABLE "capture_report_opens" ADD CONSTRAINT "capture_report_opens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capture_report_opens" ADD CONSTRAINT "capture_report_opens_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "capture_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leaderboard_profiles" ADD CONSTRAINT "leaderboard_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "habit_awards" ADD CONSTRAINT "habit_awards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "habit_awards" ADD CONSTRAINT "habit_awards_source_task_id_fkey" FOREIGN KEY ("source_task_id") REFERENCES "capture_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.leaderboard_profiles
  ADD CONSTRAINT leaderboard_profiles_display_name_format CHECK (
    display_name IS NULL OR (
      char_length(display_name) BETWEEN 3 AND 24
      AND display_name ~ '^[A-Za-z0-9][A-Za-z0-9 ._-]*[A-Za-z0-9]$'
      AND display_name !~ '@'
    )
  );
ALTER TABLE public.leaderboard_profiles
  ADD CONSTRAINT leaderboard_profiles_opt_in_requires_name CHECK (
    opted_in = false OR display_name IS NOT NULL
  );
ALTER TABLE public.habit_awards
  ADD CONSTRAINT habit_awards_kind_check CHECK (kind IN ('badge', 'quest', 'streak_day'));
ALTER TABLE public.habit_awards
  ADD CONSTRAINT habit_awards_points_check CHECK (points >= 1 AND points <= 40);
ALTER TABLE public.habit_awards
  ADD CONSTRAINT habit_awards_badge_id_check CHECK (
    badge_id IS NULL OR badge_id IN (
      'first_close', 'first_report', 'clear_spec', 'one_shot', 'report_3', 'streak_7'
    )
  );

ALTER TABLE public.capture_report_opens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capture_report_opens FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.capture_report_opens FROM anon, public;

ALTER TABLE public.leaderboard_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.leaderboard_profiles FROM anon, public;

ALTER TABLE public.habit_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_awards FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.habit_awards FROM anon, public;

DROP POLICY IF EXISTS capture_report_opens_user_select ON public.capture_report_opens;
CREATE POLICY capture_report_opens_user_select
  ON public.capture_report_opens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS capture_report_opens_user_insert ON public.capture_report_opens;
CREATE POLICY capture_report_opens_user_insert
  ON public.capture_report_opens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS leaderboard_profiles_user_all ON public.leaderboard_profiles;
CREATE POLICY leaderboard_profiles_user_all
  ON public.leaderboard_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS habit_awards_user_select ON public.habit_awards;
CREATE POLICY habit_awards_user_select
  ON public.habit_awards FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS habit_awards_user_insert ON public.habit_awards;
CREATE POLICY habit_awards_user_insert
  ON public.habit_awards FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.capture_report_opens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.leaderboard_profiles TO authenticated;
GRANT SELECT, INSERT ON public.habit_awards TO authenticated;

-- Public board: rank, display name, weekly points, badge ids. No prompts, code,
-- repo names, task titles, or emails. Opted-out rows are excluded immediately.
CREATE OR REPLACE FUNCTION public.mati_leaderboard_week(p_week_start date, p_limit integer)
RETURNS TABLE (
  rank bigint,
  display_name text,
  points integer,
  badge_ids text[],
  is_self boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bound AS (
    SELECT GREATEST(LEAST(COALESCE(p_limit, 20), 100), 1) AS top_n
  ),
  opted AS (
    SELECT lp.user_id, lp.display_name
    FROM public.leaderboard_profiles lp
    WHERE lp.opted_in
      AND lp.display_name IS NOT NULL
  ),
  scored AS (
    SELECT
      o.user_id,
      o.display_name,
      COALESCE(SUM(a.points), 0)::integer AS points,
      COALESCE((
        SELECT array_agg(DISTINCT b.badge_id)
        FROM public.habit_awards b
        WHERE b.user_id = o.user_id
          AND b.week_start = p_week_start
          AND b.badge_id IS NOT NULL
      ), ARRAY[]::text[]) AS badge_ids
    FROM opted o
    LEFT JOIN public.habit_awards a
      ON a.user_id = o.user_id
     AND a.week_start = p_week_start
    GROUP BY o.user_id, o.display_name
  ),
  ranked AS (
    SELECT
      RANK() OVER (
        ORDER BY s.points DESC, s.display_name ASC, s.user_id ASC
      )::bigint AS rank,
      s.display_name,
      s.points,
      s.badge_ids,
      s.user_id
    FROM scored s
  )
  SELECT r.rank, r.display_name, r.points, r.badge_ids, (r.user_id = auth.uid()) AS is_self
  FROM ranked r, bound b
  WHERE r.rank <= b.top_n
     OR r.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.mati_leaderboard_week(date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mati_leaderboard_week(date, integer) TO authenticated;
