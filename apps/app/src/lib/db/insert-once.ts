import type { SupabaseClient } from "@supabase/supabase-js";
import { PersistenceError } from "../errors";

export type QueryError = { code?: string; message?: string } | null;

export function isUniqueViolation(error: QueryError): boolean {
	return error?.code === "23505";
}

/**
 * Insert-only idempotency for tables that must not receive UPDATE grants.
 * Postgres ON CONFLICT DO UPDATE (PostgREST upsert) requires UPDATE privilege
 * even when the conflicting row is left unchanged. First write wins: INSERT,
 * and on unique violation SELECT the existing row.
 */
export async function insertOnce<T extends Record<string, unknown>>(
	supabase: SupabaseClient,
	table: string,
	row: Record<string, unknown>,
	match: Record<string, string | number>,
	select = "*",
): Promise<{ created: boolean; data: T }> {
	const inserted = await supabase
		.from(table)
		.insert(row)
		.select(select)
		.single();
	if (!inserted.error && inserted.data) {
		return { created: true, data: inserted.data as unknown as T };
	}
	if (!isUniqueViolation(inserted.error)) {
		throw new PersistenceError();
	}
	let query = supabase.from(table).select(select);
	for (const [column, value] of Object.entries(match)) {
		query = query.eq(column, value);
	}
	const existing = await query.maybeSingle();
	if (existing.error || !existing.data) {
		throw new PersistenceError();
	}
	return { created: false, data: existing.data as unknown as T };
}
