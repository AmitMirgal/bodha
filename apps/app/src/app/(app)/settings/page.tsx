import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsScreen } from "../../../components/SettingsScreen";
import { requireUser } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Settings",
};

export default async function SettingsPage() {
	const { supabase, userId } = await requireUser();
	if (!userId) {
		redirect("/login?next=/settings");
	}
	const { data } = await supabase.auth.getUser();
	const email = data.user?.email ?? "";

	return <SettingsScreen email={email} />;
}
