export const SIGN_OUT_PATH = "/api/auth/sign-out";

export function signOutRequest(
	fetchImpl: typeof fetch = fetch
): Promise<Response> {
	return fetchImpl(SIGN_OUT_PATH, { method: "POST" });
}
