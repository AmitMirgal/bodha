import { defineConfig } from "prisma/config";
import {
	assertDirectUrl,
	resolvePrismaCliDatasourceUrl,
} from "./src/lib/db/urls";

// CLI datasource is DIRECT_URL (session-mode pooler, port 5432). Runtime Prisma
// Client uses DATABASE_URL (transaction-mode pooler, port 6543) via
// @prisma/adapter-pg and never reads this file's URL for product queries.
//
// Authoritative schema history is prisma/migrations. Apply with
// `prisma migrate deploy`. Do not `prisma db push`. Generate can use a local
// placeholder when DIRECT_URL is unset; migrate / db pull fail closed without it.
const shadow = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
	schema: "prisma/schema.prisma",
	experimental: {
		externalTables: true,
	},
	migrations: {
		path: "prisma/migrations",
		initShadowDb: `
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text
);
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::json->>'sub'
  )::uuid
$$;
`,
	},
	datasource: {
		url: resolvePrismaCliDatasourceUrl({
			DIRECT_URL: process.env.DIRECT_URL,
		}),
		...(shadow ? { shadowDatabaseUrl: assertDirectUrl(shadow) } : {}),
	},
});
