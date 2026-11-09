const PEM =
	/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const AWS = /\bAKIA[0-9A-Z]{16}\b/g;
const GITHUB = /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g;
const GITHUB_PAT = /\bgithub_pat_[A-Za-z0-9_]+\b/g;
const SLACK = /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g;
const STRIPE = /\bsk_live_[A-Za-z0-9]{16,}\b/g;
const JWT =
	/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._\-+=/]+/gi;
const ENV_SECRET =
	/^(?:export\s+)?[A-Z][A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)[ \t]*=[ \t]*.+$/gim;

export function redactSecrets(text: string): string {
	return text
		.replace(PEM, "[redacted:private_key]")
		.replace(AWS, "[redacted:aws_access_key]")
		.replace(GITHUB, "[redacted:github_token]")
		.replace(GITHUB_PAT, "[redacted:github_token]")
		.replace(SLACK, "[redacted:slack_token]")
		.replace(STRIPE, "[redacted:stripe_live_key]")
		.replace(JWT, "[redacted:jwt]")
		.replace(BEARER, "[redacted:bearer]")
		.replace(ENV_SECRET, (line) => {
			const eq = line.indexOf("=");
			if (eq === -1) {
				return "[redacted:env]";
			}
			return `${line.slice(0, eq + 1)}[redacted:env]`;
		});
}

export function estimateTokensFromText(text: string): number {
	return Math.ceil(Array.from(text).length / 4);
}
