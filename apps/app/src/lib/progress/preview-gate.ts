export function progressFixtureEnabled(): boolean {
	if (process.env.VERCEL_ENV === "production") {
		return false;
	}
	return process.env.MATI_PROGRESS_FIXTURE === "1";
}
