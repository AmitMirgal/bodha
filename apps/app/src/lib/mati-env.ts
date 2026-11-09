/** Server-only MATI_* lookup. BODHA_* names are not read. */
export function matiEnv(
	suffix: string,
	env: object = process.env
): string | undefined {
	const preferred = Reflect.get(env, `MATI_${suffix}`);
	if (typeof preferred === "string" && preferred.trim() !== "") {
		return preferred;
	}
	return undefined;
}
