import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseConfig } from "../env";

export async function createUserSupabase() {
	const { url, publishableKey } = getPublicSupabaseConfig();
	const cookieStore = await cookies();

	return createServerClient(url, publishableKey, {
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet) {
				try {
					for (const { name, value, options } of cookiesToSet) {
						cookieStore.set(name, value, options);
					}
				} catch {
					// Called from a Server Component; Proxy refreshes the session.
				}
			},
		},
	});
}

export async function requireUser() {
	const supabase = await createUserSupabase();
	const { data, error } = await supabase.auth.getUser();
	if (error || !data.user) {
		return { supabase, userId: null as string | null };
	}
	return { supabase, userId: data.user.id };
}
