# BODHA

Open-source individual learning trainer. Learners sign in, run two manually maintained browser-JavaScript exercises, chat with a server-side Mastra coach, and revisit evidence-grounded reports plus personal daily progress.

This is **not** a Google interview replica and does not claim feature parity with any other product. Runtime is **browser JavaScript** via `public/harness.js`. There is no Node, Python, or ML execution sandbox.

Product code lives in `apps/app`. Longer setup notes: [`docs/bodha-mvp.md`](docs/bodha-mvp.md).

The rest of this monorepo is a next-forge workspace template (unrelated apps and packages). BODHA auth is **Supabase Auth**. BODHA data is **Supabase PostgreSQL** accessed at runtime through **Prisma 7** with per-request RLS. Do not use Clerk, Neon, or `packages/database` for BODHA.

## Current trainer

- Two exercises, authored in source: `apps/app/challenges/shelf/` and `apps/app/challenges/cache/`.
- Server-side Mastra trainer and review agents. Provider-agnostic OpenAI-compatible protocol. BYOK (encrypted at rest) or an optional operator default.
- Tool calling is required. Settings are not saved, and chat/report generation will not run, until a connection check proves `tool_calls`.
- Reports assemble outcome and usage from stored evidence. Model text is coaching, not a measured score.

## Architecture

- **Auth:** Supabase Auth (cookie session). Server routes verify identity with `auth.getUser()`, not decode-only JWT claims.
- **Database:** Supabase PostgreSQL. Versioned SQL in `supabase/migrations/` is the **authoritative schema and RLS**. Prisma maps those tables; it is not a second migration source.
- **Runtime queries:** Prisma 7.4.2 + `@prisma/adapter-pg` on `DATABASE_URL` (transaction-mode pooler, port **6543**, `pgbouncer=true`). Each product operation runs in a short transaction that `SET LOCAL ROLE authenticated|anon` and sets `request.jwt.claims` / `request.jwt.claim.sub` from the verified user. Privileged `postgres` logins are not used for tenant reads/writes. If `SET LOCAL ROLE` does not drop superuser/bypass, the request fails closed.
- **CLI / generate:** `DIRECT_URL` (session-mode pooler, port **5432**). Used by `prisma.config.ts` only. Never expose either URL to the browser (`NEXT_PUBLIC_*` is rejected).
- **Unrelated packages:** `packages/database` remains the Neon Prisma client for `apps/api` and must not be mixed into BODHA.

## Package manager

pnpm workspaces (`packageManager`: `pnpm@10.33.4`, `pnpm-workspace.yaml`). Install from the **repository root**. The npm `package-lock.json` is not used. Root `.npmrc` sets `strict-peer-dependencies=false` because `streamdown` (via `@repo/ai`) requests `react-dom@^19.3.1` while this workspace pins React 19.2.4.

```bash
pnpm install --frozen-lockfile
cp apps/app/.env.example apps/app/.env.local
pnpm --filter app prisma:generate
pnpm --filter app dev
```

Migration SQL is **not** applied by install, generate, or `next dev`. Apply `supabase/migrations/*.sql` yourself against an isolated non-production project you control. Do not run `prisma migrate` / `prisma db push` against a BODHA database.

## Environment (placeholders only)

Copy `apps/app/.env.example`. Never commit real values. Encode reserved password characters before they go in a URL (example: `p@ss` → `p%40ss` via `encodeURIComponent`).

