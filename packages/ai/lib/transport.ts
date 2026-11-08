import {
	assertNoRedirectToPrivate,
	EndpointValidationError,
	type ValidatedEndpoint,
} from "./endpoint";

export async function fetchApprovedEndpoint(
	endpoint: ValidatedEndpoint,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const base = endpoint.href.replace(/\/$/, "");
	const suffix = path.startsWith("/") ? path : `/${path}`;
	const response = await fetch(`${base}${suffix}`, {
		...init,
		redirect: "manual",
	});
	if (response.status >= 300 && response.status < 400) {
		const location = response.headers.get("location");
		if (location) {
			assertNoRedirectToPrivate(new URL(location, `${base}/`).href, endpoint);
		}
		throw new EndpointValidationError(
			"The endpoint issued a redirect; refusing to follow it automatically.",
		);
	}
	return response;
}
