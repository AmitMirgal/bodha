import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseConfig } from "../env";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/confirm"];

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({ request });
	let config: ReturnType<typeof getPublicSupabaseConfig>;
	try {
		config = getPublicSupabaseConfig();
	} catch {
		return supabaseResponse;
	}

	const supabase = createServerClient(config.url, config.publishableKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				for (const { name, value } of cookiesToSet) {
					request.cookies.set(name, value);
				}
				supabaseResponse = NextResponse.next({ request });
				for (const { name, value, options } of cookiesToSet) {
					supabaseResponse.cookies.set(name, value, options);
				}
			},
		},
	});

	const { data } = await supabase.auth.getClaims();
	const userId = data?.claims?.sub;
	const path = request.nextUrl.pathname;
	const isPublic =
		PUBLIC_PATHS.some(
			(prefix) => path === prefix || path.startsWith(`${prefix}/`)
		) ||
		path.startsWith("/_next") ||
		path.startsWith("/harness.js");

	if (!(userId || isPublic)) {
		const url = request.nextUrl.clone();
		url.pathname = "/login";
		url.searchParams.set("next", path);
		const redirect = NextResponse.redirect(url);
		for (const cookie of supabaseResponse.cookies.getAll()) {
			redirect.cookies.set(cookie);
		}
		for (const header of ["cache-control", "expires", "pragma"]) {
			const value = supabaseResponse.headers.get(header);
			if (value) {
				redirect.headers.set(header, value);
			}
		}
		return redirect;
	}

	return supabaseResponse;
}
