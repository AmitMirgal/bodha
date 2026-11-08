# BODHA Prisma mapping

`schema.prisma` maps tables created by `supabase/migrations/*.sql`.

**Authoritative schema and RLS:** the SQL files under `supabase/migrations/`.

**Do not** run `prisma migrate dev`, `prisma migrate deploy`, or `prisma db push` against a BODHA database. Those commands would create a second migration history and can drift or reset the SQL baseline.

Generate the client only:

```bash
pnpm --filter app prisma:generate
```

`DIRECT_URL` (session-mode pooler, port 5432) is for Prisma CLI if you introspect. `DATABASE_URL` (transaction-mode pooler, port 6543, `pgbouncer=true`) is for the runtime adapter.

Product queries never use the raw Prisma client. `withUserDb` / `withAnonDb` wrap `$transaction`, set JWT claim GUCs from a server-verified `auth.getUser()` id, `SET LOCAL ROLE authenticated|anon`, and abort if the session is still a superuser. That is required because the pooler login is often the `postgres` role, which bypasses RLS.
