"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "../env";

export function createBrowserSupabase() {
	const { url, publishableKey } = getPublicSupabaseConfig();
	return createBrowserClient(url, publishableKey);
}
