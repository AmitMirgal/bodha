import { requireUser } from "../lib/supabase/server";
import { AppNav } from "./AppNav";

export async function UserNav() {
	const { supabase, userId } = await requireUser();
	if (!userId) {
		return <AppNav email={null} />;
	}
	const { data } = await supabase.auth.getUser();
	return <AppNav email={data.user?.email ?? null} />;
}
