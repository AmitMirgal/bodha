# Mati Prisma mapping

`schema.prisma` maps the product tables. **Authoritative schema, roles, RLS, policies, grants, and SQL functions** live in `prisma/migrations/`. Apply them with Prisma Migrate.

```bash
# from apps/app, with DIRECT_URL set (session-mode pooler, port 5432)
pnpm prisma:generate
pnpm prisma:migrate:deploy
```

Do **not** `prisma db push`. That skips migration history and can omit roles / FORCE RLS / policies.

`DIRECT_URL` is the Prisma CLI datasource in `prisma.config.ts`. Generate may use a local placeholder if `DIRECT_URL` is unset; migrate / db pull fail closed without it. `DATABASE_URL` (transaction-mode pooler, port 6543, `pgbouncer=true`) is for the runtime adapter only.

Prisma schema cannot express roles, `FORCE ROW LEVEL SECURITY`, policies, grants, or functions (`mati_device_id`, `mati_consume_pairing_code`, …). Those are raw SQL inside `migration.sql` files. `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma` should be empty (set `SHADOW_DATABASE_URL` to a throwaway Postgres for that check).

Product queries never use the raw Prisma client. `withUserDb` / `withAnonDb` / `withDeviceDb` / `withCaptureRegisterDb` / `withCaptureJanitorDb` wrap `$transaction`, set JWT claim GUCs from a server-verified identity, `SET LOCAL ROLE authenticated|anon|device|capture_register|capture_janitor`, and abort unless `pg_roles` for `current_user` is non-superuser and **`rolbypassrls` is false**. `FORCE ROW LEVEL SECURITY` does not constrain `BYPASSRLS` roles. That is required because the pooler login is often `postgres`, which bypasses RLS.

`applyRlsContext` calls `auth.uid()` only for `authenticated` / `anon`. Hosted Supabase owns schema `auth` as `supabase_auth_admin`; `GRANT USAGE ON SCHEMA auth` to `device` / `capture_register` / `capture_janitor` as `postgres` can report success and still leave `has_schema_privilege` false. Those roles check an empty JWT subject via `current_setting('request.jwt.claim.sub')` / `request.jwt.claims` and use `public.mati_device_id()` / `mati_consume_pairing_code` (no `auth.*`).

## Empty database

`prisma migrate deploy` applies:

1. `20261110120000_init` — tables generated from `schema.prisma`, then the security overlay.
2. `20261110120100_repair_existing_supabase` — idempotent no-op after init (`CREATE TABLE IF NOT EXISTS`, drop/create policies).
3. `20261110140000_capture_roles_without_auth_schema` — harmless retry of auth grants (no-op on hosted) plus public grants the migrate login owns.

The database must have `auth.users` and `auth.uid()` (hosted Supabase already does). Empty local Postgres: the overlay creates a stub when those objects are missing.

## Existing production database (no `_prisma_migrations`, do not drop data)

Mark the init migration as already applied, then deploy the repair migration:

```bash
# DIRECT_URL must already be set in this shell. Do not print it.
cd apps/app
pnpm exec prisma migrate resolve --applied 20261110120000_init --config=./prisma.config.ts
pnpm exec prisma migrate deploy --config=./prisma.config.ts
```

Repair creates missing roles, forces RLS, (re)creates policies/grants/functions, and `CREATE TABLE IF NOT EXISTS` for capture tables whether they are present or were dropped.

Default tests cover this request path on PGlite with stub auth. They do not execute PrismaPg against a Supabase pooler or real Auth.
