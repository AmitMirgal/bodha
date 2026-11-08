import { NextResponse } from "next/server";
import { safeNextPath } from "../../../lib/http/safe-next";
import { createUserSupabase } from "../../../lib/supabase/server";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const next = safeNextPath(url.searchParams.get("next"));
	if (!code) {
		const login = new URL("/login", url.origin);
		login.searchParams.set("error", "missing_code");
		login.searchParams.set("next", next);
		return NextResponse.redirect(login);
	}
	const supabase = await createUserSupabase();
	const { error } = await supabase.auth.exchangeCodeForSession(code);
	if (error) {
		const login = new URL("/login", url.origin);
		login.searchParams.set("error", "link");
		login.searchParams.set("next", next);
		return NextResponse.redirect(login);
	}
	return NextResponse.redirect(new URL(next, url.origin));
}
