import { createHash, randomUUID } from "node:crypto";

export function operationId(parts: string[]): string {
	return createHash("sha256")
		.update(parts.join(":"))
		.digest("hex")
		.slice(0, 32);
}

export function newIdempotencyKey(prefix: string): string {
	return `${prefix}:${randomUUID()}`;
}
