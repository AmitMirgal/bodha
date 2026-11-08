# BODHA individual trainer MVP

Open-source individual learning product in `apps/app`. Learners sign in, run two manually maintained exercises, chat with a server-side Mastra trainer, and revisit evidence-grounded reports plus personal daily progress.

This is not a Google interview replica and does not claim feature parity with any other product.

## Package manager

pnpm workspaces (`packageManager`: `pnpm@10.33.4`, `pnpm-workspace.yaml`). Nested `apps/app` lockfiles were removed so the root `pnpm-lock.yaml` is the source of truth. Root `.npmrc` sets `strict-peer-dependencies=false` because `streamdown` (via `@repo/ai`) requests `react-dom@^19.3.1` while this workspace pins React 19.2.4.

```bash
pnpm install --frozen-lockfile
pnpm --filter app dev
pnpm --filter app test
pnpm --filter app typecheck
pnpm --filter app build
pnpm --filter app lint:bodha   # BODHA sources; parent dirs so `[id]` is not a glob
pnpm check   # Ultracite/Biome at repo root (includes unrelated next-forge packages)
pnpm --filter app validate
```

Biome treats `[id]` in a CLI file argument as a glob character class. Lint those routes by checking `apps/app/src` (or `apps/app/src/app/api/sessions`) rather than the bracketed filename. Tailwind class scanning for `apps/app` uses `@tailwindcss/postcss` `base` (the app directory) plus the design-system stylesheet; there is no separate `sources.css`.

## Environment (placeholders only)

Copy `apps/app/.env.example` to `apps/app/.env.local`. Never commit real values.

| Variable | Role |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public anon/publishable key (RLS still applies) |
| `DATABASE_URL` | Server-only transaction-mode pooler, port 6543, `pgbouncer=true`. Prisma runtime. |
| `DIRECT_URL` | Server-only session-mode pooler, port 5432. Prisma CLI / generate only. |
| `BODHA_CREDENTIALS_ENCRYPTION_KEY` | 32-byte server encryption key (64 hex chars). Required to store BYOK keys. Fail closed if missing. |
| `BODHA_ALLOWED_LLM_HOSTS` | Comma-separated hosts allowed for OpenAI-compatible base URLs |
| `BODHA_OPERATOR_LLM_*` | Optional operator default. Used only when the user has no saved key. Never silently replaces user BYOK. |
| `BODHA_PROGRESS_TIMEZONE` | Day-bucket timezone (default `UTC`) |

Encode reserved password characters in pooler URLs (example: `p@ss` → `p%40ss`). Never put database URLs in `NEXT_PUBLIC_*`.

Auth callback: `{APP_ORIGIN}/auth/callback`. Add it to the isolated Supabase project's redirect allowlist. Enable Email auth.

## Isolated Supabase

Use a **nonproduction** project. Do not apply this schema to production or to unrelated projects.

```bash
pnpm dlx supabase db push   # only against an isolated nonprod project you control
# or paste supabase/migrations/*.sql in the SQL editor
```

Every product table has RLS. Owner is `auth.uid()`. Snapshots have no UPDATE/DELETE policies. Composite foreign keys block forged cross-owner session links. Anonymous roles have no table grants. Additive `FORCE ROW LEVEL SECURITY` lives in `supabase/migrations/20251108140000_force_rls.sql` and is not auto-applied.

**Authoritative schema:** `supabase/migrations/*.sql`. Prisma (`apps/app/prisma/schema.prisma`, Prisma **7.4.2**, generator `prisma-client`) only maps those tables. Do **not** run `prisma migrate` / `prisma db push` on a BODHA database (that would add a competing history). Generate the client with `pnpm --filter app prisma:generate`. `packages/database` is Neon Prisma for `apps/api` and is unrelated.

Runtime product queries use Prisma + `@prisma/adapter-pg` on `DATABASE_URL`. Each request opens a short transaction, sets `request.jwt.claims` / `request.jwt.claim.sub` from `auth.getUser()`, `SET LOCAL ROLE authenticated` (or `anon`), and **fails closed** if `current_user` is not that role, `is_superuser`/`pg_roles.rolsuper` is on, **`pg_roles.rolbypassrls` is true**, or `auth.uid()` does not match. `FORCE ROW LEVEL SECURITY` does not constrain `BYPASSRLS` roles. The privileged `postgres` pooler login is for the TCP connection only; tenant rows are not read or written as `postgres`. Supabase JS remains for Auth (cookies, `getUser`, sign-in/out).

Service role is not used for user operations.

## Encryption / BYOK

User API keys are AES-256-GCM encrypted with `BODHA_CREDENTIALS_ENCRYPTION_KEY` and bound to owner + provider + model + base URL as AAD. Ciphertext lives in `llm_settings`. The `llm_settings_status` view hides ciphertext. Application APIs return masked fingerprint only. Keys are never written to localStorage, logs, or model history.

If the encryption key is missing, save/load of user credentials fails closed. Removal deletes the saved credential only.

