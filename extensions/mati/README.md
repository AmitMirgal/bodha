# Mati editor capture

Captures Cursor Agent and Copilot Chat prompts in a workspace so you can see which prompts you used and later how to improve them. There is no sign-in.

Cursor hooks have no vendor token counts; any estimate is labelled and undercounts. Copilot Chat can report measured tokens from OpenTelemetry `chat` spans when Mati is allowed to write a file exporter. `github.copilot.chat.otel.captureContent` stays false.

This package is not published to the VS Code Marketplace or Open VSX.

## Use

Consent is **one-time per workspace** and explicit. A workspace that has never accepted must not capture; Mati shows a status-bar item and a non-intrusive prompt instead.

1. Open the workspace. If you have not consented here, click **Start capturing** on the prompt or run **Mati: Start capturing** and Accept. That registers an anonymous device token (reused on this machine) and writes hook files.
2. After this workspace has consented, capture **starts automatically** the next time you open it. You do not run Start on every launch.
3. The status bar shows capturing / paused / off. Click it to pause or resume. Pause persists until you resume. **Mati: Stop capturing** pauses; **Mati: Start capturing** resumes if this workspace already consented.
4. Send an Agent prompt in Cursor or Copilot Chat.
5. Run **Mati: Open report** to open the signed device viewer.

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

Hooks are **user-level**, not per-window. Mati writes `~/.mati/capture-gate.json` and the hook scripts enqueue only while `capturing` is true for the active consented workspace. Another Cursor window can still fire the same hooks; the gate is fail-closed for pause / no consent, but it cannot isolate two capturing workspaces at once.

Closing the window turns the gate off. Reopening a consented, unpaused workspace turns it back on and drains `~/.mati/queue`.

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
5. Accept. Send an Agent prompt. Confirm the status bar shows capturing and **Mati: Open report** works.
6. Reload the window: capture should resume without running Start. Click the status bar to pause; reload again: it should stay paused until you resume.
7. Wait or set `mati.idleMinutes` to `1`, wait a minute, send another prompt: a new task (`#m1`) should appear. **Mati: New task** / **Mati: End task** should split immediately.

Origin failures show the URL tried and the HTTP status or network error (for example `Could not register this device at https://example (HTTP 500).`).

## Install notes

A Cursor plugin (`.cursor-plugin`) is not used in this phase. Cursor does not document an API for a VS Code-compatible extension to register Agent hooks, so the extension writes `~/.cursor/hooks.json` only after explicit workspace consent and removes that block on pause/delete.

Override paths in tests with `MATI_CURSOR_HOOKS_PATH`, `MATI_COPILOT_HOOKS_PATH`, `MATI_VSCODE_SETTINGS_PATH`, `MATI_QUEUE_DIR`, `MATI_HOME`, and `MATI_APP_ORIGIN`.
