# Publishing Mati (Marketplace + Open VSX)

Prep only. Amit publishes. Do not run publish commands from CI or from an agent.

## Decision: production origin

Released VSIX builds default `mati.serverUrl` to **`https://mati-tau.vercel.app`**.

Precedence at command time:

1. `MATI_APP_ORIGIN` (environment)
2. `mati.serverUrl` (setting)
3. stored `mati.appOrigin` secret
4. `https://mati-tau.vercel.app`

Use `http://127.0.0.1:3000` only while developing the app locally. Trailing slashes are stripped.

## Before first publish

1. Set `publisher` in `extensions/mati/package.json`. It is currently the vsce-valid placeholder **`replace-with-amit-publisher`** (lowercase identifier). Replace it with Amit's Marketplace/Open VSX publisher ID before first publish.
2. Create that publisher on the [VS Code Marketplace](https://marketplace.visualstudio.com/manage) and on [Open VSX](https://open-vsx.org/).
3. Replace screenshot placeholders in `extensions/mati/README.md`.
4. Confirm `media/icon.png` (128×128 or larger PNG) and `galleryBanner`.
5. Apply Prisma migrations on production (`pnpm --filter app prisma:migrate:deploy`). Do not `db push`. Do not add `supabase/migrations`.

## Package locally (no publish)

From the repo root:

```bash
pnpm --filter mati typecheck
pnpm --filter mati test
pnpm --filter mati package
```

This writes `extensions/mati/mati-0.0.1.vsix`. CI runs the same package step and uploads the vsix artifact. Publish jobs stay `if: false`.

## VS Code Marketplace (`vsce`)

Create a Personal Access Token in Azure DevOps with Marketplace (Publish) scope.

```bash
cd extensions/mati
pnpm compile
npx @vscode/vsce login replace-with-amit-publisher
npx @vscode/vsce publish
```

Or one shot (token is not stored in the repo):

```bash
cd extensions/mati
npx @vscode/vsce publish -p "$VSCE_PAT"
```

Never commit the PAT. Never print it in logs.

## Open VSX (`ovsx`)

Create an [Open VSX access token](https://open-vsx.org/user-settings/tokens).

```bash
cd extensions/mati
npx ovsx publish -p "$OVSX_PAT"
```

`ovsx` publishes the vsix produced by `vsce package`. Do not publish from GitHub Actions until Amit enables those jobs.

## Privacy checklist before publish

- Capture stays anonymous in the extension (device token in Secret Storage, no sign-in).
- Open report uses a viewer HMAC plus an optional short-lived claim token. The long-lived device secret must not appear in a URL.
- README must say what is captured, what is not, consent, masking limits, and the production origin.
