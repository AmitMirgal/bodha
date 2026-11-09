# Mati individual trainer MVP

Open-source individual learning product in `apps/app`. Learners sign in, run two manually maintained exercises, chat with a server-side Mastra trainer, and revisit evidence-grounded reports plus personal daily progress.

This is not a Google interview replica. The product was renamed from BODHA; user-facing copy says **Mati**. Database table names and existing `supabase/migrations/*.sql` filenames are unchanged.

## What it does / does not

**Does:** email/password accounts, two authored exercises, trainer chat, capture of prompts/replies/usage/tests/outcome, evidence-grounded learning report, daily progress, encrypted BYOK.

**Does not:** team/manager views, billing, analytics, generated exercises, a CMS, autonomous tools, extra integrations.

## Package manager

pnpm (`pnpm@10.33.4`). Nested npm lockfiles are not used.

```bash
pnpm install --frozen-lockfile
pnpm --filter app dev
pnpm --filter app test
pnpm --filter app typecheck
pnpm --filter app build
pnpm --filter app lint:mati
pnpm --filter app validate
```

Root `pnpm check` lints the whole next-forge template and is not a Mati-clean signal.

## Local setup

1. Copy `apps/app/.env.example` to `apps/app/.env.local`.
2. Create an isolated non-production Supabase project (or `pnpm dlx supabase start`).
3. Apply `supabase/migrations/*.sql` (SQL editor or `pnpm dlx supabase db push`) on **that** project only.
4. Set `NEXT_PUBLIC_SUPABASE_*`, `DATABASE_URL` (`:6543?pgbouncer=true`), `DIRECT_URL` (`:5432`), `MATI_CREDENTIALS_ENCRYPTION_KEY`, `MATI_ALLOWED_LLM_HOSTS`. Percent-encode passwords (`p@ss` → `p%40ss`).
5. Add `{APP_ORIGIN}/auth/callback` to the Auth redirect allowlist. Enable Email auth. Do not enable anonymous sign-ins.
6. `pnpm --filter app prisma:generate` then `pnpm --filter app dev`.

`MATI_*` is canonical. Matching `BODHA_*` values still work if the `MATI_*` value is unset.

## Environment variables

See `apps/app/.env.example` for placeholders. Browser-safe variables are only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Everything else is server-only. Preview and production must not share encryption keys or pooler URLs.

## Migration workflow

**Single source of truth:** `supabase/migrations/*.sql`.

`apps/app/prisma.config.ts` sets `datasource.url` from `DIRECT_URL` (generate-only placeholder if unset) and includes Prisma 7 `migrations.path = prisma/migrations`. That folder is intentionally absent. Do not `prisma migrate` / `prisma db push`. Do not rename historical files such as `20251108120000_bodha_mvp.sql`. Additive schema changes belong in a new SQL file under `supabase/migrations/`.

Runtime Prisma uses `DATABASE_URL` via `@prisma/adapter-pg`. CLI uses `DIRECT_URL`. Interactive transactions wait 15s by default (Prisma's 2s `maxWait` otherwise surfaces as P2028 on a slow first pooler connection). `SET LOCAL ROLE` stays inside each `$transaction`.

## How to add an exercise

Manually, in source control:

- `apps/app/challenges/shelf/`
- `apps/app/challenges/cache/`

Each folder needs `meta.json`, `starter/`, `reference/`, `tests.js`. Runtime is browser JavaScript via `public/harness.js`. Keep IDs `^[a-z0-9-]+$`. Do not rename an id that existing snapshots reference. Run `pnpm --filter app validate`.

## How to add a provider adapter

1. Keep product/Mastra code on `@repo/ai/provider`. Do not import provider SDKs from `apps/app`.
2. Add an adapter under `packages/ai/lib/` that implements the shared interface (`toProtectedLanguageModel`, capabilities, usage normalization).
3. Declare capabilities (`tools`, `structuredOutput`, `streaming`, `usageReporting`) as `supported` / `unsupported` / `unknown`.
4. Route HTTP through `createProtectedFetch` (HTTPS, host allowlist, DNS re-check, no automatic redirects, timeout, size limit).
5. Tests must use a fake adapter. No vendor account is required to build or test.

The shipping adapter is OpenAI-compatible (protocol, not a capability guarantee).

## Capability matrix

| Capability | If missing |
| --- | --- |
| Tool calling | Settings are not saved; chat/report will not run. Visible error. No one-shot fallback. |
| Usage reporting | Store `unknown` / "not reported by provider". Never estimate. |
| Structured output | Validate JSON in the app; do not invent scores. |
| Streaming | Not required for this MVP. |

Retries use per-request idempotency keys. A retried chat turn does not silently double-write usage; a new client request id starts a new recorded attempt.

## Security model

- RLS on every product table; owner is `auth.uid()`. FORCE RLS is additive SQL. Runtime Prisma must `SET LOCAL ROLE` and refuse `BYPASSRLS`.
- Encrypted BYOK keys live in `llm_settings`. The status view hides ciphertext. APIs return a masked fingerprint only.
- Base URLs: HTTPS unless `MATI_ALLOW_HTTP_LLM=true` for an allowlisted public host. Private, link-local, and metadata IPs are blocked before and after DNS.
- Server-only env must not appear in `"use client"` modules (enforced by `client-env-leak.test.ts`).
- No service role for learner operations.

## Preview and production

Cursor Build Live Apps is **not** used here: it would host Cursor Postgres and Cursor SSO instead of Supabase. Deploy `apps/app` to a Vercel **preview** with preview-only env vars. Do not apply migrations to a remote database from CI/agents without approval.

Production (custom domain, production Supabase, production encryption key, package publish) needs Amit's explicit approval.
