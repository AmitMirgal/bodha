import { defineConfig } from "prisma/config";

const GENERATE_PLACEHOLDER =
	"postgresql://postgres:postgres@127.0.0.1:5432/postgres";

// CLI (generate / db pull) uses the session-mode pooler or a generate-only
// placeholder. Runtime Prisma Client uses DATABASE_URL (transaction pooler)
// via @prisma/adapter-pg and never reads this file's URL for product queries.
export default defineConfig({
	schema: "prisma/schema.prisma",
	datasource: {
		url: process.env.DIRECT_URL ?? GENERATE_PLACEHOLDER,
	},
});
