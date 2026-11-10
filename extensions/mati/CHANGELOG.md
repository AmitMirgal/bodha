# Changelog

## 0.0.1

- Workspace consent, pause/resume, and automatic re-arm on activate for a consented, unpaused workspace.
- Capture Cursor Agent and Copilot Chat prompts, assistant text, edited file names, and labelled token counts.
- Device-only preview from **Mati: Open report**. Sign in on the web to link the device with a short-lived claim code (the long-lived device secret is never placed in a URL).
- Per-task Progress reports after a device is linked: facts always, coaching when a BYOK key is saved.
- Default `mati.serverUrl` for released builds is `https://mati-tau.vercel.app`. Override with `MATI_APP_ORIGIN` or the setting; use `http://127.0.0.1:3000` only for local app development.
