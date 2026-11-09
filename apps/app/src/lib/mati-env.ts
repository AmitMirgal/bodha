/** Preferred MATI_* with BODHA_* fallback so existing local .env.local still works. */
export function matiEnv(
	suffix: string,
	env: object = process.env
): string | undefined {
	const preferred = Reflect.get(env, `MATI_${suffix}`);
	if (typeof preferred === "string" && preferred.trim() !== "") {
		return preferred;
	}
	const legacy = Reflect.get(env, `BODHA_${suffix}`);
	if (typeof legacy === "string" && legacy.trim() !== "") {
		return legacy;
	}
	return undefined;
}
