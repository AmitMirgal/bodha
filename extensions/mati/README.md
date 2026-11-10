# Mati

Capture Cursor Agent and Copilot Chat prompts in a workspace so you can see which prompts you used and later how to improve them.

Capture **stays anonymous in the editor**. There is no sign-in in the extension. **Mati: Open report** opens a short device preview. Sign in (or create an account) on the web to link this device and keep past and future tasks on your Progress page.

Released builds talk to **`https://mati-tau.vercel.app`** unless you override `mati.serverUrl` or `MATI_APP_ORIGIN`. Use `http://127.0.0.1:3000` only for local app development.

This package is not published to the VS Code Marketplace or Open VSX until Amit sets `publisher` (currently the placeholder `replace-with-amit-publisher`) and runs the commands in `docs/publishing.md`.

## Screenshots

Replace these placeholders before Marketplace publish:

- `media/screenshot-consent.png` — workspace consent
- `media/screenshot-status.png` — status bar capturing
- `media/screenshot-report-light.png` — Progress task report, light
- `media/screenshot-report-dark.png` — Progress task report, dark

## What is captured

After you Accept in a workspace, Mati stores:

- Prompts you send to Cursor Agent or Copilot Chat
- Assistant text when the hook provides it
- Edited file names (paths, not file contents)
- A device token on this machine (Secret Storage)
- Token counts when the editor reports them. Cursor hooks have **no vendor token counts**; any number is a labelled `text_estimate` and undercounts. Copilot Chat can report **vendor-measured** tokens from OpenTelemetry `chat` spans when Mati is allowed to write a file exporter.

## What is not captured

- Inline completions, Cmd+K, Claude/Codex harnesses, cloud Agent sessions
- File contents
- The long-lived device secret in a URL
- Past chats at startup (there is no transcript API; only hook events going forward)
- `github.copilot.chat.otel.captureContent` stays false

Known secret patterns are replaced with `[redacted:class]` on this device before upload. That is not a guarantee.

## Consent and privacy

Consent is **one-time per workspace** and explicit. A workspace that has never accepted must not capture.

1. Open the workspace. If you have not consented here, click **Start capturing** or run **Mati: Start capturing** and Accept.
2. After this workspace has consented, capture **starts automatically** the next time you open it, including after a window reload. You do not run Start on every launch.
3. Pause persists until you resume. **Mati: Stop capturing** pauses (hooks stay installed).
4. **Mati: Delete my capture data** removes hooks, the device token, and this workspace's consent.

The status bar follows the **gate and hooks.json**, not only local consent. If this workspace consented but hooks are missing or the gate is false, it shows a warning and **Mati: Diagnose capture**.

## Open report and account

**Mati: Open report** opens the app. If you are signed out, it routes to sign in / create account (existing email auth; anonymous sign-ins are not used). After sign-in, a consent screen **Link this device to your account** consumes a short-lived one-time claim code from the extension. The long-lived device secret is never placed in the URL.

After claim, past and future tasks from this device appear under your account in Progress. Multiple devices per account are allowed. Each account only sees its own devices and tasks.

You can still generate a pairing code in Settings and run **Mati: Claim this device**.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `mati.serverUrl` | `https://mati-tau.vercel.app` | App origin. Precedence: `MATI_APP_ORIGIN` env, then this setting, then a stored `mati.appOrigin` secret, then production. Trailing slashes are stripped. Read at command time. |
| `mati.idleMinutes` | `30` | Idle gap before a new task (1–1440). |

**Mati: New task** and **Mati: End task** correct task boundaries. Branch and workspace folder changes also start a new task.

## Reports

Claimed editor tasks get a per-task learning report: prompt timeline, responses, edited files, labelled token usage (`text_estimate` vs vendor-measured), and coaching (what worked, concrete improvements, improved prompt examples). Coaching is generated server-side with your saved BYOK key. With no key, the report is facts-only plus a Settings CTA. Suggestions are not skill scores.

## Local testing

Point the extension at a local or preview app without launching Cursor from a terminal:

1. Start the app (`pnpm --filter app dev` from the repo root, or your preview URL).
2. `pnpm --filter mati package` and install the `.vsix` (Extensions: Install from VSIX).
3. In Cursor: **Settings → Extensions → Mati → Server URL** (`mati.serverUrl`) to `http://127.0.0.1:3000`.
4. Open a workspace that has **not** consented: confirm the status bar shows Mati off and a prompt appears; no `~/.mati/queue` lines should appear until you Accept.
5. Accept. Run **Mati: Diagnose capture**. Confirm `hooks.json` `hasMati=true`, `enqueue.mjs=true`, and `capturing=true`.
6. Send an Agent prompt. **Mati: Open report** shows a device preview and a sign-in CTA.
7. Reload the window: capture should resume without running Start. Click the status bar to pause; reload again: it should stay paused until you resume.

Override paths in tests with `MATI_CURSOR_HOOKS_PATH`, `MATI_COPILOT_HOOKS_PATH`, `MATI_VSCODE_SETTINGS_PATH`, `MATI_QUEUE_DIR`, `MATI_HOME`, and `MATI_APP_ORIGIN`.