Immutable snapshots, evidence, and usage are INSERT-only. Idempotent writes insert and, on unique conflict, select the first row. They do not use `ON CONFLICT DO UPDATE` (that requires UPDATE privilege).

Endpoint validation requires HTTPS (HTTP only when `BODHA_ALLOW_HTTP_LLM=true` for operator-approved public hosts), denies private/metadata addresses, and allowlists `BODHA_ALLOWED_LLM_HOSTS`. Connection checks list models and probe tool support. They do not send exercise content. Redirects are not followed. Auth `next` must be an in-app relative path.

## Mastra

Pinned via `@mastra/core` in `apps/app`. Official references:

- https://mastra.ai/docs/agents/overview
- https://mastra.ai/docs/agents/tools
- https://mastra.ai/docs/server/request-context
- https://mastra.ai/models
- https://mastra.ai/integrations/frameworks/next-js

Trainer and review are one Mastra instance with role-specific agents. Generation uses `@ai-sdk/openai` `createOpenAI({ fetch })` with BODHA's protected fetch (origin pin, per-request DNS re-check, `redirect: "manual"`). Mastra's `{ id, url, apiKey }` config is not used because it has no custom fetch hook. Tools must be stored as `supported` after a probe that requires an actual `tool_calls` response; `unknown` and `unsupported` fail closed. Tools are read-only: current session snapshot, evidence, latest test run. Request context supplies `userId`/`sessionId`; model-supplied ids cannot change scope.

Budgets: trainer 6 steps / 45s / 800 output tokens; review 8 steps / 60s / 2000 output tokens, with AbortSignal cancellation. Missing required tool use is an error (no one-shot fallback). Memory/storage is disabled; app records live in Postgres via the Prisma RLS request path. Telemetry of raw prompts is disabled. Tools take a `runWithDb` callback so each tool call is its own short transaction (required for transaction-mode pgbouncer).

Usage: missing is `unknown`, not zero. Cached tokens are recorded separately and never inferred as included in input from `cached <= input`. Report outcome and usage are assembled from stored evidence and usage rows, not from model-authored numbers.

Sessions resume from the immutable exercise snapshot (spec + tests). Autosave uses `expectedUpdatedAt` and surfaces revision conflicts.

## Exercises

Manually maintained in source control:

- `apps/app/challenges/shelf/`
- `apps/app/challenges/cache/`

Each folder needs `meta.json`, `starter/`, `reference/`, `tests.js`. Runtime is **browser JavaScript** via `public/harness.js`. No Node/Python/ML sandboxes.

At session start BODHA stores an immutable snapshot (spec, tests, starter, content hash). Later source edits do not rewrite past snapshots.

Validate:

```bash
pnpm --filter app validate
```

PR review: keep IDs stable (`^[a-z0-9-]+$`), do not rename an id that existing snapshots reference, and run the validate script.

## Disclosure and retention

Capture starts only after explicit consent. Stored: prompts/replies, snapshot, saved session files, browser test summaries, provider usage when returned. Retention: owner-scoped rows until the user is deleted (`ON DELETE CASCADE` from `auth.users`) or a future approved cleanup job. No manager access.

## Deployment (not performed on this branch)

This branch does not deploy to Vercel, Grok, or any other host, and does not apply remote Supabase migrations. Vercel for `apps/app` is a separate operator step after secrets are supplied in the host’s env UI (never committed).

When you are ready:

1. Create a dedicated non-production Supabase project. Do not apply this schema to production or unrelated projects until you choose to.
2. Apply `supabase/migrations/*` from your own machine (`pnpm dlx supabase db push` or the SQL editor). Do not `prisma migrate` and do not reset an existing baseline.
3. Copy `apps/app/.env.example`. Set `NEXT_PUBLIC_SUPABASE_*`, `DATABASE_URL` (port 6543 + `pgbouncer=true`), `DIRECT_URL` (port 5432), `BODHA_CREDENTIALS_ENCRYPTION_KEY` (32 bytes / 64 hex chars), `BODHA_ALLOWED_LLM_HOSTS`, and optional operator defaults. Add `{APP_ORIGIN}/auth/callback` to the Auth redirect allowlist.
4. Deploy only `apps/app` with pnpm (Vercel Install `pnpm install --frozen-lockfile`, Build `pnpm --filter app build`, Output `apps/app/.next`). Preview and production need separate projects and encryption keys.
5. Production is a later step: new project, new encryption key, reviewed migrations, your DNS.

**Executed locally:** Prisma `withUserDb` against PGlite with stub `auth.uid()`. That is not Supabase PostgREST, not the transaction pooler, and not Supabase Auth.

**Not executed by default:** PrismaPg against a real `:6543` pooler, real Auth cookies/`getUser()`, and PostgREST with live user tokens. Those suites are missing from default CI. PrismaPg opt-in requires `BODHA_LIVE_PRISMA_RLS=1` **and** `BODHA_LIVE_ISOLATED_TARGET=1` on a throwaway project you already control; otherwise no connection is opened. Live PostgREST still uses `BODHA_LIVE_SUPABASE_*` plus two user access tokens. No service role.
