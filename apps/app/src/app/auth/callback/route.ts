import { NextResponse } from "next/server";
import { createUserSupabase } from "../../../lib/supabase/server";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const next = url.searchParams.get("next") ?? "/";
	if (code) {
		const supabase = await createUserSupabase();
		await supabase.auth.exchangeCodeForSession(code);
	}
	return NextResponse.redirect(new URL(next, url.origin));
}
