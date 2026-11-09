const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const hits = new Map<string, number[]>();

export function takeDeviceSlot(deviceId: string, now = Date.now()): boolean {
	const recent = (hits.get(deviceId) ?? []).filter(
		(stamp) => now - stamp < WINDOW_MS
	);
	if (recent.length >= MAX_REQUESTS) {
		hits.set(deviceId, recent);
		return false;
	}
	recent.push(now);
	hits.set(deviceId, recent);
	return true;
}
