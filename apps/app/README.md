# Mati trainer (`apps/app`)

Individual learning MVP: sign in, run shelf/cache exercises, chat with a server-side Mastra agent, revisit evidence-grounded reports.

See [`../../README.md`](../../README.md) and [`../../docs/mati-mvp.md`](../../docs/mati-mvp.md) for setup, Prisma + RLS, BYOK, and exercise authoring.

```bash
# from repo root
pnpm install --frozen-lockfile
cp apps/app/.env.example apps/app/.env.local
pnpm --filter app prisma:generate
pnpm --filter app dev
```
