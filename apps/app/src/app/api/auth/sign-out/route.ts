import { NextResponse } from "next/server";
import { createUserSupabase } from "../../../../lib/supabase/server";

export async function POST() {
	const supabase = await createUserSupabase();
	await supabase.auth.signOut();
	return NextResponse.json({ ok: true });
}
