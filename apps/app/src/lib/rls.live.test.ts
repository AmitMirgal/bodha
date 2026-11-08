import { describe, it } from "vitest";

const hasLive =
	Boolean(process.env.BODHA_LIVE_SUPABASE_URL) &&
	Boolean(process.env.BODHA_LIVE_SUPABASE_PUBLISHABLE_KEY);

describe.skipIf(!hasLive)(
	"live Supabase RLS (blocked unless isolated credentials are set)",
	() => {
		it("placeholder: two-user and anonymous checks run only against isolated nonprod", () => {
			// Intentionally empty when credentials are absent. See docs/bodha-mvp.md.
		});
	},
);
