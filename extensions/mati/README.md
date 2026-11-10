# Mati editor capture

Captures Cursor Agent and Copilot Chat prompts in a workspace so you can see which prompts you used and later how to improve them. There is no sign-in.

Cursor hooks have no vendor token counts; any estimate is labelled and undercounts. Copilot Chat can report measured tokens from OpenTelemetry `chat` spans when Mati is allowed to write a file exporter. `github.copilot.chat.otel.captureContent` stays false.

This package is not published to the VS Code Marketplace or Open VSX.

## Use

Consent is **one-time per workspace** and explicit. A workspace that has never accepted must not capture; Mati shows a status-bar item and a non-intrusive prompt instead.

1. Open the workspace. If you have not consented here, click **Start capturing** on the prompt or run **Mati: Start capturing** and Accept. That registers an anonymous device token (reused on this machine) and writes hook files.
2. After this workspace has consented, capture **starts automatically** the next time you open it. You do not run Start on every launch.
3. The status bar shows capturing / paused / off / not consented. It follows the **gate and hooks.json**, not only local consent: if this workspace consented but hooks are missing or the gate is false, it shows a warning and **Mati: Diagnose capture**. Click the record/pause item to pause or resume. Pause persists until you resume. **Mati: Stop capturing** pauses (hooks stay installed); **Mati: Start capturing** resumes if this workspace already consented.
4. Send an Agent prompt in Cursor or Copilot Chat.
5. Run **Mati: Open report** to open the signed device viewer. **Mati: Diagnose capture** prints server URL, device registration, gate, `hooks.json` path, queue count, and last upload.

**Mati: New task** and **Mati: End task** correct task boundaries. Mati also starts a new task after `mati.idleMinutes` (default 30) with no events, and when the git branch or workspace folders change. The server still keys tasks by `editorTaskId`; splits append `#mN` and send `session_end` for the previous id.

**Mati: Delete my capture data** removes hooks, the device token, and this workspace's consent.

## What is automatic vs not

Mati does not read the Agent transcript APIs. Capture only exists where Cursor or Copilot invoke **user-level hook files** (and Copilot OTel, if Mati was allowed to write a file exporter).

| Source | After workspace consent, no extra click? | Evidence |
| --- | --- | --- |
| Cursor Agent prompts/responses/edits | Yes, once `~/.cursor/hooks.json` contains the Mati command | Cursor documents Agent hooks; this extension merges that file after Accept. There is no API to read past chats at startup. |
| Copilot Chat hooks (Preview) | Yes, once `~/.copilot/hooks/mati.json` exists | Copilot Preview/Local hook files. Event names differ by harness. |
| Copilot token counts | Only if Mati could write the OTel file exporter | `github.copilot.chat.otel.exporterType` is a single value; an existing exporter is left alone and usage stays missing. `captureContent` stays false. |
| Inline completions, Cmd+K, Claude/Codex harnesses, cloud Agent sessions | No | Those never hit these hook files. |

Hooks are **user-level**, not per-window. After consent, `~/.cursor/hooks.json` must contain `./hooks/mati-capture.sh` (created if the file was missing; other hooks are kept). The wrapper runs `cursor.mjs` with `enqueue.mjs` beside it — copying only `cursor.mjs` into `~/.mati/hooks/` is not enough.

`~/.mati/capture-gate.json` lists window **holders**. `capturing` is true while any consented, unpaused window holds the gate. A second window that has not consented must not flip the gate to false. Pause/close releases only that window's holder. Hook scripts still enqueue only when `capturing` is true.

Closing the last capturing window turns the gate off. Reopening a consented, unpaused workspace claims a holder, re-merges hooks if needed, and drains `~/.mati/queue`.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `mati.serverUrl` | `""` | App origin. Precedence: `MATI_APP_ORIGIN` env, then this setting, then a stored `mati.appOrigin` secret, then `http://127.0.0.1:3000`. Trailing slashes are stripped. Read at command time. |
| `mati.idleMinutes` | `30` | Idle gap before a new task (1–1440). |

## Claim and deletion

To attach the device to a Mati account: generate a pairing code on Settings, then run **Mati: Claim this device**. Unclaimed devices older than 90 days are eligible for sweep. Claimed editor data can also be deleted from Settings. Trainer sessions are never deleted by these commands.

## Reports

Claimed editor tasks get a learning report from captured events. `/progress` keeps trainer days and adds a separate Editor section. Estimated tokens stay labelled and out of the measured bars.

## Cursor Admin API

Signed-in users can store an optional Cursor team Admin API key on Settings. It is encrypted like BYOK (`MATI_CREDENTIALS_ENCRYPTION_KEY`) and is not stored in the extension. Without a key, capture usage stays estimated or missing.

## Packaging

CI builds a `.vsix` (including `media/icon.png`) and runs tests; the publish jobs are disabled (`if: false`). Do not run `vsce publish` or `ovsx publish` from this repo until Amit approves.

## Local testing

Point the extension at a local or preview app without launching Cursor from a terminal:

1. Start the app (`pnpm --filter app dev` from the repo root, or your preview URL).
2. `pnpm --filter mati package` and install the `.vsix` (Extensions: Install from VSIX).
3. In Cursor: **Settings → Extensions → Mati → Server URL** (`mati.serverUrl`) to `http://127.0.0.1:3000`.
4. Open a workspace that has **not** consented: confirm the status bar shows Mati off and a prompt appears; no `~/.mati/queue` lines should appear until you Accept.
5. Accept. Run **Mati: Diagnose capture**. Confirm `hooks.json` `hasMati=true`, `enqueue.mjs=true`, and `capturing=true`.
6. Confirm the hook is on disk: `grep -i mati ~/.cursor/hooks.json` should show `./hooks/mati-capture.sh`. `ls ~/.cursor/hooks/mati/` should list `cursor.mjs` and `enqueue.mjs`.
7. Send an Agent prompt. Confirm a hook fired: `~/.mati/queue/<deviceId>.jsonl` gains a line (or Diagnose queue count increases), then **Mati: Open report** shows the prompt. Optional manual fire: `echo '{"hook_event_name":"beforeSubmitPrompt","prompt":"ping","conversation_id":"t1"}' | ~/.cursor/hooks/mati-capture.sh` then check the queue.
8. Reload the window: capture should resume without running Start. Status bar stays capturing only if the gate is still true. Click the status bar to pause; reload again: it should stay paused until you resume. `hooks.json` should still contain Mati after pause.
9. Open a second window that has **not** consented: Diagnose in the first window must still show `capturing=true`.
10. Wait or set `mati.idleMinutes` to `1`, wait a minute, send another prompt: a new task (`#m1`) should appear. **Mati: New task** / **Mati: End task** should split immediately.

Origin failures show the URL tried and the HTTP status or network error (for example `Could not register this device at https://example (HTTP 500).`).

## Install notes

A Cursor plugin (`.cursor-plugin`) is not used in this phase. Cursor does not document an API for a VS Code-compatible extension to register Agent hooks, so the extension writes `~/.cursor/hooks.json` only after explicit workspace consent and removes that block on **Mati: Delete my capture data** (not on pause). Failures to write or verify hooks surface as an error dialog. The drain loop re-merges the Mati block if Cursor overwrites the file.

Override paths in tests with `MATI_CURSOR_HOOKS_PATH`, `MATI_COPILOT_HOOKS_PATH`, `MATI_VSCODE_SETTINGS_PATH`, `MATI_QUEUE_DIR`, `MATI_HOME`, and `MATI_APP_ORIGIN`.