| Variable | Role |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public anon/publishable key (RLS still applies) |
| `DATABASE_URL` | Server-only transaction-mode pooler (`…pooler.supabase.com:6543/postgres?pgbouncer=true`) |
| `DIRECT_URL` | Server-only session-mode pooler (`…:5432/postgres`) for Prisma CLI |
| `BODHA_CREDENTIALS_ENCRYPTION_KEY` | 32-byte server key (64 hex chars). Required to store BYOK keys. Fail closed if missing. |
| `BODHA_ALLOWED_LLM_HOSTS` | Comma-separated hosts allowed for OpenAI-compatible base URLs |
| `BODHA_ALLOW_HTTP_LLM` | `"true"` only to allow HTTP for operator-approved public hosts |
| `BODHA_OPERATOR_LLM_PROVIDER` | Optional operator default provider |
| `BODHA_OPERATOR_LLM_MODEL` | Optional operator default model |
| `BODHA_OPERATOR_LLM_BASE_URL` | Optional operator default base URL |
| `BODHA_OPERATOR_LLM_API_KEY` | Optional operator default key (server-only) |
| `BODHA_OPERATOR_LLM_TOOLS` | Operator tool capability (`supported` / `unsupported` / `unknown`) |
| `BODHA_PROGRESS_TIMEZONE` | Day-bucket timezone (default `UTC`) |

Auth callback: `{APP_ORIGIN}/auth/callback`. Add it to the isolated Supabase project's redirect allowlist. Enable Email auth. No provider-specific cloud account is mandatory beyond the database/auth project and whichever OpenAI-compatible endpoint the operator or learner chooses.

## Commands

```bash
pnpm --filter app dev
pnpm --filter app prisma:generate
pnpm --filter app test
pnpm --filter app typecheck
pnpm --filter app build
pnpm --filter app lint:bodha
pnpm --filter app validate
pnpm --filter @repo/ai test
pnpm --filter @repo/ai typecheck
pnpm check   # Ultracite/Biome at repo root (includes unrelated next-forge packages)
```

`lint:bodha` covers BODHA sources plus `packages/ai` transport/provider files, `supabase/migrations`, and `docs/bodha-mvp.md`. Biome treats `[id]` in a CLI path as a glob, so those routes are linted via parent directories. Root `pnpm check` is **not** a BODHA-clean signal; it reports thousands of findings in unused template packages.

Known test/build limits: PGlite RLS is not Supabase PostgREST. Live `BODHA_LIVE_*` and `BODHA_LIVE_PRISMA_RLS=1` checks are skipped unless you set them against a project you already control. DNS re-check on LLM fetch is not full connection pinning. Report fact-grounding is schema/citation validation, not semantic proof. Retrying a stale report claim starts a **new billed** review version.

## Vercel (`apps/app` only)

This repo does not deploy itself. When you deploy:

1. Isolated **preview** and **production** Supabase projects. Separate `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_*`, and `BODHA_CREDENTIALS_ENCRYPTION_KEY`. Do not reuse encryption keys or pooler URLs across environments.
2. Apply `supabase/migrations/*.sql` yourself (SQL editor or `pnpm dlx supabase db push`) on that project. Do not reset a baseline that already has data.
3. Vercel project linked to this git repo:
   - Framework: Next.js
   - Enable Corepack so `packageManager` (`pnpm@10.33.4`) is used
   - Root Directory: repo root with Install `pnpm install --frozen-lockfile`, Build `pnpm --filter app build`, Output `apps/app/.next`
   - Or Root Directory `apps/app` with a repo-root workspace install so `@repo/ai` and `@repo/design-system` resolve
   - App `build` already runs `prisma generate` then `next build`
4. Set the env names above on Preview and Production separately. Add `{VERCEL_URL or custom domain}/auth/callback` to Supabase Auth redirects.
5. Production is a later step with its own project, key, and DNS.

## Privacy / RLS

Every product table has RLS. Owner is `auth.uid()`. Snapshots, evidence, messages, test runs, and usage are insert-only (no owner UPDATE/DELETE). Composite foreign keys block forged cross-owner links. Anonymous roles have no table grants. `FORCE ROW LEVEL SECURITY` is an additive SQL file; table owners still must pass policies. Superuser/`postgres` connections bypass RLS, which is why runtime Prisma **must** `SET LOCAL ROLE` inside each transaction and refuse to continue if it cannot.

## License

The product is developed in the open. No separate license file has been chosen for BODHA yet; do not assume one.
