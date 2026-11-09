# Mati editor capture

Captures Cursor Agent prompts on this device so you can see which prompts you used and later how to improve them. There is no sign-in. Token counts from Cursor hooks are omitted in this version, not guessed.

This package is not published to the VS Code Marketplace or Open VSX.

## Use

1. Run **Mati: Start capturing** and Accept. That registers an anonymous device token in SecretStorage and, after consent, writes a Mati block into `~/.cursor/hooks.json`.
2. Send an Agent prompt in Cursor.
3. Run **Mati: Open report** to open the signed device viewer.

**Mati: Stop capturing** removes only the Mati hook block. The device token stays until a later delete command.

## Install notes

A Cursor plugin (`.cursor-plugin`) is not used in this phase. Cursor does not document an API for a VS Code-compatible extension to register Agent hooks, so the extension writes `~/.cursor/hooks.json` only after explicit consent and removes that block on stop/uninstall.

Override paths in tests with `MATI_CURSOR_HOOKS_PATH`, `MATI_QUEUE_DIR`, `MATI_HOME`, and `MATI_APP_ORIGIN`.
