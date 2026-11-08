import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
// Biome treats `[id]` in a CLI path as a glob character class, so lint the
// parent directories rather than the bracketed filenames.
const targets = [
	"apps/app/src/app",
	"apps/app/src/components",
	"apps/app/src/lib",
	"apps/app/src/mastra",
	"packages/ai/lib/capabilities.ts",
	"packages/ai/lib/model-adapter.ts",
	"packages/ai/lib/provider-types.ts",
	"packages/ai/lib/transport.ts",
	"packages/ai/lib/endpoint.ts",
	"packages/ai/provider.ts",
	"supabase/migrations",
	"docs/bodha-mvp.md",
];

const result = spawnSync("pnpm", ["exec", "ultracite", "check", ...targets], {
	cwd: root,
	stdio: "inherit",
	shell: false,
});
process.exit(result.status ?? 1);
