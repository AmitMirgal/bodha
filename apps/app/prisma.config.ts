import { defineConfig } from "prisma/config";
import { resolvePrismaCliDatasourceUrl } from "./src/lib/db/urls";

// CLI datasource is DIRECT_URL (session-mode pooler, port 5432). Runtime Prisma
// Client uses DATABASE_URL (transaction-mode pooler, port 6543) via
// @prisma/adapter-pg and never reads this file's URL for product queries.
//
// Prisma 7's config API includes migrations.path. BODHA's single migration
// workflow is supabase/migrations/*.sql. Do not run `prisma migrate` — that
// would create apps/app/prisma/migrations and a second history. Generate can
// use a local placeholder when DIRECT_URL is unset; migrate / db pull fail.
export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: resolvePrismaCliDatasourceUrl({
			DIRECT_URL: process.env.DIRECT_URL,
		}),
	},
});
