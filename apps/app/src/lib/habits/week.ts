export function utcDay(iso: string): string {
	return new Date(iso).toISOString().slice(0, 10);
}

export function utcMonday(iso: string): string {
	const date = new Date(iso);
	const weekday = date.getUTCDay();
	const diff = weekday === 0 ? -6 : 1 - weekday;
	date.setUTCDate(date.getUTCDate() + diff);
	return date.toISOString().slice(0, 10);
}

export function addCivilDays(day: string, delta: number): string {
	const [year, month, date] = day.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, date + delta))
		.toISOString()
		.slice(0, 10);
}

export function nextCivilDay(day: string): string {
	return addCivilDays(day, 1);
}

export function previousCivilDay(day: string): string {
	const [year, month, date] = day.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, date - 1))
		.toISOString()
		.slice(0, 10);
}

export function civilDaysBack(today: string, count: number): string[] {
	const days: string[] = [];
	let cursor = today;
	for (let index = 0; index < count; index += 1) {
		days.unshift(cursor);
		cursor = previousCivilDay(cursor);
	}
	return days;
}

export function civilDaysForward(start: string, count: number): string[] {
	const days: string[] = [];
	let cursor = start;
	for (let index = 0; index < count; index += 1) {
		days.push(cursor);
		cursor = nextCivilDay(cursor);
	}
	return days;
}
