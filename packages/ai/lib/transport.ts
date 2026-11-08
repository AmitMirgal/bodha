import { isIP } from "node:net";
import {
	assertNoRedirectToPrivate,
	assertPublicDns,
	EndpointValidationError,
	type ValidatedEndpoint,
} from "./endpoint";

function requestUrl(input: RequestInfo | URL): URL {
	if (typeof input === "string") {
		return new URL(input);
	}
	if (input instanceof URL) {
		return input;
	}
	return new URL(input.url);
}

async function assertResolvedAddressAllowed(
	hostname: string,
	endpoint: ValidatedEndpoint,
) {
	const host = hostname.toLowerCase();
	if (isIP(host)) {
		if (host !== endpoint.host.toLowerCase()) {
			throw new EndpointValidationError(
				"LLM request targeted an IP that is not the approved endpoint host.",
			);
		}
		return;
	}
	await assertPublicDns(host);
}

export function createProtectedFetch(
	endpoint: ValidatedEndpoint,
): typeof fetch {
	return async (input, init) => {
		const url = requestUrl(input);
		if (url.origin !== endpoint.origin) {
			throw new EndpointValidationError(
				"LLM request left the approved origin.",
			);
		}
		await assertResolvedAddressAllowed(url.hostname, endpoint);
		const response = await fetch(url, { ...init, redirect: "manual" });
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			if (location) {
				const next = new URL(location, url);
				assertNoRedirectToPrivate(next.href, endpoint);
				await assertResolvedAddressAllowed(next.hostname, endpoint);
			}
			throw new EndpointValidationError(
				"The endpoint issued a redirect; refusing to follow it automatically.",
			);
		}
		return response;
	};
}

export async function fetchApprovedEndpoint(
	endpoint: ValidatedEndpoint,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const base = endpoint.href.replace(/\/$/, "");
	const suffix = path.startsWith("/") ? path : `/${path}`;
	return createProtectedFetch(endpoint)(`${base}${suffix}`, init);
}
