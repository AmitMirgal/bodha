# BODHA individual trainer MVP

Open-source individual learning product in `apps/app`. Learners sign in, run two manually maintained exercises, chat with a server-side Mastra trainer, and revisit evidence-grounded reports plus personal daily progress.

This is not a Google interview replica and does not claim feature parity with any other product.

## Package manager

npm workspaces (`packageManager`: `npm@10.8.1`). Nested `apps/app` lockfiles were removed so the root lockfile is the source of truth. Root `.npmrc` sets `legacy-peer-deps=true` because `streamdown` (via `@repo/ai`) requests `react-dom@^19.3.1` while this workspace pins React 19.2.4.

```bash
npm install
npm run dev --workspace=app
npm run test --workspace=app
npm run typecheck --workspace=app
npm run build --workspace=app
npm run lint:bodha --workspace=app   # BODHA sources; parent dirs so `[id]` is not a glob
npm run check   # Ultracite/Biome at repo root (includes unrelated next-forge packages)
npm run validate --workspace=app
```

Biome treats `[id]` in a CLI file argument as a glob character class. Lint those routes by checking `apps/app/src` (or `apps/app/src/app/api/sessions`) rather than the bracketed filename. Tailwind class scanning for `apps/app` uses `@tailwindcss/postcss` `base` (the app directory) plus the design-system stylesheet; there is no separate `sources.css`.

## Environment (placeholders only)

Copy `apps/app/.env.example` to `apps/app/.env.local`. Never commit real values.

| Variable | Role |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public anon/publishable key (RLS still applies) |
| `BODHA_CREDENTIALS_ENCRYPTION_KEY` | 32-byte server encryption key (64 hex chars). Required to store BYOK keys. Fail closed if missing. |
| `BODHA_ALLOWED_LLM_HOSTS` | Comma-separated hosts allowed for OpenAI-compatible base URLs |
| `BODHA_OPERATOR_LLM_*` | Optional operator default. Used only when the user has no saved key. Never silently replaces user BYOK. |
| `BODHA_PROGRESS_TIMEZONE` | Day-bucket timezone (default `UTC`) |

Auth callback: `{APP_ORIGIN}/auth/callback`. Add it to the isolated Supabase project's redirect allowlist. Enable Email auth.

## Isolated Supabase

Use a **nonproduction** project. Do not apply this schema to production or to unrelated projects.

```bash
npx supabase db push   # only against an isolated nonprod project you control
# or paste supabase/migrations/20251108120000_bodha_mvp.sql in the SQL editor
```

Every product table has RLS. Owner is `auth.uid()`. Snapshots have no UPDATE/DELETE policies. Composite foreign keys block forged cross-owner session links. Anonymous roles have no table grants.

Service role is not used for user operations. Server routes use the authenticated cookie client so RLS applies.

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

Budgets: trainer 6 steps / 45s / 800 output tokens; review 8 steps / 60s / 2000 output tokens, with AbortSignal cancellation. Missing required tool use is an error (no one-shot fallback). Memory/storage is disabled; app records live in Supabase. Telemetry of raw prompts is disabled.

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
npm run validate --workspace=app
```

PR review: keep IDs stable (`^[a-z0-9-]+$`), do not rename an id that existing snapshots reference, and run the validate script.

## Disclosure and retention

Capture starts only after explicit consent. Stored: prompts/replies, snapshot, saved session files, browser test summaries, provider usage when returned. Retention: owner-scoped rows until the user is deleted (`ON DELETE CASCADE` from `auth.users`) or a future approved cleanup job. No manager access.

## Deployment (user-owned; nothing is deployed from this branch)

**Nothing was deployed.** Not Vercel, Grok, Cursor Apps, preview, production, DNS, or any other host. Prior “publish on Grok” approval is revoked. You own deployment and hosting secrets.

This agent does not apply remote Supabase migrations or change isolated/production project config. Local tests (PGlite, local OpenAI-compatible fixtures, optional `BODHA_LIVE_*` against a project you already control) stay in-repo.

When you are ready to deploy yourself:

1. Create a dedicated non-production Supabase project first. Do not apply this schema to production or unrelated projects until you choose to.
2. Apply `supabase/migrations/*` from your own machine (`npx supabase db push` or the SQL editor) against that project.
3. Copy `apps/app/.env.example` to `apps/app/.env.local` (and later to your host’s env). Set `NEXT_PUBLIC_SUPABASE_*`, `BODHA_CREDENTIALS_ENCRYPTION_KEY` (32 bytes / 64 hex chars), `BODHA_ALLOWED_LLM_HOSTS`, and optional operator defaults. Add `{APP_ORIGIN}/auth/callback` to the Supabase Auth redirect allowlist.
4. Deploy `apps/app` to a host you choose. Configure the same env vars there. Do not reuse preview data or encryption keys across environments.
5. Production is a separate later step: new project, new encryption key, reviewed migrations, your DNS.

PGlite RLS tests are not Supabase PostgREST. Live `BODHA_LIVE_*` tests use user access tokens only (no service role) and are skipped unless those vars are set.
