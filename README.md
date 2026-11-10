# Mati

Open-source individual learning trainer (renamed from BODHA). Learners sign in, run two manually maintained browser-JavaScript exercises, chat with a server-side Mastra coach, and revisit evidence-grounded reports plus personal progress.

This is **not** a Google interview replica and does not claim feature parity with any other product. Runtime is **browser JavaScript** via `public/harness.js`. There is no Node, Python, or ML execution sandbox.

Product code lives in `apps/app`. Longer setup notes: [`docs/mati-mvp.md`](docs/mati-mvp.md). Editor capture lives in [`extensions/mati`](extensions/mati/README.md). Design notes: [`docs/extension-design.md`](docs/extension-design.md). Later capture PRs should edit only their own section in those files, not this paragraph.

The rest of this monorepo is a next-forge workspace template (unrelated apps and packages). Mati auth is **Supabase Auth**. Mati data is **Supabase PostgreSQL** accessed at runtime through **Prisma 7** with per-request RLS. Do not use Clerk, Neon, Cursor-hosted Postgres, or `packages/database` for Mati.

There is no `@bodha/*` or `@mati/*` workspace scope. Product packages stay `@repo/*` (for example `@repo/ai`, `@repo/design-system`).

## What this MVP does

1. Supabase email/password accounts (no anonymous sign-ins, no auto-confirm in this repo).
2. Two manually authored exercises (shelf, cache) with Monaco and a browser test runner.
3. Trainer chat using the learner's own model settings.
4. Capture of prompts, replies, provider-reported usage, test runs, and verification outcome.
5. A post-task learning report from a Mastra agent that only reads that learner's evidence.
6. A day-by-day progress view of that learner's stored sessions.
7. Bring-your-own-key: provider, model, API key, and base URL, encrypted server-side. The key is never returned after save.

## What it does not do

Corporate/team/manager views, org dashboards, employee comparisons, billing, analytics, AI-generated exercises, a CMS, autonomous agent actions, and extra integrations.

## Architecture

- **Auth:** Supabase Auth (cookie session). Server routes verify identity with `auth.getUser()`, not decode-only JWT claims.
- **Database:** Supabase PostgreSQL. Versioned Prisma migrations in `apps/app/prisma/migrations/` are the **authoritative schema, roles, RLS, policies, grants, and SQL functions**. Apply with `prisma migrate deploy`. `schema.prisma` must stay aligned with those migrations. Do not `prisma db push`.
- **Runtime queries:** Prisma 7.4.2 + `@prisma/adapter-pg` on `DATABASE_URL` (transaction-mode pooler, port **6543**, `pgbouncer=true`). Each product operation runs in a short transaction that `SET LOCAL ROLE authenticated|anon` and sets `request.jwt.claims` / `request.jwt.claim.sub` from the verified user. After `SET LOCAL ROLE`, the request **fails closed** if `current_user` is not `authenticated`/`anon`, `is_superuser` is on, `pg_roles.rolsuper` is true, or **`pg_roles.rolbypassrls` is true**.
- **CLI / generate:** `DIRECT_URL` (session-mode pooler, port **5432**). `prisma.config.ts` uses this URL (placeholder only for `generate` if unset). Migrate / db pull fail without `DIRECT_URL`.
- **Transactions:** Default wait is 15s (`MATI_PRISMA_TX_MAX_WAIT_MS`); the pg pool connection timeout defaults to 10s (`MATI_PG_CONNECTION_TIMEOUT_MS`). Prisma's stock 2s `maxWait` is too short for a first cross-region pooler connection and surfaces as P2028.
- **Models:** Five fixed providers (OpenAI, Anthropic, Sarvam AI, xAI Grok, Google Gemini) via Mastra's model router. Official endpoints live in adapters. Learners pick provider + model and paste a key. No user-supplied base URL. Missing capabilities fail closed with a visible message; usage is never invented.

## Package manager

pnpm workspaces (`packageManager`: `pnpm@10.33.4`). Install from the **repository root**.

```bash
pnpm install --frozen-lockfile
cp apps/app/.env.example apps/app/.env.local
pnpm --filter app prisma:generate
pnpm --filter app dev
```

Apply Prisma migrations against an isolated non-production project (`pnpm --filter app prisma:migrate:deploy`, `DIRECT_URL` on port 5432). Do not `prisma db push`. Local stack: `pnpm dlx supabase start` (uses `supabase/config.toml`; `project_id` remains `bodha-dev` so existing volumes keep working), then `prisma migrate deploy`.

## Environment

Copy `apps/app/.env.example`. Never commit real values. Names are `MATI_*` only; `BODHA_*` is not read. Encode reserved password characters (`p@ss` → `p%40ss`).

| Variable | Required | Where | Role |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | browser | Public project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | browser | Public anon/publishable key |
| `DATABASE_URL` | yes (runtime) | server | Transaction-mode pooler `:6543` |
| `DIRECT_URL` | CLI migrate/db pull | server | Session-mode pooler `:5432` |
| `MATI_CREDENTIALS_ENCRYPTION_KEY` | to store BYOK | server | 32-byte key (`openssl rand -hex 32`); distinct per environment |
| `MATI_OPERATOR_LLM_PROVIDER` | no | server | Optional operator default (`openai`, `anthropic`, `sarvam`, `xai`, `google`) |
| `MATI_OPERATOR_LLM_MODEL` | no | server | Optional operator default model id |
| `MATI_OPERATOR_LLM_API_KEY` | no | server | Optional operator default key |
| `MATI_PROGRESS_TIMEZONE` | no | server | Day-bucket timezone (default `UTC`) |
| `MATI_PRISMA_TX_MAX_WAIT_MS` | no | server | Interactive transaction acquire wait |
| `MATI_PG_CONNECTION_TIMEOUT_MS` | no | server | pg Pool first-connection timeout |

Preview and production must use **separate** Supabase projects, pooler URLs, and encryption keys.

## Commands

```bash
pnpm --filter app dev
pnpm --filter app prisma:generate
pnpm --filter app prisma:migrate:deploy
pnpm --filter app test
pnpm --filter app typecheck
pnpm --filter app build
pnpm --filter app lint:mati
pnpm --filter app validate
pnpm --filter @repo/ai test
pnpm --filter @repo/ai typecheck
pnpm check   # Ultracite/Biome at repo root (includes unused next-forge packages)
```

`lint:mati` is the product lint. Root `pnpm check` is **not** a Mati-clean signal; the unused template packages report thousands of findings.

Default tests run Prisma request-path RLS against **PGlite** with stub `auth.uid()`. They do not open a remote pooler. Opt-in live PrismaPg: `MATI_LIVE_PRISMA_RLS=1` and `MATI_LIVE_ISOLATED_TARGET=1` plus an isolated `:6543` URL. Live PostgREST still needs `MATI_LIVE_SUPABASE_*` plus two user access tokens.

## Preview and production

Cursor **Build Live Apps** is not used: it provisions Cursor Postgres and Cursor SSO, which would replace Supabase Auth/Postgres. Use a Vercel **preview** with a non-production Supabase project. Do not run remote migrations from this agent. **Production, custom domains, and package publish need Amit's explicit approval.**

## License

Copyright 2026 AmitMirgal. Licensed under the Apache License, Version 2.0. See `LICENSE.md`.

This repository started from [next-forge](https://github.com/vercel/next-forge) (MIT, Copyright (c) 2025 Vercel). That template's MIT notice still applies to the unmodified next-forge material. Third-party and vendored code keeps its own license.
