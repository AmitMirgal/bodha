# Retired

Mati schema, RLS, roles, grants, and SQL functions are no longer sourced from this directory.

Use `apps/app/prisma/migrations/` and `pnpm --filter app prisma:migrate:deploy` (`prisma migrate deploy`).

`supabase/config.toml` remains for an isolated local Auth/Postgres stack (`pnpm dlx supabase start`). After that stack is up, still apply Prisma migrations rather than `supabase db push`.
