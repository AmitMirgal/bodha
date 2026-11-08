import { redirect } from "next/navigation";
import { AppNav } from "../../components/AppNav";
import { LlmSettingsForm } from "../../components/LlmSettingsForm";
import { requireUser } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
	const { supabase, userId } = await requireUser();
	if (!userId) {
		redirect("/login?next=/settings");
	}
	const { data } = await supabase.auth.getUser();
	return (
		<>
			<AppNav email={data.user?.email} />
			<LlmSettingsForm />
		</>
	);
}
