# Mati editor capture (design)

Coaching for AI-assisted development in **Cursor** and **VS Code** only. A developer installs one Mati extension, consents once, does a task with no sign-in, and gets a per-task report: prompts used, token usage for that task, and how to change the prompts to reach the intended outcome. Progress shows that skill over time.

This document is the contract. Implementation PRs follow it and edit this file when the code proves a section wrong.

Docs re-checked 2026-11-09:

- Cursor hooks: [cursor.com/docs/agent/hooks](https://cursor.com/docs/agent/hooks)
- Cursor Admin API: [cursor.com/docs/account/teams/admin-api](https://cursor.com/docs/account/teams/admin-api)
- VS Code Copilot hooks (Preview): [code.visualstudio.com/docs/agent-customization/hooks](https://code.visualstudio.com/docs/agent-customization/hooks)
- Copilot harness event payloads: [docs.github.com/en/copilot/reference/hooks-configuration](https://docs.github.com/en/copilot/reference/hooks-configuration)
- Legacy Local hooks: [code.visualstudio.com/docs/agents/reference/hooks-reference](https://code.visualstudio.com/docs/agents/reference/hooks-reference)
- Copilot OTel: [code.visualstudio.com/docs/copilot/guides/monitoring-agents](https://code.visualstudio.com/docs/copilot/guides/monitoring-agents)

## 1. Data shapes

A **CaptureTask** is one editor Agent conversation. It is not a trainer `Session` (`sessions.exercise_id`, harness, snapshots). Do not reuse those tables.

| Editor field | Maps to |
| --- | --- |
| Cursor `conversation_id` (hooks also call this `session_id` on `sessionStart` / `sessionEnd`) | `EditorTaskId` |
| Copilot harness `sessionId` | `EditorTaskId` |
| Copilot Local harness `session_id` | `EditorTaskId` |
| Copilot OTel `gen_ai.conversation.id` | join key onto the same `EditorTaskId` (verify in Phase 3; if they diverge, store both and join on a recorded mapping) |
| Cursor `generation_id` | a turn inside the task, not a new task |

One conversation, many turns, one `CaptureTask`. Idle close after 6 hours with no events. Explicit close on Cursor `sessionEnd` / `stop`, Copilot `sessionEnd` / `agentStop`.

```ts
type DeviceId = string & { readonly __brand: "DeviceId" };
type CaptureTaskId = string & { readonly __brand: "CaptureTaskId" };
type EditorTaskId = string & { readonly __brand: "EditorTaskId" };
type EventId = string & { readonly __brand: "EventId" };
type IdempotencyKey = string & { readonly __brand: "IdempotencyKey" };

type Editor = "cursor" | "vscode";
type TaskStatus = "open" | "closed";

/** Vendor-reported vs guessed vs absent. Never invent a number and call it measured. */
type UsageProvenance = "measured" | "estimated" | "missing";

type UsageSource =
  | "copilot_otel_chat_span"
  | "cursor_admin_api"
  | "text_estimate"
  | "none";

interface DeviceIdentity {
  deviceId: DeviceId; // UUID, public
  tokenHash: string; // SHA-256 of the secret; secret never stored
  createdAt: string; // ISO-8601
  claimedUserId: string | null; // auth.uid() after pairing
  consent: Consent;
}

interface Consent {
  version: 1;
  grantedAt: string;
  /** What the first-run screen listed as uploaded. */
  scopes: Array<
    | "prompt_text"
    | "response_text"
    | "file_edit_paths"
    | "usage"
    | "context_size"
  >;
}

interface CaptureTask {
  id: CaptureTaskId;
  deviceId: DeviceId;
  userId: string | null; // null until claimed
  editor: Editor;
  editorTaskId: EditorTaskId;
  status: TaskStatus;
  startedAt: string;
  finishedAt: string | null;
  workspaceHash: string; // SHA-256 of workspace root(s); no home path
}

interface PromptEvent {
  kind: "prompt";
  taskId: CaptureTaskId;
  editorTaskId: EditorTaskId;
  occurredAt: string;
  generationId: string | null; // Cursor generation_id; Copilot: none
  text: string; // redacted
  attachmentNames: string[]; // basenames only
}

interface ResponseEvent {
  kind: "response";
  taskId: CaptureTaskId;
  editorTaskId: EditorTaskId;
  occurredAt: string;
  generationId: string | null;
  text: string; // redacted assistant final text
}

interface FileEdit {
  kind: "file_edit";
  taskId: CaptureTaskId;
  editorTaskId: EditorTaskId;
  occurredAt: string;
  path: string; // relative to workspace root
  editCount: number;
  /** Present only after the file-edit-snippet consent scope exists. */
  snippets: Array<{ oldText: string; newText: string }> | null;
}

interface ContextCompact {
  kind: "context_compact";
  taskId: CaptureTaskId;
  editorTaskId: EditorTaskId;
  occurredAt: string;
  contextTokens: number;
  contextWindowSize: number;
  contextUsagePercent: number;
  trigger: "auto" | "manual" | "unknown";
}

/**
 * Token usage for one model call or one closed task rollup.
 * preCompact contextTokens are NOT stored here.
 */
interface UsageRecord {
  kind: "usage";
  taskId: CaptureTaskId;
  editorTaskId: EditorTaskId;
  occurredAt: string;
  operationId: string; // idempotent per call
  provenance: UsageProvenance;
  source: UsageSource;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  reasoningTokens: number | null;
  model: string | null;
}

type CaptureEvent =
  | PromptEvent
  | ResponseEvent
  | FileEdit
  | ContextCompact
  | UsageRecord;

interface IngestBatch {
  editor: Editor;
  editorTaskId: EditorTaskId;
  workspaceHash: string;
  events: Array<{
    idempotencyKey: IdempotencyKey;
    kind: CaptureEvent["kind"] | "session_end";
    occurredAt: string;
    generationId?: string | null;
    text?: string;
    attachmentNames?: string[];
    reason?: string;
  }>;
}
```

Provenance rules:

- **measured:** editor or vendor API reported the count. Copilot OTel `gen_ai.usage.*` on a `chat` span; Cursor Admin API `tokenUsage` when a team key is present.
- **estimated:** no vendor count; extension used a documented estimator (Phase 2: Unicode length / 4). The number is stored with `source: "text_estimate"`. It is never shown as a measured total.
- **missing:** no count. All token fields are `null`. Do not fill zeros.

Existing trainer `usage_records.coverage` (`complete` / `partial` / `unknown`) stays on trainer sessions. Capture rows carry `provenance` + `source`. When a LearningReport is assembled for an editor task, map `measured` → `complete` or `partial`, `estimated` → `partial` plus an `insufficientEvidence` note, `missing` → `unknown` with nulls.

## 2. Capture per editor

The extension never blocks the agent. Hook scripts always exit 0 and write `{}` (Copilot) or `{"continue": true}` (Cursor `beforeSubmitPrompt`). Observation only.

Hook processes cannot talk to the extension host. Each hook appends one JSON line to `~/.mati/queue/<deviceId>.jsonl`. The extension watches that file, redacts, and POSTs. Do not read `transcript_path` / `CURSOR_TRANSCRIPT_PATH`. Do not read `state.vscdb`. Do not intercept HTTPS.

### Cursor (Agent Chat)

User-level config `~/.cursor/hooks.json` (`version: 1`). Project `.cursor/hooks.json` is not written (shared repos must not pick up Mati).

On consent, merge a Mati-owned block. On disable or uninstall, remove only that block and `~/.mati/hooks/cursor.*`. Leave other hooks.

| Hook | Why | Fields used |
| --- | --- | --- |
| `sessionStart` | open task | `session_id` (= `conversation_id`), `composer_mode` |
| `beforeSubmitPrompt` | prompt text | `prompt`, `attachments[].file_path` → basename |
| `afterAgentResponse` | assistant text | `text` |
| `afterFileEdit` | agent edits | `file_path`, `edits.length` (snippets later) |
| `preCompact` | context size signal | `context_tokens`, `context_window_size`, `context_usage_percent`, `trigger` |
| `stop` / `sessionEnd` | close task | `status` / `reason`, `duration_ms` |

Common fields on Agent hooks: `conversation_id`, `generation_id`, `model`, `hook_event_name`. **Drop `user_email`.** Do not upload `workspace_roots` raw; hash them.

**Not captured**

- Tab (`beforeTabFileRead`, `afterTabFileEdit`)
- Cmd+K / inline edit (no documented hook)
- `afterAgentThought` (reasoning dumps; see open questions)
- `beforeReadFile` file contents
- Shell / MCP stdout
- Cloud Agent user hooks (`~/.cursor/hooks.json` is not loaded in cloud VMs)
- Cursor OTel (Enterprise only; out of scope)

**Tokens.** Hooks have no per-request input/output/cached counts. Default provenance is `missing`. Optional later: team Admin API `POST https://api.cursor.com/teams/filtered-usage-events`, join `conversationId` → `EditorTaskId`, use `tokenUsage.{inputTokens,outputTokens,cacheWriteTokens,cacheReadTokens}`. Hourly aggregation. Needs a team admin key Amit stores as operator config, not in the extension.

Writing `~/.cursor/hooks.json` from a VS Code-compatible extension is **not a documented Cursor API**. Phase 1 writes that file only after consent (and removes the Mati block on stop/uninstall) because a `.cursor-plugin` is not proven here to register Agent hooks. Revisit if Cursor documents a plugin hook API.

### VS Code / Copilot (Preview)

Target the **Copilot** session harness, not Claude/Codex and not the legacy Local harness as the primary path.

User hooks: `~/.copilot/hooks/mati.json` (or `$COPILOT_HOME/hooks/`). Do not write `.github/hooks/` into the developer's repo.

| Copilot event | Local alias | Why | Fields used |
| --- | --- | --- | --- |
| `sessionStart` | `SessionStart` | open / resume | `sessionId`, `source` |
| `userPromptSubmitted` | `UserPromptSubmit` | prompt text | `prompt`, `sessionId` |
| `postToolUse` | `PostToolUse` | file edits when `toolName` is an edit tool | `toolName`, `toolArgs` (path only) |
| `preCompact` | `PreCompact` | context size | documented compact fields if present |
| `agentStop` / `sessionEnd` | `Stop` / `SessionEnd` | close | `reason` |

Command-hook stdout is ignored for `userPromptSubmitted`. That is fine: we only read stdin.

**Measured tokens:** Copilot Chat OTel, file exporter, **content capture off**.

```json
{
  "github.copilot.chat.otel.enabled": true,
  "github.copilot.chat.otel.exporterType": "file",
  "github.copilot.chat.otel.outfile": "~/.mati/otel/copilot.jsonl",
  "github.copilot.chat.otel.captureContent": false,
  "github.copilot.chat.otel.captureIdentity": false
}
```

Join `chat` spans:

- `gen_ai.conversation.id` → `EditorTaskId`
- `gen_ai.usage.input_tokens` / `output_tokens`
- `gen_ai.usage.cache_read.input_tokens` / `cache_creation.input_tokens`
- `gen_ai.usage.reasoning.output_tokens` (legacy: `gen_ai.usage.reasoning_tokens`)
- `gen_ai.request.model`

Do not enable `captureContent` (prompts already come from hooks). Do not enable `captureIdentity`.

If the user already has OTel enabled with another exporter, **do not overwrite**. Phase 3 records that as `missing` usage and tells the user in the report. `github.copilot.chat.otel.exporterType` is a single value.

VS Code `LanguageModelChatResponse` has no usage in the stable API. Do not use it for counts.

**Not captured:** inline completions / Tab, inline chat, Claude/Codex harness sessions, cloud Copilot sessions (local hook files are not copied).

Copilot hooks are **Preview**. Event names and payloads differ by harness (camelCase Copilot vs PascalCase Local). The script must accept both `sessionId` and `session_id`.

### Install / remove

1. First run **in that workspace**: consent webview lists scopes, shows a sample payload, requires an explicit Accept. Consent is stored in `workspaceState` (`mati.consent.v1`). A workspace that has not accepted must not capture; it gets a status-bar item and a non-intrusive prompt.
2. Create `DeviceIdentity` (UUID + 32-byte token in `SecretStorage`) once per machine. Register with `POST /api/capture/v1/devices`. Later workspaces reuse the token.
3. Write hook files, `~/.mati/capture-gate.json`, and the queue directory. Cursor: merge `~/.cursor/hooks.json` (create if missing; do not clobber other hooks) and copy `cursor.mjs` **and** `enqueue.mjs` into `~/.cursor/hooks/mati/` plus `~/.mati/hooks/`. Fail the install with a visible error if the write cannot be verified. VS Code: write `mati.json` and, if OTel is free, file exporter settings.
4. After consent, opening the workspace auto-starts capture. `capture-gate.json` uses per-window holders: `capturing` is true while **any** consented, unpaused window is open. An unconsented window must only drop **its** holder. **Mati: Stop capturing** pauses (persists in `workspaceState` until resume) and releases this window's holder; it does **not** uninstall hooks. **Mati: Start capturing** resumes. `deactivate` releases this window's holder; it does not clear consent. Drain re-merges `hooks.json` if Cursor stripped the Mati block. **Mati: Diagnose capture** shows server URL, device, gate, hooks path, queue count, and last upload.
5. Task splits: idle (`mati.idleMinutes`, default 30), git branch change, workspace folder change, plus **Mati: New task** / **Mati: End task**. Splits keep the ingest shape (`editorTaskId` + `session_end`).
6. Uninstall path: leftover `~/.mati` is removed by **Mati: Delete my capture data** or by deleting the folder.

## 3. On-device redaction

Run on the JSONL line **before** enqueue to the network. The consent screen shows the post-redaction sample.

Mask, do not drop the event:

- PEM / `BEGIN PRIVATE KEY`
- AWS access keys (`AKIA…`)
- GitHub tokens (`ghp_`, `github_pat_`)
- Slack / Stripe-looking live keys
- JWT-shaped `eyJ…`
- `Bearer` + token
- `.env`-style `KEY=value` on a line matching known secret names (`API_KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE_KEY`)

Replacement: `[redacted:<class>]`.

Also:

- Strip Cursor `user_email`
- Store file **basenames** and workspace-relative paths; never `$HOME`
- Cap prompt/response text at 32 KiB per event
- Do not upload `beforeReadFile` content or OTel content attributes

Limits: pattern redaction misses novel secrets, pasted production data, and secrets inside attachments the hook never sees. The UI must say that. There is no guarantee of a clean upload.

## 4. Ingest, storage, claim, deletion

All routes live in `apps/app` under `/api/capture/v1`. Parse with Zod at the boundary. Auth is the device bearer, not Supabase Auth and not anonymous sign-in (the trainer still forbids anonymous Auth).

```
Authorization: Bearer mati_dev_<secret>
```

Look up `sha256(secret)` → `devices`. Then `withDeviceDb(deviceId, …)`: `SET LOCAL ROLE device`, set `request.jwt.claims` to `{"role":"device","device_id":"<uuid>"}`, fail closed on `rolbypassrls` the same way `withUserDb` does. Do not use `withAnonDb`. Do not use the service role.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/capture/v1/devices` | Create device; returns `deviceId` + secret once |
| `POST` | `/api/capture/v1/events` | Batch events; per-event idempotency |
| `POST` | `/api/capture/v1/tasks/{editorTaskId}/close` | Close if `sessionEnd` was missed |
| `GET` | `/api/capture/v1/tasks` | List this device's tasks (extension + viewer) |
| `GET` | `/api/capture/v1/tasks/{id}` | One task + events |
| `POST` | `/api/capture/v1/pair/start` | Authenticated user: create pairing code |
| `POST` | `/api/capture/v1/pair/claim` | Device token + code → set `user_id` |
| `DELETE` | `/api/capture/v1/device` | Wipe this device's rows + revoke token |

Idempotency: header `Idempotency-Key` on the batch **and** `events[].idempotencyKey` of the form `{deviceId}:{editor}:{editorTaskId}:{kind}:{generationId|operationId|sha256(body)}`. Unique on `(device_id, idempotency_key)`. Retry is a no-op.

Limits (unclaimed, enforced in the route before insert):

- 60 requests / device / minute
- 256 KiB body
- 100 events / batch
- 10_000 events / device
- 90-day TTL on unclaimed rows (pg cron or a sweep job in a later PR)

Over limit: `429` or `413` with a stable error code. No partial silent drop inside a batch; reject the batch or accept all new keys.

### Tables (Prisma migrations under `apps/app/prisma/migrations/`)

Do not put capture rows in `sessions` / `evidence_events` / `usage_records`. Those require `user_id` + `exercise_id` and FORCE RLS tied to `auth.uid()`.

```
devices (id uuid pk, token_hash text unique, claimed_user_id uuid null references profiles, consent jsonb, created_at)
capture_tasks (id, device_id, user_id null, editor, editor_task_id, status, started_at, finished_at, workspace_hash)
capture_events (id, task_id, device_id, user_id null, kind, payload jsonb, idempotency_key, occurred_at)
capture_usage (id, task_id, device_id, user_id null, operation_id, provenance, source, input_tokens, output_tokens, cached_tokens, reasoning_tokens, model, native jsonb)
pairing_codes (id, user_id, code_hash, expires_at, consumed_at) — Phase 4
```

Unique: `capture_tasks (device_id, editor, editor_task_id)`, `capture_events (device_id, idempotency_key)`, `capture_usage (task_id, operation_id)`.

FORCE RLS on all five. Policies:

- role `device`: `device_id = (request.jwt.claims->>'device_id')::uuid`
- role `authenticated`: `user_id = auth.uid()` (claimed rows only)
- role `anon`: no access

After claim, the extension keeps the same device token. Ingest still uses role `device`. The dashboard uses `withUserDb`.

### Viewer without an account

The extension command **Mati: Open report** opens `{APP_ORIGIN}/capture/d/{deviceId}?v=<signed-viewer>`. The viewer cookie is an HMAC of `deviceId` with a server secret (`MATI_CAPTURE_VIEWER_SECRET`), 7-day expiry, rotated on demand. It is **not** a Supabase session. The page is read-only: task list, prompts, usage labels, later the learning report. Trainer exercises stay behind `/login`.

### Claim

1. Signed-in user at `/settings` generates a 8-character pairing code (10-minute TTL, hashed at rest).
2. Extension command **Mati: Claim this device** submits the code with the device bearer.
3. Transaction: `devices.claimed_user_id = auth.uid()`, copy `user_id` onto that device's tasks/events/usage, consume the code.
4. Viewer URLs keep working for that device. `/progress` starts listing claimed editor tasks.

### Deletion

`DELETE /api/capture/v1/device` with the bearer cascades all capture rows for that `device_id`, deletes the device row, and the extension clears SecretStorage. Claimed users also get **Delete editor capture** on `/settings`, which runs the same wipe via `withUserDb` on `user_id` + selected `device_id`. Trainer `sessions` are untouched.

## 5. Per-task report and Progress

Reuse `assembleLearningReport` / `reportSchema` in `apps/app/src/lib/reports/`. Do not invent a second coaching agent. Changes needed when implementation starts:

- Evidence list is `capture_events` for that `CaptureTask`, not trainer `evidence_events`. Citation kinds already include `prompt`, `assistant`, `usage`, `consent`. Add `file_edit` if snippets are stored.
- `observations.tests` will be `found: false`, `provenance: "insufficient_evidence"` (no browser harness). Copy must not say tests passed.
- `outcome.observed` from `stop`/`sessionEnd` reason. `verificationProvenance: "insufficient_evidence"`.
- Usage block: add an `editor` side next to `trainer` / `review`, or map editor rows into a dedicated card. **Do not** put editor tokens in `usage.trainer`.
- Mastra review agent keeps bounded read-only tools over **this task's** evidence. Same citation validation (`validateReportAgainstEvidence`). Review-agent tokens stay in `usage.review` with provider-reported coverage; they are not mixed into the editor total.

Report copy for tokens:

- measured, complete: show input / output / cached / reasoning and “Reported by {source}.”
- measured, partial: show known fields; name the missing field; “Partial vendor report.”
- estimated: show the estimate with “Estimated from text length ({source}). Not vendor-reported. Do not compare with measured totals.”
- missing: omit numeric totals. “Token counts were not available from {editor} for this task. Totals are omitted, not guessed.”

Progress (`/progress` today lists trainer sessions, timezone-bucketed, explicitly not a score). After claim:

- Same day buckets (`PROGRESS_TIMEZONE`).
- Two labeled lists, or one list with `source: trainer | editor`. Do not mix into one unlabeled count.
- Trends that use tokens include **measured** rows only. Estimated/missing tasks count as “tasks with prompts” but do not enter the token sparkline.
- Improvement signal is coaching-oriented: tasks completed, prompts per task, whether later reports cite fewer “missing intent / missing file” suggestions. No invented 0–100 skill score.

Unclaimed developers see the same task report on the device viewer, not `/progress` (that route stays `requireUser`).

## 6. Packaging

One extension, one publisher, two stores.

- Path: `extensions/mati` (add `extensions/*` to `pnpm-workspace.yaml` in the implementation PR).
- `engines.vscode` compatible with current VS Code and Cursor (Cursor is a VS Code fork; the same `.vsix` loads in both).
- Desktop only. Hooks need a local filesystem. No browser/Codespaces target in Phase 1.
- Publish: `vsce` to VS Code Marketplace (prefer OIDC trusted publishing) and `ovsx` to Open VSX. One `.vsix` for both.
- Display name **Mati**, id `mati`, Apache-2.0 to match the repo.
- Production Marketplace publish needs Amit's approval (same rule as production app deploy).

## 7. Phased PRs

Each PR is separately mergeable and has a check you can run without a production migrate.

Docs layout: later phases append only a `Phase N implementation notes` paragraph under their own heading, and only their own `extensions/mati/README.md` section (`## Claim and deletion`, `## Reports`, `## Cursor Admin API`, `## Packaging`, and so on). Do not rewrite earlier phase notes or the shared Use steps.

**Phase 1 — thinnest end-to-end (Cursor prompts only).** Device register, consent webview, Cursor user hooks (`beforeSubmitPrompt`, `afterAgentResponse`, `sessionEnd`), JSONL queue, `POST /events`, device viewer lists prompts. Usage rows stored as `missing`. No Copilot, no claim, no Mastra review, no Progress change. The device id is the bearer lookup, not a client-supplied `deviceId` field.  
Check: documented Cursor hook payloads through `hooks/cursor.mjs` land in local Postgres via ingest and render on the device viewer. Vitest: ingest idempotency + device RLS fixture (PGlite).

**Phase 2 — redaction + estimates + file paths + preCompact.** Redaction fixtures (AWS key in a prompt is `[redacted:aws_access_key]` in the stored payload). Text-length estimate labeled `estimated` / `text_estimate` (Unicode length / 4, undercount). `afterFileEdit` paths only. `preCompact` as `ContextCompact`, not usage.  
Check: fixture test file of secrets; viewer shows estimate copy, not a naked number.

**Phase 3 — VS Code Copilot.** Copilot harness hooks + OTel file exporter join. Accept both payload shapes. If OTel already configured, leave it and keep usage `missing`.  
Check: VS Code Copilot Agent session shows measured tokens from a recorded `chat` span fixture; `captureContent` remains false.

Phase 3 implementation notes (2026-11-09): Copilot user hooks are a dedicated `~/.copilot/hooks/mati.json` with both Preview camelCase and Local PascalCase event keys. The command hook replies `{}` and always exits 0. OTel join uses `gen_ai.conversation.id` as `EditorTaskId`, the same field Copilot hooks call `sessionId` / `session_id`. That join is proven against recorded span fixtures in this repo, not yet against a live Copilot Agent session. If those ids diverge in the wild, store both. `github.copilot.chat.otel.captureContent` is written `false` whenever Mati owns the file exporter; content attributes on a span are ignored even if a user later turns capture on.

**Phase 4 — claim, deletion, live RLS.** Pairing code, `user_id` backfill, `DELETE` wipe, authenticated `/progress` still empty until Phase 5.  
Check: `MATI_LIVE_PRISMA_RLS` style test: device A cannot `SELECT` device B; after claim, `auth.uid()` sees the rows; delete leaves zero rows for that device.

Phase 4 implementation notes (2026-11-09): pairing consume is `mati_consume_pairing_code(code_hash)` SECURITY DEFINER, execute granted to `device` only. Pairing rows stay user-RLS; the device JWT does not read `pairing_codes`. Unclaimed TTL is role `capture_janitor` deleting devices with `claimed_user_id is null` and `created_at < now() - 90 days`. This agent does not schedule pg_cron and does not apply the migration to a remote project. `/progress` is unchanged in this phase.

**Phase 5 — learning report + Progress.** Wire `assembleLearningReport` to `capture_events`; Mastra review tools read only that task; `/progress` lists claimed editor tasks separately from trainer sessions.  
Check: report suggestions cite prompt evidence ids; token card uses the four copy states above; Progress day bucket shows the claimed task.

Phase 5 implementation notes (2026-11-09): `assembleEditorLearningReport` maps capture events into the existing report schema, adds optional `usage.editor`, and forces `observations.tests.found: false`. Progress keeps trainer `days`/`trend` and adds `editor` with its own day buckets and measured-only bars. Mastra `mati-capture-review` can only call `get-capture-evidence` and `get-capture-usage` scoped to the request-context task id. Unclaimed devices still use the device viewer, not `/progress`.

**Phase 6 — optional Cursor Admin API.** Operator-configured team key; join `conversationId`; upgrade provenance to `measured` when a match exists.  
Check: without the key, behavior is unchanged; with a recorded API fixture, usage becomes measured.

Phase 6 implementation notes (2026-11-09): the team key is stored per signed-in user in `cursor_admin_settings`, encrypted with `MATI_CREDENTIALS_ENCRYPTION_KEY` and AAD bound to `cursor_admin` / `filtered-usage-events` (same `encryptSecret` path as BYOK). It is not an env var and is not written to the extension. Join is `conversationId` → `EditorTaskId` against a recorded `filtered-usage-events` fixture. Without a stored key, capture usage is unchanged.

**Phase 7 — packaging.** `extensions/mati` build, vsce/ovsx dry-run, uninstall removes Mati hook entries.  
Check: `vsce package` produces a `.vsix` that installs in VS Code and Cursor; after uninstall, `~/.cursor/hooks.json` has no Mati command.

Phase 7 implementation notes (2026-11-09): `pnpm --filter mati package` compiles `src` to CommonJS `dist` and runs `vsce package --no-dependencies`. GitHub Actions workflow `mati-extension.yml` typechecks, tests, and uploads the `.vsix`. Jobs `publish-vscode-marketplace` and `publish-open-vsx` are `if: false`. Uninstall already removes only the Mati `hooks.json` block (see `removeMatiHooks` tests). This agent does not publish.

## 8. Open questions (Amit)

1. Device viewer (signed URL, no Mati account) vs forcing claim before any dashboard — **viewer**. “No sign-in” is a complete loop.
2. Upload `afterAgentThought` text? **No.**
3. Upload `afterFileEdit` snippets vs paths only? **Paths only** until a new consent version.
4. Keep writing `~/.cursor/hooks.json`, or also ship a Cursor plugin? **hooks.json after consent** until a plugin is proven to register Agent hooks.
5. Remote SSH / WSL / Dev Containers: hooks run on the remote filesystem. In or out for v1?
6. Retention after claim (90-day unclaimed TTL is specified; claimed retention is not).
7. Marketplace publisher id and whether Open VSX is required for Cursor's marketplace.
8. Production ingest origin the extension should pin (`mati` domain vs preview).
9. Should Progress ever mix trainer exercises and editor tasks in one chart? **No.** Separate sections/charts.

## 9. Risks

- Copilot hooks are Preview; camelCase vs Local PascalCase payloads are easy to mix up.
- Merging `~/.cursor/hooks.json` from an extension is undocumented. A Cursor update can ignore or overwrite user hooks. Enterprise cloud distribution rewrites `~/.cursor/managed/…` and is a different path.
- Cursor Admin `conversationId` vs hook `conversation_id` is documented as a join key but not proven in this repo.
- Copilot `sessionId` vs OTel `gen_ai.conversation.id` must be proven in Phase 3.
- `github.copilot.chat.otel.exporterType` is singular; we can fight the user's existing collector.
- Cmd+K, Tab, inline chat, Claude/Codex harnesses, Cursor cloud agents, and Copilot cloud sessions are **blind spots**. The report must not imply they were observed.
- If a Mati hook ever returns deny / `continue: false`, we break the developer's agent. Treat that as a P0 in review.
- Redaction will miss secrets. Do not claim otherwise.
- Existing `withAnonDb` looks like a shortcut and is the wrong identity for this product.

## Alternatives considered

**A (chosen): capture tables + device role.** Event log keyed by `device_id`, Task derived from `EditorTaskId`, claim copies `user_id`. Trainer `sessions` stay exercise-shaped. Matches idempotent ingest, crash-safe queues, and FORCE RLS without ghost users.

**B (rejected): ghost `profiles` row per device, reuse `sessions`.** Would reuse Progress and reports sooner, but `sessions.exercise_id`, `exercise_snapshots`, and report `snapshot_id` are mandatory. Anonymous Auth is explicitly off. Mixing editor traffic into trainer RLS would make “unclaimed isolation” a synthetic user hack.

Phase 3 implements Copilot hooks + OTel file-export join on top of A.
