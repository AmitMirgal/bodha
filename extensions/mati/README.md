# Mati editor capture

Captures Cursor Agent and Copilot Chat prompts on this device so you can see which prompts you used and later how to improve them. There is no sign-in.

Cursor hooks have no vendor token counts; any estimate is labelled and undercounts. Copilot Chat can report measured tokens from OpenTelemetry `chat` spans when Mati is allowed to write a file exporter. `github.copilot.chat.otel.captureContent` stays false.

This package is not published to the VS Code Marketplace or Open VSX.

## Use

1. Run **Mati: Start capturing** and Accept. That registers an anonymous device token in SecretStorage and, after consent, writes a Mati block into `~/.cursor/hooks.json` and `~/.copilot/hooks/mati.json`. If Copilot OTel is not already configured, Mati writes a file exporter to `~/.mati/otel/copilot.jsonl`. If another exporter is already set, Mati leaves it and Copilot token counts stay missing.
2. Send an Agent prompt in Cursor or Copilot Chat.
3. Run **Mati: Open report** to open the signed device viewer.

**Mati: Stop capturing** removes only the Mati hook files and, if Mati wrote the OTel settings, those keys. The device token stays until a later delete command.

## Packaging

CI builds a `.vsix` and runs tests; the publish jobs are disabled (`if: false`). Do not run `vsce publish` or `ovsx publish` from this repo until Amit approves.

## Install notes

A Cursor plugin (`.cursor-plugin`) is not used in this phase. Cursor does not document an API for a VS Code-compatible extension to register Agent hooks, so the extension writes `~/.cursor/hooks.json` only after explicit consent and removes that block on stop/uninstall.

Override paths in tests with `MATI_CURSOR_HOOKS_PATH`, `MATI_COPILOT_HOOKS_PATH`, `MATI_VSCODE_SETTINGS_PATH`, `MATI_QUEUE_DIR`, `MATI_HOME`, and `MATI_APP_ORIGIN`.
