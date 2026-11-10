# Mati agent notes

Product code lives in `apps/app`. Use **pnpm** only (`pnpm@10.33.4`). Do not push `main`. Do not force-push.

## Database schema

Single source of truth: `apps/app/prisma/migrations/`, applied with `prisma migrate deploy`.

- Do not add SQL under `supabase/migrations/` (retired).
- Do not `prisma db push`.
- Roles, FORCE RLS, policies, grants, and functions belong in `migration.sql` (Prisma schema cannot express them).
- Keep `schema.prisma` aligned with the table/index/FK parts of those migrations (`prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma` should be empty when `SHADOW_DATABASE_URL` is set).

Runtime still uses `withUserDb` / `withAnonDb` / `withDeviceDb` / `withCaptureRegisterDb` / `withCaptureJanitorDb`: `SET LOCAL ROLE` plus the `rolbypassrls` fail-closed guard. Capture roles must not query schema `auth` (`auth.uid()` is for `authenticated` / `anon` only). No anonymous sign-ins. No secrets in code or logs.

Do not run migrations, deploys, or writes against a remote/production database unless Amit explicitly asks.
