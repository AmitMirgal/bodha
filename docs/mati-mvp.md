# Mati individual trainer MVP

Open-source individual learning product in `apps/app`. Learners sign in, run two manually maintained exercises, chat with a server-side Mastra trainer, and revisit evidence-grounded reports plus personal progress.

This is not a Google interview replica. The product was renamed from BODHA; user-facing copy says **Mati**. Database table names are unchanged. Schema history lives in `apps/app/prisma/migrations/`.

## What it does / does not

**Does:** email/password accounts, two authored exercises, trainer chat, capture of prompts/replies/usage/tests/outcome, evidence-grounded learning report, progress, encrypted BYOK for five providers.

**Does not:** team/manager views, billing, analytics, generated exercises, a CMS, autonomous tools, extra integrations, arbitrary LLM hosts, user-supplied base URLs. Editor capture (Cursor / VS Code) is not in this MVP; see [`extension-design.md`](extension-design.md).

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
3. Apply Prisma migrations on **that** project only: `pnpm --filter app prisma:migrate:deploy` with `DIRECT_URL` (session-mode pooler, port 5432). Do not `prisma db push`.
4. Set `NEXT_PUBLIC_SUPABASE_*`, `DATABASE_URL` (`:6543?pgbouncer=true`), `DIRECT_URL` (`:5432`), `MATI_CREDENTIALS_ENCRYPTION_KEY` (`openssl rand -hex 32`). Percent-encode passwords (`p@ss` → `p%40ss`).
5. Add `{APP_ORIGIN}/auth/callback` to the Auth redirect allowlist. Enable Email auth. Do not enable anonymous sign-ins.
6. `pnpm --filter app prisma:generate` then `pnpm --filter app dev`.

Mati reads `MATI_*` only. `BODHA_*` names are ignored.

## Environment variables

See `apps/app/.env.example` for placeholders. Browser-safe variables are only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Everything else is server-only. Preview and production must not share encryption keys or pooler URLs.

`MATI_CREDENTIALS_ENCRYPTION_KEY` encrypts learners' saved provider API keys at rest. Generate with `openssl rand -hex 32`. Use a distinct value per environment.

Optional operator default (used only when the learner has no saved key): `MATI_OPERATOR_LLM_PROVIDER`, `MATI_OPERATOR_LLM_MODEL`, `MATI_OPERATOR_LLM_API_KEY`. Provider must be one of `openai`, `anthropic`, `sarvam`, `xai`, `google`. There is no operator base URL.

Vercel env should use `MATI_*` names. Do not keep `BODHA_*`, `MATI_ALLOWED_LLM_HOSTS`, `MATI_ALLOW_HTTP_LLM`, or `MATI_OPERATOR_LLM_BASE_URL`.

## Migration workflow

**Single source of truth:** `apps/app/prisma/migrations/`, applied with `prisma migrate deploy`.

`apps/app/prisma.config.ts` sets `datasource.url` from `DIRECT_URL` (generate-only placeholder if unset) and `migrations.path = prisma/migrations`. Additive schema changes are a new Prisma migration under that folder (generated from `schema.prisma` where possible; roles / FORCE RLS / policies / grants / functions stay as raw SQL in `migration.sql`). Do not `prisma db push`. `supabase/migrations/` is retired.

Empty database: `pnpm --filter app prisma:migrate:deploy`. Existing production database that already has tables but no `_prisma_migrations`: `prisma migrate resolve --applied 20261110120000_init`, then `prisma migrate deploy` (applies the idempotent repair migration). Details: [`apps/app/prisma/README.md`](../apps/app/prisma/README.md).

Runtime Prisma uses `DATABASE_URL` via `@prisma/adapter-pg`. CLI uses `DIRECT_URL`. Interactive transactions wait 15s by default (Prisma's 2s `maxWait` otherwise surfaces as P2028 on a slow first pooler connection). `SET LOCAL ROLE` stays inside each `$transaction`.

`llm_settings.base_url` is unused. It is nullable and has a `NOT VALID` check that new rows use one of the five providers. The column is not dropped.

## How to add an exercise

Manually, in source control:

- `apps/app/challenges/shelf/`
- `apps/app/challenges/cache/`

Each folder needs `meta.json`, `starter/`, `reference/`, `tests.js`. Runtime is browser JavaScript via `public/harness.js`. Keep IDs `^[a-z0-9-]+$`. Do not rename an id that existing snapshots reference. Run `pnpm --filter app validate`.

## How to add a provider adapter

Do not add a sixth provider without a product decision. The registry is designed so a later provider is:

1. One entry in `packages/ai/lib/providers.ts` (id, Mastra router id, official URL, documented capabilities).
2. App validation via `MATI_PROVIDERS` / `parseLlmSettingsInput`.
3. A new additive SQL check-constraint update if the provider list changes.
4. Tests with a mock adapter only. No vendor account is required to build or test.

Product/Mastra code stays on `@repo/ai/provider`. Do not import provider SDKs from `apps/app`. Model calls go through Mastra's model router (`{ id: "openai/gpt-4.1", apiKey }`).

## Capability matrix

Documented per provider in `PROVIDER_REGISTRY`. Gaps are shown in settings and stored; they are never invented.

| Capability | If missing |
| --- | --- |
| Tool calling | Settings are not saved when tools are not `supported`; chat/report will not run. Visible error. No one-shot fallback. |
| Usage reporting | Store `unknown` / "not reported by provider". Never estimate. |
| Structured output | Validate JSON in the app; do not invent scores. |
| Streaming | Not required for this MVP. |

Retries use per-request idempotency keys. A retried chat turn does not silently double-write usage; a new client request id starts a new recorded attempt.

## Security model

- RLS on every product table; owner is `auth.uid()`. FORCE RLS is part of the Prisma migrations. Runtime Prisma must `SET LOCAL ROLE` and refuse `BYPASSRLS`.
- Encrypted BYOK keys live in `llm_settings`. The status view hides ciphertext. APIs return a masked fingerprint only.
- Learners cannot supply a base URL. Official endpoints are defined in adapters.
- Server-only env must not appear in `"use client"` modules (enforced by `client-env-leak.test.ts`).
- No service role for learner operations.

## Preview and production

Cursor Build Live Apps is **not** used here: it would host Cursor Postgres and Cursor SSO instead of Supabase. Deploy `apps/app` to a Vercel **preview** with preview-only env vars. Do not apply migrations to a remote database from CI/agents without approval.

Production (custom domain, production Supabase, production encryption key, package publish) needs Amit's explicit approval.
