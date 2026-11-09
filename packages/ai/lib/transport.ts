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
	endpoint: ValidatedEndpoint
) {
	const host = hostname.toLowerCase();
	if (isIP(host)) {
		if (host !== endpoint.host.toLowerCase()) {
			throw new EndpointValidationError(
				"LLM request targeted an IP that is not the approved endpoint host."
			);
		}
		return;
	}
	await assertPublicDns(host);
}

export const LLM_FETCH_TIMEOUT_MS = 30_000;
export const LLM_FETCH_MAX_BYTES = 2_000_000;

function withTimeout(
	external: AbortSignal | undefined,
	timeoutMs: number
): { signal: AbortSignal; cancel: () => void } {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const onAbort = () => controller.abort();
	external?.addEventListener("abort", onAbort);
	return {
		signal: controller.signal,
		cancel: () => {
			clearTimeout(timer);
			external?.removeEventListener("abort", onAbort);
		},
	};
}

export function createProtectedFetch(
	endpoint: ValidatedEndpoint
): typeof fetch {
	return async (input, init) => {
		const url = requestUrl(input);
		if (url.origin !== endpoint.origin) {
			throw new EndpointValidationError(
				"LLM request left the approved origin."
			);
		}
		await assertResolvedAddressAllowed(url.hostname, endpoint);
		const timed = withTimeout(init?.signal ?? undefined, LLM_FETCH_TIMEOUT_MS);
		let response: Response;
		try {
			response = await fetch(url, {
				...init,
				redirect: "manual",
				signal: timed.signal,
			});
		} catch (error) {
			timed.cancel();
			if (error instanceof Error && error.name === "AbortError") {
				throw new EndpointValidationError("LLM request timed out.");
			}
			throw error;
		}
		timed.cancel();
		const length = response.headers.get("content-length");
		if (length && Number(length) > LLM_FETCH_MAX_BYTES) {
			throw new EndpointValidationError(
				"LLM response exceeded the size limit."
			);
		}
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			if (location) {
				const next = new URL(location, url);
				assertNoRedirectToPrivate(next.href, endpoint);
				await assertResolvedAddressAllowed(next.hostname, endpoint);
			}
			throw new EndpointValidationError(
				"The endpoint issued a redirect; refusing to follow it automatically."
			);
		}
		return response;
	};
}

const TRAILING_SLASH = /\/$/;

export async function fetchApprovedEndpoint(
	endpoint: ValidatedEndpoint,
	path: string,
	init: RequestInit = {}
): Promise<Response> {
	const base = endpoint.href.replace(TRAILING_SLASH, "");
	const suffix = path.startsWith("/") ? path : `/${path}`;
	return await createProtectedFetch(endpoint)(`${base}${suffix}`, init);
}
