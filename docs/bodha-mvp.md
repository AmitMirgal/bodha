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
npm run check   # Ultracite/Biome at repo root
npm run validate --workspace=app
```

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

User API keys are AES-256-GCM encrypted with `BODHA_CREDENTIALS_ENCRYPTION_KEY` and bound to the owner id as AAD. Ciphertext lives in `llm_settings`. The `llm_settings_status` view hides ciphertext. Application APIs return masked fingerprint only. Keys are never written to localStorage, logs, or model history.

If the encryption key is missing, save/load of user credentials fails closed. Removal deletes the saved credential only.

Endpoint validation requires HTTPS, denies private/metadata addresses, and allowlists `BODHA_ALLOWED_LLM_HOSTS`. Connection checks list models only and do not send exercise content.

## Mastra

Pinned via `@mastra/core` in `apps/app`. Official references:

- https://mastra.ai/docs/agents/overview
- https://mastra.ai/docs/agents/tools
- https://mastra.ai/docs/server/request-context
- https://mastra.ai/models
- https://mastra.ai/integrations/frameworks/next-js

Trainer and review are one Mastra instance with role-specific agents. Model is `{ id, url, apiKey }` OpenAI-compatible from the owner's resolved config (user BYOK, else operator default). Tools are read-only: current session snapshot, evidence, latest test run. Request context supplies `userId`/`sessionId`; model-supplied ids cannot change scope.

Budgets: trainer 6 steps / 45s; review 8 steps / 60s. Missing tool use is an error (no one-shot fallback). Memory/storage is disabled; app records live in Supabase. Telemetry of raw prompts is disabled.

Usage: missing is `unknown`, not zero. Cached tokens are recorded separately and never blindly added to input.

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

## Preview / Grok / production

Grok Build publishes to `grok.me` from a Grok chat (web/iOS/Android): describe an app, preview it in the conversation, then use the in-chat Publish sheet. That is not a Cursor Cloud Agent, X MCP, or CLI deploy API. This environment has no `grok`/`grok-build` binary, no grok.me publish tool, and no way to host this Next.js + external-Supabase + encrypted-BYOK app as a Grok Build project without rewriting it into Grok's in-chat stack (which would drop the required host). Parent is checking Grok-side publishing separately.

Cursor Live Apps is a different host and is not authorized by the Grok-only publish approval. Isolated Live Apps secrets were not present, so no Live Apps preview was started. Public production, DNS, paid resources, and production Supabase migrations remain on hold.

This branch is the full `apps/app` trainer, not a Canvas mock.

## Production setup (not executed)

1. Create a dedicated production Supabase project.
2. Apply `supabase/migrations/*` after review.
3. Set production env vars (encryption key, allowed hosts, callback URLs).
4. Deploy `apps/app` to an approved host with those secrets.
5. Do not reuse preview data or encryption keys.
