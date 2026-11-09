import { promises as dns } from "node:dns";
import { isIP } from "node:net";

const TRAILING_SLASH = /\/$/;

const BLOCKED_HOSTS = new Set([
	"metadata.google.internal",
	"metadata.google.com",
	"169.254.169.254",
	"localhost",
	"127.0.0.1",
	"0.0.0.0",
	"::1",
	"ip6-localhost",
]);

export class EndpointValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EndpointValidationError";
	}
}

export function parseAllowedHosts(raw: string | undefined): string[] {
	if (!raw) {
		return [];
	}
	return raw
		.split(",")
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);
}

export function isPrivateIpv4(address: string): boolean {
	const parts = address.split(".").map((part) => Number(part));
	if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
		return false;
	}
	const [a, b] = parts;
	if (a === 10 || a === 127 || a === 0) {
		return true;
	}
	if (a === 169 && b === 254) {
		return true;
	}
	if (a === 172 && b >= 16 && b <= 31) {
		return true;
	}
	if (a === 192 && b === 168) {
		return true;
	}
	return false;
}

export function isPrivateIp(address: string): boolean {
	const version = isIP(address);
	if (version === 4) {
		return isPrivateIpv4(address);
	}
	if (version === 6) {
		const normalized = address.toLowerCase();
		return (
			normalized === "::1" ||
			normalized.startsWith("fc") ||
			normalized.startsWith("fd") ||
			normalized.startsWith("fe80") ||
			normalized.startsWith("::ffff:")
		);
	}
	return false;
}

export interface ValidatedEndpoint {
	host: string;
	href: string;
	origin: string;
}

function parseEndpointUrl(rawUrl: string): URL {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		throw new EndpointValidationError("Base URL is not a valid URL.");
	}

	if (parsed.protocol !== "https:") {
		throw new EndpointValidationError("Base URL must use HTTPS.");
	}
	if (parsed.username || parsed.password) {
		throw new EndpointValidationError("Base URL must not include credentials.");
	}
	return parsed;
}

function assertHostAllowed(host: string, allowedHosts: string[]) {
	if (
		BLOCKED_HOSTS.has(host) ||
		host.endsWith(".internal") ||
		host.endsWith(".local")
	) {
		throw new EndpointValidationError("That host is not allowed.");
	}
	if (isIP(host) && isPrivateIp(host)) {
		throw new EndpointValidationError(
			"Private or link-local addresses are not allowed."
		);
	}
	const allowed = new Set(allowedHosts.map((value) => value.toLowerCase()));
	if (allowed.size === 0) {
		throw new EndpointValidationError("No allowed LLM hosts are configured.");
	}
	const hostAllowed =
		allowed.has(host) ||
		[...allowed].some(
			(entry) => entry.startsWith("*.") && host.endsWith(entry.slice(1))
		);
	if (!hostAllowed) {
		throw new EndpointValidationError(
			`Host ${host} is not on the operator-approved LLM host list.`
		);
	}
}

export async function assertPublicDns(host: string) {
	try {
		const resolved = await dns.lookup(host, { all: true, verbatim: true });
		for (const record of resolved) {
			if (isPrivateIp(record.address)) {
				throw new EndpointValidationError(
					"The host resolves to a private or link-local address."
				);
			}
		}
	} catch (error) {
		if (error instanceof EndpointValidationError) {
			throw error;
		}
		throw new EndpointValidationError("Could not resolve the LLM host.");
	}
}

export function endpointFromHref(href: string): ValidatedEndpoint {
	const parsed = new URL(href);
	return {
		href: href.replace(TRAILING_SLASH, ""),
		origin: parsed.origin,
		host: parsed.hostname.toLowerCase(),
	};
}

export async function validateLlmEndpoint(
	rawUrl: string,
	allowedHosts: string[]
): Promise<ValidatedEndpoint> {
	const parsed = parseEndpointUrl(rawUrl);
	const host = parsed.hostname.toLowerCase();
	assertHostAllowed(host, allowedHosts);
	await assertPublicDns(host);

	const normalized = new URL(parsed.href);
	if (!normalized.pathname || normalized.pathname === "/") {
		normalized.pathname = "/v1";
	}

	return {
		href: normalized.href.replace(TRAILING_SLASH, ""),
		origin: normalized.origin,
		host,
	};
}

export function assertNoRedirectToPrivate(
	responseUrl: string,
	original: ValidatedEndpoint
) {
	const next = new URL(responseUrl);
	if (next.origin !== original.origin) {
		throw new EndpointValidationError(
			"LLM endpoint redirected off the approved origin."
		);
	}
}
