export function recentChronologicalTurns<T>(
	rowsNewestFirst: T[],
	limit = 20
): T[] {
	return rowsNewestFirst.slice(0, limit).reverse();
}
